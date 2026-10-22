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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'rain-sensor1',kind:'rain-sensor',net,props}]});

import {aoVolts,plateKohm} from '../apps/web/src/lab/sim/devices/rain-sensor.js';

const HZ=16_000_000;
const frame=(sec=0.001)=>({samples:EMPTY(),dtSec:sec,cycles:Math.round(sec*HZ)});
const mk=(f:ReturnType<typeof fakeEnv>,props:Record<string,string|number|boolean>={})=>createModels(circuit({AO:'A0',DO:'D2'},props),f.env).get('rain-sensor1')!;
const doLevel=(f:ReturnType<typeof fakeEnv>)=>f.log.filter(e=>e.pin==='D2').at(-1)?.level;

test('rain-sensor: dry plate reads the supply on AO and DO is HIGH',()=>{
 const f=fakeEnv(),m=mk(f);
 m.update(frame());
 assert.equal(f.adc.at(-1),5);
 assert.equal(doLevel(f),true);
});
test('rain-sensor: plate resistance and AO follow the divider with the 10 kohm pull-up',()=>{
 assert.equal(plateKohm(0),Infinity);assert.equal(plateKohm(100),2);assert.equal(plateKohm(50),4);
 assert.ok(Math.abs(aoVolts(5,100)-5*2/12)<1e-9);
 assert.ok(Math.abs(aoVolts(5,50)-5*4/14)<1e-9);
});
test('rain-sensor: wet plate settles to the divider voltage after the lag and DO goes LOW',()=>{
 const f=fakeEnv(),m=mk(f,{wetness:100});
 for(let i=0;i<10;i++)m.update(frame(0.5));         // 5 s >> 0.4 s time constant
 assert.ok(Math.abs(f.adc.at(-1)!-aoVolts(5,100))<1e-9);
 assert.equal(doLevel(f),false);
});
test('rain-sensor: the plate does not wet instantly (first-order lag)',()=>{
 const f=fakeEnv(),m=mk(f,{wetness:0});
 m.props.wetness=100;                                // rain starts after the part exists
 m.update(frame(0.4));                               // one time constant: 63 % of the way
 const cov=(m.state() as unknown as {v:{wetness:number}}).v.wetness;
 assert.ok(cov>60&&cov<66,`${cov}`);
 assert.ok(f.adc.at(-1)!<5&&f.adc.at(-1)!>aoVolts(5,100));
});
test('rain-sensor: drying brings AO back up and DO HIGH',()=>{
 const f=fakeEnv(),m=mk(f,{wetness:100});
 for(let i=0;i<10;i++)m.update(frame(0.5));
 m.props.wetness=0;
 for(let i=0;i<20;i++)m.update(frame(0.5));
 assert.equal(f.adc.at(-1),5);assert.equal(doLevel(f),true);
});
test('rain-sensor: trimmer sets how wet it must be before DO falls',()=>{
 const f=fakeEnv(),m=mk(f,{wetness:30,threshold:300});   // 30 % -> 6.67 kohm -> 2.0 V, reference 1.47 V
 for(let i=0;i<10;i++)m.update(frame(0.5));
 assert.equal(doLevel(f),true);
 m.props.threshold=700;                                   // reference 3.42 V
 m.update(frame());
 assert.equal(doLevel(f),false);
});
test('rain-sensor: unwired pins do nothing',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({},{wetness:80}),f.env).get('rain-sensor1')!;
 m.update(frame());
 assert.equal(f.adc.length,0);assert.equal(f.log.length,0);
});
