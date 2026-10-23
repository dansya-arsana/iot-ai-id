import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,runTurn,scriptedLlm,textMsg,stubGate,type R} from './pro-harness.js';
import {handleProAdmin,schemaGate,specSha,canonicalJson,Pro} from '../services/ops/pro.js';
import {DEFAULT_KILL_SWITCH} from '../packages/pro-contract/agent.js';
import {PRO_PRICING} from '../packages/pro-contract/pricing.js';

async function setup(deps:Parameters<typeof harness>[0]={}){
 const h=harness({llm:scriptedLlm([textMsg('ok')]),...deps});
 const staff=await h.staff();
 const pid=(await h.call('POST','projects',{name:'Farm'},{staff})).data.id as string;
 return{...h,staff,pid};
}
const patch=(path='/summary',value:unknown={en:'x',id:'x'})=>[{op:'add',path,value}];

test('access: anonymous 401, member without pro 403 (by invitation), missing CSRF 403, staff and granted member allowed',async()=>{
 const h=harness({llm:scriptedLlm([textMsg('ok')])});
 assert.equal((await h.call('GET','projects')).status,401);
 const nope=await h.member('nopro',false);
 const r=await h.call('GET','projects',undefined,{member:nope.cookie});
 assert.equal(r.status,403);assert.match(r.data.error,/invitation/i);
 const yes=await h.member('haspro',true);
 assert.equal((await h.call('GET','projects',undefined,{member:yes.cookie})).status,200);
 assert.equal((await h.call('POST','projects',{name:'x'},{member:yes.cookie,csrf:false})).status,403);
 const staff=await h.staff();
 assert.equal((await h.call('POST','projects',{name:'x'},{staff})).status,201);
});

test('project ownership: other members get 404 on every project route',async()=>{
 const h=harness({llm:scriptedLlm([textMsg('ok')])});
 const a=await h.member('alice',true),b=await h.member('bob',true);
 const p=(await h.call('POST','projects',{name:'A farm'},{member:a.cookie})).data;
 assert.equal(p.subject,'member:'+a.id);
 assert.equal((await h.call('GET',`projects/${p.id}`,undefined,{member:a.cookie})).status,200);
 for(const [m,path,body] of [['GET',`projects/${p.id}`],['GET',`projects/${p.id}/revisions`],['GET',`projects/${p.id}/messages`],['POST',`projects/${p.id}/turns`,{message:'hi'}],['DELETE',`projects/${p.id}`],['GET',`projects/${p.id}/turns/x/events`],['POST',`projects/${p.id}/turns/x/tool-results`,{callId:'c',ok:true,output:{}}]] as [string,string,unknown?][]){
  assert.equal((await h.call(m,path,body,{member:b.cookie})).status,404,m+' '+path);
 }
 assert.deepEqual((await h.call('GET','projects',undefined,{member:b.cookie})).data.projects,[]);
 assert.equal((await h.call('POST','projects',{name:''},{member:a.cookie})).status,400);
 assert.equal((await h.call('POST','projects',{name:'x',extra:1},{member:a.cookie})).status,400);
});

