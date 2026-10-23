import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {createFlashConsentVerifier,createProHardware,parseEsp32Boards,type Esp32Bridge} from '../services/api/pro-hardware.js';
const secret='s3cret';const fw=Buffer.from('firmware-bytes');const sha=createHash('sha256').update(fw).digest('hex');
let nonce=0;
const mint=(port:string,fsha:string,exp=Date.now()+60000)=>{const serial=fsha==='serial';const v=serial?'v3':'v2';const p=Buffer.from(JSON.stringify({port,...(serial?{purpose:'serial'}:{fileSha:fsha}),exp,nonce:'t'+String(++nonce)})).toString('base64url');return`${v}.${p}.${createHmac('sha256',secret).update(`${v}.${p}`).digest('base64url')}`;};
function setup(){
 const calls:string[]=[];let emit:(t:string)=>void=()=>{};
 const bridge:Esp32Bridge={async detect(){return{toolchain:true,boards:[{port:'COM3',label:'CP210x UART',vid:'10c4',pid:'ea60',chip:'esp32'}]};},async flash(p){calls.push('flash:'+p);},openSerial(_p,onLine){emit=onLine;calls.push('serial');return{close(){calls.push('close');}};}};
 const hw=createProHardware({bridge,artifact:s=>s===sha?fw:undefined,consentSecret:secret});
 return{hw,calls,line:(t:string)=>emit(t)};
}
const post=(hw:ReturnType<typeof setup>['hw'],path:string,body:unknown)=>hw.handle('POST',path,new URLSearchParams(),async()=>body);
test('parseEsp32Boards matches VID/PID',()=>{
 const j=JSON.stringify([{port:{address:'/dev/a',protocol:'serial',properties:{vid:'0x303A',pid:'0x1001'}}},{port:{address:'/dev/b',protocol:'serial',properties:{vid:'0x2341',pid:'0x0043'}}},{port:{address:'/dev/c',protocol:'serial',properties:{vid:'0x1a86',pid:'0x7523'}}}]);
 const b=parseEsp32Boards(j);assert.deepEqual(b.map(x=>[x.port,x.chip]),[['/dev/a','esp32s3'],['/dev/c','esp32']]);
});
test('flash without token is 403 consent_required and never flashes',async()=>{
 const {hw,calls}=setup();const r=await post(hw,'/api/pro/hardware/flash',{port:'COM3',artifactSha:sha});
 assert.equal(r.status,403);assert.equal((r.data as any).code,'consent_required');assert.deepEqual(calls,[]);
});
test('token for another sha or port is refused',async()=>{
 const {hw,calls}=setup();
 assert.equal((await post(hw,'/api/pro/hardware/flash',{port:'COM3',artifactSha:sha,consent:mint('COM3','a'.repeat(64))})).status,403);
 assert.equal((await post(hw,'/api/pro/hardware/flash',{port:'COM3',artifactSha:sha,consent:mint('COM9',sha)})).status,403);
 assert.deepEqual(calls,[]);
});
test('valid token flashes once, replay refused, unknown sha 404',async()=>{
 const {hw,calls}=setup();const t=mint('COM3',sha);
 const ok=await post(hw,'/api/pro/hardware/flash',{port:'COM3',artifactSha:sha,consent:t});
 assert.equal(ok.status,200);assert.deepEqual(calls,['flash:COM3']);
 assert.equal((await post(hw,'/api/pro/hardware/flash',{port:'COM3',artifactSha:sha,consent:t})).status,403);
 const other='b'.repeat(64);
 assert.equal((await post(hw,'/api/pro/hardware/flash',{port:'COM3',artifactSha:other,consent:mint('COM3',other)})).status,404);
});
test('no secret means no bypass',async()=>{
 const hw=createProHardware({bridge:setup().hw as any,artifact:()=>fw,consentSecret:''});
 assert.equal((await post(hw,'/api/pro/hardware/flash',{port:'COM3',artifactSha:sha,consent:'x'})).status,403);
});
test('serial needs consent, then streams lines',async()=>{
 const {hw,calls,line}=setup();
 assert.equal((await post(hw,'/api/pro/hardware/serial/start',{port:'COM3'})).status,403);
 assert.equal((await post(hw,'/api/pro/hardware/serial/start',{port:'COM3',consent:mint('COM3','serial')})).status,200);
 line('AIOT_BOOT_BANNER');
 const r=await hw.handle('GET','/api/pro/hardware/serial',new URLSearchParams('since=0'),async()=>({}));
 assert.equal((r.data as any).lines[0].text,'AIOT_BOOT_BANNER');
 await post(hw,'/api/pro/hardware/serial/stop',{});assert.ok(calls.includes('close'));
});

test('desktop v2 token ({port,fileSha}) authorizes only that file; v3 serial token only a serial session; v1 never',()=>{
 const secret='s3cret',now=()=>1000;
 const mint=(v:string,body:object)=>{const pl=Buffer.from(JSON.stringify({...body,exp:5000,nonce:Math.random().toString(36)})).toString('base64url');return `${v}.${pl}.${createHmac('sha256',secret).update(`${v}.${pl}`).digest('base64url')}`;};
 const c=createFlashConsentVerifier(secret,now),sha='a'.repeat(64);
 assert.equal(c.verify(mint('v2',{port:'P',fileSha:sha}),'P',sha),'ok');
 assert.equal(c.verify(mint('v2',{port:'P',fileSha:sha}),'P','b'.repeat(64)),'wrong_file');
 assert.equal(c.verify(mint('v1',{port:'P'}),'P',sha),'invalid');
 assert.equal(c.verify(mint('v1',{port:'P'}),'P','serial'),'invalid');
 assert.equal(c.verify(mint('v3',{port:'P',purpose:'serial'}),'P','serial'),'ok');
 assert.equal(c.verify(mint('v3',{port:'P',purpose:'serial'}),'P',sha),'invalid');
});
