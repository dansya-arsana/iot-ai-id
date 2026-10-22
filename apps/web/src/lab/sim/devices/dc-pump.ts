/**
 * DC-PUMP (mini submersible pump, 3-6 V, desk prop, protocol 'gpio'): a small brushed motor spinning an impeller inside a sealed housing.
 * Typical hobby spec (the "120 L/H" R385-class pumps): 2.5-6 V, 130-220 mA, up to about 100 L/h at 6 V with the outlet free, lift about 40-110 cm.
 * It has two wires. It is a load: wire + and - part to part (a MOSFET module V+/V-, a relay COM/NO and a battery, a driver OUT).
 * Model: the net solver gives the voltage across + and -; it starts above 2.0 V, flow rises linearly with voltage and saturates at 6 V,
 * current is about 70 mA + 25 mA per volt. A floating end means no current (open circuit). It must be under water to pump: out of the water
 * it spins freely, moves nothing and its impeller bearing runs dry (the sim counts dry seconds and flags them after 10 s).
 * Pair: scene/parts/dc-pump.ts. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';

export const PUMP_START_V=2;
export const PUMP_RATED_V=6;
export const PUMP_MAX_LH=100;
export const PUMP_DRY_LIMIT_S=10;

export type DcPumpState={
 volts:number;/** litres per hour at the outlet (0 when dry) */flowLh:number;ma:number;/** impeller speed as a fraction of full speed */spin:number;
 submerged:boolean;/** spinning without water */dryRun:boolean;/** seconds spent running dry */dryS:number;/** dry for longer than the bearing likes */overheated:boolean;
};

export const device=defineDevice<DcPumpState>({
 kind:'dc-pump',protocol:'gpio',
 pins:['+','-'],
 power:{rail:['+','-'],min:2.5,max:6,ma:200,external:true},
 copy:{
  name:{en:'Mini submersible pump (3-6 V)',id:'Pompa mini celup (3-6 V)'},
  desc:{en:'A small water pump you drop into a cup or tank. It turns a few volts into a stream of water, up to about 100 litres an hour. It must sit in water: running dry wears it out.',id:'Pompa air kecil yang dicelupkan ke gelas atau bak. Ia mengubah beberapa volt menjadi aliran air, hingga sekitar 100 liter per jam. Ia harus terendam: berjalan kering merusaknya.'},
  note:{en:'It draws 150-250 mA, too much for a pin: switch it with a MOSFET or a relay from its own supply.',id:'Ia menarik 150-250 mA, terlalu besar untuk sebuah pin: sakelar dengan MOSFET atau relay dari catunya sendiri.'},
 },
 inputs:[{type:'toggle',key:'submerged',label:{en:'In the water',id:'Terendam air'},default:true}],
 defaults:{submerged:true},
 create(ctx){
  let spin=0,dryS=0;
  let st:DcPumpState={volts:0,flowLh:0,ma:0,spin:0,submerged:true,dryRun:false,dryS:0,overheated:false};
  return {
   state:()=>st,
   update(f){
    const a=ctx.volts('+'),b=ctx.volts('-');
    const v=a!==null&&b!==null?Math.max(0,a-b):0;   // a floating end is an open circuit
    const submerged=ctx.props.submerged!==false;
    const drive=v>=PUMP_START_V?Math.min(1,(v-PUMP_START_V*0.75)/(PUMP_RATED_V-PUMP_START_V*0.75)):0;
    spin+=(drive-spin)*(1-Math.exp(-f.dtSec/0.12));
    if(f.dtSec===0)spin=drive;
    const running=spin>0.05;
    dryS=running&&!submerged?dryS+f.dtSec:Math.max(0,dryS-f.dtSec*0.2);
    const flow=submerged?PUMP_MAX_LH*spin:0;
    const ma=v>=PUMP_START_V?Math.round((70+25*v)*(submerged?1:0.8)):Math.round(v*5);
    st={volts:Math.round(v*100)/100,flowLh:Math.round(flow*10)/10,ma,spin:Math.round(spin*1000)/1000,submerged,dryRun:running&&!submerged,dryS:Math.round(dryS*10)/10,overheated:dryS>PUMP_DRY_LIMIT_S};
   },
  };
 },
});
