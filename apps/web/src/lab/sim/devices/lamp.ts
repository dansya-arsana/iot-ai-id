import {INPUT_RANGES} from '../../contract';
import {defineDevice,clamp,num} from './types';

export const device=defineDevice({
 kind:'lamp',protocol:'gpio',legacyState:true,pins:[],
 inputs:[
  {type:'range',key:'distanceCm',label:{en:'Distance',id:'Jarak'},min:INPUT_RANGES.lamp.min,max:INPUT_RANGES.lamp.max,step:1,unit:'cm',default:40},
  {type:'toggle',key:'on',label:{en:'On',id:'Nyala'},default:true},
 ],
 create(ctx){
  const props=ctx.props;
  props.distanceCm=clamp(num(props.distanceCm,40),INPUT_RANGES.lamp.min,INPUT_RANGES.lamp.max);
  props.on=props.on===true;
  return {state:()=>({kind:'lamp',distanceCm:props.distanceCm as number,on:props.on as boolean}),setInput(i){
   if(i.kind!=='lamp')return;
   if(i.distanceCm!==undefined)props.distanceCm=clamp(i.distanceCm,INPUT_RANGES.lamp.min,INPUT_RANGES.lamp.max);
   if(i.on!==undefined)props.on=i.on;
  }};
 },
});
