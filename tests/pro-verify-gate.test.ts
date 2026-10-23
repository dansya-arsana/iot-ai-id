import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SystemSpecSchema} from '../packages/pro-contract/system-spec.js';
import {verifySpec,type GateVerifiers,type GateIssue} from '../packages/pro-tools/verify-spec.js';

const spec=SystemSpecSchema.parse(JSON.parse(readFileSync(new URL('../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json',import.meta.url),'utf8')) as unknown);
const NOW=new Date('2026-10-23T00:00:00Z');
const okAll:GateVerifiers={netlist:()=>[],compat:()=>[],power:()=>[],link:()=>({status:'ok',issues:[]}),
 compile:()=>({status:'compiled',diagnostics:[],pinsReferenced:[],sha256:'a'.repeat(64),toolchain:'t',bytes:100})};

test('no verifiers: everything is unverified and listed, with a reason',async()=>{
 const r=await verifySpec(spec,undefined,{},NOW);
 assert.equal(r.counts.verified,0);assert.equal(r.counts.failed,0);
 assert.equal(r.unverified.length,r.counts.unverified);
 assert.ok(r.unverified.length>0&&r.unverified.every(u=>u.reason.length>0&&u.path.startsWith('/')));
 SystemSpecSchema.parse(r.spec);
});
test('all verifiers pass: every item verified; model-sent verify is replaced',async()=>{
 const forged=structuredClone(spec);forged.code[0].verify.status='failed';forged.code[0].pinsReferenced=[];
 const r=await verifySpec(forged,{},okAll,NOW);
 assert.equal(r.counts.unverified,0);assert.equal(r.counts.failed,0);assert.ok(r.counts.verified>0);
 assert.equal(r.spec.code[0].verify.status,'compiled');assert.equal(r.spec.code[0].verify.at,NOW.toISOString());
 assert.ok(r.verification['/code/0']&&r.verification['/nodes/0/wires/0']&&r.verification['/power/'+spec.nodes[0].id]&&r.verification['/links/0']);
});
test('netlist error with a wire ref fails only that wire; without a ref fails all wires of the node',async()=>{
 const w0=spec.nodes[0].wires[0].id;
 const mk=(ref?:string):GateVerifiers=>({...okAll,netlist:n=>n.id===spec.nodes[0].id?[{code:'x',severity:'error',en:'bad',id:'buruk',...(ref?{ref}:{})}] as GateIssue[]:[]});
 const a=await verifySpec(spec,undefined,mk(w0),NOW);
 assert.equal(a.verification['/nodes/0/wires/0'].status,'failed');
 if(spec.nodes[0].wires.length>1)assert.equal(a.verification['/nodes/0/wires/1'].status,'verified');
 const b=await verifySpec(spec,undefined,mk(),NOW);
 assert.ok(spec.nodes[0].wires.every((_w,i)=>b.verification[`/nodes/0/wires/${i}`].status==='failed'));
 assert.ok(a.checks.some(c=>c.severity==='error'&&c.scope.nodeId===spec.nodes[0].id));
});
test('failed compile, pending compile, crashing verifier',async()=>{
 const f=await verifySpec(spec,undefined,{...okAll,compile:()=>({status:'failed',diagnostics:[{line:3,message:'oops',severity:'error'}],pinsReferenced:[],sha256:'b'.repeat(64),toolchain:'t'})},NOW);
 assert.equal(f.verification['/code/0'].status,'failed');assert.equal(f.verification['/code/0'].note,'oops');
 const p=await verifySpec(spec,undefined,{...okAll,compile:()=>({status:'pending',diagnostics:[],pinsReferenced:[],sha256:'b'.repeat(64),toolchain:'t'})},NOW);
 assert.equal(p.verification['/code/0'].status,'unverified');
 const c=await verifySpec(spec,undefined,{...okAll,power:()=>{throw new Error('boom');}},NOW);
 assert.equal(c.verification['/power/'+spec.nodes[0].id].status,'unverified');
 assert.match(c.verification['/power/'+spec.nodes[0].id].note??'',/crashed/);
});
test('link status error fails the link; warning stays verified with a note',async()=>{
 const e=await verifySpec(spec,undefined,{...okAll,link:()=>({status:'error',issues:[{code:'l',severity:'error',en:'weak',id:'lemah'}]})},NOW);
 assert.equal(e.verification['/links/0'].status,'failed');
 const w=await verifySpec(spec,undefined,{...okAll,link:()=>({status:'warning',issues:[]})},NOW);
 assert.equal(w.verification['/links/0'].status,'verified');assert.ok(w.verification['/links/0'].note);
});
test('unchanged items keep their stamp; changed inputs are re-stamped; low confidence is noted',async()=>{
 const first=await verifySpec(spec,undefined,okAll,NOW);
 const later=new Date('2026-10-24T00:00:00Z');
 const again=await verifySpec(spec,first.verification,okAll,later);
 assert.equal(again.verification['/links/0'].at,NOW.toISOString());
 const changed=structuredClone(spec);changed.links[0].distanceM+=10;
 const re=await verifySpec(changed,first.verification,okAll,later);
 assert.equal(re.verification['/links/0'].at,later.toISOString());
 assert.notEqual(re.verification['/links/0'].inputsSha,first.verification['/links/0'].inputsSha);
 const low=await verifySpec(spec,undefined,{...okAll,confidence:()=>'low'},NOW);
 assert.equal(low.verification['/nodes/0/wires/0'].note,'verified against low-confidence data');
});
