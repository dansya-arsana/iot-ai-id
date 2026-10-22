/** BMP280: register map, chip id 0x58, address by SDO, modes, oversampling, IIR, Bosch compensation; then real firmware that runs the integer formulas. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {BoardPin,Circuit,FirmwareVariant,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';
import {createLabRunner} from '../apps/web/src/lab/sim/runner.js';
import {CAL,compT,compP,tFine,rawFromPhysical,measMs,T_STANDBY} from '../apps/web/src/lab/sim/devices/bmp280.js';
import {ms} from '../apps/web/src/lab/sim/devices/types.js';
import type {I2cSlave} from '../apps/web/src/lab/sim/devices/types.js';

function fakeEnv(){
 const events:{at:number;cb:()=>void}[]=[];
 let now=0;
 const i2c:I2cSlave[]=[];
 return {i2c,
  env:{
   setPin:(_p:UnoPin,_l:boolean)=>undefined,setAdc:(_c:number,_v:number)=>undefined,
   schedule:(c:number,cb:()=>void)=>{events.push({at:now+c,cb});events.sort((a,b)=>a.at-b.at);},now:()=>now,
   watchLine:()=>undefined,attachI2c:(s:I2cSlave)=>{i2c.push(s);},
  },
  run(to:number){while(events.length&&events[0]!.at<=to){const e=events.shift()!;now=e.at;e.cb();}now=to;},
  get now(){return now;},
 };
}
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'bmp2801',kind:'bmp280',net,props}]});
const setup=(net:Partial<Record<string,BoardPin>>={SDA:'A4',SCL:'A5'},props:Record<string,string|number|boolean>={})=>{
 const f=fakeEnv();const m=createModels(circuit(net,props),f.env).get('bmp2801')!;return {f,m,bus:f.i2c[0]!};
};
const wr=(b:I2cSlave,reg:number,v:number)=>{b.onStart!(false,true);b.onWrite(reg);b.onWrite(v);b.onStop!();};
function rd(b:I2cSlave,reg:number,n:number){
 b.onStart!(false,true);b.onWrite(reg);b.onStart!(true,false);
 const out:number[]=[];for(let i=0;i<n;i++)out.push(b.onRead(i<n-1));b.onStop!();return out;
}
const s16=(v:number)=>v>32767?v-65536:v;
const ST=(m:{state():{kind:string}}):Record<string,number|boolean|string|null>=>{const s=m.state() as {kind:string;v?:Record<string,number|boolean|string|null>};return s.v??{};};
const decode=(b:number[])=>({p:(b[0]!<<12)|(b[1]!<<4)|(b[2]!>>4),t:(b[3]!<<12)|(b[4]!<<4)|(b[5]!>>4)});

test('bmp280: chip id 0x58, address 0x76 or 0x77 by SDO, soft reset',()=>{
 const a=setup();assert.equal(a.bus.address,0x76);assert.deepEqual(rd(a.bus,0xd0,1),[0x58]);
 assert.equal(setup({SDA:'A4',SCL:'A5',SDO:'5V'}).bus.address,0x77);
 assert.equal(setup({SDA:'A4',SCL:'A5',SDO:'GND'}).bus.address,0x76);
 wr(a.bus,0xf5,0x14);assert.equal(rd(a.bus,0xf5,1)[0],0x14);
 wr(a.bus,0xe0,0xb6);assert.equal(rd(a.bus,0xf5,1)[0],0,'reset clears config');
 wr(a.bus,0xe0,0x00);// any other value does nothing
 wr(a.bus,0xd0,0x11);assert.equal(rd(a.bus,0xd0,1)[0],0x58,'id is read-only');
 assert.deepEqual(rd(a.bus,0xa0,2),[0,0],'unmapped registers read 0');
});
test('bmp280: status: im_update for about 2 ms after power-on, measuring while a conversion runs',()=>{
 const {f,bus}=setup();
 assert.equal(rd(bus,0xf3,1)[0]&1,1);
 f.run(ms(2.5));assert.equal(rd(bus,0xf3,1)[0],0);
 wr(bus,0xf4,(2<<5)|(5<<2)|1);
 assert.equal(rd(bus,0xf3,1)[0]&8,8,'measuring');
 f.run(f.now+ms(measMs(2,5))+1);assert.equal(rd(bus,0xf3,1)[0]&8,0);
});
test('bmp280: calibration 0x88..0x9F in the chip layout (T1 and P1 unsigned, the rest signed)',()=>{
 const {bus}=setup();const b=rd(bus,0x88,24);
 const w=(i:number)=>b[i]!|b[i+1]!<<8;
 assert.equal(w(0),CAL.T1);assert.equal(s16(w(2)),CAL.T2);assert.equal(s16(w(4)),CAL.T3);
 assert.equal(w(6),CAL.P1);assert.equal(s16(w(8)),CAL.P2);assert.equal(s16(w(10)),CAL.P3);assert.equal(s16(w(12)),CAL.P4);
 assert.equal(s16(w(14)),CAL.P5);assert.equal(s16(w(16)),CAL.P6);assert.equal(s16(w(18)),CAL.P7);assert.equal(s16(w(20)),CAL.P8);assert.equal(s16(w(22)),CAL.P9);
 assert.ok(CAL.P1>32767,'P1 is unsigned: it does not fit a signed 16-bit word');
});
test('bmp280: power-on data registers hold the skipped value 0x80000',()=>{
 const {bus}=setup();assert.deepEqual(rd(bus,0xf7,6),[0x80,0,0,0x80,0,0]);
});
test('bmp280: forced mode converts once, returns to sleep, and the Bosch formulas read the popover values back',()=>{
 for(const [t,p] of [[25,1013],[-20,850],[60,300],[0,1100],[85,700]] as const){
  const {f,m,bus}=setup({SDA:'A4',SCL:'A5'},{temperature:t,pressure:p});
  wr(bus,0xf4,(5<<5)|(5<<2)|1);               // x16, x16, forced
  assert.equal(rd(bus,0xf4,1)[0]&3,1);
  f.run(f.now+ms(measMs(5,5))+1);
  assert.equal(rd(bus,0xf4,1)[0]&3,0,'mode bits fall back to sleep');
  const raw=decode(rd(bus,0xf7,6));
  const ct=compT(raw.t);
  assert.ok(Math.abs(ct/100-t)<0.02,`T ${ct/100} vs ${t}`);
  assert.ok(Math.abs(compP(raw.p,tFine(raw.t))/256/100-p)<0.05,'pressure within 0.05 hPa');
  assert.equal(ST(m).conversions,1);
 }
});
test('bmp280: oversampling sets the resolution; skipped channel reads 0x80000; conversion time follows the datasheet formula',()=>{
 const {f,bus}=setup({SDA:'A4',SCL:'A5'},{temperature:21.37,pressure:987.6});
 wr(bus,0xf4,(1<<5)|(1<<2)|1);f.run(f.now+ms(measMs(1,1))+1);
 const x1=decode(rd(bus,0xf7,6));
 assert.equal(x1.t&0xf,0,'x1: 16 bit, the low 4 bits are zero');assert.equal(x1.p&0xf,0);
 wr(bus,0xf4,(0<<5)|(3<<2)|1);f.run(f.now+ms(measMs(0,3))+1);
 const skipT=decode(rd(bus,0xf7,6));assert.equal(skipT.t,0x80000,'temperature skipped');assert.ok(skipT.p!==0x80000);
 assert.equal(+measMs(1,1).toFixed(3),+(1.25+2.3+2.3+0.575).toFixed(3));
 assert.equal(+measMs(1,0).toFixed(3),3.55,'temperature only');
 // both skipped: nothing happens
 wr(bus,0xf4,1);assert.equal(rd(bus,0xf3,1)[0]&8,0);
});
test('bmp280: normal mode converts again after the standby time and follows popover changes; sleep stops it',()=>{
 const {f,m,bus}=setup({SDA:'A4',SCL:'A5'},{temperature:20,pressure:1000});
 wr(bus,0xf5,0<<5);                                   // t_sb 0.5 ms, filter off
 wr(bus,0xf4,(2<<5)|(2<<2)|3);
 f.run(f.now+ms(50));const n1=Number(ST(m).conversions);assert.ok(n1>=4,`many conversions in 50 ms, got ${n1}`);
 m.props.temperature=30;f.run(f.now+ms(20));
 assert.ok(Math.abs(compT(decode(rd(bus,0xf7,6)).t)/100-30)<0.02,'new value after the next conversion');
 wr(bus,0xf5,5<<5);                                   // standby 1000 ms
 f.run(f.now+ms(20));const a=Number(ST(m).conversions);f.run(f.now+ms(500));assert.equal(Number(ST(m).conversions),a,'long standby: no conversion in 500 ms');
 f.run(f.now+ms(1100));assert.ok(Number(ST(m).conversions)>a);
 wr(bus,0xf4,(2<<5)|(2<<2)|0);const b=Number(ST(m).conversions);f.run(f.now+ms(3000));assert.equal(Number(ST(m).conversions),b,'sleep mode stops the loop');
 assert.equal(T_STANDBY[5],1000);
});
test('bmp280: IIR filter averages toward a step (coefficient 4) and the first sample seeds it',()=>{
 const {f,m,bus}=setup({SDA:'A4',SCL:'A5'},{temperature:20,pressure:1000});
 wr(bus,0xf5,2<<2);                                   // filter coefficient 4, standby 0.5 ms
 const one=()=>{wr(bus,0xf4,(1<<5)|(1<<2)|1);f.run(f.now+ms(8));return decode(rd(bus,0xf7,6));};
 const first=one();assert.ok(Math.abs(compT(first.t)/100-20)<0.02,'first sample is unfiltered');
 m.props.temperature=40;
 const second=one();const t2=compT(second.t)/100;
 assert.ok(t2>24&&t2<26.5,`one step of coefficient 4: about 25 degC, got ${t2}`);
 for(let i=0;i<30;i++)one();
 assert.ok(Math.abs(compT(one().t)/100-40)<0.5,'settles at the new value');
 assert.equal(rd(bus,0xf5,1)[0]>>2&7,2);
});
test('bmp280: a read transaction locks one consistent copy of the data registers',()=>{
 const {f,m,bus}=setup({SDA:'A4',SCL:'A5'},{temperature:20,pressure:1000});
 wr(bus,0xf4,(1<<5)|(1<<2)|3);f.run(f.now+ms(20));   // normal mode, converting every few ms
 bus.onStart!(false,true);bus.onWrite(0xf7);bus.onStart!(true,false);
 const head=[bus.onRead(true),bus.onRead(true),bus.onRead(true)];
 m.props.temperature=60;f.run(f.now+ms(20));   // conversions finish in the middle of the burst
 const tail=[bus.onRead(true),bus.onRead(true),bus.onRead(false)];bus.onStop!();
 const raw=decode([...head,...tail]);
 assert.ok(Math.abs(compT(raw.t)/100-20)<0.02,'the whole burst belongs to the old conversion');
});
test('bmp280: rawFromPhysical inverts the compensation over the full range',()=>{
 for(const t of [-40,-5,25,85])for(const p of [300,520,1013,1100]){
  const r=rawFromPhysical(t,p*100);
  assert.ok(Math.abs(compT(r.t)/100-t)<0.02);assert.ok(Math.abs(compP(r.p,tFine(r.t))/25600-p)<0.05);
 }
});
test('bmp280: unwired SDA/SCL still creates a model that reads 0x58 (no crash)',()=>{
 const {bus}=setup({});assert.deepEqual(rd(bus,0xd0,1),[0x58]);
});

// ---------- real firmware ----------
const fixture=():{toolchain:string;variant:FirmwareVariant}=>JSON.parse(readFileSync(new URL('./fixtures/firmware/bmp280-read.json',import.meta.url),'utf8'));
const fwCircuit=(props:Record<string,string|number|boolean>,net:Partial<Record<string,BoardPin>>={VCC:'3V3',GND:'GND',SDA:'A4',SCL:'A5'}):Circuit=>({wires:[],parts:[{id:'b1',kind:'bmp280',net,props}]});
test('real firmware: Wire + the Bosch integer formulas (64-bit pressure) read the chip id, trim and the popover values',()=>{
 const fx=fixture(),r=createLabRunner();
 r.load(fx.variant,{},fwCircuit({temperature:23.5,pressure:1008}),fx.toolchain);r.start();
 r.advance(1400);
 const txt=r.serialText();
 assert.match(txt,/id=58/);assert.match(txt,/ready/);
 const T=txt.match(/T=(-?\d+) P=(\d+)/g)!;
 const last=T.at(-1)!.match(/T=(-?\d+) P=(\d+)/)!;
 assert.ok(Math.abs(+last[1]!/100-23.5)<0.02,txt);
 assert.ok(Math.abs(+last[2]!/100-1008)<0.1,txt);
 r.setPartProps('b1',{temperature:-12,pressure:640});r.advance(1400);
 const l2=r.serialText().match(/T=(-?\d+) P=(\d+)/g)!.at(-1)!.match(/T=(-?\d+) P=(\d+)/)!;
 assert.ok(Math.abs(+l2[1]!/100+12)<0.02);assert.ok(Math.abs(+l2[2]!/100-640)<0.1);
 const s=r.snapshot().parts.b1!;assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.equal(s.v.address,0x76);assert.ok((s.v.conversions as number)>=2);}
});
test('real firmware: SDO to the supply moves the sensor to 0x77, so a sketch at 0x76 gets no id',()=>{
 const fx=fixture(),r=createLabRunner();
 r.load(fx.variant,{},fwCircuit({temperature:20,pressure:1000},{VCC:'3V3',GND:'GND',SDA:'A4',SCL:'A5',SDO:'3V3'}),fx.toolchain);r.start();
 r.advance(400);
 assert.doesNotMatch(r.serialText(),/id=58/);
});
