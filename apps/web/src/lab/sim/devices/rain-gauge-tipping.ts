/**
 * RAIN-GAUGE-TIPPING device (protocol 'switch', desk prop): tipping-bucket rain gauge with a reed switch (SparkFun SEN-15901 class).
 * Reference: one momentary closure per 0.2794 mm (0.011 in) of rain, passive reed switch on two leads
 * (datasheet https://cdn.sparkfun.com/assets/d/1/e/0/6/DS-15901-Weather_Meter.pdf). Other gauges use 0.2, 0.3 or 0.5 mm: prop `mmPerTip`.
 * The MCU wires SIG to an INPUT_PULLUP pin and GND to ground, so the line idles HIGH and a closure pulls it LOW.
 * Closure length: about 100 ms. That figure is OURS (an assumption, not a datasheet value: the sheet only says "momentary"); it is the constant CLOSURE_MS.
 * Reed bounce: the contact chatters in the first millisecond, so each closure shows 2 or 4 extra edges (one or two open/close pairs) within 1 ms
 * before it settles, so the debounce in the firmware has something to do. Edges are cycle-exact through ctx.drive.
 * Inputs: `rate` mm/h (0-150) turns into tips over simulated time; `tip` is a momentary single tip. State: tips, mm total, last-tip time, rate.
 * Pair: scene/parts/rain-gauge-tipping.ts (3D). Both are auto-discovered; nothing else to edit. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num,us,ms,CYCLES_PER_US,type Pulse} from './types';
import {uno} from './core/util';

export const MM_PER_TIP=0.2794;
export const CLOSURE_MS=100;
/** One bounce pair: open then close again (microseconds), all inside the first millisecond. */
const BOUNCE_US:readonly [number,number][]=[[150,200],[120,180]];

export type RainGaugeTippingState={/** the reed is closed right now (SIG pulled low) */closed:boolean;tips:number;mm:number;/** simulated seconds of the last tip, -1 before the first */lastTipS:number;rate:number};

export const device=defineDevice<RainGaugeTippingState>({
 kind:'rain-gauge-tipping',protocol:'gpio',
 // two reed leads (the cable): no breadboard holes, it is a desk prop
 pins:['SIG','GND'],
 copy:{
  name:{en:'Tipping-bucket rain gauge',id:'Penakar hujan tipping-bucket'},
  desc:{en:'A funnel feeds a see-saw bucket. Every 0.2794 mm of rain it tips and a reed switch closes once, so the sketch counts pulses to measure rainfall.',id:'Corong mengalirkan air ke bucket jungkat-jungkit. Setiap 0,2794 mm hujan bucket terbalik dan saklar reed menutup sekali, jadi sketsa menghitung pulsa untuk mengukur curah hujan.'},
  note:{en:'Wire SIG to an INPUT_PULLUP pin and GND to ground. The reed bounces for about 1 ms, so debounce (ignore edges for 20-50 ms after the first one).',id:'Sambungkan SIG ke pin INPUT_PULLUP dan GND ke ground. Reed memantul sekitar 1 ms, jadi lakukan debounce (abaikan sinyal 20-50 ms setelah yang pertama).'},
 },
 inputs:[
  {type:'range',key:'rate',label:{en:'Rain rate',id:'Intensitas hujan'},min:0,max:150,step:0.5,unit:'mm/h',default:0},
  {type:'choice',key:'tip',label:{en:'Tip the bucket',id:'Jungkitkan bucket'},options:[{value:'idle',label:{en:'Idle',id:'Diam'}},{value:'tip',label:{en:'Tip once',id:'Jungkit sekali'}}],default:'idle',momentaryMs:150},
  {type:'range',key:'mmPerTip',label:{en:'mm per tip',id:'mm per jungkitan'},min:0.1,max:1,step:0.0001,unit:'mm',default:MM_PER_TIP,advanced:true},
 ],
 defaults:{rate:0,tip:'idle',mmPerTip:MM_PER_TIP},
 create(ctx){
  const sig=uno(ctx.net('SIG'));
  let tips=0,lastTipS=-1,pending=0,closed=false,lastTip=false,idleSet=false;
  let plan:{readonly active:boolean}|null=null;
  const per=():number=>clamp(num(ctx.props.mmPerTip,MM_PER_TIP),0.05,2);
  const rate=():number=>clamp(num(ctx.props.rate,0),0,150);
  const idleHigh=()=>{if(sig&&!idleSet){ctx.env.setPin(sig,true);idleSet=true;}};
  idleHigh();
  const fire=():void=>{
   tips++;lastTipS=ctx.env.now()/(CYCLES_PER_US*1e6);
   if(!sig){return;}
   // closure: low, then (open, close) bounce pairs, then low until CLOSURE_MS, then released high
   const n=1+(tips%2);   // 1 or 2 pairs = 2 or 4 extra edges
   const pulses:Pulse[]=[{level:0,holdCycles:us(180)}];
   let used=180;
   for(let i=0;i<n;i++){const [o,c]=BOUNCE_US[i]!;pulses.push({level:1,holdCycles:us(o)},{level:0,holdCycles:us(c)});used+=o+c;}
   pulses[pulses.length-1]!.holdCycles+=Math.max(1,ms(CLOSURE_MS)-us(used));   // the last low holds until the closure ends
   pulses.push({level:1,holdCycles:1});
   closed=true;
   plan=ctx.drive(sig,pulses,{onDone:()=>{closed=false;}});
  };
  const poll=():void=>{
   const t=ctx.props.tip==='tip';
   if(t&&!lastTip)pending+=1;
   lastTip=t;
   if(pending>=1&&!(plan?.active)){pending-=1;fire();}
  };
  return {
   state:()=>{poll();return {closed,tips,mm:Math.round(tips*per()*10000)/10000,lastTipS:Math.round(lastTipS*1000)/1000,rate:rate()};},
   tick(cycles){
    // rate (mm/h) over simulated time becomes fractional tips; whole tips queue up and start one closure at a time
    pending+=rate()*(cycles/(CYCLES_PER_US*1e6))/3600/per();
    poll();
   },
  };
 },
});
