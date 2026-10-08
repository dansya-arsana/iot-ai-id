import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../services/api/store.js';
import {hardwareLibrary,filterHardwareLibrary,hardwareKnowledgeDocument} from '../packages/hardware-library/index.js';
import {getComponent,components} from '../packages/component-catalog/index.js';

test('references are sourced, searchable, and cannot expand executable manifests',()=>{
 assert.equal(hardwareLibrary.length,56);assert.equal(new Set(hardwareLibrary.map(r=>r.id)).size,56);assert.equal(hardwareLibrary.filter(r=>r.kind==='board').length,16);
 assert(filterHardwareLibrary(hardwareLibrary,{q:'raspy'}).some(r=>r.id==='raspberry-pi-4'));
 assert(filterHardwareLibrary(hardwareLibrary,{kind:'board',family:'Arduino'}).length>=5);
 assert(filterHardwareLibrary(hardwareLibrary,{protocol:'spi',kind:'sensor'}).some(r=>r.id==='lis3dh'));
 assert.deepEqual(hardwareLibrary.filter(r=>r.support==='recipe_available').map(r=>r.id).sort(),['bme280','button-pullup-10k','esp32-devkit','led-series-330','ssd1306'].sort());
 assert.equal(filterHardwareLibrary(hardwareLibrary,{q:'rtd',protocol:'spi'})[0].id,'max31865-pt100');
 assert(hardwareLibrary.find(r=>r.id==='bno055')?.limitations.some(t=>t.includes('ESP32')));
 assert.deepEqual(hardwareLibrary.filter(r=>r.protocols.includes('passive')).map(r=>r.id).sort(),['adafruit-perma-proto','solderless-breadboard']);
 assert(hardwareLibrary.filter(r=>r.protocols.includes('passive')).every(r=>r.support==='planning_only'&&!r.executionManifestId));
 assert.equal(components.length,16);for(const r of hardwareLibrary){assert(r.sources.every(s=>s.url.startsWith('https://')));assert.equal(r.reviewStatus,'specification_only');assert(hardwareKnowledgeDocument(r).length<6000);if(!r.executionManifestId)assert.equal(getComponent(r.id),undefined);}
 assert.throws(()=>filterHardwareLibrary(hardwareLibrary,{kind:'invalid' as any}));
});

test('catalog persists, reseeds idempotently, updates changed records, and rejects invalid batches atomically',()=>{
 const dir=mkdtempSync(join(tmpdir(),'iot-catalog-')),path=join(dir,'catalog.sqlite');let store=new Store(path);
 try{
  assert.equal(store.seedHardwareLibrary(hardwareLibrary).inserted,56);const original=store.db.prepare('SELECT created_at,updated_at FROM hardware_catalog WHERE id=?').get('raspberry-pi-4');
  assert.deepEqual(store.seedHardwareLibrary(hardwareLibrary),{inserted:0,updated:0,total:56});assert.deepEqual(store.db.prepare('SELECT created_at,updated_at FROM hardware_catalog WHERE id=?').get('raspberry-pi-4'),original);
  store.close();store=new Store(path);assert.equal(store.hardwareLibrary().length,56);assert.equal(store.hardwareLibrary({q:'tanah',category:'soil'})[0].id,'stemma-soil');
  const changed={...store.hardwareReference('raspberry-pi-4')!,version:2,summary:'Updated reference summary'};
  assert.equal(store.seedHardwareLibrary([changed]).updated,1);assert.equal(store.hardwareReference(changed.id)?.version,2);assert.equal(store.db.prepare('SELECT created_at FROM hardware_catalog WHERE id=?').get(changed.id)?.created_at,original?.created_at);
  assert.throws(()=>store.seedHardwareLibrary([changed,changed]));assert.throws(()=>store.seedHardwareLibrary([{...changed,name:''}]));assert.equal(store.hardwareLibrary().length,56);assert.equal(store.hardwareReference(changed.id)?.summary,changed.summary);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
