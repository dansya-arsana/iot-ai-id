import {AVRADC,AVRIOPort,AVRSPI,AVRTWI,AVRTimer,AVRUSART,CPU,PinState,adcConfig,avrInstruction,portBConfig,portCConfig,portDConfig,spiConfig,timer0Config,timer1Config,timer2Config,twiConfig,usart0Config} from 'avr8js';
import {PIN_PORT,SIM_CLOCK_HZ,UNO_PINS} from '../contract';
import type {AvrPort,PinMode,UnoPin} from '../contract';
import {PinMonitor} from './pins';
import {TwiBus} from './devices/core/twi';
import {SpiBus} from './devices/core/spi';
import type {I2cSlave,SpiBinding} from './devices/types';

/** ATmega328P with timers, GPIO, USART and ADC. Pure: no DOM. */
export class AvrMachine{
 readonly cpu:CPU;
 readonly ports:Record<AvrPort,AVRIOPort>;
 readonly usart:AVRUSART;
 readonly adc:AVRADC;
 readonly monitor:PinMonitor;
 /** I2C bus; created on first attachI2c so sketches without Wire run exactly as before. */
 bus:TwiBus|null=null;
 /** SPI master; created on first attachSpi, same idea as the I2C bus. */
 spiBus:SpiBus|null=null;
 private lines=new Set<UnoPin>();
 private ext:Partial<Record<UnoPin,boolean>>={};
 /** 1-based .ino line of the last executed sketch instruction, 0 = none yet. */
 line=0;
 private timers:AVRTimer[];
 constructor(words:Uint16Array,private lineIdx:Int32Array){
  this.cpu=new CPU(words);
  this.timers=[new AVRTimer(this.cpu,timer0Config),new AVRTimer(this.cpu,timer1Config),new AVRTimer(this.cpu,timer2Config)];
  this.ports={B:new AVRIOPort(this.cpu,portBConfig),C:new AVRIOPort(this.cpu,portCConfig),D:new AVRIOPort(this.cpu,portDConfig)};
  this.usart=new AVRUSART(this.cpu,usart0Config,SIM_CLOCK_HZ);
  this.adc=new AVRADC(this.cpu,adcConfig);
  this.monitor=new PinMonitor(pin=>this.pinMode(pin));
  for(const port of ['B','C','D'] as AvrPort[]){
   this.ports[port].addListener((value,old)=>{
    const diff=value^old;
    for(let bit=0;bit<8;bit++){
     if(!(diff&(1<<bit)))continue;
     const pin=PIN_TO_UNO[port][bit];
     if(pin&&!this.lines.has(pin))this.monitor.record(pin,value&(1<<bit)?1:0,this.cpu.cycles);
    }
    // shared lines also change when the MCU releases or takes the pin (DDR write), which does not change the PORT value
    for(const pin of this.lines){if(PIN_PORT[pin].port===port)this.monitor.record(pin,this.lineLevel(pin),this.cpu.cycles);}
   });
  }
 }
 pinMode(pin:UnoPin):PinMode{
  const {port,bit}=PIN_PORT[pin];
  const s=this.ports[port].pinState(bit);
  return s===PinState.Input?'input':s===PinState.InputPullUp?'input-pullup':'output';
 }
 /** Drive an external level onto an input pin. */
 setPin(pin:UnoPin,level:boolean):void{
  const {port,bit}=PIN_PORT[pin];
  this.ext[pin]=level;
  this.ports[port].setPin(bit,level);
  this.monitor.record(pin,this.lines.has(pin)?this.lineLevel(pin):level?1:0,this.cpu.cycles);
 }
 /** Track a pin as an open-drain line: its level is the MCU's output while it drives, else the external (device or pull-up) level. */
 watchLine(pin:UnoPin):void{this.lines.add(pin);}
 /** Effective level of a pin right now. */
 lineLevel(pin:UnoPin):0|1{
  const {port,bit}=PIN_PORT[pin];
  const cfg=PORT_CFG[port];
  const mask=1<<bit;
  if(this.cpu.data[cfg.DDR]&mask)return this.cpu.data[cfg.PORT]&mask?1:0;
  return this.ext[pin]?1:0;
 }
 attachI2c(slave:I2cSlave):void{
  if(!this.bus){const twi=new AVRTWI(this.cpu,twiConfig,SIM_CLOCK_HZ);this.bus=new TwiBus(twi);twi.eventHandler=this.bus;this.bus.onActivity=()=>{this.pulseLine('A4');this.pulseLine('A5');};}
  this.bus.attach(slave);
 }
 attachSpi(slave:SpiBinding):void{
  if(!this.spiBus){
   const spi=new AVRSPI(this.cpu,spiConfig,SIM_CLOCK_HZ);
   this.spiBus=new SpiBus(spi,p=>this.spiCsLevel(p),()=>this.cpu.cycles,(c,cb)=>this.schedule(c,cb));
   this.spiBus.onActivity=cycles=>this.pulseHigh('D13',Math.max(2,cycles>>1));
  }
  this.spiBus.attach(slave);
 }
 /** Level the slave sees on a chip-select pin: what the sketch drives; an input pin floats high (module pull-up). */
 spiCsLevel(pin:UnoPin):0|1{return this.pinMode(pin)==='output'?this.lineLevel(pin):1;}
 /** A short high pulse on an idle-low line (SCK shown on D13 during an SPI byte). */
 pulseHigh(pin:UnoPin,cycles:number):void{
  if(this.monitor.level(pin)!==0)return;
  this.monitor.record(pin,1,this.cpu.cycles);
  this.cpu.addClockEvent(()=>this.monitor.record(pin,0,this.cpu.cycles),cycles);
 }
 /** A short low pulse (10 us) on an idle-high line, so SDA/SCL show the transaction-level I2C traffic. */
 pulseLine(pin:UnoPin):void{
  if(this.monitor.level(pin)!==1)return;
  this.monitor.record(pin,0,this.cpu.cycles);
  this.cpu.addClockEvent(()=>this.monitor.record(pin,1,this.cpu.cycles),160);
 }
 setAdc(channel:number,volts:number):void{this.adc.channelValues[channel]=volts;}
 schedule(cycles:number,cb:()=>void):void{this.cpu.addClockEvent(cb,cycles);}
 run(targetCycles:number,deadlineMs:number|null):void{
  const {cpu,lineIdx}=this;
  let line=this.line,n=0;
  while(cpu.cycles<targetCycles){
   avrInstruction(cpu);cpu.tick();
   const l=lineIdx[cpu.pc];if(l)line=l;
   if((++n&4095)===0&&deadlineMs!==null&&performance.now()>deadlineMs)break;
  }
  this.line=line;
 }
}

const PORT_CFG={B:portBConfig,C:portCConfig,D:portDConfig};
const PIN_TO_UNO:Record<AvrPort,(UnoPin|undefined)[]>={B:[],C:[],D:[]};
for(const p of UNO_PINS){const {port,bit}=PIN_PORT[p];PIN_TO_UNO[port][bit]=p;}
