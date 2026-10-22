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

import type {PinSample} from '../apps/web/src/lab/contract.js';
const driven=(pins:string[],duty=1)=>{const s=EMPTY() as Record<string,PinSample>;for(const p of pins)s[p]={...s[p]!,mode:'output',duty};return {samples:s as never,dtSec:0.01,cycles:1};};
const bar=(props:Record<string,string|number|boolean>={})=>circuit([part('b1','led-bar-10',{A1:'D2',A2:'D3',A3:'D4',A4:'D5',K:'GND'},props)]);
test('led-bar-10: driving D2..D4 HIGH fills three segments from the bottom',()=>{
 const f=fakeEnv();const m=createModels(bar(),f.env).get('b1')!;
 m.update(driven(['D2','D3','D4']));
 const s=m.state();assert.ok(s.kind==='ext');if(s.kind!=='ext')return;
 assert.equal(s.v.lit,3);assert.equal(s.v.level,3);assert.ok((s.v.s1 as number)>0.5);assert.equal(s.v.s4,0);
 assert.ok(Math.abs((s.v.totalMa as number)-3*(5-2.2)/220*1000)<0.5,'(5 V - Vf) / R per segment');
});
test('led-bar-10: a gap breaks the unbroken level but not the lit count; PWM dims',()=>{
 const f=fakeEnv();const m=createModels(bar(),f.env).get('b1')!;
 m.update(driven(['D2','D4']));
 let s=m.state();if(s.kind==='ext'){assert.equal(s.v.lit,2);assert.equal(s.v.level,1);}
 m.update(driven(['D2'],0.5));
 s=m.state();if(s.kind==='ext'){assert.ok((s.v.s1 as number)<0.7&&(s.v.s1 as number)>0.2);}
});
test('led-bar-10: K must reach ground: K on a high pin kills the current; a small resistor flags over-current',()=>{
 const f=fakeEnv();
 const hi=createModels(circuit([part('b1','led-bar-10',{A1:'D2',K:'D6'})]),f.env).get('b1')!;
 hi.update(driven(['D2','D6']));
 let s=hi.state();if(s.kind==='ext')assert.equal(s.v.lit,0);
 const low=createModels(bar({seriesOhms:68}),f.env).get('b1')!;
 low.update(driven(['D2']));
 s=low.state();if(s.kind==='ext')assert.equal(s.v.over,true);
});
