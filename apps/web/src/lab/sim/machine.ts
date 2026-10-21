import {AVRADC,AVRIOPort,AVRTimer,AVRUSART,CPU,PinState,adcConfig,avrInstruction,portBConfig,portCConfig,portDConfig,timer0Config,timer1Config,timer2Config,usart0Config} from 'avr8js';
import {PIN_PORT,SIM_CLOCK_HZ,UNO_PINS} from '../contract';
import type {AvrPort,PinMode,UnoPin} from '../contract';
import {PinMonitor} from './pins';

/** ATmega328P with timers, GPIO, USART and ADC. Pure: no DOM. */
export class AvrMachine{
 readonly cpu:CPU;
 readonly ports:Record<AvrPort,AVRIOPort>;
 readonly usart:AVRUSART;
 readonly adc:AVRADC;
 readonly monitor:PinMonitor;
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
     if(pin)this.monitor.record(pin,value&(1<<bit)?1:0,this.cpu.cycles);
    }
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
  this.ports[port].setPin(bit,level);
  this.monitor.record(pin,level?1:0,this.cpu.cycles);
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

const PIN_TO_UNO:Record<AvrPort,(UnoPin|undefined)[]>={B:[],C:[],D:[]};
for(const p of UNO_PINS){const {port,bit}=PIN_PORT[p];PIN_TO_UNO[port][bit]=p;}
