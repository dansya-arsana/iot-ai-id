import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getSpecSchema,prefillServerFields,describeIssues,SPEC_EXAMPLE,WritableSpecSchema} from '../packages/pro-tools/impl/spec-schema.js';
import {getTool} from '../packages/pro-tools/registry.js';
import {SystemSpecSchema,SYSTEM_SPEC_VERSION} from '../packages/pro-contract/system-spec.js';
import {splitServerOwned} from '../packages/pro-contract/patch.js';
import {PartRecordSchema,type PartRecord} from '../packages/catalog/schema.js';
import {ProToolDispatcher,type ProToolStore,type StoredRevision,type ToolCtx} from '../services/ops/pro-tools.js';
import {makeDerive,makeVerifiers} from '../services/ops/pro-wiring.js';
import {harness} from './pro-harness.js';
import {createProTelemetry,isBrokerUrl,redactSecrets} from '../services/api/pro-telemetry.js';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const cat=JSON.parse(readFileSync(new URL('../packages/catalog/fixtures/farm-parts.json',import.meta.url),'utf8')) as {parts:unknown[]};
const parts=new Map((cat.parts as PartRecord[]).map(p=>{const r=PartRecordSchema.parse(p);return[r.identity.id,r] as const;}));
const lookup=(id:string)=>parts.get(id);
const ctx:ToolCtx={subject:'member:1',granted:true,local:false,meta:{lang:'en',provider:'anthropic',model:'claude-sonnet-5-5',catalogVersion:'t1'}};
const NOW=new Date('2026-10-23T00:00:00Z');
const ex=()=>structuredClone(SPEC_EXAMPLE) as any;

function mk(){
 const revs:(StoredRevision&{row?:unknown})[]=[];
 const store:ProToolStore={
  owns:(s,p)=>s==='member:1'&&p==='p1',
  head:()=>revs.at(-1),revision:(_p,n)=>revs.find(r=>r.revision===n),
  insert:(_p,row)=>{if(row.revision!==revs.length+1)return false;revs.push({revision:row.revision,spec:row.spec,verification:row.spec.verification,...(row.draft?{draft:true}:{})});return true;},
 };
 const d=new ProToolDispatcher({store,derive:makeDerive(lookup),verifiers:makeVerifiers(lookup,undefined),clock:()=>NOW});
 const save=(base:number,ops:unknown[],extra:Record<string,unknown>={})=>d.call(ctx,'save_revision',{projectId:'p1',baseRevision:base,ops,reason:'t',...extra}) as Promise<any>;
 const whole=(over:(d:any)=>void=()=>{})=>{const e=ex();over(e);return Object.entries(e).map(([k,v])=>({op:'add',path:'/'+k,value:v}));};
 return{d,revs,save,whole};
}

test('get_spec_schema: pure, deterministic, validates against its own output schema, is MCP-exposed',async()=>{
 const t=getTool('get_spec_schema')!;
 assert.equal(t.runsAt,'pure');assert.equal(t.deterministic,true);assert.equal(t.mcp,true);assert.equal(t.effect,'none');
 const a=getSpecSchema(),b=getSpecSchema();
 assert.deepEqual(a,b);
 assert.ok(t.output.safeParse(a).success,JSON.stringify(t.output.safeParse(a)));
 assert.ok(JSON.stringify(a).length<60_000,'compact enough for a tool result: '+JSON.stringify(a).length);
 const js=a.jsonSchema as any;
 assert.equal(js.type,'object');assert.ok(js.properties.nodes&&js.properties.site&&js.properties.fields&&js.properties.links&&js.properties.code);
 assert.ok(!js.properties.meta&&!js.properties.verification&&!js.properties.checklist&&!js.properties.bom,'server-owned sections are not offered');
 assert.deepEqual(js.properties.site.properties.gridPower.enum,['none','unreliable','reliable']);
 assert.deepEqual(a.enums.siteStress,['heat','flood','power','salt','haze','connectivity']);
 assert.match(a.patterns.wireId!,/W/);assert.equal(a.limits.bilingualShortChars,120);
 assert.ok(a.serverOwned.patchPathsIgnored.includes('/meta')&&a.serverOwned.patchPathsIgnored.includes('/nodes/*/power/budget')&&a.serverOwned.patchPathsIgnored.includes('/checklist'));
});

test('the example is complete and valid: once the server fields are added it passes SystemSpecSchema',()=>{
 assert.ok(WritableSpecSchema.safeParse(SPEC_EXAMPLE).success);
 const e=SPEC_EXAMPLE as any;
 assert.equal(e.fields.length,1);assert.equal(e.nodes.length,2);assert.equal(e.nodes.filter((n:any)=>n.role==='gateway').length,1);
 assert.equal(e.links.length,1);assert.equal(e.nodes[0].parts.length,2);assert.equal(e.nodes[0].wires.length,3);assert.equal(e.nodes[0].rules.length,1);assert.equal(e.code.length,1);
 const doc=ex() as Record<string,unknown>;
 Object.assign(doc,{bom:{lines:[],totalIdr:{min:0,max:0}},checks:[],checklist:[],tests:[],verification:{},meta:{version:SYSTEM_SPEC_VERSION,generatedAt:NOW.toISOString(),lang:'en',provider:'anthropic',model:'m',catalogVersion:'t1'}});
 prefillServerFields(doc,NOW.toISOString());
 const r=SystemSpecSchema.safeParse(doc);
 assert.ok(r.success,JSON.stringify(r.success?'':r.error.issues.slice(0,5)));
});

