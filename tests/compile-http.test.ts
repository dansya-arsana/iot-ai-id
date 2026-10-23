import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type IncomingMessage,type Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {HttpCompileRunner,HttpLabRunner,HttpProRunner,labRunnerFromEnv,proRunnerFromEnv} from '../services/ops/compile-http.js';
import {DockerRunner,LabCompiler,LAB_TOOLCHAIN} from '../services/ops/lab-compile.js';
import {DockerProRunner,ProCompiler} from '../services/ops/pro-compile.js';

const TOKEN='k'.repeat(40);
const HEX=':020000040000FA\n:0400000000000000FC\n:00000001FF\n';
interface Seen{path:string;auth:string|undefined;body:any}
async function fake(handler:(path:string,body:any,req:IncomingMessage)=>{status?:number;json?:unknown;delay?:number}){
 const seen:Seen[]=[];
 const server:Server=createServer((req,res)=>{
  let raw='';req.on('data',c=>raw+=c);
  req.on('end',async()=>{
   const body=raw?JSON.parse(raw):undefined;
   if(req.url==='/health'){res.writeHead(200);res.end('{"ok":true}');return;}
   seen.push({path:req.url!,auth:req.headers.authorization,body});
   const r=handler(req.url!,body,req);
   if(r.delay)await new Promise(x=>setTimeout(x,r.delay));
   res.writeHead(r.status??200,{'content-type':'application/json'});res.end(JSON.stringify(r.json??{}));
  });
 });
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 return{url,seen,close:()=>new Promise<void>(r=>{server.closeAllConnections();server.close(()=>r());})};
}
const compiled=(extra:object={})=>({status:'compiled',diagnostics:[],artifact:Buffer.from(HEX).toString('base64'),sha256:'x',toolchain:LAB_TOOLCHAIN,dump:'',log:'',...extra});
const SKETCH='void setup(){}\nvoid loop(){}\n';

