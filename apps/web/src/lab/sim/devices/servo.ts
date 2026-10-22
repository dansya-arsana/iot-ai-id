import {defineDevice,clamp} from './types';
import {uno} from './core/util';

export const device=defineDevice({
 kind:'servo',protocol:'pwm',legacyState:true,pins:['SIG','V','GND'],inputs:[],
 power:{rail:['V','GND'],min:4,max:6,ma:250},
 create(ctx){
  let pulseUs=0,angle=90;
  return {state:()=>({kind:'servo',pulseUs,angleDeg:angle}),update(f){
   const p=uno(ctx.net('SIG'));
   const s=p?f.samples[p]:null;
   pulseUs=s&&s.freqHz>0&&s.highUs>=400&&s.highUs<=2600?s.highUs:0;
   if(pulseUs>0){
    const target=clamp((pulseUs-544)/(2400-544)*180,0,180);
    const step=400*f.dtSec;
    angle=Math.abs(target-angle)<=step?target:angle+Math.sign(target-angle)*step;
   }
  }};
 },
});
