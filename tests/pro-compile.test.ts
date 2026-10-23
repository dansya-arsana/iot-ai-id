import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {spawnSync} from 'node:child_process';
import {ARTIFACT_MAX,DockerProRunner,ProCompiler,TOOLCHAINS,espScript,parseEspOutput,parseLintOutput,parsePins,parseProDiagnostics,proSandboxArgs,screenPro,type ProRun,type ProRunner,type ProTarget} from '../services/ops/pro-compile.js';
import {PRO_TOOLS} from '../packages/pro-tools/registry.js';

class Fake implements ProRunner{
 runs=0;up=true;next:ProRun={ok:true,artifact:Buffer.from('FW'),diagnostics:[]};gate?:Promise<void>;
 async available(){return this.up;}
 async run(_t:ProTarget,_s:string){this.runs++;if(this.gate)await this.gate;return this.next;}
}
const INO='#define PIN_SOIL 34\nconst int PIN_PUMP = 25;\nvoid setup(){pinMode(PIN_PUMP,OUTPUT);}\nvoid loop(){analogRead(PIN_SOIL);}\n';
const mk=(f=new Fake())=>({f,c:new ProCompiler(new DatabaseSync(':memory:'),f)});

test('sandbox flags are mandatory',()=>{
 const a=proSandboxArgs('img','n',['true']).join(' ');
 for(const s of ['--network none','--read-only','--cap-drop ALL','no-new-privileges','--user 65534:65534','--pids-limit','--memory 1g'])assert.ok(a.includes(s),s);
});
test('esp script targets the right fqbn',()=>{
 assert.match(espScript('esp32s3')[2]!,/esp32:esp32:esp32s3/);
 assert.match(espScript('esp32')[2]!,/-b esp32:esp32:esp32 /);
});
test('screen blocks quoted includes and file access',()=>{
 assert.equal(screenPro('esp32','#include <WiFi.h>\n').length,0);
 assert.ok(screenPro('esp32','#include "/etc/passwd"\n').length);
 assert.ok(screenPro('esp32','#include <../x.h>\n').length);
 assert.ok(screenPro('esp32','asm(".incbin \\"x\\"");').length);
 assert.ok(screenPro('uno','x'.repeat(40_001)).length);
 assert.equal(screenPro('python','import os').length,0);
});
test('parsePins reads symbols and use lines',()=>{
 const p=parsePins('esp32',INO);
 assert.deepEqual(p.map(x=>[x.symbol,x.pin,x.lines]),[['PIN_SOIL','GPIO34',[4]],['PIN_PUMP','GPIO25',[3]]]);
 assert.equal(parsePins('uno','#define LED 13\nvoid f(){digitalWrite(LED,1);}')[0]!.pin,'13');
 assert.deepEqual(parsePins('micropython','PIN_A = 4\np = Pin(PIN_A)\n')[0],{symbol:'PIN_A',pin:'4',lines:[2]});
 assert.equal(parsePins('esp32','#define UNUSED 5\n').length,0);
});
test('diagnostics keep user lines, drop container paths',()=>{
 const d=parseProDiagnostics('/work/s/s.ino:7:3: error: foo was not declared in /work/s/x.h\n/work/s/s.ino:2:1: warning: unused');
 assert.deepEqual(d.map(x=>[x.line,x.severity]),[[7,'error'],[2,'warning']]);
 assert.ok(!d[0]!.message.includes('/work'));
 assert.equal(parseProDiagnostics('collect2: ld returned 1')[0]!.severity,'error');
});
test('parseEspOutput and parseLintOutput',()=>{
 const ok=parseEspOutput(`@@RC 0\n@@BIN\n${Buffer.from('abc').toString('base64')}\n@@LOG\n`);
 assert.ok(ok.ok&&ok.artifact?.toString()==='abc');
 assert.equal(parseEspOutput('@@RC 1\n@@LOG\n/work/s/s.ino:1:1: error: bad').ok,false);
 assert.equal(parseLintOutput('{"ok":false,"diagnostics":[{"line":2,"message":"x","severity":"error"}]}').ok,false);
 assert.equal(parseLintOutput('garbage').ok,false);
});
test('compile caches by sha, stores artifact, coalesces concurrent calls',async()=>{
 const {f,c}=mk();
 let open!:()=>void;f.gate=new Promise<void>(r=>{open=r;});
 const a=c.compile('esp32',{name:'main.ino',content:INO}),b=c.compile('esp32',{name:'main.ino',content:INO});
 open();const [ra,rb]=await Promise.all([a,b]);
 assert.equal(f.runs,1);assert.deepEqual(ra,rb);
 assert.equal(ra.status,'compiled');assert.equal(ra.toolchain,TOOLCHAINS.esp32);
 assert.equal(c.artifact(ra.artifactSha!)!.toString(),'FW');
 assert.equal((await c.compile('esp32',{name:'main.ino',content:INO})).sha256,ra.sha256);
 assert.equal(f.runs,1);
 await c.compile('esp32s3',{name:'main.ino',content:INO});assert.equal(f.runs,2);   // target is part of the key
});
test('failed compile cached; timeout not cached; unavailable is pending',async()=>{
 const {f,c}=mk();
 f.next={ok:false,diagnostics:[{line:3,message:'bad',severity:'error'}]};
 assert.equal((await c.compile('uno',{name:'a.ino',content:'x'})).status,'failed');
 await c.compile('uno',{name:'a.ino',content:'x'});assert.equal(f.runs,1);
 f.next={ok:false,timedOut:true,diagnostics:[{line:0,message:'slow',severity:'error'}]};
 await c.compile('uno',{name:'a.ino',content:'y'});await c.compile('uno',{name:'a.ino',content:'y'});assert.equal(f.runs,3);
 f.up=false;
 const r=await c.compile('uno',{name:'a.ino',content:'z'});assert.equal(r.status,'pending');
});
test('lint target gives linted and no artifact; oversize artifact fails',async()=>{
 const {f,c}=mk();
 f.next={ok:true,diagnostics:[]};
 const r=await c.compile('python',{name:'main.py',content:'print(1)'});
 assert.equal(r.status,'linted');assert.equal(r.artifactSha,undefined);
 f.next={ok:true,artifact:Buffer.alloc(ARTIFACT_MAX+1),diagnostics:[]};
 assert.equal((await c.compile('esp32',{name:'main.ino',content:'big'})).status,'failed');
});
test('registry compile_code targets are all covered',()=>{
 const t=PRO_TOOLS.find(x=>x.name==='compile_code')!;
 for(const target of ['esp32','esp32s3','uno','nano','python','micropython'])assert.ok(target in TOOLCHAINS);
 assert.equal(t.runsAt,'ops');
});

// Real containers: only when the images exist locally.
const have=(img:string)=>spawnSync('docker',['image','inspect',img],{stdio:'ignore'}).status===0;
const real=new DockerProRunner();
test('real python lint',{skip:!have('aiot-pro-py:1')},async()=>{
 const bad=await real.run('python','def f(:\n');
 assert.equal(bad.ok,false);assert.equal(bad.diagnostics[0]!.line,1);
 const good=await real.run('micropython','from machine import Pin\nPIN_A = 4\np = Pin(PIN_A)\n');
 assert.equal(good.ok,true);
 const ev=await real.run('python','eval("1")\n');assert.equal(ev.ok,false);
});
test('real esp32 compile',{skip:!have('aiot-pro-esp32:3.3.12'),timeout:240_000},async()=>{
 const ok=await real.run('esp32','void setup(){pinMode(2,OUTPUT);}\nvoid loop(){digitalWrite(2,!digitalRead(2));delay(500);}\n');
 assert.ok(ok.ok&&ok.artifact&&ok.artifact.length>10_000);
 const bad=await real.run('esp32','void setup(){nope();}\nvoid loop(){}\n');
 assert.equal(bad.ok,false);assert.equal(bad.diagnostics[0]!.line,1);
});
