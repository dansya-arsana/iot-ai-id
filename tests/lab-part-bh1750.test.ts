import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';

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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'bh17501',kind:'bh1750',net,props}]});
const CPMS=16000;
function setup(props:Record<string,string|number|boolean>={},net:Partial<Record<string,BoardPin>>={VCC:'5V',GND:'GND',SDA:'A4',SCL:'A5'}){
 const f=fakeEnv();
 const m=createModels(circuit(net,props),f.env).get('bh17501')!;
 const bus=f.i2c[0]!;
 const cmd=(op:number)=>{bus.onStart!(false,true);bus.onWrite(op);bus.onStop!();};
 const read=()=>{bus.onStart!(false,false);const hi=bus.onRead(true),lo=bus.onRead(false);bus.onStop!();return hi<<8|lo;};
 return {f,m,bus,cmd,read};
}

test('bh1750: address 0x23 with ADDR open or low, 0x5C with ADDR to VCC',()=>{
 assert.equal(setup().bus.address,0x23);
 assert.equal(setup({},{VCC:'5V',GND:'GND',SDA:'A4',SCL:'A5',ADDR:'GND'}).bus.address,0x23);
 assert.equal(setup({},{VCC:'5V',GND:'GND',SDA:'A4',SCL:'A5',ADDR:'5V'}).bus.address,0x5c);
});
test('bh1750: continuous H-res returns lux x 1.2 after 120 ms, the previous value before that',()=>{
 const t=setup({lux:1000});
 t.cmd(0x01);t.cmd(0x10);
 assert.equal(t.read(),0,'nothing latched before the first conversion ends');
 t.f.at(119*CPMS);assert.equal(t.read(),0);
 t.f.at(121*CPMS);assert.equal(t.read(),1200);
 const s=t.m.state();assert.ok(s.kind==='ext');if(s.kind==='ext'){assert.equal(s.v.ready,true);assert.equal(s.v.mode,'H');assert.equal(s.v.address,0x23);}
});
test('bh1750: H2 doubles the count, L converts in 16 ms',()=>{
 const t=setup({lux:100});
 t.cmd(0x11);t.f.at(130*CPMS);assert.equal(t.read(),240);
 const u=setup({lux:100});
 u.cmd(0x13);u.f.at(17*CPMS);assert.equal(u.read(),120);
});
test('bh1750: MTreg scales the count and the time; 0x40/0x60 opcodes set it',()=>{
 const t=setup({lux:1000});
 t.cmd(0x42);t.cmd(0x65);   // high 0b010, low 0b00101 -> 69
 let s=t.m.state();if(s.kind==='ext')assert.equal(s.v.mtreg,69);
 t.cmd(0x40);t.cmd(0x7f);   // 0b011111 = 31
 s=t.m.state();if(s.kind==='ext')assert.equal(s.v.mtreg,31);
 t.cmd(0x10);t.f.at(60*CPMS);   // 120 x 31/69 = 54 ms
 assert.equal(t.read(),Math.round(1000*1.2*31/69));
});
test('bh1750: one-time mode powers down after the result; reset clears the data only while powered',()=>{
 const t=setup({lux:50});
 t.cmd(0x20);t.f.at(130*CPMS);
 assert.equal(t.read(),60);
 const s=t.m.state();if(s.kind==='ext'){assert.equal(s.v.powered,false);assert.equal(s.v.mode,'down');}
 t.cmd(0x07);assert.equal(t.read(),60,'reset is ignored while powered down');
 t.cmd(0x01);t.cmd(0x07);assert.equal(t.read(),0);
});
test('bh1750: full sun clips at 54612 lx in H mode at MTreg 69',()=>{
 const t=setup({lux:100000});
 t.cmd(0x10);t.f.at(130*CPMS);assert.equal(t.read(),65535);
 const s=t.m.state();if(s.kind==='ext')assert.equal(s.v.clipped,true);
 const u=setup({lux:54000});u.cmd(0x10);u.f.at(130*CPMS);assert.equal(u.read(),64800);
});
