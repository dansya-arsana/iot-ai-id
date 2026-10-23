import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PartRecordSchema} from '../packages/catalog/schema.js';
import {deviceRegistry} from '../apps/web/src/lab/sim/devices/index.js';

const load=(k:string)=>PartRecordSchema.parse(JSON.parse(readFileSync(new URL(`../packages/catalog/data/${k}.json`,import.meta.url),'utf8')));
const leaves=(x:unknown,out:{v:unknown;p:{source:string;confidence:string}}[]=[]):typeof out=>{
 if(!x||typeof x!=='object')return out;
 const o=x as Record<string,unknown>;
 if('v' in o&&'p' in o){out.push(o as never);return out;}
 for(const v of Object.values(o))leaves(v,out);
 return out;
};

for(const k of ['lora-rfm95w','lora-ra02','rpi-lora-hat']){
 test(`catalog ${k}: valid record, pins equal the lab device pins, every leaf cites a source`,()=>{
  const r=load(k);
  assert.equal(r.identity.id,k);
  assert.deepEqual(r.pins.map(p=>p.v.name),[...deviceRegistry.get(k)!.pins]);
  for(const l of leaves(r))assert.ok(l.p.source.length>3,`${k}: leaf without source`);
 });
}
test('catalog radio: the RFM95W covers AS923-2, the Ra-02 cannot (the Pro band error)',()=>{
 const inBand=(k:string,mhz:number)=>{const f=load(k).protocols.freqMHz!.v;return mhz>=f.min&&mhz<=f.max;};
 assert.ok(inBand('lora-rfm95w',920)&&inBand('lora-rfm95w',923));
 assert.ok(inBand('rpi-lora-hat',921));
 assert.ok(!inBand('lora-ra02',920)&&inBand('lora-ra02',433));
 assert.deepEqual(load('lora-ra02').compatibleWith.v,[]);
 assert.ok(load('lora-ra02').untrusted.pitfalls.some(p=>/band error/i.test(p.v.en)));
});
