import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {registry} from '../apps/web/src/lab/scene/parts/index.js';
import {PartRecordSchema} from '../packages/catalog/schema.js';
import {buildCatalog} from '../packages/catalog/build.js';
import {deriveFootprint,footprintPinPos} from '../packages/catalog/footprints.js';

const dir=new URL('../packages/catalog/data/',import.meta.url);
const files=readdirSync(dir).filter(f=>f.endsWith('.json')&&f!=='catalog.json').sort();
const recs=files.map(f=>PartRecordSchema.parse(JSON.parse(readFileSync(new URL(f,dir),'utf8'))));

test('every curated part has a footprint with provenance',()=>{
 assert.ok(recs.length>=21);
 for(const r of recs){
  const fp=r.footprint;assert.ok(fp,r.identity.id);
  assert.equal(fp.p.verifiedBy,'import');assert.match(fp.p.confidence,/^(medium|low)$/);
  assert.ok(fp.p.source.length>0);
 }
});
test('footprint pins equal record pins and lab model positions within 0.1 mm',()=>{
 for(const r of recs){
  const id=r.identity.id,fp=r.footprint!,pos=footprintPinPos(fp.v),names=r.pins.map(p=>p.v.name);
  if(!names.length){assert.equal(pos.size,0,id);continue;}
  assert.deepEqual([...pos.keys()].sort(),[...names].sort(),id);
  assert.ok(fp.v.rows.length<=8,id);
  for(const [n,q] of pos)assert.ok(q.x>=0&&q.y>=0&&q.x<=fp.v.outlineMm.w&&q.y<=fp.v.outlineMm.h,`${id}.${n} inside outline`);
  if(fp.p.confidence!=='medium')continue;
  const mod=registry.get(id as never);assert.ok(mod,id);assert.equal(fp.p.source,`apps/web/src/lab/scene/parts/${id}.ts`);
  const minX=Math.min(...names.map(n=>mod.pins[n]!.at[0])),minZ=Math.min(...names.map(n=>mod.pins[n]!.at[2]));
  const o=[...pos.values()].reduce((a,b)=>({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y)}));
  for(const n of names){
   const a:readonly number[]=mod.pins[n]!.at,q=pos.get(n)!;
   assert.ok(Math.abs((q.x-o.x)-(a[0]-minX))<0.1&&Math.abs((q.y-o.y)-(a[2]-minZ))<0.1,`${id}.${n}`);
  }
 }
});
test('low-confidence fallbacks say so in provenance',()=>{
 for(const r of recs)if(r.footprint!.p.confidence==='low')assert.match(r.footprint!.p.source,/derived from record\.pins/);
});
test('deriveFootprint splits irregular spacing into rows',()=>{
 const f=deriveFootprint([{name:'a',x:0,z:0},{name:'b',x:2.54,z:0},{name:'c',x:5.08,z:0},{name:'d',x:10,z:0}]);
 assert.equal(f.rows.length,2);assert.equal(f.rows[0]!.pitch,2.54);
});
test('catalog build carries the footprints',()=>{
 const c=buildCatalog();for(const r of recs)assert.deepEqual(c.parts.find(p=>p.identity.id===r.identity.id)!.footprint,r.footprint);
});
