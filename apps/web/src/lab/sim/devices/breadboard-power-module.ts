/**
 * BREADBOARD-POWER-MODULE (MB102 style, protocol 'gpio', a power part): the board that clips onto the end of a breadboard and feeds its two rails.
 * Real behaviour (public, written by us): two inputs, a DC barrel jack (6.5-12 V) and a USB port (5 V); a slide switch; two linear regulators
 * (5 V AMS1117 and 3.3 V AMS1117, dropout about 1.3 V and 1.1 V, rated 700 mA per rail) and, for each rail, a jumper that picks 5 V or 3.3 V.
 * Source jack: each rail is a regulator from VIN. Source USB: the USB 5 V reaches the 5 V jumper position directly (a stiff supply) and the 3.3 V position
 * through the 3.3 V regulator (3.3 V). Switch off: both rails are dead. The green power LED lights while the rails live.
 * This kind is the USB-capable variant of `breadboard-power`; its pins are the same wires: VIN (jack +), GND, LEFT, RIGHT.
 * Pair: scene/parts/breadboard-power-module.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,round1} from './types';

export type BreadboardPowerModuleState={on:boolean;source:string;left:number;right:number;vin:number|null;leftV:number|null;rightV:number|null;live:boolean};

const railVolts=(v:unknown):number=>v==='3.3'?3.3:5;
const usb=(v:unknown):boolean=>v==='usb';
const MA=700;

export const device=defineDevice<BreadboardPowerModuleState>({
 kind:'breadboard-power-module',protocol:'gpio',
 pins:['VIN','GND','LEFT','RIGHT'],
 power:{rail:['VIN','GND'],min:6.5,max:12,ma:MA},
 // jack: a regulator per rail (5 V: 1.3 V dropout, 3.3 V: 1.1 V dropout); off: nothing
 regulators:p=>p.on===false||usb(p.source)?[]:[
  {in:'VIN',out:'LEFT',gnd:'GND',volts:railVolts(p.left),dropout:railVolts(p.left)===5?1.3:1.1,maxMa:MA},
  {in:'VIN',out:'RIGHT',gnd:'GND',volts:railVolts(p.right),dropout:railVolts(p.right)===5?1.3:1.1,maxMa:MA},
 ],
 // USB: the 5 V rail comes straight from the port, the 3.3 V one from its regulator: both are stiff sources against GND
 supplies:p=>p.on===false||!usb(p.source)?[]:[
  {pos:'LEFT',neg:'GND',volts:railVolts(p.left),maxMa:500},
  {pos:'RIGHT',neg:'GND',volts:railVolts(p.right),maxMa:500},
 ],
 copy:{
  name:{en:'MB102 power module (jack or USB)',id:'Modul daya MB102 (jack atau USB)'},
  desc:{en:'The small board that clips onto the end of a breadboard and powers both rails. It takes a 6.5-12 V jack or USB, and each rail jumper picks 5 V or 3.3 V.',id:'Papan kecil yang dijepit di ujung breadboard untuk memberi daya kedua jalur. Menerima jack 6,5-12 V atau USB, dan jumper tiap jalur memilih 5 V atau 3,3 V.'},
  note:{en:'Choose the source in the popover. With the jack, wire a battery to VIN and GND. Run LEFT and RIGHT to your parts and keep 3.3 V parts off a 5 V rail.',id:'Pilih sumber di popover. Dengan jack, kabelkan baterai ke VIN dan GND. Hubungkan LEFT dan RIGHT ke komponen dan jauhkan komponen 3,3 V dari jalur 5 V.'},
 },
 inputs:[
  {type:'toggle',key:'on',label:{en:'Power switch',id:'Saklar daya'},default:true},
  {type:'choice',key:'source',label:{en:'Power source',id:'Sumber daya'},options:[{value:'jack',label:{en:'Barrel jack (VIN)',id:'Jack baterai (VIN)'}},{value:'usb',label:{en:'USB 5 V',id:'USB 5 V'}}],default:'jack'},
  {type:'choice',key:'left',label:{en:'Left rail jumper',id:'Jumper jalur kiri'},options:[{value:'5',label:{en:'5 V',id:'5 V'}},{value:'3.3',label:{en:'3.3 V',id:'3,3 V'}}],default:'5'},
  {type:'choice',key:'right',label:{en:'Right rail jumper',id:'Jumper jalur kanan'},options:[{value:'5',label:{en:'5 V',id:'5 V'}},{value:'3.3',label:{en:'3.3 V',id:'3,3 V'}}],default:'5'},
 ],
 defaults:{on:true,source:'jack',left:'5',right:'5'},
 create(ctx){
  return {
   state:()=>{
    const g=ctx.volts('GND')??0,at=(p:string):number|null=>{const v=ctx.volts(p);return v===null?null:round1(v-g);};
    const l=at('LEFT'),r=at('RIGHT');
    return {on:ctx.props.on!==false,source:usb(ctx.props.source)?'usb':'jack',left:railVolts(ctx.props.left),right:railVolts(ctx.props.right),vin:at('VIN'),leftV:l,rightV:r,live:(l??0)>=3||(r??0)>=3};
   },
  };
 },
});
