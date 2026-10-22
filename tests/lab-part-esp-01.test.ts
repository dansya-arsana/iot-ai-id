import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {createWorldModels} from '../apps/web/src/lab/sim/peripherals.js';
import {AT_VERSION} from '../apps/web/src/lab/sim/devices/esp-01.js';

/** Fake board: a clock with scheduled callbacks; reply bytes land in `sent` with their cycle. */
function fakeEnv(){
 const events:{at:number;cb:()=>void}[]=[],sent:{b:number;at:number}[]=[],uart:((b:number,c:number)=>void)[]=[];
 let now=0;
 return {sent,uart,
  env:{
   setPin:(_p:UnoPin,_l:boolean)=>undefined,setAdc:()=>undefined,
   schedule:(c:number,cb:()=>void)=>{events.push({at:now+c,cb});events.sort((a,b)=>a.at-b.at);},now:()=>now,
   watchLine:()=>undefined,attachI2c:()=>undefined,attachSpi:()=>undefined,tapUart:(cb:(b:number,c:number)=>void)=>{uart.push(cb);},uartSend:(b:number)=>{sent.push({b,at:now});},
  },
  run(to:number){while(events.length&&events[0]!.at<=to){const e=events.shift()!;now=e.at;e.cb();}now=to;},
 };
}
const wired:Partial<Record<string,BoardPin>>={VCC:'3V3',GND:'GND',CH_PD:'3V3',TX:'D2',RX:'D3'};
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'e1',kind:'esp-01',net,props}]});
function rig(net=wired,props:Record<string,string|number|boolean>={}){
 const f=fakeEnv();
 const {models}=createWorldModels(circuit(net,props),f.env as never);
 const m=models.get('e1')!;
 const type=(s:string)=>{for(const ch of s)f.uart[0]!(ch.charCodeAt(0),0);};
 const text=()=>f.sent.map(x=>String.fromCharCode(x.b)).join('');
 const st=()=>{const s=m.state();assert.ok(s.kind==='ext');return s.kind==='ext'?s.v as Record<string,unknown>:{};};
 return {f,type,text,st};
}

test('esp-01: AT answers with echo, CR CR LF and OK',()=>{
 const r=rig();
 r.type('AT\r\n');r.f.run(5e6);
 assert.equal(r.text(),'AT\r\r\n\r\nOK\r\n');
 assert.equal(r.st().commands,1);
});
test('esp-01: replies are paced one 10-bit frame apart at the baud rate',()=>{
 const r=rig();
 r.type('AT\r');r.f.run(5e6);
 assert.equal(r.f.sent[1]!.at-r.f.sent[0]!.at,Math.round(10*16e6/9600));
 const r2=rig(wired,{baud:'115200'});r2.type('AT\r');r2.f.run(5e6);
 assert.equal(r2.f.sent[1]!.at-r2.f.sent[0]!.at,Math.round(10*16e6/115200));
});
test('esp-01: AT+GMR, AT+CWMODE query and set, bad mode',()=>{
 const r=rig();
 r.type('ATE0\r\n');r.f.run(5e6);const n0=r.text().length;
 r.type('AT+GMR\r\n');r.f.run(5e7);
 const gmr=r.text().slice(n0);
 assert.ok(gmr.includes(AT_VERSION)&&gmr.endsWith('OK\r\n'),gmr);
 const n1=r.text().length;
 r.type('AT+CWMODE=3\r\n');r.f.run(1e8);assert.equal(r.text().slice(n1),'\r\nOK\r\n');assert.equal(r.st().mode,3);
 const n2=r.text().length;
 r.type('AT+CWMODE?\r\n');r.f.run(2e8);assert.equal(r.text().slice(n2),'\r\n+CWMODE:3\r\nOK\r\n');
 const n3=r.text().length;
 r.type('AT+CWMODE=9\r\n');r.f.run(3e8);assert.equal(r.text().slice(n3),'\r\nERROR\r\n');assert.equal(r.st().mode,3);
});
test('esp-01: honest about Wi-Fi: no access points, join fails, unknown command errors',()=>{
 const r=rig();
 r.type('ATE0\r\n');r.f.run(5e6);const a=r.text().length;
 r.type('AT+CWLAP\r\n');r.f.run(1e8);assert.equal(r.text().slice(a),'\r\nOK\r\n');
 const b=r.text().length;
 r.type('AT+CWJAP="home","pw"\r\n');r.f.run(3e8);assert.match(r.text().slice(b),/FAIL/);
 const c=r.text().length;
 r.type('AT+FOO\r\n');r.f.run(5e8);assert.equal(r.text().slice(c),'\r\nERROR\r\n');
 assert.equal(r.st().wifi,'none');
});
test('esp-01: silent without 3.3 V, with CH_PD floating or low, or on 5 V',()=>{
 for(const net of [{...wired,VCC:undefined},{...wired,CH_PD:undefined},{...wired,CH_PD:'GND'},{...wired,VCC:'5V'}]){
  const r=rig(net as never);r.type('AT\r\n');r.f.run(5e6);
  assert.equal(r.f.sent.length,0,JSON.stringify(net));
 }
 assert.equal(rig().st().powered,true);
 assert.equal(rig({...wired,CH_PD:undefined} as never).st().enabled,false);
});
