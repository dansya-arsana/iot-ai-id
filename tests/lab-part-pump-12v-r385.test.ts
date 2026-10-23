import test from 'node:test';
import assert from 'node:assert/strict';
import type {Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';

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
import {createWorldModels,EMPTY} from '../apps/web/src/lab/sim/peripherals.js';
const bat=(charge:number):Circuit=>({wires:[],parts:[
 {id:'bat',kind:'battery-9v',net:{},props:{charge}},{id:'p',kind:'pump-12v-r385',net:{},props:{primed:true}}],
 links:[{a:{part:'bat',pin:'PLUS'},b:{part:'p',pin:'+'},color:'red'},{a:{part:'bat',pin:'MINUS'},b:{part:'p',pin:'-'},color:'black'}]});
const via=(inNet:'GND'|'5V'):Circuit=>({wires:[],parts:[
 {id:'bat',kind:'battery-9v',net:{},props:{charge:100}},{id:'rl',kind:'relay-module',net:{VCC:'5V',IN:inNet},props:{}},{id:'p',kind:'pump-12v-r385',net:{},props:{primed:true}}],
 links:[{a:{part:'bat',pin:'PLUS'},b:{part:'rl',pin:'COM'},color:'red'},{a:{part:'rl',pin:'NO'},b:{part:'p',pin:'+'},color:'red'},{a:{part:'bat',pin:'MINUS'},b:{part:'p',pin:'-'},color:'black'}]});
function run(c:Circuit,steps:number,props:Record<string,boolean>={}){
 const f=fakeEnv();
 const r=createWorldModels(c,f.env);
 Object.assign(r.models.get('p')!.props,props);
 const seen:Record<string,unknown>[]=[];
 for(let t=0;t<steps;t++){for(const m of r.models.values())m.update({samples:EMPTY(),dtSec:0.01,cycles:1});const s=r.models.get('p')!.state();if(s.kind==='ext')seen.push(s.v);}
 return seen;
}

test('pump-12v-r385: pins + and -, a desk prop',()=>{
 const f=fakeEnv();
 assert.ok(createModels({wires:[],parts:[{id:'p',kind:'pump-12v-r385',net:{},props:{}}]},f.env).get('p'));
});
test('pump-12v-r385: start surge for 100 ms, then loaded current; no power, no flow',()=>{
 const s=run(bat(100),60);
 assert.ok(s[1]!.surge,'surge right after power-up');assert.ok((s[1]!.ma as number)>1200,`surge ${s[1]!.ma} mA`);
 const end=s.at(-1)!;assert.equal(end.surge,false);assert.equal(end.ma,Math.round(0.6*9.6/12*1000));
 assert.ok((end.flowLmin as number)>0.5&&(end.flowLmin as number)<1.5);
 const off=run(bat(0),30).at(-1)!;assert.equal(off.flowLmin,0);assert.equal(off.ma,0);
});
test('pump-12v-r385: not primed it only moves air: no flow, no-load current, dry seconds count and then it overheats',()=>{
 const s=run(bat(100),3500,{primed:false}).at(-1)!;
 assert.equal(s.flowLmin,0);assert.equal(s.dryRun,true);assert.equal(s.ma,Math.round(0.23*9.6/12*1000));
 assert.ok((s.dryS as number)>30);assert.equal(s.overheated,true);
});
test('pump-12v-r385: a relay in the + line switches it',()=>{
 assert.ok((run(via('GND'),60).at(-1)!.flowLmin as number)>0.5);
 assert.equal(run(via('5V'),60).at(-1)!.flowLmin,0);
});
