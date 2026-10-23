import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {buildUpstreamBody,handleProConfig,handleProMessages,resolveAnthropicKey,resolveProConfig,ProMessagesRequestSchema,PRO_MAX_TOKENS_CAP,type ProModelDeps} from '../services/api/pro-model.js';
import {AiPreferencesSchema} from '../packages/ai-providers/index.js';

const TOKEN='t'.repeat(40);
const body={system:'sys',messages:[{role:'user',content:'hi'}],tools:[{name:'catalog_search',description:'d',input_schema:{type:'object'}}]};
async function serve(deps:ProModelDeps){
 const s:Server=createServer((q,r)=>{(q.url==='/internal/pro/config'?Promise.resolve(handleProConfig(q,r,deps)):handleProMessages(q,r,deps)).catch(()=>r.end());});
 await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));
 return{url:`http://127.0.0.1:${(s.address() as AddressInfo).port}`,close:()=>new Promise<void>(r=>{s.closeAllConnections();s.close(()=>r());})};
}
const post=(url:string,b:unknown,h:Record<string,string>={'x-aiot-internal':TOKEN})=>fetch(url+'/internal/pro/messages',{method:'POST',headers:{'content-type':'application/json',...h},body:typeof b==='string'?b:JSON.stringify(b)});
const sseBody=(events:object[])=>events.map(e=>`event: ${(e as {type:string}).type}\ndata: ${JSON.stringify(e)}\n\n`).join('');

