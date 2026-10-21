import test from 'node:test';
import assert from 'node:assert/strict';
import {CIRCUITS,LESSON_IDS} from '../apps/web/src/lab/contract.js';
import {BB_COLS,layoutCircuit,lampCm,lampMm,obstacleCm,obstacleMm,resistorBands,wireCurve} from '../apps/web/src/lab/scene/layout.js';

for(const id of LESSON_IDS){
 test(`layout ${id}: placements are complete, hole-disjoint, bounded and deterministic`,()=>{
  const c=CIRCUITS[id];
  const a=layoutCircuit(c);
  for(const p of c.parts)assert.ok(a[p.id],`placement for ${p.id}`);
  const seen=new Set<string>();
  for(const p of Object.values(a)){
   assert.ok(Math.abs(p.x)<=250&&Math.abs(p.z)<=250,'within 250 mm');
   if(!p.onBoard)continue;
   for(const [col,row] of p.holes??[]){
    assert.ok(col>=0&&col<BB_COLS,'column in range');
    const k=`${col},${row}`;assert.ok(!seen.has(k),`hole ${k} reused`);seen.add(k);
   }
  }
  assert.deepEqual(layoutCircuit(c),a);
 });
}
test('wireCurve keeps endpoints and arcs above both ends',()=>{
 const a:[number,number,number]=[0,10,0],b:[number,number,number]=[60,8,30];
 const pts=wireCurve(a,b);
 assert.ok(pts.length>=24);
 assert.deepEqual(pts[0],a);assert.deepEqual(pts[pts.length-1],b);
 const apex=Math.max(...pts.map(p=>p[1]));
 assert.ok(apex>a[1]&&apex>b[1]);
 assert.ok(apex-Math.max(a[1],b[1])>=8);
});
test('input mappings round-trip and clamp',()=>{
 assert.equal(Math.round(lampMm(5)),25);assert.equal(Math.round(lampMm(150)),160);
 assert.equal(Math.round(obstacleMm(3)),20);assert.equal(Math.round(obstacleMm(250)),200);
 assert.ok(Math.abs(lampCm(lampMm(40))-40)<1e-6);assert.ok(Math.abs(obstacleCm(obstacleMm(60))-60)<1e-6);
 assert.equal(lampMm(999),lampMm(150));
});
test('resistor bands follow the colour code',()=>{
 assert.deepEqual(resistorBands(220),[2,2,1,10]);
 assert.deepEqual(resistorBands(10000),[1,0,3,10]);
 assert.deepEqual(resistorBands(1000),[1,0,2,10]);
 assert.deepEqual(resistorBands(4700),[4,7,2,10]);
});
