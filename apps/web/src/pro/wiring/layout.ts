/** Wiring diagram layout: pure geometry from one node's netlist (no DOM, no React). Every W# id comes from the stored wire. */
import type {SystemSpec} from '../../../../../packages/pro-contract/system-spec';
import {glandRef,terminalRef} from '../../../../../packages/pro-contract/refs';

type Node=SystemSpec['nodes'][number];
type Wire=Node['wires'][number];
export type WireFilter='all'|'signal'|'power';
export type Pt={x:number;y:number};
export type Port={x:number;y:number;pin:string;wireId:string;side:'l'|'r'};
export type WBlock={id:string;ref:string;title:string;sub:string;x:number;y:number;w:number;h:number;kind:'board'|'part';zone:'field'|'enclosure';ports:Port[]};
export type WTerminalBlock={ref:string;gland:string;partId:string;x:number;y:number;w:number;h:number;terminals:{n:number;y:number;wireId:string}[]};
export type Verif='verified'|'unverified'|'failed'|'none';
export type WWire={id:string;color:Wire['color'];func:Wire['func'];text:string;d:string;pts:Pt[];chip:{x:number;y:number;w:number};verif:Verif;note?:string;partIds:string[];dim:boolean};
export type WiringLayout={nodeId:string;width:number;height:number;blocks:WBlock[];tbs:WTerminalBlock[];wires:WWire[];enclosure:{x:number;y:number;w:number;h:number;label:string};fieldLabel:Pt;legend:{y:number;colors:{color:Wire['color'];funcs:string[]}[]};empty:boolean};
export type PinTableRow={gpio:string;net:string;to:string;wireId:string;note:string;partId:string};
export type CableRow={wireId:string;color:Wire['color'];from:string;to:string;via:string;len:string;gauge:string;verif:Verif;reason:string;partIds:string[]};

export const BOARD_NAMES:Record<string,string>={'esp32-devkitc':'ESP32-DevKitC','esp32-s3-devkitc':'ESP32-S3-DevKitC','pico-w':'Raspberry Pi Pico W','rpi-4b':'Raspberry Pi 4B','rpi-5':'Raspberry Pi 5','uno':'Arduino Uno','nano':'Arduino Nano'};
export const CABLE_NAMES:Record<string,string>={dupont:'Dupont','jst-xh':'JST-XH','2-core':'2-core cable','3-core-shielded':'3-core shielded','4-core-shielded':'4-core shielded','cat5e-stp':'Cat5e STP','power-2x0.75':'Power 2×0.75 mm²'};
const PREFIX:Record<string,string>={sensor:'S',actuator:'K',radio:'U',power:'P',display:'D',interface:'J',protection:'F'};
const ROW=14,HEAD=34,BROW=20,GAP=22,TOP=44,STEP=12,CHAR=6.1;

export const wireMatches=(w:{func:string},f:WireFilter)=>f==='all'||(f==='signal'?w.func==='signal'||w.func==='bus':w.func==='power'||w.func==='ground');
export const fmtLen=(m:number)=>m<1?`${Math.round(m*1000)} mm`:`${m.toFixed(1)} m`;
export const chipText=(w:Wire)=>{const b=w.from.part==='board'?w.from:w.to.part==='board'?w.to:null,o=b===w.from?w.to:w.from;return b?`${w.id} · ${b.pin} → ${o.pin}`:`${w.id} · ${w.from.part}.${w.from.pin} → ${w.to.part}.${w.to.pin}`;};

/** Designators: board U1; parts S/K/U/P/D/J/F numbered by order inside the node. */
export function partRefs(node:Pick<Node,'parts'>):Record<string,string>{
 const n:Record<string,number>={U:1},out:Record<string,string>={board:'U1'};
 for(const p of node.parts){const pre=PREFIX[p.role]??'X';n[pre]=(n[pre]??0)+1;out[p.id]=`${pre}${n[pre]}`;}
 return out;
}
const verifOf=(spec:Pick<SystemSpec,'verification'>,ni:number,wi:number):{v:Verif;note?:string}=>{
 const x=spec.verification?.[`/nodes/${ni}/wires/${wi}`];
 return x?{v:x.status,note:x.note}:{v:'none'};
};
const reasonOf=(v:Verif,note?:string)=>v==='verified'?'':note??(v==='failed'?'failed the netlist check':'not checked by a verifier yet');

