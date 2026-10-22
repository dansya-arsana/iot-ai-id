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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'hall-a31441',kind:'hall-a3144',net,props}]});
import {BOP,BRP,fieldAt} from '../apps/web/src/lab/sim/devices/hall-a3144.js';
const tickN=(m:{update(f:never):void},ms:number)=>m.update({samples:EMPTY(),dtSec:ms/1000,cycles:1} as never);

test('hall-a3144: idle level is HIGH (pull-up), south magnet pulls SIG LOW with hysteresis',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({SIG:'D4'}),f.env).get('hall-a31441')!;
 assert.deepEqual(f.log.at(-1),{pin:'D4',level:true,at:0});
 // distance where B crosses BOP: 2500*(5/(5+d))^3 = 70
 const dOp=5*Math.cbrt(2500/BOP)-5,dRel=5*Math.cbrt(2500/BRP)-5;
 assert.ok(dRel>dOp);
 m.props.distance=dOp-0.5;tickN(m,16);
 assert.equal(f.log.at(-1)?.level,false);
 // between operate and release distance: stays ON (hysteresis)
 m.props.distance=(dOp+dRel)/2;tickN(m,16);
 assert.equal(f.log.at(-1)?.level,false);
 m.props.distance=dRel+0.5;tickN(m,16);
 assert.equal(f.log.at(-1)?.level,true);
 const s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext'){assert.equal(s.v.active,false);assert.equal(s.v.high,true);}
});
test('hall-a3144: a north pole never operates it, even touching',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({SIG:'D4'},{pole:'north',distance:0}),f.env).get('hall-a31441')!;
 tickN(m,16);
 assert.equal(f.log.at(-1)?.level,true);
 assert.ok(fieldAt(0,'north')<0);
 m.props.pole='south';tickN(m,16);
 assert.equal(f.log.at(-1)?.level,false);
});
test('hall-a3144: field falls with distance and the signal goes to the wired pin only',()=>{
 assert.ok(fieldAt(5,'south')>fieldAt(10,'south'));
 assert.ok(fieldAt(40,'south')<BRP);
 const f=fakeEnv();
 createModels(circuit({SIG:'D7'}),f.env);
 assert.ok(f.log.every(e=>e.pin==='D7'));
 const g=fakeEnv();
 const m=createModels(circuit({}),g.env).get('hall-a31441')!;
 m.props.distance=0;tickN(m,16);
 assert.equal(g.log.length,0,'unwired SIG drives nothing');
 const s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext')assert.equal(s.v.active,true);
});
