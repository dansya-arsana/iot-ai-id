import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {readFileSync} from 'node:fs';
import {createLabRunner} from '../apps/web/src/lab/sim/runner.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';
import {us} from '../apps/web/src/lab/sim/devices/types.js';
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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'ws2812-strip1',kind:'ws2812-strip',net,props}]});

const state=(m:{state:()=>unknown})=>{const s=m.state() as {kind:string;v:Record<string,unknown>};assert.equal(s.kind,'ext');return s.v;};

test('ws2812-strip: exact cycle edges decode to GRB pixels, no timing errors',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({DIN:'D6'}),f.env).get('ws2812-strip1')!;
 let t=0;
 // at 16 MHz: a 0 is 0.4 us high (6 cycles) + 0.85 us low (14); a 1 is 0.8 us high (13 cycles) + 0.45 us low (7)
 const bit=(b:number)=>{m.onEdge!('D6',1,t);t+=b?13:6;m.onEdge!('D6',0,t);t+=b?7:14;};
 const byte=(v:number)=>{for(let i=7;i>=0;i--)bit((v>>i)&1);};
 for(const px of [[0x11,0x22,0x33],[0xff,0,0x80]]){byte(px[1]!);byte(px[0]!);byte(px[2]!);}
 f.run(t+us(60));
 const v=state(m);
 assert.equal((v.leds as string).slice(0,12),'112233ff0080');
 assert.equal(v.frames,1);assert.equal(v.timingErrors,0);assert.equal(v.shape,'strip');
});
test('ws2812-strip: a pulse outside the datasheet window counts as a timing error; a low under 50 us does not latch',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({DIN:'D6'}),f.env).get('ws2812-strip1')!;
 let t=0;
 const pulse=(hi:number,lo:number)=>{f.at(t);m.onEdge!('D6',1,t);t+=hi;f.at(t);m.onEdge!('D6',0,t);t+=lo;};
 for(let i=0;i<24;i++)pulse(9,11);   // 0.56 us high: reads as a 0 but is 160 ns off T0H, over the 150 ns tolerance
 f.run(t+us(20));
 assert.equal(state(m).frames,0,'20 us of low is not a reset');
 f.run(t+us(60));
 const v=state(m);assert.equal(v.frames,1);assert.equal(v.timingErrors,24);
});
test('ws2812-strip: the pin must be DIN (a different wired pin sees nothing)',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({DIN:'D6'}),f.env).get('ws2812-strip1')!;
 m.onEdge!('D7',1,0);m.onEdge!('D7',0,13);f.run(us(100));
 assert.equal(state(m).frames,0);
});
const fx=JSON.parse(readFileSync(new URL('./fixtures/firmware/ws2812-strip-64.json',import.meta.url),'utf8')) as {toolchain:string;variant:never};
function boot(shape:string){
 const r=createLabRunner();
 r.load(fx.variant,{},{wires:[],parts:[{id:'w',kind:'ws2812-strip',net:{DIN:'D6'},props:{shape}}]},fx.toolchain);r.start();r.advance(60);
 const s=r.snapshot().parts.w!;assert.ok(s.kind==='ext');return s.kind==='ext'?s.v:{};
}
test('ws2812-strip: real firmware streams 64 pixels; stick keeps 8, ring 16, matrix all 64, with zero timing errors',()=>{
 const pix=(leds:string,i:number)=>leds.slice(i*6,i*6+6);
 // pixel i is R=i, G=2i, B=255-i
 const exp=(i:number)=>[i,2*i,255-i].map(v=>v.toString(16).padStart(2,'0')).join('');
 for(const [shape,n] of [['strip',8],['ring',16],['matrix',64]] as const){
  const v=boot(shape) as {leds:string;count:number;frames:number;timingErrors:number;shape:string;ma:number};
  assert.equal(v.shape,shape);assert.equal(v.count,n);
  assert.equal(v.leds.length,n*6,shape);
  assert.equal(pix(v.leds,0),exp(0));assert.equal(pix(v.leds,n-1),exp(n-1));
  assert.ok(v.frames>=1);assert.equal(v.timingErrors,0);assert.ok(v.ma>0);
 }
});

// ---------- the 3D part follows the decoded frame ----------
const g=globalThis as unknown as {document?:unknown};
const ctx2d:unknown=new Proxy(function(){},{get:()=>ctx2d,set:()=>true,apply:()=>ctx2d});
g.document??={createElement:()=>({width:0,height:0,getContext:()=>ctx2d,style:{}})};
test('ws2812-strip (3D): only the chosen layout is shown, and lit pixels glow in their own colour',async()=>{
 const {partModule}=await import('../apps/web/src/lab/scene/parts/index.js');
 const mod=partModule('ws2812-strip')!;
 const group=mod.build({shape:'ring'},{} as never);
 const kids=group.children.filter(k=>k.type==='Group'&&k.children.length>10);
 assert.equal(kids.filter(k=>k.visible).length,1,'one layout at a time');
 const v={shape:'ring',count:16,leds:'ff0000'.padEnd(16*6,'0'),frames:1,timingErrors:0,ma:20};
 mod.apply(group,{kind:'ext',type:'ws2812-strip',v} as never,16);
 const lit:number[]=[];
 group.traverse(o=>{const m=(o as {material?:{emissive?:{r:number};emissiveIntensity?:number}}).material;if(m&&m.emissive&&(m.emissiveIntensity??0)>0.1&&m.emissive.r>0.1)lit.push(m.emissive.r);});
 assert.equal(lit.length,1,'one LED lit '+lit.length);assert.ok(lit[0]!>0.9);
});
