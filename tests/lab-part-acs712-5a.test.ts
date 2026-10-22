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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'cs',kind:'acs712-5a',net,props}]});
const WIRED={VCC:'5V',OUT:'A0',GND:'GND'} as const;
const step=(f:ReturnType<typeof fakeEnv>,m:{update(fr:never):void}):void=>m.update({samples:EMPTY(),dtSec:0.001,cycles:1} as never);

test('acs712-5a: zero current rests at VCC/2 = 2.5 V (512 counts), 185 mV per amp either way',()=>{
 const f=fakeEnv();
 const m=createModels(circuit(WIRED,{amps:0}),f.env).get('cs')!;
 assert.equal(f.adc.at(-1),2.5);
 for(const [a,v] of [[1,2.685],[5,3.425],[-1,2.315],[-5,1.575],[2.5,2.9625]] as const){
  m.props.amps=a;step(f,m);
  assert.ok(Math.abs(f.adc.at(-1)!-v)<1e-9,`${a} A -> ${f.adc.at(-1)}`);
 }
 const s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext'){assert.equal(s.v.counts,Math.round(2.9625/5*1023));assert.equal(s.v.saturated,false);}
});
test('acs712-5a: the transfer is ratiometric to the supply (3.3 V rail: 1.65 V rest, 122.1 mV/A)',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({VCC:'3V3',OUT:'A0',GND:'GND'},{amps:2}),f.env).get('cs')!;
 assert.ok(Math.abs(f.adc.at(-1)!-(1.65+2*0.185*3.3/5))<1e-9);
 const s=m.state();assert.ok(s.kind==='ext'&&s.v.vcc===3.3);
});
test('acs712-5a: an unwired VCC means no output at all, and an unwired OUT writes nothing',()=>{
 const f=fakeEnv();
 createModels(circuit({OUT:'A0',GND:'GND'},{amps:1}),f.env);
 assert.equal(f.adc.length,0,'no supply, nothing on the pin');
 const g=fakeEnv();
 createModels(circuit({VCC:'5V',GND:'GND'},{amps:1}),g.env);
 assert.equal(g.adc.length,0);
});
test('acs712-5a: output follows the wired pin (A1 and the Nano A6 resolve through analogPin)',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({VCC:'5V',OUT:'A1',GND:'GND'},{amps:-2}),f.env).get('cs')!;
 const a=m.analog?.();assert.equal(a?.pin,'A1');assert.equal(a?.adc,Math.round((2.5-0.37)/5*1023));
 const n=createModels(circuit({VCC:'5V',OUT:'A6',GND:'GND'},{amps:0}),fakeEnv().env).get('cs')!;
 assert.equal(n.analog?.()?.pin,'A6');
});
test('acs712-5a: the chip saturates 0.2 V from the rails (a mis-set 12 A)',async()=>{
 const {acs712Out}=await import('../apps/web/src/lab/sim/devices/acs712-5a.js');
 const hi=acs712Out(5,20),lo=acs712Out(5,-20);
 assert.deepEqual([hi.vout,hi.saturated,lo.vout,lo.saturated],[4.8,true,0.2,true]);
});
test('acs712-5a: IP+ and IP- are one copper path, so the sensor can sit in series (battery to lamp)',()=>{
 const f=fakeEnv();
 const c:Circuit={wires:[],parts:[
  {id:'bat',kind:'battery-9v',net:{},props:{charge:100}},{id:'cs',kind:'acs712-5a',net:{VCC:'5V',OUT:'A0',GND:'GND'},props:{amps:1}},{id:'ld',kind:'load-lamp',net:{},props:{}},
 ],links:[
  {a:{part:'bat',pin:'PLUS'},b:{part:'cs',pin:'IP+'},color:'red'},{a:{part:'cs',pin:'IP-'},b:{part:'ld',pin:'+'},color:'red'},
  {a:{part:'ld',pin:'-'},b:{part:'bat',pin:'MINUS'},color:'black'},
 ]};
 const r=createWorldModels(c,f.env);
 for(const m of r.models.values())step(f,m);
 assert.equal(r.world.volts('ld','+'),r.world.volts('bat','PLUS'),'the lamp sees the battery through the sensor');
 assert.ok(r.world.volts('ld','+')!>9,'about 9.6 V');
});