test('the example saves through save_revision (real derive, no draft) and the model could omit wire ids and code derivations',async()=>{
 const {save,whole,revs}=mk();
 const r=await save(0,whole(e=>{for(const n of e.nodes)for(const w of n.wires)delete w.id;}));
 assert.ok(r.ok,JSON.stringify(r));assert.equal(r.output.revision,1);assert.equal(r.output.draft,undefined);
 const spec=revs[0]!.spec as any;
 assert.deepEqual(spec.nodes[0].wires.map((w:any)=>w.id),['W1','W2','W3']);assert.deepEqual(spec.nodes[1].wires.map((w:any)=>w.id),['W4']);
 assert.ok(spec.checklist.length>0&&spec.bom.lines.length>0&&spec.meta.version===1,'server derived checklist, bom and meta');
 assert.equal(spec.code[0].verify.status,'pending');assert.deepEqual(spec.code[0].pinsReferenced,[]);
});

test('server-owned paths are IGNORED with a warning, not rejected',async()=>{
 const {save,whole,revs}=mk();
 const ops=[...whole(),{op:'add',path:'/meta',value:{x:1}},{op:'replace',path:'/checklist',value:[]},{op:'replace',path:'/nodes/0/power/budget',value:{avgMa:1,peakMa:2,dailyWh:3}},{op:'replace',path:'/nodes/0/wires/0/id',value:'W9'}];
 const r=await save(0,ops);
 assert.ok(r.ok,JSON.stringify(r));
 assert.deepEqual(r.output.warnings.map((w:any)=>w.path),['/meta','/checklist','/nodes/0/power/budget','/nodes/0/wires/0/id']);
 assert.ok(r.output.warnings.every((w:any)=>/ignored/.test(w.message)));
 const spec=revs[0]!.spec as any;
 assert.equal(spec.nodes[0].power.budget.avgMa,60,'the ignored op did not change the budget');assert.equal(spec.nodes[0].wires[0].id,'W1');
 // all ops server-owned: nothing to apply, a clear error that names the paths
 const none=await save(1,[{op:'add',path:'/verification/x',value:1}]);
 assert.equal(none.ok,false);assert.equal(none.error.code,'patch_empty');assert.match(none.error.message,/\/verification\/x/);
 assert.equal(splitServerOwned([{op:'add',path:'/summary',value:1},{op:'add',path:'/meta/x',value:1}] as never).ignored[0]!.opIndex,1);
});

test('spec_invalid returns ALL issues at once with path, message, expected and example',async()=>{
 const {save,whole,revs}=mk();
 const bad=whole(e=>{
  e.site.gridPower='sometimes';e.site.stress=['drought'];
  delete e.nodes[0].parts[0].qty;delete e.fields[0].id;
  e.nodes[0].rules[0].reason.en='x'.repeat(130);
  e.links[0].params.medium='radio';
  e.links[0].id='Link A';
  delete e.nodes[0].wires[1].from;
  delete e.nodes[0].rules[0].id;
 });
 const r=await save(0,bad);
 assert.equal(r.ok,false);assert.equal(r.error.code,'spec_invalid');assert.equal(revs.length,0);
 const issues=r.error.details as {path:string;message:string;expected?:string;example?:unknown}[];
 assert.ok(issues.length>=8,'every issue, not the first few: '+issues.length);
 const at=(p:string)=>issues.find(i=>i.path===p)!;
 assert.match(at('/site/gridPower').expected!,/"none" \| "unreliable" \| "reliable"/);assert.equal(at('/site/gridPower').example,'unreliable');
 assert.ok(at('/site/stress/0'));assert.match(at('/site/stress/0').expected!,/"heat"/);
 assert.match(at('/nodes/0/parts/0/qty').message,/required/);assert.equal(at('/nodes/0/parts/0/qty').example,1);
 assert.equal(at('/fields/0/id').example,'melon');
 assert.match(at('/nodes/0/rules/0/reason/en').expected!,/at most 120 characters/);
 assert.match(at('/links/0/params/medium').expected!,/lora/);
 assert.match(at('/links/0/id').expected!,/link-/);assert.equal(at('/links/0/id').example,'link-node-melon-gateway');
 assert.ok(at('/nodes/0/wires/1/from'));assert.ok(at('/nodes/0/rules/0/id'));
 assert.ok(r.error.message.includes(String(issues.length)));
 // the same issues come out of describeIssues directly
 const direct=SystemSpecSchema.safeParse({});
 assert.ok(!direct.success&&describeIssues(direct.error.issues as never).every(i=>i.path.startsWith('/')&&i.message));
});

