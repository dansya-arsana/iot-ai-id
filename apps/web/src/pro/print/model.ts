/**
 * Build Sheet model (M8): pure helpers, no DOM, no three.js. Everything here reads the stored SystemSpec revision:
 * verification stamps, W-numbers, ckId, BOM totals and power budgets are server-owned and are only formatted here.
 * Honesty rules: "verified" only for a gated stamp; every other item carries its reason; drafts never reach this file
 * (the sheet loads saved revisions only).
 */
import type {SystemSpec,ProNode} from '../../../../../packages/pro-contract/system-spec';
import type {DisplayRefs} from '../../../../../packages/pro-contract/refs';

export type GateState='verified'|'unverified'|'failed';
export interface Gate{state:GateState;reason?:string;by?:string}
export type Evidence={flashed:number;total:number}|null|undefined;

/** Gate state of the item behind a verification pointer. A missing stamp is unverified, with the reason spelled out. */
export function gateOf(spec:SystemSpec,pointer:string):Gate{
 const v=spec.verification[pointer];
 if(!v)return {state:'unverified',reason:'not checked by a verifier'};
 if(v.status==='verified')return {state:'verified',by:v.by};
 return {state:v.status,by:v.by,reason:v.note??`${v.by} reported ${v.status}`};
}
export const wirePointer=(nodeIndex:number,wireIndex:number)=>`/nodes/${nodeIndex}/wires/${wireIndex}`;

/** Code is verified only when the gate stamped it AND the toolchain compiled it (lint alone is not a build). */
export function codeGate(spec:SystemSpec,index:number):Gate{
 const f=spec.code[index]!;
 const stamp=gateOf(spec,`/code/${index}`);
 if(f.verify.status==='compiled'&&stamp.state==='verified')return stamp;
 const own=f.verify.status==='linted'?'linted only, not compiled':f.verify.status==='failed'?'compile failed':f.verify.status==='pending'?'compile pending':undefined;
 if(stamp.state==='failed'||f.verify.status==='failed')return {state:'failed',reason:own??stamp.reason,by:stamp.by};
 return {state:'unverified',reason:own??stamp.reason??'not compiled',by:stamp.by};
}
/** Power is verified only when the solver stamped it and the budget is ok. */
export function powerGate(spec:SystemSpec,node:ProNode):Gate{
 const stamp=gateOf(spec,`/power/${node.id}`);
 if(!node.power.ok)return {state:'failed',reason:'power budget not met',by:stamp.by};
 return stamp;
}

export interface UnverifiedItem{key:string;kind:'Wire'|'Link'|'Code'|'Power'|'Site';ref:string;where:string;state:GateState;reason:string}
/** Every gated item that is not verified, in sheet order. This is the whole "Unverified items" section. */
export function collectUnverified(spec:SystemSpec,refs:DisplayRefs):UnverifiedItem[]{
 const out:UnverifiedItem[]=[];
 const push=(key:string,kind:UnverifiedItem['kind'],ref:string,where:string,g:Gate)=>{if(g.state!=='verified')out.push({key,kind,ref,where,state:g.state,reason:g.reason??'not verified'});};
 spec.nodes.forEach((n,ni)=>{
  const nref=refs.nodes[n.id]??n.id;
  n.wires.forEach((w,wi)=>push(wirePointer(ni,wi),'Wire',w.id,nref,gateOf(spec,wirePointer(ni,wi))));
  push(`/power/${n.id}`,'Power',nref,nref,powerGate(spec,n));
 });
 spec.links.forEach((l,i)=>push(`/links/${i}`,'Link',refs.links[l.id]??l.id,`${refs.nodes[l.from]??l.from} ↔ ${refs.nodes[l.to]??l.to}`,gateOf(spec,`/links/${i}`)));
 spec.code.forEach((f,i)=>push(`/code/${i}`,'Code',f.filename,refs.nodes[f.nodeId]??f.nodeId,codeGate(spec,i)));
 // not gated by any tool, so never verified: sketched distances
 spec.fields.forEach(f=>{if(f.distanceSource==='layout-estimate')out.push({key:`/fields/${f.id}`,kind:'Site',ref:refs.fields[f.id]??f.id,where:f.name,state:'unverified',reason:'distance to gateway is a layout estimate, not surveyed'});});
 return out;
}

export interface VerifySummary{wires:{ok:number;total:number};links:{ok:number;total:number};power:{ok:number;total:number};code:{compiled:number;linted:number;failed:number;other:number;total:number};unverified:number}
export function verifySummary(spec:SystemSpec,refs:DisplayRefs):VerifySummary{
 let wOk=0,wTot=0;
 spec.nodes.forEach((n,ni)=>n.wires.forEach((_w,wi)=>{wTot++;if(gateOf(spec,wirePointer(ni,wi)).state==='verified')wOk++;}));
 const lOk=spec.links.filter((_l,i)=>gateOf(spec,`/links/${i}`).state==='verified').length;
 const pOk=spec.nodes.filter(n=>powerGate(spec,n).state==='verified').length;
 const code={compiled:0,linted:0,failed:0,other:0,total:spec.code.length};
 spec.code.forEach((f,i)=>{if(codeGate(spec,i).state==='verified')code.compiled++;else if(f.verify.status==='linted')code.linted++;else if(f.verify.status==='failed')code.failed++;else code.other++;});
 return {wires:{ok:wOk,total:wTot},links:{ok:lOk,total:spec.links.length},power:{ok:pOk,total:spec.nodes.length},code,unverified:collectUnverified(spec,refs).length};
}

