import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateTurnCost,DEFAULT_TURN_CAP_USD} from './cost-estimate.js';
import {deriveStages} from './stage-strip.js';

test('cost: cap only, default cap, and typical from history clamped to cap',()=>{
 assert.equal(estimateTurnCost(2).typicalUsd,null);
 assert.match(estimateTurnCost(2).label.en,/Estimate: up to USD 2\.00/);
 assert.equal(estimateTurnCost(null).capUsd,DEFAULT_TURN_CAP_USD);
 const e=estimateTurnCost(3,[0.2,null,0.4,0.6]);assert.equal(e.typicalUsd,0.4);assert.match(e.label.id,/Perkiraan/);
 assert.equal(estimateTurnCost(1,[5,6]).typicalUsd,1);
 assert.match(e.free.en,/free/);
});
const base=()=>({nodes:[{parts:[{}],wires:[{}]}],bom:{lines:[{}]},code:[{verify:{status:'compiled'}}],checks:[],verification:{'/a':{status:'verified'}}}) as never;
test('stages: empty, partial, complete and failure states',()=>{
 assert.deepEqual(deriveStages(null).map(s=>s.state),['active','todo','todo','todo','todo','todo','todo']);
 const s=deriveStages(base());
 assert.deepEqual(s.map(x=>x.id),['brief','parts','wiring','code','board','sheet','field']);
 assert.deepEqual(s.map(x=>x.state),['done','done','done','done','todo','done','todo']);
 const bad=base() as never as {code:{verify:{status:string}}[];checks:unknown[]};bad.code[0].verify.status='failed';
 assert.equal(deriveStages(bad as never)[3].state,'blocked');assert.equal(deriveStages(bad as never)[5].state,'blocked');
 const pend=base() as never as {code:{verify:{status:string}}[]};pend.code[0].verify.status='pending';
 assert.equal(deriveStages(pend as never)[3].state,'active');
 assert.equal(deriveStages(base(),{board:true,fieldEvidence:true,draft:true}).map(x=>x.state).join(),'done,done,done,done,done,blocked,done');
});
