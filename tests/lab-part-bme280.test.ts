import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';
import {CAL,compT,compP,compH,tFine} from '../apps/web/src/lab/sim/devices/bme280.js';
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
 };
}
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'bme2801',kind:'bme280',net,props}]});
const setup=(net:Partial<Record<string,BoardPin>>={SDA:'A4',SCL:'A5'},props:Record<string,string|number|boolean>={})=>{
 const f=fakeEnv();const m=createModels(circuit(net,props),f.env).get('bme2801')!;return {f,m,bus:f.i2c[0]!};
};
const wr=(b:I2cSlave,reg:number,v:number)=>{b.onStart!(false,true);b.onWrite(reg);b.onWrite(v);b.onStop!();};
function rd(b:I2cSlave,reg:number,n:number){
 b.onStart!(false,true);b.onWrite(reg);b.onStart!(true,false);
 const out:number[]=[];for(let i=0;i<n;i++)out.push(b.onRead(i<n-1));b.onStop!();return out;
}
const s16=(v:number)=>v>32767?v-65536:v;

test('bme280: chip id, address by SDO, reset',()=>{
 const a=setup();assert.equal(a.bus.address,0x76);assert.deepEqual(rd(a.bus,0xd0,1),[0x60]);
 assert.equal(setup({SDA:'A4',SCL:'A5',SDO:'5V'}).bus.address,0x77);
 wr(a.bus,0xf2,3);assert.equal(rd(a.bus,0xf2,1)[0],3);
 wr(a.bus,0xe0,0xb6);assert.equal(rd(a.bus,0xf2,1)[0],0);
});
test('bme280: calibration auto-increment burst',()=>{
 const {bus}=setup();const b=rd(bus,0x88,24);
 assert.equal(b[0]!|b[1]!<<8,CAL.T1);assert.equal(s16(b[2]!|b[3]!<<8),CAL.T2);assert.equal(s16(b[4]!|b[5]!<<8),CAL.T3);
 assert.equal(b[6]!|b[7]!<<8,CAL.P1);assert.equal(rd(bus,0xa1,1)[0],CAL.H1);
 const e=rd(bus,0xe1,7);const h4=(e[3]!<<4)|(e[4]!&0xf),h5=(e[5]!<<4)|(e[4]!>>4);
 assert.equal(e[0]!|e[1]!<<8,CAL.H2);assert.equal(h4,CAL.H4);assert.equal(h5,CAL.H5);assert.equal(e[6],CAL.H6);
});
test('bme280: forced measurement reads back physical values via Bosch formulas',()=>{
 const {f,m,bus}=setup({SDA:'A4',SCL:'A5'},{temperature:21.5,humidity:63,pressure:1002});
 assert.deepEqual(rd(bus,0xf7,3),[0x80,0,0]);          // nothing measured yet
 wr(bus,0xf2,1);wr(bus,0xf4,(1<<5)|(1<<2)|1);          // x1 all, forced
 assert.equal(rd(bus,0xf3,1)[0]&8,8);                   // measuring
 f.run(16*1000*20);
 assert.equal(rd(bus,0xf3,1)[0]&8,0);assert.equal(rd(bus,0xf4,1)[0]&3,0);   // back to sleep
 const d=rd(bus,0xf7,8);
 const adcP=(d[0]!<<12)|(d[1]!<<4)|(d[2]!>>4),adcT=(d[3]!<<12)|(d[4]!<<4)|(d[5]!>>4),adcH=(d[6]!<<8)|d[7]!;
 const tf=tFine(adcT);
 assert.ok(Math.abs(compT(adcT)/100-21.5)<0.02);
 assert.ok(Math.abs(compP(adcP,tf)/256/100-1002)<0.1);
 assert.ok(Math.abs(compH(adcH,tf)/1024-63)<0.3);
 m.state();
});
test('bme280: popover change, oversampling drops low bits, pressure skipped when off',()=>{
 const {f,m,bus}=setup();
 wr(bus,0xf2,0);wr(bus,0xf4,(1<<5)|0|1);                // temp x1 only (pressure skipped), forced
 f.run(16*1000*20);
 const d=rd(bus,0xf7,8);
 assert.deepEqual(d.slice(0,3),[0x80,0,0]);assert.equal(d[5]!&0xf,0);assert.deepEqual(d.slice(6),[0x80,0]);
 (m as unknown as {props:Record<string,number>}).props.temperature=-10;
 wr(bus,0xf4,(5<<5)|1);f.run(16*1000*100);
 const e=rd(bus,0xf7,8);const adcT=(e[3]!<<12)|(e[4]!<<4)|(e[5]!>>4);
 assert.ok(Math.abs(compT(adcT)/100+10)<0.02);
});
test('bme280: normal mode tracks live values; writes counted in state',()=>{
 const {m,bus}=setup();
 wr(bus,0xf2,1);wr(bus,0xf4,(1<<5)|(1<<2)|3);
 m.update({samples:{} as never,dtSec:0.01,cycles:160000});
 const d=rd(bus,0xf7,8);assert.notEqual(d[0],0x80);
 const s=m.state();assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.equal(s.v.mode,3);assert.ok((s.v.writes as number)>=4);}
});
