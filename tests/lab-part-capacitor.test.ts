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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'p1',kind:'capacitor',net,props}]});

const CPU=16e6;
test('capacitor: charges toward 5 V with tau=R*C (63% at one tau)',()=>{
 const f=fakeEnv();
 const env={...f.env,pinLevel:()=>1 as const,pinMode:()=>'output' as const};
 const m=createModels(circuit({POS:'A0',NEG:'GND'},{uF:100,rOhms:10000,variant:'electrolytic'}),env as never).get('p1')!;
 // tau = 10k * 100uF = 1 s; run 1 s in 100 slices
 for(let i=0;i<100;i++)m.update({samples:EMPTY(),dtSec:0.01,cycles:CPU/100});
 const v=(m.state() as unknown as {v:{volts:number}}).v.volts;
 assert.ok(Math.abs(v-5*(1-Math.exp(-1)))<0.05,String(v));
 assert.ok(Math.abs(f.adc.at(-1)!-v)<0.05);
});
test('capacitor: released pin holds charge, ceramic leaks far less than electrolytic',()=>{
 const run=(variant:string)=>{
  const f=fakeEnv();let drive=true;
  const env={...f.env,pinLevel:()=>1 as const,pinMode:()=>(drive?'output':'input') as 'output'|'input'};
  const m=createModels(circuit({POS:'A0',NEG:'GND'},{uF:10,rOhms:100,variant}),env as never).get('p1')!;
  for(let i=0;i<50;i++)m.update({samples:EMPTY(),dtSec:0.01,cycles:CPU/100});
  drive=false;
  for(let i=0;i<400;i++)m.update({samples:EMPTY(),dtSec:0.1,cycles:CPU/10});   // 40 s released
  return (m.state() as unknown as {v:{volts:number}}).v.volts;
 };
 const el=run('electrolytic'),ce=run('ceramic');
 assert.ok(el<3&&el>1,String(el));   // 5 V * exp(-1)
 assert.ok(ce>4.9,String(ce));
});
test('capacitor: a digital pin sees the voltage as a level with hysteresis; unwired POS does nothing',()=>{
 const f=fakeEnv();let drive=true;
 const env={...f.env,pinLevel:()=>1 as const,pinMode:()=>(drive?'output':'input') as 'output'|'input'};
 const m=createModels(circuit({POS:'D3',NEG:'GND'},{uF:1,rOhms:1000}),env as never).get('p1')!;
 for(let i=0;i<10;i++)m.update({samples:EMPTY(),dtSec:0.01,cycles:CPU/100});
 drive=false;m.update({samples:EMPTY(),dtSec:0.001,cycles:CPU/1000});
 assert.equal(f.log.at(-1)?.pin,'D3');assert.equal(f.log.at(-1)?.level,true);
 const u=createModels(circuit({}),f.env).get('p1')!;
 u.update({samples:EMPTY(),dtSec:0.1,cycles:CPU/10});
 assert.equal((u.state() as unknown as {v:{volts:number}}).v.volts,0);
});
