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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'laser-ky0081',kind:'laser-ky008',net,props}]});

const state=(m:{state:()=>unknown})=>{const s=m.state() as {kind:string;v:Record<string,unknown>};assert.equal(s.kind,'ext');return s.v;};
const pwm=(d:number)=>{const samples=EMPTY();samples.D8={mode:'output',level:d>0.5?1:0,duty:d,freqHz:d>0&&d<1?490:0,highUs:0,analog:null};return {samples,dtSec:0.01,cycles:10};};

test('laser-ky008: HIGH on S lights the diode, LOW turns it off',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({SIG:'D8',VCC:'5V',GND:'GND'}),f.env).get('laser-ky0081')!;
 m.update(pwm(1));m.onEdge!('D8',1,5);
 let v=state(m);assert.equal(v.on,true);assert.equal(v.duty,1);assert.equal(v.ma,30);assert.equal(v.edges,1);
 m.update(pwm(0));m.onEdge!('D8',0,9);
 v=state(m);assert.equal(v.on,false);assert.equal(v.ma,0);assert.equal(v.edges,2);
});
test('laser-ky008: PWM dims it in proportion to duty',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({SIG:'D8',GND:'GND'}),f.env).get('laser-ky0081')!;
 m.update(pwm(0.25));
 const v=state(m);assert.equal(v.on,true);assert.equal(v.duty,0.25);assert.equal(v.ma,8);
});
test('laser-ky008: no ground wire means no light, and a signal on another pin does nothing',()=>{
 const f=fakeEnv();
 const noGnd=createModels(circuit({SIG:'D8',VCC:'5V'}),f.env).get('laser-ky0081')!;
 noGnd.update(pwm(1));assert.equal(state(noGnd).on,false);
 const other=createModels(circuit({SIG:'D9',GND:'GND'}),f.env).get('laser-ky0081')!;
 other.update(pwm(1));assert.equal(state(other).on,false,'D8 is not wired to S');
});
