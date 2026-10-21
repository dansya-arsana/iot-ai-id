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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'p1',kind:'battery-aa-4',net,props}]});

import {aaVolts} from '../apps/web/src/lab/sim/devices/battery-aa-4.js';
test('battery-aa-4: four cells in series, 6.4 V fresh and 3.6 V empty',()=>{
 assert.ok(Math.abs(aaVolts(100)*4-6.4)<1e-9);assert.ok(Math.abs(aaVolts(0)*4-3.6)<1e-9);
 let prev=Infinity;for(let c=100;c>=0;c--){const v=aaVolts(c);assert.ok(v<=prev+1e-9);prev=v;}
});
test('battery-aa-4: switch off reads 0 V',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({PLUS:'VIN',MINUS:'GND'},{charge:100,on:true}),f.env).get('p1')!;
 assert.equal((m.state() as unknown as {v:{volts:number}}).v.volts,6.4);
 m.props.on=false;assert.equal((m.state() as unknown as {v:{volts:number}}).v.volts,0);
});
