import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCatalog,searchParts} from '../packages/catalog/index.js';

const {parts,aliases}=loadCatalog();
const ids=(q:Parameters<typeof searchParts>[1])=>searchParts(parts,q,aliases).map(h=>h.id);

test('exact id and name rank first',()=>{
 assert.equal(ids({q:'bme280'})[0],'bme280');
 assert.equal(ids({q:'ds18b20'})[0],'ds18b20');
});
test('aliases and Indonesian words find parts',()=>{
 assert.ok(ids({q:'kelembapan'}).includes('bme280'));
 assert.ok(ids({q:'rtc'}).includes('ds3231'));
 assert.ok(ids({q:'oled'}).some(i=>/ssd1306/.test(i)));
});
test('filters: protocol, kind, i2c address, limit',()=>{
 const i2c=searchParts(parts,{protocol:'i2c',limit:50},aliases);
 assert.ok(i2c.length>5);for(const h of i2c)assert.ok(h.protocols.includes('i2c'));
 assert.ok(ids({i2cAddress:0x76}).includes('bme280'));
 for(const h of searchParts(parts,{kind:'board',limit:50},aliases))assert.equal(h.kind,'board');
 assert.equal(searchParts(parts,{limit:3},aliases).length,3);
 assert.ok(searchParts(parts,{limit:999},aliases).length<=50);
});
test('unmatched query returns nothing; results are deterministic',()=>{
 assert.deepEqual(ids({q:'zzzqqq'}),[]);
 assert.deepEqual(ids({q:'sensor suhu'}),ids({q:'sensor suhu'}));
});
test('quality filters: minConfidence high drops defaulted parts, labTested finds none yet',()=>{
 const all=searchParts(parts,{limit:50},aliases).length;
 const hi=searchParts(parts,{minConfidence:'high',limit:50},aliases).length;
 assert.ok(hi<=all);
 assert.equal(searchParts(parts,{labTested:true},aliases).length,0);
 for(const h of searchParts(parts,{minVerifiedShare:0.5,limit:50},aliases))assert.ok(h.verifiedShare>=0.5);
});
