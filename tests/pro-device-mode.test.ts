/** C2 single-device mode: a one-node device spec validates, verifies and plans a Build Sheet; site specs are unchanged. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SystemSpecSchema,isDevice,type SystemSpec} from '../packages/pro-contract/system-spec.js';
import {displayRefs} from '../packages/pro-contract/refs.js';
import {verifySpec,type GateVerifiers} from '../packages/pro-tools/verify-spec.js';
import {WritableSpecSchema,DEVICE_SPEC_EXAMPLE,SPEC_EXAMPLE,getSpecSchema} from '../packages/pro-tools/impl/spec-schema.js';
import {runChecks} from '../packages/pro-tools/impl/checks.js';
import {buildChecklist} from '../packages/pro-tools/impl/checklist.js';
import {buildTestPlan} from '../packages/pro-tools/impl/testplan.js';
import {planPages,showsSitePlan,verifySummary,collectUnverified} from '../apps/web/src/pro/print/model.js';
import {layoutSitePlan} from '../apps/web/src/pro/site/layout.js';

const load=(u:string)=>JSON.parse(readFileSync(new URL(u,import.meta.url),'utf8')) as unknown;
const device=SystemSpecSchema.parse(load('./fixtures/pro/device-car-speed.json'));
const farm=load('../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json') as SystemSpec;
const NOW=new Date('2026-10-28T10:00:00.000Z');
const ok:GateVerifiers={netlist:()=>[],compat:()=>[],power:()=>[],link:()=>({status:'ok',issues:[]}),compile:()=>({status:'compiled',diagnostics:[],pinsReferenced:[],sha256:'a'.repeat(64),toolchain:'arduino-cli esp32'})};

test('device fixture validates: one node, no fields, no links, vehicle 12 V',()=>{
 assert.ok(isDevice(device));assert.equal(device.nodes.length,1);assert.equal(device.fields.length,0);assert.equal(device.nodes[0]!.power.source,'vehicle-12v');
});
test('device mode rules: exactly one node with role device; device role needs device mode',()=>{
 const two=structuredClone(device);two.nodes.push({...structuredClone(two.nodes[0]!),id:'device-2'});
 assert.equal(SystemSpecSchema.safeParse(two).success,false);
 const gw=structuredClone(device);gw.nodes[0]!.role='gateway';assert.equal(SystemSpecSchema.safeParse(gw).success,false);
 const asSite=structuredClone(device);delete asSite.site.kind;assert.equal(SystemSpecSchema.safeParse(asSite).success,false);
});
test('every existing site fixture still passes, with and without kind:site',()=>{
 assert.equal(SystemSpecSchema.safeParse(farm).success,true);
 assert.equal(SystemSpecSchema.safeParse({...farm,site:{...farm.site,kind:'site'}}).success,true);
 const noGw=structuredClone(farm);noGw.nodes=noGw.nodes.filter(n=>n.role!=='gateway');assert.equal(SystemSpecSchema.safeParse(noGw).success,false);
 const noFields=structuredClone(farm);noFields.fields=[];assert.equal(SystemSpecSchema.safeParse(noFields).success,false);
});
test('get_spec_schema: both examples fit the writable shape',()=>{
 assert.equal(WritableSpecSchema.safeParse(SPEC_EXAMPLE).success,true);
 assert.equal(WritableSpecSchema.safeParse(DEVICE_SPEC_EXAMPLE).success,true);
 assert.equal(getSpecSchema({device:true}).deviceExample,DEVICE_SPEC_EXAMPLE);assert.ok(getSpecSchema().notes.some(n=>/device/.test(n)));
});
test('device verifies through the gate: wires, parts, power and code stamped, no links',async()=>{
 const r=await verifySpec(device,undefined,ok,NOW);
 assert.equal(r.counts.failed,0);assert.equal(r.counts.unverified,0);
 assert.ok(r.verification['/power/device']&&r.verification['/code/0']&&r.verification['/nodes/0/wires/0']);
 assert.ok(!Object.keys(r.verification).some(k=>k.startsWith('/links/')));
 assert.equal(SystemSpecSchema.safeParse(r.spec).success,true);
});
test('derivation runs on a device: checks, checklist and test plan without gateway items',()=>{
 const checks=runChecks(device);assert.ok(!checks.some(c=>/gateway|link\.missing|ENC-01/i.test(c.code)));
 const ck=buildChecklist(device);assert.ok(ck.length>0);assert.ok(!ck.some(i=>i.id.includes('gateway')));
 assert.ok(Array.isArray(buildTestPlan(device)));
});
test('build sheet model renders a device and omits the site plan',async()=>{
 const s=(await verifySpec(device,undefined,ok,NOW)).spec;const refs=displayRefs(s);
 assert.equal(showsSitePlan(s),false);assert.equal(showsSitePlan(farm),true);
 const pages=planPages(s,refs);
 assert.equal(pages[0]!.kind,'cover');assert.equal(pages.filter(p=>p.kind==='node').length,1);assert.ok(pages.some(p=>p.kind==='code'));
 const sum=verifySummary(s,refs);assert.equal(sum.links.total,0);assert.equal(sum.wires.ok,2);
 assert.equal(collectUnverified(s,refs).length,0);
 assert.equal(refs.nodes.device,'N1');
 assert.equal(layoutSitePlan(s).nodes[0]!.tag,'DV');
});
test('site climate is optional for a device and required for a site',()=>{
 assert.equal(device.site.peakSunHours,undefined);assert.equal(device.site.plan,undefined);
 for(const k of ['gridPower','internet','stress','peakSunHours','plan'] as const){
  const s=structuredClone(farm);delete s.site[k];
  const r=SystemSpecSchema.safeParse(s);assert.equal(r.success,false,k);
  assert.ok(!r.success&&r.error.issues.some(i=>i.path.join('.')==='site.'+k),k);
 }
});
