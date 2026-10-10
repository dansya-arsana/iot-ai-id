import React,{useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {ArrowRightIcon,ArrowUpRightIcon,PlusIcon} from '@phosphor-icons/react';
import {api,post} from '../api';
import {useLang} from '../i18n';
import {AnchorButton,Button,EmptyState,Eyebrow,Notice,PageHeader,SectionHeader,Spinner,Tag} from '../ui';
import {RELEASES,SiteHeader,SiteFooter} from '../site-shell';
import './build-page.css';

const GOLDEN='Build an ESP32 room monitor with temperature/humidity and an OLED.';

/** The local API is unreachable or not authorised (web build without the desktop/local server). */
const sessionUnavailable=(message:string)=>/Local session unavailable|Workspace publik belum tersedia|Failed to fetch|NetworkError|Unexpected token|JSON/i.test(message);

/** Error notice for workspace API calls; explains the local/desktop requirement when the session is unavailable. */
export function ApiError({message}:{message:string}){
 const{tr}=useLang();
 if(sessionUnavailable(message))return <Notice tone="warn" className="bp-api-notice" title={tr('Local session unavailable','Sesi lokal tidak tersedia')} action={<AnchorButton href={RELEASES} size="sm" variant="secondary">{tr('Get the desktop app','Unduh aplikasi desktop')}</AnchorButton>}>{tr('The build workspace runs on your own machine. Start the iot.ai.id desktop app (or the local server) and reload this page to create and open projects.','Workspace build berjalan di komputermu sendiri. Jalankan aplikasi desktop iot.ai.id (atau server lokal), lalu muat ulang halaman ini untuk membuat dan membuka proyek.')}</Notice>;
 return <Notice tone="error" title={tr('Something went wrong','Terjadi kesalahan')}>{message}</Notice>;
}

const statusTone=(status:string):'ok'|'error'|'neutral'=>status.includes('physical_verified')?'ok':/fail|error|blocked/.test(status)?'error':'neutral';

function PromptBox({compact=false}:{compact?:boolean}){
 const{tr}=useLang();
 const[goal,setGoal]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('');const navigate=useNavigate();
 async function submit(event:React.FormEvent){event.preventDefault();setLoading(true);setError('');try{const p=await post('/projects',{goal:goal.trim()||GOLDEN,entryPoint:'build'});navigate('/project/'+p.id);}catch(e){setError(String((e as Error).message));setLoading(false);}}
 const id=compact?'workspace-goal':'hero-goal';
 return <form className={'bp-composer'+(compact?' bp-composer--compact':'')} onSubmit={submit} aria-busy={loading||undefined}>
  <div className="bp-composer-head"><label htmlFor={id}>{tr('Describe your build','Jelaskan rancanganmu')}</label><span aria-hidden="true">ESP32 / V1</span></div>
  <textarea id={id} className="bp-composer-input" value={goal} onChange={e=>setGoal(e.target.value)} placeholder={tr('Build an ESP32 room monitor with temperature, humidity and an OLED…','Buat monitor ruangan ESP32 dengan suhu, kelembapan, dan OLED…')} maxLength={2000} rows={compact?3:3} aria-describedby={`${id}-disclosure`}/>
  <div className="bp-composer-foot">
   <Button variant="ghost" size="sm" onClick={()=>setGoal(GOLDEN)}><PlusIcon aria-hidden="true"/> {tr('Use room monitor example','Pakai contoh monitor ruangan')}</Button>
   <Button type="submit" disabled={loading}>{loading?<><Spinner label={tr('Starting','Memulai')}/> {tr('Starting…','Memulai…')}</>:<>{tr('Build it','Bangun')} <ArrowUpRightIcon aria-hidden="true"/></>}</Button>
  </div>
  <p id={`${id}-disclosure`} className="bp-disclosure">{tr('AI assistance processes the build goal and machine evidence. Keep personal data out. Research reuse is separate and excluded by default.','Bantuan AI memproses tujuan build dan bukti mesin. Jangan masukkan data pribadi. Pemakaian ulang untuk riset terpisah dan tidak disertakan secara default.')}</p>
  {error&&<ApiError message={error}/>}
 </form>;
}

export function Build(){
 const{tr}=useLang();
 const[projects,setProjects]=useState<any[]>([]);const[error,setError]=useState('');
 useEffect(()=>{api('/projects').then(r=>setProjects(r.projects)).catch(e=>setError(e.message));},[]);
 return <div className="ds-app bp-app"><SiteHeader/>
  <main id="main" className="ds-page ds-page--narrow bp-page">
   <PageHeader className="bp-header" eyebrow={tr('Workspace / Build','Workspace / Bangun')} title={tr('What will you build?','Apa yang akan kamu bangun?')} lead={tr('Describe a device. Inspect the plan. Test what’s real.','Jelaskan perangkatnya. Periksa rencananya. Uji yang nyata.')}/>
   <PromptBox/>
   {error&&<div className="bp-list-error"><ApiError message={error}/></div>}
   <section className="bp-projects" aria-labelledby="bp-projects-title">
    <SectionHeader title={<span id="bp-projects-title">{tr('Workbench','Meja kerja')}</span>} aside={<Eyebrow as="span">{tr(`${projects.length} projects`,`${projects.length} proyek`)}</Eyebrow>}/>
    {projects.length?<ul className="bp-project-list">{projects.map(p=><li key={p.id}><Link className="bp-project" to={'/project/'+p.id}>
     <div className="bp-project-text"><strong>{p.title}</strong><p>{p.goal}</p></div>
     <Tag tone={statusTone(String(p.status))}>{String(p.status).replaceAll('_',' ')}</Tag>
     <ArrowRightIcon className="bp-project-arrow" aria-hidden="true"/>
    </Link></li>)}</ul>
    :!error&&<EmptyState eyebrow={tr('No projects yet','Belum ada proyek')} title={tr('Your first experiment starts with a prompt.','Eksperimen pertamamu dimulai dari sebuah prompt.')}>{tr('Describe a device above and inspect the generated plan before anything touches hardware.','Jelaskan perangkat di atas dan periksa rencana yang dihasilkan sebelum menyentuh hardware.')}</EmptyState>}
   </section>
  </main>
  <SiteFooter/></div>;
}
