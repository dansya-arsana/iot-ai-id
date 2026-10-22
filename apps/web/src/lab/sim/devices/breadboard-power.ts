/**
 * BREADBOARD-POWER (MB102 style, protocol 'gpio', a power part): a module that plugs into the rails of a solderless breadboard.
 * A barrel jack takes 6.5-12 V; two AMS1117 regulators (5 V and 3.3 V, one per rail) feed the left and right rail, and a jumper per rail
 * picks 5 V or 3.3 V (the real board also has a USB input and an on/off slide switch; here the switch is the `on` toggle).
 * For the net solver each rail is a regulator from VIN: out = min(rail volts, in - 1.3), and the switch gates both.
 * Pins: VIN (jack +), GND, LEFT (left rail), RIGHT (right rail). Wires only (no breadboard holes). Pair: scene/parts/breadboard-power.ts
 */
import {defineDevice,round1} from './types';

export type BreadboardPowerState={on:boolean;left:number;right:number;vin:number|null;leftV:number|null;rightV:number|null};

const railVolts=(v:unknown):number=>v==='3.3'?3.3:5;

export const device=defineDevice<BreadboardPowerState>({
 kind:'breadboard-power',protocol:'gpio',
 pins:['VIN','GND','LEFT','RIGHT'],
 power:{rail:['VIN','GND'],min:6.5,max:12,ma:700},
 // a rail whose switch is off behaves like a regulator with 0 V out
 regulators:p=>p.on===false?[]:[{in:'VIN',out:'LEFT',gnd:'GND',volts:railVolts(p.left),dropout:1.3,maxMa:700},{in:'VIN',out:'RIGHT',gnd:'GND',volts:railVolts(p.right),dropout:1.3,maxMa:700}],
 copy:{
  name:{en:'Rail power board (battery jack)',id:'Papan daya jalur (jack baterai)'},
  desc:{en:'A small board for the breadboard rails: it takes 6.5-12 V from a battery and gives a steady 5 V or 3.3 V on each rail, chosen by a jumper.',id:'Papan kecil untuk jalur breadboard: menerima 6,5-12 V dari baterai dan memberi 5 V atau 3,3 V yang stabil di tiap jalur, dipilih dengan jumper.'},
  note:{en:'Wire a battery to VIN and GND, then run LEFT and RIGHT to your parts. Set a rail to 3.3 V for parts that must not see 5 V.',id:'Kabelkan baterai ke VIN dan GND, lalu hubungkan LEFT dan RIGHT ke komponen. Atur jalur ke 3,3 V untuk komponen yang tidak boleh kena 5 V.'},
 },
 inputs:[
  {type:'toggle',key:'on',label:{en:'Power switch',id:'Saklar daya'},default:true},
  {type:'choice',key:'left',label:{en:'Left rail jumper',id:'Jumper jalur kiri'},options:[{value:'5',label:{en:'5 V',id:'5 V'}},{value:'3.3',label:{en:'3.3 V',id:'3,3 V'}}],default:'5'},
  {type:'choice',key:'right',label:{en:'Right rail jumper',id:'Jumper jalur kanan'},options:[{value:'5',label:{en:'5 V',id:'5 V'}},{value:'3.3',label:{en:'3.3 V',id:'3,3 V'}}],default:'5'},
 ],
 defaults:{on:true,left:'5',right:'5'},
 create(ctx){
  return {
   state:()=>{
    const g=ctx.volts('GND')??0,at=(p:string):number|null=>{const v=ctx.volts(p);return v===null?null:round1(v-g);};
    return {on:ctx.props.on!==false,left:railVolts(ctx.props.left),right:railVolts(ctx.props.right),vin:at('VIN'),leftV:at('LEFT'),rightV:at('RIGHT')};
   },
  };
 },
});
