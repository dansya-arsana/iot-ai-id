import test from 'node:test';
import assert from 'node:assert/strict';
import {deviceRegistry} from '../apps/web/src/lab/sim/devices/index.js';
import {HAT_PINS} from '../apps/web/src/lab/sim/devices/rpi-lora-hat.js';
import type {Circuit} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';

test('rpi-lora-hat: model only, never fakes activity',()=>{
 const d=deviceRegistry.get('rpi-lora-hat')!;
 assert.equal(d.runtime,'not-emulated');assert.match(d.copy!.note!.en,/Not emulated/);assert.match(d.copy!.note!.id,/Tidak diemulasi/);
 const c:Circuit={wires:[],parts:[{id:'h1',kind:'rpi-lora-hat',net:{},props:{}}]};
 const noop=()=>undefined;
 const m=createModels(c,{setPin:noop,setAdc:noop,schedule:noop,now:()=>0}).get('h1')!;
 const s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext')assert.deepEqual(s.v,{runtime:'not-emulated',pinCount:14});
});
test('rpi-lora-hat: signal map from the community sources (v1.3+): NSS on GPIO25 (pin 22), DIO0 GPIO4, RESET GPIO17',()=>{
 const by=(role:string)=>HAT_PINS.find(p=>p.role===role)!;
 assert.deepEqual([by('NSS').key,by('NSS').header],['GPIO25',22]);
 assert.deepEqual([by('DIO0').key,by('DIO0').header],['GPIO4',7]);
 assert.deepEqual([by('RESET').key,by('RESET').header],['GPIO17',11]);
 assert.deepEqual([by('DIO1').key,by('DIO2').key],['GPIO23','GPIO24']);
 assert.deepEqual([by('MOSI').header,by('MISO').header,by('SCLK').header],[19,21,23]);
 assert.equal(by('antenna').header,null);
 // header order, no duplicated physical pin
 const nums=HAT_PINS.map(p=>p.header).filter((n):n is number=>n!==null);
 assert.deepEqual(nums,[...nums].sort((a,b)=>a-b));assert.equal(new Set(nums).size,nums.length);
 assert.deepEqual(deviceRegistry.get('rpi-lora-hat')!.pins,HAT_PINS.map(p=>p.key));
});
