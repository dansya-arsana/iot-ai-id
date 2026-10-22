/**
 * BATTERY-9V device (protocol 'gpio', no pin is read by the MCU): a PP3 9 V alkaline with snap leads.
 * It is a source for the power-net solver (sim/power.ts): PLUS sits at the open-circuit voltage of the charge popover above MINUS. Alkaline PP3 discharge is roughly 9.6 V fresh to 6.0 V at the 0 % cut-off
 * (piecewise: steep first 10 %, long plateau, knee below 20 %). Wire PLUS to VIN and MINUS to GND for the picture.
 * Own work from public discharge-curve behaviour.
 */
import {defineDevice,clamp,num} from './types';

export type Battery9vState={charge:number;volts:number;on:boolean};

/** Open-circuit volts of a PP3 alkaline at charge 0..100 %. */
export function pp3Volts(charge:number):number{
 const c=clamp(charge,0,100);
 if(c>=90)return 8.6+(c-90)*0.1;       // 9.6 V fresh
 if(c>=20)return 7.6+(c-20)*(1.0/70);  // long plateau 7.6-8.6 V
 return 6.0+c*(1.6/20);                 // knee to 6.0 V
}

export const device=defineDevice<Battery9vState>({
 kind:'battery-9v',protocol:'gpio',
 pins:['PLUS','MINUS'],
 copy:{
  name:{en:'9 V battery with snap leads',id:'Baterai 9 V dengan kabel snap'},
  desc:{en:'A PP3 block with a snap connector and red and black leads: the red lead is plus, the black one is minus.',id:'Baterai blok PP3 dengan konektor snap dan kabel merah dan hitam: merah plus, hitam minus.'},
  note:{en:'Pull the charge slider down to watch the voltage sag. It is a real supply: wire PLUS to VIN (or to a motor driver) and MINUS to GND.',id:'Turunkan slider muatan untuk melihat tegangan turun. Ini catu sungguhan: kabelkan PLUS ke VIN (atau ke driver motor) dan MINUS ke GND.'},
 },
 // a real supply for the net solver: PLUS sits `volts` above MINUS (join MINUS to GND to share a ground with the board)
 supplies:p=>[{pos:'PLUS',neg:'MINUS',volts:Math.round(pp3Volts(clamp(Math.round(num(p.charge,100)),0,100))*100)/100*(num(p.charge,100)>0?1:0),maxMa:500}],
 inputs:[{type:'range',key:'charge',label:{en:'Charge left',id:'Sisa muatan'},min:0,max:100,step:1,unit:'%',default:100}],
 defaults:{charge:100},
 create(ctx){
  const charge=()=>clamp(Math.round(num(ctx.props.charge,100)),0,100);
  return {state:()=>({charge:charge(),volts:Math.round(pp3Volts(charge())*100)/100,on:charge()>0})};
 },
});
