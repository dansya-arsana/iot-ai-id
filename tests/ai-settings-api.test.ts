import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
test('settings API authorizes writes, returns metadata only, rejects unknown fields and persists deletion',async()=>{
 const probe=createServer();await new Promise<void>(resolve=>probe.listen(0,'127.0.0.1',resolve));const address=probe.address();assert.ok(address&&typeof address==='object');const port=address.port;await new Promise<void>(resolve=>probe.close(()=>resolve()));
 const dir=await mkdtemp(join(tmpdir(),'iot-ai-settings-api-'));const child=spawn(process.execPath,['--import','tsx','services/api/server.ts'],{env:{...process.env,API_BIND:'127.0.0.1',API_PORT:String(port),WEB_PORT:String(port),IOT_DB_PATH:join(dir,'db.sqlite'),IOT_SECRETS_PATH:join(dir,'secrets'),IOT_AGENT_PROVIDER:'fixture',IOT_COORDINATOR_URL:'',OPENVIKING_URL:'http://127.0.0.1:1'},stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);const base=`http://127.0.0.1:${port}`;
 try{let token='';for(let i=0;i<100;i++){try{const response=await fetch(base+'/api/session');if(response.ok){token=(await response.json()).token;break;}}catch{/* Starting. */}await new Promise(resolve=>setTimeout(resolve,50));}assert.ok(token);const headers={'X-IOT-Session':token,'Content-Type':'application/json'},key='dashboard-private-secret';const unauthorized=await fetch(base+'/api/ai-settings');assert.equal(unauthorized.status,403);assert.equal((await unauthorized.json()).error,'Local session authorization required');const stale=await fetch(base+'/api/ai-settings',{headers:{...headers,'X-IOT-Session':'stale-runtime-token'}});assert.equal(stale.status,403);assert.equal((await stale.json()).error,'Local session authorization required');const renewed=await fetch(base+'/api/session');const renewedToken=(await renewed.json()).token;assert.equal((await fetch(base+'/api/ai-settings',{headers:{...headers,'X-IOT-Session':renewedToken}})).status,200);
 const put=await fetch(base+'/api/ai-settings/openai',{method:'PUT',headers,body:JSON.stringify({key})});assert.equal(put.status,200);const saved=await put.text();assert.ok(!saved.includes(key));assert.equal(JSON.parse(saved).scope,'workspace_owner');assert.equal(JSON.parse(saved).providers.openai.configured,true);
 const malformed=await fetch(base+'/api/ai-settings/typesafe',{method:'PUT',headers,body:'{"key":'+key});assert.equal(malformed.status,400);assert.ok(!(await malformed.text()).includes(key));
 const invalid=await fetch(base+'/api/ai-settings/openai',{method:'PUT',headers,body:JSON.stringify({key,unknown:key})});assert.equal(invalid.status,400);assert.ok(!(await invalid.text()).includes(key));
 for(const path of ['/api/ai-settings','/api/status','/api/backoffice']){const response=await fetch(base+path,{headers});assert.equal(response.status,200);assert.ok(!(await response.text()).includes(key));}
 assert.ok(!(await readFile(join(dir,'secrets/credentials.json'),'utf8')).includes(key));const removed=await fetch(base+'/api/ai-settings/openai',{method:'DELETE',headers});assert.equal((await removed.json()).providers.openai.configured,false);const noKey=await fetch(base+'/api/ai-settings/openai/test',{method:'POST',headers,body:'{}'});assert.equal(noKey.status,400);assert.ok(!logs.includes(key));
 }finally{child.kill('SIGTERM');if(child.exitCode===null)await new Promise(resolve=>child.once('close',resolve));await rm(dir,{recursive:true,force:true});}
});

test('cloud API refuses custom provider, CLI-only settings and custom base URL, and exposes only cloud providers',async()=>{
 const probe=createServer();await new Promise<void>(resolve=>probe.listen(0,'127.0.0.1',resolve));const address=probe.address();assert.ok(address&&typeof address==='object');const port=address.port;await new Promise<void>(resolve=>probe.close(()=>resolve()));
 const dir=await mkdtemp(join(tmpdir(),'iot-ai-settings-cloud-'));const child=spawn(process.execPath,['--import','tsx','services/api/server.ts'],{env:{...process.env,IOT_DEPLOYMENT:'cloud',API_BIND:'127.0.0.1',API_PORT:String(port),WEB_PORT:String(port),IOT_DB_PATH:join(dir,'db.sqlite'),IOT_SECRETS_PATH:join(dir,'secrets'),IOT_AGENT_PROVIDER:'fixture',IOT_COORDINATOR_URL:'',OPENVIKING_URL:'http://127.0.0.1:1'},stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);const base=`http://127.0.0.1:${port}`;
 try{let token='';for(let i=0;i<100;i++){try{const response=await fetch(base+'/api/session');if(response.ok){token=(await response.json()).token;break;}}catch{/* Starting. */}await new Promise(resolve=>setTimeout(resolve,50));}assert.ok(token,logs);
  const headers={'X-IOT-Session':token,'Content-Type':'application/json','X-Remote-User':'owner-user'},secret='cloud-private-secret';
  const settings=await (await fetch(base+'/api/ai-settings',{headers})).json();assert.equal(settings.deployment,'cloud');assert.deepEqual(settings.registry.map((p:any)=>p.id),['openai','anthropic','minimax','zai']);
  const refused='Provider not available in cloud; use the desktop app for your own keys.';
  const custom=await fetch(base+'/api/ai-settings/custom',{method:'PUT',headers,body:JSON.stringify({key:secret})});assert.equal(custom.status,400);assert.equal((await custom.json()).error,refused);
  const url=await fetch(base+'/api/ai-settings/preferences',{method:'PUT',headers,body:JSON.stringify({models:{},customBaseUrl:'https://api.example.com/v1'})});assert.equal(url.status,400);
  const cli=await fetch(base+'/api/ai-settings/preferences',{method:'PUT',headers,body:JSON.stringify({active:'claude-cli',models:{}})});assert.equal(cli.status,400);assert.equal((await cli.json()).error,refused);
  const extra=await fetch(base+'/api/ai-settings/preferences',{method:'PUT',headers,body:JSON.stringify({models:{},surprise:true})});assert.equal(extra.status,400);
  const ok=await fetch(base+'/api/ai-settings/preferences',{method:'PUT',headers,body:JSON.stringify({active:'anthropic',models:{anthropic:'claude-sonnet-5-5'}})});assert.equal(ok.status,200);assert.equal((await ok.json()).preferences.active,'anthropic');
  assert.equal((await fetch(base+'/api/ai-settings/anthropic',{method:'PUT',headers,body:JSON.stringify({key:secret})})).status,200);
  const audit=await readFile(join(dir,'secrets/ai-audit.jsonl'),'utf8');assert.ok(audit.includes('owner-user')&&audit.includes('"save"')&&!audit.includes(secret));assert.ok(!logs.includes(secret));
 }finally{child.kill('SIGTERM');if(child.exitCode===null)await new Promise(resolve=>child.once('close',resolve));await rm(dir,{recursive:true,force:true});}
});
