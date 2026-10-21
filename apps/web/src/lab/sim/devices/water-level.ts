/**
 * WATER-LEVEL device (protocol 'adc'): red-PCB water level strip (10 power traces interleaved with 10 sense traces).
 * Water bridges neighbouring traces, so the analog output rises with the immersed depth of the ~40 mm trace area:
 * 0 V dry, about 2.4 V (roughly 490 on a 10-bit ADC at 5 V) fully covered. The response is slightly concave because
 * the first traces to get wet short the most resistance. Pins left to right on the real board: S, +, -.
 * Pair: scene/parts/water-level.ts. Auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';

export type WaterLevelState={depth:number;volts:number};

export const WATER_TRACE_MM=40;
export const WATER_FULL_V=2.4;
/** Output voltage for an immersion depth in mm. */
export const waterVolts=(depth:number):number=>WATER_FULL_V*Math.pow(clamp(depth,0,WATER_TRACE_MM)/WATER_TRACE_MM,0.85);

export const device=defineDevice<WaterLevelState>({
 kind:'water-level',protocol:'adc',
 pins:['SIG','VCC','GND'],holes:[0,1,2],
 copy:{
  name:{en:'Water level sensor (strip)',id:'Sensor level air (strip)'},
  desc:{en:'A strip of exposed copper traces. Water bridges the traces, so the analog voltage grows with how deep the strip is submerged.',id:'Strip jalur tembaga terbuka. Air menghubungkan jalur-jalurnya, jadi tegangan analog naik seiring dalamnya strip terendam.'},
  note:{en:'Set the immersion depth in mm. Dry reads 0 V, fully covered about 2.4 V.',id:'Atur kedalaman rendaman dalam mm. Kering terbaca 0 V, terendam penuh sekitar 2,4 V.'},
 },
 inputs:[{type:'range',key:'depth',label:{en:'Immersion depth (mm)',id:'Kedalaman rendam (mm)'},min:0,max:WATER_TRACE_MM,step:1,default:10}],
 create(ctx){
  const sig=ctx.pin('SIG');
  const depth=()=>clamp(Math.round(num(ctx.props.depth,10)),0,WATER_TRACE_MM);
  return {
   state:()=>({depth:depth(),volts:Math.round(waterVolts(depth())*100)/100}),
   adc:()=>sig?{pin:sig,volts:waterVolts(depth())}:null,
  };
 },
});
