/**
 * DS18B20: the real 1-Wire protocol at signal level. A test master drives the shared line with cycle-exact slots against the device models:
 * reset and presence, ROM commands (READ, MATCH, SKIP, SEARCH, ALARM SEARCH), CONVERT T with busy read slots, scratchpad with CRC, resolution,
 * then the real firmware (our own bit-banging master, tests/fixtures/sketches/ds18b20-read.ino).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {BoardPin,Circuit,FirmwareVariant,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';
import type {PartModel} from '../apps/web/src/lab/sim/peripherals.js';
import {createLabRunner} from '../apps/web/src/lab/sim/runner.js';
import {us,ms} from '../apps/web/src/lab/sim/devices/types.js';
import {crc8,romBytes,serialFromId,tempWord,wordToC,DS18B20_US} from '../apps/web/src/lab/sim/devices/ds18b20.js';

/** One open-drain wire on D2 shared by every slave and the test master (wired-AND), with synchronous edge delivery like the real pin monitor. */
function wire(){
 const events:{at:number;cb:()=>void}[]=[];
 let now=0,masterLow=false,ext=true,last=1;
 const models:PartModel[]=[];
 const edges:{level:number;at:number}[]=[];
 const eff=():number=>masterLow?0:ext?1:0;
 const notify=():void=>{const l=eff();if(l===last)return;last=l;edges.push({level:l,at:now});for(const m of models)m.onEdge?.('D2' as UnoPin,l as 0|1,now);};
 const env={
  setPin:(_p:UnoPin,l:boolean)=>{ext=l;notify();},setAdc:()=>undefined,
  schedule:(c:number,cb:()=>void)=>{events.push({at:now+c,cb});events.sort((a,b)=>a.at-b.at);},now:()=>now,
  watchLine:()=>undefined,pinLevel:()=>eff() as 0|1,
 };
 const run=(to:number):void=>{while(events.length&&events[0]!.at<=to){const e=events.shift()!;now=e.at;e.cb();}now=to;};
 const w={
  env,models,edges,
  get now(){return now;},
  level:eff,
  advance(cycles:number){run(now+cycles);},
  low(){masterLow=true;notify();},
  release(){masterLow=false;notify();},
  /** reset pulse; returns whether a presence pulse was seen at the sample point 70 us after the release */
  reset():boolean{
   w.low();w.advance(us(480));w.release();w.advance(us(70));
   const present=eff()===0;
   w.advance(us(410));
   return present;
  },
  writeBit(b:number){w.low();w.advance(us(b?6:60));w.release();w.advance(us(b?64:10));},
  readBit():number{w.low();w.advance(us(3));w.release();w.advance(us(10));const v=eff();w.advance(us(53));return v;},
  writeByte(v:number){for(let i=0;i<8;i++)w.writeBit((v>>i)&1);},
  readByte():number{let v=0;for(let i=0;i<8;i++)v|=w.readBit()<<i;return v;},
  run,
 };
 return w;
}
type Wire=ReturnType<typeof wire>;
const part=(id:string,props:Record<string,string|number|boolean>={},net:Partial<Record<string,BoardPin>>={DQ:'D2',VDD:'5V',GND:'GND'})=>({id,kind:'ds18b20',net,props});
function bench(ids:string[]=['t1'],props:Record<string,string|number|boolean>[]=[]){
 const w=wire();
 const c:Circuit={wires:[],parts:ids.map((id,i)=>part(id,props[i]??{}))};
 const ms_=createModels(c,w.env);
 for(const id of ids)w.models.push(ms_.get(id)!);
 return {w,m:ids.map(id=>ms_.get(id)!)};
}
const st=(m:PartModel):Record<string,number|boolean|string|null>=>{const s=m.state();assert.ok(s.kind==='ext');return s.kind==='ext'?s.v:{};};
const bytes=(w:Wire,n:number):number[]=>Array.from({length:n},()=>w.readByte());

