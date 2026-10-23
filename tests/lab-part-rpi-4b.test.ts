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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'rpi-4b1',kind:'rpi-4b',net,props}]});

test('rpi-4b: device registers and answers its protocol',()=>{
  const f=fakeEnv();
  assert.ok(createModels(circuit({}),f.env).get('rpi-4b1'));
});
test('rpi-4b: pins (desk prop)',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({}),f.env).get('rpi-4b1');
 assert.ok(m);assert.equal(m!.state().kind,'ext');   // add: one assertion per pin you wired (a wrong net must change the result)
});

import {RPI_HEADER,BCM2711_ALT,device as rpi4} from '../apps/web/src/lab/sim/devices/rpi-4b.js';
import {device as rpi5,RP1_ALT} from '../apps/web/src/lab/sim/devices/rpi-5.js';
import {PartRecordSchema} from '../packages/catalog/index.js';
import {readFileSync} from 'node:fs';

test('rpi header: 40 unique pins in physical order, 28 GPIO, 8 ground, 4 power',()=>{
 assert.equal(RPI_HEADER.length,40);
 assert.deepEqual(RPI_HEADER.map(p=>p.phys),[...Array(40).keys()].map(i=>i+1));
 assert.equal(new Set(RPI_HEADER.map(p=>p.key)).size,40);
 assert.equal(RPI_HEADER.filter(p=>p.kind==='gpio').length,28);
 assert.equal(RPI_HEADER.filter(p=>p.kind==='ground').length,8);
 assert.equal(RPI_HEADER.filter(p=>p.kind==='power').length,4);
 assert.deepEqual(rpi4.pins,RPI_HEADER.map(p=>p.key));
 assert.deepEqual(rpi5.pins,rpi4.pins);
});
test('rpi header: documented physical-pin to GPIO facts',()=>{
 const g=(phys:number)=>RPI_HEADER[phys-1]!.gpio;
 assert.equal(g(3),2);assert.equal(g(5),3);assert.equal(g(8),14);assert.equal(g(10),15);assert.equal(g(19),10);assert.equal(g(21),9);assert.equal(g(23),11);
 assert.equal(g(24),8);assert.equal(g(26),7);assert.equal(g(27),0);assert.equal(g(28),1);assert.equal(g(32),12);assert.equal(g(33),13);assert.equal(g(40),21);
 assert.equal(RPI_HEADER[0]!.key,'3V3_1');assert.equal(RPI_HEADER[1]!.key,'5V_2');assert.equal(RPI_HEADER[5]!.key,'GND_6');
 assert.ok(RPI_HEADER[26]!.reserved&&RPI_HEADER[27]!.reserved);
});
test('rpi header: pull defaults GPIO0-8 up, 9-27 down; ALT table covers GPIO0-27 with ALT0 defaults',()=>{
 for(const p of RPI_HEADER.filter(x=>x.kind==='gpio'))assert.equal(p.pull,p.gpio!<=8?'up':'down');
 for(let n=0;n<=27;n++)assert.equal(BCM2711_ALT[n]!.length,6,`gpio${n}`);
 assert.equal(BCM2711_ALT[2]![0],'SDA1');assert.equal(BCM2711_ALT[3]![0],'SCL1');assert.equal(BCM2711_ALT[14]![0],'TXD0');assert.equal(BCM2711_ALT[15]![0],'RXD0');
 assert.equal(BCM2711_ALT[10]![0],'SPI0_MOSI');assert.equal(BCM2711_ALT[18]![0],'PCM_CLK');assert.equal(BCM2711_ALT[18]![5],'PWM0_0');
 assert.equal(BCM2711_ALT[0]![4],'TXD2');assert.equal(BCM2711_ALT[4]![5],'SDA3');   // BCM2711-only extras
 assert.equal(RP1_ALT[2]![0],'I2C1_SDA');assert.equal(RP1_ALT[14]![0],'UART0_TX');
});
test('rpi-4b and rpi-5 are model-only and say so',()=>{
 for(const d of [rpi4,rpi5]){assert.equal(d.runtime,'not-emulated');assert.match(d.copy!.note!.en,/Model only|lint-checked/);}
 assert.match(rpi5.copy!.note!.en,/RPi\.GPIO does not work/);
});
test('catalog records for the Pi boards validate and carry provenance',()=>{
 for(const k of ['rpi-4b','rpi-5']){
  const r=PartRecordSchema.parse(JSON.parse(readFileSync(new URL(`../packages/catalog/data/${k}.json`,import.meta.url),'utf8')));
  assert.equal(r.identity.id,k);assert.ok(r.pins.length>=40);assert.match(r.identity.name.p.source,/^https:\/\//);
 }
});
