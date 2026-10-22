import {INPUT_RANGES} from '../../contract';
import {defineDevice,clamp,num} from './types';

export const device=defineDevice({
 kind:'potentiometer',protocol:'adc',legacyState:true,pins:['VCC','SIG','GND'],
 inputs:[{type:'range',key:'value',label:{en:'Value',id:'Nilai'},min:INPUT_RANGES.potentiometer.min,max:INPUT_RANGES.potentiometer.max,step:1,default:512}],
 create(ctx){
  let value=clamp(Math.round(num(ctx.props.value,512)),INPUT_RANGES.potentiometer.min,INPUT_RANGES.potentiometer.max);
  const pin=ctx.analogPin('SIG');
  ctx.props.value=value;
  return {
   state:()=>({kind:'potentiometer',value}),
   setInput(i){if(i.kind==='potentiometer'){value=clamp(Math.round(i.value),0,1023);ctx.props.value=value;}},
   adc:()=>pin?{pin,volts:value/1023*5}:null,
  };
 },
});
