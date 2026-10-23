import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';

import type {I2cSlave,SpiBinding} from '../apps/web/src/lab/sim/devices/types.js';

/** Minimal board: a clock with scheduled callbacks, pin logs and the shared-line / I2C / UART hooks. */
function fakeEnv(){
 const events:{at:number;cb:()=>void}[]=[];
 let now=0;
 const adc:number[]=[],log:{pin:UnoPin;level:boolean;at:number}[]=[],i2c:I2cSlave[]=[],spi:SpiBinding[]=[],uart:((b:number,c:number)=>void)[]=[],sent:number[]=[];
 return {adc,log,i2c,spi,uart,sent,
  env:{
   setPin:(p:UnoPin,l:boolean)=>{log.push({pin:p,level:l,at:now});},setAdc:(_c:number,v:number)=>{adc.push(v);},
   schedule:(c:number,cb:()=>void)=>{events.push({at:now+c,cb});events.sort((a,b)=>a.at-b.at);},now:()=>now,
   watchLine:()=>undefined,attachI2c:(s:I2cSlave)=>{i2c.push(s);},attachSpi:(s:SpiBinding)=>{spi.push(s);},tapUart:(cb:(b:number,c:number)=>void)=>{uart.push(cb);},uartSend:(b:number)=>{sent.push(b);},
  },
  at:(n:number)=>{now=n;},
  run(to:number){while(events.length&&events[0]!.at<=to){const e=events.shift()!;now=e.at;e.cb();}now=to;},
 };
}
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'esp32-s3-devkitc1',kind:'esp32-s3-devkitc',net,props}]});

test('esp32-s3-devkitc: device registers and answers its protocol',()=>{
  const f=fakeEnv();
  assert.ok(createModels(circuit({}),f.env).get('esp32-s3-devkitc1'));
});
test('esp32-s3-devkitc: pins (desk prop)',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({}),f.env).get('esp32-s3-devkitc1');
 assert.ok(m);assert.equal(m!.state().kind,'ext');   // add: one assertion per pin you wired (a wrong net must change the result)
});

import {S3_PINS,s3Pins,device as s3} from '../apps/web/src/lab/sim/devices/esp32-s3-devkitc.js';
import {PartRecordSchema as S3Schema} from '../packages/catalog/index.js';
import {readFileSync as readS3} from 'node:fs';

test('esp32-s3-devkitc: 44 unique pins, 22 per header, in order',()=>{
 assert.equal(S3_PINS.length,44);assert.equal(new Set(S3_PINS.map(p=>p.key)).size,44);
 for(const h of ['J1','J3'] as const)assert.deepEqual(S3_PINS.filter(p=>p.hdr===h).map(p=>p.n),[...Array(22).keys()].map(i=>i+1));
 assert.deepEqual(s3.pins,S3_PINS.map(p=>p.key));
});
test('esp32-s3-devkitc: documented J1/J3 facts',()=>{
 const at=(h:'J1'|'J3',n:number)=>S3_PINS.find(p=>p.hdr===h&&p.n===n)!;
 assert.equal(at('J1',1).key,'3V3_1');assert.equal(at('J1',3).key,'RST');assert.equal(at('J1',4).gpio,4);assert.equal(at('J1',8).gpio,15);assert.equal(at('J1',21).key,'5V');
 assert.equal(at('J3',2).key,'TX');assert.equal(at('J3',2).gpio,43);assert.equal(at('J3',3).gpio,44);assert.equal(at('J3',10).gpio,38);assert.equal(at('J3',14).gpio,0);
 assert.equal(at('J3',19).fn,'USB_D+');assert.equal(at('J3',20).fn,'USB_D-');
 assert.deepEqual(S3_PINS.filter(p=>p.strap).map(p=>p.gpio).sort((a,b)=>a!-b!),[0,3,45,46]);
});
test('esp32-s3-devkitc: GPIO35-37 are flash on octal-PSRAM modules only',()=>{
 for(const [m,flash] of [['n8',false],['n8r8',true],['n16r8',true],['n32r16v',true]] as const){
  const k=s3Pins(m).filter(p=>p.gpio===35||p.gpio===36||p.gpio===37).map(p=>p.kind);
  assert.deepEqual(k,[flash?'flash':'io',flash?'flash':'io',flash?'flash':'io'],m);
 }
 const mod=s3.inputs.find(i=>i.key==='module')!;assert.ok(mod.type==='choice'&&mod.default==='n8r8');
 assert.equal(s3.runtime,'not-emulated');
 const r=S3Schema.parse(JSON.parse(readS3(new URL('../packages/catalog/data/esp32-s3-devkitc.json',import.meta.url),'utf8')));
 assert.equal(r.identity.id,'esp32-s3-devkitc');assert.ok(r.pins.length>=44);
});
