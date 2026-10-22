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
import {readFileSync} from 'node:fs';
import type {FirmwareVariant} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/runner.js';
import {hx711Code} from '../apps/web/src/lab/sim/devices/hx711-loadcell.js';
const SCK='D4' as UnoPin,DT='D5' as UnoPin;
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'hx',kind:'hx711-loadcell',net,props}]});
const WIRED={GND:'GND',DT:'D5',SCK:'D4',VCC:'5V'} as const;
const ms=(n:number):number=>n*16000,us=(n:number):number=>n*16;
function rig(props:Record<string,string|number|boolean>={},net:Partial<Record<string,BoardPin>>=WIRED){
 const f=fakeEnv();
 const m=createModels(circuit(net,props),f.env).get('hx')!;
 const dt=():number=>{for(let i=f.log.length-1;i>=0;i--)if(f.log[i]!.pin===DT)return f.log[i]!.level?1:0;return 1;};
 let t=0;
 const to=(cy:number):void=>{f.run(cy);t=cy;m.update({samples:EMPTY(),dtSec:0,cycles:cy});};
 const edge=(level:0|1):void=>{f.at(t);m.onEdge?.(SCK,level,t);};
 /** one clock pulse, 1 us high and 1 us low; returns DT while SCK is high (what a sketch reads) */
 const pulse=(highUs=1):number=>{edge(1);const v=dt();t+=us(highUs);edge(0);t+=us(1);return v;};
 const read=(extra=1):number=>{let v=0;for(let i=0;i<24;i++)v=(v<<1)|pulse();for(let i=0;i<extra;i++)pulse();return v&0x800000?v-0x1000000:v;};
 return {f,m,dt,to,pulse,read,edge,now:()=>t,adv:(c:number)=>to(t+c)};
}
const st=(m:{state():unknown}):Record<string,unknown>=>{const s=m.state() as {v?:Record<string,unknown>};return s.v??{};};

test('hx711-loadcell: DT stays high through the 400 ms settling, then goes low when a result is ready',()=>{
 const r=rig({weight:1000});
 r.to(ms(399));assert.equal(r.dt(),1,'still settling');
 r.to(ms(401));assert.equal(r.dt(),0,'first result ready');
 assert.equal(st(r.m).ready,true);
});
test('hx711-loadcell: 24 bits MSB first in two-complement, pulse 25 sends DT high; 1 kg on a 5 kg bar at 5 V, gain 128',()=>{
 const r=rig({weight:1000,capacity:'5'});
 r.to(ms(401));
 const code=r.read();
 // 1 mV/V x 5 V x 0.2 = 1 mV across the bridge; full scale at gain 128 is 0.5 x 5 / 128 = 19.53 mV
 assert.equal(code,hx711Code(1000,5,5,128));
 assert.equal(code,Math.round(1/19.53125*8388607));
 assert.equal(r.dt(),1,'released after the 25th pulse');
 assert.equal(st(r.m).reads,1);
});
test('hx711-loadcell: DT is low before any clock and an overload clamps at 0x7FFFFF',()=>{
 const r=rig({weight:5000,capacity:'5'});
 r.to(ms(401));assert.equal(r.dt(),0,'ready: DT low before any clock');
 const r2=rig({weight:5000,capacity:'1'});
 r2.to(ms(401));assert.equal(r2.read(),8388607);
});
test('hx711-loadcell: proportional to weight, independent of the supply (the bridge is ratiometric), zero at no load',()=>{
 const a=rig({weight:2000,capacity:'10'});a.to(ms(401));const c1=a.read();
 const b=rig({weight:4000,capacity:'10'});b.to(ms(401));const c2=b.read();
 assert.ok(Math.abs(c2-2*c1)<=2);
 const lo=rig({weight:2000,capacity:'10'},{GND:'GND',DT:'D5',SCK:'D4',VCC:'3V3'});lo.to(ms(401));
 const c3=lo.read();
 assert.ok(Math.abs(c3-c1)<=2,`${c3} vs ${c1}`);
 const zero=rig({weight:0});zero.to(ms(401));assert.equal(zero.read(),0);
});
test('hx711-loadcell: a result nobody reads is replaced by a fresh one every 100 ms (weight changed meanwhile)',()=>{
 const r=rig({weight:0});
 r.to(ms(401));r.m.props.weight=1000;
 r.to(ms(520));
 assert.equal(r.read(),hx711Code(1000,5,5,128));
});
test('hx711-loadcell: pulses 25 / 26 / 27 select the NEXT conversion (A128, B32, A64)',()=>{
 const r=rig({weight:1000});
 r.to(ms(401));
 const g128=r.read(1);
 r.to(ms(520));assert.equal(st(r.m).gain,128);
 assert.equal(r.read(1),g128,'still gain 128');
 r.to(ms(640));
 r.read(3);                                  // 27 pulses: gain 64 next
 r.to(ms(760));assert.equal(st(r.m).gain,64);
 assert.equal(r.read(1),hx711Code(1000,5,5,64));
 assert.ok(Math.abs(hx711Code(1000,5,5,64)*2-g128)<=2,'half the gain, half the code');
 r.to(ms(900));r.read(2);                    // 26 pulses: channel B, gain 32, nothing wired: reads 0
 r.to(ms(1020));assert.equal(st(r.m).channel,'B');assert.equal(r.read(1),0);
});
test('hx711-loadcell: SCK high for more than 60 us powers it down (DT high); released it resets to gain 128 after 400 ms',()=>{
 const r=rig({weight:1000});
 r.to(ms(401));r.read(3);r.to(ms(520));assert.equal(st(r.m).gain,64);
 r.to(ms(600));r.edge(1);
 r.adv(us(40));assert.equal(st(r.m).poweredDown,false,'40 us is still a clock pulse');
 r.adv(us(40));
 assert.equal(st(r.m).poweredDown,true);assert.equal(r.dt(),1,'DT high while powered down');
 r.adv(ms(300));assert.equal(r.dt(),1,'no conversions while down');
 r.edge(0);
 assert.equal(st(r.m).poweredDown,false);
 r.adv(ms(399));assert.equal(r.dt(),1,'settling');
 r.adv(ms(2));assert.equal(r.dt(),0,'ready after 400 ms');
 assert.equal(st(r.m).gain,128,'reset gain');
 assert.equal(r.read(),hx711Code(1000,5,5,128));
});
test('hx711-loadcell: without VCC nothing runs and DT stays high; the capacity choice scales the code',()=>{
 const r=rig({weight:1000},{GND:'GND',DT:'D5',SCK:'D4'});
 r.to(ms(900));assert.equal(r.dt(),1);assert.equal(st(r.m).powered,false);
 const w=rig({weight:1000,capacity:'20'});w.to(ms(401));
 assert.equal(w.read(),hx711Code(1000,20,5,128));
});
test('hx711-loadcell: the pure code function clamps at full scale',()=>{
 assert.equal(hx711Code(1e6,1,5,128),8388607);
 assert.equal(hx711Code(0,5,5,128),0);
});

