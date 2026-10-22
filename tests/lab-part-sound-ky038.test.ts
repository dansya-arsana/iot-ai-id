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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'sound-ky0381',kind:'sound-ky038',net,props}]});

import {clapEnv,FULL_SCALE_V} from '../apps/web/src/lab/sim/devices/sound-ky038.js';

const HZ=16_000_000;
const frame=(cycles:number)=>({samples:EMPTY(),dtSec:cycles/HZ,cycles});
const mk=(f:ReturnType<typeof fakeEnv>,props:Record<string,string|number|boolean>={})=>createModels(circuit({AO:'A0',DO:'D2'},props),f.env).get('sound-ky0381')!;

test('sound-ky038: silence sits at half the supply (512) on AO',()=>{
 const f=fakeEnv(),m=mk(f);
 m.update(frame(16));
 assert.equal(f.adc.at(-1),2.5);
 f.at(5714);m.update(frame(16));
 assert.equal(f.adc.at(-1),2.5);
});
test('sound-ky038: AO swings around the bias with the loudness at the exact tone phase',()=>{
 const f=fakeEnv(),m=mk(f,{loudness:50});
 const quarter=Math.round(HZ/700/4);            // sin peaks a quarter period in
 f.at(quarter);m.update(frame(16));
 assert.ok(Math.abs(f.adc.at(-1)!-(2.5+0.5*FULL_SCALE_V))<0.002,`peak ${f.adc.at(-1)}`);
 f.at(3*quarter);m.update(frame(16));
 assert.ok(Math.abs(f.adc.at(-1)!-(2.5-0.5*FULL_SCALE_V))<0.002,`trough ${f.adc.at(-1)}`);
});
test('sound-ky038: AO is clipped inside the rails',()=>{
 const f=fakeEnv(),m=mk(f,{loudness:100});
 f.at(Math.round(HZ/700/4));m.update(frame(16));
 assert.ok(f.adc.at(-1)!<=4.95+1e-9&&f.adc.at(-1)!>4.6);
});
test('sound-ky038: DO is a pulse train at the tone with edges at the exact comparator crossings',()=>{
 const f=fakeEnv(),m=mk(f,{loudness:100,threshold:640});
 f.log.length=0;
 m.update(frame(16000));                          // 1 ms window from cycle 0
 f.run(16000);
 const thr=640/1023*5,d=thr-2.5,a=FULL_SCALE_V,P=HZ/700;
 const p1=Math.asin(d/a)/(2*Math.PI),p2=(Math.PI-Math.asin(d/a))/(2*Math.PI);
 const evs=f.log.filter(e=>e.pin==='D2');
 assert.equal(evs[0]!.level,true);assert.equal(evs[0]!.at,Math.round(P*p1));
 assert.equal(evs[1]!.level,false);assert.equal(evs[1]!.at,Math.round(P*p2));
 assert.ok(evs.length>=1);
});
test('sound-ky038: quiet room never raises DO, a raised trimmer stops it',()=>{
 const f=fakeEnv(),m=mk(f,{loudness:0});
 f.log.length=0;m.update(frame(160000));f.run(160000);
 assert.equal(f.log.filter(e=>e.pin==='D2'&&e.level).length,0);
 const g=fakeEnv(),n=mk(g,{loudness:20,threshold:1000});   // amplitude 0.44 V cannot reach 4.9 V
 g.log.length=0;n.update(frame(160000));g.run(160000);
 assert.equal(g.log.filter(e=>e.pin==='D2'&&e.level).length,0);
});
test('sound-ky038: clap burst peaks at once and decays with the 60 ms constant',()=>{
 assert.equal(clapEnv(-1),0);assert.equal(clapEnv(0),1);
 assert.ok(Math.abs(clapEnv(Math.round((0.002+0.06)*HZ))-Math.exp(-1))<1e-3);
 const f=fakeEnv(),m=mk(f);
 m.props.clap=true;m.update(frame(16));
 assert.equal(m.props.clap,false);                // the button releases itself
 const s=m.state();assert.equal(s.kind,'ext');
 assert.equal((s as unknown as {v:{level:number}}).v.level,100);
 f.at(Math.round(HZ*0.5));
 assert.ok((m.state() as unknown as {v:{level:number}}).v.level<1);   // gone after 0.5 s
});
test('sound-ky038: a wrong net changes the result (AO unwired, DO unwired)',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({},{loudness:100}),f.env).get('sound-ky0381')!;
 f.at(4000);m.update(frame(16));
 assert.equal(f.adc.length,0);                    // no AO pin: nothing pushed
 assert.equal(f.log.length,0);
});
