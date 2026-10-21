import {defineDevice} from './types';
import {freq} from './core/util';

export const device=defineDevice({
 kind:'buzzer',protocol:'pwm',legacyState:true,pins:['+','-'],inputs:[],
 create(ctx){
  let st:import('../../contract').PartState={kind:'buzzer',on:false,freqHz:0};
  return {state:()=>st,update(f){const hz=freq(ctx.net('+'),f);st={kind:'buzzer',on:hz>20,freqHz:hz};}};
 },
});
