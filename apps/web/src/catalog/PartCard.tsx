/** One catalog part: summary, provenance rollup, and per-leaf provenance on demand. */
import {useState,type ReactNode} from 'react';
import {Tag} from '../ui';
import {useLang} from '../i18n';
import type {PartRecord} from '../../../../packages/catalog/schema';
import {LabTestedBadge} from './LabTestedBadge';
import {leaves,Provenance,summarize,isStale} from './Provenance';

export function PartCard({part,actions}:{part:PartRecord;actions?:ReactNode}){
 const{tr,lang}=useLang();const [open,setOpen]=useState(false);
 const s=summarize(part);const id=part.identity.id;
 return <li className={`cat-part${open?' is-open':''}`} data-testid="catalog-part" data-part={id}>
  <button type="button" className="bo-ops-row" aria-expanded={open} onClick={()=>setOpen(!open)}>
   <span className="bo-ops-main"><b>{part.identity.name.v}</b><small>{id} · {part.identity.kind.v}</small></span>
   <span className="cat-tags"><Tag tone={s.low?'error':s.medium?'warn':'ok'}>{s.high}/{s.total} {tr('high','tinggi')}</Tag>{s.stale>0&&<Tag tone="warn">{s.stale} {tr('stale','usang')}</Tag>}{s.unverified>0&&<Tag>{s.unverified} {tr('unverified','belum diverifikasi')}</Tag>}<LabTestedBadge labTested={part.labTested}/></span>
  </button>
  {open&&<div className="bo-ops-detail">
   <p>{part.untrusted.summary.v[lang]}</p>
   <table className="cat-leaves"><thead><tr><th>{tr('Field','Kolom')}</th><th>{tr('Provenance','Asal data')}</th></tr></thead><tbody>{leaves(part).map(l=><tr key={l.path}><td><code>{l.path}</code></td><td><Provenance p={l.p} stale={isStale(l.p.at)}/></td></tr>)}</tbody></table>
   {actions}
  </div>}
 </li>;
}
