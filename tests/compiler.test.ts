import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import type {AddressInfo} from 'node:net';
import {ARTIFACT_MAX,TOOLCHAINS,createCompilerServer,screenIncludes,tokenOk,validateFiles} from '../services/compiler/server.js';
import {LAB_TOOLCHAIN} from '../services/ops/lab-compile.js';
import {TOOLCHAINS as PRO_TOOLCHAINS} from '../services/ops/pro-compile.js';

const TOKEN='t'.repeat(40);
const root=mkdtempSync(join(tmpdir(),'compiler-test-'));
const jobs=join(root,'jobs');
mkdirSync(jobs,{recursive:true});
// Fake arduino-cli: behaviour is chosen by markers in the sketch. No toolchain needed.
const shim=join(root,'arduino-cli');
writeFileSync(shim,`#!/usr/bin/env node
const fs=require('fs'),path=require('path');
const a=process.argv.slice(2);
const build=a[a.indexOf('--build-path')+1],sk=a[a.length-1];
const fqbn=a[a.indexOf('-b')+1];
fs.appendFileSync(process.env.SHIM_LOG||'/dev/null',JSON.stringify({a,env:Object.keys(process.env),cwd:process.cwd()})+'\\n');
const src=fs.readFileSync(path.join(sk,'s.ino'),'utf8');
if(src.includes('SLEEP')){setTimeout(()=>{},60000);}
else if(src.includes('SPAM')){const b='x'.repeat(65536);for(let i=0;i<400;i++)process.stdout.write(b);setTimeout(()=>{},60000);}
else if(src.includes('FAIL')){console.error(path.join(sk,'s.ino')+':3:5: error: boom was not declared in '+path.join(sk,'s.ino'));process.exit(1);}
else{
fs.mkdirSync(build,{recursive:true});
const avr=fqbn.startsWith('arduino:avr');
const size=src.includes('HUGE')?${ARTIFACT_MAX}+10:12;
fs.writeFileSync(path.join(build,avr?'s.ino.hex':'s.ino.bin'),Buffer.alloc(size,65));
console.log('Sketch uses 924 bytes (2%) of program storage space.\\nGlobal variables use 9 bytes (0%) of dynamic memory.');
}
`);
chmodSync(shim,0o755);
const py=spawnSync('python3',['--version']).status===0;

async function boot(extra:Record<string,unknown>={}){
 const {server,service}=createCompilerServer({token:TOKEN,arduinoCli:shim,tmpRoot:jobs,python:['python3','-I',resolve('scripts/pro-sandbox/lint.py')],...extra});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 const post=(path:string,body:unknown,auth:string|null=`Bearer ${TOKEN}`)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(auth?{authorization:auth}:{})},body:JSON.stringify(body)});
 return{base,post,service,close:()=>new Promise<void>(r=>{server.closeAllConnections();server.close(()=>r());})};
}
const ino=(content='void setup(){}\nvoid loop(){}\n')=>[{name:'main.ino',content}];
const clean=()=>assert.deepEqual(readdirSync(jobs),[],'job dirs are removed');
const last=(p:string)=>{const l=readFileSync(p,'utf8').trim().split('\n');return JSON.parse(l[l.length-1]!) as {a:string[];env:string[];cwd:string};};

