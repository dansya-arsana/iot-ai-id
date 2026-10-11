import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {z} from 'zod';
import {allowedProviders,validateBaseUrl,AiPreferencesSchema} from '../packages/ai-providers/index.js';
import {CredentialVault,testCredential} from '../services/api/credentials.js';
import {JevProvider,pickProvider} from '../services/orchestrator/provider.js';
const schema=z.object({ok:z.boolean()});
const noCli={'codex-cli':false,'claude-cli':false},bothCli={'codex-cli':true,'claude-cli':true};
async function withFetch<T>(handler:(url:string,init:RequestInit)=>Response,run:()=>Promise<T>){const previous=globalThis.fetch;globalThis.fetch=(async(url:any,init:any)=>handler(String(url),init)) as typeof fetch;try{return await run();}finally{globalThis.fetch=previous;}}

test('validateBaseUrl enforces https, loopback http, and no credentials, query or fragment',()=>{
 assert.equal(validateBaseUrl('https://api.example.com/v1/'),'https://api.example.com/v1');
 for(const ok of ['http://localhost:11434/v1','http://127.0.0.1:8000','http://[::1]:8000/v1'])assert.doesNotThrow(()=>validateBaseUrl(ok));
 for(const bad of ['http://example.com/v1','ftp://example.com','https://user:pw@example.com','https://example.com/v1?x=1','https://example.com/v1#frag','https://example.com?','not a url'])assert.throws(()=>validateBaseUrl(bad),bad);
 assert.equal(AiPreferencesSchema.safeParse({models:{},customBaseUrl:'http://example.com'}).success,false);
 assert.equal(AiPreferencesSchema.safeParse({models:{openai:'bad model!'}}).success,false);
 assert.equal(AiPreferencesSchema.safeParse({models:{},extra:1}).success,false);
 assert.deepEqual(allowedProviders('cloud').map(p=>p.id),['openai','anthropic','minimax','zai']);
 assert.equal(allowedProviders('local').length,7);
});
test('provider selection order and cloud refusal of custom and CLI',()=>{
 const prefs={models:{custom:'m'},customBaseUrl:'https://api.example.com/v1'};
 assert.equal(pickProvider({zai:'k',anthropic:'k'},{models:{}},'local',noCli,{}),'anthropic');
 assert.equal(pickProvider({zai:'k',anthropic:'k'},{models:{},active:'zai'},'local',noCli,{}),'zai');
 assert.equal(pickProvider({anthropic:'k'},{models:{},active:'openai'},'local',noCli,{}),'anthropic','unusable active falls through');
 assert.equal(pickProvider({},{models:{}},'local',bothCli,{}),'codex-cli');
 assert.equal(pickProvider({},{models:{}},'local',{...noCli,'claude-cli':true},{}),'claude-cli');
 assert.equal(pickProvider({custom:'k'},prefs,'local',noCli,{}),'custom');
 assert.equal(pickProvider({custom:'k'},{models:{}},'local',noCli,{}),undefined,'custom needs URL and model');
 assert.equal(pickProvider({custom:'k'},{...prefs,active:'custom'},'cloud',bothCli,{}),undefined);
 assert.equal(pickProvider({},{models:{},active:'claude-cli'},'cloud',bothCli,{}),undefined);
 assert.equal(pickProvider({},{models:{}},'local',noCli,{OPENAI_API_KEY:'env'}),'openai');
});
test('cloud provider refuses to run with only custom or CLI available',async()=>{
 await assert.rejects(new JevProvider(()=>({custom:'k'}),()=>({models:{custom:'m'},customBaseUrl:'https://api.example.com/v1',active:'custom'}),'cloud').frontier('x',schema),/No AI provider configured/);
});
test('anthropic adapter reads tool_use input and sends the documented request shape',async()=>{
 let seen:any,headers:Headers|undefined,url='';
 const result=await withFetch((u,init)=>{url=u;headers=new Headers(init.headers);seen=JSON.parse(String(init.body));return Response.json({content:[{type:'text',text:'thinking'},{type:'tool_use',name:'hardware_result',input:{ok:true}}]});},()=>new JevProvider(()=>({anthropic:'ant-secret'}),()=>({models:{}}),'cloud').frontier('prompt',schema));
 assert.deepEqual(result,{ok:true});assert.equal(url,'https://api.anthropic.com/v1/messages');assert.equal(headers!.get('x-api-key'),'ant-secret');assert.equal(headers!.get('anthropic-version'),'2023-06-01');
 assert.equal(seen.model,'claude-opus-5-5');assert.equal(seen.max_tokens,8192);assert.deepEqual(seen.tool_choice,{type:'tool',name:'hardware_result'});assert.equal(seen.tools[0].name,'hardware_result');assert.equal('$schema' in seen.tools[0].input_schema,false);assert.equal(seen.tools[0].input_schema.type,'object');
});
test('anthropic adapter falls back to fenced JSON text, honors model and base URL, and does not retry 4xx',async()=>{
 let url='',model='';
 const result=await withFetch((u,init)=>{url=u;model=JSON.parse(String(init.body)).model;return Response.json({content:[{type:'text',text:'```json\n{"ok":true}\n```'}]});},()=>new JevProvider(()=>({zai:'zk'}),()=>({models:{zai:'glm-5.3-flash'}}),'cloud').frontier('p',schema));
 assert.deepEqual(result,{ok:true});assert.equal(url,'https://api.z.ai/api/anthropic/v1/messages');assert.equal(model,'glm-5.3-flash');
 let calls=0;await withFetch(()=>{calls++;return new Response('x',{status:401});},async()=>{await assert.rejects(new JevProvider(()=>({anthropic:'k'}),()=>({models:{}}),'cloud').frontier('p',schema),/HTTP 401/);});assert.equal(calls,1);
});
test('openai-chat adapter uses base URL, bearer auth and strict json_schema',async()=>{
 let url='',auth='',body:any;
 const result=await withFetch((u,init)=>{url=u;auth=new Headers(init.headers).get('Authorization')!;body=JSON.parse(String(init.body));return Response.json({choices:[{message:{content:'{"ok":true}'}}]});},()=>new JevProvider(()=>({custom:'ck'}),()=>({models:{custom:'local-model'},customBaseUrl:'http://127.0.0.1:11434/v1'}),'local').frontier('p',schema));
 assert.deepEqual(result,{ok:true});assert.equal(url,'http://127.0.0.1:11434/v1/chat/completions');assert.equal(auth,'Bearer ck');assert.equal(body.model,'local-model');assert.equal(body.response_format.type,'json_schema');assert.equal(body.response_format.json_schema.strict,true);
});
test('claude-cli adapter parses the CLI result JSON',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'iot-claude-cli-')),bin=join(dir,'claude'),previous=process.env.CLAUDE_BIN;
 writeFileSync(bin,`#!${process.execPath}\nlet input='';process.stdin.on('data',c=>input+=c).on('end',()=>{const args=process.argv.slice(2).join(' ');const good=input.includes('JSON schema')&&args.includes('--max-turns 1')&&args.includes('-p')&&args.includes('--output-format json');process.stdout.write(JSON.stringify({result:'\`\`\`json\\n{"ok":'+good+'}\\n\`\`\`'}));});\n`,{mode:0o700});process.env.CLAUDE_BIN=bin;
 try{assert.deepEqual(await new JevProvider(()=>({}),()=>({models:{},active:'claude-cli'}),'local').frontier('p',schema),{ok:true});}finally{if(previous===undefined)delete process.env.CLAUDE_BIN;else process.env.CLAUDE_BIN=previous;rmSync(dir,{recursive:true,force:true});}
});
test('route is skipped, not failed, when the Jev binary is missing',async()=>{
 const previous=process.env.JEV_CODEX_BIN;process.env.JEV_CODEX_BIN='/missing-iot-test/jev-codex';
 try{const route:any=await new JevProvider().route('t',{});assert.equal(route.skipped,true);assert.match(route.reason,/optional/);}finally{if(previous===undefined)delete process.env.JEV_CODEX_BIN;else process.env.JEV_CODEX_BIN=previous;}
});
test('credential tests use fixed per-provider endpoints and no secret leaks into messages',async()=>{
 const seen:Record<string,{url:string;method?:string;h:Headers;body?:any}>={};
 for(const provider of ['anthropic','minimax','zai','custom'] as const){await testCredential(provider,'secret-value',async(url,init)=>{seen[provider]={url:String(url),method:init?.method,h:new Headers(init?.headers),body:init?.body?JSON.parse(String(init.body)):undefined};assert.equal(init?.redirect,'error');return new Response('secret-value',{status:200});},'https://llm.example.com/v1');}
 assert.equal(seen.anthropic.url,'https://api.anthropic.com/v1/models');assert.equal(seen.anthropic.h.get('x-api-key'),'secret-value');assert.equal(seen.anthropic.h.get('anthropic-version'),'2023-06-01');
 assert.equal(seen.minimax.url,'https://api.minimax.io/anthropic/v1/messages');assert.equal(seen.minimax.method,'POST');assert.equal(seen.minimax.body.max_tokens,1);assert.equal(seen.minimax.body.model,'MiniMax-M3');assert.equal(seen.minimax.body.messages[0].content,'ping');
 assert.equal(seen.zai.url,'https://api.z.ai/api/anthropic/v1/messages');assert.equal(seen.zai.body.model,'glm-5.3');
 assert.equal(seen.custom.url,'https://llm.example.com/v1/models');assert.equal(seen.custom.h.get('Authorization'),'Bearer secret-value');
 const missing=await testCredential('custom','secret-value',async()=>new Response('',{status:200}));assert.equal(missing.connected,false);
});
test('vault key file: used instead of master.key, never auto-created, migrates identical copy, rejects mismatch',()=>{
 const dir=mkdtempSync(join(tmpdir(),'iot-vaultkey-')),vaultDir=join(dir,'vault'),keyFile=join(dir,'vault.key');
 try{
  assert.throws(()=>new CredentialVault(vaultDir,keyFile),/key file missing/);assert.equal(existsSync(keyFile),false);assert.equal(existsSync(join(vaultDir,'master.key')),false);
  writeFileSync(keyFile,Buffer.alloc(16));assert.throws(()=>new CredentialVault(vaultDir,keyFile),/invalid/);
  const old=new CredentialVault(vaultDir,undefined);old.save('anthropic','legacy-secret-value');assert.ok(existsSync(join(vaultDir,'master.key')));
  writeFileSync(keyFile,Buffer.alloc(32,7));assert.throws(()=>new CredentialVault(vaultDir,keyFile),/Vault key mismatch/);assert.ok(existsSync(join(vaultDir,'master.key')));
  writeFileSync(keyFile,readFileSync(join(vaultDir,'master.key')));const migrated=new CredentialVault(vaultDir,keyFile);assert.equal(existsSync(join(vaultDir,'master.key')),false);assert.equal(migrated.snapshot().anthropic,'legacy-secret-value');
  assert.equal(new CredentialVault(vaultDir,keyFile).snapshot().anthropic,'legacy-secret-value');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('audit log and preferences never contain key material',()=>{
 const dir=mkdtempSync(join(tmpdir(),'iot-audit-'));
 try{const vault=new CredentialVault(dir,undefined),secret='audit-private-secret-value';
  vault.save('minimax',secret,'ops-user');vault.recordTest('minimax',vault.metadata().providers.minimax.fingerprint!,true,'ops-user');vault.setPreferences({active:'minimax',models:{minimax:'MiniMax-M3'}},'ops-user');vault.remove('minimax');
  const raw=readFileSync(join(dir,'ai-audit.jsonl'),'utf8'),lines=raw.trim().split('\n').map(line=>JSON.parse(line));
  assert.deepEqual(lines.map(l=>l.action),['save','test','preferences','delete']);assert.equal(lines[0].user,'ops-user');assert.equal(lines[3].user,'local');assert.match(lines[0].fingerprint,/^[0-9a-f]{12}$/);
  assert.ok(!raw.includes(secret));assert.ok(!readFileSync(join(dir,'ai-preferences.json'),'utf8').includes(secret));
  assert.deepEqual(new CredentialVault(dir,undefined).preferences(),{active:'minimax',models:{minimax:'MiniMax-M3'}});
 }finally{rmSync(dir,{recursive:true,force:true});}
});
