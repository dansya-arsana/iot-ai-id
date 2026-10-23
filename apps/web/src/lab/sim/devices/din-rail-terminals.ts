/**
 * DIN-RAIL-TERMINALS (35 mm TS35 rail with six feed-through screw terminal blocks, protocol 'gpio', desk prop).
 * Each block joins its two sides (T<n>A <-> T<n>B) like a real feed-through terminal. An optional jumper bar bridges neighbouring blocks into one rail.
 * Reference [U, class values of a 2.5 mm2 grey block such as Phoenix Contact UT 2,5, item 3044076; no sheet fetched]: 5.2 mm pitch, 800 V, 24 A, wire 0.14-4 mm2, 12 mm tall x ~42 mm deep on a 35 x 7.5 mm rail.
 * Models wiring only: no voltage drop or heating is simulated; `ratedA` is exported for Pro's fuse/wire checks.
 * Pair: scene/parts/din-rail-terminals.ts. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';

export const BLOCKS=6;
export const PITCH_MM=5.2;
export const RAIL_MM={w:35,h:7.5,/** length for 6 blocks plus two end stops */l:BLOCKS*PITCH_MM+2*9.5};
export const RATED={a:24,v:800,wireMm2:{min:0.14,max:4}};
export const TERMINAL_PINS:string[]=Array.from({length:BLOCKS},(_,i)=>[`T${i+1}A`,`T${i+1}B`]).flat();
export type Bridge='none'|'1-2'|'1-3'|'all';
const bridgeOf=(p:{bridge?:unknown}):Bridge=>p.bridge==='1-2'||p.bridge==='1-3'||p.bridge==='all'?p.bridge:'none';
const bridged=(b:Bridge):number=>b==='none'?0:b==='1-2'?2:b==='1-3'?3:BLOCKS;
/** blocks 1..n are linked by the jumper bar */
export function bridgeContacts(b:Bridge):{a:string;b:string;closed:boolean}[]{
 const n=bridged(b),out:{a:string;b:string;closed:boolean}[]=[];
 for(let i=1;i<BLOCKS;i++)out.push({a:`T${i}A`,b:`T${i+1}A`,closed:i<n});
 return out;
}

export type DinRailState={blocks:number;bridge:string;bridgedBlocks:number;ratedA:number;ratedV:number};

export const device=defineDevice<DinRailState>({
 kind:'din-rail-terminals',protocol:'gpio',
 pins:TERMINAL_PINS,
 copy:{
  name:{en:'DIN rail with 6 terminal blocks',id:'Rel DIN dengan 6 terminal blok'},
  desc:{en:'A 35 mm rail with six screw terminal blocks. Wires enter one side and leave the other, so power can be shared and cables swapped without soldering.',id:'Rel 35 mm dengan enam terminal sekrup. Kabel masuk dari satu sisi dan keluar dari sisi lain, sehingga daya bisa dibagi dan kabel diganti tanpa solder.'},
  note:{en:'Each block joins its A and B side. A jumper bar links neighbouring blocks into one rail (for example a shared 12 V or ground). Rated about 24 A per block (class value).',id:'Setiap blok menghubungkan sisi A dan B. Batang jumper menyambung blok bersebelahan menjadi satu rel (misalnya 12 V atau ground bersama). Nilai sekitar 24 A per blok (nilai kelas).'},
 },
 inputs:[{type:'choice',key:'bridge',label:{en:'Jumper bar',id:'Batang jumper'},options:[{value:'none',label:{en:'None',id:'Tidak ada'}},{value:'1-2',label:{en:'Blocks 1-2',id:'Blok 1-2'}},{value:'1-3',label:{en:'Blocks 1-3',id:'Blok 1-3'}},{value:'all',label:{en:'All 6',id:'Semua 6'}}],default:'none'}],
 defaults:{bridge:'none'},
 create(ctx){
  return {
   state:()=>{const b=bridgeOf(ctx.props);return {blocks:BLOCKS,bridge:b,bridgedBlocks:bridged(b),ratedA:RATED.a,ratedV:RATED.v};},
   switches:()=>[...TERMINAL_PINS.filter((_,i)=>i%2===0).map(a=>({a,b:a.replace('A','B'),closed:true})),...bridgeContacts(bridgeOf(ctx.props))],
  };
 },
});
