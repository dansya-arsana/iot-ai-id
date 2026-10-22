/**
 * LM35 precision analog thermometer (protocol 'adc'): OUT = 10 mV per degree Celsius, 0 V at 0 degC (basic range 2 to 150 degC).
 * Written from the public datasheet behaviour: supply 4 V to 30 V, output stage needs about 1.5 V of headroom below +VS, and the
 * output cannot go below 0 V on a single supply (the negative range needs an extra pull-down resistor and a negative rail, not modelled).
 * Typical accuracy is +-0.5 degC at 25 degC; we output the exact ideal value, the converter then quantises it (an Uno 10-bit ADC at 5 V
 * steps 4.88 mV, that is about 0.49 degC per count).
 * TO-92 pinout seen from the flat face: 1 +VS, 2 VOUT, 3 GND.
 * Pair: scene/parts/lm35.ts. Both are auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';

export const LM35_TEMP={min:0,max:150};
export const LM35_V_PER_C=0.01;
export const LM35_HEADROOM=1.5;

/** Output voltage for a temperature and a supply voltage. */
export function lm35Volts(tempC:number,supply:number):number{
 if(supply<2)return 0;   // the bias circuit is not alive
 const ideal=clamp(tempC,LM35_TEMP.min,LM35_TEMP.max)*LM35_V_PER_C;
 return Math.max(0,Math.min(ideal,supply-LM35_HEADROOM));
}

export type Lm35State={tempC:number;volts:number;supply:number;/** the Uno ADC count this voltage reads as (5 V reference) */adc:number};

export const device=defineDevice<Lm35State>({
 kind:'lm35',protocol:'adc',
 pins:['VS','OUT','GND'],holes:[0,1,2],
 copy:{
  name:{en:'LM35 temperature sensor',id:'Sensor suhu LM35'},
  desc:{en:'An analog thermometer: the output voltage is 10 millivolts for every degree Celsius, so 250 mV means 25 degrees.',id:'Termometer analog: tegangan keluaran 10 milivolt untuk setiap derajat Celsius, jadi 250 mV berarti 25 derajat.'},
  note:{en:'Slide the temperature. Read the OUT pin with analogRead and multiply by 5000 / 1023 / 10 to get degrees.',id:'Geser suhunya. Baca pin OUT dengan analogRead lalu kalikan 5000 / 1023 / 10 untuk mendapat derajat.'},
 },
 power:{rail:['VS','GND'],min:4,max:30,ma:0.06},
 inputs:[{type:'range',key:'tempC',label:{en:'Temperature',id:'Suhu'},min:LM35_TEMP.min,max:LM35_TEMP.max,step:0.5,unit:'°C',default:25}],
 defaults:{tempC:25},
 create(ctx){
  const pin=ctx.analogPin('OUT');
  const temp=():number=>clamp(num(ctx.props.tempC,25),LM35_TEMP.min,LM35_TEMP.max);
  const supply=():number=>ctx.supply()??ctx.volts('VS')??5;
  const volts=():number=>lm35Volts(temp(),supply());
  return {
   state:()=>{const v=volts();return {tempC:temp(),volts:v,supply:supply(),adc:Math.round(clamp(v/5,0,1)*1023)};},
   adc:()=>pin?{pin,volts:volts()}:null,
  };
 },
});
