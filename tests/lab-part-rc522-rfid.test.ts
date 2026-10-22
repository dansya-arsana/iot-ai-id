import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {BoardPin,Circuit,FirmwareVariant,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';
import {createLabRunner} from '../apps/web/src/lab/sim/runner.js';
import {CARDS,REG,crcA,uidFrame} from '../apps/web/src/lab/sim/devices/rc522-rfid.js';
import {us,ms} from '../apps/web/src/lab/sim/devices/types.js';
import type {I2cSlave,SpiBinding} from '../apps/web/src/lab/sim/devices/types.js';

/** Minimal board: a clock with scheduled callbacks and pin logs. */
function fakeEnv(){
 const events:{at:number;cb:()=>void}[]=[];
 let now=0;
 const log:{pin:UnoPin;level:boolean;at:number}[]=[],spi:SpiBinding[]=[],i2c:I2cSlave[]=[];
 return {log,spi,
  env:{
   setPin:(p:UnoPin,l:boolean)=>{log.push({pin:p,level:l,at:now});},setAdc:()=>undefined,
   schedule:(c:number,cb:()=>void)=>{events.push({at:now+c,cb});events.sort((a,b)=>a.at-b.at);},now:()=>now,
   watchLine:()=>undefined,attachI2c:(s:I2cSlave)=>{i2c.push(s);},attachSpi:(s:SpiBinding)=>{spi.push(s);},tapUart:()=>undefined,uartSend:()=>undefined,
   pinMode:(_p:UnoPin)=>'input' as const,
  },
  now:()=>now,
  run(to:number){while(events.length&&events[0]!.at<=to){const e=events.shift()!;now=e.at;e.cb();}now=to;},
 };
}
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'rc522-rfid1',kind:'rc522-rfid',net,props}]});

/** A reader on D10 with helpers that speak the datasheet's SPI frames. */
function rig(card:string,net:Partial<Record<string,BoardPin>>={}){
 const f=fakeEnv();
 const m=createModels(circuit({SDA:'D10',...net},{card}),f.env).get('rc522-rfid1')!;
 const bus=f.spi[0]!;
 const info={mode:0 as const,lsbFirst:false,clockHz:4_000_000,cycle:0};
 const frame=(bytes:number[]):number[]=>{
  m.onEdge!('D10',0,f.now());
  const out=bytes.map(b=>bus.transfer(b,info));
  m.onEdge!('D10',1,f.now());
  return out;
 };
 const rd=(r:number):number=>frame([0x80|(r<<1),0])[1]!;
 const wr=(r:number,v:number):void=>{frame([r<<1,v]);};
 const go=(micro:number):void=>f.run(f.now()+us(micro));
 const st=():Record<string,string|number|boolean|null>=>{const s=m.state();assert.ok(s.kind==='ext');return (s as {v:Record<string,string|number|boolean|null>}).v;};
 /** the library's own start-up: timer 25 ms, CRC preset 0x6363, antenna on */
 const init=():void=>{wr(REG.TMode,0x80);wr(REG.TPrescaler,0xa9);wr(REG.TReloadH,0x03);wr(REG.TReloadL,0xe8);wr(REG.TxASK,0x40);wr(REG.Mode,0x3d);wr(REG.TxControl,0x03);};
 const send=(bytes:number[],lastBits=0):void=>{
  wr(REG.Command,0);wr(REG.ComIrq,0x7f);wr(REG.FIFOLevel,0x80);
  for(const b of bytes)wr(REG.FIFOData,b);
  wr(REG.BitFraming,lastBits);wr(REG.Command,0x0c);wr(REG.BitFraming,rd(REG.BitFraming)|0x80);
 };
 const fifo=():number[]=>{const n=rd(REG.FIFOLevel);return Array.from({length:n},()=>rd(REG.FIFOData));};
 return {f,m,rd,wr,go,st,init,send,fifo,frame,bus,info};
}

