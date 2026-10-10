import {useEffect,useState} from 'react';
import {Link,useSearchParams,useNavigate} from 'react-router-dom';
import {ArrowRightIcon,MapPinIcon} from '@phosphor-icons/react';
import {api,post} from './api';
import type {SiteView,SiteSnapshot} from '../../../packages/site-contract';
import {useLang} from './i18n';
import {Button,Input,Notice,Select,Spinner} from './ui';
import './site-workbench.css';
function snapshot(site:SiteView):SiteSnapshot{return {name:site.name,areas:site.areas,devices:site.devices,links:site.links};}
export function ProjectSiteAction({projectId,blocked,initialOpen=false}:{projectId:string;blocked:boolean;initialOpen?:boolean}){
 const{tr}=useLang();
 const navigate=useNavigate();const[query]=useSearchParams(),[memberships,setMemberships]=useState<any[]>([]),[sites,setSites]=useState<any[]>([]),[open,setOpen]=useState(initialOpen),[target,setTarget]=useState(''),[area,setArea]=useState(''),[name,setName]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){const [m,s]=await Promise.all([api('/projects/'+projectId+'/sites'),api('/sites')]);setMemberships(m.memberships);setSites(s.sites);}
 useEffect(()=>{let live=true;Promise.all([api('/projects/'+projectId+'/sites'),api('/sites')]).then(([m,s])=>{if(live){setMemberships(m.memberships);setSites(s.sites);}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[projectId]);
 const back=memberships.find(m=>m.siteId===query.get('site'));
 async function adopt(){setBusy(true);setError('');try{let site=sites.find(s=>s.id===target);if(!site){site=await post('/sites',{name:name||'Lokasi perangkat',areas:[{id:crypto.randomUUID(),name:'Area utama',icon:'building',position:{x:40,y:40}}],devices:[],links:[]});}else site=await api('/sites/'+site.id);const next=snapshot(site);next.devices.push({id:crypto.randomUUID(),name:'Perangkat '+(next.devices.length+1),kind:'custom',areaId:area||site.areas[0]?.id,required:true,projectId,position:{x:20,y:135}});if(!next.devices.at(-1)?.areaId)throw new Error(tr('Add an area to the location first','Tambahkan area pada lokasi terlebih dahulu'));await api('/sites/'+site.id,{method:'PUT',body:JSON.stringify({expectedRevision:site.revision,snapshot:next})});await load();setOpen(false);navigate(`/project/${projectId}?site=${site.id}`);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="project-site-action psa">
  {back&&!blocked&&<nav className="psa-crumbs" aria-label={tr('Device location','Lokasi perangkat')}><Link to={'/sites'}>{tr('Sites','Lokasi')}</Link><span aria-hidden="true">/</span><Link to={'/site/'+back.siteId}>{back.siteName}</Link><span aria-hidden="true">/</span><Link to={'/site/'+back.siteId+'/area/'+back.areaId}>{back.areaName}</Link><span aria-hidden="true">/</span><span aria-current="page">{tr('Device wiring','Wiring perangkat')}</span></nav>}
  <Button size="sm" variant="secondary" disabled={blocked||busy} aria-expanded={open} onClick={()=>{setOpen(!open);void load();}}><MapPinIcon aria-hidden="true"/> {tr('Sites & areas','Lokasi & area')}</Button>
  {open&&<div className="psa-panel">
   <p>{tr('Link this project as one device. Wiring and evidence stay with the project.','Tautkan proyek ini sebagai satu perangkat. Wiring dan bukti tetap milik proyek.')}</p>
   {memberships.length>0&&!blocked&&<ul className="psa-memberships">{memberships.map(m=><li key={m.siteId}><Link to={'/site/'+m.siteId+'/area/'+m.areaId}>{m.siteName} / {m.areaName} <ArrowRightIcon aria-hidden="true"/></Link></li>)}</ul>}
   <Select id={`psa-target-${projectId}`} label={tr('Target location','Lokasi tujuan')} value={target} onChange={e=>{setTarget(e.target.value);setArea('');}}><option value="">{tr('Create a new location','Buat lokasi baru')}</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select>
   {target?<Select id={`psa-area-${projectId}`} label={tr('Target area','Area tujuan')} value={area} onChange={e=>setArea(e.target.value)}><option value="">{tr('First area','Area pertama')}</option>{sites.find(s=>s.id===target)?.areas.map((a:any)=><option key={a.id} value={a.id}>{a.name}</option>)}</Select>
   :<Input id={`psa-name-${projectId}`} label={tr('Location name','Nama lokasi')} value={name} onChange={e=>setName(e.target.value)} maxLength={100}/>}
   <Button size="sm" disabled={blocked||busy} onClick={adopt}>{busy?<><Spinner label={tr('Saving','Menyimpan')}/> {tr('Saving…','Menyimpan…')}</>:tr('Link this project','Tautkan proyek ini')}</Button>
   {error&&<Notice tone="error">{error}</Notice>}
  </div>}
 </section>;
}
