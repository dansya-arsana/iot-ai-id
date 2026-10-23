import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Ops,OpsStore,RateLimit} from '../services/ops/ops.js';
import {staffInvite} from '../services/ops/cli.js';
import {installPro,callTool,makeDerive} from '../services/ops/pro-wiring.js';
import {transcriptLlm,type ProLlmRequest} from '../services/ops/pro-agent.js';
import {parseEventsJsonl,AgentEventSchema,type AgentEvent} from '../packages/pro-contract/agent.js';
import {PartRecordSchema} from '../packages/catalog/schema.js';
import {SystemSpecSchema} from '../packages/pro-contract/system-spec.js';
import {runTurn} from './pro-harness.js';
import {httpProLlm} from '../services/ops/pro-agent.js';
import {opsPath,bodyLimit} from '../services/ops/transport.js';
import {ProMessagesRequestSchema} from '../services/api/pro-model.js';

const FIXTURE=readFileSync(new URL('../packages/pro-contract/fixtures/agent/farm-turn.jsonl',import.meta.url),'utf8');
const SPEC=JSON.parse(readFileSync(new URL('../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json',import.meta.url),'utf8')) as Record<string,unknown>;
const parts=(JSON.parse(readFileSync(new URL('../packages/catalog/fixtures/farm-parts.json',import.meta.url),'utf8')) as {parts:unknown[]}).parts.map(p=>PartRecordSchema.parse(p));

async function setup(over:Record<string,unknown>={}){
 const ops=new Ops(new OpsStore(':memory:'),new Map(),new RateLimit());
 let pid='';
 const once=transcriptLlm(parseEventsJsonl(FIXTURE.replaceAll('"projectId":"p1"','"projectId":"__PID__"')));
 const log:ProLlmRequest[]=[];
 const llm={available:()=>true,stream:(req:ProLlmRequest,sig:AbortSignal)=>{log.push(structuredClone(req));return(async function*(){for await(const e of once.stream(req,sig))yield JSON.parse(JSON.stringify(e).replaceAll('__PID__',pid));})();}};
 // The fixture model patches only /summary; the derive hook stands in for a full design so the real gate has something to verify.
 const derive=(doc:Record<string,unknown>)=>({...structuredClone(SPEC),summary:doc.summary});
 const pro=installPro(ops,{llm,parts:()=>parts,compiler:false,derive,retryDelaysMs:[0,0],...over});
 const made=await staffInvite(ops,['daniel','owner','daniel person']);
 const a=await ops.handle({method:'POST',path:'/ops/v1/staff/activate',body:{code:made.inviteCode,password:'a long staff password'},ip:'3.3.3.3',headers:{'x-aiot-staff':'1'}});
 const staff=/aiot_admin=([^;]*)/.exec(String(a!.setCookie??''))?.[1]??'';
 const call=async(method:string,path:string,body?:unknown)=>(await ops.handle({method,path:'/ops/v1/member/pro/'+path,body,ip:'5.5.5.5',headers:{cookie:`aiot_admin=${staff}`,'x-aiot-staff':'1'}})) as {status:number;data:any};
 pid=(await call('POST','projects',{name:'Farm'})).data.id;
 return{ops,pro,staff,pid,call,log};
}

test('fixture end to end: the farm conversation runs the real tools offline and saves a gated r1',async()=>{
 const h=await setup();
 const {events,start}=await runTurn({call:(m:string,p:string,b?:unknown)=>h.call(m,p,b)} as never,h.pid,{staff:h.staff},'4 fields, LoRa, solar');
 assert.equal(start.status,202);
 for(const e of events)assert.ok(AgentEventSchema.safeParse(e).success,e.type);
 const results=events.filter(e=>e.type==='tool_result') as (AgentEvent&{name:string;ok:boolean;output:any})[];
 const names=new Set(results.map(r=>r.name));
 assert.ok(names.size>=8,'distinct tools: '+[...names].join(','));
 // the real implementations answered, not recorded outputs
 assert.equal(results.find(r=>r.name==='site_climate')!.ok,true);
 assert.equal(results.find(r=>r.name==='load_skill')!.output.name,'lora-as923-id');
 assert.ok(results.find(r=>r.name==='catalog_search')!.output.items.some((i:{id:string})=>i.id==='lora-rfm95w'));
 assert.equal(results.find(r=>r.name==='compile_code')!.ok,false,'no sandbox in this test');
 const save=results.find(r=>r.name==='save_revision')!;
 assert.equal(save.ok,true,JSON.stringify(save.output));
 const rev=events.find(e=>e.type==='revision_saved') as unknown as {revision:number;verified:number};
 assert.equal(rev.revision,1);assert.ok(rev.verified>=1);
 const stored=h.pro.revisionView(h.pid,1)!;
 assert.ok(SystemSpecSchema.safeParse(stored.spec).success);
 // the gate stamped server-side; the model could not
 const stamps=Object.values((stored.spec as {verification:Record<string,{status:string}>}).verification);
 assert.ok(stamps.some(s=>s.status==='verified')&&stamps.length>=5);
 // model access: only system/messages/tools/max_tokens reach the proxy (checked by httpProLlm); the loop request carries the tool surface
 assert.equal(events.at(-1)!.type,'done');
});

