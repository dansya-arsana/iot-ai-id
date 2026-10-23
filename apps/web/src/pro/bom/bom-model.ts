/** Pure BOM helpers: display formatting, per-node view, CSV, procurement queue. Totals and prices are server-owned and shown as stored. */
import type {SystemSpec} from '../../../../../packages/pro-contract/system-spec';
import {ckId} from '../../../../../packages/pro-contract/system-spec';

export type Range={min:number;max:number};
export type BomLine=SystemSpec['bom']['lines'][number];

const nf=new Intl.NumberFormat('id-ID');
export const idr=(n:number)=>nf.format(n);
/** "Rp 70.000–120.000"; one number when min equals max. Always an estimate. */
export const idrRange=(r:Range)=>r.min===r.max?`Rp ${idr(r.min)}`:`Rp ${idr(r.min)}–${idr(r.max)}`;
export const qtyText=(l:Pick<BomLine,'qty'|'unit'>)=>`${l.qty} ${l.unit}`;

/** Lines of one node with its own qty; subtotal is unit range times qty (an estimate, the server total stays authoritative). */
export function nodeLines(spec:SystemSpec,nodeId:string){
 const out:{line:BomLine;qty:number;subtotal:Range}[]=[];
 for(const line of spec.bom.lines){
  const e=line.perNode.find(p=>p.nodeId===nodeId);
  if(e)out.push({line,qty:e.qty,subtotal:{min:Math.round(line.priceIdr.unit.min*e.qty),max:Math.round(line.priceIdr.unit.max*e.qty)}});
 }
 return out;
}
export const sumRange=(rs:Range[]):Range=>rs.reduce((a,r)=>({min:a.min+r.min,max:a.max+r.max}),{min:0,max:0});

/** CSV cell with quoting and spreadsheet-formula neutralisation. */
export function csvCell(v:string|number|boolean):string{
 let s=String(v);
 if(/^[=+\-@\t\r]/.test(s)&&typeof v==='string')s="'"+s;
 return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
}
export function bomCsv(spec:SystemSpec):string{
 const head=['key','name','unit','qty','unit_idr_min','unit_idr_max','total_idr_min','total_idr_max','price_checked_at','price_source','optional','nodes'];
 const rows=spec.bom.lines.map(l=>[l.key,l.name.en,l.unit,l.qty,l.priceIdr.unit.min,l.priceIdr.unit.max,l.priceIdr.total.min,l.priceIdr.total.max,l.priceSource.checkedAt,l.priceSource.table,l.optional,l.perNode.map(p=>`${p.nodeId}:${p.qty}`).join(' ')]);
 rows.push(['TOTAL (estimate)','','','','','',spec.bom.totalIdr.min,spec.bom.totalIdr.max,'','','','']);
 return [head,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
}

/** Oldest and newest price check date across lines. */
export function priceDates(spec:SystemSpec){
 const d=spec.bom.lines.map(l=>l.priceSource.checkedAt).sort();
 return{oldest:d[0],newest:d[d.length-1]};
}

// ---- procurement queue (local until the checklist tab owns writes) ----
export const procureId=(l:Pick<BomLine,'kind'>)=>ckId('procure',l.kind);
export const inChecklist=(spec:SystemSpec,l:Pick<BomLine,'kind'>)=>spec.checklist.some(c=>c.id===procureId(l));
const qkey=(projectId:string|null)=>`pro.procure.${projectId??'dev'}`;
export function loadQueue(projectId:string|null):string[]{
 try{const v=JSON.parse(localStorage.getItem(qkey(projectId))??'[]');return Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'):[];}catch{return[];}
}
export function saveQueue(projectId:string|null,q:string[]){try{localStorage.setItem(qkey(projectId),JSON.stringify(q));}catch{/* storage unavailable */}}
export const PROCURE_EVENT='pro:checklist-add';
