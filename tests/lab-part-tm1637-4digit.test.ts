import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {readFileSync} from 'node:fs';
import type {FirmwareVariant,PartSpec} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/runner.js';
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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'tm1637-4digit1',kind:'tm1637-4digit',net,props}]});

import {keyByte} from '../apps/web/src/lab/sim/devices/tm1637-4digit.js';
const fixture=(n:string):{toolchain:string;variant:FirmwareVariant}=>JSON.parse(readFileSync(new URL(`./fixtures/firmware/${n}.json`,import.meta.url),'utf8'));
const part=(id:string,kind:string,net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):PartSpec=>({id,kind,net,props});
function boot(name:string,c:Circuit){
 const fx=fixture(name),r=createLabRunner();
 r.load(fx.variant,{},c,fx.toolchain);r.start();
 return r;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ext=(s:{kind:string}|undefined):Record<string,any>=>{assert.ok(s&&s.kind==='ext');return (s as unknown as {v:Record<string,unknown>}).v;};

/** Master side of the TM1637 bus on a fake board: edges are sent to the model with cycle stamps 40 cycles apart. */
function master(props:Record<string,string|number|boolean>={}){
 const f=fakeEnv();
 const m=createModels(circuit({CLK:'D2',DIO:'D3'},props),f.env).get('tm1637-4digit1')!;
 let t=0;
 const clk=(l:0|1)=>m.onEdge!('D2',l,t+=40),d=(l:0|1)=>{m.onEdge!('D3',l,t+=40);};
 const acks:boolean[]=[];
 const start=()=>{d(1);clk(1);d(0);clk(0);};
 const stop=()=>{clk(0);d(0);clk(1);d(1);};
 /** One byte LSB first, then the 9th clock: the slave's ACK is a low level that the board drives onto D3 (f.log). */
 const byte=(b:number)=>{
  for(let i=0;i<8;i++){clk(0);d(((b>>i)&1) as 0|1);clk(1);}
  f.log.length=0;clk(0);                       // falling edge of the 8th clock: ACK starts
  const a=f.log.at(-1);acks.push(a?.pin==='D3'&&a.level===false);
  clk(1);clk(0);                               // 9th clock: ACK released on its falling edge
  assert.equal(f.log.at(-1)?.level,true);
 };
 const v=()=>ext(m.state());
 return {f,m,start,stop,byte,acks,v,clk,d,time:()=>t};
}

test('tm1637-4digit: START, 0x40 data command, address command and four digit bytes are ACKed and stored LSB first',()=>{
 const b=master();
 b.start();b.byte(0x40);b.stop();
 b.start();b.byte(0xc0);b.byte(0x06);b.byte(0x5b|0x80);b.byte(0x4f);b.byte(0x66);b.stop();
 assert.deepEqual(b.acks,[true,true,true,true,true,true],'every byte is acknowledged');
 const s=b.v();
 assert.equal(s.seg,'06db4f660000');assert.equal(s.text,'1234');assert.equal(s.mode,'auto');
 assert.equal(s.frames,2);assert.equal(s.stops,2);assert.equal(s.bytes,6);assert.equal(s.on,false,'nothing lights before the display-control command');
 assert.equal(s.duty,0);
});
test('tm1637-4digit: display control sets on and the brightness pulse width table (1,2,4,10,11,12,13,14 of 16)',()=>{
 const want=[1,2,4,10,11,12,13,14];
 for(let i=0;i<8;i++){
  const b=master();b.start();b.byte(0x88|i);b.stop();
  const s=b.v();assert.equal(s.on,true);assert.equal(s.bright,i);assert.equal(s.duty,want[i]!/16);
 }
 const off=master();off.start();off.byte(0x80|5);off.stop();
 assert.equal(ext(off.m.state()).on,false);assert.equal(ext(off.m.state()).duty,0);
});
test('tm1637-4digit: auto increment wraps from address 5 to 0; address 6 and 7 are invalid',()=>{
 const b=master();
 b.start();b.byte(0x40);b.stop();
 b.start();b.byte(0xc4);b.byte(0x11);b.byte(0x22);b.byte(0x33);b.stop();     // 4, 5, then wraps to 0
 assert.equal(b.v().seg,'330000001122');
 b.start();b.byte(0xc6);b.byte(0x77);b.stop();
 const s=b.v();assert.equal(s.invalid,1);assert.equal(s.ignored,1,'data after a bad address is not stored');
});
test('tm1637-4digit: fixed address mode takes one data byte per address command',()=>{
 const b=master();
 b.start();b.byte(0x44);b.stop();
 b.start();b.byte(0xc2);b.byte(0x5b);b.byte(0xff);b.stop();                 // second data byte is not stored
 const s=b.v();assert.equal(s.mode,'fixed');assert.equal(s.seg,'00005b000000');assert.equal(s.ignored,1);
 b.start();b.byte(0xc3);b.byte(0x4f);b.stop();
 assert.equal(b.v().seg,'00005b4f0000');
});
test('tm1637-4digit: unknown commands are counted; bytes outside a frame do nothing',()=>{
 const b=master();
 b.start();b.byte(0x01);b.stop();
 b.start();b.byte(0x41);b.stop();                                           // data-command pattern with a reserved low nibble
 assert.equal(b.v().invalid,2);
 // clocks without START: nothing is decoded
 for(let i=0;i<9;i++){b.clk(0);b.d(1);b.clk(1);}
 assert.equal(b.v().bytes,2);
});
test('tm1637-4digit: colon is the DP of digit 2 on the clock layout; the decimal layout shows plain dots',()=>{
 const clock=master();clock.start();clock.byte(0xc1);clock.byte(0x80);clock.stop();
 assert.equal(clock.v().colon,true);
 const dec=master({layout:'decimal'});dec.start();dec.byte(0xc1);dec.byte(0x80);dec.stop();
 assert.equal(dec.v().colon,false);assert.equal(dec.v().layout,'decimal');
});
test('tm1637-4digit: key scan byte table (K1/K2 by SG1..SG8, 0xFF idle)',()=>{
 assert.equal(keyByte(0),0xff);assert.equal(keyByte(17),0xff);
 assert.equal(keyByte(1),0xf7);assert.equal(keyByte(2),0xf6);assert.equal(keyByte(8),0xf0);
 assert.equal(keyByte(9),0xef);assert.equal(keyByte(16),0xe8);
});
test('tm1637-4digit: reading the key scan: the chip answers LSB first on falling edges, bit 0 right after the ACK',()=>{
 const b=master({key:3});
 b.start();b.byte(0x42);
 // after the 9th falling edge the line carries bit 0 of 0xF5 (= 1)
 assert.equal(b.f.log.at(-1)?.pin,'D3');
 const bits:number[]=[];
 for(let i=0;i<8;i++){
  if(i>0)b.clk(0);
  b.clk(1);
  bits.push(b.f.log.at(-1)!.level?1:0);        // what the master reads while CLK is high: the line the board holds for the slave
 }
 assert.equal(bits.reduce((a,v,i)=>a|v<<i,0),keyByte(3));
 b.stop();
 assert.equal(b.v().keyReads,1);
});
test('tm1637-4digit: real firmware drives it: acks, digits, colon, brightness 3 and the key byte read back',()=>{
 const r=boot('tm1637-display',{wires:[],parts:[part('t','tm1637-4digit',{CLK:'D2',DIO:'D3'},{key:3})]});
 r.advance(400);
 const out=r.serialText();
 assert.match(out,/acks=7/,out);assert.match(out,/key=0xF5/,out);
 const s=ext(r.snapshot().parts.t);
 assert.equal(s.text,'1234');assert.equal(s.colon,true);assert.equal(s.bright,3);assert.equal(s.duty,10/16);assert.equal(s.on,true);
 assert.equal(s.invalid,0);assert.equal(s.seg,'06db4f660000');
});
test('tm1637-4digit: with no key the real firmware reads 0xFF; a part on the wrong pins shows nothing',()=>{
 const r=boot('tm1637-display',{wires:[],parts:[part('t','tm1637-4digit',{CLK:'D2',DIO:'D3'})]});
 r.advance(400);assert.match(r.serialText(),/key=0xFF/,r.serialText());
 const w=boot('tm1637-display',{wires:[],parts:[part('t','tm1637-4digit',{CLK:'D7',DIO:'D8'})]});
 w.advance(400);const s=ext(w.snapshot().parts.t);assert.equal(s.frames,0);assert.equal(s.on,false);
});
