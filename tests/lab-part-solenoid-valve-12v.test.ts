import test from 'node:test';
import assert from 'node:assert/strict';
import type {Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';

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
import {createWorldModels,EMPTY} from '../apps/web/src/lab/sim/peripherals.js';
const bat=(charge:number,extra:Circuit['parts']=[],links:NonNullable<Circuit['links']>=[]):Circuit=>({wires:[],parts:[
 {id:'bat',kind:'battery-9v',net:{},props:{charge}},{id:'v',kind:'solenoid-valve-12v',net:{},props:{pressureKpa:200}},...extra],
 links:[{a:{part:'bat',pin:'PLUS'},b:{part:'v',pin:'+'},color:'red'},{a:{part:'bat',pin:'MINUS'},b:{part:'v',pin:'-'},color:'black'},...links]});
function run(c:Circuit,secs:number,props:Record<string,number>={}){
 const f=fakeEnv();
 const r=createWorldModels(c,f.env);
 Object.assign(r.models.get('v')!.props,props);
 for(let t=0;t<secs*100;t++)for(const m of r.models.values())m.update({samples:EMPTY(),dtSec:0.01,cycles:1});
 const s=r.models.get('v')!.state();
 return s.kind==='ext'?s.v:{};
}

test('solenoid-valve-12v: pins + and -, a desk prop',()=>{
 const f=fakeEnv();
 assert.ok(createModels({wires:[],parts:[{id:'v',kind:'solenoid-valve-12v',net:{},props:{}}]},f.env).get('v'));
});
test('solenoid-valve-12v: closed with no supply, open 0.15-0.3 s after the coil gets power (9.6 V here), coil current v/37.5',()=>{
 const none=run(bat(0),1);assert.equal(none.open,false);assert.equal(none.ma,0);
 const early=run(bat(100),0.1);assert.equal(early.open,false);assert.equal(early.reason,'opening');
 const on=run(bat(100),1);assert.equal(on.open,true);assert.equal(on.flowing,true);assert.equal(on.volts,9.6);assert.equal(on.ma,256);
});
test('solenoid-valve-12v: does not open below 20 kPa even with the coil on',()=>{
 const s=run(bat(100),1,{pressureKpa:10});
 assert.equal(s.open,false);assert.equal(s.flowing,false);assert.equal(s.reason,'low-pressure');assert.ok((s.ma as number)>200);
});
test('solenoid-valve-12v: below 6 V it does not pull in (low-voltage), shown on a 5 V regulator output',()=>{
 const c:Circuit={wires:[],parts:[{id:'bat',kind:'battery-9v',net:{},props:{charge:100}},{id:'reg',kind:'lm7805',net:{},props:{}},{id:'v',kind:'solenoid-valve-12v',net:{},props:{pressureKpa:200}}],
  links:[{a:{part:'bat',pin:'PLUS'},b:{part:'reg',pin:'IN'},color:'red'},{a:{part:'bat',pin:'MINUS'},b:{part:'reg',pin:'GND'},color:'black'},{a:{part:'reg',pin:'OUT'},b:{part:'v',pin:'+'},color:'red'},{a:{part:'reg',pin:'GND'},b:{part:'v',pin:'-'},color:'black'}]};
 const s=run(c,2);
 assert.equal(s.open,false);assert.equal(s.reason,'low-voltage');assert.equal(s.volts,5);
});
test('solenoid-valve-12v: flyback is true only when a diode spans the coil (anode on -, cathode on +)',()=>{
 assert.equal(run(bat(100),0.1).flyback,false);
 const d=[{id:'d1',kind:'diode',net:{},props:{}}];
 const wired=bat(100,d,[{a:{part:'d1',pin:'K'},b:{part:'v',pin:'+'},color:'red'},{a:{part:'d1',pin:'A'},b:{part:'v',pin:'-'},color:'black'}]);
 assert.equal(run(wired,0.1).flyback,true);
 const backwards=bat(100,d,[{a:{part:'d1',pin:'A'},b:{part:'v',pin:'+'},color:'red'},{a:{part:'d1',pin:'K'},b:{part:'v',pin:'-'},color:'black'}]);
 assert.equal(run(backwards,0.1).flyback,false,'a reversed diode conducts: it is not a flyback diode');
});
test('solenoid-valve-12v: through a relay, the valve follows the relay contact',()=>{
 const relay=(inNet:'GND'|'5V'):Circuit=>({wires:[],parts:[
  {id:'bat',kind:'battery-9v',net:{},props:{charge:100}},{id:'rl',kind:'relay-module',net:{VCC:'5V',IN:inNet},props:{}},{id:'v',kind:'solenoid-valve-12v',net:{},props:{pressureKpa:200}}],
  links:[{a:{part:'bat',pin:'PLUS'},b:{part:'rl',pin:'COM'},color:'red'},{a:{part:'rl',pin:'NO'},b:{part:'v',pin:'+'},color:'red'},{a:{part:'bat',pin:'MINUS'},b:{part:'v',pin:'-'},color:'black'}]});
 assert.equal(run(relay('GND'),1).open,true,'IN low energises the active-low relay');
 assert.equal(run(relay('5V'),1).open,false);
});