test('dispatcher authz holds in the loop: another subject cannot read this project through a tool',async()=>{
 const h=await setup();
 const r=await callTool(h.pro,'member:someone-else','get_revision',{projectId:h.pid});
 assert.equal(r.ok,false);assert.equal((r as {error:{status:number}}).error.status,404);
 const own=await callTool(h.pro,(h.pro.db.prepare('SELECT subject FROM pro_projects WHERE id=?').get(h.pid) as {subject:string}).subject,'get_revision',{projectId:h.pid});
 assert.equal(own.ok,false,'no revision yet: a clear not_found, not a crash');
});

test('the default derive rebuilds server-owned sections and leaves a partial doc to the schema',()=>{
 const lookup=(id:string)=>parts.find(p=>p.identity.id===id);
 const out=makeDerive(lookup)(structuredClone(SPEC)) as {bom:{lines:unknown[]};checklist:unknown[];tests:unknown[]};
 assert.ok(out.bom.lines.length>0);assert.ok(out.checklist.length>0);assert.ok(out.tests.length>0);
 const partial=makeDerive(lookup)({summary:{en:'x',id:'x'}});
 assert.deepEqual(partial,{summary:{en:'x',id:'x'}});
});

test('contract: ops sends the api proxy only fields it accepts; config mirrors model and kill-switch',async()=>{
 let sent:Record<string,unknown>={};
 const f=(async(u:string|URL,init?:RequestInit)=>{
  if(String(u).endsWith('/internal/pro/config'))return new Response(JSON.stringify({model:'claude-opus-5-5',killSwitch:{enabled:true,monthlyUsd:5}}),{status:200});
  sent=JSON.parse(String(init!.body));return new Response('',{status:200});
 }) as typeof fetch;
 const llm=httpProLlm('http://api','t'.repeat(32),f);
 for await(const _ of llm.stream({model:'claude-sonnet-5-5',max_tokens:16000,stream:true,system:[{type:'text',text:'x'}],tools:[],messages:[{role:'user',content:'hi'}],thinking:{type:'enabled',budget_tokens:5000}},new AbortController().signal));
 assert.ok(ProMessagesRequestSchema.safeParse(sent).success,'the proxy schema is strict');
 assert.ok(!('model' in sent)&&!('thinking' in sent)&&!('stream' in sent));
 assert.deepEqual(await llm.config!(),{model:'claude-opus-5-5',killSwitch:{enabled:true,monthlyUsd:5}});
 // the api owns the setting: ops mirrors it, so the kill-switch the admin sets in AI settings is the one enforced
 const h=await setup({llm:{available:()=>true,config:async()=>({model:'claude-opus-5-5',killSwitch:{enabled:true,monthlyUsd:5}}),stream:()=>(async function*(){})()}});
 await h.pro.refreshRemote();
 assert.equal(h.pro.model(),'claude-opus-5-5');assert.equal(h.pro.killSwitch().monthlyUsd,5);
});

test('transport: catalog routes keep their query string, pro tool results get a larger body cap',()=>{
 assert.equal(opsPath('/ops/v1/member/catalog/search?q=lora&limit=3').routed,'/ops/v1/member/catalog/search?q=lora&limit=3');
 assert.equal(opsPath('/ops/v1/member/pro/projects?x=1').routed,'/ops/v1/member/pro/projects');
 assert.equal(bodyLimit('/ops/v1/member/pro/projects/p/turns/t/tool-results'),262_144);
 assert.equal(bodyLimit('/ops/v1/inquiries'),20_000);
});
