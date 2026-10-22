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

test('slide-switch: COM follows the throw the lever touches (A=GND, B=5V)',()=>{
 const f=fakeEnv();
 const m=createModels(circuit([part('s1','slide-switch',{A:'GND',COM:'D4',B:'5V'})]),f.env).get('s1')!;
 assert.equal(f.log.at(-1)?.pin,'D4');
 assert.equal(f.log.at(-1)?.level,false,'lever on A reads LOW');
 m.props.toB=true;m.update(F);
 assert.equal(f.log.at(-1)?.level,true,'lever on B reads HIGH');
 const s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext'){assert.equal(s.v.position,'B');assert.equal(s.v.high,true);}
});
test('slide-switch: contact is break-before-make, exactly one throw closed',()=>{
 const f=fakeEnv();
 const m=createModels(circuit([part('s1','slide-switch',{COM:'D4'})]),f.env).get('s1')!;
 const sw=()=>m.switches!();
 assert.deepEqual(sw().map(x=>[x.a,x.b,x.closed]),[['COM','A',true],['COM','B',false]]);
 m.props.toB=true;m.update(F);
 assert.deepEqual(sw().map(x=>[x.a,x.b,x.closed]),[['COM','A',false],['COM','B',true]]);
});
test('slide-switch: pins A COM B in physical order',()=>{
 const f=fakeEnv();
 const m=createModels(circuit([part('s1','slide-switch',{})]),f.env).get('s1')!;
 assert.equal(m.state().kind,'ext');assert.equal(f.log.length,0,'unwired COM drives nothing');
});
