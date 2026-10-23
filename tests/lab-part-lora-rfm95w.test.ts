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

function rig(kind='lora-rfm95w',net:Partial<Record<string,BoardPin>>=NET,props:Record<string,string|number|boolean>={}){
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
const SF7_125_CR45_10B=0.036096;   // (8+4.25) x 1.024 ms + (8+15) x 1.024 ms, datasheet 4.1.1.6

test('lora-rfm95w: time on air formula, SF7 / 125 kHz / CR4/5 / 10 byte payload',()=>{
 const p={sf:7,bwHz:125000,cr:1,preamble:8,payload:10,crc:false,implicit:false,ldro:false};
 assert.ok(Math.abs(loraTimeOnAir(p)-SF7_125_CR45_10B)<1e-9);
 // SF12/125 kHz with low data rate optimise, CRC on, 20 bytes: 32.768 ms symbol, 12.25 + (8+ceil((160-48+28+16)/40)*5=20 -> 28) symbols
 const q={sf:12,bwHz:125000,cr:1,preamble:8,payload:20,crc:true,implicit:false,ldro:true};
 assert.ok(Math.abs(loraTimeOnAir(q)-(12.25+28)*0.032768)<1e-9);
});
test('lora-rfm95w: RegVersion over SPI and datasheet reset values',()=>{
 const r=rig();
 assert.equal(r.bus.csPin,'D10');assert.equal(r.bus.activeLow,true);
 assert.equal(r.rd(0x42),0x12);
 assert.deepEqual([r.rd(0x06),r.rd(0x07),r.rd(0x08)],[0x6c,0x80,0x00]);   // 434.0 MHz
 assert.equal(r.rd(0x1d),0x72);assert.equal(r.rd(0x1e),0x70);assert.equal(r.rd(0x26),0x04);assert.equal(r.rd(0x39),0x12);assert.equal(r.rd(0x01),0x09);
 r.wr(0x42,0x55);assert.equal(r.rd(0x42),0x12);                            // read-only
});
test('lora-rfm95w: wrong NSS wiring answers nothing, wrong SPI mode is counted',()=>{
 const r=rig('lora-rfm95w',{});
 assert.equal(r.bus.csPin,null);
 const r2=rig();
 assert.equal(r2.frame([0x42,0],{...INFO,mode:3})[1],0);assert.equal(r2.st().badSpiMode,2);
});
test('lora-rfm95w: burst FIFO write then read-back, FIFO address does not move',()=>{
 const r=rig();r.lora();
 r.wr(0x0d,0x80);                                                            // FifoAddrPtr = TxBase
 r.frame([0x80,0x48,0x65,0x6c,0x6c,0x6f]);                                    // burst write to address 0x00
 assert.equal(r.rd(0x0d),0x85);
 r.wr(0x0d,0x80);
 assert.deepEqual(r.frame([0x00,0,0,0,0,0]).slice(1),[0x48,0x65,0x6c,0x6c,0x6f]);
 r.wr(0x01,0x80);                                                            // SLEEP: FIFO not accessible, content lost
 r.wr(0x0d,0x80);assert.equal(r.rd(0x00),0);assert.ok(Number(r.st().fifoDropped)>0);
});
test('lora-rfm95w: LongRangeMode only changes in SLEEP',()=>{
 const r=rig();
 r.wr(0x01,0x81);assert.equal(r.rd(0x01),0x01);                             // from STDBY the LoRa bit is refused
 r.wr(0x01,0x00);r.wr(0x01,0x80);assert.equal(r.rd(0x01),0x80);r.wr(0x01,0x81);assert.equal(r.rd(0x01),0x81);
 r.wr(0x01,0x01);assert.equal(r.rd(0x01),0x81);                             // from STDBY the LoRa bit stays
 r.wr(0x01,0x00);r.wr(0x01,0x01);assert.equal(r.rd(0x01),0x01);             // via SLEEP it clears
});
test('lora-rfm95w: TX sets TxDone after the real time on air, DIO0 follows, write-1-to-clear',()=>{
 const r=rig();r.lora();
 r.wr(0x06,0xe6);r.wr(0x07,0x0c);r.wr(0x08,0xcd);                              // 920.2 MHz
 r.wr(0x1d,0x72);r.wr(0x1e,0x70);r.wr(0x26,0x04);                              // BW125 CR4/5 explicit, SF7, CRC off
 r.wr(0x40,0x40);                                                            // DIO0 = TxDone
 r.wr(0x0e,0x00);r.wr(0x0d,0x00);r.frame([0x80,1,2,3,4,5,6,7,8,9,10]);r.wr(0x22,10);
 r.f.at(1_000);r.wr(0x01,0x83);                                              // TX at cycle 1000
 const at=1_000+Math.round(SF7_125_CR45_10B*1e6*US);
 r.f.run(at-1);assert.equal(r.dio0()??false,false);assert.equal(r.rd(0x12)&0x08,0);assert.equal(r.st().mode,'tx');
 r.f.run(at);assert.equal(r.dio0(),true);assert.equal(r.rd(0x12)&0x08,0x08);assert.equal(r.st().mode,'stdby');
 const s=r.st();assert.equal(s.txCount,1);assert.equal(s.lastTxHex,'01 02 03 04 05 06 07 08 09 0a');assert.equal(s.freqMHz,920.2);assert.equal(s.inBand,true);assert.equal(s.inAs923_2,true);
 assert.ok(Math.abs(Number(s.toaMs)-36.096)<0.001);
 r.wr(0x12,0x08);assert.equal(r.rd(0x12),0);assert.equal(r.dio0(),false);
});
test('lora-rfm95w: leaving TX early aborts the packet; no antenna is counted',()=>{
 const r=rig('lora-rfm95w',NET,{antenna:false});r.lora();r.wr(0x22,4);r.wr(0x01,0x83);r.f.run(100*1000*US);
 r.f.at(0);
 const r2=rig();r2.lora();r2.wr(0x22,4);r2.wr(0x01,0x83);r2.wr(0x01,0x80);r2.f.run(1e9);
 assert.equal(r2.st().txCount,0);assert.equal(r2.rd(0x12)&0x08,0);
 assert.equal(r.st().noAntennaTx,1);assert.equal(r2.st().noAntennaTx,0);
});
test('lora-rfm95w: default frequency is outside the module band until the sketch sets it',()=>{
 const r=rig();assert.equal(r.st().freqMHz,434);assert.equal(r.st().inBand,false);assert.equal(r.st().inAs923_2,false);
 r.lora();r.wr(0x06,0xd9);r.wr(0x07,0x00);r.wr(0x08,0x00);                      // 868.0 MHz
 assert.equal(r.st().inBand,true);assert.equal(r.st().inAs923_2,false);
});
test('lora-rfm95w: PA_BOOST output power, +20 dBm needs RegPaDac 0x87',()=>{
 const r=rig();
 r.wr(0x09,0x8f);assert.equal(r.st().txDbm,17);
 r.wr(0x4d,0x87);assert.equal(r.st().txDbm,20);
 r.wr(0x09,0x7f);assert.equal(r.st().txDbm,15);                                 // RFO: 10.8 + 0.6 x 7 = 15
});
test('lora-rfm95w: an injected packet raises RxDone after its time on air, only in RX',()=>{
 const r=rig();r.lora();
 r.wr(0x40,0x00);                                                            // DIO0 = RxDone
 r.m.setInput!({kind:'ext',type:'lora-rfm95w',v:{line:'Hi'}});assert.match(String(r.st().transcript),/ignored/);
 r.wr(0x01,0x85);r.f.at(0);
 r.m.setInput!({kind:'ext',type:'lora-rfm95w',v:{line:'hex: 48 69'}});
 const t=Math.round(loraTimeOnAir({sf:7,bwHz:125000,cr:1,preamble:8,payload:2,crc:false,implicit:false,ldro:false})*1e6*US);
 r.f.run(t-1);assert.equal(r.rd(0x12)&0x40,0);r.f.run(t);
 assert.equal(r.rd(0x12)&0x40,0x40);assert.equal(r.dio0(),true);assert.equal(r.rd(0x13),2);assert.equal(r.rd(0x10),0);
 r.wr(0x0d,r.rd(0x10));assert.deepEqual(r.frame([0,0,0]).slice(1),[0x48,0x69]);
 assert.equal(r.st().rxCount,1);assert.equal(r.st().mode,'rxcont');
});
test('lora-rfm95w: NRESET low restores the reset values',()=>{
 const r=rig();r.lora();r.wr(0x06,0xe6);
 assert.equal(r.rd(0x06),0xe6);r.m.onEdge!('D9',0,1000);
 assert.equal(r.rd(0x06),0x6c);assert.equal(r.rd(0x01),0x09);
});
test('lora-rfm95w: pins follow the RFM95W pad table',()=>{
 const d=deviceRegistry.get('lora-rfm95w')!;
 assert.deepEqual(d.pins.slice(0,6),['GND','MISO','MOSI','SCK','NSS','RESET']);assert.equal(d.pins.length,16);assert.equal(d.pins[8],'ANT');assert.equal(d.pins[12],'3V3');
 assert.equal(d.holes,undefined);assert.deepEqual(d.power?.rail,['3V3','GND']);
});
