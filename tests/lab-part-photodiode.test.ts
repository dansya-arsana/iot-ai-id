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
const circuit=(parts:Circuit['parts']):Circuit=>({wires:[],parts});
const part=(id:string,kind:string,net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={})=>({id,kind,net,props});
const F={samples:EMPTY(),dtSec:0.01,cycles:1};

import type {PinSample} from '../apps/web/src/lab/contract.js';
const parts=(d:number,duty:number,load=100)=>{
 const f=fakeEnv();
 const m=createModels(circuit([part('i1','ir-led',{A:'D3',C:'GND'},{seriesOhms:150}),part('p1','photodiode',{SIG:'A0',VCC:'5V',GND:'GND'},{distanceCm:d,loadKohm:load,ambientMwCm2:0})]),f.env);
 const s=EMPTY() as Record<string,PinSample>;s.D3={...s.D3!,mode:'output',duty};
 m.get('i1')!.update({samples:s as never,dtSec:0.01,cycles:1});
 const p=m.get('p1')!;p.update(F);
 return {f,p};
};
const volts=(p:ReturnType<typeof parts>['p'])=>{const s=p.state();return s.kind==='ext'?s.v.volts as number:NaN;};
test('photodiode: voltage = photocurrent x load, with E = intensity / d^2 (BPW34 70 uA per mW/cm2)',()=>{
 const {p}=parts(10,1);
 const mw=30*((5-1.3)/150*1000)/50;                 // mW/sr from the ir-led
 const expect=(70*(mw/100)+0.002)*1e-6*100e3;
 assert.ok(Math.abs(volts(p)-expect)<0.02,String(volts(p))+' vs '+expect);
});
test('photodiode: inverse-square falloff and dark with the LED off',()=>{
 const near=volts(parts(5,1).p),far=volts(parts(10,1).p),off=volts(parts(10,0).p);
 assert.ok(Math.abs(near/far-4)<0.15,'half the distance, four times the signal');
 assert.ok(off<0.001);
});
test('photodiode: ADC follows SIG and clamps to the supply',()=>{
 const {f,p}=parts(1,1,1000);
 const s=p.state();assert.ok(s.kind==='ext');if(s.kind==='ext'){assert.equal(s.v.saturated,true);assert.equal(s.v.volts,5);}
 const a=p.analog!();assert.equal(a?.pin,'A0');assert.equal(a?.adc,1023);void f;
});
