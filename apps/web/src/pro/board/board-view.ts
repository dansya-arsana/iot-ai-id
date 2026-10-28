/** Pure layout for the Board tab: a client-side top-view preview of a node's carrier board from the spec (no catalog needed). */
import type {ProNode} from '../../../../../packages/pro-contract/system-spec';

export interface BoardModule{ref:string;kind:string;x:number;y:number;w:number;h:number}
export interface BoardPad{id:string;x:number;y:number}
export interface BoardNet{id:string;func:string;a:{x:number;y:number};b:{x:number;y:number}}
export interface BoardView{w:number;h:number;modules:BoardModule[];pads:BoardPad[];nets:BoardNet[];issues:{en:string;id:string}[]}
export const MOD_W=26,MOD_H=20,GAP=4,MARGIN=6,PAD_BAND=8,COLS=3;

/** Deterministic grid: modules in rows of COLS below a header band holding one pad per used board pin. */
export function layoutBoard(node:ProNode):BoardView{
 const issues:BoardView['issues']=[];
 const parts=node.parts;
 const rows=Math.max(1,Math.ceil(parts.length/COLS)),cols=Math.max(1,Math.min(COLS,parts.length));
 const w=MARGIN*2+cols*MOD_W+(cols-1)*GAP,h=MARGIN*2+PAD_BAND+rows*MOD_H+(rows-1)*GAP;
 const modules=parts.map((p,i)=>({ref:p.id,kind:p.kind,x:MARGIN+(i%COLS)*(MOD_W+GAP),y:MARGIN+PAD_BAND+Math.floor(i/COLS)*(MOD_H+GAP),w:MOD_W,h:MOD_H}));
 const used=[...new Set(node.wires.flatMap(x=>[x.from,x.to]).filter(e=>e.part==='board').map(e=>e.pin))];
 const step=used.length>1?(w-MARGIN*2)/(used.length-1):0;
 const pads=used.map((id,i)=>({id,x:used.length>1?MARGIN+i*step:w/2,y:MARGIN}));
 const mod=new Map(modules.map(m=>[m.ref,m])),pad=new Map(pads.map(p=>[p.id,p]));
 const at=(e:{part:string;pin:string})=>{if(e.part==='board'){const p=pad.get(e.pin);return p&&{x:p.x,y:p.y};}const m=mod.get(e.part);return m&&{x:m.x+m.w/2,y:m.y+m.h/2};};
 const nets:BoardNet[]=[];
 for(const x of node.wires){const a=at(x.from),b=at(x.to);if(a&&b)nets.push({id:x.id,func:x.func,a,b});else issues.push({en:`Wire ${x.id} has an unplaced end`,id:`Kabel ${x.id} punya ujung yang belum ditempatkan`});}
 if(!parts.length)issues.push({en:'This node has no modules to place',id:'Node ini belum punya modul untuk ditempatkan'});
 return{w,h,modules,pads,nets,issues};
}

export function zipBlobParts(base64:string):Uint8Array{const s=atob(base64),o=new Uint8Array(s.length);for(let i=0;i<s.length;i++)o[i]=s.charCodeAt(i);return o;}
