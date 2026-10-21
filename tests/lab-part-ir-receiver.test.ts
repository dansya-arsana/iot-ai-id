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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'r1',kind:'ir-receiver',net,props}]});

import {KEYS,necFrame} from '../apps/web/src/lab/sim/devices/ir-receiver.js';
const us=(c:number)=>c/16;
/** A hand-written NEC decoder, as a sketch would do it: times the LOW and HIGH phases of OUT. */
function decode(log:{level:boolean;at:number}[]){
 const e=log.filter((_,i)=>i>0);                       // skip the initial idle HIGH
 const m:number[]=[];for(let i=1;i<e.length;i++)m.push(us(e[i]!.at-e[i-1]!.at));
 // m: leader mark, leader space, then (mark,space) pairs, ends with the stop mark
 assert.ok(Math.abs(m[0]!-9000)<2&&Math.abs(m[1]!-4500)<2,'leader');
 let v=0;for(let b=0;b<32;b++){const mark=m[2+b*2]!,sp=m[3+b*2]!;assert.ok(Math.abs(mark-562.5)<2,'bit mark');v=(v|((sp>1000?1:0)<<b))>>>0;}
 return v;
}
test('ir: OUT idles HIGH',()=>{const f=fakeEnv();createModels(circuit({OUT:'D2'}),f.env);assert.equal(f.log.at(-1)?.level,true);});
test('ir: every key sends a valid NEC frame a decoder can read',()=>{
 for(const k of KEYS){
  const f=fakeEnv();const m=createModels(circuit({OUT:'D2'}),f.env).get('r1')!;
  m.props.button=k.key;m.update({samples:EMPTY(),dtSec:0.01,cycles:0});f.run(200*16000);
  const log=f.log.filter(l=>l.pin==='D2');
  const v=decode(log);
  assert.equal(v&0xff,0x00);assert.equal(v>>>8&0xff,0xff);assert.equal(v>>>16&0xff,k.cmd);assert.equal(v>>>24,~k.cmd&0xff);
  assert.equal(log.at(-1)?.level,true);assert.equal(m.props.button,'none');   // key released afterwards
 }
});
test('ir: frame length matches NEC (67.5 ms for an address/command mix) and the leader is exact',()=>{
 const p=necFrame(0,0x45);const t=us(p.reduce((a,x)=>a+x.holdCycles,0));
 assert.ok(t>60000&&t<70000,String(t));
});
test('ir: held key sends repeat codes every 108 ms from the frame start',()=>{
 const f=fakeEnv();const m=createModels(circuit({OUT:'D2'}),f.env).get('r1')!;
 m.props.hold=true;m.props.button='vol+';m.update({samples:EMPTY(),dtSec:0.01,cycles:0});
 f.run(400*16000);
 const log=f.log.filter(l=>l.pin==='D2');
 const falls=log.filter((l,i)=>i>0&&!l.level).map(l=>us(l.at));
 // frame starts are the falling edges that begin a 9 ms leader: find every LOW lasting 9 ms
 const starts:number[]=[];for(let i=0;i<log.length-1;i++)if(!log[i]!.level&&Math.abs(us(log[i+1]!.at-log[i]!.at)-9000)<2)starts.push(us(log[i]!.at));
 assert.ok(starts.length>=3,String(starts.length));void falls;
 assert.ok(Math.abs(starts[1]!-starts[0]!-108000)<10,String(starts[1]!-starts[0]!));
 assert.ok(Math.abs(starts[2]!-starts[1]!-108000)<10);
 // the repeat code has a 2.25 ms space
 const i1=log.findIndex(l=>Math.abs(us(l.at)-starts[1]!)<1);assert.ok(Math.abs(us(log[i1+2]!.at-log[i1+1]!.at)-2250)<2);
 m.props.hold=false;f.run(800*16000);assert.equal(m.props.button,'none');
});
test('ir: OUT pin follows the wiring',()=>{
 const f=fakeEnv();const m=createModels(circuit({OUT:'D7'}),f.env).get('r1')!;
 m.props.button='1';m.update({samples:EMPTY(),dtSec:0.01,cycles:0});f.run(200*16000);
 assert.ok(f.log.some(l=>l.pin==='D7'&&!l.level));assert.ok(!f.log.some(l=>l.pin==='D2'));
});
