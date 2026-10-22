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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'mpu60501',kind:'mpu6050',net,props}]});
import {gravity} from '../apps/web/src/lab/sim/devices/mpu6050.js';

const NET={SDA:'A4',SCL:'A5',INT:'D2',AD0:'GND',VCC:'5V',GND:'GND'} as Partial<Record<string,BoardPin>>;
function rig(props:Record<string,string|number|boolean>={},net=NET){
 const f=fakeEnv();
 const m=createModels(circuit(net,props),f.env).get('mpu60501')!;
 const bus=f.i2c[0]!;
 const w=(reg:number,v:number)=>{bus.onStart!(false,true);bus.onWrite(reg);bus.onWrite(v);bus.onStop!();};
 const r=(reg:number,n=1)=>{bus.onStart!(false,true);bus.onWrite(reg);bus.onStart!(true,false);const o:number[]=[];for(let i=0;i<n;i++)o.push(bus.onRead(i<n-1));bus.onStop!();return o;};
 const w16=(reg:number)=>{const b=r(reg,2);const v=(b[0]!<<8)|b[1]!;return v>=0x8000?v-0x10000:v;};
 /** advance simulated time in 10 ms slices so the tilt eases to the popover target */
 let clock=0;
 const settle=(ms=1500)=>{for(let t=0;t<ms;t+=10){clock+=160000;f.run(clock);m.update({samples:EMPTY(),dtSec:0.01,cycles:1} as never);}};
 return {f,m,bus,w,r,w16,settle};
}
const wake=(x:ReturnType<typeof rig>)=>x.w(0x6b,0x00);

