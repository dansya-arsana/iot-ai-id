/** LM35 in a TO-92 package (D-shaped body, flat face toward the viewer). Pairs with sim/devices/lm35.ts (analog, 10 mV per degC). */
import type {Group,MeshStandardMaterial} from 'three';
import type {PartProps} from '../../contract';
import type {Lm35State} from '../../sim/devices/lm35';
import {PITCH} from '../layout';
import {definePart,extState,c,pin,callout,type Inner} from './kit';
import {to92Body} from './ds18b20';

function buildLm35(_p:PartProps,g:Group):Inner{
 const b=to92Body(g,'LM35DZ');
 const m:MeshStandardMaterial=b.light;
 return {
  apply(s){
   const st=extState<Lm35State>(s,'lm35');
   if(!st)return;
   // the top light shifts from cool to warm with the temperature it senses (0 to 150 degC)
   const t=Math.min(1,st.tempC/100);
   m.color.setRGB(0.25+0.65*t,0.55-0.15*t,0.85-0.7*t);
   m.emissive.copy(m.color);m.emissiveIntensity=0.35;
  },
 };
}

const P=(i:number):[number,number,number]=>[i*PITCH,0,0];
export const lm35=definePart({
 kind:'lm35',name:c('LM35 temperature sensor','Sensor suhu LM35'),
 pins:{VS:pin(P(0),'power','+VS 4V to 30V','+VS 4V sampai 30V'),OUT:pin(P(1),'analog-out','VOUT: 10 mV per degree','VOUT: 10 mV per derajat'),GND:pin(P(2),'ground','Ground','Ground')},
 callouts:[
  callout('body',[PITCH,10,0],'The voltage on the middle leg is 10 mV for every degree Celsius','Tegangan di kaki tengah 10 mV untuk setiap derajat Celsius'),
  callout('flat',[PITCH,6,1.6],'Flat face toward you: +VS, VOUT, GND from the left','Sisi datar menghadap Anda: +VS, VOUT, GND dari kiri'),
 ],
 make:buildLm35,
});
