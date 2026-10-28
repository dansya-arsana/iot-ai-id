import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ProductInputSchema} from '../packages/ops-contract/index.js';
import {ProvenBuilds,publishBlockers,toProductDraft,type BuildFacts} from '../services/ops/proven-builds.js';

const f=(proven=true):BuildFacts=>({projectId:'11111111-1111-1111-1111-111111111111',name:'Greenhouse Node',summary:'Soil and air monitor for a greenhouse',vendorId:'22222222-2222-4222-8222-222222222222',wireless:true,nodes:[{nodeId:'n1',proven,since:'2026-10-01T00:00:00Z',parts:['esp32','dht22']}],tickCount:5,anomalies:0});
test('blockers and draft parse as a real product input',()=>{
 assert.deepEqual(publishBlockers(f()),[]);assert.equal(publishBlockers(f(false)).length,1);
 const d=toProductDraft(f());assert.equal(d.published,false);assert.match(d.testSummary,/1\/1 nodes/);
 assert.ok(ProductInputSchema.safeParse(d).success);
});
test('staff mark gates the draft',()=>{
 const pb=new ProvenBuilds(new DatabaseSync(':memory:') as never);
 assert.equal(pb.draft(f()),undefined);
 assert.equal(pb.mark(f(false),true,'staff').ok,false);
 assert.equal(pb.mark(f(),true,'staff').ok,true);
 assert.ok(pb.draft(f()));assert.equal(pb.list().length,1);
 pb.mark(f(),false,'staff');assert.equal(pb.draft(f()),undefined);
});
