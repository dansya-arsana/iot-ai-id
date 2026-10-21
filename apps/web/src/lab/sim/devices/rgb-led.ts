import {defineDevice} from './types';
import {duty} from './core/util';

export const device=defineDevice({
 kind:'rgb-led',protocol:'pwm',legacyState:true,pins:['R','G','B','K'],inputs:[],
 create(ctx){
  let st:import('../../contract').PartState={kind:'rgb-led',r:0,g:0,b:0};
  return {state:()=>st,update(f){st={kind:'rgb-led',r:duty(ctx.net('R'),f),g:duty(ctx.net('G'),f),b:duty(ctx.net('B'),f)};}};
 },
});
