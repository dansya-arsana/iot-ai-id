/** Backoffice catalog: provenance review, low/stale/unverified filters, proposal queue, Tested-in-lab badge. The integrator mounts <CatalogAdmin/>. */
import {useCallback,useEffect,useMemo,useState} from 'react';
import {useLang} from './i18n';
import {Button,Eyebrow,Notice,Select,Tag} from './ui';
import type {PartRecord} from '../../../packages/catalog/schema';
import {PartCard} from './catalog/PartCard';
import {LabTestedForm} from './catalog/LabTestedBadge';
import {matchesFilter,type CatalogFilter} from './catalog/provenance-core';
export {matchesFilter,type CatalogFilter};

export const catalogSection={hash:'#bo-catalog',en:'Catalog',id:'Katalog'};
export type Proposal={id:string;partId:string;kind:'new'|'edit';status:'pending'|'approved'|'rejected';proposedBy:string;at:string;note?:string;summary?:string};
/** Staff routes on the admin host: cookie session (aiot_admin), X-AIoT-Staff on writes. They are served by ops at /ops/v1/catalog/*. */
async function staffCatalog<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const response=await fetch('/ops/v1/catalog'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-AIoT-Staff':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await response.json().catch(()=>({error:'The service did not answer'}));
 if(!response.ok)throw new Error(String((data as {error?:string}).error??'Request failed'));
 return data as T;
}
type ServerProposal={id:string;partId:string;status:Proposal['status'];by:string;at:string;reason?:string;source?:string;note?:string|null};
export const catalogApi={
 parts:()=>staffCatalog<{parts:PartRecord[]}>('/parts?full=1').then(d=>d.parts),
 proposals:()=>staffCatalog<{proposals:ServerProposal[]}>('/proposals').then(d=>d.proposals.map((p):Proposal=>({id:p.id,partId:p.partId,kind:'edit',status:p.status,proposedBy:p.by,at:p.at,...(p.reason?{note:p.reason}:{}),...(p.source?{summary:p.source}:{})}))),
 decide:(id:string,decision:'approve'|'reject')=>staffCatalog(`/proposals/${encodeURIComponent(id)}/${decision}`,'POST',{}),
 labTested:(partId:string,taskId:string)=>staffCatalog(`/parts/${encodeURIComponent(partId)}/lab-tested`,'PUT',{taskId}),
};

export function CatalogAdmin({canWrite=true}:{canWrite?:boolean}){
 const{tr}=useLang();
 const [parts,setParts]=useState<PartRecord[]>();const [proposals,setProposals]=useState<Proposal[]>([]);const [filter,setFilter]=useState<CatalogFilter>('all');
 const [error,setError]=useState('');const [notice,setNotice]=useState<{tone:'ok'|'error';text:string}>();
 const load=useCallback(()=>Promise.all([catalogApi.parts(),catalogApi.proposals()]).then(([p,q])=>{setParts(p);setProposals(q);setError('');}).catch(e=>setError(e instanceof Error?e.message:String(e))),[]);
 useEffect(()=>{void load();},[load]);
 const run=async(action:()=>Promise<unknown>,ok:string)=>{setNotice(undefined);try{await action();setNotice({tone:'ok',text:ok});await load();return true;}catch(e){setNotice({tone:'error',text:e instanceof Error?e.message:String(e)});return false;}};
 const shown=useMemo(()=>(parts??[]).filter(p=>matchesFilter(p,filter)),[parts,filter]);
 const pending=proposals.filter(p=>p.status==='pending');
 if(error&&!parts)return <Notice tone="warn" title={tr('Catalog unavailable','Katalog tidak tersedia')} action={<Button size="sm" onClick={()=>void load()}>{tr('Retry','Coba lagi')}</Button>}>{error}</Notice>;
 if(!parts)return null;
 return <section id="bo-catalog" className="bo-panel bo-wide bo-ops" aria-label={tr('Catalog','Katalog')}>
  <div className="bo-panel-head"><div><Eyebrow>{tr('Verified catalog','Katalog terverifikasi')}</Eyebrow><h2>{tr('Catalog','Katalog')}</h2></div>
   <div className="bo-panel-aside"><Select id="cat-filter" hideLabel label={tr('Filter','Filter')} value={filter} onChange={e=>setFilter(e.target.value as CatalogFilter)}>
    <option value="all">{tr('All parts','Semua komponen')}</option><option value="low">{tr('Low confidence','Keyakinan rendah')}</option><option value="stale">{tr('Stale over 12 months','Usang lebih dari 12 bulan')}</option><option value="unverified">{tr('Unverified (import only)','Belum diverifikasi (impor saja)')}</option></Select></div></div>
  {notice&&<Notice tone={notice.tone}>{notice.text}</Notice>}
  <h3>{tr('Proposal queue','Antrean usulan')} <Tag>{pending.length}</Tag></h3>
  {!pending.length?<p className="bo-muted">{tr('No pending proposals.','Tidak ada usulan tertunda.')}</p>:
   <ul className="bo-ops-list" data-testid="catalog-proposals">{pending.map(q=><li key={q.id} data-proposal={q.id}><div className="bo-ops-row"><Tag tone="warn">{q.kind}</Tag><span className="bo-ops-main"><b>{q.partId}</b><small>{q.proposedBy} · {q.at.slice(0,10)}{q.note?` · ${q.note}`:''}</small></span>
    {canWrite&&<span className="bo-ops-actions"><Button size="sm" onClick={()=>void run(()=>catalogApi.decide(q.id,'approve'),tr('Proposal approved','Usulan disetujui'))}>{tr('Approve','Setujui')}</Button><Button size="sm" variant="secondary" onClick={()=>void run(()=>catalogApi.decide(q.id,'reject'),tr('Proposal rejected','Usulan ditolak'))}>{tr('Reject','Tolak')}</Button></span>}</div></li>)}</ul>}
  <h3>{tr('Parts','Komponen')} <Tag>{shown.length}/{parts.length}</Tag></h3>
  {!shown.length?<p className="bo-muted">{tr('No parts match this filter.','Tidak ada komponen untuk filter ini.')}</p>:
   <ul className="bo-ops-list" data-testid="catalog-parts">{shown.map(part=><PartCard key={part.identity.id} part={part} actions={canWrite&&!part.labTested?<LabTestedForm partId={part.identity.id} onSubmit={taskId=>run(()=>catalogApi.labTested(part.identity.id,taskId),tr('Marked tested in lab','Ditandai teruji di lab'))}/>:undefined}/>)}</ul>}
 </section>;
}
