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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'p1',kind:'arduino-nano',net,props}]});

test('arduino-nano: the model reports its chip and USB power and names the board id a circuit selects',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({},{usbPower:true}),f.env).get('p1')!;
 const v=(m.state() as unknown as {v:{chip:string;usbPower:boolean;board:string;analogOnly:string}}).v;
 assert.equal(v.chip,'ATmega328P');assert.equal(v.usbPower,true);assert.equal(v.board,'nano');assert.equal(v.analogOnly,'A6,A7');
 m.props.usbPower=false;assert.equal((m.state() as unknown as {v:{usbPower:boolean}}).v.usbPower,false);
});
test('arduino-nano: it is no longer flagged model-only (the Nano board runs); the ESP32 still is',async()=>{
 const {deviceRegistry}=await import('../apps/web/src/lab/sim/devices/index.js');
 assert.equal(deviceRegistry.get('arduino-nano')!.runtime,undefined);
 assert.equal(deviceRegistry.get('esp32-devkit')!.runtime,'not-emulated');
});
