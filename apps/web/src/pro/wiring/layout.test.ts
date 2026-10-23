import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../../../../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json' with {type:'json'};
import {layoutWiring,wiringTables,partRefs,wireMatches} from './layout';
const spec=fixture as never as Parameters<typeof layoutWiring>[0];
test('layout keeps stored W ids, one terminal block per gland part, labelled chips',()=>{
 const L=layoutWiring(spec,'node-melon');
 assert.deepEqual(L.wires.map(w=>w.id),['W4','W5','W6'].map((_,i)=>spec.nodes[0].wires[i].id));
 assert.equal(L.tbs.length,2);
 assert.match(L.wires[1].text,/^W\d+ · GPIO4 → DQ$/);
 assert.ok(L.blocks.some(b=>b.kind==='board'&&b.ref==='U1'));
});
test('verification: only gated wires are verified, others carry a reason',()=>{
 const t=wiringTables(spec,'node-melon');
 const v=t.cables.filter(c=>c.verif==='verified'),u=t.cables.filter(c=>c.verif!=='verified');
 assert.equal(v.length,1);assert.ok(u.length>0&&u.every(c=>c.reason.length>0));
 assert.equal(v[0].reason,'');
});
test('cable list: via, length, gauge',()=>{
 const t=wiringTables(spec,'node-melon'),c=t.cables[0];
 assert.match(c.via,/^TB1-1 · G1$/);assert.equal(c.len,'3.0 m');assert.match(c.gauge,/22 AWG/);
 assert.equal(t.cables.find(x=>x.via==='—')?.len,'100 mm');
});
test('filter and refs',()=>{
 assert.ok(wireMatches({func:'bus'},'signal')&&!wireMatches({func:'ground'},'signal')&&wireMatches({func:'ground'},'power'));
 const r=partRefs(spec.nodes[0]);assert.equal(r.board,'U1');assert.equal(r['soil-capacitive-v2-1']??r['soil-moisture-capacitive-1'],'S1');
 assert.ok(layoutWiring(spec,'nope').empty);
 for(const n of spec.nodes){const L=layoutWiring(spec,n.id);for(const w of L.wires)assert.ok(w.pts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));}
});
