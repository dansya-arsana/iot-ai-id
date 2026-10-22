import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {BoardPin,Circuit,FirmwareVariant} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';
import {createLabRunner} from '../apps/web/src/lab/sim/runner.js';
import {cid,crc16,crc7,csd} from '../apps/web/src/lab/sim/devices/microsd-module.js';
import {ms} from '../apps/web/src/lab/sim/devices/types.js';
import type {I2cSlave,SpiBinding} from '../apps/web/src/lab/sim/devices/types.js';

function fakeEnv(){
 const spi:SpiBinding[]=[],i2c:I2cSlave[]=[];
 let now=0;
 return {spi,env:{
  setPin:()=>undefined,setAdc:()=>undefined,schedule:()=>undefined,now:()=>now,
  watchLine:()=>undefined,attachI2c:(s:I2cSlave)=>{i2c.push(s);},attachSpi:(s:SpiBinding)=>{spi.push(s);},tapUart:()=>undefined,uartSend:()=>undefined,
 },at:(n:number)=>{now=n;}};
}
const circuit=(props:Record<string,string|number|boolean>,net:Partial<Record<string,BoardPin>>={CS:'D10'}):Circuit=>({wires:[],parts:[{id:'sd',kind:'microsd-module',net,props}]});
type V=Record<string,string|number|boolean|null>;

/** A card on CS D10 and a master that speaks SPI-mode commands one byte at a time. */
function rig(props:Record<string,string|number|boolean>={card:'sdhc',capacityGb:'8'}){
 const f=fakeEnv();
 const m=createModels(circuit(props),f.env).get('sd')!;
 const bus=f.spi[0]!;
 const info={mode:0 as const,lsbFirst:false,clockHz:250_000,cycle:0};
 const xfer=(b:number):number=>bus.transfer(b,{...info,cycle:f.env.now()});
 const st=():V=>{const s=m.state();assert.ok(s.kind==='ext');return (s as {v:V}).v;};
 const select=():void=>{m.onEdge!('D10',0,0);};
 const deselect=():void=>{m.onEdge!('D10',1,0);};
 /** send a 6-byte command (crc given or computed) and poll for R1 */
 const cmd=(idx:number,arg:number,crc?:number):{r1:number;wait:number}=>{
  const b=[0x40|idx,(arg>>>24)&255,(arg>>>16)&255,(arg>>>8)&255,arg&255];
  for(const x of b)xfer(x);
  xfer(crc??((crc7(b)<<1)|1));
  for(let i=0;i<10;i++){const r=xfer(0xff);if(!(r&0x80))return {r1:r,wait:i};}
  return {r1:0xff,wait:10};
 };
 const read=(n:number):number[]=>Array.from({length:n},()=>xfer(0xff));
 return {m,f,st,select,deselect,cmd,read,xfer,bus,info};
}
const init=(r:ReturnType<typeof rig>):void=>{
 r.select();r.cmd(0,0,0x95);r.cmd(8,0x1aa,0x87);
 r.f.at(0);r.cmd(55,0);r.cmd(41,0x40000000);   // first ACMD41 starts the 25 ms power-up
 r.f.at(ms(30));r.cmd(55,0);r.cmd(41,0x40000000);
};