test('rc522: VersionReg reads 0x92, burst read returns the previous address on every byte',()=>{
 const r=rig('none');
 assert.equal(r.rd(REG.Version),0x92);
 assert.equal(r.rd(REG.WaterLevel),0x08);                       // datasheet reset value
 // burst: address, address, address, 0x00 -> X, data0, data1, data2
 const out=r.frame([0x80|(REG.Version<<1),0x80|(REG.WaterLevel<<1),0x80|(REG.Mode<<1),0x00]);
 assert.deepEqual(out,[0,0x92,0x08,0x3f]);
 assert.equal(r.st().lastReg,REG.Mode);
});
test('rc522: writes, ComIrq set/clear rule, read-only registers, FIFO level and flush',()=>{
 const r=rig('none');
 r.wr(REG.ComIrq,0x80|0x11);assert.equal(r.rd(REG.ComIrq)&0x7f,0x14|0x11);   // bit 7 set = set the marked bits
 r.wr(REG.ComIrq,0x7f);assert.equal(r.rd(REG.ComIrq),0);                      // bit 7 clear = clear them
 r.wr(REG.Version,0x11);assert.equal(r.rd(REG.Version),0x92);
 r.frame([REG.FIFOData<<1,1,2,3]);assert.equal(r.rd(REG.FIFOLevel),3);        // a write burst fills the FIFO through one address
 assert.equal(r.rd(REG.FIFOData),1);assert.equal(r.rd(REG.FIFOLevel),2);
 r.wr(REG.FIFOLevel,0x80);assert.equal(r.rd(REG.FIFOLevel),0);
 for(let i=0;i<70;i++)r.wr(REG.FIFOData,i);
 assert.equal(r.rd(REG.FIFOLevel),64);assert.ok((r.rd(REG.Error)&0x10)!==0,'BufferOvfl');
});
test('rc522: SPI mode 0 MSB first only; another mode reads back 0xFF',()=>{
 const r=rig('none');
 const bad=r.bus.transfer(0x80|(REG.Version<<1),{...r.info,mode:3});
 assert.equal(bad,0xff);assert.equal(r.st().badFrames,1);
 r.m.onEdge!('D10',1,1);
});
test('rc522: CRC coprocessor gives the ISO 14443-A value (HLTA = 57 CD) and honours the ModeReg preset',()=>{
 assert.deepEqual(crcA([0x50,0x00]),[0x57,0xcd]);
 assert.deepEqual(crcA([0x00,0x00]),[0xa0,0x1e]);
 const r=rig('none');
 r.wr(REG.Mode,0x3d);
 r.wr(REG.DivIrq,0x04);r.wr(REG.FIFOLevel,0x80);r.wr(REG.FIFOData,0x50);r.wr(REG.FIFOData,0x00);r.wr(REG.Command,0x03);
 assert.equal(r.rd(REG.DivIrq)&0x04,0,'not done yet');
 assert.equal(r.rd(REG.Status1)&0x20,0,'CRCReady low while busy');
 r.go(2);
 assert.equal(r.rd(REG.DivIrq)&0x04,0x04);assert.equal(r.rd(REG.Status1)&0x20,0x20);
 assert.equal(r.rd(REG.CRCResultL),0x57);assert.equal(r.rd(REG.CRCResultH),0xcd);
});
test('rc522: REQA answers ATQA after the frame time, with the right bit timing, and raises TxIRq then RxIRq|IdleIRq',()=>{
 const r=rig('card1');r.init();
 r.send([0x26],7);
 // 7-bit frame: start + 7 bits = 8 x 9.44 us = 75.5 us out; then FDT 91 us; the answer is 2 bytes x 9 bits + 2 = 20 bits = 188.8 us
 r.go(70);assert.equal(r.rd(REG.ComIrq)&0x40,0,'TxIRq not yet');
 r.go(10);assert.equal(r.rd(REG.ComIrq)&0x40,0x40,'TxIRq after 75.5 us');
 r.go(270);assert.equal(r.rd(REG.ComIrq)&0x20,0,'no RxIRq before 355 us');
 r.go(10);assert.equal(r.rd(REG.ComIrq)&0x30,0x30,'RxIRq and IdleIRq at 355 us');
 assert.equal(r.rd(REG.Error)&0x13,0);
 assert.deepEqual(r.fifo(),[0x04,0x00]);                         // ATQA of a Classic 1K style card
 assert.equal(r.st().cardState,'ready');
});
test('rc522: no card or antenna off -> the timer fires TimerIRq after TReload x prescaler (25 ms with the library values)',()=>{
 const r=rig('none');r.init();
 r.send([0x26],7);
 r.go(24_000);assert.equal(r.rd(REG.ComIrq)&0x01,0);
 r.go(1_500);assert.equal(r.rd(REG.ComIrq)&0x01,1);assert.equal(r.rd(REG.ComIrq)&0x20,0);
 const a=rig('card1');a.wr(REG.TMode,0x80);a.wr(REG.TPrescaler,0xa9);a.wr(REG.TReloadH,0x03);a.wr(REG.TReloadL,0xe8);   // antenna never switched on
 a.send([0x26],7);a.go(30_000);
 assert.equal(a.rd(REG.ComIrq)&0x20,0,'a card in an unpowered field is silent');assert.equal(a.rd(REG.ComIrq)&0x01,1);
});
test('rc522: anticollision, SELECT with CRC_A and HLTA for a 4-byte UID; a bad CRC is ignored',()=>{
 const r=rig('card1');r.init();
 r.send([0x26],7);r.go(500);r.fifo();
 r.send([0x93,0x20]);r.go(1000);
 const uid=r.fifo();
 assert.deepEqual(uid,uidFrame(CARDS.card1!.uid,1));assert.equal(uid.length,5);
 assert.equal(uid[4],uid[0]^uid[1]^uid[2]^uid[3]);
 const sel=[0x93,0x70,...uid];
 r.send([...sel,0x00,0x00]);r.go(30_000);
 assert.equal(r.rd(REG.ComIrq)&0x20,0,'wrong CRC: the card does not answer');
 r.send([...sel,...crcA(sel)]);r.go(1200);
 const sak=r.fifo();
 assert.deepEqual(sak,[0x08,...crcA([0x08])]);
 assert.equal(r.st().cardState,'active');assert.equal(r.st().selects,1);
 // HLTA: no answer ever, the card goes to HALT, REQA is ignored, WUPA wakes it
 const halt=[0x50,0x00];r.send([...halt,...crcA(halt)]);r.go(30_000);
 assert.equal(r.st().cardState,'halt');
 r.send([0x26],7);r.go(30_000);assert.equal(r.rd(REG.ComIrq)&0x20,0,'REQA does not wake a halted card');
 r.send([0x52],7);r.go(500);assert.deepEqual(r.fifo(),[0x04,0x00]);
});
test('rc522: a 7-byte UID needs two cascade levels (0x88 cascade tag first, SAK bit 2 set)',()=>{
 const r=rig('card3');r.init();
 r.send([0x26],7);r.go(500);assert.deepEqual(r.fifo(),[0x44,0x00]);
 r.send([0x93,0x20]);r.go(1000);
 const cl1=r.fifo();assert.deepEqual(cl1.slice(0,4),[0x88,0x04,0x6a,0xb1]);
 const s1=[0x93,0x70,...cl1];r.send([...s1,...crcA(s1)]);r.go(1200);
 assert.deepEqual(r.fifo(),[0x04,...crcA([0x04])]);assert.equal(r.st().cardState,'ready');
 r.send([0x95,0x20]);r.go(1000);
 const cl2=r.fifo();assert.deepEqual(cl2.slice(0,4),[0x2c,0x5f,0x71,0x80]);
 const s2=[0x95,0x70,...cl2];r.send([...s2,...crcA(s2)]);r.go(1200);
 assert.deepEqual(r.fifo(),[0x00,...crcA([0x00])]);assert.equal(r.st().cardState,'active');
 // level 2 is refused before level 1 was selected
 const q=rig('card3');q.init();q.send([0x26],7);q.go(500);q.fifo();q.send([0x95,0x20]);q.go(30_000);
 assert.equal(q.rd(REG.ComIrq)&0x20,0);
});
test('rc522: TxCRCEn / RxCRCEn make the reader append and strip the CRC itself',()=>{
 const r=rig('card1');r.init();
 r.send([0x26],7);r.go(500);r.fifo();r.send([0x93,0x20]);r.go(1000);const uid=r.fifo();
 r.wr(REG.TxMode,0x80);r.wr(REG.RxMode,0x80);
 r.send([0x93,0x70,...uid]);r.go(1200);
 assert.deepEqual(r.fifo(),[0x08]);                              // CRC checked and removed by the reader
 assert.equal(r.rd(REG.Error)&0x04,0);
});
test('rc522: switching the antenna off drops the card back to IDLE (it lost power)',()=>{
 const r=rig('card1');r.init();
 r.send([0x26],7);r.go(500);assert.equal(r.st().cardState,'ready');
 r.wr(REG.TxControl,0x00);assert.equal(r.st().cardState,'idle');
 assert.equal(r.st().antenna,false);
});
test('rc522: the IRQ pin follows ComIEn/ComIrq (inverted by default, idle high)',()=>{
 const r=rig('card1',{IRQ:'D2'});r.init();
 r.wr(REG.ComIEn,0x80|0x20);                                      // IRqInv + RxIEn
 r.send([0x26],7);r.go(80);
 assert.equal(r.f.log.filter(l=>l.pin==='D2').length,0,'still idle high');
 r.go(400);
 const l=r.f.log.filter(x=>x.pin==='D2');assert.ok(l.length>=1);assert.equal(l[l.length-1]!.level,false,'IRQ pulled low after the card answered');
 r.wr(REG.ComIrq,0x7f);
 const l2=r.f.log.filter(x=>x.pin==='D2');assert.equal(l2[l2.length-1]!.level,true,'back high once cleared');
});
test('rc522: SoftReset restores reset values and shows PowerDown (bit 4) until the oscillator runs',()=>{
 const r=rig('none');r.init();
 r.wr(REG.Command,0x0f);
 assert.equal(r.rd(REG.Command)&0x10,0x10);
 r.go(ms(1)/16+50);
 assert.equal(r.rd(REG.Command),0x20);assert.equal(r.rd(REG.TxControl),0x80);
});
test('rc522: popover card change is a new card (idle), pins SDA SCK MOSI MISO IRQ GND RST 3V3',()=>{
 const r=rig('card1');r.init();
 r.send([0x26],7);r.go(500);assert.equal(r.st().cardState,'ready');
 (r.m.props as Record<string,unknown>).card='card2';
 assert.equal(r.st().card,'card2');assert.equal(r.st().cardState,'idle');assert.equal(r.st().uid,'07c56e2d');
});

