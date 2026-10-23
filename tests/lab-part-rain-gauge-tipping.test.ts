import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels,EMPTY} from '../apps/web/src/lab/sim/peripherals.js';

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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'rain-gauge-tipping1',kind:'rain-gauge-tipping',net,props}]});
const CPMS=16000;
const frame=(cycles:number)=>({samples:EMPTY(),dtSec:cycles/16e6,cycles});

test('rain-gauge-tipping: idles high, one tip = one closure of about 100 ms with 2 or 4 bounce edges in the first millisecond',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({SIG:'D2'}),f.env).get('rain-gauge-tipping1')!;
 assert.equal(f.log.at(-1)?.level,true,'INPUT_PULLUP idle level');
 const base=f.log.length;
 m.props.tip="tip";m.update(frame(1));
 f.run(200*CPMS);
 const ev=f.log.slice(base);
 const first=ev[0]!;assert.equal(first.level,false);
 const within=ev.filter(e=>e.at-first.at<CPMS&&e!==first);
 assert.ok(within.length===2||within.length===4,`bounce edges ${within.length}`);
 const last=ev.at(-1)!;assert.equal(last.level,true);
 const lowMs=(last.at-first.at)/CPMS;assert.ok(lowMs>95&&lowMs<105,`closure ${lowMs} ms`);
 const s=m.state();assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.equal(s.v.tips,1);assert.equal(s.v.mm,0.2794);assert.equal(s.v.closed,false);}
});
test('rain-gauge-tipping: rate 100 mm/h gives one tip per 10.06 s of simulated time',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({SIG:'D2'},{rate:100}),f.env).get('rain-gauge-tipping1')!;
 const sec=16e6;
 for(let t=0;t<60;t++){m.update(frame(sec));f.run((t+1)*sec);}
 const s=m.state();assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.equal(s.v.tips,5);assert.ok(Math.abs((s.v.mm as number)-1.397)<1e-3);assert.equal(s.v.rate,100);}
});
test('rain-gauge-tipping: mmPerTip is a prop and a second tap is a second tip',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({SIG:'D2'},{mmPerTip:0.5}),f.env).get('rain-gauge-tipping1')!;
 for(let i=0;i<2;i++){m.props.tip='tip';m.update(frame(1));m.props.tip='idle';m.update(frame(1));f.run(f.env.now()+200*CPMS);}
 const s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext'){assert.equal(s.v.tips,2);assert.equal(s.v.mm,1);}
});
