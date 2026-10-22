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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'flame-sensor1',kind:'flame-sensor',net,props}]});

import {aoVolts,flameIr,flicker} from '../apps/web/src/lab/sim/devices/flame-sensor.js';

const HZ=16_000_000;
const frame=(cycles=16)=>({samples:EMPTY(),dtSec:cycles/HZ,cycles});
const mk=(f:ReturnType<typeof fakeEnv>,props:Record<string,string|number|boolean>={})=>createModels(circuit({AO:'A0',DO:'D2'},props),f.env).get('flame-sensor1')!;
const doLevel=(f:ReturnType<typeof fakeEnv>)=>f.log.filter(e=>e.pin==='D2').at(-1)?.level;

test('flame-sensor: no flame reads the supply on AO and DO stays HIGH',()=>{
 const f=fakeEnv(),m=mk(f);
 m.update(frame());
 assert.equal(f.adc.at(-1),5);
 assert.equal(doLevel(f),true);
});
test('flame-sensor: flame pulls AO down with the divider law and DO goes LOW',()=>{
 const f=fakeEnv(),m=mk(f,{lit:true,distanceCm:20});
 f.at(0);m.update(frame());
 const exp=aoVolts(5,flameIr(20)*flicker(0));
 assert.ok(Math.abs(f.adc.at(-1)!-exp)<1e-9);
 assert.ok(exp<1.2,`${exp}`);
 assert.equal(doLevel(f),false);
});
test('flame-sensor: farther flame reads higher, inverse-square',()=>{
 assert.equal(flameIr(10),1);assert.equal(flameIr(20),1);
 assert.ok(Math.abs(flameIr(40)-0.25)<1e-9);assert.ok(Math.abs(flameIr(80)-0.0625)<1e-9);
 assert.ok(aoVolts(5,0.25)>aoVolts(5,1));
});
test('flame-sensor: flame flickers, so AO moves over time at a fixed distance',()=>{
 const f=fakeEnv(),m=mk(f,{lit:true,distanceCm:40});
 const seen=new Set<number>();
 for(let i=0;i<8;i++){f.at(i*160000);m.update(frame());seen.add(Math.round(f.adc.at(-1)!*1000));}
 assert.ok(seen.size>4,`only ${seen.size} distinct values`);
 assert.equal(flicker(0),1+0.05*Math.sin(1.3));
});
test('flame-sensor: sunlight alone also lowers AO (the classic false alarm)',()=>{
 const f=fakeEnv(),m=mk(f,{ambient:60});
 m.update(frame());
 assert.ok(Math.abs(f.adc.at(-1)!-aoVolts(5,0.6))<1e-9);
});
test('flame-sensor: trimmer moves the DO switch point (hysteresis-free LM393)',()=>{
 const f=fakeEnv(),m=mk(f,{ambient:20,threshold:200});   // AO = 5/(1+3)=1.25 V, reference 0.98 V
 m.update(frame());assert.equal(doLevel(f),true);
 m.props.threshold=300;m.update(frame());                // reference 1.47 V
 assert.equal(doLevel(f),false);
});
test('flame-sensor: unwired AO and DO do nothing',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({},{lit:true,distanceCm:10}),f.env).get('flame-sensor1')!;
 m.update(frame());
 assert.equal(f.adc.length,0);assert.equal(f.log.length,0);
});