// ---------- title block ----------
export const docNo=(projectId:string)=>'BS-'+(projectId.replace(/[^a-zA-Z0-9]/g,'').slice(0,6).toUpperCase()||'0001');
/** Plan §12: model plus DESIGN · NOT BUILT, or FLASHED n/N once there is evidence. Never claims more than the data has. */
export const titleStatus=(e:Evidence):string=>e&&e.total>0?`FLASHED ${e.flashed}/${e.total}`:'DESIGN · NOT BUILT';
export const isoDate=(s:string)=>/^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):s;

// ---------- number formats ----------
const k=(n:number)=>{const v=n/1000;return (v>=100?Math.round(v):Math.round(v*10)/10).toLocaleString('en-US');};
/** IDR range in thousands: 55-85. */
export const idrK=(r:{min:number;max:number}):string=>r.min===r.max?k(r.min):`${k(r.min)}–${k(r.max)}`;
const m=(n:number)=>(n/1e6).toFixed(1);
/** Farm total in millions: "IDR 6.1–9.9 M". */
export const idrM=(r:{min:number;max:number}):string=>`IDR ${m(r.min)}–${m(r.max)} M`;
export const fmtM=(n:number)=>n<1?`${Math.round(n*1000)} mm`:`${(Math.round(n*10)/10).toString()} m`;

// ---------- parts and designators ----------
const PREFIX:Record<string,string>={sensor:'S',actuator:'A',radio:'RF',power:'PW',display:'D',interface:'IF',protection:'F'};
/** Reference designators per node part id: S1, S2, RF1 ... in spec order; the board is MCU. */
export function designators(node:ProNode):Record<string,string>{
 const n:Record<string,number>={};const out:Record<string,string>={board:'MCU'};
 for(const p of node.parts){const pre=PREFIX[p.role]??'X';n[pre]=(n[pre]??0)+1;out[p.id]=pre+n[pre];}
 return out;
}

// ---------- pin table and cable list ----------
export interface PinLine{boardPin:string;gpio:number|null;net:string;to:string;wire:string}
export function pinTable(node:ProNode,des:Record<string,string>):PinLine[]{
 const wireFor=(boardPin:string,part:string)=>node.wires.find(w=>(w.from.part==='board'&&w.from.pin===boardPin&&w.to.part===part)||(w.to.part==='board'&&w.to.pin===boardPin&&w.from.part===part))?.id??'–';
 return [...node.pins].sort((a,b)=>(a.gpio??999)-(b.gpio??999)||a.boardPin.localeCompare(b.boardPin)).map(p=>({
  boardPin:p.boardPin,gpio:p.gpio,net:p.symbol?.replace(/^PIN_/,'')??p.func,to:`${des[p.part]??p.part} ${p.partPin}`,wire:wireFor(p.boardPin,p.part)}));
}
export interface CableLine{id:string;color:string;from:string;to:string;via:string;len:string;gauge:string;func:string}
export function cableList(node:ProNode,des:Record<string,string>):CableLine[]{
 const e=(x:{part:string;pin:string})=>x.part==='board'?x.pin:`${des[x.part]??x.part} ${x.pin}`;
 return node.wires.map(w=>({id:w.id,color:w.color,func:w.func,from:e(w.from),to:e(w.to),
  via:w.viaGland?'gland':w.connectors.from==='screw-terminal'||w.connectors.to==='screw-terminal'?'terminal':'–',
  len:fmtM(w.lengthM),gauge:`${w.cable} · ${w.awg} AWG`}));
}

// ---------- checklist counts ----------
export const CK_COLUMNS:{phase:SystemSpec['checklist'][number]['phase'];label:string}[]=[
 {phase:'procure',label:'BUY'},{phase:'flash',label:'FLASH'},{phase:'wire',label:'WIRE'},{phase:'power-up',label:'POWER'},{phase:'install',label:'INSTALL'},{phase:'calibrate',label:'CALIB'},{phase:'commission',label:'TEST'}];
export function checklistCounts(spec:SystemSpec,refs:DisplayRefs){
 const rows=[...spec.nodes.map(n=>({id:n.id as string|undefined,ref:refs.nodes[n.id]??n.id})),{id:undefined as string|undefined,ref:'ALL'}];
 const count=(id:string|undefined,phase:string)=>spec.checklist.filter(c=>c.phase===phase&&(id===undefined?!c.nodeId:c.nodeId===id)).length;
 return {rows:rows.map(r=>({ref:r.ref,counts:CK_COLUMNS.map(c=>count(r.id,c.phase))})),total:spec.checklist.length};
}

