import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';

import type {I2cSlave} from '../apps/web/src/lab/sim/devices/types.js';

/** Minimal board: a clock with scheduled callbacks, pin logs and the shared-line / I2C / UART hooks. */
function fakeEnv(){
 const events:{at:number;cb:()=>void}[]=[];
 let now=0;
 const adc:number[]=[],log:{pin:UnoPin;level:boolean;at:number}[]=[],i2c:I2cSlave[]=[],uart:((b:number,c:number)=>void)[]=[],sent:number[]=[];
 return {adc,log,i2c,uart,sent,
  env:{
   setPin:(p:UnoPin,l:boolean)=>{log.push({pin:p,level:l,at:now});},setAdc:(_c:number,v:number)=>{adc.push(v);},
   schedule:(c:number,cb:()=>void)=>{events.push({at:now+c,cb});events.sort((a,b)=>a.at-b.at);},now:()=>now,
   watchLine:()=>undefined,attachI2c:(s:I2cSlave)=>{i2c.push(s);},tapUart:(cb:(b:number,c:number)=>void)=>{uart.push(cb);},uartSend:(b:number)=>{sent.push(b);},
  },
  at:(n:number)=>{now=n;},
  run(to:number){while(events.length&&events[0]!.at<=to){const e=events.shift()!;now=e.at;e.cb();}now=to;},
 };
}
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'esp32-devkit1',kind:'esp32-devkit',net,props}]});

test('esp32-devkit: device registers and answers its protocol',()=>{
  const f=fakeEnv();
  assert.ok(createModels(circuit({}),f.env).get('esp32-devkit1'));
});
import {ESP32_PINS,device} from '../apps/web/src/lab/sim/devices/esp32-devkit.js';

test('esp32-devkit: 38 unique pins, 19 per row, antenna-end first',()=>{
 assert.equal(ESP32_PINS.length,38);
 assert.equal(new Set(ESP32_PINS.map(p=>p.key)).size,38);
 assert.deepEqual(device.pins,ESP32_PINS.map(p=>p.key));
 for(const s of ['L','R'] as const)assert.deepEqual(ESP32_PINS.filter(p=>p.side===s).map(p=>p.idx),[...Array(19).keys()]);
});
test('esp32-devkit: pin map facts (input-only 34-39, strapping, flash)',()=>{
 const by=new Map(ESP32_PINS.map(p=>[p.gpio,p]));
 for(const g of [34,35,36,39])assert.equal(by.get(g)!.kind,'input-only');
 assert.deepEqual(ESP32_PINS.filter(p=>p.strap).map(p=>p.gpio).sort((a,b)=>a!-b!),[0,2,5,12,15]);
 assert.deepEqual(ESP32_PINS.filter(p=>p.kind==='flash').map(p=>p.gpio).sort((a,b)=>a!-b!),[6,7,8,9,10,11]);
 assert.equal(ESP32_PINS.filter(p=>p.touch!==undefined).length,10);
 assert.equal(ESP32_PINS.filter(p=>p.adc?.startsWith('ADC1')).length,6);
 assert.equal(ESP32_PINS.filter(p=>p.adc?.startsWith('ADC2')).length,10);
});
test('esp32-devkit: declares runtime not-emulated and never fakes pin activity',()=>{
 assert.equal((device as unknown as {runtime:string}).runtime,'not-emulated');
 const f=fakeEnv();
 const m=createModels(circuit({}),f.env).get('esp32-devkit1')!;
 const st=m.state() as {kind:string;v:{runtime:string}};
 assert.equal(st.kind,'ext');assert.equal(st.v.runtime,'not-emulated');
 assert.equal(f.log.length,0);
});
