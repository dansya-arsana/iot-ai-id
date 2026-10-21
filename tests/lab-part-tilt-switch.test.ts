import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';

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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'tilt-switch1',kind:'tilt-switch',net,props}]});

test('tilt-switch: upright SIG low, tilted SIG high, state follows props',()=>{
 const f=fakeEnv();
 const circ=circuit({SIG:'D4'});
 const m=createModels(circ,f.env).get('tilt-switch1')!;
 assert.deepEqual(f.log.at(-1),{pin:'D4',level:false,at:0});
 m.props.tilted=true;
 m.update({dtSec:0,cycles:0} as never);
 assert.deepEqual(f.log.at(-1),{pin:'D4',level:true,at:0});
 const n=f.log.length;m.update({dtSec:0,cycles:0} as never);assert.equal(f.log.length,n,'no redrive without a change');
 const s=m.state();assert.ok(s.kind==='ext');
 if(s.kind==='ext')assert.equal(s.v.tilted,true);
});
