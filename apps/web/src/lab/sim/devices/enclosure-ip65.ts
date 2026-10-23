/**
 * ENCLOSURE-IP65 (junction box with cable glands, protocol 'gpio', desk prop, MODEL-ONLY): a passive housing with no pins and no signal behaviour.
 * IP65 = dust-tight and protected against water jets (IEC 60529) [K]. Sizes: generic ABS IP65 150 x 110 x 70, 200 x 120 x 75, 250 x 150 x 100 mm [U, retail];
 * Hammond 1554X2GY 299.7 x 198.1 x 89.9 mm (IP66/IP68 polycarbonate) [V, https://uk.farnell.com/hammond/1554x2gysl/enclosure-pc-200mmx300mmx200mm/dp/3649408].
 * Gland clamping ranges are typical [U]: PG7 3-6.5 mm, PG9 4-8 mm, M16 4-8 mm, M20 6-12 mm (read the gland maker's sheet for exact values).
 * Pro M6 can check "cable OD within the gland range" and "glands on the bottom face only" from ENCLOSURE_SIZES and GLAND_RANGES.
 * Pair: scene/parts/enclosure-ip65.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';

export interface EnclosureSize{id:string;l:number;w:number;h:number;/** inner mounting-plate l x w in mm */plate:readonly [number,number]}
export const ENCLOSURE_SIZES:readonly EnclosureSize[]=[
 {id:'150x110x70',l:150,w:110,h:70,plate:[130,90]},
 {id:'200x120x75',l:200,w:120,h:75,plate:[180,100]},
 {id:'250x150x100',l:250,w:150,h:100,plate:[230,130]},
 {id:'300x200x90',l:299.7,w:198.1,h:89.9,plate:[280,180]},
];
export interface GlandRange{id:'pg7'|'pg9'|'m16'|'m20';minMm:number;maxMm:number;/** thread hole diameter in mm */holeMm:number}
export const GLAND_RANGES:readonly GlandRange[]=[
 {id:'pg7',minMm:3,maxMm:6.5,holeMm:12.5},
 {id:'pg9',minMm:4,maxMm:8,holeMm:15.2},
 {id:'m16',minMm:4,maxMm:8,holeMm:16},
 {id:'m20',minMm:6,maxMm:12,holeMm:20},
];
export const sizeOf=(p:{size?:unknown}):EnclosureSize=>ENCLOSURE_SIZES.find(s=>s.id===p.size)??ENCLOSURE_SIZES[1]!;
export const glandOf=(p:{glandSize?:unknown}):GlandRange=>GLAND_RANGES.find(g=>g.id===p.glandSize)??GLAND_RANGES[1]!;
export const glandCount=(p:{glands?:unknown}):number=>clamp(Math.round(num(p.glands,3)),1,6);
/** true when a cable of this outer diameter is held by the chosen gland. */
export const cableFits=(g:GlandRange,odMm:number):boolean=>odMm>=g.minMm&&odMm<=g.maxMm;

export type EnclosureState={runtime:'not-emulated';size:string;glands:number;glandSize:string;lid:string;breather:boolean;lMm:number;wMm:number;hMm:number};

export const device=defineDevice<EnclosureState>({
 kind:'enclosure-ip65',protocol:'gpio',runtime:'not-emulated',
 pins:[],
 copy:{
  name:{en:'IP65 junction box with cable glands',id:'Kotak sambungan IP65 dengan gland kabel'},
  desc:{en:'A dust-tight, jet-proof plastic box with a gasketed lid and cable glands on the bottom face. It holds the node electronics outdoors.',id:'Kotak plastik kedap debu dan semprotan air dengan tutup berpacking dan gland kabel di sisi bawah. Menampung elektronik node di luar ruangan.'},
  note:{en:'Not emulated: a housing only, it has no pins. Cables go in through the bottom glands with a drip loop. Add a breather plug against condensation.',id:'Tidak diemulasi: hanya rumah, tanpa pin. Kabel masuk lewat gland di bawah dengan lengkung tetes. Tambahkan sumbat napas untuk mencegah kondensasi.'},
 },
 inputs:[
  {type:'choice',key:'size',label:{en:'Size (mm)',id:'Ukuran (mm)'},options:ENCLOSURE_SIZES.map(s=>({value:s.id,label:{en:`${Math.round(s.l)} x ${Math.round(s.w)} x ${Math.round(s.h)}`,id:`${Math.round(s.l)} x ${Math.round(s.w)} x ${Math.round(s.h)}`}})),default:'200x120x75'},
  {type:'choice',key:'lid',label:{en:'Lid',id:'Tutup'},options:[{value:'grey',label:{en:'Grey',id:'Abu-abu'}},{value:'clear',label:{en:'Clear',id:'Bening'}}],default:'grey'},
  {type:'range',key:'glands',label:{en:'Cable glands',id:'Gland kabel'},min:1,max:6,step:1,default:3},
  {type:'choice',key:'glandSize',label:{en:'Gland size',id:'Ukuran gland'},options:GLAND_RANGES.map(g=>({value:g.id,label:{en:g.id.toUpperCase(),id:g.id.toUpperCase()}})),default:'pg9'},
  {type:'toggle',key:'breather',label:{en:'Breather plug',id:'Sumbat napas'},default:true},
 ],
 defaults:{size:'200x120x75',lid:'grey',glands:3,glandSize:'pg9',breather:true},
 create(ctx){
  return {state:()=>{const s=sizeOf(ctx.props);
   return {runtime:'not-emulated',size:s.id,glands:glandCount(ctx.props),glandSize:glandOf(ctx.props).id,lid:ctx.props.lid==='clear'?'clear':'grey',breather:ctx.props.breather!==false,lMm:s.l,wMm:s.w,hMm:s.h};}};
 },
});