test('save_revision: 409 stale, gate failure writes nothing, server-owned paths refused, r1 then r2, canonical sha',async()=>{
 const h=await setup();
 const subject=(h.pro['db'].prepare('SELECT subject FROM pro_projects WHERE id=?').get(h.pid) as {subject:string}).subject;
 const s=(base:number,ops:unknown[])=>h.pro.saveRevision(h.pid,subject,{baseRevision:base,ops:ops as never,reason:'r'},'t');
 const stale=await s(3,patch());assert.equal(stale.ok,false);assert.equal((stale as any).status,409);assert.equal((stale as any).headRevision,0);
 const owned=await s(0,patch('/verification/x',{}));assert.equal((owned as any).code,'patch_server_owned');assert.equal((owned as any).status,422);
 const missing=await s(0,[{op:'replace',path:'/nodes/5/name',value:'x'}]);assert.equal((missing as any).code,'patch_bad_index');
 const r1=await s(0,patch());assert.equal(r1.ok,true);assert.equal((r1 as any).revision,1);
 assert.equal((r1 as any).verification.verified,1);assert.deepEqual((r1 as any).verification.unverified,[{path:'/links/0',reason:'LoRa margin is an estimate'}]);
 const r2=await s(1,[{op:'replace',path:'/summary',value:{en:'y',id:'y'}}]);assert.equal((r2 as any).revision,2);
 assert.equal((await s(1,patch('/summary2'))).ok,false,'r1 base is stale after r2');
 assert.equal(h.pro.revisions(h.pid).length,2);
 assert.equal(h.pro.revisionView(h.pid,1)!.spec&&(h.pro.revisionView(h.pid,1)!.spec as any).summary.en,'x','r1 is never overwritten');
 assert.equal(specSha({b:1,a:[2,{d:1,c:2}]}),specSha({a:[2,{c:2,d:1}],b:1}));
 assert.equal(canonicalJson({a:undefined,b:1}),'{"b":1}');
 const ro=await h.call('GET',`projects/${h.pid}/revisions/2`,undefined,{staff:h.staff});assert.equal(ro.status,200);assert.equal(ro.data.revision,2);
 assert.equal((await h.call('GET',`projects/${h.pid}/revisions/9`,undefined,{staff:h.staff})).status,404);
});

test('gate: the default schema gate refuses an incomplete spec and nothing is saved',async()=>{
 const h=harness({llm:scriptedLlm([textMsg('ok')]),gate:schemaGate});
 const staff=await h.staff();const pid=(await h.call('POST','projects',{name:'F'},{staff})).data.id;
 const subject=(h.pro['db'].prepare('SELECT subject FROM pro_projects WHERE id=?').get(pid) as {subject:string}).subject;
 const r=await h.pro.saveRevision(pid,subject,{baseRevision:0,ops:patch() as never,reason:'x'},'t');
 assert.equal(r.ok,false);assert.equal((r as any).code,'gate_failed');assert.ok(Array.isArray((r as any).issues)&&(r as any).issues.length>0);
 assert.equal(h.pro.project(pid,subject)!.headRevision,0);assert.equal(h.pro.revisions(pid).length,0);
});

test('save_revision tool: project must be the turn project; get_revision subtree and bad path',async()=>{
 const h=await setup();
 const subject=(h.pro['db'].prepare('SELECT subject FROM pro_projects WHERE id=?').get(h.pid) as {subject:string}).subject;
 const ctx={subject,projectId:h.pid};
 const bad=await h.pro.toolSaveRevision(ctx,{projectId:'someone-else',baseRevision:0,ops:patch() as never,reason:'r'});
 assert.deepEqual(bad.output,{error:'project_mismatch'});
 assert.equal((await h.pro.toolSaveRevision(ctx,{projectId:h.pid,baseRevision:0,ops:patch() as never,reason:'r'})).ok,true);
 assert.deepEqual((h.pro.toolGetRevision(ctx,{projectId:h.pid,path:'/summary/en'}).output as any).spec,'x');
 assert.equal(h.pro.toolGetRevision(ctx,{projectId:h.pid,path:'/nope'}).ok,false);
 assert.equal(h.pro.toolGetRevision(ctx,{projectId:'zzz'}).ok,false);
 const stale=await h.pro.toolSaveRevision(ctx,{projectId:h.pid,baseRevision:0,ops:patch('/s2') as never,reason:'r'});
 assert.equal((stale.output as any).error,'stale_revision');assert.equal((stale.output as any).headRevision,1);
});

