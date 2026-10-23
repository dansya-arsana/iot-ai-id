import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hardwareLibrary} from '../packages/hardware-library/index.js';
import {components,esp32Devkit} from '../packages/component-catalog/index.js';
import {deviceRegistry} from '../apps/web/src/lab/sim/devices/index.js';
import {PART_PINS} from '../apps/web/src/lab/contract.js';
import {PartRecordSchema,verifiedShare,applyOverlay,loadCatalog,getPart,CATALOG_DATA_URL} from '../packages/catalog/index.js';
import {buildCatalog,serializeCatalog} from '../packages/catalog/build.js';
import {LAB_ID_ALIAS,pinFunc} from '../packages/catalog/import/lab-registry.js';

const cat=buildCatalog();
const byId=new Map(cat.parts.map(p=>[p.identity.id,p]));

test('every record validates and carries provenance on every leaf',()=>{
 assert.ok(cat.parts.length>=100);
 for(const p of cat.parts){
  PartRecordSchema.parse(p);
  assert.ok(verifiedShare(p)>=0);
  assert.match(p.identity.name.p.verifiedBy,/^import$/);
 }
 assert.equal(new Set(cat.parts.map(p=>p.identity.id)).size,cat.parts.length);
});
test('no drift: every hardware-library record is in the catalog with its name and sources',()=>{
 for(const r of hardwareLibrary){
  const p=byId.get(r.id);assert.ok(p,`missing ${r.id}`);
  assert.equal(p.identity.name.v,r.name.slice(0,80),r.id);
 }
});
test('no drift: component-catalog electrical data, pins, addresses and libraries are preserved',()=>{
 for(const c of components){
  const p=byId.get(c.id);assert.ok(p,`missing ${c.id}`);
  assert.deepEqual(p.electrical.supplyV.v,{min:c.voltage[0],max:c.voltage[1]},c.id);
  assert.equal(p.electrical.logicLevelV?.v,c.logicVoltage,c.id);
  assert.equal(p.electrical.currentMa.v.typ,c.currentMa,c.id);
  assert.deepEqual(p.pins.map(x=>x.v.name),c.pins.map(x=>x.name),c.id);
  assert.deepEqual(p.protocols.i2cAddresses?.v??[],c.addresses,c.id);
  assert.deepEqual(p.drivers.map(d=>d.v.lib),c.libraries,c.id);
  assert.equal(p.protocols.supported.v.includes(c.protocol),true,c.id);
 }
});
test('no drift: ESP32 DevKit pins, rails and logic level match the board manifest',()=>{
 const p=byId.get(esp32Devkit.id)!;
 assert.equal(p.identity.kind.v,'board');
 assert.equal(p.electrical.logicLevelV?.v,3.3);
 const names=new Set(p.pins.map(x=>x.v.name));
 for(const pin of esp32Devkit.pins)assert.ok(names.has(`GPIO${pin.name}`),pin.name);
 for(const rail of Object.keys(esp32Devkit.powerRails))assert.ok(names.has(rail));
 const g6=p.pins.find(x=>x.v.name==='GPIO6')!;assert.match(g6.v.note??'',/reserved/);
});
test('no drift: every lab device kind is in the catalog; lab-only parts keep the lab pin list and supply window',()=>{
 const kinds=deviceRegistry.kinds();
 assert.ok(kinds.length>=70);
 const labOnly=new Set(components.map(c=>c.id));
 for(const k of kinds){
  const id=LAB_ID_ALIAS[k]??k;
  const p=byId.get(id);assert.ok(p,`missing lab kind ${k}`);
  const d=deviceRegistry.get(k)!;
  if(!labOnly.has(id)&&id!=='esp32-devkit'){
   assert.deepEqual(p.pins.map(x=>x.v.name),[...PART_PINS[k]!],k);
   if(d.power)assert.deepEqual(p.electrical.supplyV.v,{min:d.power.min,max:d.power.max},k);
  }
 }
});
test('lab parts with a scene file get a draft procedural 3D flag, others none',()=>{
 assert.equal(byId.get('dht22')!.model3d.kind.v,'procedural');
 assert.equal(byId.get('raspberry-pi-5')!.model3d.kind.v,'none');
});
test('defaults are flagged low confidence and never high',()=>{
 const p=byId.get('raspberry-pi-5')!;
 assert.equal(p.mechanical.sizeMm.p.confidence,'low');
 assert.match(p.mechanical.sizeMm.p.source,/^default/);
 assert.equal(p.environment.outdoor.p.confidence,'low');
});
test('LoRa: no 433 MHz RA-02 part, and no part claims a frequency band outside 920-923 MHz',()=>{
 for(const p of cat.parts){
  assert.notEqual(p.identity.id,'lora-ra02');
  if(p.protocols.freqMHz)assert.ok(p.protocols.freqMHz.v.min>=920&&p.protocols.freqMHz.v.max<=923,p.identity.id);
 }
});
test('pin function heuristic',()=>{
 assert.deepEqual(pinFunc('VCC','gpio'),['power']);
 assert.deepEqual(pinFunc('GND','gpio'),['ground']);
 assert.deepEqual(pinFunc('SDA','i2c'),['i2c-sda']);
 assert.deepEqual(pinFunc('SIG','adc'),['adc']);
});
test('committed data/catalog.json is current and loads',()=>{
 assert.equal(readFileSync(CATALOG_DATA_URL,'utf8'),serializeCatalog(cat),'run: npx tsx scripts/catalog-import.ts');
 const c=loadCatalog();
 assert.equal(c.parts.length,cat.parts.length);
 assert.ok(getPart('bme280'));
});
test('importer output is deterministic',()=>{
 assert.equal(serializeCatalog(buildCatalog()),serializeCatalog(cat));
});
test('overlay applies a valid leaf patch and rejects an invalid or identity-changing one atomically',()=>{
 const base=cat.parts.slice(0,3);
 const id=base[0]!.identity.id;
 const good=applyOverlay(base,[{partId:id,ops:[{op:'add',path:'/electrical/logicLevelV',value:{v:3.3,p:{source:'staff review',verifiedBy:'staff:ann',at:'2026-10-23',confidence:'high'}}}]}]);
 assert.equal(good.rejected.length,0);
 assert.equal(good.parts[0]!.electrical.logicLevelV?.p.verifiedBy,'staff:ann');
 const bad=applyOverlay(base,[
  {partId:id,ops:[{op:'replace',path:'/electrical/supplyV/v/min',value:-5}]},
  {partId:id,ops:[{op:'replace',path:'/identity/id',value:'other'}]},
  {partId:'nope',ops:[{op:'remove',path:'/pins/0'}]},
 ]);
 assert.equal(bad.rejected.length,3);
 assert.deepEqual(bad.parts[0],base[0]);
});
