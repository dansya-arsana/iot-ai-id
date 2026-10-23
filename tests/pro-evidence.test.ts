import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {tickFor,detect,ProEvidence,type EvidenceCtx} from '../services/ops/pro-evidence.js';

const ctx:EvidenceCtx={shaOf:n=>n==='n1'?'abc':undefined,bannerOf:()=>'AIOT n1',rangeOf:p=>p==='dht22'?{min:-40,max:80}:undefined};
const at=(s:number)=>new Date(1e12+s*1000).toISOString();

test('tick rules',()=>{
 assert.equal(tickFor({kind:'flash',nodeId:'n1',ok:true,sha:'abc',at:at(0)},ctx)?.itemId,'flash:n1');
 assert.equal(tickFor({kind:'flash',nodeId:'n1',ok:true,sha:'zzz',at:at(0)},ctx),undefined);
 assert.equal(tickFor({kind:'flash',nodeId:'n1',ok:false,sha:'abc',at:at(0)},ctx),undefined);
 assert.equal(tickFor({kind:'boot',nodeId:'n1',banner:'x AIOT n1 y',at:at(0)},ctx)?.itemId,'power-up:n1:boot');
 assert.equal(tickFor({kind:'boot',nodeId:'n1',banner:'other',at:at(0)},ctx),undefined);
 assert.equal(tickFor({kind:'reading',nodeId:'n1',partId:'dht22',value:25,at:at(0)},ctx)?.itemId,'power-up:n1:dht22');
 assert.equal(tickFor({kind:'reading',nodeId:'n1',partId:'dht22',value:200,at:at(0)},ctx),undefined);
 assert.equal(tickFor({kind:'reading',nodeId:'n1',partId:'dht22',value:NaN,at:at(0)},ctx),undefined);
 assert.equal(tickFor({kind:'telemetry',linkId:'l1',at:at(0)},ctx)?.itemId,'commission:l1');
});

test('detectors: out of range, stuck, boot loop',()=>{
 const ev=[...Array.from({length:6},(_,i)=>({kind:'reading' as const,nodeId:'n1',partId:'dht22',value:21,at:at(i)})),
  {kind:'reading' as const,nodeId:'n1',partId:'dht22',value:150,at:at(9)},
  ...[10,20,30].map(s=>({kind:'boot' as const,nodeId:'n1',banner:'b',at:at(s)}))];
 const codes=detect(ev,ctx).map(a=>a.code).sort();
 assert.deepEqual(codes,['boot_loop','out_of_range','stuck_value']);
 assert.deepEqual(detect([{kind:'boot',nodeId:'n1',at:at(0)},{kind:'boot',nodeId:'n1',at:at(500)}],ctx),[]);
});

test('db: ingest ticks as evidence, never overwrites a human tick, status shape',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE pro_ticks(project_id TEXT NOT NULL,item_id TEXT NOT NULL,state TEXT NOT NULL,by TEXT NOT NULL,evidence_ref TEXT,at TEXT NOT NULL,PRIMARY KEY(project_id,item_id));CREATE TABLE pro_evidence(id INTEGER PRIMARY KEY AUTOINCREMENT,project_id TEXT NOT NULL,node_id TEXT,kind TEXT NOT NULL,payload TEXT NOT NULL,at TEXT NOT NULL);');
 const ev=new ProEvidence(db as never);
 assert.ok(ev.ingest('p',{kind:'flash',nodeId:'n1',ok:true,sha:'abc',at:at(0)},ctx));
 db.prepare("INSERT INTO pro_ticks VALUES('p','commission:l1','open','human',NULL,'t')").run();
 assert.equal(ev.ingest('p',{kind:'telemetry',linkId:'l1',at:at(1)},ctx),undefined);
 const s=ev.status('p',ctx);
 assert.equal(s.items.find(i=>i.itemId==='flash:n1')?.by,'evidence');
 assert.equal(s.items.find(i=>i.itemId==='commission:l1')?.by,'human');
});
