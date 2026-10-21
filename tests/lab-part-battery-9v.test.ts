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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'p1',kind:'battery-9v',net,props}]});

import {pp3Volts} from '../apps/web/src/lab/sim/devices/battery-9v.js';
test('battery-9v: discharge curve is monotonic from 9.6 V to 6.0 V',()=>{
 assert.equal(pp3Volts(100),9.6);assert.equal(pp3Volts(0),6);
 let prev=Infinity;for(let c=100;c>=0;c--){const v=pp3Volts(c);assert.ok(v<=prev+1e-9);prev=v;}
});
test('battery-9v: state follows the charge prop',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({PLUS:'VIN',MINUS:'GND'},{charge:100}),f.env).get('p1')!;
 assert.equal((m.state() as unknown as {v:{volts:number}}).v.volts,9.6);
 m.props.charge=0;
 const s=(m.state() as unknown as {v:{volts:number;on:boolean}}).v;assert.equal(s.volts,6);assert.equal(s.on,false);
});
