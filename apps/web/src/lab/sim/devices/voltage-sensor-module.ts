/**
 * VOLTAGE-SENSOR-MODULE (protocol 'adc'): the common "0-25 V" voltage divider board.
 * Real circuit (public knowledge, our own words): R1 = 30 kohm from VIN+ to the signal, R2 = 7.5 kohm from the signal to GND, so
 * Vout = Vin x 7.5/(30+7.5) = Vin / 5. 25 V in gives 5 V out. The output impedance is R1 || R2 = 6 kohm (the simulator's ADC input is ideal, so it reads the divider voltage unloaded).
 * Header: S (signal), + (not connected on the real board), - (GND). Screw terminal: VIN+ and VIN- (tied to the header GND).
 * The measured voltage is whatever net VIN+ sits on (a battery, a regulator, a rail), minus VIN-. With VIN+ unwired a probe value from the
 * popover stands in, so the part can be tried on its own. Above 25 V the divider output would exceed 5 V: the pin is clamped at 5 V and `over` is set.
 * Pair: scene/parts/voltage-sensor-module.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';

export type VoltageSensorState={vin:number;vout:number;counts:number;probe:boolean;over:boolean};

/** Divider values of the board (ohms). */
export const VDIV_R1=30000;
export const VDIV_R2=7500;
export const VDIV_RATIO=VDIV_R2/(VDIV_R1+VDIV_R2);   // 0.2
export const VDIV_FULL_SCALE_V=25;

export const device=defineDevice<VoltageSensorState>({
 kind:'voltage-sensor-module',protocol:'adc',
 pins:['S','NC','GND','VIN+','VIN-'],holes:[0,1,2],bodyX:[-2.5,22],
 copy:{
  name:{en:'Voltage sensor module (0-25 V)',id:'Modul sensor tegangan (0-25 V)'},
  desc:{en:'A two-resistor divider on a small board: it shrinks 0-25 V down to 0-5 V so an analog pin can read a battery or a supply safely.',id:'Pembagi dua resistor di papan kecil: mengecilkan 0-25 V menjadi 0-5 V agar pin analog aman membaca baterai atau catu daya.'},
  note:{en:'Wire the voltage to measure to VIN+ and VIN-, S to an analog pin and GND to the board. Multiply the reading by 5 to get the real volts. The + pin on the header does nothing.',id:'Hubungkan tegangan yang diukur ke VIN+ dan VIN-, S ke pin analog dan GND ke board. Kalikan bacaan dengan 5 untuk volt asli. Pin + di header tidak dipakai.'},
 },
 // used only while VIN+ is not wired to anything
 inputs:[{type:'range',key:'probe',label:{en:'Probe voltage (when VIN+ is not wired)',id:'Tegangan uji (saat VIN+ tak terhubung)'},min:0,max:30,step:0.1,unit:'V',default:12}],
 defaults:{probe:12},
 create(ctx){
  const sig=ctx.analogPin('S');
  const measured=():{vin:number;probe:boolean}=>{
   const v=ctx.volts('VIN+');
   if(v===null)return {vin:clamp(num(ctx.props.probe,12),0,30),probe:true};
   // minus end: the terminal (VIN-) if it is wired, else the header GND the module shares
   const m=ctx.volts('VIN-')??ctx.volts('GND')??0;
   return {vin:Math.max(0,v-m),probe:false};
  };
  const out=():{vin:number;probe:boolean;raw:number;vout:number;over:boolean}=>{
   const m=measured(),raw=m.vin*VDIV_RATIO;
   return {...m,raw,vout:clamp(raw,0,5),over:m.vin>VDIV_FULL_SCALE_V};
  };
  return {
   state:()=>{
    const o=out();
    return {vin:Math.round(o.vin*100)/100,vout:Math.round(o.vout*1000)/1000,counts:Math.round(o.vout/5*1023),probe:o.probe,over:o.over};
   },
   adc:()=>sig?{pin:sig,volts:out().vout}:null,
   // VIN- is the same copper as the header GND
   switches:()=>[{a:'GND',b:'VIN-',closed:true}],
  };
 },
});