test('mpu6050: address 0x68 (AD0 low) or 0x69 (AD0 high); WHO_AM_I is 0x68 either way',()=>{
 const a=rig();assert.equal(a.bus.address,0x68);assert.deepEqual(a.r(0x75),[0x68]);
 const b=rig({},{...NET,AD0:'5V'});assert.equal(b.bus.address,0x69);assert.deepEqual(b.r(0x75),[0x68]);
});
test('mpu6050: powers up asleep (PWR_MGMT_1 = 0x40), data stays zero until woken, reset restores sleep',()=>{
 const x=rig();
 assert.deepEqual(x.r(0x6b),[0x40]);
 assert.deepEqual(x.r(0x3b,14),new Array(14).fill(0));
 wake(x);assert.deepEqual(x.r(0x6b),[0x00]);
 assert.equal(x.w16(0x3f),16384,'flat: +1 g on Z at +-2 g');
 x.w(0x6b,0x80);assert.deepEqual(x.r(0x6b),[0x40],'DEVICE_RESET puts it back to sleep');
});
test('mpu6050: flat board reads 1 g on Z and the temperature word of 25 degC',()=>{
 const x=rig();wake(x);x.settle(100);
 assert.equal(x.w16(0x3b),0);assert.equal(x.w16(0x3d),0);assert.equal(x.w16(0x3f),16384);
 // datasheet: degC = raw/340 + 36.53
 assert.equal(x.w16(0x41),Math.round((25-36.53)*340));
 const raw=x.w16(0x41);assert.ok(Math.abs(raw/340+36.53-25)<0.01);
});
test('mpu6050: tilt follows gravity maths; roll lifts the back edge (+Y), pitch drops the right edge (-X)',()=>{
 const x=rig({roll:30});wake(x);x.settle();
 assert.ok(Math.abs(x.w16(0x3d)-8192)<=2,'ay = sin 30 deg * 16384');
 assert.ok(Math.abs(x.w16(0x3f)-Math.round(Math.cos(Math.PI/6)*16384))<=2);
 assert.equal(x.w16(0x3b),0);
 x.m.props.roll=0;x.m.props.pitch=45;x.settle();
 const g=gravity(0,45);
 assert.ok(Math.abs(x.w16(0x3b)-Math.round(g[0]*16384))<=2);assert.ok(x.w16(0x3b)<0);
 // roll = atan2(ay,az), pitch = atan2(-ax, sqrt(ay^2+az^2)): the formulas every sketch uses give back the angles
 const ax=x.w16(0x3b),ay=x.w16(0x3d),az=x.w16(0x3f);
 assert.ok(Math.abs(Math.atan2(-ax,Math.hypot(ay,az))*180/Math.PI-45)<0.1);
});
test('mpu6050: ACCEL_CONFIG and GYRO_CONFIG pick the full scale (LSB per g and per dps)',()=>{
 const x=rig({spin:100});wake(x);x.settle(100);
 assert.equal(x.w16(0x3f),16384);
 assert.ok(Math.abs(x.w16(0x47)-13100)<=2,'100 dps at +-250 dps = 131 LSB/dps');
 x.w(0x1c,0x10);x.w(0x1b,0x08);x.settle(100);
 assert.deepEqual(x.r(0x1c),[0x10]);
 assert.equal(x.w16(0x3f),4096,'+-8 g: 4096 LSB/g');
 assert.ok(Math.abs(x.w16(0x47)-6550)<=2,'+-500 dps: 65.5 LSB/dps');
 x.w(0x1c,0x18);x.settle(20);assert.equal(x.w16(0x3f),2048);
 x.m.props.spin=250;x.w(0x1b,0x18);x.settle(100);
 assert.ok(Math.abs(x.w16(0x47)-4100)<=2,'+-2000 dps: 16.4 LSB/dps');
});
test('mpu6050: the gyro reports the rate of a tilt change, then settles to zero; it saturates at full scale',()=>{
 const x=rig();wake(x);x.settle(100);
 x.m.props.roll=60;
 x.m.update({samples:EMPTY(),dtSec:0.01,cycles:1} as never);
 const gx=x.w16(0x43);
 assert.ok(gx>0,'rolling about +X gives positive X rate');
 assert.equal(gx,32767,'a fast slider jump exceeds +-250 dps and clips');
 x.settle(2000);
 assert.ok(Math.abs(x.w16(0x43))<5,'at rest the gyro reads zero');
});
test('mpu6050: burst read walks the registers with auto-increment',()=>{
 const x=rig({roll:0,temperature:25});wake(x);x.settle(100);
 const all=x.r(0x3b,14);
 assert.equal(all.length,14);
 assert.equal((all[4]!<<8)|all[5]!,16384);
 // writing past the pointer also increments
 x.bus.onStart!(false,true);x.bus.onWrite(0x19);x.bus.onWrite(9);x.bus.onWrite(0x03);x.bus.onStop!();
 assert.deepEqual(x.r(0x19,2),[9,3]);
});
test('mpu6050: sample rate = gyro rate / (1 + SMPLRT_DIV); DLPF off is 8 kHz, on is 1 kHz',()=>{
 const x=rig();wake(x);
 const hz=()=>{const s=x.m.state();return s.kind==='ext'?s.v.sampleHz:0;};
 assert.equal(hz(),8000);
 x.w(0x1a,0x03);assert.equal(hz(),1000);
 x.w(0x19,7);assert.equal(hz(),125);
});
test('mpu6050: data-ready interrupt pulses INT every sample period; latched mode holds until INT_STATUS is read',()=>{
 const x=rig();wake(x);
 x.w(0x1a,0x01);x.w(0x19,9);          // 1 kHz / 10 = 100 Hz -> 10 ms
 x.w(0x38,0x01);                      // DATA_RDY_EN
 x.f.log.length=0;x.f.run(16*10000*3+10);
 const rises=x.f.log.filter(e=>e.pin==='D2'&&e.level);
 assert.equal(rises.length,3);
 assert.equal(rises[1]!.at-rises[0]!.at,16*10000);
 // pulse width 50 us
 const falls=x.f.log.filter(e=>e.pin==='D2'&&!e.level);
 assert.equal(falls[0]!.at-rises[0]!.at,800);
 // latch: stays high until the status read clears it
 const y=rig();wake(y);y.w(0x1a,0x01);y.w(0x19,9);y.w(0x37,0x20);y.w(0x38,0x01);
 y.f.run(16*10000*2);
 assert.equal(y.f.log.filter(e=>e.pin==='D2').at(-1)?.level,true);
 assert.deepEqual(y.r(0x3a),[0x01]);
 assert.equal(y.f.log.filter(e=>e.pin==='D2').at(-1)?.level,false);
 assert.deepEqual(y.r(0x3a),[0x00],'status bits clear on read');
 // active low
 const z=rig();wake(z);z.w(0x37,0x80);z.w(0x19,9);z.w(0x1a,1);z.w(0x38,1);
 z.f.log.length=0;z.f.run(16*10000+10);
 assert.equal(z.f.log.filter(e=>e.pin==='D2')[0]!.level,false,'active low pulses LOW');
});
test('mpu6050: a wired SDA decides nothing but the AD0 net and INT pin; unwired INT drives no pin',()=>{
 const x=rig({},{SDA:'A4',SCL:'A5',VCC:'5V',GND:'GND'});wake(x);x.w(0x38,1);x.f.run(16*20000);
 assert.equal(x.f.log.length,0);
});
