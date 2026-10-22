/**
 * AMS1117-3.3 (protocol 'gpio', a power part): low-dropout 3.3 V linear regulator (SOT-223) on a small breakout.
 * Datasheet behaviour (public, written by us): fixed 3.3 V (+-1 %), dropout about 1.1 V at 800 mA, input up to 15 V (rated 12 V), 1 A.
 * It is the usual way to get 3.3 V from the 5 V pin for sensors that must not see 5 V (a bare BME280, an ESP module).
 * Treated by the net solver as a regulator: out = min(3.3, in - 1.1) above GND. Pins: VIN, GND, VOUT. Pair: scene/parts/ams1117-3v3.ts
 */
import {defineDevice,round1} from './types';

export type Ams1117State={vin:number|null;vout:number|null;regulating:boolean};

export const device=defineDevice<Ams1117State>({
 kind:'ams1117-3v3',protocol:'gpio',
 pins:['VIN','GND','VOUT'],holes:[0,1,2],
 power:{rail:['VIN','GND'],min:4.4,max:15,ma:800},
 regulators:()=>[{in:'VIN',out:'VOUT',gnd:'GND',volts:3.3,dropout:1.1,maxMa:1000}],
 copy:{
  name:{en:'AMS1117-3.3 regulator',id:'Regulator AMS1117-3.3'},
  desc:{en:'A small regulator board that turns 5 V (or up to 15 V) into a steady 3.3 V for parts that must not see 5 V.',id:'Papan regulator kecil yang mengubah 5 V (atau sampai 15 V) menjadi 3,3 V yang stabil untuk komponen yang tidak boleh kena 5 V.'},
  note:{en:'Wire VIN to 5V, GND to GND and power the 3.3 V part from VOUT.',id:'Kabelkan VIN ke 5V, GND ke GND dan beri daya komponen 3,3 V dari VOUT.'},
 },
 inputs:[],
 create(ctx){
  return {
   state:()=>{
    const g=ctx.volts('GND')??0,i=ctx.volts('VIN'),o=ctx.volts('VOUT');
    const vin=i===null?null:round1(i-g),vout=o===null?null:round1(o-g);
    return {vin,vout,regulating:vout!==null&&vout>=3.2};
   },
  };
 },
});
