/**
 * BATTERY-LIFEPO4-12V (12.8 V LiFePO4 block, protocol 'gpio', desk prop): a sealed 4S LiFePO4 battery in a lead-acid-sized case with a built-in BMS, two M5/M6 terminals.
 * Capacities and case sizes are retail classes [U]: 6 Ah ~151 x 65 x 94 mm, 12 Ah ~151 x 98 x 95 mm, 20 Ah ~181 x 77 x 167 mm, 50 Ah ~229 x 138 x 208 mm (no single sheet cited).
 * Cell voltage curve and BMS cut-offs come from battery-18650-pack.ts (same LFP chemistry): flat 3.2-3.3 V per cell over 20-90 %, UVP 2.5 V/cell, no charging below 0 C.
 * Pair: scene/parts/battery-lifepo4-12v.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';
import {packOutput} from './battery-18650-pack';

export const LIFEPO4_CASES:Record<string,{ah:number;l:number;w:number;h:number}>={
 '6':{ah:6,l:151,w:65,h:94},'12':{ah:12,l:151,w:98,h:95},'20':{ah:20,l:181,w:77,h:167},'50':{ah:50,l:229,w:138,h:208},
};
export const lifepo4Case=(p:{ah?:unknown}):{ah:number;l:number;w:number;h:number}=>{
 const ah=num(p.ah,12);const keys=Object.keys(LIFEPO4_CASES);
 const k=keys.reduce((b,x)=>Math.abs(Number(x)-ah)<Math.abs(Number(b)-ah)?x:b,keys[0]!);
 return LIFEPO4_CASES[k]!;
};
export const lifepo4Wh=(p:{ah?:unknown}):number=>Math.round(12.8*lifepo4Case(p).ah*10)/10;
const out=(p:{soc?:unknown;tempC?:unknown})=>packOutput({chem:'lfp-4s',soc:p.soc,tempC:p.tempC});
/** The BMS limit is about 1 C of the capacity [U], clamped to what the user set. */
export const lifepo4MaxA=(p:{ah?:unknown;bmsA?:unknown}):number=>clamp(num(p.bmsA,lifepo4Case(p).ah),1,100);

export type Lifepo4State={volts:number;soc:number;ah:number;wh:number;bms:string;tempC:number;maxA:number};

export const device=defineDevice<Lifepo4State>({
 kind:'battery-lifepo4-12v',protocol:'gpio',
 pins:['P+','P-'],
 copy:{
  name:{en:'12.8 V LiFePO4 battery',id:'Baterai LiFePO4 12,8 V'},
  desc:{en:'A sealed 12.8 V lithium iron phosphate block with a built-in BMS. It takes the place of a small lead-acid battery and lasts many more cycles.',id:'Blok lithium besi fosfat 12,8 V tertutup dengan BMS bawaan. Menggantikan aki kecil dan tahan jauh lebih banyak siklus.'},
  note:{en:'Set the charge controller to LFP by hand. Voltage barely moves between 20 and 90 %. The BMS stops charging below 0 C and cuts the output when empty. Fuse the positive lead.',id:'Atur pengontrol pengisi ke mode LFP secara manual. Tegangan hampir tidak berubah antara 20 dan 90 %. BMS menghentikan pengisian di bawah 0 C dan memutus keluaran saat kosong. Pasang sekring di kabel positif.'},
 },
 inputs:[
  {type:'choice',key:'ah',label:{en:'Capacity',id:'Kapasitas'},options:[{value:'6',label:{en:'6 Ah',id:'6 Ah'}},{value:'12',label:{en:'12 Ah',id:'12 Ah'}},{value:'20',label:{en:'20 Ah',id:'20 Ah'}},{value:'50',label:{en:'50 Ah',id:'50 Ah'}}],default:'12'},
  {type:'range',key:'soc',label:{en:'Charge left',id:'Sisa muatan'},min:0,max:100,step:1,unit:'%',default:80},
  {type:'range',key:'tempC',label:{en:'Temperature',id:'Suhu'},min:-10,max:60,step:1,unit:'C',default:25},
 ],
 defaults:{ah:12,soc:80,tempC:25},
 supplies:p=>{const o=out(p);return o.volts>0?[{pos:'P+',neg:'P-',volts:o.volts,maxMa:Math.round(lifepo4MaxA(p)*1000)}]:[];},
 create(ctx){
  return {state:()=>{const p=ctx.props,o=out(p),k=lifepo4Case(p);
   return {volts:o.volts,soc:clamp(Math.round(num(p.soc,80)),0,100),ah:k.ah,wh:lifepo4Wh(p),bms:o.bms,tempC:num(p.tempC,25),maxA:lifepo4MaxA(p)};}};
 },
});
