/**
 * PIR-HC-SR501 device (protocol 'gpio', the part drives a pin the sketch reads): pyroelectric motion module.
 * Written from public datasheet behaviour, no vendor code:
 *  - OUT is 3.3 V logic: HIGH while motion is held, LOW otherwise (the Uno reads it as a plain digital input).
 *  - Power-up settling: about 60 s after VCC the module is blind and OUT stays LOW.
 *  - Hold time Th: set by the "Tx" trimmer, from about 0.3 s up to several minutes. OUT stays HIGH for Th after a trigger.
 *  - Jumper H (repeatable): motion seen while OUT is HIGH restarts Th, so OUT falls Th after the LAST movement.
 *    Jumper L (single): OUT is HIGH for exactly Th from the first trigger, whatever happens meanwhile.
 *  - Block time Tb of about 2.5 s after OUT falls, during which new motion is ignored (both jumper positions).
 *  - Sensitivity trimmer "Sx": detection range of roughly 3 m to 7 m. A mover further away than that is not seen.
 * Pair: scene/parts/pir-hc-sr501.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num,round1} from './types';
import {uno} from './core/util';
import {SIM_CLOCK_HZ} from '../../contract';

export type PirPhase='warmup'|'idle'|'hold'|'block';
export type PirHcSr501State={out:boolean;active:boolean;motion:boolean;phase:PirPhase;holdLeftS:number;warmLeftS:number;retrigger:boolean};

/** Block time after OUT falls (datasheet: about 2.5 s). */
export const BLOCK_S=2.5;
/** Settling time after power-up (datasheet: about 1 minute). */
export const WARMUP_S=60;

export const device=defineDevice<PirHcSr501State>({
 kind:'pir-hc-sr501',protocol:'gpio',
 // physical order on the module header: VCC, OUT, GND
 pins:['VCC','OUT','GND'],holes:[0,1,2],bodyX:[-13.5,18.6],
 copy:{
  name:{en:'PIR motion sensor (HC-SR501)',id:'Sensor gerak PIR (HC-SR501)'},
  desc:{en:'A pyroelectric sensor behind a Fresnel lens. OUT goes HIGH when something warm moves in view and stays HIGH for the hold time set by the trimmer.',id:'Sensor piroelektrik di balik lensa Fresnel. OUT menjadi HIGH saat benda hangat bergerak di depannya dan bertahan selama waktu tahan yang diatur trimmer.'},
  note:{en:'The module needs about a minute to settle after power-up. Toggle Motion to wave a hand in front of it.',id:'Modul butuh sekitar satu menit untuk stabil setelah dinyalakan. Aktifkan Gerakan untuk melambaikan tangan di depannya.'},
 },
 power:{rail:['VCC','GND'],min:4.5,max:20,ma:0.1},
 inputs:[
  {type:'toggle',key:'motion',label:{en:'Motion in view',id:'Ada gerakan'},default:false},
  {type:'range',key:'distanceM',label:{en:'Mover distance',id:'Jarak benda'},min:0.5,max:7,step:0.5,unit:'m',default:2},
  {type:'range',key:'holdS',label:{en:'Hold time (Tx trimmer)',id:'Waktu tahan (trimmer Tx)'},min:1,max:300,step:1,unit:'s',default:5},
  {type:'range',key:'rangeM',label:{en:'Sensitivity (Sx trimmer)',id:'Sensitivitas (trimmer Sx)'},min:3,max:7,step:0.5,unit:'m',default:5},
  {type:'choice',key:'retrigger',label:{en:'Jumper',id:'Jumper'},options:[{value:'H',label:{en:'H: repeatable',id:'H: berulang'}},{value:'L',label:{en:'L: single',id:'L: tunggal'}}],default:'H'},
  {type:'range',key:'warmupS',label:{en:'Settling time',id:'Waktu stabil'},min:0,max:WARMUP_S,step:1,unit:'s',default:WARMUP_S},
 ],
 defaults:{motion:false,distanceM:2,holdS:5,rangeM:5,retrigger:'H',warmupS:WARMUP_S},
 create(ctx){
  const out=uno(ctx.net('OUT'));
  let t=0,phase:PirPhase='warmup',left=0,level:boolean|null=null;
  const warmS=()=>clamp(num(ctx.props.warmupS,WARMUP_S),0,WARMUP_S);
  const holdS=()=>clamp(num(ctx.props.holdS,5),0.3,300);
  const seen=()=>ctx.props.motion===true&&num(ctx.props.distanceM,2)<=clamp(num(ctx.props.rangeM,5),3,7);
  const repeatable=()=>ctx.props.retrigger!=='L';
  const drive=(v:boolean):void=>{if(out&&v!==level)ctx.env.setPin(out,v);level=v;};
  const step=(dt:number):void=>{
   t+=dt;
   if(phase==='warmup'){if(t>=warmS())phase='idle';else{drive(false);return;}}
   const motion=seen();
   if(phase==='idle'){if(motion){phase='hold';left=holdS();}}
   else if(phase==='hold'){
    if(motion&&repeatable())left=holdS();            // jumper H: every movement restarts Th
    else left-=dt;
    if(left<=0){phase='block';left=BLOCK_S;}
   }else if(phase==='block'){left-=dt;if(left<=0){phase='idle';left=0;}}
   drive(phase==='hold');
  };
  drive(false);
  if(warmS()<=0)phase='idle';
  return {
   state:()=>({out:level===true,active:level===true,motion:seen(),phase,holdLeftS:phase==='hold'||phase==='block'?round1(Math.max(0,left)):0,warmLeftS:phase==='warmup'?round1(Math.max(0,warmS()-t)):0,retrigger:repeatable()}),
   tick(cycles){step(cycles/SIM_CLOCK_HZ);},
  };
 },
});