// ---------- pagination ----------
export type PageDesc=
 |{kind:'cover'}
 |{kind:'schedule';chunk:number;lines:[number,number]}
 |{kind:'node';nodeId:string;part:number}
 |{kind:'bom';chunk:number;lines:[number,number]}
 |{kind:'checks';chunk:number;lines:[number,number]}
 |{kind:'tests';chunk:number;lines:[number,number];last:boolean}
 |{kind:'unverified';chunk:number;lines:[number,number]}
 |{kind:'code';fileIndex:number;chunk:number;chunks:number;lines:[number,number]};
export const CODE_ROWS_PER_PAGE=58,CODE_WRAP=98,BOM_FIRST=24,BOM_NEXT=44,PIN_P2=16,CABLE_P2=16,TABLE_CONT=50,CHECKS_FIRST=12,CHECKS_NEXT=40,TESTS_PER_PAGE=12,UNVERIFIED_PER_PAGE=34;

/** Splits source into pages of at most `rows` visual rows (long lines count as several). Returns 1-based inclusive line ranges. */
export function chunkLines(content:string,rows=CODE_ROWS_PER_PAGE,wrap=CODE_WRAP):[number,number][]{
 const lines=content.replace(/\r\n?/g,'\n').replace(/\n$/,'').split('\n');
 const out:[number,number][]=[];let from=1,used=0;
 lines.forEach((l,i)=>{
  const r=Math.max(1,Math.ceil(l.replace(/\t/g,'    ').length/wrap));
  if(used+r>rows&&used>0){out.push([from,i]);from=i+1;used=0;}
  used+=r;
 });
 out.push([from,lines.length]);return out;
}
/** Half-open [from,to) ranges: a first page of `first` rows, then pages of `next`. Always at least one range. */
export function chunkRows(n:number,first:number,next:number):[number,number][]{
 const out:[number,number][]=[];let i=0,size=first;
 do{out.push([i,Math.min(n,i+size)]);i+=size;size=next;}while(i<n);
 return out;
}
export const chunkBom=(n:number)=>chunkRows(n,BOM_FIRST,BOM_NEXT);
/** Pages of one node: 1 = 3D + wiring, 2 = pin table, cable list, rules, then continuation pages for very heavy nodes. */
/** A small node fits everything on one sheet (like the approved mockup); a heavier one gets a table sheet. */
export const nodeIsSmall=(n:ProNode)=>n.pins.length<=SMALL.pins&&n.wires.length<=SMALL.wires&&n.rules.length<=SMALL.rules&&n.parts.length<=SMALL.parts;
export const SMALL={pins:8,wires:10,rules:2,parts:8} as const;
export const nodePageCount=(n:ProNode)=>nodeIsSmall(n)?1:2+Math.max(Math.ceil(Math.max(0,n.pins.length-PIN_P2)/TABLE_CONT),Math.ceil(Math.max(0,n.wires.length-CABLE_P2)/TABLE_CONT));

/** Up to this many nodes the schedule sits on the cover; more get their own sheet(s). */
export const SCHEDULE_ON_COVER=5,SCHEDULE_PER_PAGE=14;
export function planPages(spec:SystemSpec,refs?:DisplayRefs):PageDesc[]{
 const pages:PageDesc[]=[{kind:'cover'}];
 if(spec.nodes.length>SCHEDULE_ON_COVER)chunkRows(spec.nodes.length,SCHEDULE_PER_PAGE,SCHEDULE_PER_PAGE).forEach((lines,chunk)=>pages.push({kind:'schedule',chunk,lines}));
 for(const n of spec.nodes)for(let part=1;part<=nodePageCount(n);part++)pages.push({kind:'node',nodeId:n.id,part});
 chunkBom(spec.bom.lines.length).forEach((lines,chunk)=>pages.push({kind:'bom',chunk,lines}));
 chunkRows(spec.checks.length,CHECKS_FIRST,CHECKS_NEXT).forEach((lines,chunk)=>pages.push({kind:'checks',chunk,lines}));
 const tc=chunkRows(spec.tests.length,TESTS_PER_PAGE,TESTS_PER_PAGE);
 tc.forEach((lines,chunk)=>pages.push({kind:'tests',chunk,lines,last:chunk===tc.length-1}));
 const un=collectUnverified(spec,refs??({fields:{},nodes:{},links:{},wires:{}} as DisplayRefs)).length;
 chunkRows(un,UNVERIFIED_PER_PAGE,UNVERIFIED_PER_PAGE).forEach((lines,chunk)=>pages.push({kind:'unverified',chunk,lines}));
 spec.code.forEach((f,fileIndex)=>{const ch=chunkLines(f.content);ch.forEach((lines,chunk)=>pages.push({kind:'code',fileIndex,chunk,chunks:ch.length,lines}));});
 return pages;
}
