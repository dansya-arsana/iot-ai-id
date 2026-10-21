import {UNO_PINS} from '../contract';
import type {SimSnapshot,UnoPin} from '../contract';

/** Ring buffer of per-frame pin samples, in EMULATED milliseconds. */
export interface PinTrace{t:Float32Array;level:Uint8Array;duty:Float32Array;analog:Float32Array;n:number;head:number}
export interface PinMeasure{toggles:number;highMs:number|null;periodMs:number|null;duty:number;freqHz:number;resolutionMs:number;pulses:number;aliased:boolean}
export interface PinHistory{
 push(s:SimSnapshot):void;reset():void;
 trace(pin:UnoPin):PinTrace;measure(pin:UnoPin):PinMeasure;lastEdgeMs(pin:UnoPin):number|null;
 /** Emulated times of pulses faster than a frame, which per-frame level sampling cannot resolve. */
 pulseTicks(pin:UnoPin):number[];
}

const CAP=1024;
interface Lane{tr:PinTrace;toggles:number;edges:number[];highMs:number|null;duty:number;freqHz:number;maxSpan:number;acc:number;pulses:number;aliased:boolean;ticks:number[]}
const mkTrace=():PinTrace=>({t:new Float32Array(CAP),level:new Uint8Array(CAP),duty:new Float32Array(CAP),analog:new Float32Array(CAP),n:0,head:0});
const mkLane=():Lane=>({tr:mkTrace(),toggles:0,edges:[],highMs:null,duty:0,freqHz:0,maxSpan:0,acc:0,pulses:0,aliased:false,ticks:[]});

export function createPinHistory(windowMs=4000):PinHistory{
 const lanes=new Map<UnoPin,Lane>(UNO_PINS.map(p=>[p,mkLane()]));
 let lastT=-1;
 const reset=()=>{for(const p of UNO_PINS)lanes.set(p,mkLane());lastT=-1;};
 return {
  reset,
  push(s){
   if(s.status!=='running')return;
   if(s.simTimeMs<lastT)reset();
   const span=lastT<0?0:s.simTimeMs-lastT;
   lastT=s.simTimeMs;
   for(const p of UNO_PINS){
    const ps=s.pins[p],l=lanes.get(p)!,tr=l.tr;
    const prev=tr.n?tr.level[(tr.head-1+CAP)%CAP]:ps.level;
    if(ps.level!==prev){l.toggles++;l.edges.push(s.simTimeMs);if(l.edges.length>64)l.edges.shift();}
    l.duty=ps.duty;l.freqHz=ps.freqHz;l.maxSpan=Math.max(l.maxSpan*0.98,span);
    // pulses shorter than a frame alias away in level sampling: the emulator still measures their rate (freqHz), so mark them at that rate
    const pwmLike=ps.mode==='output'&&ps.duty>0.01&&ps.duty<0.99&&ps.freqHz>200;
    l.aliased=!pwmLike&&ps.freqHz>0&&ps.freqHz*Math.max(span,8)/1000>0.12;
    if(l.aliased&&span>0){
     l.acc+=ps.freqHz*span/1000;
     while(l.acc>=1){l.acc-=1;l.pulses++;l.ticks.push(s.simTimeMs);}
     while(l.ticks.length&&s.simTimeMs-l.ticks[0]>windowMs)l.ticks.shift();
     if(l.ticks.length>512)l.ticks.splice(0,256);
    }
    // highUs is the cycle-exact length of the last completed HIGH pulse; keep it whenever the sampler reports one
    if(ps.highUs>0)l.highMs=ps.highUs/1000;
    tr.t[tr.head]=s.simTimeMs;tr.level[tr.head]=ps.level;tr.duty[tr.head]=ps.duty;tr.analog[tr.head]=ps.analog??-1;
    tr.head=(tr.head+1)%CAP;tr.n=Math.min(CAP,tr.n+1);
    // drop samples older than the window by shrinking n
    while(tr.n>2&&s.simTimeMs-tr.t[(tr.head-tr.n+CAP)%CAP]>windowMs)tr.n--;
   }
  },
  trace:p=>lanes.get(p)!.tr,
  measure:p=>{
   const l=lanes.get(p)!;
   const e=l.edges;
   // period: distance between the last two rising... approximate with two edges of the same polarity (i.e. skip one)
   // average over as many whole periods as the edge log holds (2 edges per period) to shrink the per-frame quantisation
   const k=Math.min(e.length-1,16)&~1;
   const periodMs=k>=2?(e[e.length-1]-e[e.length-1-k])/(k/2):null;
   return {toggles:l.toggles,highMs:l.highMs,periodMs,duty:l.duty,freqHz:l.freqHz,resolutionMs:l.maxSpan,pulses:l.pulses,aliased:l.ticks.length>0&&lastT-l.ticks[l.ticks.length-1]<700};
  },
  pulseTicks:p=>lanes.get(p)!.ticks,
  lastEdgeMs:p=>{const e=lanes.get(p)!.edges;return e.length?e[e.length-1]:null;},
 };
}
