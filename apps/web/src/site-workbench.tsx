import {useEffect,useState,type FormEvent} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {api,post} from './api';
import type {SiteView} from '../../../packages/site-contract';
import {SiteWorkspace} from './site-workspace';
import {SchoolWorkbench} from './school-workbench';
import './site-workbench.css';
export function Sites(){const[sites,setSites]=useState<SiteView[]>([]),[name,setName]=useState(''),[error,setError]=useState('');const navigate=useNavigate();useEffect(()=>{api('/sites').then(r=>setSites(r.sites)).catch(e=>setError(e.message));},[]);async function create(e:FormEvent){e.preventDefault();try{const s=await post('/sites',{name,areas:[],devices:[],links:[]});navigate('/site/'+s.id);}catch(e){setError((e as Error).message);}}return <main className="sites-page"><Link to="/build">← Proyek</Link><span className="mono">LOKASI / AREA / PERANGKAT</span><h1>Lokasi & area.</h1><p>Atur perangkat menurut tempatnya. Bukti tetap berasal dari eksperimen setiap perangkat.</p><form onSubmit={create}><label>Nama lokasi<input value={name} onChange={e=>setName(e.target.value)} required maxLength={100}/></label><button className="button red">Buat lokasi</button></form>{error&&<p role="alert">{error}</p>}<div className="site-directory">{sites.map(s=><Link key={s.id} to={'/site/'+s.id}><h2>{s.name}</h2><p>{s.areas.length} area · {s.devices.length} perangkat</p><small>{s.status==='physical_verified'?'Perangkat wajib terverifikasi fisik':'Belum terverifikasi fisik'}</small></Link>)}</div></main>;}

export function SiteWorkbench(){const {id,areaId}=useParams();return <SiteWorkspace siteId={id!} areaId={areaId}>{projectId=><SchoolWorkbench projectId={projectId}/>}</SiteWorkspace>;}
