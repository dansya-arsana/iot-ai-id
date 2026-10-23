import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SystemSpecSchema,ItemVerificationSchema,ckId,slug} from '../packages/pro-contract/system-spec.js';
import {applySpecPatch,PatchError,SpecPatchSchema,EMPTY_SPEC_DOC,isServerOwnedPath} from '../packages/pro-contract/patch.js';
import {AgentEventSchema,parseEventsJsonl,TurnRequestSchema,TURN_LIMITS,DEFAULT_KILL_SWITCH,killSwitchTripped,sseFrame,AGENT_EVENT_TYPES} from '../packages/pro-contract/agent.js';
import {displayRefs} from '../packages/pro-contract/refs.js';
import {PRO_PRICING,PRO_MODELS,PRO_DEFAULT_MODEL,costMicros} from '../packages/pro-contract/pricing.js';
import {PartRecordSchema,ProvenanceSchema,confidenceFromGrade,verifiedShare} from '../packages/catalog/schema.js';
const rd=(p:string)=>readFileSync(new URL('../packages/'+p,import.meta.url),'utf8');
const spec=()=>JSON.parse(rd('pro-contract/fixtures/farm-4-fields/spec.r1.json'));

test('farm fixture spec validates and is invalid when broken',()=>{
 assert.equal(SystemSpecSchema.safeParse(spec()).success,true);
 const s=spec();s.nodes[0].wires[0].from.part='ghost';
 assert.equal(SystemSpecSchema.safeParse(s).success,false);
 const t=spec();t.links[0].params.freqMHz=433;
 assert.equal(SystemSpecSchema.safeParse(t).success,false,'LoRa must be 920-923 MHz');
 const u=spec();delete u.verification;
 assert.equal(SystemSpecSchema.safeParse(u).success,false);
});
test('ItemVerification and ckId',()=>{
 assert.equal(ItemVerificationSchema.safeParse({status:'verified',by:'x',at:'2026-10-14T10:00:00.000Z',inputsSha:'a'.repeat(64)}).success,true);
 assert.equal(ItemVerificationSchema.safeParse({status:'maybe',by:'x',at:'2026-10-14T10:00:00.000Z',inputsSha:'a'.repeat(64)}).success,false);
 assert.equal(ckId('flash','Node Melon'),'flash:node-melon');
 assert.equal(slug('Kebun Mélon 1'),'kebun-melon-1');
});
test('SpecPatch applies atomically and rejects server-owned and hostile paths',()=>{
 const doc=applySpecPatch(EMPTY_SPEC_DOC(),[{op:'add',path:'/fields/-',value:{id:'a'}},{op:'add',path:'/summary',value:{en:'x',id:'y'}},{op:'replace',path:'/fields/0/id',value:'b'}]) as any;
 assert.equal(doc.fields[0].id,'b');assert.equal((EMPTY_SPEC_DOC().fields as unknown[]).length,0);
 assert.throws(()=>applySpecPatch(EMPTY_SPEC_DOC(),[{op:'add',path:'/verification/x',value:1}]),(e:any)=>e instanceof PatchError&&e.code==='server_owned');
 assert.throws(()=>applySpecPatch(EMPTY_SPEC_DOC(),[{op:'add',path:'/__proto__/x',value:1}]),PatchError);
 assert.throws(()=>applySpecPatch(EMPTY_SPEC_DOC(),[{op:'remove',path:'/fields/3'}]),PatchError);
 assert.equal(({}as any).x,undefined);
 assert.equal(isServerOwnedPath('/nodes/0/wires/1/id'),true);assert.equal(isServerOwnedPath('/nodes/0/wires/1/color'),false);
 assert.equal(SpecPatchSchema.safeParse(Array.from({length:201},()=>({op:'remove',path:'/a'}))).success,false);
 assert.equal(SpecPatchSchema.safeParse([{op:'move',from:'/a',path:'/b'}]).success,false);
 assert.equal(SpecPatchSchema.safeParse([{op:'add',path:'no-slash',value:1}]).success,false);
});
test('displayRefs numbers in spec order with GW',()=>{
 const r=displayRefs(spec());
 assert.deepEqual(r.fields,{melon:'F1',mango:'F2',chili:'F3',rice:'F4'});
 assert.equal(r.nodes.gateway,'GW');assert.equal(r.nodes['node-melon'],'N1');assert.equal(r.nodes['node-rice'],'N4');
 assert.equal(r.links['link-node-chili-gateway'],'L3');
 assert.equal(r.wires['node-melon'].W1,'W1');
});
test('agent events: fixture transcript parses, seq is ordered, covers 8+ tools and saves r1',()=>{
 const ev=parseEventsJsonl(rd('pro-contract/fixtures/agent/farm-turn.jsonl'));
 ev.forEach((e,i)=>assert.equal(e.seq,i));
 const tools=new Set(ev.filter(e=>e.type==='tool_call').map((e:any)=>e.name));
 assert.ok(tools.size>=8);assert.ok(tools.has('save_revision'));
 assert.ok(ev.some(e=>e.type==='revision_saved'&&e.revision===1));
 assert.equal(ev.at(-1)?.type,'done');
 for(const e of ev)assert.ok((AGENT_EVENT_TYPES as readonly string[]).includes(e.type));
 assert.match(sseFrame(ev[0]),/^event: thinking_delta\ndata: \{/);
 assert.equal(AgentEventSchema.safeParse({seq:0,type:'done',stopReason:'budget'}).success,true);
 assert.equal(AgentEventSchema.safeParse({seq:0,type:'done',stopReason:'bogus'}).success,false);
 assert.throws(()=>parseEventsJsonl('{"seq":0,"type":"nope"}'));
});
test('turn request, limits and kill-switch (technical only, no quotas)',()=>{
 assert.equal(TURN_LIMITS.maxToolCalls,40);assert.equal(TURN_LIMITS.maxTurnMs,900_000);
 assert.equal(TurnRequestSchema.safeParse({message:'x'.repeat(2001)}).success,false);
 assert.equal(TurnRequestSchema.safeParse({message:'hi',model:'claude-opus-5-5'}).success,false,'model is an admin choice');
 assert.deepEqual(TurnRequestSchema.parse({message:'hi'}).clientTools,[]);
 assert.equal(DEFAULT_KILL_SWITCH.monthlyUsd,1000);
 assert.equal(killSwitchTripped(DEFAULT_KILL_SWITCH,1_000_000_000),true);
 assert.equal(killSwitchTripped(DEFAULT_KILL_SWITCH,999_999_999),false);
 assert.equal(killSwitchTripped({enabled:false,monthlyUsd:1},9e12),false);
});
test('pricing is pinned from the official page; unknown models cost null',()=>{
 assert.deepEqual([...PRO_MODELS],['claude-sonnet-5-5','claude-opus-5-5']);assert.equal(PRO_DEFAULT_MODEL,'claude-sonnet-5-5');
 for(const m of PRO_MODELS)assert.ok(PRO_PRICING[m]?.verifiedAt);
 const u={inputTokens:1_000_000,outputTokens:1_000_000,cacheReadTokens:0,cacheWriteTokens:0};
 assert.equal(costMicros('claude-sonnet-5-5',u),12_000_000);assert.equal(costMicros('claude-opus-5-5',u),24_000_000);assert.equal(costMicros('unknown',u),null);
 const t={x:{inputPerMTok:3,outputPerMTok:15,cacheWrite5mPerMTok:3.75,cacheReadPerMTok:0.3,source:'test',verifiedAt:'2026-01-01'}};
 assert.equal(costMicros('x',u,t),18_000_000);
});
test('catalog schema: fixture parts validate, provenance rules, grade mapping',()=>{
 const {parts}=JSON.parse(rd('catalog/fixtures/farm-parts.json'));
 assert.ok(parts.length>=5);
 for(const p of parts)assert.equal(PartRecordSchema.safeParse(p).success,true,p.identity.id);
 const ids=parts.map((p:any)=>p.identity.id);
 const prov={source:'s',verifiedBy:'staff:u1',at:'2026-10-14',confidence:'high'};
 assert.equal(ProvenanceSchema.safeParse(prov).success,true);
 for(const bad of ['staff:','nobody','lab:'])assert.equal(ProvenanceSchema.safeParse({...prov,verifiedBy:bad}).success,false,bad);
 assert.equal(ProvenanceSchema.safeParse({...prov,confidence:'sure'}).success,false);
 assert.deepEqual(['A','b','C','D','E','M'].map(confidenceFromGrade),['high','high','medium','medium','low','low']);
 const share=verifiedShare(parts[0]);assert.ok(share>0&&share<=1);
 const bad=structuredClone(parts[0]);delete bad.electrical.supplyV.p;
 assert.equal(PartRecordSchema.safeParse(bad).success,false,'every leaf needs provenance');
 const farm=spec();
 const kinds=new Set(parts.map((p:any)=>p.identity.kind.v));
 for(const n of farm.nodes)for(const pt of n.parts)assert.ok(ids.includes(pt.kind),`part ${pt.kind} in catalog fixture`);
 assert.ok(kinds.has('radio'));
 assert.ok(!ids.includes('lora-ra02'),'RA-02 (433 MHz) is not a Pro part');
});