test('crc8 matches the published Dallas examples and the power-on scratchpad',()=>{
 assert.equal(crc8([0x02,0x1c,0xb8,0x01,0x00,0x00,0x00]),0xa2);            // Maxim app note 27 example ROM
 assert.equal(crc8([0x50,0x05,0x4b,0x46,0x7f,0xff,0x0c,0x10]),0x1c);       // DS18B20 datasheet: scratchpad after power-on
 const rom=romBytes(serialFromId('abc'));assert.equal(rom[0],0x28);assert.equal(crc8(rom.slice(0,7)),rom[7]);
 assert.equal(crc8(rom),0,'the CRC of all 8 ROM bytes is zero');
 assert.notDeepEqual(romBytes(serialFromId('a')),romBytes(serialFromId('b')));
});
test('temperature word: 1/16 degC, two complement, truncated to the resolution',()=>{
 assert.equal(tempWord(25.0625,12),0x0191);assert.equal(tempWord(85,12),0x0550);assert.equal(tempWord(0.5,12),0x0008);
 assert.equal(tempWord(-10.125,12),0xff5e);assert.equal(tempWord(-55,12),0xfc90);assert.equal(tempWord(125,12),0x07d0);
 assert.equal(tempWord(25.0625,9),0x0190,'9 bit: the three low bits are zero');
 assert.equal(tempWord(25.0625,10),0x0190);assert.equal(tempWord(25.0625,11),0x0190);assert.equal(tempWord(25.4375,11),0x0196);
 assert.equal(wordToC(0xff5e),-10.125);assert.equal(tempWord(300,12),0x07d0,'clamped to 125');
});

test('reset pulse: presence 30 us after the release, 120 us long; a short low is no reset',()=>{
 const {w}=bench();
 w.advance(us(100));
 w.low();w.advance(us(480));w.release();
 const rel=w.now;
 w.advance(us(500));
 const [a,b]=w.edges.slice(-2);
 assert.equal(a!.level,0);assert.equal(a!.at-rel,us(DS18B20_US.presenceDelay),'presence starts 30 us after the release (datasheet 15-60 us)');
 assert.equal(b!.level,1);assert.equal(b!.at-a!.at,us(DS18B20_US.presence),'and lasts 120 us (60-240 us)');
 const before=w.edges.length;
 w.low();w.advance(us(200));w.release();w.advance(us(600));
 assert.equal(w.edges.length-before,2,'only the master edges: a 200 us low is not a reset');
});

test('power-on scratchpad reads +85 degC with the factory TH/TL/config and a valid CRC',()=>{
 const {w,m}=bench(['t1'],[{tempC:24}]);
 assert.ok(w.reset());w.writeByte(0xcc);w.writeByte(0xbe);
 const sp=bytes(w,9);
 assert.deepEqual(sp,[0x50,0x05,0x4b,0x46,0x7f,0xff,0x0c,0x10,0x1c]);
 assert.equal(st(m[0]!).resolution,12);
});

test('READ ROM returns family 0x28, the serial and a valid CRC (LSB first)',()=>{
 const {w,m}=bench();
 assert.ok(w.reset());w.writeByte(0x33);
 const rom=bytes(w,8);
 assert.equal(rom[0],0x28);assert.equal(crc8(rom.slice(0,7)),rom[7]);
 assert.equal(rom.map(b=>b.toString(16).padStart(2,'0')).join(''),st(m[0]!).rom);
 assert.equal(st(m[0]!).romCmd,0x33);
});

test('after READ ROM the device accepts a function command right away (the last read slot is not mistaken for a write)',()=>{
 const {w,m}=bench();
 assert.ok(w.reset());w.writeByte(0x33);bytes(w,8);
 w.writeByte(0x44);w.advance(ms(800));
 assert.equal(st(m[0]!).conversions,1);assert.equal(st(m[0]!).funcCmd,0x44);
});

test('read slot timing: a 0 pulls DQ low exactly 30 us from the falling edge, a 1 stays released',()=>{
 const {w}=bench();
 w.reset();w.writeByte(0x33);
 // first ROM bit of byte 0x28 (LSB first) is 0
 const n=w.edges.length;
 w.low();const t0=w.now;w.advance(us(3));w.release();w.advance(us(80));
 const e=w.edges.slice(n);
 assert.deepEqual(e.map(x=>x.level),[0,1],'one low pulse, one rise');
 assert.equal(e[1]!.at-t0,us(30));
 // second bit is also 0 (0x28 = 00101000), the fourth is 1: only edges made by the master
 w.advance(us(10));w.low();w.advance(us(3));w.release();w.advance(us(60));   // bit 1 = 0
 w.low();w.advance(us(3));w.release();w.advance(us(60));                      // bit 2 = 0
 const k=w.edges.length;
 w.low();w.advance(us(3));w.release();w.advance(us(60));                      // bit 3 = 1 (0x28 bit 3)
 assert.equal(w.edges.length-k,2,'a sent 1 adds no edge of its own');
});

test('CONVERT T: read slots return 0 until 750 ms (12 bit), then 1; the scratchpad then holds the temperature',()=>{
 const {w,m}=bench(['t1'],[{tempC:-10.125}]);
 assert.ok(w.reset());w.writeByte(0xcc);w.writeByte(0x44);
 const t0=w.now;
 assert.equal(w.readBit(),0,'busy');
 assert.equal(st(m[0]!).converting,true);
 w.run(t0+ms(749));assert.equal(w.readBit(),0);
 w.run(t0+ms(751));assert.equal(w.readBit(),1,'done');
 assert.ok(w.reset());w.writeByte(0xcc);w.writeByte(0xbe);
 const sp=bytes(w,9);
 assert.equal(sp[0]|sp[1]<<8,0xff5e);assert.equal(sp[8],crc8(sp.slice(0,8)));
 assert.equal(st(m[0]!).conversions,1);assert.equal(st(m[0]!).raw,-162);
});

