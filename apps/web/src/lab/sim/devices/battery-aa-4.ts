/**
 * BATTERY-AA-4 device (protocol 'gpio'): 4 x AA holder with a slide switch and two leads.
 * A real supply for the power-net solver (sim/power.ts) and it also reports the pack voltage. One alkaline AA runs
 * 1.60 V fresh, about 1.25 V on the plateau and 0.9 V empty; four in series give 6.4 V down to 3.6 V.
 * Switch off: the leads read 0 V. Own work from public discharge behaviour.
 */
import {defineDevice,clamp,num} from './types';

export type BatteryAa4State={charge:number;cellVolts:number;volts:number;on:boolean};

/** Open-circuit volts of one alkaline AA at charge 0..100 %. */
export function aaVolts(charge:number):number{
 const c=clamp(charge,0,100);
 if(c>=85)return 1.4+(c-85)*(0.2/15);
 if(c>=15)return 1.15+(c-15)*(0.25/70);
 return 0.9+c*(0.25/15);
}

export const device=defineDevice<BatteryAa4State>({
 kind:'battery-aa-4',protocol:'gpio',
 pins:['PLUS','MINUS'],
 copy:{
  name:{en:'4 x AA battery holder',id:'Holder baterai 4 x AA'},
  desc:{en:'Four AA cells in series in one holder with a slide switch: about 6 V when fresh, red lead plus, black lead minus.',id:'Empat baterai AA seri dalam satu holder dengan saklar geser: sekitar 6 V saat baru, kabel merah plus, hitam minus.'},
  note:{en:'Slide the switch off and the leads read 0 V. It is a real supply: wire PLUS to VIN or a motor driver and MINUS to GND.',id:'Geser saklar ke mati dan kabel terbaca 0 V. Ini catu sungguhan: kabelkan PLUS ke VIN atau driver motor dan MINUS ke GND.'},
 },
 // a real supply for the net solver: 0 V across the leads while the switch is off
 supplies:p=>[{pos:'PLUS',neg:'MINUS',volts:p.on===false?0:Math.round(4*aaVolts(clamp(Math.round(num(p.charge,100)),0,100))*100)/100,maxMa:1000}],
 inputs:[
  {type:'range',key:'charge',label:{en:'Charge left',id:'Sisa muatan'},min:0,max:100,step:1,unit:'%',default:100},
  {type:'toggle',key:'on',label:{en:'Switch on',id:'Saklar nyala'},default:true},
 ],
 defaults:{charge:100,on:true},
 create(ctx){
  const charge=()=>clamp(Math.round(num(ctx.props.charge,100)),0,100);
  const on=()=>ctx.props.on!==false;
  return {state:()=>{
   const cell=aaVolts(charge());
   return {charge:charge(),cellVolts:Math.round(cell*100)/100,volts:on()?Math.round(cell*4*100)/100:0,on:on()};
  }};
 },
});
