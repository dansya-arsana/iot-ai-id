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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'reed-switch1',kind:'reed-switch',net,props}]});
import {BOUNCE_US,PULL_IN,DROP_OUT} from '../apps/web/src/lab/sim/devices/reed-switch.js';
const tickN=(m:{update(f:never):void},ms:number)=>m.update({samples:EMPTY(),dtSec:ms/1000,cycles:1} as never);
const NET={VCC:'5V',SIG:'D4',GND:'GND'} as Partial<Record<string,BoardPin>>;

test('reed-switch: open reads LOW, a magnet along the glass closes it with a bounce train',()=>{
 const f=fakeEnv();
 const m=createModels(circuit(NET),f.env).get('reed-switch1')!;
 assert.deepEqual(f.log.at(-1),{pin:'D4',level:false,at:0});
 f.log.length=0;
 f.at(1000);m.props.distance=3;tickN(m,16);
 f.run(1000+16*400);
 // five transitions: up, chatter down, up, chatter down, settled up; each at the cumulative hold of the previous step
 assert.deepEqual(f.log.map(e=>e.level),[true,false,true,false,true]);
 let t=1000;const want=[t];
 for(const [,h] of BOUNCE_US.slice(0,-1)){t+=h*16;want.push(t);}
 assert.deepEqual(f.log.map(e=>e.at),want);
 const s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext'){assert.equal(s.v.closed,true);assert.equal(s.v.high,true);assert.equal(s.v.bouncing,false);}
});
test('reed-switch: hysteresis, release is clean and happens at the drop-out field',()=>{
 const f=fakeEnv();
 const m=createModels(circuit(NET),f.env).get('reed-switch1')!;
 m.props.distance=0;tickN(m,16);f.run(16*1000);
 const dIn=5*Math.cbrt(2500/PULL_IN)-5,dOut=5*Math.cbrt(2500/DROP_OUT)-5;
 assert.ok(dOut>dIn);
 f.log.length=0;
 m.props.distance=(dIn+dOut)/2;tickN(m,16);f.run(16*2000);
 assert.equal(f.log.length,0,'still closed inside the hysteresis band');
 m.props.distance=dOut+0.5;f.at(16*3000);tickN(m,16);
 assert.deepEqual(f.log.map(e=>e.level),[false]);
});
test('reed-switch: a magnet across the glass needs to be much closer',()=>{
 const f=fakeEnv();
 const m=createModels(circuit(NET,{orient:'across'}),f.env).get('reed-switch1')!;
 m.props.distance=8;tickN(m,16);f.run(16*1000);
 let s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext')assert.equal(s.v.closed,false);
 m.props.orient='along';tickN(m,16);f.run(16*2000);
 s=m.state();if(s.kind==='ext')assert.equal(s.v.closed,true);
});
test('reed-switch: without VCC power SIG stays LOW even when closed; the contact joins VCC and SIG',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({SIG:'D4',GND:'GND'},{distance:0}),f.env).get('reed-switch1')!;
 tickN(m,16);f.run(16*1000);
 assert.ok(f.log.every(e=>e.level===false));
 assert.deepEqual(m.switches?.(),[{a:'VCC',b:'SIG',closed:true}]);
 const s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext')assert.equal(s.v.high,false);
});