test('WRITE SCRATCHPAD sets resolution: conversion time and truncation follow the config byte; COPY and RECALL work',()=>{
 const {w,m}=bench(['t1'],[{tempC:25.0625}]);
 assert.ok(w.reset());w.writeByte(0xcc);w.writeByte(0x4e);w.writeByte(30);w.writeByte(10);w.writeByte(0x1f);   // TH=30 TL=10 9 bit
 assert.equal(st(m[0]!).resolution,9);assert.equal(st(m[0]!).th,30);assert.equal(st(m[0]!).tl,10);
 w.reset();w.writeByte(0xcc);w.writeByte(0x44);const t0=w.now;
 w.run(t0+ms(90));assert.equal(w.readBit(),0,'93.75 ms not elapsed');
 w.run(t0+ms(95));assert.equal(w.readBit(),1);
 w.reset();w.writeByte(0xcc);w.writeByte(0xbe);const sp=bytes(w,9);
 assert.equal(sp[0]|sp[1]<<8,0x0190,'9 bit result');assert.equal(sp[2],30);assert.equal(sp[3],10);assert.equal(sp[4],0x1f);
 // copy to EEPROM (10 ms), change scratchpad, recall
 w.reset();w.writeByte(0xcc);w.writeByte(0x48);const c0=w.now;
 assert.equal(w.readBit(),0,'copy busy');w.run(c0+ms(11));assert.equal(w.readBit(),1);
 w.reset();w.writeByte(0xcc);w.writeByte(0x4e);w.writeByte(1);w.writeByte(2);w.writeByte(0x7f);
 assert.equal(st(m[0]!).th,1);
 w.reset();w.writeByte(0xcc);w.writeByte(0xb8);w.run(w.now+ms(1));
 assert.equal(st(m[0]!).th,30,'recall brings back the copied TH');assert.equal(st(m[0]!).resolution,9);
 // a reset after 2 bytes of WRITE SCRATCHPAD keeps TH and TL (config is optional)
 w.reset();w.writeByte(0xcc);w.writeByte(0x4e);w.writeByte(5);w.writeByte(6);w.reset();
 assert.equal(st(m[0]!).th,5);assert.equal(st(m[0]!).resolution,9);
});

test('READ POWER SUPPLY: 1 when VDD is wired, 0 in parasitic mode (VDD tied to GND)',()=>{
 const a=bench();a.w.reset();a.w.writeByte(0xcc);a.w.writeByte(0xb4);assert.equal(a.w.readBit(),1);
 const w=wire();const ms_=createModels({wires:[],parts:[part('p',{},{DQ:'D2',VDD:'GND',GND:'GND'})]},w.env);w.models.push(ms_.get('p')!);
 w.reset();w.writeByte(0xcc);w.writeByte(0xb4);assert.equal(w.readBit(),0);
});

/** Standard 1-Wire ROM search (Maxim AN187) on the test master. */
function searchAll(w:Wire,cmd=0xf0):string[]{
 const found:string[]=[];
 let lastDisc=-1;
 for(let round=0;round<8;round++){
  if(!w.reset())break;
  w.writeByte(cmd);
  const rom=new Array(64).fill(0);
  let disc=-1;
  for(let i=0;i<64;i++){
   const b=w.readBit(),cb=w.readBit();
   let dir:number;
   if(b&&cb){return found;}
   if(b!==cb)dir=b;
   else{
    if(i<lastDisc)dir=rom_prev[i]!;
    else if(i===lastDisc)dir=1;
    else dir=0;
    if(dir===0)disc=i;
   }
   rom[i]=dir;w.writeBit(dir);
  }
  rom_prev=rom.slice();lastDisc=disc;
  const bytesOut:number[]=[];
  for(let k=0;k<8;k++){let v=0;for(let j=0;j<8;j++)v|=rom[k*8+j]<<j;bytesOut.push(v);}
  found.push(bytesOut.map(b=>b.toString(16).padStart(2,'0')).join(''));
  if(disc<0)break;
 }
 return found;
}
let rom_prev:number[]=new Array(64).fill(0);

