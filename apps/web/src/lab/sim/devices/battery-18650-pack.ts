/**
 * BATTERY-18650-PACK (protocol 'gpio', desk prop): 18650 cells with a protection board (BMS) and two output leads.
 * `chem` is the D6 chemistry prop: 'lfp-4s' (4 x IFR18650, 3.2 V nominal, 12.8 V pack, default: matches a LFP-capable PWM controller) or
 * 'liion-3s' (3 x INR18650-35E class, 3.6 V nominal, 10.8-11.1 V pack, 12.6 V full: needs a Li-ion capable controller).
 * Cell references: IFR18650 ~1.5 Ah [U, cell makers differ 1.1-1.8 Ah], Samsung INR18650-35E 3.4 Ah, 2.65-4.2 V, 8 A max continuous.
 * BMS values are typical [U]: LFP over-charge ~3.65 V/cell, under-voltage ~2.5 V/cell; Li-ion 4.25 / 2.8 V. LFP must not charge below 0 C.
 * OCV curves are piecewise from public discharge behaviour. LFP is flat 3.2-3.3 V over 20-90 %, so SoC from voltage is poor.
 * A BMS under-voltage cut opens the output: the supply is 0 V.
 * Pair: scene/parts/battery-18650-pack.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';

export type Chem18650='lfp-4s'|'liion-3s';
export const CELL_MM={d:18.4,l:65.2}; // 18650 cell, Ø18.4 x 65.2 mm
export interface ChemSpec{series:number;ahCell:number;nominalCell:number;fullCell:number;cutCell:number;ovpCell:number;uvpCell:number}
export const CHEM:Record<Chem18650,ChemSpec>={
 'lfp-4s':{series:4,ahCell:1.5,nominalCell:3.2,fullCell:3.65,cutCell:2.5,ovpCell:3.75,uvpCell:2.5},
 'liion-3s':{series:3,ahCell:3.4,nominalCell:3.6,fullCell:4.2,cutCell:2.8,ovpCell:4.25,uvpCell:2.8},
};
/** [soc %, cell volts at rest] */
const LFP_OCV:readonly (readonly [number,number])[]=[[0,2.5],[5,3.0],[10,3.15],[20,3.22],[90,3.33],[100,3.45]];
const LIION_OCV:readonly (readonly [number,number])[]=[[0,2.8],[10,3.4],[30,3.6],[50,3.7],[70,3.85],[90,4.05],[100,4.2]];
export function interp(t:readonly (readonly [number,number])[],x:number):number{
 if(x<=t[0]![0])return t[0]![1];
 for(let i=1;i<t.length;i++){const a=t[i-1]!,b=t[i]!;if(x<=b[0])return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}
 return t[t.length-1]![1];
}
export const lfpCellV=(soc:number):number=>interp(LFP_OCV,clamp(soc,0,100));
export const liionCellV=(soc:number):number=>interp(LIION_OCV,clamp(soc,0,100));
export const chemOf=(p:{chem?:unknown}):Chem18650=>p.chem==='liion-3s'?'liion-3s':'lfp-4s';
export const parallelOf=(p:{parallel?:unknown}):number=>clamp(Math.round(num(p.parallel,1)),1,4);
export const bmsAmps=(p:{bmsA?:unknown}):number=>clamp(num(p.bmsA,10),1,40);
export type BmsState='ok'|'uvp'|'ovp'|'ocp'|'cold-charge';