test('microsd: crc helpers match the spec (CMD0 CRC 0x95, CMD8 CRC 0x87, CRC16 of zeros 0)',()=>{
 assert.equal((crc7([0x40,0,0,0,0])<<1)|1,0x95);
 assert.equal((crc7([0x48,0,0,1,0xaa])<<1)|1,0x87);
 assert.equal(crc16(new Uint8Array(512)),0);
 assert.equal(crc16([0x31,0x32,0x33,0x34,0x35,0x36,0x37,0x38,0x39]),0x31c3);   // CRC-16/XMODEM check value
 const c=csd('sdhc',8192);assert.equal(c.length,16);assert.equal(c[15]&1,1);assert.equal(c[15]>>1,crc7(c.slice(0,15)));
 const d=cid();assert.equal(d[15]>>1,crc7(d.slice(0,15)));
});
test('microsd: CMD0 with the right CRC enters SPI mode and answers R1 idle after one 0xFF (NCR = 1); a wrong CRC is silence',()=>{
 const r=rig();r.select();
 assert.equal(r.st().phase,'sd-mode');
 const bad=r.cmd(0,0,0x00);assert.equal(bad.r1,0xff);assert.equal(r.st().badCrc,1);assert.equal(r.st().phase,'sd-mode');
 const ok=r.cmd(0,0,0x95);assert.equal(ok.r1,0x01);assert.equal(ok.wait,1,'first read is 0xFF, the second is R1');
 assert.equal(r.st().phase,'idle');
});
test('microsd: commands before CMD0 are ignored (the card is still in SD mode); a deselected card hears nothing',()=>{
 const r=rig();
 assert.equal(r.xfer(0xff),0xff);   // CS high: the bus never delivers the byte
 r.select();
 assert.equal(r.cmd(8,0x1aa,0x87).r1,0xff);
 assert.equal(r.cmd(58,0).r1,0xff);
});
test('microsd: CMD8 echoes the voltage range and check pattern (R7); a v1 card says illegal command',()=>{
 const r=rig();r.select();r.cmd(0,0,0x95);
 const c8=r.cmd(8,0x1aa,0x87);assert.equal(c8.r1,0x01);assert.deepEqual(r.read(4),[0,0,1,0xaa]);
 const v1=rig({card:'sdsc1',capacityGb:'1'});v1.select();v1.cmd(0,0,0x95);
 assert.equal(v1.cmd(8,0x1aa,0x87).r1,0x05);   // idle + illegal command
 const odd=rig();odd.select();odd.cmd(0,0,0x95);assert.equal(odd.cmd(8,0x2aa).r1,0xff);   // a voltage range it does not take: silence
});
test('microsd: ACMD41 stays idle for 25 ms, then ready; OCR shows power-up done and CCS for an SDHC card that was asked for HCS',()=>{
 const r=rig();r.select();r.cmd(0,0,0x95);r.cmd(8,0x1aa,0x87);r.read(4);
 r.f.at(0);r.cmd(55,0);assert.equal(r.cmd(41,0x40000000).r1,0x01);
 r.f.at(ms(10));r.cmd(55,0);assert.equal(r.cmd(41,0x40000000).r1,0x01,'still busy at 10 ms');
 assert.equal(r.cmd(58,0).r1,0x01);assert.deepEqual(r.read(4),[0x00,0xff,0x80,0x00]);   // OCR: not ready yet
 r.f.at(ms(26));r.cmd(55,0);assert.equal(r.cmd(41,0x40000000).r1,0x00);
 assert.equal(r.st().phase,'ready');
 assert.equal(r.cmd(58,0).r1,0x00);assert.deepEqual(r.read(4),[0xc0,0xff,0x80,0x00]);
 // CMD55 sets the application flag for exactly one following command
 assert.equal(r.cmd(41,0).r1,0x04,'a bare command 41 without CMD55 is illegal');
});
test('microsd: a standard-capacity v2 card does not report CCS even when HCS was asked; sizes cap at 2 GB',()=>{
 const r=rig({card:'sdsc2',capacityGb:'32'});r.select();r.cmd(0,0,0x95);r.cmd(8,0x1aa,0x87);r.read(4);
 r.f.at(0);r.cmd(55,0);r.cmd(41,0x40000000);r.f.at(ms(30));r.cmd(55,0);r.cmd(41,0x40000000);
 r.cmd(58,0);assert.deepEqual(r.read(4),[0x80,0xff,0x80,0x00]);
 assert.equal(r.st().capacityMb,2048);
 assert.equal(r.st().cardType,'SDSC v2');
});
test('microsd: CMD9 returns a 16-byte CSD with CRC7 and CRC16 behind the 0xFE token; the size decodes back to the card size',()=>{
 for(const [card,gb,mb] of [['sdhc','8',8192],['sdhc','32',30436],['sdsc2','2',2048],['sdsc1','1',1024]] as const){
  const r=rig({card,capacityGb:gb});init(r);
  assert.equal(r.cmd(9,0).r1,0x00,card);
  let tok=0xff;for(let i=0;i<20&&tok!==0xfe;i++)tok=r.xfer(0xff);
  assert.equal(tok,0xfe);
  const c=r.read(16);const crc=r.read(2);
  assert.equal(c[15]>>1,crc7(c.slice(0,15)));assert.equal((crc[0]!<<8)|crc[1]!,crc16(c));
  let size:number;
  if((c[0]!>>6)===1)size=((((c[7]!&0x3f)<<16)|(c[8]!<<8)|c[9]!)+1)/2;
  else{const cs=((c[6]!&3)<<10)|(c[7]!<<2)|(c[8]!>>6),mult=((c[9]!&3)<<1)|(c[10]!>>7),bl=c[5]!&15;size=((cs+1)*2**(mult+2)*2**bl)/2**20;}
  assert.equal(size,mb,card);
 }
});
test('microsd: CMD17 reads a blank block with token, 512 zeros and CRC16 0; CMD24 writes and reads back; out-of-range is a parameter error',()=>{
 const r=rig();init(r);
 assert.equal(r.cmd(17,0).r1,0x00);
 let tok=0xff;for(let i=0;i<10&&tok!==0xfe;i++)tok=r.xfer(0xff);assert.equal(tok,0xfe);
 assert.ok(r.read(512).every(b=>b===0));assert.deepEqual(r.read(2),[0,0]);
 // write block 7
 assert.equal(r.cmd(24,7).r1,0x00);
 r.xfer(0xff);r.xfer(0xfe);
 const data=Array.from({length:512},(_,i)=>(i*5+1)&255),c=crc16(data);
 for(const b of data)r.xfer(b);r.xfer(c>>8);r.xfer(c&255);
 assert.equal(r.xfer(0xff)&0x1f,0x05,'data accepted');
 r.f.at(ms(32));
 assert.equal(r.xfer(0xff),0x00,'busy while programming (3 ms)');
 assert.equal(r.st().blocksWritten,1);
 r.f.at(ms(34));assert.equal(r.xfer(0xff),0xff);
 assert.equal(r.cmd(17,7).r1,0x00);tok=0xff;for(let i=0;i<10&&tok!==0xfe;i++)tok=r.xfer(0xff);
 assert.deepEqual(r.read(512),data);
 r.read(2);
 assert.equal(r.cmd(17,0x7fffffff).r1,0x40);
 // a standard-capacity card is byte addressed: an address that is not a multiple of 512 is an address error
 const s=rig({card:'sdsc2',capacityGb:'2'});init(s);assert.equal(s.cmd(17,513).r1,0x20);
});
test('microsd: block commands before the card left idle are illegal; CMD59 turns CRC checking on for all commands',()=>{
 const r=rig();r.select();r.cmd(0,0,0x95);
 assert.equal(r.cmd(17,0).r1,0x05);
 r.cmd(59,1);assert.equal(r.cmd(16,512,0x00).r1&0x08,0x08,'CRC error bit once CRC is on');
 assert.equal(r.cmd(16,512).r1&0x08,0);
});
test('microsd: no card in the slot or wrong SPI mode means MISO stays 0xFF',()=>{
 const r=rig({card:'none',capacityGb:'8'});r.select();
 assert.equal(r.cmd(0,0,0x95).r1,0xff);assert.equal(r.st().phase,'empty');assert.equal(r.st().cardType,'none');
 const q=rig();q.select();const bad=q.bus.transfer(0x40,{...q.info,mode:1});assert.equal(bad,0xff);assert.equal(q.st().badFrames,1);
});
test('microsd: swapping the card re-powers it (SPI mode forgotten) and fast clocks during init are flagged',()=>{
 const r=rig();r.select();r.cmd(0,0,0x95);assert.equal(r.st().phase,'idle');
 (r.m.props as Record<string,unknown>).card='sdsc1';
 assert.equal(r.st().phase,'sd-mode');
 const f=rig();f.select();
 const fast={...f.info,clockHz:4_000_000};
 for(const x of [0x40,0,0,0,0,0x95])f.bus.transfer(x,fast);
 assert.equal(f.st().fastInit,true);
});

