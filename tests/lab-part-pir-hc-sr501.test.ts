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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'p1',kind:'pir-hc-sr501',net,props}]});

const tickS=(m:{update(f:never):void},s:number)=>{m.update({samples:EMPTY(),dtSec:s,cycles:0} as never);};
const run=(m:{update(f:never):void},seconds:number,dt=0.05)=>{for(let t=0;t<seconds-1e-9;t+=dt)tickS(m,dt);};
const last=(f:ReturnType<typeof fakeEnv>)=>f.log.at(-1)?.level;

test('pir: blind and LOW during the settling time, then sees motion',()=>{
 const f=fakeEnv();const m=createModels(circuit({OUT:'D4'},{warmupS:10,holdS:3}),f.env).get('p1')!;
 m.props.motion=true;
 run(m,9.5);assert.equal(last(f),false);assert.equal((m.state() as unknown as {v:{phase:string}}).v.phase,'warmup');
 run(m,1);assert.equal(last(f),true);
});
test('pir: jumper H restarts the hold time on every movement',()=>{
 const f=fakeEnv();const m=createModels(circuit({OUT:'D4'},{warmupS:0,holdS:4,retrigger:'H'}),f.env).get('p1')!;
 m.props.motion=true;run(m,0.1);assert.equal(last(f),true);
 run(m,10);assert.equal(last(f),true);               // still moving: stays HIGH past Th
 m.props.motion=false;run(m,3.5);assert.equal(last(f),true);
 run(m,1);assert.equal(last(f),false);                // Th after the LAST movement
});
test('pir: jumper L gives exactly Th, then a 2.5 s block, then triggers again',()=>{
 const f=fakeEnv();const m=createModels(circuit({OUT:'D4'},{warmupS:0,holdS:4,retrigger:'L'}),f.env).get('p1')!;
 m.props.motion=true;run(m,0.1);assert.equal(last(f),true);
 run(m,4);assert.equal(last(f),false);                // fell after Th although motion continues
 run(m,2);assert.equal(last(f),false);                // blocked
 run(m,1);assert.equal(last(f),true);                 // block over, motion still there
});
test('pir: a mover beyond the sensitivity range is not seen',()=>{
 const f=fakeEnv();const m=createModels(circuit({OUT:'D4'},{warmupS:0,rangeM:4}),f.env).get('p1')!;
 m.props.motion=true;m.props.distanceM=6;run(m,1);assert.equal(last(f),false);
 m.props.distanceM=3;run(m,0.2);assert.equal(last(f),true);
});
test('pir: OUT is the pin that moves (a wrong net changes the result)',()=>{
 const f=fakeEnv();const m=createModels(circuit({OUT:'D7'},{warmupS:0}),f.env).get('p1')!;
 m.props.motion=true;run(m,0.2);assert.ok(f.log.some(l=>l.pin==='D7'&&l.level));assert.ok(!f.log.some(l=>l.pin==='D4'));
});