test('draft mode: stored as a non-verified draft, builds on drafts, a final save runs the full gate',async()=>{
 const {save,whole,revs,d}=mk();
 // an incomplete design can be kept as a draft; issues come back, nothing is verified
 const d1=await save(0,[{op:'add',path:'/summary',value:{en:'x',id:'y'}},{op:'add',path:'/fields',value:[{id:'melon'}]}],{draft:true});
 assert.ok(d1.ok,JSON.stringify(d1));assert.equal(d1.output.draft,true);assert.equal(d1.output.revision,1);
 assert.deepEqual(d1.output.verification,{verified:0,unverified:[],failed:0});assert.ok(d1.output.issues.length>3);
 assert.equal(revs[0]!.draft,true);assert.deepEqual((revs[0]!.spec as any).verification,{});
 const g=await d.call(ctx,'get_revision',{projectId:'p1'}) as any;assert.equal(g.output.draft,true);
 // fix iteratively on top of the draft (replace what was wrong), still a draft until it is valid and final
 const d2=await save(1,[...whole()],{draft:true});
 assert.ok(d2.ok);assert.equal(d2.output.draft,true);assert.deepEqual(d2.output.issues,[]);assert.equal(d2.output.revision,2);
 // final, non-draft save: full gate, verification present, not a draft
 const fin=await save(2,[{op:'replace',path:'/summary/en',value:'Final'}]);
 assert.ok(fin.ok,JSON.stringify(fin));assert.equal(fin.output.draft,undefined);assert.equal(fin.output.revision,3);
 assert.ok(fin.output.verification.unverified.length>0);assert.equal(revs[2]!.draft,undefined);
 assert.ok(Object.keys((revs[2]!.spec as any).verification).length>0);
 // an invalid non-draft save still writes nothing
 const bad=await save(3,[{op:'replace',path:'/site/gridPower',value:'x'}]);
 assert.equal(bad.ok,false);assert.equal(revs.length,3);
});

test('drafts never reach the workspace head or the Build Sheet render',async()=>{
 const h=harness();const staff=await h.staff();
 const pid=(await h.call('POST','projects',{name:'D'},{staff})).data.id as string;
 const doc=()=>({spec:{summary:{en:'x',id:'y'},verification:{},checks:[]},specSha:'a'.repeat(64),reason:'r',subject:'s',model:'m'});
 assert.equal(h.pro.insertRevision(pid,{...doc(),revision:1}),true);
 assert.equal(h.pro.insertRevision(pid,{...doc(),revision:2,draft:true} as never),true);
 const proj=await h.call('GET',`projects/${pid}`,undefined,{staff});
 assert.equal(proj.data.project.headRevision,2,'the loop builds on the draft');assert.equal(proj.data.head.revision,1,'the workspace shows the last verified revision');assert.equal(proj.data.head.draft,false);
 assert.deepEqual((await h.call('GET',`projects/${pid}/revisions`,undefined,{staff})).data.revisions.map((r:any)=>[r.revision,r.draft]),[[2,true],[1,false]]);
 assert.equal((await h.call('GET',`projects/${pid}/revisions/2`,undefined,{staff})).data.draft,true);
 // only drafts: no head to show
 const pid2=(await h.call('POST','projects',{name:'E'},{staff})).data.id as string;
 h.pro.insertRevision(pid2,{...doc(),revision:1,draft:true} as never);
 assert.equal((await h.call('GET',`projects/${pid2}`,undefined,{staff})).data.head,null);
});

test('telemetry: only mqtt and mqtts without credentials in the URL; password is never kept in errors',async()=>{
 assert.equal(isBrokerUrl('mqtt://h:1883'),true);assert.equal(isBrokerUrl('mqtts://h'),true);
 for(const u of ['ws://h','wss://h','http://h','tcp://h','mqtt://u:pw@h','ftp://h',''])assert.equal(isBrokerUrl(u),false,u);
 assert.equal(redactSecrets('connect mqtt://bob:hunter2@10.0.0.5 failed: bad password hunter2','hunter2').includes('hunter2'),false);
 const dir=await mkdtemp(join(tmpdir(),'tel-'));let opts:any;
 const tel=createProTelemetry({settingsPath:join(dir,'s.json'),connector:o=>{opts=o;return{subscribe(){},end(){}};}});
 const call=(m:string,p:string,b?:unknown)=>tel.handle(m,p,new URLSearchParams(),async()=>b);
 for(const url of ['ws://h','mqtt://u:pw@h','http://h'])assert.equal((await call('PUT','/settings',{url})).status,400,url);
 assert.equal((await call('PUT','/settings',{url:'mqtts://h:8883',username:'u',password:'s3cretpw'})).status,200);
 await call('POST','/start',{projectId:'p1'});
 opts.onState('error','login failed for s3cretpw at mqtts://u:s3cretpw@h');
 const st=JSON.stringify((await call('GET','/status')).data);
 assert.ok(!st.includes('s3cretpw'),st);
 // a settings file left by an older build with a ws:// url is not used
 const {writeFile}=await import('node:fs/promises');await writeFile(join(dir,'s.json'),JSON.stringify({url:'ws://h'}));
 assert.equal((await call('POST','/start',{projectId:'p1'})).status,409);
});
