import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';
import {deviceRegistry} from '../apps/web/src/lab/sim/devices/index.js';
import {loraTimeOnAir} from '../apps/web/src/lab/sim/devices/lora-rfm95w.js';

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

const NET={NSS:'D10',DIO0:'D2',RESET:'D9'} as const;
const circuit=(kind:string,net:Partial<Record<string,BoardPin>>=NET,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'r1',kind,net,props}]});
const INFO:{mode:0|1|2|3;lsbFirst:boolean;clockHz:number;cycle:number}={mode:0,lsbFirst:false,clockHz:4_000_000,cycle:0};
const US=16;   // CPU cycles per microsecond

function rig(kind='lora-ra02',net:Partial<Record<string,BoardPin>>=NET,props:Record<string,string|number|boolean>={}){
 const f=fakeEnv();
 const m=createModels(circuit(kind,net,props),f.env).get('r1')!;
 const bus=f.spi[0]!;
 /** One NSS-framed transaction: returns the bytes the chip shifted out. */
 const frame=(bytes:number[],info=INFO):number[]=>{m.onEdge!('D10',0,0);const o=bytes.map(b=>bus.transfer(b,info));m.onEdge!('D10',1,0);return o;};
 const rd=(a:number):number=>frame([a&0x7f,0])[1]!;
 const wr=(a:number,v:number):void=>{frame([0x80|a,v]);};
 const st=():Record<string,unknown>=>{const s=m.state();assert.ok(s.kind==='ext');return (s as unknown as {v:Record<string,unknown>}).v;};
 const dio0=():boolean|undefined=>f.log.filter(l=>l.pin==='D2').at(-1)?.level;
 const lora=():void=>{wr(0x01,0x00);wr(0x01,0x80);wr(0x01,0x81);};   // sleep, LoRa mode, standby
 return {f,m,bus,frame,rd,wr,st,dio0,lora};
}

test('lora-ra02: shares the SX127x register file (RegVersion 0x12, SPI mode 0 only)',()=>{
 const r=rig();
 assert.equal(r.bus.csPin,'D10');assert.equal(r.rd(0x42),0x12);
 assert.equal(r.frame([0x42,0],{...INFO,mode:1})[1],0);assert.equal(r.st().badSpiMode,2);
});
test('lora-ra02: 433 MHz is its band, 920 MHz is outside it (the Pro band error)',()=>{
 const r=rig();r.lora();
 r.wr(0x06,0x6c);r.wr(0x07,0x40);r.wr(0x08,0x00);                               // 433.0 MHz
 assert.equal(r.st().freqMHz,433);assert.equal(r.st().inBand,true);assert.equal(r.st().inAs923_2,false);
 r.wr(0x06,0xe6);r.wr(0x07,0x0c);r.wr(0x08,0xcd);                               // 920.2 MHz: the radio would tune, the module could not radiate it
 assert.equal(r.st().inBand,false);assert.equal(r.st().inAs923_2,true);
});
test('lora-ra02: TX time on air matches the formula and TxDone drives DIO0',()=>{
 const r=rig();r.lora();r.wr(0x40,0x40);r.wr(0x22,10);r.wr(0x01,0x83);
 const at=Math.round(loraTimeOnAir({sf:7,bwHz:125000,cr:1,preamble:8,payload:10,crc:false,implicit:false,ldro:false})*1e6*US);
 r.f.run(at-1);assert.equal(r.dio0()??false,false);r.f.run(at);assert.equal(r.dio0(),true);assert.equal(r.st().txCount,1);
});
test('lora-ra02: pins follow the Ai-Thinker pad table, 3.3 V rail, no breadboard legs',()=>{
 const d=deviceRegistry.get('lora-ra02')!;
 assert.equal(d.pins.length,16);assert.deepEqual(d.pins.slice(2,5),['3V3','RESET','DIO0']);assert.deepEqual(d.pins.slice(11,15),['SCK','MISO','MOSI','NSS']);
 assert.equal(d.holes,undefined);assert.equal(d.power?.max,3.7);
});
