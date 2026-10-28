import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Ops,OpsStore,RateLimit} from '../services/ops/ops.js';
import {catalogFor} from '../services/ops/catalog.js';
import {PartRecordSchema,type PartRecord} from '../packages/catalog/schema.js';

const base=():PartRecord[]=>(JSON.parse(readFileSync(new URL('../packages/catalog/fixtures/farm-parts.json',import.meta.url),'utf8')).parts as unknown[]).map(p=>PartRecordSchema.parse(p));
const mk=()=>{const ops=new Ops(new OpsStore(':memory:'),new Map(),new RateLimit(),()=>new Date('2026-10-23T03:00:00Z'));return catalogFor(ops,{base});};

test('new part becomes a pending proposal, low confidence, not in the catalog',()=>{
 const c=mk();
 const r=c.submitNewPart('member:1',{newPart:{name:'SHT31 Breakout',kind:'sensor',mpn:'SHT31-DIS',pins:[{name:'SDA',func:['i2c-sda']},{name:'VIN',func:['power']}],sizeMm:{w:10,h:10,d:3}},sourceUrl:'https://example.com/sht31.pdf'});
 assert.ok(r.ok);if(!r.ok)return;
 assert.equal(c.part(r.partId),undefined);
 const row=(c as any).db.prepare('SELECT * FROM catalog_proposals WHERE id=?').get(r.id)as any;assert.equal(row.status,'pending');
 const rec=PartRecordSchema.parse(JSON.parse(row.ops).newPart);
 assert.equal(rec.identity.name.p.confidence,'low');assert.equal(rec.pins.length,2);assert.equal(rec.identity.mpn?.v,'SHT31-DIS');
});
test('bad drafts are refused and the pending cap holds',()=>{
 const c=mk();
 assert.equal(c.submitNewPart('member:1',{newPart:{name:'x',kind:'Bad Kind'},sourceUrl:'https://e.com/a'}).ok,false);
 assert.equal(c.submitNewPart('member:1',{newPart:{name:'x',kind:'sensor',pins:[{name:'A',func:['bogus']}]},sourceUrl:'https://e.com/a'}).ok,false);
 for(let i=0;i<20;i++)assert.ok(c.submitNewPart('member:2',{newPart:{name:'Part '+i,kind:'sensor'},sourceUrl:'https://e.com/a'}).ok);
 assert.equal(c.submitNewPart('member:2',{newPart:{name:'one more',kind:'sensor'},sourceUrl:'https://e.com/a'}).ok,false);
});
