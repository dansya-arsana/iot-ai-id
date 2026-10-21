import {INPUT_RANGES} from '../../contract';
import {defineDevice,clamp,num} from './types';

export const device=defineDevice({
 kind:'obstacle',protocol:'gpio',legacyState:true,pins:[],
 inputs:[{type:'range',key:'distanceCm',label:{en:'Distance',id:'Jarak'},min:INPUT_RANGES.obstacle.min,max:INPUT_RANGES.obstacle.max,step:1,unit:'cm',default:100}],
 create(ctx){
  const props=ctx.props;
  props.distanceCm=clamp(num(props.distanceCm,100),INPUT_RANGES.obstacle.min,INPUT_RANGES.obstacle.max);
  return {state:()=>({kind:'obstacle',distanceCm:props.distanceCm as number}),setInput(i){
   if(i.kind==='obstacle')props.distanceCm=clamp(i.distanceCm,INPUT_RANGES.obstacle.min,INPUT_RANGES.obstacle.max);
  }};
 },
});
