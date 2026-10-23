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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'rpi-51',kind:'rpi-5',net,props}]});

test('rpi-5: device registers and answers its protocol',()=>{
  const f=fakeEnv();
  assert.ok(createModels(circuit({}),f.env).get('rpi-51'));
});
test('rpi-5: pins (desk prop)',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({}),f.env).get('rpi-51');
 assert.ok(m);assert.equal(m!.state().kind,'ext');   // add: one assertion per pin you wired (a wrong net must change the result)
});

import {device as d5,RP1_ALT} from '../apps/web/src/lab/sim/devices/rpi-5.js';
import {RPI_HEADER as H} from '../apps/web/src/lab/sim/devices/rpi-4b.js';
test('rpi-5: shares the Pi 4 header, power 5 A, RP1 defaults match the Pi 4 defaults',()=>{
 assert.deepEqual(d5.pins,H.map(p=>p.key));
 assert.equal(d5.power!.ma,5000);assert.equal(d5.runtime,'not-emulated');
 for(const [g,f] of [[2,'I2C1_SDA'],[3,'I2C1_SCL'],[14,'UART0_TX'],[15,'UART0_RX'],[9,'SPI0_MISO'],[12,'PWM0_CH0'],[13,'PWM0_CH1']] as const)assert.ok(RP1_ALT[g]!.includes(f),`gpio${g}`);
});
