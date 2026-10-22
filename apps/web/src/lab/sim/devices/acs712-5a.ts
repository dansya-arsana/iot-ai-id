/**
 * ACS712-5A current sensor module (protocol 'adc'): a Hall-effect sensor in a SOIC-8 on a small blue board.
 * Datasheet behaviour (public, written by us): the current to measure flows through the IP+ / IP- screw terminals (copper path, about 1.2 mohm).
 * VIOUT = VCC/2 + sensitivity x I, sensitivity 185 mV/A on the 5 A part at VCC = 5 V, and the whole transfer is RATIOMETRIC to VCC
 * (a 4.5 V supply gives 2.25 V at zero current and 166.5 mV/A). The output saturates about 0.2 V from either rail, the range is -5..+5 A,
 * supply 4.5-5.5 V at about 10 mA. The module's header is VCC, OUT, GND.
 * The simulator has no current solver, so the current that flows is a popover value (amps); the output voltage is computed from it
 * and from the live VCC exactly like the chip. A DC value only: a sketch that wants AC mains current would need a sampled sine,
 * which the 1 ms simulation slice cannot present honestly. IP+ and IP- are joined while the part exists (the copper path), so it can sit in series.
 * Pair: scene/parts/acs712-5a.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';

export type Acs7125aState={amps:number;vcc:number;vout:number;counts:number;powered:boolean;saturated:boolean};

/** 185 mV/A at 5 V supply (ACS712ELCTR-05B), scaled by VCC/5. */
export const ACS712_5A_MV_PER_A=185;
/** Output stays this far (volts) from VCC and GND when the chip saturates (VIOUT(sat) about 0.2 V). */
export const ACS712_SAT_V=0.2;
export const ACS712_5A_MAX_A=5;

/** The chip transfer function: output volts for a supply voltage and a current. */
export function acs712Out(vcc:number,amps:number):{vout:number;saturated:boolean}{
 const raw=vcc/2+(ACS712_5A_MV_PER_A/1000)*(vcc/5)*amps;
 const vout=clamp(raw,ACS712_SAT_V,Math.max(ACS712_SAT_V,vcc-ACS712_SAT_V));
 return {vout,saturated:vout!==raw};
}

export const device=defineDevice<Acs7125aState>({
 kind:'acs712-5a',protocol:'adc',
 // header (breadboard legs) then the two screw terminals of the measured wire
 pins:['VCC','OUT','GND','IP+','IP-'],holes:[0,1,2],bodyX:[-2.5,28.5],
 power:{rail:['VCC','GND'],min:4.5,max:5.5,ma:10},
 copy:{
  name:{en:'ACS712 current sensor (5 A)',id:'Sensor arus ACS712 (5 A)'},
  desc:{en:'Measures the current in a wire without touching the circuit. The output rests at half the supply (2.5 V) and moves 185 mV for every amp, up or down depending on direction.',id:'Mengukur arus di sebuah kabel tanpa mengganggu rangkaian. Keluarannya diam di setengah tegangan catu (2,5 V) dan bergeser 185 mV untuk tiap ampere, naik atau turun sesuai arah.'},
  note:{en:'Put the wire to measure through the two screw terminals. Read OUT with analogRead and subtract 512 as the zero. Set the current in the popover.',id:'Lewatkan kabel yang diukur lewat dua terminal sekrup. Baca OUT dengan analogRead dan kurangi 512 sebagai nol. Atur arus di popover.'},
 },
 inputs:[{type:'range',key:'amps',label:{en:'Current through the terminals',id:'Arus lewat terminal'},min:-5,max:5,step:0.05,unit:'A',default:0}],
 defaults:{amps:0},
 create(ctx){
  const out=ctx.analogPin('OUT');   // also resolves A6/A7 of the Nano
  const amps=():number=>clamp(num(ctx.props.amps,0),-ACS712_5A_MAX_A,ACS712_5A_MAX_A);
  /** Supply seen by the chip: VCC relative to GND, null while unpowered or floating. */
  const vcc=():number|null=>{
   const v=ctx.volts('VCC');if(v===null)return null;
   const d=v-(ctx.volts('GND')??0);
   return d>=2?d:null;   // below about 2 V the chip does not run
  };
  const level=():{vout:number;saturated:boolean;vcc:number|null}=>{
   const s=vcc();
   if(s===null)return {vout:0,saturated:false,vcc:null};
   return {...acs712Out(s,amps()),vcc:s};
  };
  return {
   state:()=>{
    const l=level(),a=Math.round(amps()*100)/100;
    return {amps:a,vcc:l.vcc===null?0:Math.round(l.vcc*100)/100,vout:Math.round(l.vout*1000)/1000,counts:Math.round(clamp(l.vout/5,0,1)*1023),powered:l.vcc!==null,saturated:l.saturated};
   },
   // polled after every slice: an unpowered chip puts nothing on the pin
   adc:()=>{const l=level();return out&&l.vcc!==null?{pin:out,volts:l.vout}:null;},
   // the copper path of the sensor joins the two current terminals
   switches:()=>[{a:'IP+',b:'IP-',closed:true}],
  };
 },
});
