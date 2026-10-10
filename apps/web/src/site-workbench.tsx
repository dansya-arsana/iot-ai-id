import {useEffect,useState,type FormEvent} from 'react';
import {useNavigate,useParams} from 'react-router-dom';
import {ArrowLeftIcon,ArrowRightIcon,PlusIcon} from '@phosphor-icons/react';
import {api,post} from './api';
import type {SiteView} from '../../../packages/site-contract';
import {SiteWorkspace} from './site-workspace';
import {SchoolWorkbench} from './school-workbench';
import {useLang} from './i18n';
import {Button,CardLink,EmptyState,Eyebrow,Input,SectionHeader,Tag,TextLink} from './ui';
import {PageShell} from './site-shell';
import {ApiError} from './pages/build-page';
import './site-workbench.css';
export function Sites(){
 const{tr}=useLang();
 const[sites,setSites]=useState<SiteView[]>([]),[name,setName]=useState(''),[error,setError]=useState('');const navigate=useNavigate();
 useEffect(()=>{api('/sites').then(r=>setSites(r.sites)).catch(e=>setError(e.message));},[]);
 async function create(e:FormEvent){e.preventDefault();try{const s=await post('/sites',{name,areas:[],devices:[],links:[]});navigate('/site/'+s.id);}catch(e){setError((e as Error).message);}}
 return <PageShell eyebrow={tr('Sites / Areas / Devices','Lokasi / Area / Perangkat')} title={tr('Sites & areas.','Lokasi & area.')} lead={tr('Organise devices by where they live. Evidence still comes from each device’s own experiments.','Atur perangkat menurut tempatnya. Bukti tetap berasal dari eksperimen setiap perangkat.')} actions={<TextLink to="/build"><ArrowLeftIcon aria-hidden="true"/> {tr('Back to projects','Kembali ke proyek')}</TextLink>}>
  <div className="swk-sites">
   <form className="swk-create" onSubmit={create}>
    <Input id="swk-site-name" label={tr('Location name','Nama lokasi')} value={name} onChange={e=>setName(e.target.value)} required maxLength={100} placeholder={tr('e.g. North field','mis. Lahan utara')}/>
    <Button type="submit"><PlusIcon aria-hidden="true"/> {tr('Create location','Buat lokasi')}</Button>
   </form>
   {error&&<ApiError message={error}/>}
   <section aria-labelledby="swk-sites-title">
    <SectionHeader title={<span id="swk-sites-title">{tr('Your locations','Lokasimu')}</span>} aside={<Eyebrow as="span">{tr(`${sites.length} locations`,`${sites.length} lokasi`)}</Eyebrow>}/>
    {sites.length?<ul className="swk-directory">{sites.map(s=><li key={s.id}><CardLink to={'/site/'+s.id} className="swk-site-card">
     <Eyebrow as="span">{tr(`${s.areas.length} areas · ${s.devices.length} devices`,`${s.areas.length} area · ${s.devices.length} perangkat`)}</Eyebrow>
     <h3>{s.name}</h3>
     <div className="swk-site-card-foot"><Tag tone={s.status==='physical_verified'?'ok':'neutral'}>{s.status==='physical_verified'?tr('Required devices physically verified','Perangkat wajib terverifikasi fisik'):tr('Not physically verified','Belum terverifikasi fisik')}</Tag><ArrowRightIcon aria-hidden="true"/></div>
    </CardLink></li>)}</ul>
    :!error&&<EmptyState eyebrow={tr('No locations yet','Belum ada lokasi')} title={tr('Start with one place.','Mulai dari satu tempat.')}>{tr('Name a location above, then add areas and devices on its canvas.','Beri nama lokasi di atas, lalu tambahkan area dan perangkat di canvas-nya.')}</EmptyState>}
   </section>
  </div>
 </PageShell>;
}

export function SiteWorkbench(){const {id,areaId}=useParams();return <SiteWorkspace siteId={id!} areaId={areaId}>{projectId=><SchoolWorkbench projectId={projectId}/>}</SiteWorkspace>;}
