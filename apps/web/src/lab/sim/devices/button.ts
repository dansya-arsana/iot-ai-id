import {defineDevice} from './types';
import {uno} from './core/util';

export const device=defineDevice({
 kind:'button',protocol:'gpio',legacyState:true,pins:['1','2'],
 inputs:[{type:'toggle',key:'pressed',label:{en:'Pressed',id:'Ditekan'},default:false}],
 create(ctx){
  let pressed=false;
  const apply=()=>{const p=uno(ctx.net('2'));if(p)ctx.env.setPin(p,pressed);};
  apply();
  return {state:()=>({kind:'button',pressed}),setInput(i){if(i.kind==='button'){pressed=i.pressed;apply();}}};
 },
});