// ---------- real firmware ----------
const fixture=():{toolchain:string;variant:FirmwareVariant}=>JSON.parse(readFileSync(new URL('./fixtures/firmware/rc522-uid.json',import.meta.url),'utf8'));
function boot(card:string,extra:Record<string,string|number|boolean>={}){
 const fx=fixture(),r=createLabRunner();
 r.load(fx.variant,{},{wires:[],parts:[{id:'r',kind:'rc522-rfid',net:{SDA:'D10',SCK:'D13',MOSI:'D11',MISO:'D12',RST:'D9'},props:{card,...extra}}]},fx.toolchain);r.start();
 return r;
}
test('rc522 firmware: a hand-written driver reads the version and the UID of each card through real SPI',()=>{
 const none=boot('none');none.advance(400);
 assert.match(none.serialText(),/ver=92/);assert.match(none.serialText(),/no card/);assert.doesNotMatch(none.serialText(),/uid=/);
 const a=boot('card1');a.advance(500);
 assert.match(a.serialText(),/uid=4BA21F93 sak=08 atqa=0400/,a.serialText());
 const b=boot('card2');b.advance(500);
 assert.match(b.serialText(),/uid=07C56E2D sak=08 atqa=0400/,b.serialText());
 const c=boot('card3');c.advance(600);
 assert.match(c.serialText(),/uid=046AB12C5F7180 sak=00 atqa=4400/,c.serialText());
 const s=c.snapshot().parts.r!;assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.equal(s.v.version,0x92);assert.equal(s.v.antenna,true);assert.ok(Number(s.v.frames)>=4);assert.equal(s.v.badFrames,0);assert.equal(s.v.resets,1);}
});
test('rc522 firmware: swapping the card in the popover is noticed on the next poll',()=>{
 const r=boot('none');r.advance(300);
 assert.match(r.serialText(),/no card/);
 r.setPartProps('r',{card:'card2'});r.advance(500);
 assert.match(r.serialText(),/uid=07C56E2D/,r.serialText());
});
test('rc522: RST driven low by the sketch powers the chip down (MISO floats high), rising edge restarts it after about 1 ms',()=>{
 const f=fakeEnv();
 (f.env as {pinMode:(p:UnoPin)=>'input'|'output'}).pinMode=()=>'output';
 const m=createModels(circuit({SDA:'D10',RST:'D9'},{card:'card1'}),f.env).get('rc522-rfid1')!;
 const bus=f.spi[0]!,info={mode:0 as const,lsbFirst:false,clockHz:4_000_000,cycle:0};
 const readVersion=():number=>{m.onEdge!('D10',0,f.now());bus.transfer(0x80|(REG.Version<<1),info);const v=bus.transfer(0,info);m.onEdge!('D10',1,f.now());return v;};
 assert.equal(readVersion(),0x92);
 m.onEdge!('D9',0,f.now());
 assert.equal(readVersion(),0xff);
 const s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext')assert.equal(s.v.powered,false);
 m.onEdge!('D9',1,f.now());
 assert.equal(readVersion(),0x92,'registers answer again');
 const c=m.state();if(c.kind==='ext')assert.equal(c.v.resets,1);
 // the oscillator is still starting: PowerDown (CommandReg bit 4) reads 1 for the first millisecond
 m.onEdge!('D10',0,f.now());bus.transfer(0x80|(REG.Command<<1),info);const cmd=bus.transfer(0,info);m.onEdge!('D10',1,f.now());
 assert.equal(cmd&0x10,0x10);
});
