import {MOTOR_MAX_RPM} from '../../contract';
import {defineDevice} from './types';
import {duty} from './core/util';

export const device=defineDevice({
 kind:'motor',protocol:'pwm',legacyState:true,pins:['+','-'],inputs:[],
 create(ctx){
  let d=0,rpm=0;
  return {state:()=>({kind:'motor',duty:d,rpm}),update(f){
   d=duty(ctx.net('DRIVE'),f);
   rpm+=(d*MOTOR_MAX_RPM-rpm)*(1-Math.exp(-f.dtSec/0.35));
  }};
 },
});
