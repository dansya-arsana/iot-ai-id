import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {EMPTY,createModels} from '../apps/web/src/lab/sim/peripherals.js';

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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'g1',kind:'mq2',net,props}]});

import {aoVolts,ratioForPpm} from '../apps/web/src/lab/sim/devices/mq2.js';
const run=(m:{update(f:never):void},seconds:number,dt=0.05)=>{for(let t=0;t<seconds-1e-9;t+=dt)m.update({samples:EMPTY(),dtSec:dt,cycles:0} as never);};
const st=(m:{state():unknown})=>(m.state() as unknown as {v:{volts:number;doLow:boolean;heat:number;ready:boolean}}).v;

test('mq2: curve: clean air is low, 1000 ppm LPG is about 3 V',()=>{
 assert.ok(aoVolts(ratioForPpm(0))<0.8);
 const v=aoVolts(ratioForPpm(1000));assert.ok(v>2.8&&v<3.6,String(v));
});
test('mq2: AO reaches the ADC only through the AO pin, rises with gas',()=>{
 const f=fakeEnv();const m=createModels(circuit({AO:'A0',DO:'D2'},{warmupS:5,ppm:0}),f.env).get('g1')!;
 run(m,30);const clean=f.adc.at(-1)!;assert.equal(m.analog?.()?.pin,'A0');
 m.props.ppm=2000;run(m,12);assert.ok(f.adc.at(-1)!>clean+1.5);
});
test('mq2: cold sensor reads high and drifts down while the heater warms up',()=>{
 const f=fakeEnv();const m=createModels(circuit({AO:'A0'},{warmupS:20,ppm:0}),f.env).get('g1')!;
 run(m,1);const early=st(m);assert.equal(early.ready,false);
 run(m,25);const late=st(m);assert.equal(late.ready,true);assert.ok(early.volts>late.volts*1.5);
});
test('mq2: DO is active low past the trimmer threshold and idles HIGH',()=>{
 const f=fakeEnv();const m=createModels(circuit({AO:'A0',DO:'D2'},{warmupS:1,ppm:0,threshold:512}),f.env).get('g1')!;
 run(m,10);assert.equal(f.log.filter(l=>l.pin==='D2').at(-1)?.level,true);
 m.props.ppm=3000;run(m,10);assert.equal(f.log.filter(l=>l.pin==='D2').at(-1)?.level,false);
 m.props.threshold=1023;run(m,2);assert.equal(f.log.filter(l=>l.pin==='D2').at(-1)?.level,true);
});
