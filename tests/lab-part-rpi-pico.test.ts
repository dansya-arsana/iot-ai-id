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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'rpi-pico1',kind:'rpi-pico',net,props}]});

test('rpi-pico: device registers and answers its protocol',()=>{
  const f=fakeEnv();
  assert.ok(createModels(circuit({}),f.env).get('rpi-pico1'));
});
test('rpi-pico: pins (desk prop)',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({}),f.env).get('rpi-pico1');
 assert.ok(m);assert.equal(m!.state().kind,'ext');   // add: one assertion per pin you wired (a wrong net must change the result)
});

import {PICO_PINS,picoFunctions,device as pico} from '../apps/web/src/lab/sim/devices/rpi-pico.js';
import {PartRecordSchema as PicoSchema} from '../packages/catalog/index.js';
import {readFileSync as readPico} from 'node:fs';

test('pico: 40 edge pins in physical order + 3 SWD pads; GP numbers 0-22 and 26-28',()=>{
 assert.equal(PICO_PINS.length,43);
 assert.deepEqual(PICO_PINS.slice(0,40).map(p=>p.phys),[...Array(40).keys()].map(i=>i+1));
 assert.deepEqual(PICO_PINS.slice(40).map(p=>p.key),['SWCLK','GND_D','SWDIO']);
 const gp=PICO_PINS.filter(p=>p.gpio!==undefined).map(p=>p.gpio!);
 assert.deepEqual(gp,[...Array(23).keys(),26,27,28]);
 assert.deepEqual(pico.pins,PICO_PINS.map(p=>p.key));
 const key=(phys:number)=>PICO_PINS[phys-1]!.key;
 for(const [phys,k] of [[1,'GP0'],[4,'GP2'],[21,'GP16'],[29,'GP22'],[30,'RUN'],[31,'GP26'],[34,'GP28'],[35,'ADC_VREF'],[36,'3V3_OUT'],[37,'3V3_EN'],[39,'VSYS'],[40,'VBUS']] as const)assert.equal(key(phys),k);
 assert.equal(PICO_PINS.find(p=>p.key==='GP26')!.adc,0);
});
test('pico: computed alt functions match 6 rows typed from the RP2040 datasheet (2.19.2)',()=>{
 // [gpio, spi, uart, i2c, pwm]
 const rows:[number,string,string,string,string][]=[
  [0,'SPI0 RX','UART0 TX','I2C0 SDA','PWM0 A'],
  [5,'SPI0 CSn','UART1 RX','I2C0 SCL','PWM2 B'],
  [12,'SPI1 RX','UART0 TX','I2C0 SDA','PWM6 A'],
  [16,'SPI0 RX','UART0 TX','I2C0 SDA','PWM0 A'],
  [25,'SPI1 CSn','UART1 RX','I2C0 SCL','PWM4 B'],
  [26,'SPI1 SCK','UART1 CTS','I2C1 SDA','PWM5 A'],
 ];
 for(const [n,spi,uart,i2c,pwm] of rows){
  const f=picoFunctions(n);
  assert.equal(`SPI${f.spi!.bus} ${f.spi!.role}`,spi,`gp${n} spi`);
  assert.equal(`UART${f.uart!.bus} ${f.uart!.role}`,uart,`gp${n} uart`);
  assert.equal(`I2C${f.i2c.bus} ${f.i2c.role}`,i2c,`gp${n} i2c`);
  assert.equal(`PWM${f.pwm.slice} ${f.pwm.ch}`,pwm,`gp${n} pwm`);
 }
});
test('pico: model-only, variant prop, power rating, catalog record',()=>{
 assert.equal(pico.runtime,'not-emulated');assert.deepEqual([pico.power!.min,pico.power!.max],[1.8,5.5]);
 const v=pico.inputs.find(i=>i.key==='variant')!;assert.equal(v.type,'choice');
 if(v.type==='choice')assert.deepEqual(v.options.map(o=>o.value),['pico','pico-w','pico2']);
 const r=PicoSchema.parse(JSON.parse(readPico(new URL('../packages/catalog/data/rpi-pico.json',import.meta.url),'utf8')));
 assert.equal(r.identity.id,'rpi-pico');assert.ok(r.pins.length>=40);
});
