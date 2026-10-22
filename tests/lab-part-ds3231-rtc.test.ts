import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';
import {EEPROM_ADDRESS,RTC_ADDRESS,START_SECONDS} from '../apps/web/src/lab/sim/devices/ds3231-rtc.js';
import type {I2cSlave,SpiBinding} from '../apps/web/src/lab/sim/devices/types.js';
import {ms} from '../apps/web/src/lab/sim/devices/types.js';

/** Minimal board: a clock with scheduled callbacks, pin logs and the shared-line / I2C / UART hooks. */
function fakeEnv(){
 const events:{at:number;cb:()=>void}[]=[];
 let now=0;
 const adc:number[]=[],log:{pin:UnoPin;level:boolean;at:number}[]=[],i2c:I2cSlave[]=[],spi:SpiBinding[]=[];
 return {adc,log,i2c,spi,
  env:{
   setPin:(p:UnoPin,l:boolean)=>{log.push({pin:p,level:l,at:now});},setAdc:(_c:number,v:number)=>{adc.push(v);},
   schedule:(c:number,cb:()=>void)=>{events.push({at:now+c,cb});events.sort((a,b)=>a.at-b.at);},now:()=>now,
   watchLine:()=>undefined,attachI2c:(s:I2cSlave)=>{i2c.push(s);},attachSpi:(s:SpiBinding)=>{spi.push(s);},
  },
  at:(n:number)=>{now=n;},
  run(to:number){while(events.length&&events[0]!.at<=to){const e=events.shift()!;now=e.at;e.cb();}now=to;},
  /** The slave that currently answers an address (what the TWI bus does at START). */
  slave(addr:number){return i2c.find(s=>(s.address&0x7f)===addr);},
 };
}
const SEC=16_000_000;
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'rtc',kind:'ds3231-rtc',net,props}]});
const make=(net:Partial<Record<string,BoardPin>>={SCL:'A5',SDA:'A4',VCC:'5V',GND:'GND'},props:Record<string,string|number|boolean>={})=>{
 const f=fakeEnv();const m=createModels(circuit(net,props),f.env).get('rtc')!;return {f,m};
};
const rd=(f:ReturnType<typeof fakeEnv>,addr:number,reg:number,n:number):number[]=>{
 const s=f.slave(addr)!;
 s.onStart?.(false,true);s.onWrite(reg);s.onStart?.(true,false);
 const out:number[]=[];for(let i=0;i<n;i++)out.push(s.onRead(i<n-1));
 s.onStop?.();return out;
};
const wr=(f:ReturnType<typeof fakeEnv>,addr:number,reg:number,...bytes:number[]):void=>{
 const s=f.slave(addr)!;s.onStart?.(false,true);s.onWrite(reg);for(const b of bytes)s.onWrite(b);s.onStop?.();
};
const ev=(m:ReturnType<typeof make>['m'])=>{const s=m.state();assert.ok(s.kind==='ext');return (s as {v:Record<string,number|boolean|string>}).v;};

