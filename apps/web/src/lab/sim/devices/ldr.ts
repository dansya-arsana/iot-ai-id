import {INPUT_RANGES} from '../../contract';
import {defineDevice,clamp,num} from './types';

export const device=defineDevice({
 kind:'ldr',protocol:'adc',legacyState:true,pins:['A','B'],inputs:[],
 create(ctx){
  const pin=ctx.pin('B');
  let lux=5,adc=0,volts=0;
  const calc=():void=>{
   const lamp=ctx.siblings().find(m=>m.spec.kind==='lamp'&&m.props.target===ctx.id);
   const on=!!lamp&&lamp.props.on===true;
   const dist=clamp(num(lamp?.props.distanceCm,40),INPUT_RANGES.lamp.min,INPUT_RANGES.lamp.max);
   lux=5+(on?600*(30/dist)**2:0);
   const rLdr=clamp(70000*(lux/10)**-0.7,200,1e6);
   const fixed=num(ctx.props.fixedOhms,10000);
   volts=5*fixed/(fixed+rLdr);
   adc=Math.round(volts/5*1023);
  };
  return {state:()=>({kind:'ldr',lux,adc}),update(){calc();},adc:()=>pin?{pin,volts}:null};
 },
});
