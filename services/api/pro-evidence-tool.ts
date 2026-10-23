/** evidence_status tool backed by ProEvidence (ticks and anomalies stored by M7). Mounted from server.ts through the `impls` option of installPro. */
import type {Ops} from '../ops/ops.js';
import {proFor} from '../ops/pro.js';
import {proStore} from '../ops/pro-wiring.js';
import {ProEvidence,type EvidenceCtx} from '../ops/pro-evidence.js';

interface Spec{checklist?:{id:string}[];code?:{nodeId:string;verify?:{sha256?:string}}[]}
export function evidenceStatusImpl(ops:Ops){
 return(i:{projectId:string;revision?:number})=>{
  const pro=proFor(ops),store=proStore(pro);
  const rev=i.revision?store.revision(i.projectId,i.revision):store.head(i.projectId);
  const spec=(rev?.spec??{}) as Spec;
  const ctx:EvidenceCtx={
   // The compile sha of the node's firmware source; a flash tick needs the flashed sha to match it.
   shaOf:n=>spec.code?.find(c=>c.nodeId===n)?.verify?.sha256,
   // No catalog reading ranges yet: out_of_range stays quiet rather than guess.
   rangeOf:()=>undefined,
  };
  const st=new ProEvidence(pro.db,()=>ops.clock()).status(i.projectId,ctx);
  const byItem=new Map(st.items.map(t=>[t.itemId,t]));
  const items=(spec.checklist??[]).slice(0,400).map(c=>{const t=byItem.get(c.id);return t?{itemId:c.id,state:t.state as 'ticked'|'open'|'suggested',by:t.by as 'human'|'evidence',...(t.evidenceRef?{evidenceRef:t.evidenceRef.slice(0,120)}:{})}:{itemId:c.id,state:'open' as const};});
  return{items,anomalies:st.anomalies};
 };
}