test('ds3231: registers hold real BCD time that ticks with simulated seconds',()=>{
 const {f}=make();
 assert.deepEqual(rd(f,RTC_ADDRESS,0,7),[0x00,0x00,0x10,0x04,0x15,0x01,0x26]);   // Thu 2026-01-15 10:00:00 (day 4, Monday = 1)
 f.run(5*SEC);
 assert.equal(rd(f,RTC_ADDRESS,0,1)[0],0x05);
 f.run(75*SEC);
 assert.deepEqual(rd(f,RTC_ADDRESS,0,3),[0x15,0x01,0x10]);
 assert.equal(START_SECONDS,Date.UTC(2026,0,15,10,0,0)/1000);
});
test('ds3231: a burst read is one frozen copy of the time',()=>{
 const {f}=make();
 f.run(59*SEC);
 const s=f.slave(RTC_ADDRESS)!;
 s.onStart?.(false,true);s.onWrite(0);s.onStart?.(true,false);
 const a=s.onRead(true);
 f.run(60*SEC+10);        // the minute rolls over in the middle of the transfer
 const b=s.onRead(true),h=s.onRead(false);
 s.onStop?.();
 assert.deepEqual([a,b,h],[0x59,0x00,0x10]);   // still 10:00:59, not 10:01:00
});
test('ds3231: writing the time sets the clock, handles 12-hour mode and the century',()=>{
 const {f}=make();
 f.run(3*SEC+5000);
 wr(f,RTC_ADDRESS,0,0x56,0x59,0x23,0x05,0x31,0x12,0x99);   // 23:59:56, 31 Dec 2099
 assert.deepEqual(rd(f,RTC_ADDRESS,0,7),[0x56,0x59,0x23,0x05,0x31,0x12,0x99]);
 f.run(3*SEC+5000+5*SEC);   // 4 s later the day, the year and the century roll
 assert.deepEqual(rd(f,RTC_ADDRESS,0,7),[0x01,0x00,0x00,0x06,0x01,0x81,0x00]);   // 2100-01-01, century bit set, weekday +1
 wr(f,RTC_ADDRESS,2,0x40|0x20|0x03);   // 3 PM, 12 hour mode
 assert.equal(rd(f,RTC_ADDRESS,2,1)[0],0x63);
 assert.equal(ev(make().m).hour,10);
});
test('ds3231: temperature registers and OSF',()=>{
 const {f}=make({SCL:'A5',SDA:'A4'},{temperature:25.25,lostPower:true});
 assert.deepEqual(rd(f,RTC_ADDRESS,0x11,2),[25,0x40]);
 assert.equal(rd(f,RTC_ADDRESS,0x0f,1)[0],0x88);
 wr(f,RTC_ADDRESS,0x0f,0x00);   // clear OSF and EN32kHz
 assert.equal(rd(f,RTC_ADDRESS,0x0f,1)[0],0x00);
 const n=make({},{temperature:-1.5,lostPower:false});
 assert.deepEqual(rd(n.f,RTC_ADDRESS,0x11,2),[0xfe,0x80]);
 assert.equal(rd(n.f,RTC_ADDRESS,0x0f,1)[0],0x08);
});
test('ds3231: alarm 1 pulls INT/SQW low at the matching second until the flag is cleared',()=>{
 const {f,m}=make({SCL:'A5',SDA:'A4',SQW:'D2'});
 wr(f,RTC_ADDRESS,0x07,0x30,0x80,0x80,0x80);   // A1M1 clear, others masked: every minute at second 30
 wr(f,RTC_ADDRESS,0x0e,0x1d);                    // INTCN = 1, A1IE = 1
 f.run(29*SEC);
 assert.equal(ev(m).alarm1,false);
 f.run(30*SEC);
 assert.equal(ev(m).alarm1,true);
 assert.equal(rd(f,RTC_ADDRESS,0x0f,1)[0]&1,1);
 const low=f.log.filter(l=>l.pin==='D2').pop()!;
 assert.deepEqual([low.level,low.at],[false,30*SEC]);
 wr(f,RTC_ADDRESS,0x0f,0x88|0x01);   // writing a 1 cannot clear A1F
 assert.equal(rd(f,RTC_ADDRESS,0x0f,1)[0]&1,1);
 wr(f,RTC_ADDRESS,0x0f,0x88);
 assert.equal(ev(m).alarm1,false);
 assert.equal(f.log.filter(l=>l.pin==='D2').pop()!.level,true);
 f.run(90*SEC);   // the next minute fires again
 assert.equal(ev(m).alarm1,true);
});
test('ds3231: alarm 2 compares minutes and fires when the seconds roll to 00',()=>{
 const {f,m}=make({SCL:'A5',SDA:'A4',SQW:'D2'});
 wr(f,RTC_ADDRESS,0x0b,0x02,0x80|0x00,0x80);   // minute = 02, hour and day masked
 wr(f,RTC_ADDRESS,0x0e,0x1e);                    // INTCN, A2IE
 f.run(119*SEC);assert.equal(ev(m).alarm2,false);
 f.run(120*SEC);assert.equal(ev(m).alarm2,true);
 assert.equal(rd(f,RTC_ADDRESS,0x0f,1)[0]&3,2);
 assert.equal(f.log.filter(l=>l.pin==='D2').pop()!.level,false);
});
test('ds3231: alarm on day of week with hours in 24 h mode',()=>{
 const {f,m}=make();
 wr(f,RTC_ADDRESS,0x07,0x00,0x01,0x10|0x00,0x40|0x04);   // 10:01:00 on weekday 4 (today)
 f.run(60*SEC);
 assert.equal(ev(m).alarm1,true);
 const n=make();
 wr(n.f,RTC_ADDRESS,0x07,0x00,0x01,0x10,0x40|0x05);       // weekday 5: not today
 n.f.run(60*SEC);assert.equal(ev(n.m).alarm1,false);
});
test('ds3231: square wave mode toggles the pin at the selected rate',()=>{
 const {f}=make({SCL:'A5',SDA:'A4',SQW:'D2'});
 wr(f,RTC_ADDRESS,0x0e,0x00);   // INTCN = 0, RS = 00: 1 Hz
 f.run(2*SEC+1);
 const edges=f.log.filter(l=>l.pin==='D2'&&l.at>0);
 assert.deepEqual(edges.slice(0,4).map(e=>[e.level,e.at]),[[false,SEC/2],[true,SEC],[false,SEC*3/2],[true,2*SEC]]);
 wr(f,RTC_ADDRESS,0x0e,0x18);   // RS = 11: 8.192 kHz
 const before=f.log.length;f.run(2*SEC+SEC/100+1);
 assert.ok(f.log.length-before>=160&&f.log.length-before<=170);   // ~164 edges in 10 ms
});
test('ds3231: AT24C32 at 0x57 stores 12-bit addressed bytes, wraps inside a 32-byte page and busy-NACKs for tWR',()=>{
 const {f}=make();
 assert.deepEqual(rd(f,EEPROM_ADDRESS,0x0000,0).length,0);
 const e=f.slave(EEPROM_ADDRESS)!;
 const read=(a:number,n:number):number[]=>{e.onStart?.(false,true);e.onWrite(a>>8);e.onWrite(a&0xff);e.onStart?.(true,false);const o:number[]=[];for(let i=0;i<n;i++)o.push(e.onRead(true));e.onStop?.();return o;};
 assert.deepEqual(read(0,3),[0xff,0xff,0xff]);   // erased
 f.at(100);
 e.onStart?.(false,true);e.onWrite(0x00);e.onWrite(0x1e);for(const b of [1,2,3,4])e.onWrite(b);e.onStop?.();   // 0x1e, 0x1f, then wraps to 0x00, 0x01 (page of 32)
 assert.notEqual(f.slave(EEPROM_ADDRESS),e);      // busy: the chip does not answer its address
 assert.equal(f.slave(EEPROM_ADDRESS),undefined);
 f.run(100+ms(5)-1);assert.equal(f.slave(EEPROM_ADDRESS),undefined);
 f.run(100+ms(5));assert.equal(f.slave(EEPROM_ADDRESS),e);
 assert.deepEqual(read(0x1e,2),[1,2]);
 assert.deepEqual(read(0,2),[3,4]);
 assert.deepEqual(read(0x20,1),[0xff]);          // the next page was not touched
 // sequential read wraps at the end of the array
 e.onStart?.(false,true);e.onWrite(0x0f);e.onWrite(0xff);e.onWrite(0x5a);e.onStop?.();f.run(ms(50));
 assert.deepEqual(read(0x0fff,2),[0x5a,3]);
 // an address-only transfer starts no write cycle
 assert.equal(f.slave(EEPROM_ADDRESS),e);
 assert.equal(ev(make().m).eepromWrites,0);
});
test('ds3231: pins and state',()=>{
 const {f,m}=make();
 assert.equal(f.i2c.length,2);
 const s=ev(m);
 assert.equal(s.time,'2026-01-15 10:00:00');assert.equal(s.address,0x68);assert.equal(s.control,0x1c);
});