test('turns: validation, no model field, unavailable, kill-switch pause, one running turn per project',async()=>{
 const h=await setup();
 const t=(body:unknown)=>h.call('POST',`projects/${h.pid}/turns`,body,{staff:h.staff});
 assert.equal((await t({message:''})).status,400);
 assert.equal((await t({message:'x'.repeat(2001)})).status,400);
 assert.equal((await t({message:'hi',model:'claude-opus-5-5'})).status,400,'the model is the admin choice, never a request field');
 assert.equal((await t({message:'hi',clientTools:['rm_rf']})).status,400);
 // unavailable
 const off=harness({llm:{available:()=>false,stream:()=>(async function*(){})()}});
 const s2=await off.staff();const p2=(await off.call('POST','projects',{name:'x'},{staff:s2})).data.id;
 const r=await off.call('POST',`projects/${p2}/turns`,{message:'hi'},{staff:s2});assert.equal(r.status,503);assert.equal(r.data.kind,'unavailable');
 // kill switch paused
 h.pro['putSetting']('kill_switch',{enabled:true,monthlyUsd:1});
 h.pro.recordUsage({subject:'member:z',projectId:'p',turnId:'t0',model:'claude-sonnet-5-5',inputTokens:1,outputTokens:1,cacheReadTokens:0,cacheWriteTokens:0,usdMicros:2_000_000,toolCalls:0,at:new Date(h.clock.t).toISOString()});
 const paused=await t({message:'hi'});assert.equal(paused.status,503);assert.equal(paused.data.kind,'kill_switch');
 assert.equal((await h.call('GET','quota',undefined,{staff:h.staff})).data.paused,true);
 h.pro['putSetting']('kill_switch',{enabled:false,monthlyUsd:1});
 assert.equal((await t({message:'hi'})).status,202,'a disabled kill-switch lets turns run');
});

test('a running turn blocks a second one (409), and the project is free again after done',async()=>{
 let release:()=>void=()=>{};const gate=new Promise<void>(r=>{release=r;});
 const h=await setup({llm:scriptedLlm([async function*(){await gate;yield*textMsg('late');}])});
 const a=await h.call('POST',`projects/${h.pid}/turns`,{message:'one'},{staff:h.staff});assert.equal(a.status,202);
 const b=await h.call('POST',`projects/${h.pid}/turns`,{message:'two'},{staff:h.staff});assert.equal(b.status,409);assert.equal(b.data.kind,'turn_in_progress');
 release();
 let r:R;do{r=await h.call('GET',`projects/${h.pid}/turns/${a.data.turnId}/poll/-1`,undefined,{staff:h.staff});}while(!r.data.done);
 assert.equal((await h.call('POST',`projects/${h.pid}/turns`,{message:'three'},{staff:h.staff})).status,202);
});

