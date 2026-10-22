/**
 * DC motor (protocol pwm). Two ways to drive it:
 *  - legacy: `net.DRIVE` names the PWM pin behind its driver transistor (lesson 9); speed follows that pin's duty on the 5 V rail;
 *  - electrical: its + and - pins are wired part to part (an L298N OUT1/OUT2, a battery through a relay...). The net solver gives the
 *    voltage across it: speed is proportional to |V| up to the rated voltage, the sign sets the direction (negative rpm = reverse).
 * The popover-free part needs external power: the PowerSpec warns when + hangs on a board pin.
 */
import {MOTOR_MAX_RPM} from '../../contract';
import {defineDevice} from './types';
import {duty} from './core/util';

/** Voltage at which the motor reaches MOTOR_MAX_RPM (a 3-6 V hobby motor). */
export const MOTOR_RATED_V=6;

export const device=defineDevice({
 kind:'motor',protocol:'pwm',legacyState:true,pins:['+','-'],inputs:[],
 power:{rail:['+','-'],min:1.5,max:9,ma:250,external:true},
 create(ctx){
  let d=0,rpm=0;
  const wired=():boolean=>ctx.net('DRIVE')===undefined&&(ctx.peers('+').length>0||ctx.peers('-').length>0);
  return {state:()=>({kind:'motor',duty:d,rpm}),update(f){
   let target:number;
   if(wired()){
    const v=(ctx.volts('+')??0)-(ctx.volts('-')??0);
    d=Math.min(1,Math.abs(v)/MOTOR_RATED_V);
    target=Math.sign(v)*d*MOTOR_MAX_RPM;
   }else{
    d=duty(ctx.net('DRIVE'),f);
    target=d*MOTOR_MAX_RPM;
   }
   rpm+=(target-rpm)*(1-Math.exp(-f.dtSec/0.35));
  }};
 },
});
