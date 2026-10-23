/**
 * Pure wiring layout for one node (print): parts on the left and right, the board in the middle, one orthogonal
 * route per wire from the stored netlist. Units are viewBox units: the sheet draws 720 units across 180 mm, so a 10-unit
 * font prints at 7 pt. No label can overlap: every pin is its own row and wire tags sit in their own lane.
 */
import type {ProNode} from '../../../../../packages/pro-contract/system-spec';

export const W=720,ROW=15,HEAD=22,PART_W=156,BOARD_W=176,PAD=6,GAP=14,FONT=10;
export interface Pin{name:string;y:number}
export interface PartBox{id:string;ref:string;label:string;sub:string;side:'L'|'R';x:number;y:number;w:number;h:number;pins:Pin[]}
export interface BoardBox{x:number;y:number;w:number;h:number;label:string;sub:string;left:Pin[];right:Pin[]}
export interface Route{id:string;color:string;func:string;d:string;tag:{x:number;y:number;anchor?:'start'|'end'}}
export interface WiringLayout{width:number;height:number;parts:PartBox[];board:BoardBox;routes:Route[]}

const BOARD_NAME:Record<string,string>={'esp32-devkitc':'ESP32-DevKitC','esp32-s3-devkitc':'ESP32-S3-DevKitC','pico-w':'Raspberry Pi Pico W','rpi-4b':'Raspberry Pi 4B','rpi-5':'Raspberry Pi 5',uno:'Arduino Uno',nano:'Arduino Nano'};
export const boardName=(b:string)=>BOARD_NAME[b]??b;
const trim=(s:string,n:number)=>s.length>n?s.slice(0,n-1)+'…':s;

export function layoutWiring(node:ProNode,des:Record<string,string>,partLabel:(id:string)=>string):WiringLayout{
 // pins used per part, in wire order, then any pin row without a wire
 const used=new Map<string,string[]>();
 const add=(part:string,pin:string)=>{if(part==='board')return;const a=used.get(part)??[];if(!a.includes(pin))a.push(pin);used.set(part,a);};
 for(const w of node.wires){add(w.from.part,w.from.pin);add(w.to.part,w.to.pin);}
 for(const p of node.pins)add(p.part,p.partPin);
 const ids=node.parts.map(p=>p.id).filter(id=>used.has(id));
 // alternate sides so both columns stay short
 const side=new Map(ids.map((id,i)=>[id,(i%2===0?'L':'R') as 'L'|'R']));
 const col={L:PAD,R:W-PART_W-PAD};
 const cursor={L:PAD+HEAD,R:PAD+HEAD};
 const parts:PartBox[]=ids.map(id=>{
  const s=side.get(id)!,pins=used.get(id)!,h=HEAD+pins.length*ROW+6;
  const box:PartBox={id,ref:des[id]??id,label:trim(partLabel(id),24),sub:trim(node.parts.find(p=>p.id===id)?.purpose.en??'',28),side:s,x:col[s],y:cursor[s],w:PART_W,h,
   pins:pins.map((name,i)=>({name,y:cursor[s]+HEAD+i*ROW+ROW/2+2}))};
  cursor[s]+=h+GAP;return box;
 });
 const partOf=new Map(parts.map(p=>[p.id,p]));
 // board pins per side: first appearance in wire order, grouped by the part they serve
 const need={L:[] as string[],R:[] as string[]};
 const wiresBoard=node.wires.filter(w=>w.from.part==='board'||w.to.part==='board');
 const keyOf=(w:ProNode['wires'][number])=>{const e=w.from.part==='board'?w.from:w.to;const o=w.from.part==='board'?w.to:w.from;return {pin:e.pin,part:o.part};};
 const order=(s:'L'|'R')=>wiresBoard.filter(w=>side.get(keyOf(w).part)===s).sort((a,b)=>(ids.indexOf(keyOf(a).part)-ids.indexOf(keyOf(b).part)));
 for(const s of ['L','R'] as const)for(const w of order(s)){const p=keyOf(w).pin;if(!need[s].includes(p))need[s].push(p);}
 const bx=(W-BOARD_W)/2,by=PAD+HEAD;
 const bPins=(s:'L'|'R'):Pin[]=>need[s].map((name,i)=>({name,y:by+HEAD+i*ROW+ROW/2+2}));
 const left=bPins('L'),right=bPins('R');
 const bh=HEAD+Math.max(left.length,right.length,2)*ROW+8;
 const board:BoardBox={x:bx,y:by,w:BOARD_W,h:bh,label:boardName(node.board),sub:trim(node.id,26),left,right};
 const colH=Math.max(cursor.L,cursor.R)-GAP,height=Math.max(colH,by+bh)+PAD+4;

 // routes: orthogonal, with a private vertical lane per wire inside each gutter
 const lane={L:0,R:0};
 const gutter=bx-(PAD+PART_W);
 const routes:Route[]=node.wires.map(w=>{
  const color=w.color,base={id:w.id,color,func:w.func};
  const pin=(e:{part:string;pin:string})=>{const p=partOf.get(e.part);return p?.pins.find(x=>x.name===e.pin)?{p,y:p.pins.find(x=>x.name===e.pin)!.y}:null;};
  if(w.from.part==='board'||w.to.part==='board'){
   const k=keyOf(w),p=partOf.get(k.part);if(!p)return {...base,d:'',tag:{x:0,y:0}};
   const own=pin(w.from.part==='board'?w.to:w.from)!;
   const bp=(p.side==='L'?left:right).find(x=>x.name===k.pin)!;
   const x1=p.side==='L'?p.x+p.w:p.x,x2=p.side==='L'?bx:bx+BOARD_W;
   const n=lane[p.side]++,off=30+((n*7)%Math.max(8,gutter-44)),mid=p.side==='L'?x1+off:x1-off;
   return {...base,d:`M${x1} ${own.y}H${mid}V${bp.y}H${x2}`,tag:{x:p.side==='L'?x1+3:x1-3,y:own.y-3,anchor:p.side==='L'?'start' as const:'end' as const}};
  }
  const a=pin(w.from),b=pin(w.to);if(!a||!b)return {...base,d:'',tag:{x:0,y:0}};
  // part to part: out through the outer margin lane of the left part's column, above everything
  const ax=a.p.side==='L'?a.p.x+a.p.w:a.p.x,bx2=b.p.side==='L'?b.p.x+b.p.w:b.p.x;
  const lx=(a.p.side==='L'?ax+6:ax-6),rx=(b.p.side==='L'?bx2+6:bx2-6),top=PAD+4;
  return {...base,d:`M${ax} ${a.y}H${lx}V${top}H${rx}V${b.y}H${bx2}`,tag:{x:Math.min(lx,rx)+4,y:top-1,anchor:'start' as const}};
 }).filter(r=>r.d);
 return {width:W,height,parts,board,routes};
}
