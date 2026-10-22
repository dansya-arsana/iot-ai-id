/**
 * Bus helpers on real firmware: SPI (AVRSPI), the clocked two-wire bus (TM1637 style and an HX711 style reader) and the WS2812 stream.
 * Each fixture sketch is compiled by `npm run lab:firmware -- --raw tests/fixtures/sketches/<name>.ino tests/fixtures/firmware/<name>.json`
 * and driven by a small test-only device built on the helpers a part author would use.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {BoardPin,Circuit,FirmwareVariant,PartSpec} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/runner.js';
import {TwoWireSlave,Ws2812Decoder,defineDevice,registerDevice,us} from '../apps/web/src/lab/sim/devices/index.js';

const fixture=(n:string):{toolchain:string;variant:FirmwareVariant}=>JSON.parse(readFileSync(new URL(`./fixtures/firmware/${n}.json`,import.meta.url),'utf8'));
const part=(id:string,kind:string,net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):PartSpec=>({id,kind,net,props});
function boot(name:string,c:Circuit){
 const fx=fixture(name),r=createLabRunner();
 r.load(fx.variant,{},c,fx.toolchain);r.start();
 return r;
}

// ---------- SPI ----------
registerDevice(defineDevice({
 kind:'t-spi',protocol:'spi',pins:['VCC','GND','SCK','MOSI','MISO','CS'],inputs:[],defaults:{value:42},
 create(ctx){
  const regs=new Uint8Array(16);regs[0x0f]=0x58;
  let reg=0,read=false,selected=false,mode=-1,bytes=0,selects=0;
  return {
   state:()=>({selected,mode,bytes,selects}),
   spi:{
    cs:'CS',
    onSelect(s){selected=s;if(s)selects++;},
    onTransfer(mosi,info){
     mode=info.mode;bytes++;regs[0]=Number(ctx.props.value);
     if(info.index===0){read=(mosi&0x80)!==0;reg=mosi&0x0f;return 0xff;}
     return read?regs[(reg+info.index-1)&0x0f]!:0xff;
    },
   },
  };
 },
}));
test('spi: AVRSPI master reads a register through chip select D10, in mode 0, MSB first',()=>{
 const r=boot('spi-id',{wires:[],parts:[part('s','t-spi',{CS:'D10',SCK:'D13',MOSI:'D11',MISO:'D12'},{value:0x2a})]});
 r.advance(400);
 assert.match(r.serialText(),/ready/);
 assert.match(r.serialText(),/id=58 next=2A/);
 const s=r.snapshot().parts.s!;assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.equal(s.v.mode,0);assert.ok(Number(s.v.selects)>=3);assert.equal(s.v.selected,false);assert.ok(Number(s.v.bytes)>=9);}
 // SCK is visible on D13 during a byte
 assert.ok(r.snapshot().pins.D13.freqHz>0||r.snapshot().pins.D13.duty>0,'SCK activity shows on D13');
});
test('spi: CS high means the device never sees a byte; no device selected reads 0xFF',()=>{
 // CS wired to D9 but the sketch drives D10: the device is never selected
 const r=boot('spi-id',{wires:[],parts:[part('s','t-spi',{CS:'D9'},{value:1})]});
 r.advance(300);
 assert.match(r.serialText(),/id=FF next=FF/);
 const s=r.snapshot().parts.s!;if(s.kind==='ext')assert.equal(s.v.bytes,0);
});

// ---------- two-wire bus (TM1637 style) ----------
registerDevice(defineDevice({
 kind:'t-tm',protocol:'twowire',pins:['VCC','GND','CLK','DIO'],inputs:[],
 create(ctx){
  const got:number[]=[];let frames=0,stops=0;
  const bus=new TwoWireSlave(ctx,{clk:'CLK',data:'DIO',ack:true},{onStart(){frames++;},onByte(b){got.push(b);return true;},onStop(){stops++;}});
  return {state:()=>({frames,stops,bytes:got.map(b=>b.toString(16)).join(','),held:bus.holdingLow}),onPinChange:(p,l,c)=>bus.edge(p,l,c)};
 },
}));
test('twowire: a TM1637 style frame is decoded (start, bytes LSB first, ACK on the 9th clock, stop)',()=>{
 const r=boot('twowire-tm',{wires:[],parts:[part('t','t-tm',{CLK:'D2',DIO:'D3'})]});
 r.advance(120);
 assert.match(r.serialText(),/acks=6/,r.serialText());
 const s=r.snapshot().parts.t!;assert.ok(s.kind==='ext');
 if(s.kind==='ext'){
  assert.equal(String(s.v.bytes).split(',').slice(0,6).join(','),'40,c0,3f,6,5b,8f');
  assert.equal(s.v.frames,3);assert.equal(s.v.stops,3);
 }
});
test('twowire: a device wired to the wrong pins decodes nothing',()=>{
 const r=boot('twowire-tm',{wires:[],parts:[part('t','t-tm',{CLK:'D7',DIO:'D8'})]});   // the sketch drives D2 and D3
 r.advance(120);
 const s=r.snapshot().parts.t!;assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.equal(s.v.frames,0);assert.equal(s.v.bytes,'');}
});

// ---------- HX711 style reader ----------
registerDevice(defineDevice({
 kind:'t-hx',protocol:'twowire',pins:['VCC','GND','SCK','DOUT'],inputs:[],defaults:{raw:1193046},
 create(ctx){
  const bus=new TwoWireSlave(ctx,{clk:'SCK',data:'DOUT',framing:'free'});
  let ready=false,reads=0,sinceReady=0;
  const arm=():void=>{
   const v=Number(ctx.props.raw)|0,bits:number[]=[];
   for(let i=23;i>=0;i--)bits.push((v>>i)&1);
   bus.pull(true);ready=true;
   bus.shiftOut(bits,{on:'rising',done:()=>{bus.pull(false);ready=false;reads++;sinceReady=0;}});
  };
  arm();
  return {
   state:()=>({ready,reads}),
   onPinChange:(p,l,c)=>bus.edge(p,l,c),
   tick(cycles){sinceReady+=cycles;if(!ready&&sinceReady>us(50_000))arm();},
  };
 },
}));
test('twowire: an HX711 style reader gets 24 bits MSB first, sign extended, one conversion per ready',()=>{
 const r=boot('hx711-read',{wires:[],parts:[part('h','t-hx',{SCK:'D4',DOUT:'D5'},{raw:1193046})]});
 r.advance(400);
 assert.match(r.serialText(),/raw=1193046/,r.serialText());
 const neg=boot('hx711-read',{wires:[],parts:[part('h','t-hx',{SCK:'D4',DOUT:'D5'},{raw:-1000})]});
 neg.advance(400);
 assert.match(neg.serialText(),/raw=-1000/,neg.serialText());
 const s=r.snapshot().parts.h!;if(s.kind==='ext')assert.ok(Number(s.v.reads)>=2,'several conversions');
});

// ---------- WS2812 ----------
registerDevice(defineDevice({
 kind:'t-ws',protocol:'ws2812',pins:['VCC','DIN','GND'],inputs:[],
 create(ctx){
  let leds='',frames=0,errors=0,bits=0;
  const din=ctx.pin('DIN');
  const dec=new Ws2812Decoder({count:3,schedule:(c,cb)=>ctx.schedule(c,cb),onFrame(f){leds=f.pixels.map(p=>p.map(v=>v.toString(16).padStart(2,'0')).join('')).join(',');frames++;errors+=f.timingErrors;bits=f.bits;}});
  return {state:()=>({leds,frames,errors,bits}),onPinChange:(p,l,c)=>{if(p===din)dec.edge(l,c);}};
 },
}));
test('ws2812: 800 kHz bit-banged frame is decoded from cycle-stamped edges (GRB, no timing errors)',()=>{
 const r=boot('ws2812-three',{wires:[],parts:[part('w','t-ws',{DIN:'D6'})]});
 r.advance(60);
 const s=r.snapshot().parts.w!;assert.ok(s.kind==='ext');
 if(s.kind==='ext'){
  assert.equal(s.v.leds,'ff0000,008040,112233');
  assert.equal(s.v.bits,72);assert.equal(s.v.errors,0);
  assert.ok(Number(s.v.frames)>=1);
 }
});

// ---------- Nano ----------
test('nano: the same ATmega328P runs a Nano-core sketch that reads A6 and A7 (analog input only)',()=>{
 const c:Circuit={board:'nano',wires:[],parts:[part('p6','potentiometer',{VCC:'5V',SIG:'A6',GND:'GND'},{value:1023}),part('p7','potentiometer',{VCC:'5V',SIG:'A7',GND:'GND'},{value:256})]};
 const r=boot('nano-a6',c);
 r.advance(300);
 const m=/a6=(\d+) a7=(\d+)/.exec(r.serialText());
 assert.ok(m,r.serialText());
 assert.ok(Math.abs(Number(m![1])-1023)<=1);assert.ok(Math.abs(Number(m![2])-256)<=1);
});
test('esp32 is a model only: the runner refuses to load it',()=>{
 const fx=fixture('nano-a6'),r=createLabRunner();
 assert.throws(()=>r.load(fx.variant,{},{board:'esp32',wires:[],parts:[]},fx.toolchain),/model only/);
});