/** Pack open-circuit volts and BMS verdict from the live props. */
export function packOutput(p:{chem?:unknown;soc?:unknown;tempC?:unknown}):{volts:number;bms:BmsState}{
 const chem=chemOf(p),c=CHEM[chem],soc=clamp(num(p.soc,80),0,100),t=num(p.tempC,25);
 const cell=chem==='lfp-4s'?lfpCellV(soc):liionCellV(soc);
 if(cell<=c.uvpCell+1e-9)return {volts:0,bms:'uvp'};
 return {volts:Math.round(cell*c.series*100)/100,bms:chem==='lfp-4s'&&t<0?'cold-charge':'ok'};
}
/** Body size in mm: cells lie along x (series along z, parallel along y) plus a 5 mm BMS end plate. */
export function packDims(p:{chem?:unknown;parallel?:unknown}):{l:number;w:number;h:number}{
 const s=CHEM[chemOf(p)].series,par=parallelOf(p);
 return {l:Math.round((CELL_MM.l+5)*10)/10,w:Math.round(s*CELL_MM.d*10)/10,h:Math.round(par*CELL_MM.d*10)/10};
}
export const packWh=(p:{chem?:unknown;parallel?:unknown}):number=>{const c=CHEM[chemOf(p)];return Math.round(c.nominalCell*c.series*c.ahCell*parallelOf(p)*10)/10;};

export type Battery18650State={chem:string;volts:number;soc:number;wh:number;ah:number;bms:string;series:number;parallel:number;tempC:number;nominalV:number};

export const device=defineDevice<Battery18650State>({
 kind:'battery-18650-pack',protocol:'gpio',
 pins:['P+','P-'],
 copy:{
  name:{en:'18650 battery pack with BMS',id:'Paket baterai 18650 dengan BMS'},
  desc:{en:'Four LiFePO4 18650 cells in series (12.8 V) or three Li-ion cells (11.1 V), with a protection board that cuts the output when the pack is empty, too hot or too cold to charge.',id:'Empat sel LiFePO4 18650 seri (12,8 V) atau tiga sel Li-ion (11,1 V), dengan papan proteksi yang memutus keluaran saat paket habis, terlalu panas atau terlalu dingin untuk diisi.'},
  note:{en:'Match the chemistry to the charge controller: a lead-acid or LFP controller cannot charge 3S Li-ion. LFP voltage stays flat from 20 to 90 %, so do not guess charge from voltage. Fuse P+ within 10 cm.',id:'Cocokkan kimia baterai dengan pengontrol: pengontrol aki atau LFP tidak bisa mengisi Li-ion 3S. Tegangan LFP datar dari 20 sampai 90 %, jadi jangan menebak sisa daya dari tegangan. Pasang sekring di P+ dalam 10 cm.'},
 },
 inputs:[
  {type:'choice',key:'chem',label:{en:'Chemistry',id:'Kimia'},options:[{value:'lfp-4s',label:{en:'LiFePO4 4S (12.8 V)',id:'LiFePO4 4S (12,8 V)'}},{value:'liion-3s',label:{en:'Li-ion 3S (11.1 V)',id:'Li-ion 3S (11,1 V)'}}],default:'lfp-4s'},
  {type:'range',key:'parallel',label:{en:'Cells in parallel',id:'Sel paralel'},min:1,max:4,step:1,default:1},
  {type:'range',key:'bmsA',label:{en:'BMS current limit',id:'Batas arus BMS'},min:1,max:40,step:1,unit:'A',default:10},
  {type:'range',key:'soc',label:{en:'Charge left',id:'Sisa muatan'},min:0,max:100,step:1,unit:'%',default:80},
  {type:'range',key:'tempC',label:{en:'Temperature',id:'Suhu'},min:-10,max:60,step:1,unit:'C',default:25},
 ],
 defaults:{chem:'lfp-4s',parallel:1,bmsA:10,soc:80,tempC:25},
 supplies:p=>{const o=packOutput(p);return o.volts>0?[{pos:'P+',neg:'P-',volts:o.volts,maxMa:Math.round(bmsAmps(p)*1000)}]:[];},
 create(ctx){
  return {state:()=>{
   const p=ctx.props,chem=chemOf(p),c=CHEM[chem],o=packOutput(p);
   return {chem,volts:o.volts,soc:clamp(Math.round(num(p.soc,80)),0,100),wh:packWh(p),ah:Math.round(c.ahCell*parallelOf(p)*100)/100,bms:o.bms,series:c.series,parallel:parallelOf(p),tempC:num(p.tempC,25),nominalV:Math.round(c.nominalCell*c.series*10)/10};
  }};
 },
});