test('vault key beats env fallback; env used only when vault is empty',()=>{
 assert.deepEqual(resolveAnthropicKey('vault-key',{ANTHROPIC_API_KEY:'env-key'}),{key:'vault-key',source:'vault'});
 assert.deepEqual(resolveAnthropicKey(undefined,{ANTHROPIC_API_KEY:'env-key'}),{key:'env-key',source:'env'});
 assert.equal(resolveAnthropicKey(undefined,{}),undefined);
});
test('builder preferences: allowlist, defaults, no token budget field',()=>{
 assert.equal(AiPreferencesSchema.safeParse({models:{},builder:{model:'claude-opus-5-5',effort:'max'}}).success,true);
 assert.equal(AiPreferencesSchema.safeParse({models:{},builder:{model:'claude-haiku-5-5'}}).success,false);
 assert.equal(AiPreferencesSchema.safeParse({models:{},builder:{thinkingBudget:4000}}).success,false);
 const c=resolveProConfig(undefined);
 assert.equal(c.model,'claude-sonnet-5-5');assert.equal(c.killSwitch.enabled,true);assert.equal(c.killSwitch.monthlyUsd,1000);
 assert.equal(resolveProConfig(AiPreferencesSchema.parse({models:{},builder:{model:'claude-opus-5-5',killSwitch:{enabled:false,monthlyUsd:5}}})).killSwitch.enabled,false);
});
test('upstream body: forced model, adaptive thinking, effort, stream, capped tokens, no tool_choice',()=>{
 const req=ProMessagesRequestSchema.parse({...body,max_tokens:32000});
 const b=buildUpstreamBody(req,{model:'claude-opus-5-5',effort:'high',display:'summarized'}) as Record<string,unknown>;
 assert.equal(b.model,'claude-opus-5-5');assert.equal(b.stream,true);
 assert.deepEqual(b.thinking,{type:'adaptive',display:'summarized'});assert.deepEqual(b.output_config,{effort:'high'});
 assert.ok(!('budget_tokens' in (b.thinking as object)));assert.ok(!('tool_choice' in b));assert.ok(b.max_tokens as number<=PRO_MAX_TOKENS_CAP);
 assert.equal(ProMessagesRequestSchema.safeParse({...body,model:'claude-opus-5-5'}).success,false);
 assert.equal(ProMessagesRequestSchema.safeParse({...body,tool_choice:{type:'any'}}).success,false);
 assert.equal(ProMessagesRequestSchema.safeParse({...body,max_tokens:999999}).success,false);
});
test('guard: token, forwarded headers, method, size, shape',async()=>{
 const calls:string[]=[];
 const s=await serve({vaultKey:()=>'k',preferences:()=>({models:{}}),token:TOKEN,request:(async()=>{calls.push('x');return new Response('');}) as typeof fetch});
 try{
  assert.equal((await post(s.url,body,{})).status,401);
  assert.equal((await post(s.url,body,{'x-aiot-internal':'x'.repeat(40)})).status,401);
  assert.equal((await post(s.url,body,{'x-aiot-internal':TOKEN,'x-forwarded-for':'1.2.3.4'})).status,403);
  assert.equal((await fetch(s.url+'/internal/pro/messages',{headers:{'x-aiot-internal':TOKEN}})).status,405);
  assert.equal((await post(s.url,'{bad')).status,400);
  assert.equal((await post(s.url,{messages:[]})).status,400);
  assert.equal((await post(s.url,'x'.repeat(2*1024*1024+10))).status,413);
  assert.equal(calls.length,0);
 }finally{await s.close();}
 const off=await serve({vaultKey:()=>'k',preferences:()=>({models:{}}),token:'short'});
 try{assert.equal((await post(off.url,body)).status,503);}finally{await off.close();}
});
test('streams Anthropic SSE through untouched; sends vault key and forced params; key never echoed',async()=>{
 const events=[{type:'message_start',message:{usage:{input_tokens:5}}},{type:'content_block_delta',delta:{type:'text_delta',text:'ok'}},{type:'message_stop'}];
 let seen:{url:string;headers:Record<string,string>;body:Record<string,unknown>}|undefined;
 const s=await serve({vaultKey:()=>'sk-vault-secret',preferences:()=>AiPreferencesSchema.parse({models:{},builder:{model:'claude-opus-5-5',effort:'medium'}}),token:TOKEN,env:{ANTHROPIC_API_KEY:'sk-env-secret'},
  request:(async(url:string,init:RequestInit)=>{seen={url,headers:init.headers as Record<string,string>,body:JSON.parse(init.body as string)};return new Response(sseBody(events),{status:200,headers:{'content-type':'text/event-stream'}});}) as unknown as typeof fetch});
 try{
  const r=await post(s.url,body);const text=await r.text();
  assert.equal(r.status,200);assert.match(r.headers.get('content-type')??'',/text\/event-stream/);assert.equal(text,sseBody(events));
  assert.equal(seen?.url,'https://api.anthropic.com/v1/messages');
  assert.equal(seen?.headers['x-api-key'],'sk-vault-secret');assert.equal(seen?.headers['anthropic-version'],'2023-06-01');
  assert.equal(seen?.body.model,'claude-opus-5-5');assert.deepEqual(seen?.body.output_config,{effort:'medium'});
  assert.ok(!text.includes('secret'));
  const cfg=await(await fetch(s.url+'/internal/pro/config',{headers:{'x-aiot-internal':TOKEN}})).text();
  assert.ok(!cfg.includes('secret'));assert.equal(JSON.parse(cfg).keySource,'vault');assert.ok(JSON.parse(cfg).pricing['claude-sonnet-5-5'].verifiedAt);
 }finally{await s.close();}
});
test('env fallback used without vault key; 503 with neither',async()=>{
 let used='';
 const mk=(env:NodeJS.ProcessEnv)=>serve({vaultKey:()=>undefined,preferences:()=>({models:{}}),token:TOKEN,env,request:(async(_u:string,i:RequestInit)=>{used=(i.headers as Record<string,string>)['x-api-key'];return new Response('',{status:200});}) as unknown as typeof fetch});
 let s=await mk({ANTHROPIC_API_KEY:'sk-env'});
 try{assert.equal((await post(s.url,body)).status,200);assert.equal(used,'sk-env');}finally{await s.close();}
 s=await mk({});
 try{assert.equal((await post(s.url,body)).status,503);}finally{await s.close();}
});
test('upstream errors map to coarse codes without provider body or key',async()=>{
 for(const[status,want,code]of[[429,429,'rate_limited'],[401,503,'provider_auth'],[529,503,'provider_overloaded'],[400,502,'provider_rejected']] as const){
  const s=await serve({vaultKey:()=>'sk-k',preferences:()=>({models:{}}),token:TOKEN,request:(async()=>new Response('{"error":{"message":"leak sk-k"}}',{status})) as unknown as typeof fetch});
  try{const r=await post(s.url,body);const t=await r.text();assert.equal(r.status,want);assert.equal(JSON.parse(t).error,code);assert.ok(!t.includes('leak'));}finally{await s.close();}
 }
});
test('fixture replay needs no key and no network',async()=>{
 const events=[{type:'message_start'},{type:'message_stop'}];
 const s=await serve({vaultKey:()=>undefined,preferences:()=>({models:{}}),token:TOKEN,env:{},fixture:()=>events,request:(async()=>{throw new Error('network');}) as unknown as typeof fetch});
 try{const r=await post(s.url,body);assert.equal(r.status,200);assert.equal(await r.text(),sseBody(events));}finally{await s.close();}
});
