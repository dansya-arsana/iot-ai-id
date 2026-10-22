import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {BoardPin,Circuit,FirmwareVariant,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';
import {createLabRunner} from '../apps/web/src/lab/sim/runner.js';
import {codeB} from '../apps/web/src/lab/sim/devices/max7219-matrix.js';
import type {I2cSlave,SpiBinding} from '../apps/web/src/lab/sim/devices/types.js';

function fakeEnv(){
 const log:{pin:UnoPin;level:boolean}[]=[],spi:SpiBinding[]=[],i2c:I2cSlave[]=[];
 return {log,spi,env:{
  setPin:(p:UnoPin,l:boolean)=>{log.push({pin:p,level:l});},setAdc:()=>undefined,schedule:()=>undefined,now:()=>0,
  watchLine:()=>undefined,attachI2c:(s:I2cSlave)=>{i2c.push(s);},attachSpi:(s:SpiBinding)=>{spi.push(s);},tapUart:()=>undefined,uartSend:()=>undefined,
 }};
}
const circuit=(modules:string,net:Partial<Record<string,BoardPin>>={CS:'D10'}):Circuit=>({wires:[],parts:[{id:'m',kind:'max7219-matrix',net,props:{modules}}]});
type V=Record<string,string|number|boolean|null>;

/** A MAX7219 chain with helpers that clock whole 16-bit words like a sketch does. */
function rig(modules='1'){
 const f=fakeEnv();
 const m=createModels(circuit(modules),f.env).get('m')!;
 const bus=f.spi[0]!;
 const info:{mode:0|1|2|3;lsbFirst:boolean;clockHz:number;cycle:number}={mode:0,lsbFirst:false,clockHz:4_000_000,cycle:0};
 const st=():V=>{const s=m.state();assert.ok(s.kind==='ext');return (s as {v:V}).v;};
 /** one CS frame of raw bytes */
 const frame=(bytes:number[],i=info):void=>{m.onEdge!('D10',0,0);for(const b of bytes)bus.transfer(b,i);m.onEdge!('D10',1,0);};
 /** the same word for every chip */
 const all=(reg:number,data:number):void=>frame(Array.from({length:Number(modules)},()=>[reg,data]).flat());
 return {m,f,st,frame,all,bus,info};
}
const rows=(fb:unknown,k:number):number[]=>Array.from({length:8},(_,r)=>parseInt(String(fb).substr((k*8+r)*2,2),16));

test('max7219: power-up is blank and in shutdown; registers need a write',()=>{
 const r=rig();
 assert.equal(r.st().fb,'0'.repeat(16));assert.equal(r.st().shutdown,true);
 r.all(1,0xff);                                       // digit 0 written, still shut down: the row stays dark
 assert.equal(r.st().fb,'0'.repeat(16));
 r.all(0x0c,1);r.all(0x0b,7);
 assert.deepEqual(rows(r.st().fb,0),[0xff,0,0,0,0,0,0,0]);
 assert.equal(r.st().latches,3);assert.equal(r.st().shutdown,false);
});
test('max7219: nothing is latched until CS rises (LOAD), a held CS frame changes nothing visible',()=>{
 const r=rig();r.all(0x0c,1);r.all(0x0b,7);
 r.m.onEdge!('D10',0,0);r.bus.transfer(0x03,r.info);r.bus.transfer(0x5a,r.info);
 assert.equal(rows(r.st().fb,0)[2],0);               // CS still low
 r.m.onEdge!('D10',1,0);
 assert.equal(rows(r.st().fb,0)[2],0x5a);
});
test('max7219: scan limit hides the digits above it, display test lights everything, shutdown blanks without losing data',()=>{
 const r=rig();r.all(0x0c,1);
 for(let d=1;d<=8;d++)r.all(d,0x80>>(d-1));
 r.all(0x0b,7);assert.deepEqual(rows(r.st().fb,0),[0x80,0x40,0x20,0x10,0x08,0x04,0x02,0x01]);
 r.all(0x0b,2);assert.deepEqual(rows(r.st().fb,0),[0x80,0x40,0x20,0,0,0,0,0]);
 r.all(0x0f,1);assert.deepEqual(rows(r.st().fb,0),new Array(8).fill(0xff));assert.equal(r.st().test,true);
 r.all(0x0f,0);r.all(0x0c,0);assert.deepEqual(rows(r.st().fb,0),new Array(8).fill(0));
 r.all(0x0c,1);r.all(0x0b,7);assert.deepEqual(rows(r.st().fb,0)[7],0x01,'registers kept their data in shutdown');
});
test('max7219: decode mode shows Code B glyphs (7 with decimal point), per-digit mask, intensity duty (2i+1)/32 and the scan-limit brightness',()=>{
 assert.equal(codeB(7),0x70);assert.equal(codeB(0x88),0xff);assert.equal(codeB(0x0f),0);assert.equal(codeB(0x0a),0x01);
 const r=rig();r.all(0x0c,1);r.all(0x0b,7);
 r.all(1,0x07);r.all(2,0x8f);r.all(0x09,0x01);          // only digit 0 decoded
 assert.deepEqual(rows(r.st().fb,0).slice(0,2),[0x70,0x8f]);
 r.all(0x0a,15);assert.equal(r.st().lum,'f7');           // 31/32 x 255
 r.all(0x0a,0);assert.equal(r.st().lum,'08');            // 1/32 x 255
 r.all(0x0a,4);r.all(0x0b,3);                            // fewer digits scanned = each lit longer = brighter
 assert.equal(r.st().lum,Math.round(Math.min(1,9/32*8/4)*255).toString(16).padStart(2,'0'));
 r.all(0x0a,0x1f);assert.equal(r.st().intensity,15,'only four bits');
});
test('max7219: four chips in a chain: the first word lands in the farthest chip, a short frame leaves the others with stale shift-register data',()=>{
 const r=rig('4');
 for(const [reg,d] of [[0x0c,1],[0x0b,7]] as const)r.all(reg,d);
 // words in send order for chips 3,2,1,0
 r.frame([1,0x33, 1,0x22, 1,0x11, 1,0x00]);
 assert.deepEqual([0,1,2,3].map(k=>rows(r.st().fb,k)[0]),[0x00,0x11,0x22,0x33]);
 // one single word only: chip 0 gets it, chips 1..3 re-latch what sat in their shift registers (the earlier words moved on)
 r.frame([1,0x77]);
 assert.deepEqual([0,1,2,3].map(k=>rows(r.st().fb,k)[0]),[0x77,0x00,0x11,0x22]);
 assert.equal(r.st().partial,true);
 r.frame([1,0x44, 1,0x44, 1,0x44, 1,0x44]);assert.equal(r.st().partial,false);
 assert.equal(String(r.st().fb).length,64);assert.equal(String(r.st().lum).length,8);assert.equal(r.st().modules,4);
});
test('max7219: a NOOP word (address 0) changes nothing, so a chain can address one chip',()=>{
 const r=rig('4');r.all(0x0c,1);r.all(0x0b,7);
 r.frame([0,0, 0,0, 1,0xaa, 0,0]);                        // only chip 1 (third word sent) gets digit 0
 assert.deepEqual([0,1,2,3].map(k=>rows(r.st().fb,k)[0]),[0,0xaa,0,0]);
});
test('max7219: the chip samples on the rising edge MSB first: mode 3 works, mode 1 is read a bit late, LSB-first is reversed',()=>{
 const r=rig();r.all(0x0c,1);r.all(0x0b,7);
 r.frame([1,0xa5],{...r.info,mode:3});assert.equal(rows(r.st().fb,0)[0],0xa5);
 r.frame([2,0x3c],{...r.info,mode:1});         // every byte is seen as (previous LSB << 7) | (byte >> 1): register 2 becomes 1, data 0x3c becomes 0x1e
 assert.equal(rows(r.st().fb,0)[0],0x1e);assert.equal(rows(r.st().fb,0)[1],0);
 assert.ok(Number(r.st().badFrames)>0);
 const before=Number(r.st().badFrames);
 r.frame([0x80,0x01],{...r.info,lsbFirst:true});          // reversed: reg 0x01, data 0x80
 assert.equal(rows(r.st().fb,0)[0],0x80);assert.ok(Number(r.st().badFrames)>before);
});
test('max7219: the modules prop changes the chain length at run time',()=>{
 const r=rig('1');(r.m.props as Record<string,unknown>).modules='4';
 assert.equal(r.st().modules,4);assert.equal(String(r.st().fb).length,64);
});

const fixture=():{toolchain:string;variant:FirmwareVariant}=>JSON.parse(readFileSync(new URL('./fixtures/firmware/max7219-chain.json',import.meta.url),'utf8'));
test('max7219 firmware: a four-module chain driven by real SPI shows a smiley, a checker board, a diagonal and all-on, with their own brightness',()=>{
 const fx=fixture(),r=createLabRunner();
 r.load(fx.variant,{},{wires:[],parts:[{id:'m',kind:'max7219-matrix',net:{CS:'D10',DIN:'D11',CLK:'D13'},props:{modules:'4'}}]},fx.toolchain);r.start();
 r.advance(200);
 assert.match(r.serialText(),/drawn/);
 const s=r.snapshot().parts.m!;assert.ok(s.kind==='ext');
 if(s.kind!=='ext')return;
 const v=s.v as V;
 assert.equal(v.shutdown,false);assert.equal(v.modules,4);
 // module 0: digit 0 is Code B "7." (0xF0), the rest of the smiley
 assert.deepEqual(rows(v.fb,0),[0xf0,0x42,0xa5,0x81,0xa5,0x99,0x42,0x3c]);
 // the sketch's last frame wrote digit 0 = 0 to chips 1..3 (a chain frame addresses every chip), so their first row went dark
 assert.deepEqual(rows(v.fb,1),[0,0xaa,0x55,0xaa,0x55,0xaa,0x55,0xaa]);
 assert.deepEqual(rows(v.fb,2),[0,2,4,8,16,32,64,128]);
 assert.deepEqual(rows(v.fb,3),[0,...new Array(7).fill(0xff)]);
 assert.equal(String(v.lum),'484848f7');
 assert.equal(v.partial,false);assert.equal(v.badFrames,0);
 assert.equal(v.latches,17);assert.equal(v.words,64);   // 16 frames of four words, plus LOAD's first rise when the sketch makes D10 an output (an empty latch of NOOPs)
});
