import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {layoutSitePlan,fmtArea,pointInField,MARGIN_TARGET_DB} from '../apps/web/src/pro/site/layout.js';
const spec=()=>JSON.parse(readFileSync(new URL('../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json',import.meta.url),'utf8'));

test('farm layout: 4 fields, 4 nodes + gateway, 4 links',()=>{
 const L=layoutSitePlan(spec());
 assert.equal(L.fields.length,4);assert.equal(L.nodes.length,5);assert.equal(L.links.length,4);
 assert.deepEqual(L.nodes.map(n=>n.tag),['N1','N2','N3','N4','GW']);
 assert.deepEqual(L.gateway,{x:0,y:0});
});
test('nodes sit inside their field and links join node to gateway',()=>{
 const L=layoutSitePlan(spec());
 for(const n of L.nodes.filter(n=>n.role==='field'))assert.ok(pointInField(L.fields.find(f=>f.id===n.fieldId)!,n.at));
 for(const l of L.links)assert.ok(l.a&&l.b&&l.to==='gateway');
});
test('margin under target is low and text matches spec distance',()=>{
 const L=layoutSitePlan(spec());
 const l3=L.links[2];
 assert.equal(l3.low,true);assert.equal(l3.text,'L3 · 1400 m · +14 dB');
 assert.equal(L.links[0].low,false);assert.ok(14<MARGIN_TARGET_DB);
 assert.ok(L.nodes.find(n=>n.id==='node-chili')!.warn);
 assert.ok(!L.nodes.find(n=>n.id==='node-melon')!.warn);
});
test('pill text stays upright; wifi pill has no dB',()=>{
 const s=spec();s.links[0].params={medium:'wifi',band:'2.4GHz',ssidPlaceholder:'YOUR_WIFI_SSID'};
 const L=layoutSitePlan(s);
 for(const l of L.links)assert.ok(l.angleDeg>=-90&&l.angleDeg<=90);
 assert.equal(L.links[0].text,'L1 · Wi-Fi · 400 m');
});
test('area and scale bar',()=>{
 assert.equal(fmtArea(9000),'0.90 ha');assert.equal(fmtArea(400),'400 m²');
 const L=layoutSitePlan(spec());assert.ok(L.bar.m>0&&L.bar.len>0);
});
