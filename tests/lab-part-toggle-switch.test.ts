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

test('toggle-switch: closed joins A to B and B reads A level; open reads LOW',()=>{
 const f=fakeEnv();
 const m=createModels(circuit([part('t1','toggle-switch',{A:'5V',B:'D5'})]),f.env).get('t1')!;
 assert.deepEqual(f.log.at(-1),{pin:'D5',level:false,at:0},'starts open');
 m.props.on=true;m.update(F);
 assert.equal(f.log.at(-1)?.level,true);
 m.props.on=false;m.update(F);
 assert.equal(f.log.at(-1)?.level,false);
});
test('toggle-switch: a grounded A side reads LOW even when closed; contact declared',()=>{
 const f=fakeEnv();
 const m=createModels(circuit([part('t1','toggle-switch',{A:'GND',B:'D5'},{on:true})]),f.env).get('t1')!;
 assert.equal(f.log.at(-1)?.level,false);
 assert.deepEqual(m.switches!(),[{a:'A',b:'B',closed:true}]);
 m.props.on=false;m.update(F);assert.equal(m.switches!()[0]!.closed,false);
});
