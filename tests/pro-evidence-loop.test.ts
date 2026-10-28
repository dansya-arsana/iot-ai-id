import test from 'node:test';
import assert from 'node:assert/strict';
import {nodeProven,proposeConfidenceRaise,type TickRow,type PartLeaf,type ProposalSink} from '../services/ops/pro-evidence.js';

const D=86_400_000,t0=Date.parse('2026-10-01T00:00:00Z');
const tick=(itemId:string,at:number,by='evidence'):TickRow=>({itemId,state:'ticked',by,at:new Date(at).toISOString()});
test('nodeProven needs all evidence ticks aged N days, no human ticks, no error anomalies',()=>{
 const ids=['flash:n1','power-up:n1:boot'];
 assert.equal(nodeProven(ids,[tick(ids[0],t0),tick(ids[1],t0+D)],t0+8*D).proven,true);
 assert.equal(nodeProven(ids,[tick(ids[0],t0),tick(ids[1],t0+D)],t0+7*D).proven,false);
 assert.deepEqual(nodeProven(ids,[tick(ids[0],t0)],t0+30*D).missing,[ids[1]]);
 assert.equal(nodeProven(ids,[tick(ids[0],t0),tick(ids[1],t0,'human')],t0+30*D).proven,false);
 assert.equal(nodeProven(ids,[tick(ids[0],t0),tick(ids[1],t0)],t0+30*D,7,[{nodeId:'n1',code:'boot_loop',en:'',id:'',severity:'error'}]).proven,false);
 assert.equal(nodeProven([],[],t0+30*D).proven,false);
});
test('proposals only, high-confidence leaves skipped',()=>{
 const got:unknown[]=[];const sink:ProposalSink={submitProposal:(s,i)=>{got.push([s,i]);return{ok:true,id:'p'+got.length};}};
 const leaf=(c:string):PartLeaf=>({path:'/electrical/supplyV',v:3.3,p:{source:'x',verifiedBy:'import',at:'2026-01-01',confidence:c}});
 const r=proposeConfidenceRaise(sink,'pro-evidence',['a','a','b'],id=>id==='a'?[leaf('low'),leaf('high')]:[leaf('high')],{projectId:'pr',nodeId:'n1',since:'2026-10-01T00:00:00Z',today:'2026-10-10'});
 assert.deepEqual(r,{proposed:[{partId:'a',proposalId:'p1'}],skipped:['b']});
 const i=(got[0] as [string,{ops:{value:{p:{confidence:string}}}[]}])[1];
 assert.equal(i.ops[0].value.p.confidence,'high');assert.equal(i.ops.length,1);
});
