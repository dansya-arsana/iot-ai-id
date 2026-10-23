/**
 * PUMP-12V-R385 device (protocol 'gpio', desk prop): 12 V DC diaphragm pump, R385 class.
 * Vendor sheets disagree (see docs/lab-parts/pump-12v-r385.md); the values used here, chosen from the middle of the stated ranges:
 *  - 6-12 V DC; start above 3 V (ours: below that the motor cannot turn the diaphragm); flow rises linearly from 3 V to 1.5 L/min at 12 V (sheets: 1.5-2, range 1-3).
 *  - Loaded current 0.6 A at 12 V (sheets: 0.5-0.7), no-load 0.23 A at 12 V; both scale with v/12.
 *  - Start surge about 2 A at 12 V for 100 ms (sheets: "up to about 2 A"; the 100 ms is our assumption): size the relay, fuse and supply for it.
 *  - Suction about 2 m: a self-priming diaphragm still needs a filled hose, so the `primed` input must be true or it only moves air (no flow, dry seconds count).
 *  - It is not submersible: it must stay dry.
 * Model: the net solver gives the voltage across + and -; a floating end is an open circuit. Wire + and - part to part (relay COM/NO and a 12 V source).
 * Pair: scene/parts/pump-12v-r385.ts. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';

export const PUMP_START_V=3;
export const PUMP_RATED_V=12;
export const PUMP_MAX_LMIN=1.5;
export const PUMP_LOADED_A=0.6;
export const PUMP_NOLOAD_A=0.23;
export const PUMP_SURGE_A=2;
export const PUMP_SURGE_S=0.1;
export const PUMP_DRY_LIMIT_S=30;

export type Pump12vState={volts:number;/** litres per minute at the outlet (0 when not primed) */flowLmin:number;ma:number;/** 0..1 of full speed */spin:number;
 primed:boolean;/** inside the 100 ms start surge */surge:boolean;/** running with no water in the head */dryRun:boolean;dryS:number;/** dry for longer than the diaphragm likes */overheated:boolean};

export const device=defineDevice<Pump12vState>({
 kind:'pump-12v-r385',protocol:'gpio',
 pins:['+','-'],
 power:{rail:['+','-'],min:6,max:12,ma:600,external:true},
 copy:{
  name:{en:'Diaphragm water pump 12 V (R385)',id:'Pompa air diafragma 12 V (R385)'},
  desc:{en:'A small 12 V pump for irrigation lines. Fill the hose first (prime it), then switch it with a relay: it moves about 1.5 litres a minute.',id:'Pompa 12 V kecil untuk jalur irigasi. Isi selang dulu (prime), lalu sakelar dengan relay: ia memindahkan sekitar 1,5 liter per menit.'},
  note:{en:'Draws about 0.6 A, with a start surge up to about 2 A: size the relay, fuse and supply for the surge. Add a flyback diode. Not submersible: keep it dry. Running it dry wears the diaphragm.',id:'Menarik sekitar 0,6 A, dengan lonjakan awal hingga sekitar 2 A: ukur relay, sekring, dan catu untuk lonjakan itu. Pasang dioda flyback. Tidak tahan terendam: jaga tetap kering. Berjalan kering merusak diafragma.'},
 },
 inputs:[{type:'toggle',key:'primed',label:{en:'Hose filled (primed)',id:'Selang terisi (prime)'},default:true}],
 defaults:{primed:true},
 create(ctx){
  let spin=0,dryS=0,surgeT=PUMP_SURGE_S,was=false;
  let st:Pump12vState={volts:0,flowLmin:0,ma:0,spin:0,primed:true,surge:false,dryRun:false,dryS:0,overheated:false};
  return {
   state:()=>st,
   update(f){
    const a=ctx.volts('+'),b=ctx.volts('-');
    const v=a!==null&&b!==null?Math.max(0,a-b):0;
    const primed=ctx.props.primed!==false;
    const on=v>=PUMP_START_V;
    const drive=on?Math.min(1,(v-PUMP_START_V*0.8)/(PUMP_RATED_V-PUMP_START_V*0.8)):0;
    spin+=(drive-spin)*(1-Math.exp(-f.dtSec/0.1));
    if(f.dtSec===0)spin=drive;
    if(on&&!was)surgeT=0;
    else if(on&&f.dtSec>0)surgeT+=f.dtSec;
    was=on;
    const surge=on&&surgeT<PUMP_SURGE_S&&f.dtSec>0;
    const running=spin>0.05;
    dryS=running&&!primed?dryS+f.dtSec:Math.max(0,dryS-f.dtSec*0.2);
    const k=v/PUMP_RATED_V;
    const amps=!on?0:surge?PUMP_SURGE_A*k:(primed?PUMP_LOADED_A:PUMP_NOLOAD_A)*k;
    const flow=primed?PUMP_MAX_LMIN*Math.max(0,(v-PUMP_START_V)/(PUMP_RATED_V-PUMP_START_V))*(spin>0.05?1:0):0;
    st={volts:Math.round(v*100)/100,flowLmin:Math.round(flow*100)/100,ma:Math.round(amps*1000),spin:Math.round(spin*1000)/1000,primed,surge,dryRun:running&&!primed,dryS:Math.round(dryS*10)/10,overheated:dryS>PUMP_DRY_LIMIT_S};
   },
  };
 },
});
