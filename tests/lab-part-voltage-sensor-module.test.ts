import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {EMPTY,createModels,createWorldModels} from '../apps/web/src/lab/sim/peripherals.js';

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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'vs',kind:'voltage-sensor-module',net,props}]});
const step=(m:{update(fr:never):void}):void=>m.update({samples:EMPTY(),dtSec:0.001,cycles:1} as never);

test('voltage-sensor-module: the 30 k / 7.5 k divider gives Vin / 5 (25 V reads 5 V)',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({S:'A0',GND:'GND'},{probe:12}),f.env).get('vs')!;
 assert.ok(Math.abs(f.adc.at(-1)!-2.4)<1e-9,'12 V probe');
 for(const [v,o] of [[0,0],[5,1],[25,5],[7.4,1.48]] as const){m.props.probe=v;step(m);assert.ok(Math.abs(f.adc.at(-1)!-o)<1e-9,`${v} V -> ${f.adc.at(-1)}`);}
});
test('voltage-sensor-module: above 25 V the pin is held at 5 V and the part says over',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({S:'A0',GND:'GND'},{probe:30}),f.env).get('vs')!;
 assert.equal(f.adc.at(-1),5);
 const s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext'){assert.equal(s.v.over,true);assert.equal(s.v.vin,30);assert.equal(s.v.probe,true);}
});
test('voltage-sensor-module: a wired VIN+ measures the real net (a 9 V battery through the terminal), not the probe',()=>{
 const f=fakeEnv();
 const c:Circuit={wires:[],parts:[
  {id:'bat',kind:'battery-9v',net:{},props:{charge:100}},{id:'vs',kind:'voltage-sensor-module',net:{S:'A0',GND:'GND'},props:{probe:3}},
 ],links:[{a:{part:'bat',pin:'PLUS'},b:{part:'vs',pin:'VIN+'},color:'red'},{a:{part:'bat',pin:'MINUS'},b:{part:'vs',pin:'VIN-'},color:'black'}]};
 const r=createWorldModels(c,f.env);
 for(const m of r.models.values())step(m);
 const s=r.models.get('vs')!.state();assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.equal(s.v.probe,false);assert.ok(Math.abs(Number(s.v.vin)-9.6)<0.01,String(s.v.vin));assert.ok(Math.abs(Number(s.v.vout)-1.92)<0.01);}
 assert.ok(Math.abs(f.adc.at(-1)!-1.92)<0.01);
});
test('voltage-sensor-module: an unwired S writes nothing',()=>{
 const f=fakeEnv();
 createModels(circuit({GND:'GND'}),f.env);
 assert.equal(f.adc.length,0);
});
