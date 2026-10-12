import test from 'node:test';
import assert from 'node:assert/strict';
import {rasterize,GROUPS,type Feature} from '../scripts/hero-map-grid.js';
import {heroGrid} from '../apps/web/src/hero-map-data.js';
import {REGIONS} from '../apps/web/src/hero-map/regions.js';
import {HOTSPOTS} from '../apps/web/src/hero-map/hotspots.js';
import {visibleValue,COMPANY,placeholdersAllowed} from '../apps/web/src/company.js';
import {TEST_REGIONS,TEST_BUILDS,TEST_SITES} from '../packages/ops-contract/index.js';

const square=(x:number,y:number,s:number):Feature['geometry']=>({type:'Polygon',coordinates:[[[x,y],[x+s,y],[x+s,y+s],[x,y+s],[x,y]]]});
test('rasterize tags cells by region group and neighbour code, sea stays empty',()=>{
 const r=rasterize([{properties:{adm0_a3:'IDN',name:'Bali'},geometry:square(0,0,1)},{properties:{adm0_a3:'IDN',name:'Nowhere'},geometry:square(2,0,1)}],[{properties:{ADM0_A3:'MYS'},geometry:square(3,0,1)}],{lon0:0,lon1:5,lat0:0,lat1:1,step:.2});
 assert.equal(r.cols,25);assert.equal(r.rows,5);assert.ok(r.grid.every(row=>row.length===25));
 assert.equal(r.grid[2][2],'N');assert.equal(r.grid[2][12],'.');assert.equal(r.grid[2][17],'m');assert.deepEqual(r.unknown,['Nowhere']);
});
test('the committed hero grid is well formed and covers every interactive region',()=>{
 assert.equal(heroGrid.grid.length,heroGrid.rows);assert.ok(heroGrid.grid.every(row=>row.length===heroGrid.cols));assert.equal(heroGrid.step,0.2);
 const seen=new Set(heroGrid.grid.join(''));
 for(const r of REGIONS.filter(r=>r.code))assert.ok(seen.has(r.code),`dots for ${r.id}`);
 for(const c of 'mbpts')assert.ok(seen.has(c),`neighbour ${c}`);
 assert.ok(new Set(Object.values(GROUPS)).size>=8);
});
test('every region and hotspot is valid: vocabularies, coordinates, at most three panel facts, sources on every fact',()=>{
 assert.deepEqual(REGIONS.map(r=>r.id).sort(),[...TEST_REGIONS].sort());
 const ids=new Set<string>();
 for(const h of HOTSPOTS){
  assert.ok(!ids.has(h.id));ids.add(h.id);assert.ok((TEST_REGIONS as readonly string[]).includes(h.region),h.id);
  assert.ok(h.lon>94&&h.lon<144&&h.lat>-11.5&&h.lat<6.5,h.id);for(const b of h.fit)assert.ok((TEST_BUILDS as readonly string[]).includes(b));
  for(const f of h.facts){assert.ok(f.url.startsWith('https://')&&f.year&&f.src,h.id);if(f.conf==='L')assert.ok(!f.hero,`low confidence never in a panel: ${h.id}`);}
 }
 for(const r of REGIONS){assert.equal(r.facts.filter(f=>f.hero).length<=3,true,r.id);assert.equal(r.season.length,12);for(const f of r.facts)if(f.conf==='L')assert.ok(!f.hero);}
 assert.ok(HOTSPOTS.filter(h=>h.pin).length===8);
});
test('placeholder rule: omitted for the public, marked for staff and localhost, shown plain once filled in',()=>{
 const dummy={value:'PT [name]',placeholder:true},real={value:'PT Contoh Sejahtera',placeholder:false};
 assert.equal(visibleValue(dummy,false),null);
 assert.equal(visibleValue(dummy,true),'PT [name] [placeholder]');
 assert.equal(visibleValue(real,false),'PT Contoh Sejahtera');assert.equal(visibleValue(real,true),'PT Contoh Sejahtera');
 for(const [k,v] of Object.entries(COMPANY))assert.equal(v.placeholder,true,`${k} stays a placeholder until the founder confirms it`);
});
test('placeholders fail closed on unknown hosts',()=>{
 for(const h of ['localhost','iot.admin.localhost','127.0.0.1','::1'])assert.equal(placeholdersAllowed(h,false,false),true,h);
 for(const h of ['148.230.96.157','staging.iot.ai.id','iot-ai-id.example.com','admin.iot.ai.id'])assert.equal(placeholdersAllowed(h,false,false),false,h);
 assert.equal(placeholdersAllowed('iot.ai.id',true,true),false);
 assert.equal(placeholdersAllowed('iot.ai.id',true,false),true);
});
test('every map hotspot id is an accepted inquiry site and vice versa',()=>{
 assert.deepEqual(HOTSPOTS.map(h=>h.id).sort(),[...TEST_SITES].sort());
});
test('stat tiles are verbatim figures from their sentence, on hero facts only, never low confidence',()=>{
 let n=0;
 for(const r of REGIONS)for(const f of r.facts)if(f.stat){
  n++;assert.ok(f.hero&&f.conf!=='L',`${r.id}: a tile needs a hero fact of H or M confidence`);
  for(const tok of `${f.stat.v} ${f.stat.l}`.match(/\d[\d.,]*\d|\d/g)??[])assert.ok(f.t.includes(tok),`${r.id}: "${tok}" is not in "${f.t}"`);
 }
 assert.equal(n,27);
 for(const r of REGIONS)assert.equal(r.facts.filter(f=>f.hero&&f.conf!=='L').slice(0,3).every(f=>f.stat),true,`${r.id}: every region tile has a stat`);
});
