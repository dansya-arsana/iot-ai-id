import {SIM_CLOCK_HZ,UNO_PINS} from '../contract';
import type {PinMode,PinSample,UnoPin} from '../contract';

interface Rec{level:0|1;segStart:number;highAcc:number;rise1:number;rise2:number;rises:number;edges:number;lastHigh:number;duty:number;winStart:number;hi:number;tot:number;}
/** Duty is an exponentially weighted average (time constant about 8 PWM periods), so tiny slices never alias a 490 Hz PWM. */
const DUTY_TAU=SIM_CLOCK_HZ*0.016;
const FREQ_WINDOW=SIM_CLOCK_HZ*0.05;

/** Tracks level, duty and frequency of every UNO pin from cycle-stamped edges. */
export class PinMonitor{
 private recs=new Map<UnoPin,Rec>();
 onEdge:((pin:UnoPin,level:0|1,cycle:number)=>void)|null=null;
 constructor(private modeOf:(pin:UnoPin)=>PinMode=()=>'input'){
  for(const p of UNO_PINS)this.recs.set(p,{level:0,segStart:0,highAcc:0,rise1:0,rise2:0,rises:0,edges:0,lastHigh:0,duty:0,winStart:0,hi:0,tot:0});
 }
 level(pin:UnoPin):0|1{return this.recs.get(pin)!.level;}
 record(pin:UnoPin,level:0|1,cycle:number):void{
  const r=this.recs.get(pin)!;
  if(r.level===level)return;
  if(r.level===1){r.highAcc+=cycle-r.segStart;r.lastHigh=cycle-r.rise2;}
  else{r.rise1=r.rise2;r.rise2=cycle;r.rises++;}
  r.edges++;r.level=level;r.segStart=cycle;
  this.onEdge?.(pin,level,cycle);
 }
 /** Close the window [windowStart, windowEnd] and report the pin. Windows must be contiguous per pin. */
 sample(pin:UnoPin,windowStart:number,windowEnd:number):PinSample{
  const r=this.recs.get(pin)!;
  if(r.level===1){r.highAcc+=windowEnd-r.segStart;r.segStart=windowEnd;}
  const span=windowEnd-r.winStart;
  if(span>0){const k=Math.exp(-span/DUTY_TAU);r.hi=r.hi*k+r.highAcc;r.tot=r.tot*k+span;r.duty=Math.min(1,Math.max(0,r.hi/r.tot));r.highAcc=0;r.winStart=windowEnd;}
  const period=r.rise2-r.rise1;
  const freqHz=r.rises>=2&&period>0&&windowEnd-r.rise2<=FREQ_WINDOW?SIM_CLOCK_HZ/period:0;
  return {edges:r.edges,mode:this.modeOf(pin),level:r.level,duty:r.duty,freqHz,highUs:r.lastHigh/(SIM_CLOCK_HZ/1e6),analog:null};
 }
}
