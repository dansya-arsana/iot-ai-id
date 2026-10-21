import {defineDevice,num,round1} from './types';
import {duty} from './core/util';

export const LED_VF:Record<string,number>={red:2.0,yellow:2.1,green:2.2,blue:3.0,white:3.0};

export const device=defineDevice({
 kind:'led',protocol:'pwm',legacyState:true,pins:['A','C'],inputs:[],
 create(ctx){
  let st:import('../../contract').PartState={kind:'led',brightness:0,on:false,currentMa:0,overCurrent:false};
  return {
   state:()=>st,
   update(f){
    const r=ctx.siblings().find(m=>m.spec.kind==='resistor'&&m.props.seriesWith===ctx.id);
    const R=Math.max(1,num(r?.props.ohms,220));
    const vf=LED_VF[String(ctx.props.color)]??2.0;
    const I=Math.max(0,(5-vf)/R);
    const d=duty(ctx.net('A'),f);
    const brightness=d*Math.min(1,I/0.012);
    st={kind:'led',brightness,on:brightness>0.05,currentMa:round1(I*1000*d),overCurrent:I>0.03&&d>0};
   },
  };
 },
});