type Ctx={node:Node;wires:Wire[];refs:Record<string,string>;tbOf:Map<string,{ref:string;gland:string;n:Map<string,number>}>};
function context(node:Node):Ctx{
 const ids=new Set(node.parts.map(p=>p.id));
 const wires=node.wires.filter(w=>(w.from.part==='board'||ids.has(w.from.part))&&(w.to.part==='board'||ids.has(w.to.part)));
 const tbOf=new Map<string,{ref:string;gland:string;n:Map<string,number>}>();
 for(const w of wires){
  if(!w.viaGland)continue;
  const pid=w.from.part==='board'?w.to.part:w.from.part;
  if(!tbOf.has(pid))tbOf.set(pid,{ref:terminalRef(tbOf.size+1),gland:glandRef(tbOf.size+1),n:new Map()});
  const t=tbOf.get(pid)!;t.n.set(w.id,t.n.size+1);
 }
 return {node,wires,refs:partRefs(node),tbOf};
}
const partEnd=(w:Wire)=>w.from.part==='board'?w.to:w.from;

export function layoutWiring(spec:Pick<SystemSpec,'nodes'|'verification'>,nodeId:string,filter:WireFilter='all'):WiringLayout{
 const ni=spec.nodes.findIndex(n=>n.id===nodeId);
 if(ni<0)return {nodeId,width:600,height:200,blocks:[],tbs:[],wires:[],enclosure:{x:0,y:0,w:0,h:0,label:''},fieldLabel:{x:0,y:0},legend:{y:0,colors:[]},empty:true};
 const node=spec.nodes[ni],{wires,refs,tbOf}=context(node);
 const left=node.parts.filter(p=>p.mount!=='enclosure'||tbOf.has(p.id)),leftIds=new Set(left.map(p=>p.id));
 const right=node.parts.filter(p=>!leftIds.has(p.id));
 const firstSeen=(id:string)=>{const i=wires.findIndex(w=>w.from.part===id||w.to.part===id);return i<0?1e6:i;};
 left.sort((a,b)=>firstSeen(a.id)-firstSeen(b.id));right.sort((a,b)=>firstSeen(a.id)-firstSeen(b.id));
 const rowsOf=(id:string)=>wires.filter(w=>w.from.part===id||w.to.part===id);
 const partH=(id:string)=>HEAD+Math.max(1,rowsOf(id).length)*ROW+4;
 const colH=(ps:{id:string}[])=>ps.length?ps.reduce((a,p)=>a+partH(p.id),0)+(ps.length-1)*GAP:0;
 const sideOf=(id:string):'l'|'r'=>leftIds.has(id)?'l':'r';
 const boardWires=wires.filter(w=>w.from.part==='board'!==(w.to.part==='board'));
 const lw=boardWires.filter(w=>sideOf(partEnd(w).part)==='l'),rw=boardWires.filter(w=>sideOf(partEnd(w).part)==='r');
 const boardH=HEAD+Math.max(1,lw.length,rw.length)*BROW+10;
 const H=Math.max(colH(left),colH(right),boardH);
 // ---- columns
 const chipW=Math.max(60,...wires.map(w=>chipText(w).length*CHAR+24));
 const pp=wires.filter(w=>w.from.part!=='board'&&w.to.part!=='board').length,lN=lw.length+pp,rN=rw.length+pp;
 const fieldX=24,fieldW=190,encL=fieldX+fieldW+34,tbX=encL+12,tbW=22;
 const chL0=tbX+tbW+14,boardX=chL0+Math.max(1,lN)*STEP+chipW+10,boardW=176,boardR=boardX+boardW;
 const rChan=boardR+chipW+10,rX=rChan+Math.max(1,rN)*STEP+14,rW=176,encR=rX+rW+14;
 const mk=(ps:{id:string;purpose:{en:string};kind:string;mount:string;cableM?:number}[],x:number,w:number,zone:'field'|'enclosure'):WBlock[]=>{
  let y=TOP+(H-colH(ps))/2;
  return ps.map(p=>{const h=partH(p.id),b:WBlock={id:p.id,ref:refs[p.id],title:p.purpose.en,sub:`${p.kind} · ${p.mount}${p.cableM?` · ${fmtLen(p.cableM)}`:''}`,x,y,w,h,kind:'part',zone,ports:[]};y+=h+GAP;return b;});
 };
 const lb=mk(left,fieldX,fieldW,'field'),rb=mk(right,rX,rW,'enclosure');
 const blk=new Map([...lb,...rb].map(b=>[b.id,b]));
 // part ports: one row per wire end, in wire order
 const portOf=new Map<string,Pt>();
 const key=(wid:string,part:string)=>`${wid}|${part}`;
 for(const b of blk.values()){
  const side=sideOf(b.id);
  rowsOf(b.id).forEach((w,i)=>{
   const e=w.from.part===b.id?w.from:w.to,y=b.y+HEAD+i*ROW+ROW/2,x=side==='l'?b.x+b.w:b.x;
   b.ports.push({x,y,pin:e.pin,wireId:w.id,side});portOf.set(key(w.id,b.id),{x,y});
  });
 }
 // board pin rows, ordered by the counterpart port y
 const board:WBlock={id:'board',ref:'U1',title:BOARD_NAMES[node.board]??node.board,sub:node.board,x:boardX,y:TOP+(H-boardH)/2,w:boardW,h:boardH,kind:'board',zone:'enclosure',ports:[]};
 const pinY=new Map<string,number>();
 for(const [side,ws] of [['l',lw],['r',rw]] as const){
  const sorted=[...ws].sort((a,b)=>portOf.get(key(a.id,partEnd(a).part))!.y-portOf.get(key(b.id,partEnd(b).part))!.y);
  sorted.forEach((w,i)=>{
   const be=w.from.part==='board'?w.from:w.to,y=board.y+HEAD+i*BROW+BROW/2;
   pinY.set(w.id,y);board.ports.push({x:side==='l'?boardX:boardR,y,pin:be.pin,wireId:w.id,side});
  });
 }
 // channel ranks per side (0 = closest to the board); down-going wires first, top port closest
 const rank=new Map<string,number>();
 for(const ws of [lw,rw]){
  const info=ws.map(w=>({w,py:portOf.get(key(w.id,partEnd(w).part))!.y,qy:pinY.get(w.id)!})).filter(i=>Math.abs(i.py-i.qy)>0.5);
  const down=info.filter(i=>i.qy>i.py).sort((a,b)=>a.py-b.py),up=info.filter(i=>i.qy<i.py).sort((a,b)=>b.py-a.py);
  [...down,...up].forEach((i,r)=>rank.set(i.w.id,r));
 }
 const lCh=(r:number)=>chL0+(Math.max(1,lN)-1-r)*STEP+6,rCh=(r:number)=>rChan+r*STEP+6;
 const tbs:WTerminalBlock[]=[];
 for(const b of lb){
  const t=tbOf.get(b.id);if(!t||!b.ports.length)continue;
  const wps=b.ports.filter(p=>t.n.has(p.wireId));if(!wps.length)continue;
  const ys=wps.map(p=>p.y),y0=Math.min(...ys)-9,y1=Math.max(...ys)+9;
  tbs.push({ref:t.ref,gland:t.gland,partId:b.id,x:tbX,y:y0,w:tbW,h:y1-y0,terminals:wps.map(p=>({n:t.n.get(p.wireId)!,y:p.y,wireId:p.wireId}))});
 }
 const tbFor=new Map(tbs.map(t=>[t.partId,t]));
 const topY=TOP-22;let k=0;
 const out:WWire[]=wires.map(w=>{
  const text=chipText(w),cw=text.length*CHAR+24,vf=verifOf(spec,ni,node.wires.indexOf(w)),pids=[w.from.part,w.to.part].filter(p=>p!=='board');
  const pts:Pt[]=[];let chip:{x:number;y:number;w:number};
  const isBoard=w.from.part==='board'||w.to.part==='board';
  if(isBoard){
   const pid=partEnd(w).part,side=sideOf(pid),P=portOf.get(key(w.id,pid))!,qy=pinY.get(w.id)!,r=rank.get(w.id);
   const tb=tbFor.get(pid);
   if(side==='l'){
    pts.push({x:P.x,y:P.y});if(tb&&tb.terminals.some(t=>t.wireId===w.id)){pts.push({x:tbX,y:P.y},{x:tbX+tbW,y:P.y});}
    if(r!==undefined){const xc=lCh(r);pts.push({x:xc,y:P.y},{x:xc,y:qy});}
    pts.push({x:boardX,y:qy});chip={x:boardX-6-cw,y:qy,w:cw};
   }else{
    pts.push({x:boardR,y:qy});
    if(r!==undefined){const xc=rCh(r);pts.push({x:xc,y:qy},{x:xc,y:P.y});}
    pts.push({x:P.x,y:P.y});chip={x:boardR+6,y:qy,w:cw};
   }
  }else{
   const a=portOf.get(key(w.id,w.from.part))!,b=portOf.get(key(w.id,w.to.part))!,sa=sideOf(w.from.part),sb=sideOf(w.to.part),i=k++;
   const cx=(s:'l'|'r')=>s==='l'?lCh(lw.length+i):rCh(rw.length+i);
   const xa=cx(sa),xb=cx(sb);
   if(sa===sb)pts.push(a,{x:xa,y:a.y},{x:xa,y:b.y},b);
   else pts.push(a,{x:xa,y:a.y},{x:xa,y:topY},{x:xb,y:topY},{x:xb,y:b.y},b);
   chip={x:Math.min(xa,xb)+(sa===sb?-cw/2:(Math.abs(xa-xb)-cw)/2),y:sa===sb?(a.y+b.y)/2:topY,w:cw};
  }
  const d=pts.map((p,j)=>`${j?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return {id:w.id,color:w.color,func:w.func,text,d,pts,chip,verif:vf.v,note:reasonOf(vf.v,vf.note),partIds:pids,dim:!wireMatches(w,filter)};
 });
 const byColor=new Map<Wire['color'],Set<string>>();
 for(const w of wires){if(!byColor.has(w.color))byColor.set(w.color,new Set());byColor.get(w.color)!.add(w.func);}
 const bottom=TOP+H+16,height=bottom+58;
 const blocks=[board,...lb,...rb];
 return {nodeId,width:encR+28,height,blocks,tbs,wires:out,
  enclosure:{x:encL,y:TOP-26,w:encR-encL,h:H+44,label:`${refs.board} · ENCLOSURE ${node.enclosure.ip} · INSIDE`},fieldLabel:{x:fieldX,y:TOP-12},
  legend:{y:bottom+10,colors:[...byColor].map(([color,f])=>({color,funcs:[...f]}))},empty:wires.length===0&&node.parts.length===0};
}

/** Pin table (node.pins) with the wire that carries each pin, and the cable list (node.wires). */
export function wiringTables(spec:Pick<SystemSpec,'nodes'|'verification'>,nodeId:string){
 const ni=spec.nodes.findIndex(n=>n.id===nodeId);if(ni<0)return {pins:[] as PinTableRow[],cables:[] as CableRow[],glands:0,totalM:0};
 const node=spec.nodes[ni],{wires,refs,tbOf}=context(node);
 const used=new Set<string>();
 const pins:PinTableRow[]=node.pins.map(p=>{
  const w=wires.find(w=>!used.has(w.id)&&((w.from.part==='board'&&w.from.pin===p.boardPin&&w.to.part===p.part&&w.to.pin===p.partPin)||(w.to.part==='board'&&w.to.pin===p.boardPin&&w.from.part===p.part&&w.from.pin===p.partPin)));
  if(w)used.add(w.id);
  return {gpio:p.boardPin,net:p.symbol??p.func,to:`${refs[p.part]??p.part} ${p.partPin}`,wireId:w?.id??'',note:p.note?.en??'',partId:p.part};
 });
 const cables:CableRow[]=wires.map(w=>{
  const idx=node.wires.indexOf(w),vf=verifOf(spec,ni,idx),end=(e:Wire['from'])=>e.part==='board'?`U1 ${e.pin}`:`${refs[e.part]} ${e.pin}`;
  const bf=w.to.part==='board'?[w.to,w.from]:[w.from,w.to];
  const pid=partEnd(w).part,t=tbOf.get(pid);
  const via=w.viaGland&&t?`${t.ref}-${t.n.get(w.id)} · ${t.gland}`:w.viaGland?'gland':'—';
  return {wireId:w.id,color:w.color,from:end(bf[0]),to:end(bf[1]),via,len:fmtLen(w.lengthM),gauge:`${CABLE_NAMES[w.cable]??w.cable} · ${w.awg} AWG`,verif:vf.v,reason:reasonOf(vf.v,vf.note),partIds:[w.from.part,w.to.part].filter(p=>p!=='board')};
 });
 return {pins,cables,glands:tbOf.size,totalM:wires.reduce((a,w)=>a+w.lengthM,0)};
}
