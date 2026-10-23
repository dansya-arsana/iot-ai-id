import {useState} from 'react';
import {useProSpec,useSelection} from '../api/spec-store';
import {Provenance} from '../../catalog/Provenance';
import {checkPointer,checkTarget,countBySeverity,scopeLabel,sortChecks,stampToProvenance,type Check} from './checks-model';
import '../bom/bom.css';

export const SHOW_EVENT='pro:show';
const LABEL={error:'Error',warning:'Warning',info:'Info'} as const;

function Prov({check}:{check:Check}){
 const {spec}=useProSpec();const [open,setOpen]=useState(false);
 if(!spec)return null;
 const ptr=checkPointer(spec,check),stamp=ptr?spec.verification[ptr]:undefined;
 return <span className="m6-pop"><button type="button" className="pro-btn" aria-expanded={open} onClick={()=>setOpen(o=>!o)}>Provenance</button>
  {open&&<div className="m6-pop-body" role="dialog" aria-label="Provenance">
   <div className="pro-eyebrow">{check.code}</div>
   {stamp?<p><Provenance p={stampToProvenance(stamp,check.ref)} stale={false}/></p>:<p className="pro-muted">No verifier stamp for this check. It is advisory, not gate-verified.</p>}
   {stamp&&<span className="m6-sub">{stamp.status} · inputs {stamp.inputsSha.slice(0,12)}</span>}
   {check.ref&&<span className="m6-sub">ref {check.ref}</span>}
   <button type="button" className="pro-link" onClick={()=>setOpen(false)}>Close</button></div>}</span>;
}
export function ChecksTab(){
 const {spec,refs}=useProSpec();
 const {select}=useSelection();
 if(!spec||!refs)return <div className="m6-empty">No design loaded.</div>;
 const list=sortChecks(spec.checks),n=countBySeverity(spec.checks);
 const show=(c:Check,view:'3d'|'wiring')=>{
  const t=checkTarget(spec,c);if(t.select)select(t.select);
  window.dispatchEvent(new CustomEvent(SHOW_EVENT,{detail:{view,...t.select}}));
 };
 return <div className="m6" data-testid="checks-tab">
  <div className="m6-bar"><span className="m6-tag error">{n.error} errors</span><span className="m6-tag warn">{n.warning} warnings</span><span className="m6-tag info">{n.info} info</span></div>
  <div className="m6-scroll">
   {!list.length&&<div className="m6-empty">No checks raised for this revision.</div>}
   {list.map((c,i)=>{const t=checkTarget(spec,c);return <div key={c.code+i} className="m6-check">
    <span className={'m6-tag '+(c.severity==='warning'?'warn':c.severity)}>{LABEL[c.severity]}</span>
    <div><p>{c.en}</p><span className="m6-sub">{scopeLabel(c,refs)} · {c.code}{c.ref?` · ${c.ref}`:''}</span></div>
    <div className="m6-actions">
     {t.views.includes('3d')&&<button type="button" className="pro-btn" onClick={()=>show(c,'3d')}>Show in 3D</button>}
     {t.views.includes('wiring')&&<button type="button" className="pro-btn" onClick={()=>show(c,'wiring')}>Show in wiring</button>}
     <Prov check={c}/>
    </div></div>;})}
  </div>
 </div>;
}
