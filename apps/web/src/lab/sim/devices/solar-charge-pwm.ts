/**
 * SOLAR-CHARGE-PWM (10 A PWM solar charge controller, 12/24 V, protocol 'gpio', desk prop): screw terminals only.
 * Reference [V] Renogy Wanderer 10A (WND10): 10 A charge current, PV input max 50 V DC, battery types Sealed/Gel/Flooded/LFP, 12/24 V auto-detect for
 * non-lithium only (set LFP by hand), 119 x 75 x 27.5 mm, ~122 g. Datasheet https://uk.renogy.com/cdn/shop/files/WND10-Datasheet.pdf
 * Set points (absorb / float / low-voltage disconnect / reconnect) are typical 12 V values [U: the manual has the exact ones]:
 *   agm 14.4/13.7, gel 14.2/13.7, flooded 14.6/13.7, lfp 14.4/13.5; LVD 10.7 / LVR 12.6 (lead-acid), LVD 11.0 / LVR 12.8 (lfp).
 * Common-negative [U: read from the manual]: PV-, BAT- and LOAD- are one node, so BAT+ <-> LOAD+ is the switched path.
 * PV to battery charging is NOT a contact (two ideal sources must never be joined): the charge current is computed in state.
 * PWM: charge A = min(10 A, panel short-circuit current) while PV volts > battery volts + 0.5 V; bulk below absorb-0.3 V, absorb (tapering) up to absorb, then float.
 * A linked battery's chemistry is read from the sibling's props: a 3S Li-ion pack, or an LFP pack with the controller not set to lfp, raises issue 'chemistry'.
 * Pair: scene/parts/solar-charge-pwm.ts. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import type {DeviceCtx} from './types';
import {panelIsc,panelSpec,irradiance} from './solar-panel';

export type ControllerBattery='agm'|'gel'|'flooded'|'lfp';
export const PV_MAX_V=50;
export const CHARGE_MAX_A=10;
export const SETPOINTS:Record<ControllerBattery,{absorb:number;float:number;lvd:number;lvr:number}>={
 agm:{absorb:14.4,float:13.7,lvd:10.7,lvr:12.6},
 gel:{absorb:14.2,float:13.7,lvd:10.7,lvr:12.6},
 flooded:{absorb:14.6,float:13.7,lvd:10.7,lvr:12.6},
 lfp:{absorb:14.4,float:13.5,lvd:11.0,lvr:12.8},
};
export const DIMS={l:119,w:75,h:27.5,mm:true as const};
const batteryOf=(p:{battery?:unknown}):ControllerBattery=>{const b=p.battery;return b==='agm'||b==='gel'||b==='flooded'?b:'lfp';};
export type Stage='night'|'bulk'|'absorb'|'float';

/** Pure charge model, exported for tests and Pro checks. */
export function chargeModel(o:{pvV:number;batV:number;iscA:number;battery:ControllerBattery}):{stage:Stage;chargeA:number}{
 const sp=SETPOINTS[o.battery];
 if(!(o.pvV>o.batV+0.5)||o.iscA<=0.01)return {stage:'night',chargeA:0};
 const full=Math.min(CHARGE_MAX_A,o.iscA);
 if(o.batV<sp.absorb-0.3)return {stage:'bulk',chargeA:Math.round(full*100)/100};
 if(o.batV<sp.absorb)return {stage:'absorb',chargeA:Math.round(Math.max(0.05*full,full*(sp.absorb-o.batV)/0.3)*100)/100};
 return {stage:'float',chargeA:Math.round(Math.min(full,0.1)*100)/100};
}
/** Low-voltage disconnect with hysteresis. */
export const loadClosed=(was:boolean,batV:number,battery:ControllerBattery,loadOn:boolean):boolean=>{
 const sp=SETPOINTS[battery];
 if(!loadOn||batV<=0)return false;
 if(batV<=sp.lvd)return false;
 if(was)return true;
 return batV>=sp.lvr;
};

export type SolarChargeState={battery:string;stage:string;chargeA:number;pvV:number;batV:number;loadOn:boolean;loadConnected:boolean;issue:string;pvOverV:boolean;lvdV:number};

