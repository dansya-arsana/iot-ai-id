/**
 * STEPPER-28BYJ-48 (5 V unipolar stepper with a 1:63.68 gearbox, desk prop, protocol 'gpio'). Five wires: BLU, PNK, YEL, ORG and the red
 * common (RED, the coil centre taps). Wire them to the ULN2003 board's OUT1-OUT4 and COM (that plug order is the real cable order), or to any
 * driver that pulls a coil end below the common.
 * Coil model (datasheet, 5 V version): two windings, each with a centre tap on RED, so four coil ends BLU/PNK/YEL/ORG. The order
 * IN1, IN2, IN3, IN4 moves the field one quarter of an electrical cycle (one full step = 2 half steps); eight half steps are one
 * electrical cycle and 64 half steps (32 full steps) turn the inner rotor once: 5.625 degrees of rotor per half step. The gearbox
 * (63.68395:1 measured, the label says 64:1) gives 0.0883 degrees of output shaft per half step: 4075.77 half steps (2037.9 full steps) per turn.
 * The field of an energised set is the vector sum of its coils at 0, 90, 180 and 270 degrees: one coil = an even beat, two neighbours =
 * the beat in between, two opposite coils cancel (no torque, the rotor holds), three coils act like the middle one.
 * Speed limit: the pull-in rate is about 500 full steps per second (datasheet "pull-in frequency > 500 PPS"). A step that comes sooner than
 * 0.9 ms per half step of travel is lost (counted in `missed`): the rotor buzzes and loses its place, as the real one does.
 * Timing: when the coils are wired to a ULN2003 board every input edge is read from that board's cycle-stamped queue, so the step rate is
 * exact even when a simulation slice holds many steps. On any other driver the coil voltages are sampled once per slice.
 * Pair: scene/parts/stepper-28byj48.ts. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import {coilBus} from './uln2003-driver';
import {SIM_CLOCK_HZ} from '../../contract';
import type {CoilBus} from './uln2003-driver';

/** Degrees of the inner rotor per half step: 360 / (8 half steps x 8 electrical cycles). */
export const ROTOR_DEG_PER_HALF=5.625;
export const GEAR_ACTUAL=63.68395;
export const GEAR_NOMINAL=64;
/** Shortest time per half step of travel the rotor can follow (about 500 full steps per second). */
export const MIN_SEC_PER_HALF=0.0009;
/** A coil conducts when the common sits at least this far above its end. */
export const COIL_MIN_V=2.5;
/** Coil changes closer than this are one change: the winding (about 20 mH / 60 ohm, 0.3 ms) cannot follow a 4 us glitch between two digitalWrite calls. */
export const SETTLE_SEC=100e-6;
/** Common voltage below which the motor has no supply. */
export const SUPPLY_MIN_V=3.5;
const COILS=['BLU','PNK','YEL','ORG'] as const;

export type StepperState={
 /** output shaft angle, 0-360 */angleDeg:number;
 /** signed output revolutions since load */turns:number;
 /** coil changes the rotor followed */steps:number;
 /** net half steps (positive = the order IN1 to IN4) */halfSteps:number;
 /** coil changes it could not follow (too fast, or a jump over the opposite coil) */missed:number;
 /** energised coils, bit k = BLU PNK YEL ORG */coils:number;
 rpm:number;/** 'half' 'full' or 'idle': the size of the last move */mode:string;
 powered:boolean;stalled:boolean;gear:number;
};

/** Field position 0-7 (in half steps) of a coil mask, or null when the coils cancel or none is on. */
export function fieldPos(mask:number):number|null{
 let x=0,y=0;
 for(let k=0;k<4;k++)if(mask&(1<<k)){x+=Math.round(Math.cos(k*Math.PI/2));y+=Math.round(Math.sin(k*Math.PI/2));}
 if(x===0&&y===0)return null;
 const a=Math.atan2(y,x)*180/Math.PI;
 return ((Math.round(a/45)%8)+8)%8;
}

