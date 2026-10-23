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
import {decodeModbus,modbusCrc16,modbusFrame,parseHex} from '../apps/web/src/lab/sim/devices/max485.js';
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'m1',kind:'max485',net,props}]});
const req=[0x01,0x03,0x00,0x1e,0x00,0x03,0x65,0xcd];
const sendAll=(f:ReturnType<typeof fakeEnv>,bytes:number[],start:number,gap:number)=>bytes.forEach((b,i)=>f.uart[0]!(b,start+i*gap));
const CHAR=Math.round(11/9600*16e6);

test('max485: CRC-16/MODBUS matches the known N/P/K request and frames round-trip',()=>{
 assert.equal(modbusCrc16(req.slice(0,6)),0xcd65);
 assert.deepEqual(modbusFrame(req.slice(0,6)),req);
 assert.deepEqual(parseHex('01 03 0x00,1E 00 03 65 CD'),req);
 assert.equal(parseHex('zz'),null);
});
test('max485: bytes sent with the driver off are counted and never reach the bus',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({DE:'GND',DI:'D1'}),f.env).get('m1')!;
 sendAll(f,req,0,CHAR,);
 const s=m.state();assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.equal(s.v.driverOn,false);assert.equal(s.v.driverOffBytes,8);assert.equal(s.v.busBytes,0);assert.equal(s.v.frames,0);}
});
test('max485: DE tied to 5V sends; frame ends on silence; CRC is checked; a bad CRC is reported',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({DE:'5V',RE:'5V',DI:'D1',RO:'D0'}),f.env).get('m1')!;
 sendAll(f,req,0,CHAR);
 m.update({samples:EMPTY(),dtSec:0.01,cycles:8*CHAR+Math.round(2*CHAR)});   // 2 chars of silence: frame still open
 let s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext')assert.equal(s.v.frames,0);
 m.update({samples:EMPTY(),dtSec:0.01,cycles:8*CHAR+Math.round(4*CHAR)});   // beyond 3.5 chars: closed
 s=m.state();assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.equal(s.v.frames,1);assert.equal(s.v.lastAddr,1);assert.equal(s.v.lastFn,3);assert.equal(s.v.lastReg,0x1e);assert.equal(s.v.lastCount,3);assert.equal(s.v.crcOk,true);assert.equal(s.v.busBytes,8);assert.equal(s.v.partner,'no bus partner emulated');}
 // a second frame, a gap of 10 chars after, with a flipped CRC byte
 const bad=[...req.slice(0,7),0x00];
 sendAll(f,bad,20*CHAR,CHAR);
 m.update({samples:EMPTY(),dtSec:0.01,cycles:40*CHAR});
 s=m.state();assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.equal(s.v.frames,2);assert.equal(s.v.crcOk,false);}
 assert.equal(decodeModbus(bad)?.crcOk,false);
});
test('max485: a hex reply goes out on RO with 10-bit timing, only while RE is low',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({DE:'GND',RE:'GND',DI:'D1',RO:'D0'}),f.env).get('m1')!;
 m.setInput?.({kind:'ext',type:'max485',v:{line:'01 03 02 00 FA 38 46'}});
 f.run(Math.round(7*10/9600*16e6)+10);
 assert.deepEqual(f.sent,[1,3,2,0,0xfa,0x38,0x46]);
 const g=fakeEnv();
 const n=createModels(circuit({DE:'GND',RE:'5V',DI:'D1',RO:'D0'}),g.env).get('m1')!;
 n.setInput?.({kind:'ext',type:'max485',v:{line:'01 03'}});
 g.run(1e7);
 assert.deepEqual(g.sent,[]);
});
