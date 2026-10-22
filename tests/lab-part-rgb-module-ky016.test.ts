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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'rgb-module-ky0161',kind:'rgb-module-ky016',net,props}]});

const state=(m:{state:()=>unknown})=>{const s=m.state() as {kind:string;v:Record<string,unknown>};assert.equal(s.kind,'ext');return s.v;};
const duties=(d:Partial<Record<UnoPin,number>>)=>{const samples=EMPTY();for(const [p,v] of Object.entries(d))samples[p as UnoPin]={mode:'output',level:v!>0.5?1:0,duty:v!,freqHz:490,highUs:0,analog:null};return {samples,dtSec:0.01,cycles:10};};

test('rgb-module-ky016: each colour pin sets its own channel',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({R:'D9',G:'D10',B:'D11',GND:'GND'}),f.env).get('rgb-module-ky0161')!;
 m.update(duties({D9:1,D10:0.5,D11:0}));
 const v=state(m);assert.equal(v.r,1);assert.equal(v.g,0.5);assert.equal(v.b,0);assert.equal(v.freqHz,490);
});
test('rgb-module-ky016: current follows (5 V - Vf) / 150 ohm per colour',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({R:'D9',G:'D10',B:'D11',GND:'GND'}),f.env).get('rgb-module-ky0161')!;
 m.update(duties({D9:1}));assert.equal(state(m).ma,20);          // (5-2)/150
 m.update(duties({D10:1}));assert.equal(state(m).ma,13);         // (5-3)/150
 m.update(duties({D9:1,D10:1,D11:1}));assert.equal(state(m).ma,47);
});
test('rgb-module-ky016: the minus pin must be on ground, and an unwired colour stays dark',()=>{
 const f=fakeEnv();
 const noGnd=createModels(circuit({R:'D9',G:'D10',B:'D11'}),f.env).get('rgb-module-ky0161')!;
 noGnd.update(duties({D9:1,D10:1,D11:1}));
 const v=state(noGnd);assert.equal(v.r,0);assert.equal(v.ma,0);
 const onlyG=createModels(circuit({G:'D10',GND:'GND'}),f.env).get('rgb-module-ky0161')!;
 onlyG.update(duties({D9:1,D10:1}));
 const w=state(onlyG);assert.equal(w.r,0);assert.equal(w.g,1);
});
