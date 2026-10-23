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
import {NE555_MIN_V,SOIL_V2_DRY_V,SOIL_V2_WET_V,soilV2Volts} from '../apps/web/src/lab/sim/devices/soil-capacitive-v2.js';
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'s1',kind:'soil-capacitive-v2',net,props}]});

test('soil-capacitive-v2: dry reads high, wet reads low, linear in between',()=>{
 assert.equal(soilV2Volts(0),SOIL_V2_DRY_V);assert.equal(soilV2Volts(100),SOIL_V2_WET_V);
 const f=fakeEnv();
 const m=createModels(circuit({AOUT:'A0',VCC:'5V',GND:'GND'},{wetness:0}),f.env).get('s1')!;
 m.update({samples:EMPTY(),dtSec:0.01,cycles:1});
 assert.equal(f.adc.at(-1),SOIL_V2_DRY_V);
 m.props.wetness=100;m.update({samples:EMPTY(),dtSec:0.01,cycles:2});
 assert.equal(f.adc.at(-1),SOIL_V2_WET_V);
 m.props.wetness=50;m.update({samples:EMPTY(),dtSec:0.01,cycles:3});
 assert.ok(Math.abs(f.adc.at(-1)!-(SOIL_V2_DRY_V+SOIL_V2_WET_V)/2)<1e-9);
});
test('soil-capacitive-v2: an NE555 clone on 3.3 V sticks near the dry value and flags the fault',()=>{
 assert.ok(NE555_MIN_V>3.3);
 const f=fakeEnv();
 const m=createModels(circuit({AOUT:'A0',VCC:'3V3',GND:'GND'},{wetness:100,timer:'ne555'}),f.env).get('s1')!;
 m.update({samples:EMPTY(),dtSec:0.01,cycles:1});
 assert.equal(f.adc.at(-1),SOIL_V2_DRY_V);
 const s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext'){assert.equal(s.v.fault,'ne555-3v3');assert.equal(s.v.wetness,100);}
 // same board on 5 V, or a TLC555 on 3.3 V, follows the soil
 const g=fakeEnv();
 const n=createModels(circuit({AOUT:'A0',VCC:'5V',GND:'GND'},{wetness:100,timer:'ne555'}),g.env).get('s1')!;
 n.update({samples:EMPTY(),dtSec:0.01,cycles:1});assert.equal(g.adc.at(-1),SOIL_V2_WET_V);
 const h=fakeEnv();
 const t=createModels(circuit({AOUT:'A0',VCC:'3V3',GND:'GND'},{wetness:100,timer:'tlc555'}),h.env).get('s1')!;
 t.update({samples:EMPTY(),dtSec:0.01,cycles:1});assert.equal(h.adc.at(-1),SOIL_V2_WET_V);
});
test('soil-capacitive-v2: AOUT wiring matters (unwired pin drives nothing)',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({}),f.env).get('s1')!;
 m.update({samples:EMPTY(),dtSec:0.01,cycles:1});
 assert.equal(f.adc.length,0);
});