test('lab runner: posts a bearer-authenticated uno compile and maps the result',async()=>{
 const f=await fake(()=>({json:compiled({dump:'DUMP'})}));
 try{
  const r=new HttpLabRunner(new HttpCompileRunner(f.url+'/',TOKEN));
  assert.equal(await r.available(),true);
  const out=await r.run(SKETCH);
  assert.deepEqual(out,{ok:true,hex:HEX,dump:'DUMP'});
  assert.equal(f.seen[0]!.path,'/compile');assert.equal(f.seen[0]!.auth,`Bearer ${TOKEN}`);
  assert.deepEqual(f.seen[0]!.body,{target:'uno',files:[{name:'s.ino',content:SKETCH}]});
 }finally{await f.close();}
});
test('lab runner: failure keeps the compiler log, timeout and 429 are distinct',async()=>{
 let mode='fail';
 const f=await fake(()=>mode==='fail'?{json:{status:'failed',log:'s.ino:3: error: boom',diagnostics:[{line:3,message:'boom',severity:'error'}]}}
  :mode==='timeout'?{json:{status:'failed',timedOut:true,diagnostics:[]}}:mode==='busy'?{status:429,json:{error:'busy'}}:{status:401,json:{error:'x'}});
 try{
  const r=new HttpLabRunner(new HttpCompileRunner(f.url,TOKEN));
  assert.deepEqual(await r.run(SKETCH),{ok:false,log:'s.ino:3: error: boom'});
  mode='timeout';assert.equal((await r.run(SKETCH) as {timedOut?:boolean}).timedOut,true);
  mode='busy';const b=await r.run(SKETCH);assert.ok(!b.ok&&b.unavailable&&/busy/.test(b.log));
  mode='auth';const a=await r.run(SKETCH);assert.ok(!a.ok&&a.unavailable);
 }finally{await f.close();}
});
test('unreachable sidecar is unavailable, not a compile failure',async()=>{
 const h=new HttpCompileRunner('http://127.0.0.1:1',TOKEN);
 assert.equal(await h.available(),false);
 const r=await new HttpLabRunner(h).run(SKETCH);assert.ok(!r.ok&&r.unavailable);
 const p=await new HttpProRunner(h).run('esp32',SKETCH);assert.ok(!p.ok&&p.unavailable);
});
test('client timeout is enforced',async()=>{
 const f=await fake(()=>({json:compiled(),delay:600}));
 try{
  const r=new HttpLabRunner(new HttpCompileRunner(f.url,TOKEN,fetch,{avr:150,esp32:150,lint:150}));
  const out=await r.run(SKETCH);assert.ok(!out.ok&&out.unavailable);
 }finally{await f.close();}
});
test('pro runner: esp32 artifact decoded, warnings kept, errors mapped',async()=>{
 let ok=true;
 const f=await fake(()=>ok?{json:compiled({artifact:Buffer.from('BIN').toString('base64'),diagnostics:[{line:2,message:'unused',severity:'warning'}]})}
  :{json:{status:'failed',diagnostics:[{line:7,message:'nope',severity:'error'}],log:''}});
 try{
  const r=new HttpProRunner(new HttpCompileRunner(f.url,TOKEN));
  const a=await r.run('esp32s3',SKETCH);
  assert.ok(a.ok&&a.artifact?.toString()==='BIN'&&a.diagnostics[0]!.severity==='warning');
  assert.equal(f.seen[0]!.body.target,'esp32s3');
  ok=false;
  const b=await r.run('esp32',SKETCH);assert.ok(!b.ok&&b.diagnostics[0]!.line===7);
 }finally{await f.close();}
});
test('pro runner: python goes to /lint',async()=>{
 const f=await fake(()=>({json:{status:'linted',ok:true,diagnostics:[{line:1,message:'warn',severity:'warning'}],imports:[]}}));
 try{
  const r=new HttpProRunner(new HttpCompileRunner(f.url,TOKEN));
  const a=await r.run('micropython','print(1)\n');
  assert.ok(a.ok&&!a.ok===false&&a.diagnostics.length===1);
  assert.equal(f.seen[0]!.path,'/lint');assert.deepEqual(f.seen[0]!.body,{language:'micropython',files:[{name:'main.py',content:'print(1)\n'}]});
 }finally{await f.close();}
});
test('factories: sidecar when both env vars are set, else docker',()=>{
 assert.ok(labRunnerFromEnv({})instanceof DockerRunner);
 assert.ok(labRunnerFromEnv({OPS_COMPILER_URL:'http://compiler:8795'})instanceof DockerRunner);
 assert.ok(labRunnerFromEnv({COMPILER_TOKEN:TOKEN})instanceof DockerRunner);
 assert.ok(labRunnerFromEnv({OPS_COMPILER_URL:'http://compiler:8795',COMPILER_TOKEN:TOKEN})instanceof HttpLabRunner);
 assert.ok(proRunnerFromEnv({})instanceof DockerProRunner);
 assert.ok(proRunnerFromEnv({OPS_COMPILER_URL:'http://compiler:8795',COMPILER_TOKEN:TOKEN})instanceof HttpProRunner);
});
test('LabCompiler over the sidecar: verifies, line map, caches; busy is unavailable',async()=>{
 let calls=0,busy=false;
 const f=await fake(()=>{calls++;return busy?{status:429,json:{}}:{json:compiled({dump:''})};});
 try{
  const c=new LabCompiler(new DatabaseSync(':memory:'),new HttpLabRunner(new HttpCompileRunner(f.url,TOKEN)));
  assert.equal(await c.available(),true);
  const a=await c.compile(SKETCH);assert.ok(a.ok&&!a.cached&&a.build.bytes===4);
  const b=await c.compile(SKETCH);assert.ok(b.ok&&b.cached);assert.equal(calls,1);
  busy=true;
  const d=await c.compile(SKETCH+'//x\n');assert.ok(!d.ok&&d.kind==='unavailable');
 }finally{await f.close();}
});
test('ProCompiler over the sidecar: compiled item, artifact stored by sha, python linted, pending when down',async()=>{
 const f=await fake((path)=>path==='/lint'?{json:{status:'linted',ok:true,diagnostics:[],imports:[]}}:{json:compiled({artifact:Buffer.from('FW').toString('base64')})});
 try{
  const c=new ProCompiler(new DatabaseSync(':memory:'),new HttpProRunner(new HttpCompileRunner(f.url,TOKEN)));
  const r=await c.compile('esp32',{name:'main.ino',content:SKETCH});
  assert.equal(r.status,'compiled');assert.equal(c.artifact(r.artifactSha!)!.toString(),'FW');
  assert.equal((await c.compile('python',{name:'main.py',content:'print(1)\n'})).status,'linted');
 }finally{await f.close();}
 const down=new ProCompiler(new DatabaseSync(':memory:'),new HttpProRunner(new HttpCompileRunner('http://127.0.0.1:1',TOKEN)));
 assert.equal((await down.compile('uno',{name:'a.ino',content:SKETCH})).status,'pending');
});
