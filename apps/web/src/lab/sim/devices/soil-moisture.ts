/**
 * SOIL-MOISTURE device (protocol 'adc'): capacitive soil moisture probe v1.2 (analog output, 3 pins).
 * On the real board a 555-class oscillator drives the probe plate; wet soil raises the plate capacitance, which lowers
 * the rectified DC output. So the output is INVERSELY related to wetness: about 2.8 V in air/dry at a 5 V supply and
 * about 1.2 V in water. Our curve is linear between those two ends (a close fit for the usable middle).
 * Pair: scene/parts/soil-moisture.ts (3D). Auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num,round1} from './types';

export type SoilMoistureState={wetness:number;volts:number};

export const SOIL_DRY_V=2.8;
export const SOIL_WET_V=1.2;
/** Output voltage for a wetness percentage (0 = dry air, 100 = submerged to the line). */
export const soilVolts=(wetness:number):number=>SOIL_DRY_V-(SOIL_DRY_V-SOIL_WET_V)*clamp(wetness,0,100)/100;

export const device=defineDevice<SoilMoistureState>({
 kind:'soil-moisture',protocol:'adc',
 pins:['VCC','SIG','GND'],holes:[0,1,2],bodyX:[-9,14],
 copy:{
  name:{en:'Soil moisture sensor (capacitive)',id:'Sensor kelembapan tanah (kapasitif)'},
  desc:{en:'A corrosion-free probe that senses soil water through capacitance. The wetter the soil, the lower the voltage on the signal pin.',id:'Probe tanpa korosi yang membaca air di tanah lewat kapasitansi. Makin basah tanahnya, makin rendah tegangan di pin sinyal.'},
  note:{en:'Set the wetness. Dry reads high (about 2.8 V), wet reads low (about 1.2 V).',id:'Atur kebasahan. Kering terbaca tinggi (sekitar 2,8 V), basah terbaca rendah (sekitar 1,2 V).'},
 },
 power:{rail:['VCC','GND'],min:3.3,max:5.5,ma:5},
 inputs:[{type:'range',key:'wetness',label:{en:'Soil wetness (%)',id:'Kebasahan tanah (%)'},min:0,max:100,step:1,default:40}],
 create(ctx){
  const sig=ctx.analogPin('SIG');
  const wet=()=>clamp(Math.round(num(ctx.props.wetness,40)),0,100);
  return {
   state:()=>({wetness:wet(),volts:round1(soilVolts(wet())*10)/10}),
   adc:()=>sig?{pin:sig,volts:soilVolts(wet())}:null,
  };
 },
});