// ---------- real firmware: our own minimal HX711 reader compiled for the Uno core ----------
const fixture=(n:string):{toolchain:string;variant:FirmwareVariant}=>JSON.parse(readFileSync(new URL(`./fixtures/firmware/${n}.json`,import.meta.url),'utf8'));
function boot(name:string,props:Record<string,string|number|boolean>){
 const fx=fixture(name),r=createLabRunner();
 r.load(fx.variant,{},{wires:[],parts:[{id:'hx',kind:'hx711-loadcell',net:{GND:'GND',DT:'D5',SCK:'D4',VCC:'5V'},props}]},fx.toolchain);r.start();
 return r;
}
test('hx711-loadcell: real firmware reads 1000 g as the datasheet code over the two wires, repeatedly',()=>{
 const r=boot('hx711-read',{weight:1000,capacity:'5'});
 r.advance(1200);
 const lines=r.serialText().split(/\r?\n/).filter(l=>/^raw=-?\d+$/.test(l));
 assert.ok(lines.length>=5,r.serialText());
 for(const l of lines)assert.equal(l,`raw=${hx711Code(1000,5,5,128)}`);
 const s=r.snapshot().parts.hx!;assert.ok(s.kind==='ext');if(s.kind==='ext')assert.ok(Number(s.v.reads)>=5);
});
test('hx711-loadcell: the 400 ms settle delays the first reading, and a new weight shows up in the next result',()=>{
 const r=boot('hx711-read',{weight:0});
 r.advance(300);assert.ok(!/raw=\d/.test(r.serialText()),'nothing before the chip has settled');
 r.advance(500);assert.match(r.serialText(),/raw=0\b/);
 r.setPartProps('hx',{weight:2500});
 r.advance(400);
 assert.match(r.serialText(),new RegExp(`raw=${hx711Code(2500,5,5,128)}\\b`),r.serialText());
});
test('hx711-loadcell: real firmware selecting gain 64 with 27 pulses gets half the code from the second reading on',()=>{
 const r=boot('hx711-gain',{weight:1000,capacity:'5'});
 r.advance(1500);
 const v=r.serialText().split(/\r?\n/).filter(l=>/^raw=-?\d+$/.test(l)).map(l=>Number(l.slice(4)));
 assert.equal(v[0],hx711Code(1000,5,5,128),'first read: power-on gain 128');
 assert.ok(v.length>=4);
 for(const x of v.slice(1))assert.equal(x,hx711Code(1000,5,5,64));
});