test('SEARCH ROM finds every sensor sharing the wire (wired-AND line)',()=>{
 rom_prev=new Array(64).fill(0);
 const {w,m}=bench(['a','b','c']);
 const found=searchAll(w);
 assert.deepEqual(found.slice().sort(),m.map(x=>String(st(x).rom)).sort(),'three different ROMs, all found');
 for(const f of found){const b=f.match(/../g)!.map(h=>parseInt(h,16));assert.equal(crc8(b),0);}
});

test('MATCH ROM addresses one sensor: only that one converts; a wrong ROM drops everyone out',()=>{
 const {w,m}=bench(['a','b'],[{tempC:10},{tempC:30}]);
 const target=romBytes(serialFromId('b'));
 assert.ok(w.reset());w.writeByte(0x55);for(const b of target)w.writeByte(b);w.writeByte(0x44);
 w.advance(ms(800));
 assert.equal(st(m[0]!).conversions,0);assert.equal(st(m[1]!).conversions,1);
 assert.ok(w.reset());w.writeByte(0x55);for(const b of target)w.writeByte(b^1);   // one wrong bit in each byte
 w.writeByte(0xbe);assert.equal(w.readBit(),1,'nobody answers after a mismatch');
 // SKIP ROM converts both
 assert.ok(w.reset());w.writeByte(0xcc);w.writeByte(0x44);w.advance(ms(800));
 assert.equal(st(m[0]!).conversions,1);assert.equal(st(m[1]!).conversions,2);
});

test('ALARM SEARCH: only a sensor whose last temperature is outside TL..TH answers',()=>{
 rom_prev=new Array(64).fill(0);
 const {w,m}=bench(['a','b'],[{tempC:20},{tempC:40}]);
 assert.ok(w.reset());w.writeByte(0xcc);w.writeByte(0x4e);w.writeByte(30);w.writeByte(10);w.writeByte(0x7f);
 w.reset();w.writeByte(0xcc);w.writeByte(0x44);w.advance(ms(800));
 assert.equal(st(m[0]!).alarm,false);assert.equal(st(m[1]!).alarm,true,'40 degC is above TH 30');
 const found=searchAll(w,0xec);
 assert.deepEqual(found,[String(st(m[1]!).rom)]);
});

test('an unknown ROM command and a missing reset are ignored; a reset interrupts a scratchpad read',()=>{
 const {w}=bench();
 w.writeByte(0xbe);assert.equal(w.readBit(),1,'no command is accepted before a reset');
 assert.ok(w.reset());w.writeByte(0x77);assert.equal(w.readBit(),1,'unknown command: silent until the next reset');
 assert.ok(w.reset());w.writeByte(0xcc);w.writeByte(0xbe);const half=bytes(w,3);
 assert.deepEqual(half,[0x50,0x05,0x4b]);
 assert.ok(w.reset(),'a reset in the middle of a read answers again');
});

test('the line is only held while the device talks: DQ is released outside slots and wired VDD/GND do not matter for the protocol',()=>{
 const {w}=bench();
 w.reset();w.writeByte(0xcc);w.writeByte(0xbe);bytes(w,9);
 w.advance(us(100));assert.equal(w.level(),1,'pulled high again');
});

// ---------- real firmware: our own bit-banging master ----------
const fixture=():{toolchain:string;variant:FirmwareVariant}=>JSON.parse(readFileSync(new URL('./fixtures/firmware/ds18b20-read.json',import.meta.url),'utf8'));
const circuitFw=(props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'t1',kind:'ds18b20',net:{DQ:'D2',VDD:'5V',GND:'GND'},props}]});
test('real firmware: reads the ROM, converts, polls and prints the temperature set on the part',()=>{
 const fx=fixture(),r=createLabRunner();
 r.load(fx.variant,{},circuitFw({tempC:21.5}),fx.toolchain);r.start();
 r.advance(1900);
 const txt=r.serialText();
 assert.match(txt,/ready/);assert.match(txt,/rom=28[0-9A-F]{14} crc ok/,txt);
 assert.match(txt,/sp ok raw=344 mC=21500/,txt);
 r.setPartProps('t1',{tempC:-3.25});
 r.advance(2400);
 assert.match(r.serialText(),/sp ok raw=-52 mC=-3250/,r.serialText());
 assert.doesNotMatch(r.serialText(),/BAD|no presence/);
 const s=r.snapshot().parts.t1!;assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.ok((s.v.conversions as number)>=2);}
});
test('real firmware: a sensor on another pin is never read (no valid ROM)',()=>{
 const fx=fixture(),r=createLabRunner();
 const c=circuitFw();c.parts[0]!.net={DQ:'D3',VDD:'5V',GND:'GND'};
 r.load(fx.variant,{},c,fx.toolchain);r.start();r.advance(1200);
 assert.doesNotMatch(r.serialText(),/rom=28/);assert.doesNotMatch(r.serialText(),/sp ok/);
});