function linked(ctx:DeviceCtx,pin:string,kind:string){
 const peer=ctx.peers(pin).find(q=>q.kind===kind);
 return peer?ctx.siblings().find(s=>s.spec.id===peer.part):undefined;
}
const diff=(ctx:DeviceCtx,a:string,b:string):number=>{const x=ctx.volts(a),y=ctx.volts(b);return x===null||y===null?0:Math.max(0,x-y);};

export const device=defineDevice<SolarChargeState>({
 kind:'solar-charge-pwm',protocol:'gpio',
 pins:['PV+','PV-','BAT+','BAT-','LOAD+','LOAD-'], // screw terminals: wires only
 copy:{
  name:{en:'PWM solar charge controller (10 A)',id:'Pengontrol pengisi surya PWM (10 A)'},
  desc:{en:'Sits between the panel, the battery and the load. It charges the battery from the panel in stages and switches the load off when the battery is nearly empty.',id:'Berada di antara panel, baterai dan beban. Mengisi baterai dari panel bertahap dan mematikan beban saat baterai hampir habis.'},
  note:{en:'Connect the battery first, then the panel, then the load. PV input maximum is 50 V. LFP mode must be set by hand. The load output stops at the low-voltage disconnect.',id:'Sambungkan baterai dulu, lalu panel, lalu beban. Masukan PV maksimum 50 V. Mode LFP harus diatur manual. Keluaran beban berhenti di batas tegangan rendah.'},
 },
 inputs:[
  {type:'choice',key:'battery',label:{en:'Battery type',id:'Jenis baterai'},options:[{value:'lfp',label:{en:'LiFePO4 (LFP)',id:'LiFePO4 (LFP)'}},{value:'agm',label:{en:'Sealed AGM',id:'AGM tertutup'}},{value:'gel',label:{en:'Gel',id:'Gel'}},{value:'flooded',label:{en:'Flooded',id:'Basah'}}],default:'lfp'},
  {type:'toggle',key:'loadOn',label:{en:'Load output on',id:'Keluaran beban aktif'},default:true},
 ],
 defaults:{battery:'lfp',loadOn:true},
 create(ctx){
  let closed=false,lastBat=0;
  let st:SolarChargeState={battery:'lfp',stage:'night',chargeA:0,pvV:0,batV:0,loadOn:true,loadConnected:false,issue:'',pvOverV:false,lvdV:11};
  const calc=():void=>{
   const battery=batteryOf(ctx.props),loadOn=ctx.props.loadOn!==false;
   const pvV=diff(ctx,'PV+','PV-'),batV=lastBat=diff(ctx,'BAT+','BAT-');
   const pv=linked(ctx,'PV+','solar-panel');
   const iscA=pv?panelIsc(panelSpec(pv.props),irradiance(pv.props)):pvV>0?CHARGE_MAX_A:0;
   const m=chargeModel({pvV,batV,iscA,battery});
   closed=loadClosed(closed,batV,battery,loadOn);
   const bat18=linked(ctx,'BAT+','battery-18650-pack');
   const lfp=bat18?bat18.props.chem!=='liion-3s':!!linked(ctx,'BAT+','battery-lifepo4-12v');
   const liion=bat18?.props.chem==='liion-3s';
   const issue=liion||(lfp&&battery!=='lfp')?'chemistry':'';
   st={battery,stage:m.stage,chargeA:m.chargeA,pvV:Math.round(pvV*100)/100,batV:Math.round(batV*100)/100,loadOn,loadConnected:closed,issue,pvOverV:pvV>PV_MAX_V,lvdV:SETPOINTS[battery].lvd};
  };
  return {
   state:()=>st,
   update(){calc();},
   // common-negative node, switched positive: BAT+ <-> LOAD+ follows the low-voltage disconnect
   switches:()=>[{a:'BAT-',b:'LOAD-',closed:true},{a:'BAT-',b:'PV-',closed:true},{a:'BAT+',b:'LOAD+',closed:closed&&lastBat>0}],
  };
 },
});
