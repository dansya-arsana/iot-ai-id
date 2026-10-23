/** Checklist view model: pure helpers over spec.checklist and the tick rows. Never recomputes server-owned values (ckId, W#, verification). */
import type {ChecklistItem,ChecklistPhase,SystemSpec} from '../../../../../packages/pro-contract/system-spec';

export const PHASES:readonly ChecklistPhase[]=['procure','flash','wire','power-up','install','calibrate','commission'];
export const PHASE_LABEL:Record<ChecklistPhase,string>={procure:'Procure',flash:'Flash',wire:'Wire','power-up':'Power-up',install:'Install',calibrate:'Calibrate',commission:'Commission'};
export const PHASE_SHORT:Record<ChecklistPhase,string>={procure:'Buy',flash:'Flash',wire:'Wire','power-up':'Power',install:'Install',calibrate:'Calib',commission:'Test'};
const PREFIX:Record<ChecklistPhase,string>={procure:'B',flash:'FL',wire:'W','power-up':'P',install:'I',calibrate:'CAL',commission:'C'};

export interface Tick{itemId:string;state:'ticked'|'open'|'suggested';by:'human'|'evidence';evidenceRef?:string;at?:string}
export type TickMap=Record<string,Tick>;
export const isDone=(t?:Tick)=>t?.state==='ticked';
export const isEvidence=(t?:Tick)=>t?.state==='ticked'&&t.by==='evidence';

export interface Count{done:number;total:number}
export interface Progress{all:Count;phase:Record<ChecklistPhase,Count>}
const zero=():Progress=>({all:{done:0,total:0},phase:Object.fromEntries(PHASES.map(p=>[p,{done:0,total:0}])) as Record<ChecklistPhase,Count>});
const bump=(p:Progress,phase:ChecklistPhase,done:boolean)=>{p.all.total++;p.phase[phase].total++;if(done){p.all.done++;p.phase[phase].done++;}};
export const pct=(c:Count)=>c.total?Math.round(100*c.done/c.total):0;

export interface Rollup{overall:Progress;byNode:Record<string,Progress>;byField:Record<string,Progress>;site:Progress}
/** Items with no nodeId (procure, link range tests) roll up under "site"; a field also counts its own node-less items. */
export function rollup(items:ChecklistItem[],ticks:TickMap):Rollup{
 const r:Rollup={overall:zero(),byNode:{},byField:{},site:zero()};
 for(const it of items){
  const done=isDone(ticks[it.id]);
  bump(r.overall,it.phase,done);
  if(it.nodeId)bump(r.byNode[it.nodeId]??=zero(),it.phase,done);else bump(r.site,it.phase,done);
  if(it.fieldId)bump(r.byField[it.fieldId]??=zero(),it.phase,done);
 }
 return r;
}

/** Short display code: wires keep their stored W#, other phases are numbered in spec order (display only, never a key). */
export function codes(items:ChecklistItem[]):Record<string,string>{
 const n:Record<string,number>={},out:Record<string,string>={};
 for(const it of items){
  if(it.phase==='wire'&&it.ref?.wireId){out[it.id]=it.ref.wireId;continue;}
  n[it.phase]=(n[it.phase]??0)+1;out[it.id]=`${it.phase==='wire'?'WR':PREFIX[it.phase]}-${n[it.phase]}`;
 }
 return out;
}

export type Filter='all'|'open'|'done';
export interface Group{phase:ChecklistPhase;items:ChecklistItem[];done:number;total:number}
const inScope=(i:ChecklistItem,scope:string)=>scope==='all'||(scope==='site'?!i.nodeId:i.nodeId===scope);
/** Phase groups for a scope (all, site or a node id); done/total ignore the filter, items obey it. */
export function groups(items:ChecklistItem[],ticks:TickMap,scope:string,filter:Filter):Group[]{
 const sel=items.filter(i=>inScope(i,scope)).sort((a,b)=>a.order-b.order);
 return PHASES.map(phase=>{
  const all=sel.filter(i=>i.phase===phase);
  return{phase,total:all.length,done:all.filter(i=>isDone(ticks[i.id])).length,
   items:all.filter(i=>filter==='all'||(filter==='done')===isDone(ticks[i.id]))};
 }).filter(g=>g.items.length>0);
}

export const nextOpen=(items:ChecklistItem[],ticks:TickMap,scope:string):ChecklistItem|undefined=>
 [...items].sort((a,b)=>a.order-b.order).find(i=>!isDone(ticks[i.id])&&inScope(i,scope));

/** Reason label for a wire item whose gate stamp is not "verified". Items without a stamp (everything but wires) get none. */
export function unverifiedReason(spec:SystemSpec,it:ChecklistItem):string|undefined{
 const wid=it.ref?.wireId;if(!wid||!it.nodeId)return undefined;
 const ni=spec.nodes.findIndex(n=>n.id===it.nodeId);const wi=ni<0?-1:spec.nodes[ni]!.wires.findIndex(w=>w.id===wid);
 if(wi<0)return undefined;
 const v=spec.verification?.[`/nodes/${ni}/wires/${wi}`];
 if(!v)return 'unverified · not checked by the gate';
 return v.status==='verified'?undefined:`unverified · ${v.note??v.status}`;
}