// ---------- real firmware ----------
const fixture=():{toolchain:string;variant:FirmwareVariant}=>JSON.parse(readFileSync(new URL('./fixtures/firmware/microsd-init.json',import.meta.url),'utf8'));
function boot(props:Record<string,string|number|boolean>){
 const fx=fixture(),r=createLabRunner();
 r.load(fx.variant,{},{wires:[],parts:[{id:'sd',kind:'microsd-module',net:{CS:'D10',SCK:'D13',MOSI:'D11',MISO:'D12'},props}]},fx.toolchain);r.start();
 return r;
}
test('microsd firmware: a hand-written SPI driver sees card present, the card type and size, a blank block and a raw block write',()=>{
 const r=boot({card:'sdhc',capacityGb:'8'});
 for(let i=0;i<30&&!/done/.test(r.serialText());i++)r.advance(100);
 const t=r.serialText();
 assert.match(t,/cmd0=01/,t);assert.match(t,/cmd8=01 000001AA/,t);assert.match(t,/acmd41=00 tries=\d+/,t);
 assert.match(t,/ocr=C0FF8000/,t);assert.match(t,/size=8192MB/,t);assert.match(t,/blk0 sum=0/,t);
 assert.match(t,/write=05/,t);assert.match(t,/busy=yes/,t);
 // sum of (i*3) & 255 for i in 0..511
 const sum=Array.from({length:512},(_,i)=>(i*3)&255).reduce((a,b)=>a+b,0);
 assert.match(t,new RegExp(`blk5 sum=${sum}`),t);assert.match(t,/done/);
 const s=r.snapshot().parts.sd!;assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.equal(s.v.phase,'ready');assert.equal(s.v.cardType,'SDHC');assert.equal(s.v.blocksWritten,1);assert.equal(s.v.blocksRead,2);assert.equal(s.v.fastInit,false);assert.ok(Number(s.v.initClocks)>=80,'80 idle clocks counted from SCK pulses');}
});
test('microsd firmware: an old v1 card is detected by the illegal CMD8, an empty slot reports no card',()=>{
 const v1=boot({card:'sdsc1',capacityGb:'1'});
 for(let i=0;i<30&&!/done/.test(v1.serialText());i++)v1.advance(100);
 assert.match(v1.serialText(),/cmd8=05/);assert.match(v1.serialText(),/ocr=80FF8000/);assert.match(v1.serialText(),/size=1024MB/);
 const none=boot({card:'none',capacityGb:'8'});none.advance(200);
 assert.match(none.serialText(),/cmd0=FF/);assert.match(none.serialText(),/no card/);
});
