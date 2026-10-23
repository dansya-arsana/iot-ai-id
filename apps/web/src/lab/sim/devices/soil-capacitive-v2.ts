/**
 * SOIL-CAPACITIVE-V2: capacitive soil moisture sensor v2.0 (analog output, JST PH2.0 3-pin: GND, VCC, AOUT).
 * Like the v1.2 probe, a 555-class oscillator drives the sensing plate and the output is INVERSE to wetness (dry = high, wet = low).
 * Our curve is linear between a dry-air end and a water end (constants below, each [U]: boards differ, so calibrate calDry/calWet per probe).
 * Fault: the NE555 clone variant does not oscillate reliably below about 4.5 V. On a 3.3 V supply its output sticks near the dry value and
 * ignores wetness (state `fault:'ne555-3v3'`). The TLC555 variant works from 3.3 V (the board has an on-board 3.3 V regulator, input 3.3-5.5 V).
 * Pair: scene/parts/soil-capacitive-v2.ts (3D). Auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num,round1,type Copy} from './types';

/** Output at 5 V: about 2.54 V in dry air (raw 520 on a 10-bit 5 V ADC) and 1.27 V in water (raw 260), per the DFRobot SEN0193 wiki sample [U]. */
export const SOIL_V2_DRY_V=2.54;
export const SOIL_V2_WET_V=1.27;
/** Supply below which the NE555 clone stops oscillating [U]. */
export const NE555_MIN_V=4.5;
export type SoilV2Timer='tlc555'|'ne555';
export const soilV2Volts=(wetness:number):number=>SOIL_V2_DRY_V-(SOIL_V2_DRY_V-SOIL_V2_WET_V)*clamp(wetness,0,100)/100;

export interface SoilV2Pin{key:string;silk:string;kind:'power'|'ground'|'analog';note:Copy}
/** PH2.0-3P socket order as on the DFRobot SEN0193 board [U]: verify against your board. */
export const SOIL_V2_PINS:readonly SoilV2Pin[]=[
 {key:'GND',silk:'GND',kind:'ground',note:{en:'Ground (black wire).',id:'Ground (kabel hitam).'}},
 {key:'VCC',silk:'VCC',kind:'power',note:{en:'Supply 3.3-5.5 V (red wire). The NE555 version needs about 4.5 V or more.',id:'Catu 3,3-5,5 V (kabel merah). Versi NE555 butuh sekitar 4,5 V atau lebih.'}},
 {key:'AOUT',silk:'AOUT',kind:'analog',note:{en:'Analog output, 0 to about 3 V, high = dry (blue or yellow wire).',id:'Keluaran analog, 0 sampai sekitar 3 V, tinggi = kering (kabel biru atau kuning).'}},
];
/** Board 98 x 23 x 4 mm (others list 102 x 23 or 92.1 x 23.5) [U]. */
export const SOIL_V2_DIMS={l:98,w:23,h:4,mm:true as const};

export type SoilCapacitiveV2State={wetness:number;volts:number;timer:string;fault:string;counts5v:number};

export const device=defineDevice<SoilCapacitiveV2State>({
 kind:'soil-capacitive-v2',protocol:'adc',
 pins:SOIL_V2_PINS.map(p=>p.key),
 power:{rail:['VCC','GND'],min:3.3,max:5.5,ma:5},
 defaults:{wetness:40,timer:'tlc555'},
 copy:{
  name:{en:'Capacitive soil moisture sensor v2.0',id:'Sensor kelembapan tanah kapasitif v2.0'},
  desc:{en:'A corrosion-free capacitive probe with a 3-pin PH2.0 cable. The wetter the soil, the lower the voltage on AOUT. Clones with an NE555 timer misbehave on 3.3 V.',id:'Probe kapasitif tanpa korosi dengan kabel PH2.0 3 pin. Makin basah tanahnya, makin rendah tegangan di AOUT. Klon dengan timer NE555 bermasalah di 3,3 V.'},
  note:{en:'Set the wetness and the timer chip. Dry reads high (about 2.5 V), wet reads low (about 1.3 V). Calibrate dry and wet raw values per probe.',id:'Atur kebasahan dan chip timer. Kering terbaca tinggi (sekitar 2,5 V), basah terbaca rendah (sekitar 1,3 V). Kalibrasi nilai mentah kering dan basah untuk tiap probe.'},
 },
 inputs:[
  {type:'range',key:'wetness',label:{en:'Soil wetness (%)',id:'Kebasahan tanah (%)'},min:0,max:100,step:1,default:40},
  {type:'choice',key:'timer',label:{en:'Timer chip',id:'Chip timer'},options:[{value:'tlc555',label:{en:'TLC555 (works at 3.3 V)',id:'TLC555 (jalan di 3,3 V)'}},{value:'ne555',label:{en:'NE555 clone (needs 4.5 V+)',id:'Klon NE555 (butuh 4,5 V+)'}}],default:'tlc555'},
 ],
 create(ctx){
  const sig=ctx.analogPin('AOUT');
  const wet=():number=>clamp(Math.round(num(ctx.props.wetness,40)),0,100);
  const timer=():SoilV2Timer=>ctx.props.timer==='ne555'?'ne555':'tlc555';
  const stuck=():boolean=>{const v=ctx.supply();return timer()==='ne555'&&v!==null&&v<NE555_MIN_V;};
  const volts=():number=>soilV2Volts(stuck()?0:wet());   // stuck near the dry value, whatever the soil
  return {
   state:()=>({wetness:wet(),volts:round1(volts()*10)/10,timer:timer(),fault:stuck()?'ne555-3v3':'',counts5v:Math.round(volts()/5*1023)}),
   adc:()=>sig?{pin:sig,volts:volts()}:null,
  };
 },
});
