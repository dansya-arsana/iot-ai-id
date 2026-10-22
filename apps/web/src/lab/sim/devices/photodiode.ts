/**
 * PHOTODIODE (BPW34-class silicon photodiode on a 3-pin module, protocol adc): reverse biased from VCC through the diode into a load
 * resistor to GND; SIG sits across that resistor. A photodiode is a current source: photocurrent is linear in irradiance, about 70 uA
 * per mW/cm2 at 940 nm for a BPW34-class part, plus a dark current of about 2 nA. So V(SIG) = I x Rload, clamped to the supply.
 * Light comes from an `ir-led` sibling (irradiance = radiant intensity / distance squared) or, when none is placed, from the popover
 * slider (ambient infrared, mW/cm2). Distance and load resistor are popover inputs. Written from public behaviour.
 * Pair: scene/parts/photodiode.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num,round1} from './types';

/** Responsivity: microamps of photocurrent per mW/cm2 of irradiance. */
export const PD_UA_PER_MW_CM2=70;
export const PD_DARK_UA=0.002;

export type PhotodiodeState={irradiance:number;microamps:number;volts:number;adc:number;saturated:boolean};

export const device=defineDevice<PhotodiodeState>({
 kind:'photodiode',protocol:'adc',
 pins:['VCC','SIG','GND'],holes:[0,1,2],
 power:{rail:['VCC','GND'],min:3.3,max:5.5,ma:0.1},
 copy:{
  name:{en:'Photodiode module',id:'Modul fotodioda'},
  desc:{en:'A light-sensing diode that turns infrared light into a tiny current. A resistor turns that current into a voltage on SIG.',id:'Dioda peka cahaya yang mengubah cahaya inframerah menjadi arus kecil. Sebuah resistor mengubah arus itu menjadi tegangan pada SIG.'},
  note:{en:'Place an IR LED next to it: the closer it is, the higher the reading. Without one, use the ambient slider.',id:'Letakkan LED inframerah di dekatnya: makin dekat, makin tinggi bacaannya. Tanpa itu, pakai slider cahaya sekitar.'},
 },
 inputs:[
  {type:'range',key:'distanceCm',label:{en:'Distance to the IR LED',id:'Jarak ke LED inframerah'},min:1,max:50,step:1,unit:'cm',default:10},
  {type:'range',key:'ambientMwCm2',label:{en:'Ambient infrared',id:'Inframerah sekitar'},min:0,max:1,step:0.01,unit:'mW/cm2',default:0.05},
  {type:'range',key:'loadKohm',label:{en:'Load resistor',id:'Resistor beban'},min:1,max:1000,step:1,unit:'kohm',default:100},
 ],
 defaults:{distanceCm:10,ambientMwCm2:0.05,loadKohm:100},
 create(ctx){
  const sig=ctx.analogPin('SIG');
  let st:PhotodiodeState={irradiance:0,microamps:0,volts:0,adc:0,saturated:false};
  const calc=():void=>{
   const d=clamp(num(ctx.props.distanceCm,10),1,50);
   const led=ctx.siblings().find(m=>m.spec.kind==='ir-led');
   const fromLed=led?num(led.props.emitMwSr,0)/(d*d):0;       // mW/sr over cm2 = mW/cm2
   const e=fromLed+Math.max(0,num(ctx.props.ambientMwCm2,0.05));
   const ua=PD_UA_PER_MW_CM2*e+PD_DARK_UA;
   const rail=ctx.supply()??5;
   const v=ua*1e-6*Math.max(1,num(ctx.props.loadKohm,100))*1000;
   const volts=Math.min(rail,v);
   st={irradiance:Math.round(e*1000)/1000,microamps:round1(ua),volts:Math.round(volts*100)/100,adc:Math.round(volts/5*1023),saturated:v>=rail};
  };
  calc();
  return {
   state:()=>{calc();return st;},
   update(){calc();},
   adc:()=>{calc();return sig?{pin:sig,volts:st.volts}:null;},
  };
 },
});
