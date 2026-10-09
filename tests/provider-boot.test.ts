import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

test('API boots without Jev, reports unavailable provider, and refuses AI planning',async()=>{
 const probe=createServer();await new Promise<void>(resolve=>probe.listen(0,'127.0.0.1',resolve));
 const address=probe.address();assert.ok(address&&typeof address==='object');const port=address.port;
 await new Promise<void>(resolve=>probe.close(()=>resolve()));
 const dir=await mkdtemp(join(tmpdir(),'iot-provider-boot-'));
 const child=spawn(process.execPath,['--import','tsx','services/api/server.ts'],{env:{...process.env,API_BIND:'127.0.0.1',API_PORT:String(port),WEB_PORT:String(port),IOT_DB_PATH:join(dir,'db.sqlite'),IOT_AGENT_PROVIDER:'jev',JEV_CODEX_BIN:join(dir,'missing-jev'),CODEX_BIN:join(dir,'missing-codex'),OPENAI_API_KEY:'',IOT_COORDINATOR_URL:'',OPENVIKING_URL:'http://127.0.0.1:1'},stdio:['ignore','pipe','pipe']});
 let logs='';child.stderr.on('data',chunk=>logs+=chunk);const base=`http://127.0.0.1:${port}`;
 try{
  let session:any;
  for(let attempt=0;attempt<100;attempt++){if(child.exitCode!==null)throw new Error(logs);try{const response=await fetch(base+'/api/session');if(response.ok){session=await response.json();break;}}catch{/* Starting. */}await new Promise(resolve=>setTimeout(resolve,50));}
  assert.equal(session?.local,true,'Local API remains usable');
  const headers={'X-IOT-Session':session.token,'Content-Type':'application/json'};
  const statusResponse=await fetch(base+'/api/status',{headers});assert.equal(statusResponse.status,200);
  const status:any=await statusResponse.json();assert.equal(status.providers.status,'unavailable');assert.equal(status.providers.available,false);assert.match(status.providers.error,/Jev provider unavailable/);assert.equal(status.providers.default,'JevProvider');
  const catalog=await fetch(base+'/api/hardware',{headers});assert.equal(catalog.status,200);
  const plan=await fetch(base+'/api/projects',{method:'POST',headers,body:JSON.stringify({goal:'Build an ESP32 button and LED device'})});
  assert.equal(plan.status,202);const created:any=await plan.json();assert.ok(created.id);
  let project:any;
  for(let attempt=0;attempt<60;attempt++){project=await (await fetch(base+'/api/projects/'+created.id,{headers})).json();if(project.status==='error')break;await new Promise(resolve=>setTimeout(resolve,50));}
  assert.equal(project.status,'error');assert.match(project.error,/Jev provider unavailable/);assert.equal(project.contracts.length,0,'No fabricated AI contract');
  assert.ok(project.events.some((event:any)=>event.type==='plan.failed'),'Planning failure is visible in evidence');
 }finally{child.kill('SIGTERM');if(child.exitCode===null)await new Promise(resolve=>child.once('close',resolve));await rm(dir,{recursive:true,force:true});}
});
