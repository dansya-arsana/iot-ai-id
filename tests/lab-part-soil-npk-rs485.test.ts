import test from 'node:test';
import assert from 'node:assert/strict';
import type {UnoPin} from '../apps/web/src/lab/contract.js';
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
import {NPK_DEFAULTS,NPK_EXAMPLE_REQUEST,NPK_REGISTER_MAPS,SOIL_NPK_PINS,npkRaw,npkReadResponse} from '../apps/web/src/lab/sim/devices/soil-npk-rs485.js';
import {deviceRegistry} from '../apps/web/src/lab/sim/devices/index.js';
import {decodeModbus,modbusCrc16} from '../apps/web/src/lab/sim/devices/max485.js';

test('soil-npk-rs485: the example N/P/K request carries a valid CRC (checked with the MAX485 CRC function)',()=>{
 assert.deepEqual([...NPK_EXAMPLE_REQUEST],[0x01,0x03,0x00,0x1e,0x00,0x03,0x65,0xcd]);
 assert.equal(modbusCrc16(NPK_EXAMPLE_REQUEST.slice(0,6)),0xcd65);
 assert.equal(decodeModbus(NPK_EXAMPLE_REQUEST)?.crcOk,true);
});
test('soil-npk-rs485: jxct reply for N, P, K holds the three values with a valid CRC',()=>{
 const r=npkReadResponse(NPK_REGISTER_MAPS['jxct-7in1'],NPK_DEFAULTS,1,NPK_EXAMPLE_REQUEST)!;
 assert.deepEqual(r.slice(0,9),[1,3,6,0,48,0,22,0,130]);
 assert.equal(r.length,11);assert.equal(decodeModbus(r)?.crcOk,true);
 assert.equal(npkReadResponse(NPK_REGISTER_MAPS['jxct-7in1'],NPK_DEFAULTS,2,NPK_EXAMPLE_REQUEST),null);   // another address: no reply
});
test('soil-npk-rs485: scaling, negative temperature and the cwt map differ',()=>{
 const j=NPK_REGISTER_MAPS['jxct-7in1'],w=NPK_REGISTER_MAPS['cwt-thcph'];
 assert.equal(npkRaw(j,'ph',{...NPK_DEFAULTS,ph:6.5}),650);
 assert.equal(npkRaw(j,'temperature',{...NPK_DEFAULTS,temperature:-2.5}),0x10000-25);
 const r=npkReadResponse(w,NPK_DEFAULTS,1,[1,3,0,0,0,2,0,0])!;   // moisture and temperature, x10
 assert.deepEqual(r.slice(2,7),[4,0x01,0x45,0x00,0xf8]);
});
test('soil-npk-rs485: model only, four cable pins and the state says so',()=>{
 const f=fakeEnv();
 const def=deviceRegistry.get('soil-npk-rs485')!;
 assert.equal(def.runtime,'not-emulated');
 assert.deepEqual(def.pins,SOIL_NPK_PINS.map(p=>p.key));
 assert.equal(def.holes,undefined);
 const m=createModels({wires:[],parts:[{id:'p1',kind:'soil-npk-rs485',net:{},props:{map:'cwt-thcph'}}]},f.env).get('p1')!;
 const s=m.state();assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.equal(s.v.runtime,'not-emulated');assert.equal(s.v.map,'cwt-thcph');assert.equal(s.v.address,1);assert.equal(s.v.baud,4800);}
 assert.equal(f.uart.length,0);   // never fakes pin or bus activity
});
