/**
 * MG996R (metal-gear hobby servo, desk prop, protocol 'pwm'): the same three-wire servo interface as the SG90 (SIG, V, GND): the position
 * is the width of a pulse repeated about every 20 ms, decoded exactly like servo.ts (544 us = 0 degrees, 2400 us = 180 degrees as the Arduino
 * Servo library writes it, valid 400-2600 us), plus the dead band of the datasheet (5 us: a width change smaller than that is ignored).
 * Datasheet (TowerPro class): 4.8-7.2 V; speed 0.17 s/60 deg at 4.8 V and 0.14 s/60 deg at 6 V; stall torque 9.4 kg.cm at 4.8 V and
 * 11 kg.cm at 6 V; stall current about 2.5 A, idle about 10 mA, moving 500-900 mA. Mass 55 g. Metal gears, so it takes a stall without stripping.
 * The speed and torque follow the real supply voltage on V (between 4.8 and 6 V by interpolation); with no supply wired it assumes the 5 V rail.
 * The popover has the load on the horn: above the torque the servo stalls (it stays where it is and draws the stall current).
 * Pair: scene/parts/mg996r.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';
import {uno} from './core/util';

export const MG996R_DEADBAND_US=5;
const lerp=(a:number,b:number,t:number):number=>a+(b-a)*t;
/** Seconds for a 60 degree move at a supply voltage (0.17 s at 4.8 V, 0.14 s at 6 V). */
export const sec60=(v:number):number=>lerp(0.17,0.14,clamp((v-4.8)/1.2,0,1));
/** Stall torque in kg.cm at a supply voltage (9.4 at 4.8 V, 11 at 6 V). */
export const stallKgCm=(v:number):number=>lerp(9.4,11,clamp((v-4.8)/1.2,0,1));

export type Mg996rState={
 pulseUs:number;angleDeg:number;/** the angle the pulse asks for */targetDeg:number;supplyV:number;
 /** deg per second the horn can move at this supply */speedDps:number;torqueKgCm:number;
 /** the load is above the torque: the horn does not move */stalled:boolean;ma:number;moving:boolean;
};

export const device=defineDevice<Mg996rState>({
 kind:'mg996r',protocol:'pwm',pins:['SIG','V','GND'],
 power:{rail:['V','GND'],min:4.8,max:7.2,ma:500,external:true},
 copy:{
  name:{en:'MG996R metal-gear servo',id:'Servo gigi logam MG996R'},
  desc:{en:'A strong hobby servo with metal gears: about 10 kg.cm of torque, enough for a robot arm joint. The pulse on SIG sets the angle exactly like a small servo.',id:'Servo hobi kuat dengan gigi logam: torsi sekitar 10 kg.cm, cukup untuk sendi lengan robot. Lebar pulsa pada SIG menentukan sudut seperti servo kecil.'},
  note:{en:'It can pull 1 A or more, so give it its own 5-6 V supply and join the grounds. A load above its torque stalls it.',id:'Ia bisa menarik 1 A atau lebih, jadi beri catu 5-6 V sendiri dan satukan ground-nya. Beban di atas torsinya membuatnya macet.'},
 },
 inputs:[{type:'range',key:'loadKgCm',label:{en:'Load on the horn',id:'Beban pada lengan'},min:0,max:15,step:0.5,unit:'kg.cm',default:0}],
 defaults:{loadKgCm:0},
 create(ctx){
  let angle=90,target=90,pulse=0,lastPulse=0,stalled=false,moving=false,supplyV=5;
  return {
   state:()=>({
    pulseUs:pulse,angleDeg:Math.round(angle*100)/100,targetDeg:Math.round(target*100)/100,supplyV:Math.round(supplyV*100)/100,
    speedDps:Math.round(60/sec60(supplyV)),torqueKgCm:Math.round(stallKgCm(supplyV)*100)/100,stalled,
    ma:pulse===0?10:stalled?2500:moving?700:60,moving,
   }),
   update(f){
    supplyV=ctx.supply()??5;
    const powered=supplyV>=4;
    const p=uno(ctx.net('SIG'));
    const s=p?f.samples[p]:null;
    const w=s&&s.freqHz>0&&s.highUs>=400&&s.highUs<=2600?s.highUs:0;
    if(w===0){pulse=0;moving=false;return;}
    if(lastPulse===0||Math.abs(w-lastPulse)>MG996R_DEADBAND_US)lastPulse=w;
    pulse=lastPulse;
    target=clamp((pulse-544)/(2400-544)*180,0,180);
    stalled=powered&&num(ctx.props.loadKgCm,0)>stallKgCm(supplyV);
    if(!powered||stalled){moving=false;return;}
    const step=60/sec60(supplyV)*f.dtSec;
    moving=Math.abs(target-angle)>0.05;
    angle=Math.abs(target-angle)<=step?target:angle+Math.sign(target-angle)*step;
   },
  };
 },
});