export const device=defineDevice<StepperState>({
 kind:'stepper-28byj48',protocol:'gpio',
 pins:['BLU','PNK','YEL','ORG','RED'],
 copy:{
  name:{en:'28BYJ-48 stepper motor (5 V, geared)',id:'Motor stepper 28BYJ-48 (5 V, berodagigi)'},
  desc:{en:'A small geared stepper: four coils turn it one tiny step each time the pattern moves on. About 2038 full steps (4076 half steps) turn the shaft once, and it cannot follow steps faster than roughly 500 per second.',id:'Stepper kecil berodagigi: empat kumparan memutarnya selangkah kecil setiap pola bergeser. Sekitar 2038 langkah penuh (4076 setengah langkah) memutar poros satu putaran, dan ia tidak sanggup mengikuti lebih dari sekitar 500 langkah per detik.'},
  note:{en:'Give the coils the order IN1, IN2, IN3, IN4 to turn one way and the reverse order to turn back. The red wire is the supply.',id:'Beri kumparan urutan IN1, IN2, IN3, IN4 untuk satu arah dan urutan terbalik untuk kembali. Kabel merah adalah catu.'},
 },
 inputs:[{type:'choice',key:'ratio',label:{en:'Gear ratio',id:'Rasio gigi'},options:[{value:'actual',label:{en:'63.684:1 (measured)',id:'63,684:1 (terukur)'}},{value:'nominal',label:{en:'64:1 (label)',id:'64:1 (label)'}}],default:'actual'}],
 defaults:{ratio:'actual'},
 create(ctx){
  let half=0,count=0,missed=0,phase:number|null=null,lastT=-1,stalled=false,coils=0,mode='idle',rpm=0,powered=false;
  let clock=0,lastMask=-1,prevHalf=0;
  const gear=():number=>ctx.props.ratio==='nominal'?GEAR_NOMINAL:GEAR_ACTUAL;
  const degPerHalf=():number=>ROTOR_DEG_PER_HALF/gear();

  /** Feed one coil mask that became true at time t (seconds). */
  const apply=(mask:number,t:number):void=>{
   if(mask===lastMask)return;
   const prevT=lastT;
   lastMask=mask;coils=mask;
   const p=fieldPos(mask);
   if(p===null){stalled=false;return;}
   lastT=t;
   if(phase===null){phase=p;return;}   // the rotor settles onto the first field it feels
   let d=((p-phase)%8+8)%8;if(d>4)d-=8;
   if(d===0)return;
   if(Math.abs(d)===4){missed++;stalled=true;return;}
   if(prevT>=0&&t-prevT<MIN_SEC_PER_HALF*Math.abs(d)){missed++;stalled=true;return;}
   stalled=false;
   phase=p;half+=d;count++;mode=Math.abs(d)===1?'half':'full';
  };

  // which bus bit feeds each coil, found once from the wires (null when the coils are not on a ULN2003 board)
  let wiring:{bus:CoilBus;bits:number[]}|null|undefined;
  const wire=():{bus:CoilBus;bits:number[]}|null=>{
   let bus:CoilBus|null=null;const bits=[-1,-1,-1,-1];
   for(let k=0;k<4;k++){
    const peer=ctx.peers(COILS[k]!).find(q=>q.kind==='uln2003-driver'&&/^OUT[1-4]$/.test(q.pin));
    if(!peer)continue;
    bits[k]=Number(peer.pin.slice(3))-1;
    const b=coilBus(ctx.env,peer.part);
    if(bus&&bus!==b)return null;   // coils on two different boards: use plain voltages
    bus=b;
   }
   if(!bus)return null;
   bus.listening=true;
   return {bus,bits};
  };
  const pollMask=():number=>{
   const red=ctx.volts('RED');let m=0;
   if(red===null||red<SUPPLY_MIN_V)return 0;
   for(let k=0;k<4;k++){const v=ctx.volts(COILS[k]!);if(v!==null&&red-v>=COIL_MIN_V)m|=1<<k;}
   return m;
  };

  return {
   state:()=>({
    angleDeg:Math.round((((half*degPerHalf())%360)+360)%360*1000)/1000,turns:Math.round(half*degPerHalf()/360*10000)/10000,
    steps:count,halfSteps:half,missed,coils,rpm:Math.round(rpm*100)/100,mode,powered,stalled,gear:gear(),
   }),
   update(f){
    clock+=f.dtSec;
    if(wiring===undefined)wiring=wire();
    const red=ctx.volts('RED');
    powered=red!==null&&red>=SUPPLY_MIN_V;
    if(wiring){
     const q=wiring.bus.queue;
     // a newest edge may be the start of a burst (four digitalWrite calls): keep it for the next slice
     let n=q.length;
     const nowT=ctx.env.now()/SIM_CLOCK_HZ;
     if(n>0&&nowT-q[n-1]!.t>=0&&nowT-q[n-1]!.t<SETTLE_SEC)n--;
     const take=q.slice(0,n);
     take.forEach((e,i)=>{
      if(q[i+1]&&q[i+1]!.t-e.t<SETTLE_SEC)return;   // superseded by the next edge of the same burst (even a held-back one)
      let m=0;
      if(powered)for(let k=0;k<4;k++){const b=wiring!.bits[k]!;if(b>=0&&(e.mask&(1<<b)))m|=1<<k;}
      apply(m,e.t);
     });
     q.splice(0,n);
    }else apply(pollMask(),clock);
    // measured speed of the output shaft, smoothed like a real meter
    if(f.dtSec>0){
     const inst=((half-prevHalf)*degPerHalf()/360)/f.dtSec*60;
     rpm+=(inst-rpm)*(1-Math.exp(-f.dtSec/0.25));
    }
    prevHalf=half;
    if(count>0&&Math.abs(rpm)<0.05&&!stalled)mode='idle';
   },
  };
 },
});
