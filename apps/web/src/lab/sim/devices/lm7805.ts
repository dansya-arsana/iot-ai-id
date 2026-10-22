/**
 * LM7805 (protocol 'gpio', a power part: it has no signal pins): 5 V linear regulator in a TO-220 package.
 * Datasheet behaviour (public, written by us): output 5 V (4.8-5.2 V) while the input is at least about 7 V (dropout about 2 V at 1 A),
 * input up to 35 V, 1.5 A with a heat sink; the surplus (Vin - 5 V) x I is burned as heat, which is why a 12 V input into a 5 V load runs hot.
 * The net solver (sim/power.ts) treats it as a regulator: out = min(5, in - 2) above GND. Below 7 V in, the output sags and the lab warns.
 * Pins in package order seen from the front: 1 IN, 2 GND, 3 OUT. Pair: scene/parts/lm7805.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,round1} from './types';

export type Lm7805State={vin:number|null;vout:number|null;/** Vin - Vout: volts turned into heat per amp */dropV:number|null;regulating:boolean};

export const device=defineDevice<Lm7805State>({
 kind:'lm7805',protocol:'gpio',
 pins:['IN','GND','OUT'],holes:[0,1,2],
 power:{rail:['IN','GND'],min:7,max:35,ma:1000},
 regulators:()=>[{in:'IN',out:'OUT',gnd:'GND',volts:5,dropout:2,maxMa:1500}],
 copy:{
  name:{en:'LM7805 regulator (5 V)',id:'Regulator LM7805 (5 V)'},
  desc:{en:'A three-leg chip that turns a higher voltage (7-35 V) into a steady 5 V. The extra voltage is thrown away as heat.',id:'Chip tiga kaki yang mengubah tegangan lebih tinggi (7-35 V) menjadi 5 V yang stabil. Kelebihan tegangannya dibuang sebagai panas.'},
  note:{en:'Feed IN from a battery and join GND; take 5 V from OUT. Below 7 V in, the output sags.',id:'Beri IN dari baterai dan sambungkan GND; ambil 5 V dari OUT. Di bawah 7 V, keluaran turun.'},
 },
 inputs:[],
 create(ctx){
  return {
   state:()=>{
    const g=ctx.volts('GND')??0,i=ctx.volts('IN'),o=ctx.volts('OUT');
    const vin=i===null?null:round1(i-g),vout=o===null?null:round1(o-g);
    return {vin,vout,dropV:vin!==null&&vout!==null?round1(vin-vout):null,regulating:vout!==null&&vout>=4.8};
   },
  };
 },
});