test('a missing or short token refuses to start',()=>{
 assert.throws(()=>createCompilerServer({token:''}),/at least 32/);
 assert.throws(()=>createCompilerServer({token:'short'}),/at least 32/);
 assert.equal(spawnSync(process.execPath,['--import','tsx','services/compiler/server.ts'],{env:{...process.env,COMPILER_TOKEN:''},encoding:'utf8'}).status,1);
});
test('tokenOk compares bearer tokens',()=>{
 assert.ok(tokenOk(`Bearer ${TOKEN}`,TOKEN));
 assert.ok(!tokenOk(`Bearer ${TOKEN}x`,TOKEN));
 assert.ok(!tokenOk(TOKEN,TOKEN));
 assert.ok(!tokenOk(undefined,TOKEN));
 assert.ok(!tokenOk('Bearer ',TOKEN));
});
test('auth: 401 without or with the wrong token, health is open',async()=>{
 const s=await boot();
 try{
  assert.equal((await s.post('/compile',{target:'uno',files:ino()},null)).status,401);
  assert.equal((await s.post('/compile',{target:'uno',files:ino()},'Bearer nope')).status,401);
  assert.equal((await s.post('/lint',{language:'python',files:[]},null)).status,401);
  const h=await fetch(s.base+'/health');assert.equal(h.status,200);assert.equal((await h.json() as {ok:boolean}).ok,true);
  assert.equal((await fetch(s.base+'/nothing',{headers:{authorization:`Bearer ${TOKEN}`}})).status,404);
  assert.equal((await fetch(s.base+'/compile',{headers:{authorization:`Bearer ${TOKEN}`}})).status,405);
 }finally{await s.close();}
});
test('file validation: strict names, no paths, caps',()=>{
 const e=(f:unknown)=>assert.throws(()=>validateFiles(f,/\.ino$/));
 e([{name:'../a.ino',content:'x'}]);e([{name:'/etc/a.ino',content:'x'}]);e([{name:'a/b.ino',content:'x'}]);e([{name:'a\\b.ino',content:'x'}]);
 e([{name:'.hidden.ino',content:'x'}]);e([{name:'a.exe',content:'x'}]);e([{name:'a.ino',content:'x\0'}]);e([]);e('x');
 e([{name:'a.ino',content:'x'},{name:'A.ino',content:'y'}]);
 e(Array.from({length:17},(_,i)=>({name:`f${i}.ino`,content:'x'})));
 assert.throws(()=>validateFiles([{name:'a.ino',content:'x'.repeat(100_000)},{name:'b.ino',content:'x'.repeat(100_001)}],/\.ino$/),(x:{status:number})=>x.status===413);
 assert.equal(validateFiles([{name:'ok_1-a.ino',content:'x'.repeat(200_000)}],/\.ino$/).length,1);
});
test('include screening',()=>{
 const f=(c:string)=>screenIncludes([{name:'s.ino',content:c}]);
 assert.equal(f('#include <WiFi.h>\n#include <avr/io.h>\n#include "util.h"\n// #include "/etc/passwd"\n').length,0);
 assert.equal(f('#include "/etc/passwd"').length,1);
 assert.equal(f('#include <../../etc/passwd>').length,1);
 assert.equal(f('#include "../x.h"').length,1);
 assert.equal(f('  #  include <a/../b.h>').length,1);
 assert.equal(f('#include "dir/x.h"').length,1);
 assert.equal(f('#include_next <x.h>').length,1);
 assert.equal(f('#import "x.h"').length,1);
 assert.equal(f('#if __has_include("/etc/passwd")\n#endif').length,1);
 assert.equal(f('__asm__(".incbin \\"x\\"");').length,1);
 assert.equal(f('#include \\\n"/etc/passwd"').length,1);
});
test('HTTP: bad requests are 400, oversized body 413',async()=>{
 const s=await boot();
 try{
  assert.equal((await s.post('/compile',{target:'arm',files:ino()})).status,400);
  assert.equal((await s.post('/compile',{target:'__proto__',files:ino()})).status,400);
  assert.equal((await s.post('/compile',{target:'uno',files:[{name:'../x.ino',content:'x'}]})).status,400);
  assert.equal((await s.post('/compile',{target:'uno',files:[{name:'a.h',content:'x'}]})).status,400);   // no .ino
  assert.equal((await s.post('/compile',{target:'uno',files:ino(),fqbn:'esp32:esp32:esp32'})).status,400);
  assert.equal((await s.post('/compile',{target:'esp32',files:ino(),fqbn:'esp32:esp32:esp32;rm -rf /'})).status,400);
  assert.equal((await s.post('/compile',{target:'uno',files:[{name:'a.ino',content:'x'.repeat(200_001)}]})).status,413);
  assert.equal((await s.post('/compile',{target:'uno',files:[{name:'a.ino',content:'x'.repeat(500_000)}]})).status,413);
  const bad=await fetch(s.base+'/compile',{method:'POST',headers:{authorization:`Bearer ${TOKEN}`},body:'{nope'});assert.equal(bad.status,400);
  assert.equal((await s.post('/lint',{language:'ruby',files:[{name:'a.py',content:'x'}]})).status,400);
  assert.equal((await s.post('/lint',{language:'python',files:[{name:'a.ino',content:'x'}]})).status,400);
  clean();
 }finally{await s.close();}
});
test('include rejection answers failed and never runs the compiler',async()=>{
 const log=join(root,'never.log');
 const s=await boot({env:{SHIM_LOG:log}});
 try{
  const r=await(await s.post('/compile',{target:'esp32',files:ino('#include "/etc/passwd"\n')})).json() as {status:string;diagnostics:{line:number}[]};
  assert.equal(r.status,'failed');assert.equal(r.diagnostics[0]!.line,1);
  assert.throws(()=>readFileSync(log),/ENOENT/);
  clean();
 }finally{await s.close();}
});
test('avr compile: result shape, flags, scrubbed env, cleanup',async()=>{
 const log=join(root,'avr.log');
 const s=await boot({env:{SHIM_LOG:log}});
 process.env.SECRET_TEST_ONLY='leak';
 try{
  const res=await s.post('/compile',{target:'uno',files:ino()});assert.equal(res.status,200);
  const j=await res.json() as {status:string;artifact:string;sha256:string;toolchain:string;sizes:{flash:number;ram:number}};
  assert.equal(j.status,'compiled');assert.equal(Buffer.from(j.artifact,'base64').length,12);
  assert.match(j.sha256,/^[0-9a-f]{64}$/);assert.equal(j.toolchain,TOOLCHAINS.avr);
  assert.deepEqual(j.sizes,{flash:924,ram:9});
  const run=last(log);
  assert.deepEqual(run.a.slice(0,3),['compile','-b','arduino:avr:uno']);
  assert.ok(run.a.includes('build.extra_flags=-fno-lto'));
  assert.ok(!run.env.includes('SECRET_TEST_ONLY')&&!run.env.includes('COMPILER_TOKEN'),'job env is scrubbed');
  assert.ok(run.cwd.includes('job-'));
  clean();
 }finally{delete process.env.SECRET_TEST_ONLY;await s.close();}
});
test('esp32 compile uses the right fqbn and an allow-listed override',async()=>{
 const log=join(root,'esp.log');
 const s=await boot({env:{SHIM_LOG:log}});
 try{
  assert.equal((await(await s.post('/compile',{target:'esp32s3',files:ino()})).json() as {toolchain:string}).toolchain,TOOLCHAINS.esp32s3);
  assert.equal(last(log).a[2],'esp32:esp32:esp32s3');
  await s.post('/compile',{target:'esp32',files:ino(),fqbn:'esp32:esp32:esp32c3'});
  assert.equal(last(log).a[2],'esp32:esp32:esp32c3');
  clean();
 }finally{await s.close();}
});
test('toolchain strings match what ops caches by',()=>{
 assert.equal(TOOLCHAINS.avr,LAB_TOOLCHAIN);
 assert.equal(TOOLCHAINS.esp32,PRO_TOOLCHAINS.esp32);assert.equal(TOOLCHAINS.esp32s3,PRO_TOOLCHAINS.esp32s3);
});
test('compile failure: diagnostics keep the user line, no server paths',async()=>{
 const s=await boot();
 try{
  const j=await(await s.post('/compile',{target:'uno',files:ino('FAIL')})).json() as {status:string;diagnostics:{line:number;message:string;severity:string}[];artifact:string};
  assert.equal(j.status,'failed');assert.equal(j.artifact,'');
  assert.equal(j.diagnostics[0]!.line,3);assert.equal(j.diagnostics[0]!.severity,'error');
  assert.ok(!JSON.stringify(j).includes('job-'),'no temp paths leak');
  clean();
 }finally{await s.close();}
});
test('artifact over 4 MB fails',async()=>{
 const s=await boot();
 try{
  const j=await(await s.post('/compile',{target:'esp32',files:ino('HUGE')})).json() as {status:string;artifact:string;diagnostics:{message:string}[]};
  assert.equal(j.status,'failed');assert.equal(j.artifact,'');assert.match(j.diagnostics[0]!.message,/limit/);
  clean();
 }finally{await s.close();}
});
test('timeout kills the compiler and cleans up',async()=>{
 const s=await boot({timeoutMs:{avr:400,esp32:400,lint:400}});
 try{
  const t=Date.now();
  const j=await(await s.post('/compile',{target:'uno',files:ino('SLEEP')})).json() as {status:string;timedOut:boolean};
  assert.equal(j.status,'failed');assert.equal(j.timedOut,true);assert.ok(Date.now()-t<5000);
  clean();
  assert.deepEqual(s.service.load,{running:0,queued:0});
 }finally{await s.close();}
});
test('output flood is capped and stopped',async()=>{
 const s=await boot({timeoutMs:{avr:20_000,esp32:20_000,lint:1000}});
 try{
  const t=Date.now();
  const j=await(await s.post('/compile',{target:'uno',files:ino('SPAM')})).json() as {status:string;diagnostics:{message:string}[]};
  assert.equal(j.status,'failed');assert.match(j.diagnostics[0]!.message,/too much output/);assert.ok(Date.now()-t<15_000);
  clean();
 }finally{await s.close();}
});
test('concurrency 1, queue max 4, then 429',async()=>{
 const s=await boot({timeoutMs:{avr:1000,esp32:1000,lint:1000}});
 try{
  const all=Array.from({length:7},()=>s.post('/compile',{target:'uno',files:ino('SLEEP')}));
  await new Promise(r=>setTimeout(r,300));
  assert.deepEqual(s.service.load,{running:1,queued:4});
  const rs=await Promise.all(all);
  assert.deepEqual(rs.map(r=>r.status).sort(),[200,200,200,200,200,429,429]);
  assert.equal(rs.find(r=>r.status===429)!.headers.get('retry-after'),'10');
  clean();
 }finally{await s.close();}
});
test('lint: python ok, syntax error, micropython rules',{skip:!py},async()=>{
 const s=await boot();
 try{
  const ok=await(await s.post('/lint',{language:'python',files:[{name:'main.py',content:'import time\nprint(1)\n'}]})).json() as {status:string;ok:boolean;imports:string[]};
  assert.equal(ok.status,'linted');assert.equal(ok.ok,true);assert.deepEqual(ok.imports,['time']);
  const bad=await(await s.post('/lint',{language:'python',files:[{name:'main.py',content:'def (:\n'}]})).json() as {status:string;ok:boolean;diagnostics:{line:number;severity:string}[]};
  assert.equal(bad.status,'failed');assert.equal(bad.ok,false);assert.equal(bad.diagnostics[0]!.severity,'error');
  const mp=await(await s.post('/lint',{language:'micropython',files:[{name:'main.py',content:'print(1)\n'}]})).json() as {ok:boolean;diagnostics:{severity:string}[]};
  assert.equal(mp.ok,true);assert.equal(mp.diagnostics[0]!.severity,'warning');
  clean();
 }finally{await s.close();}
});
test('lint never executes the source',{skip:!py},async()=>{
 const s=await boot();
 const marker=join(root,'executed');
 try{
  await s.post('/lint',{language:'python',files:[{name:'main.py',content:`open(${JSON.stringify(marker)},'w').write('x')\n`}]});
  assert.throws(()=>readFileSync(marker),/ENOENT/);
 }finally{await s.close();}
});
test.after(()=>rmSync(root,{recursive:true,force:true}));