test('events: SSE stream replays then ends with id lines; poll returns JSON; messages hide plumbing',async()=>{
 const h=await setup({llm:scriptedLlm([textMsg('hello farm')])});
 const {events,turnId}=await runTurn(h,h.pid,{staff:h.staff},'design a farm');
 assert.deepEqual(events.map(e=>e.type),['text_delta','usage','done']);
 assert.deepEqual(events.map(e=>e.seq),[0,1,2]);
 const sse=await h.call('GET',`projects/${h.pid}/turns/${turnId}/events/0`,undefined,{staff:h.staff});
 assert.equal(sse.status,200);assert.ok(sse.stream);
 const frames:string[]=[];let ended=false;
 sse.stream!(f=>frames.push(f),()=>{ended=true;});
 assert.ok(ended);assert.equal(frames.length,2);assert.match(frames[0]!,/^id: 1\nevent: usage\ndata: \{/);
 const m=(await h.call('GET',`projects/${h.pid}/messages`,undefined,{staff:h.staff})).data.messages;
 assert.deepEqual(m.map((x:any)=>[x.role,x.text]),[['user','design a farm'],['assistant','hello farm']]);
 assert.equal((await h.call('GET',`projects/${h.pid}/turns/nope/poll/-1`,undefined,{staff:h.staff})).status,404);
});

test('usage is recorded per member and per project, with null USD when the model has no pinned price',async()=>{
 const h=harness({llm:scriptedLlm([textMsg('ok',1000,500)])});
 const m=await h.member('carol',true);
 const p1=(await h.call('POST','projects',{name:'one'},{member:m.cookie})).data.id,p2=(await h.call('POST','projects',{name:'two'},{member:m.cookie})).data.id;
 await runTurn(h,p1,{member:m.cookie});await runTurn(h,p2,{member:m.cookie});await runTurn(h,p2,{member:m.cookie});
 const u=h.pro.usageSummary();
 assert.equal(u.bySubject.length,1);assert.equal(u.bySubject[0]!.turns,3);assert.equal(u.bySubject[0]!.inputTokens,3000);assert.equal(u.bySubject[0]!.outputTokens,1500);
 assert.equal(u.byProject.find(p=>p.projectId===p2)!.turns,2);
 assert.equal(u.bySubject[0]!.unpricedTurns,PRO_PRICING['claude-sonnet-5-5']===null?3:0);
 if(PRO_PRICING['claude-sonnet-5-5']===null)assert.equal(u.bySubject[0]!.usdMicros,null);
 const q=(await h.call('GET','quota',undefined,{member:m.cookie})).data;
 assert.equal(q.limits.maxToolCalls,40);assert.equal(q.limits.maxTurnMs,900_000);assert.equal(q.usage.turns,3);
 assert.equal('quota' in q,false);assert.equal(q.paused,false);
});

test('admin settings: owner only, validated, kill-switch default is high and can be disabled; Opus selectable',async()=>{
 const h=harness({llm:scriptedLlm([textMsg('ok')])});
 const call=(role:any,method:string,rest:string[],body?:unknown)=>handleProAdmin(h.ops,{method,path:'/ops/v1/admin/pro/'+rest.join('/'),body,ip:'1.1.1.1'},role,'daniel',rest) as R;
 assert.equal(call('sales','GET',['settings']).status,403);
 const d=call('owner','GET',['settings']).data;
 assert.equal(d.model,'claude-sonnet-5-5');assert.deepEqual({enabled:d.killSwitch.enabled,monthlyUsd:d.killSwitch.monthlyUsd},DEFAULT_KILL_SWITCH);assert.equal(d.killSwitch.tripped,false);
 assert.equal(call('owner','PUT',['settings'],{model:'gpt-9'}).status,400);
 assert.equal(call('owner','PUT',['settings'],{thinkingBudget:500}).status,400);
 assert.equal(call('owner','PUT',['settings'],{killSwitch:{enabled:true,monthlyUsd:-1}}).status,400);
 assert.equal(call('owner','PUT',['settings'],{}).status,400);
 const ok=call('owner','PUT',['settings'],{model:'claude-opus-5-5',thinkingBudget:0,killSwitch:{enabled:false,monthlyUsd:5}}).data;
 assert.equal(ok.model,'claude-opus-5-5');assert.equal(ok.thinkingBudget,0);assert.equal(ok.killSwitch.enabled,false);assert.equal(ok.killSwitch.tripped,false);
 // members run on Opus once admin selects it
 assert.equal(h.pro.model(),'claude-opus-5-5');
 assert.equal(call('owner','GET',['usage']).status,200);assert.equal(call('owner','GET',['nope']).status,404);
});

test('restart: turns left running are closed with error and done, and the project is usable',async()=>{
 const h=await setup();
 const at=new Date().toISOString();
 h.pro['db'].prepare(`INSERT INTO pro_turns(id,project_id,subject,status,model,lang,client_tools,tool_calls,started_at) VALUES('orphan',?,?,'running','claude-sonnet-5-5','en','[]',0,?)`).run(h.pid,'staff:x',at);
 new Pro(h.ops,{llm:scriptedLlm([textMsg('ok')])});
 const st=h.pro['db'].prepare(`SELECT status,stop_reason FROM pro_turns WHERE id='orphan'`).get() as any;
 assert.deepEqual({...st},{status:'done',stop_reason:'error'});
 const ev=h.pro.agent.eventsAfter('orphan',-1);assert.deepEqual(ev.events.map(e=>e.type),['error','done']);assert.equal(ev.done,true);
});

test('stubGate sanity',()=>{assert.equal((stubGate({}, {projectId:'p',subject:'s',revision:1}) as any).ok,true);});
