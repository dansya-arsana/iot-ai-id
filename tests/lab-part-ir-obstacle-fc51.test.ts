import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {EMPTY,createModels} from '../apps/web/src/lab/sim/peripherals.js';

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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'ir-obstacle-fc511',kind:'ir-obstacle-fc51',net,props}]});

import {reach,signalAt} from '../apps/web/src/lab/sim/devices/ir-obstacle-fc51.js';

const frame=()=>({samples:EMPTY(),dtSec:0.001,cycles:16000});
const mk=(f:ReturnType<typeof fakeEnv>,props:Record<string,string|number|boolean>={})=>createModels(circuit({OUT:'D2'},props),f.env).get('ir-obstacle-fc511')!;
const out=(f:ReturnType<typeof fakeEnv>)=>f.log.filter(e=>e.pin==='D2').at(-1)?.level;

test('ir-obstacle-fc51: nothing in front keeps OUT HIGH',()=>{
 const f=fakeEnv();mk(f);
 assert.equal(out(f),true);
});
test('ir-obstacle-fc51: an object inside the trimmer range pulls OUT LOW, outside releases it',()=>{
 const f=fakeEnv(),m=mk(f,{rangeCm:12,distanceCm:10});
 m.update(frame());assert.equal(out(f),false);
 m.props.distanceCm=13;m.update(frame());assert.equal(out(f),true);
 m.props.distanceCm=12;m.update(frame());assert.equal(out(f),false);   // exactly at the reach: signal equals reference
});
test('ir-obstacle-fc51: reflected signal falls with the square of distance',()=>{
 assert.equal(signalAt(12,12,'white'),1);
 assert.equal(signalAt(24,12,'white'),0.25);
 assert.equal(signalAt(60,12,'white'),0);          // 60 cm = no object
});
test('ir-obstacle-fc51: a black surface is seen later (shorter reach) than a white one',()=>{
 assert.ok(reach(20,'black')<reach(20,'wood')&&reach(20,'wood')<reach(20,'white'));
 const f=fakeEnv(),m=mk(f,{rangeCm:20,distanceCm:10,surface:'white'});
 m.update(frame());assert.equal(out(f),false);
 m.props.surface='black';m.update(frame());assert.equal(out(f),true);   // black reach = 20 x sqrt(0.12) = 6.9 cm
 m.props.distanceCm=6;m.update(frame());assert.equal(out(f),false);
});
test('ir-obstacle-fc51: trimmer widens the reach',()=>{
 const f=fakeEnv(),m=mk(f,{rangeCm:5,distanceCm:15});
 m.update(frame());assert.equal(out(f),true);
 m.props.rangeCm=25;m.update(frame());assert.equal(out(f),false);
});
test('ir-obstacle-fc51: strong sunlight reads as an obstacle even with none there',()=>{
 const f=fakeEnv(),m=mk(f,{distanceCm:60,sunlight:true});
 m.update(frame());assert.equal(out(f),false);
 const s=m.state() as unknown as {v:{detected:boolean}};assert.equal(s.v.detected,true);
});
test('ir-obstacle-fc51: OUT unwired drives nothing',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({},{distanceCm:3}),f.env).get('ir-obstacle-fc511')!;
 m.update(frame());assert.equal(f.log.length,0);
});
