import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {api,post} from './api';
import type {SiteView,SiteSnapshot} from '../../../packages/site-contract';
import {farmProfiles} from '../../../packages/application-catalog';
import {useLang} from './i18n';
import {Button,Eyebrow,IconButton,Input,Notice,Select,Spinner,Textarea,TextLink} from './ui';
import {ApiError} from './pages/build-page';
import './site-workbench.css';
export const siteIcons={field:'🌾',greenhouse:'🌿',building:'⌂',tank:'◉'};
export function siteSnapshot(site:SiteView):SiteSnapshot{return {name:site.name,areas:site.areas,devices:site.devices,links:site.links};}
type Workspace={site:SiteView;projects:any[];areaId?:string;activeDeviceId:string;selected:string;setSelected:(id:string)=>void;focus:(id:string)=>void;dirty:boolean;setDirty:(dirty:boolean)=>void;save:(next:SiteSnapshot)=>Promise<boolean>;saving:boolean;conflict:boolean;error:string;gesture:(working:boolean)=>void;reload:()=>void;refreshProjects:()=>Promise<void>};
const Context=createContext<Workspace|null>(null);
export function useSiteWorkspace(){return useContext(Context);}
export function SiteIntentChat(){
 const{tr}=useLang();
 const workspace=useSiteWorkspace()!;
 const [message,setMessage]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState('');
 const pendingRef=useRef(false);
 async function send(){
  if(pendingRef.current||workspace.saving||workspace.conflict||message.trim().length<8)return;
  pendingRef.current=true;setPending(true);setError('');workspace.gesture(true);
  try{
   const project=await post('/projects',{goal:message.trim(),entryPoint:'build'});
   const next=siteSnapshot(workspace.site),active=next.devices.find(d=>d.id===workspace.activeDeviceId);
   if(active)next.devices=next.devices.map(d=>d.id===active.id?{...d,projectId:project.id}:d);
   else{
    const areaId=next.areas[0]?.id??crypto.randomUUID();
    if(!next.areas.length)next.areas=[{id:areaId,name:'Area utama',icon:'building',position:{x:40,y:40}}];
    next.devices=[...next.devices,{id:crypto.randomUUID(),name:'Perangkat pertama',kind:'custom',areaId,required:true,projectId:project.id,position:{x:30,y:90}}];
   }
   if(!await workspace.save(next))throw new Error(tr(`Project ${project.id} was created but is not linked yet. Pick it from the Area panel.`,'Proyek '+project.id+' dibuat, tetapi belum tertaut. Pilih proyek tersebut melalui Area.'));
   await workspace.refreshProjects();workspace.reload();setMessage('');
  }catch(e){setError((e as Error).message);}finally{workspace.gesture(false);pendingRef.current=false;setPending(false);}
 }
 const disabled=pending||workspace.saving||workspace.conflict||message.trim().length<8;
 return <section className="hardware-chat swk-chat">
  <Eyebrow>{tr('AI hardware engineer','AI hardware engineer')}</Eyebrow>
  <h2>{tr('Tell us about your device.','Ceritakan perangkatmu.')}</h2>
  <div className="chat-history"><p>{tr('This canvas can hold several areas and devices. Start with one device, then add areas from the toolbar.','Canvas ini bisa menampung beberapa area dan perangkat. Mulai dengan satu perangkat, lalu tambahkan area melalui toolbar.')}</p></div>
  <form onSubmit={e=>{e.preventDefault();void send();}}>
   <Textarea id="site-intent" label={tr('Message for the hardware engineer','Pesan untuk hardware engineer')} hint={tr('Designs we do not support yet stay as planning drafts.','Rancangan yang belum didukung tetap menjadi draft perencanaan.')} value={message} onChange={e=>setMessage(e.target.value)} maxLength={2000} rows={4} placeholder={tr('Build an ESP32 temperature monitor with a BME280 and an OLED.','Buat monitor suhu ESP32 dengan BME280 dan OLED.')}/>
   <Button type="submit" disabled={disabled}>{pending?<><Spinner label={tr('Drafting','Menyusun')}/> {tr('Drafting the design…','Menyusun rancangan…')}</>:tr('Send message','Kirim pesan')}</Button>
   {error&&<Notice tone="error">{error}</Notice>}
  </form>
 </section>;
}
export function SiteWorkspace({siteId,areaId,initialProjectId,children}:{siteId:string;areaId?:string;initialProjectId?:string;children:(projectId:string|null)=>ReactNode}){
 const{tr}=useLang();
 const [site,setSite]=useState<SiteView>(),[projects,setProjects]=useState<any[]>([]),[activeDeviceId,setActive]=useState(''),[selected,setSelected]=useState(''),[dirty,setDirty]=useState(false),[saving,setSaving]=useState(false),[conflict,setConflict]=useState(false),[error,setError]=useState(''),[reloadKey,setReload]=useState(0);
 const liveSite=useRef<SiteView|undefined>(undefined),working=useRef(false),writing=useRef(false),conflicted=useRef(false),dirtyRef=useRef(false);
 useEffect(()=>{dirtyRef.current=dirty;},[dirty]);
 async function refreshProjects(){const list=await api('/projects');const linked=new Set(liveSite.current?.devices.map(d=>d.projectId).filter(Boolean));const full=await Promise.all(list.projects.map((p:any)=>linked.has(p.id)?api('/projects/'+p.id):Promise.resolve(p)));setProjects(full);}
 useEffect(()=>{let live=true;const load=async()=>{try{const s=await api<SiteView>('/sites/'+siteId);if(!live||dirtyRef.current||working.current||writing.current||conflicted.current||liveSite.current&&s.revision<liveSite.current.revision)return;liveSite.current=s;setSite(s);setActive(old=>s.devices.some(d=>d.id===old)?old:(s.devices.find(d=>d.projectId===initialProjectId)?.id??s.devices.find(d=>(!areaId||d.areaId===areaId)&&d.projectId)?.id??s.devices.find(d=>!areaId||d.areaId===areaId)?.id??''));}catch(e){if(live)setError((e as Error).message);}};void load();const timer=setInterval(load,3000);return()=>{live=false;clearInterval(timer);};},[siteId,areaId,initialProjectId,reloadKey]);
 useEffect(()=>{let live=true;const load=async()=>{try{const list=await api('/projects');const linked=new Set(liveSite.current?.devices.map(d=>d.projectId).filter(Boolean));const full=await Promise.all(list.projects.map((p:any)=>linked.has(p.id)?api('/projects/'+p.id):Promise.resolve(p)));if(live)setProjects(full);}catch(e){if(live)setError((e as Error).message);}};void load();const timer=setInterval(load,3000);return()=>{live=false;clearInterval(timer);};},[siteId,site?.revision]);
 async function save(next:SiteSnapshot){const current=liveSite.current;if(!current||writing.current||conflicted.current||dirtyRef.current){working.current=false;return false;}writing.current=true;setSaving(true);setError('');try{const result=await api<SiteView>('/sites/'+siteId,{method:'PUT',body:JSON.stringify({expectedRevision:site!.revision,snapshot:next})});liveSite.current=result;setSite(result);setActive(old=>result.devices.some(d=>d.id===old)?old:(result.devices.find(d=>(!areaId||d.areaId===areaId)&&d.projectId)?.id??result.devices.find(d=>!areaId||d.areaId===areaId)?.id??''));setSelected(old=>result.areas.some(a=>a.id===old)||result.devices.some(d=>d.id===old)||result.links.some(l=>l.id===old)?old:'');return true;}catch(e){const message=(e as Error).message;if(message.includes('revision conflict')){conflicted.current=true;setConflict(true);}setError(message+tr(' · Changes not saved. Reload to get the latest revision.',' · Perubahan belum disimpan. Muat ulang untuk revisi terbaru.'));return false;}finally{working.current=false;writing.current=false;setSaving(false);}}
 function focus(id:string){if(dirtyRef.current){setError(tr('Apply or discard the wiring edit before choosing another device.','Apply wiring atau Buang edit sebelum memilih perangkat lain.'));return;}if(writing.current)return;setActive(id);setSelected(id);setError('');}
 function reload(){if(dirtyRef.current){setError(tr('Apply or discard the wiring edit before reloading.','Apply wiring atau Buang edit sebelum memuat ulang.'));return;}conflicted.current=false;setConflict(false);working.current=false;liveSite.current=undefined;setError('');setReload(k=>k+1);}
 if(!site)return <main className="swk-loading">{error?<div className="swk-loading-error"><ApiError message={error}/><TextLink to="/sites">{tr('Back to sites','Kembali ke lokasi')}</TextLink></div>:<p><Spinner label={tr('Loading','Memuat')}/> <span>{tr('Loading workbench…','Memuat meja kerja…')}</span></p>}</main>;
 const active=site.devices.find(d=>d.id===activeDeviceId);
 return <Context.Provider value={{site,projects,areaId,activeDeviceId,selected,setSelected,focus,dirty,setDirty:value=>{dirtyRef.current=value;setDirty(value);},save,saving,conflict,error,gesture:value=>{working.current=value;},reload,refreshProjects}}>{children(active?.projectId??null)}</Context.Provider>;
}
export function SiteDrawer({onClose}:{onClose:()=>void}){
 const{tr}=useLang();
 const workspace=useSiteWorkspace()!;const {site,projects,selected,save,saving,conflict,dirty}=workspace;
 const [areaName,setAreaName]=useState(''),[areaIcon,setAreaIcon]=useState<keyof typeof siteIcons>('field'),[deviceName,setDeviceName]=useState(''),[deviceArea,setDeviceArea]=useState(''),[kind,setKind]=useState<any>('environment'),[projectId,setProjectId]=useState(''),[required,setRequired]=useState(true),[source,setSource]=useState(''),[target,setTarget]=useState(''),[linkKind,setLinkKind]=useState<any>('wifi'),[intent,setIntent]=useState(''),[creating,setCreating]=useState(false),[createError,setCreateError]=useState('');
 const creatingRef=useRef(false);
 const area=site.areas.find(a=>a.id===selected),device=site.devices.find(d=>d.id===selected),link=site.links.find(l=>l.id===selected),blocked=saving||conflict||dirty||creating;
 const changeDevice=(patch:Partial<SiteSnapshot['devices'][number]>)=>save({...siteSnapshot(site),devices:site.devices.map(d=>d.id===selected?{...d,...patch}:d)});
 async function createProject(){if(!device||blocked||creatingRef.current||intent.trim().length<8)return;creatingRef.current=true;workspace.gesture(true);setCreating(true);setCreateError('');try{const p=await post('/projects',{goal:intent,entryPoint:'build'});if(!await changeDevice({projectId:p.id}))setCreateError(tr(`Project ${p.id} was created, but linking failed. Pick it from the list after reloading.`,'Proyek '+p.id+' dibuat, tetapi penautan gagal. Pilih dari daftar setelah memuat ulang.'));await workspace.refreshProjects();}catch(e){setCreateError((e as Error).message);}finally{creatingRef.current=false;workspace.gesture(false);setCreating(false);}}
 return <aside className="flow-site-drawer swk-drawer" aria-label={tr('Sites & areas','Lokasi & area')}>
  <IconButton className="flow-close swk-close" onClick={onClose} label={tr('Close areas','Tutup area')}>×</IconButton>
  <header className="swk-drawer-head">
   <Eyebrow>{site.name} · {tr('revision','revisi')} {site.revision}</Eyebrow>
   <h2>{tr('Sites & areas','Lokasi & area')}</h2>
   <div className="swk-row">
    <Button size="sm" variant="secondary" disabled={blocked} onClick={()=>{let x=40;const areas=site.areas.map(a=>{const width=Math.max(1100,...site.devices.filter(d=>d.areaId===a.id).map(d=>d.position.x+980));const next={...a,position:{x,y:40}};x+=width+100;return next;});void save({...siteSnapshot(site),areas});}}>{tr('Tidy areas','Rapikan area')}</Button>
    <Button size="sm" variant="secondary" disabled={blocked} onClick={()=>save({...siteSnapshot(site),devices:site.devices.map(d=>({...d,position:{x:30+site.devices.filter(other=>other.areaId===d.areaId).findIndex(other=>other.id===d.id)*950,y:90}}))})}>{tr('Tidy devices','Rapikan perangkat')}</Button>
    <Button size="sm" variant="ghost" disabled={saving||dirty} onClick={workspace.reload}>{tr('Reload','Muat ulang')}</Button>
   </div>
  </header>
  {workspace.error&&<Notice tone="error">{workspace.error}</Notice>}
  {createError&&<Notice tone="error">{createError}</Notice>}
  <fieldset disabled={blocked}>
   <section className="site-device-list swk-section">
    <h3>{tr('Areas & devices','Area & perangkat')}</h3>
    {site.areas.map(a=><article key={a.id} className="swk-tree">
     <button type="button" className="swk-tree-area" aria-pressed={selected===a.id} onClick={()=>workspace.setSelected(a.id)}>{siteIcons[a.icon]} {a.name}</button>
     {site.devices.filter(d=>d.areaId===a.id).map(d=><div key={d.id} className="swk-tree-device">
      <button type="button" className="swk-tree-item" aria-pressed={selected===d.id} onClick={()=>workspace.setSelected(d.id)}>{d.name} · {site.deviceStatuses[d.id]}</button>
      <button type="button" className="swk-tree-focus" onClick={()=>workspace.focus(d.id)} aria-pressed={workspace.activeDeviceId===d.id}>{tr(`Focus ${d.name}`,`Fokus ${d.name}`)}</button>
     </div>)}
    </article>)}
   </section>
   {area?<section className="swk-section">
    <h3>{tr('Area inspector','Inspector area')}</h3>
    <Input id="swk-area-name" label={tr('Area name','Nama area')} key={area.id+area.name} defaultValue={area.name} onBlur={e=>{if(e.target.value!==area.name)void save({...siteSnapshot(site),areas:site.areas.map(a=>a.id===selected?{...a,name:e.target.value}:a)});}}/>
    <Select id="swk-area-icon" label={tr('Area icon','Ikon area')} value={area.icon} onChange={e=>save({...siteSnapshot(site),areas:site.areas.map(a=>a.id===selected?{...a,icon:e.target.value as any}:a)})}>{Object.keys(siteIcons).map(k=><option key={k}>{k}</option>)}</Select>
    <Button size="sm" variant="secondary" disabled={site.devices.some(d=>d.areaId===area.id)} onClick={()=>save({...siteSnapshot(site),areas:site.areas.filter(a=>a.id!==selected)})}>{tr('Delete empty area','Hapus area kosong')}</Button>
   </section>:device?<section className="swk-section">
    <h3>{tr('Device inspector','Inspector perangkat')}</h3>
    <Input id="swk-device-name" label={tr('Device name','Nama perangkat')} key={device.id+device.name} defaultValue={device.name} onBlur={e=>{if(e.target.value!==device.name)void changeDevice({name:e.target.value});}}/>
    <Select id="swk-device-area" label={tr('Device area','Area perangkat')} value={device.areaId} onChange={e=>changeDevice({areaId:e.target.value,position:{x:30,y:90}})}>{site.areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</Select>
    <Select id="swk-device-kind" label={tr('Requirement type','Jenis kebutuhan')} value={device.kind} onChange={e=>changeDevice({kind:e.target.value as any})}>{farmProfiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}<option value="custom">{tr('Other','Lainnya')}</option></Select>
    <label className="swk-check"><input type="checkbox" checked={device.required} onChange={e=>changeDevice({required:e.target.checked})}/> {tr('Required for area verification','Wajib untuk verifikasi area')}</label>
    <Select id="swk-device-project" label={tr('Wiring project','Proyek wiring')} value={device.projectId??''} onChange={e=>changeDevice({projectId:e.target.value||null})}><option value="">{tr('Planning only, no project','Perencanaan tanpa proyek')}</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</Select>
    <Button size="sm" variant="secondary" onClick={()=>workspace.focus(device.id)}>{tr('Focus device','Fokus perangkat')}</Button>
    <Textarea id="swk-device-intent" label={tr('New project intent','Intent proyek baru')} value={intent} onChange={e=>setIntent(e.target.value)} maxLength={2000} placeholder={farmProfiles.find(p=>p.id===device.kind)?.goal}/>
    <Button size="sm" disabled={intent.trim().length<8} onClick={createProject}>{creating&&<Spinner label={tr('Creating','Membuat')}/>}{tr('Create project from intent & link','Buat proyek dari intent & tautkan')}</Button>
    <Button size="sm" variant="ghost" onClick={()=>save({...siteSnapshot(site),devices:site.devices.filter(d=>d.id!==selected),links:site.links.filter(l=>l.source!==selected&&l.target!==selected)})}>{tr('Remove device from location','Lepas perangkat dari lokasi')}</Button>
   </section>:link?<section className="swk-section">
    <h3>{tr('Logical connection','Koneksi logis')}</h3>
    <p>{link.kind.toUpperCase()} · {tr('declared, not yet verified','deklarasi belum terverifikasi')}</p>
    <Button size="sm" variant="secondary" onClick={()=>save({...siteSnapshot(site),links:site.links.filter(l=>l.id!==selected)})}>{tr('Delete declaration','Hapus deklarasi')}</Button>
   </section>:<p className="swk-muted">{tr('Select an area or device on the canvas.','Pilih area atau perangkat pada canvas.')}</p>}
   {(area||device)&&<form key={selected} className="swk-section" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget),position={x:Number(data.get('x')),y:Number(data.get('y'))};if(device)void changeDevice({position});else void save({...siteSnapshot(site),areas:site.areas.map(a=>a.id===selected?{...a,position}:a)});}}>
    <h3>{tr('Position · keyboard','Posisi · keyboard')}</h3>
    <div className="swk-pair"><Input id="swk-pos-x" label="X" name="x" type="number" min="-10000" max="10000" defaultValue={(area??device)!.position.x}/><Input id="swk-pos-y" label="Y" name="y" type="number" min="-10000" max="10000" defaultValue={(area??device)!.position.y}/></div>
    <Button type="submit" size="sm" variant="secondary">{tr('Save position','Simpan posisi')}</Button>
   </form>}
   <form className="swk-section" onSubmit={async e=>{e.preventDefault();if(await save({...siteSnapshot(site),areas:[...site.areas,{id:crypto.randomUUID(),name:areaName,icon:areaIcon,position:{x:site.areas.length*1200,y:40}}]}))setAreaName('');}}>
    <Input id="swk-site-rename" label={tr('Location name','Nama lokasi')} key={site.name} defaultValue={site.name} maxLength={100} onBlur={e=>{if(e.target.value!==site.name)void save({...siteSnapshot(site),name:e.target.value});}}/>
    <h3>{tr('Add area','Tambah area')}</h3>
    <Input id="swk-new-area" label={tr('New area name','Nama area baru')} required value={areaName} onChange={e=>setAreaName(e.target.value)} maxLength={100}/>
    <Select id="swk-new-area-icon" label={tr('Icon','Ikon')} value={areaIcon} onChange={e=>setAreaIcon(e.target.value as keyof typeof siteIcons)}>{Object.keys(siteIcons).map(k=><option key={k}>{k}</option>)}</Select>
    <Button type="submit" size="sm">{tr('Add area','Tambah area')}</Button>
   </form>
   <form className="swk-section" onSubmit={async e=>{e.preventDefault();const areaId=deviceArea||site.areas[0]?.id;if(!areaId)return;if(await save({...siteSnapshot(site),devices:[...site.devices,{id:crypto.randomUUID(),name:deviceName,kind,areaId,required,projectId:projectId||null,position:{x:30+site.devices.filter(d=>d.areaId===areaId).length*950,y:90}}]}))setDeviceName('');}}>
    <h3>{tr('Add device','Tambah perangkat')}</h3>
    <Input id="swk-new-device" label={tr('New device name','Nama perangkat baru')} required value={deviceName} onChange={e=>setDeviceName(e.target.value)} maxLength={100}/>
    <Select id="swk-new-device-area" label={tr('Area for new device','Area baru')} value={deviceArea||site.areas[0]?.id||''} onChange={e=>setDeviceArea(e.target.value)}>{!site.areas.length&&<option value="">{tr('Choose an area','Pilih area')}</option>}{site.areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</Select>
    <Select id="swk-new-device-kind" label={tr('Requirement','Kebutuhan')} value={kind} onChange={e=>setKind(e.target.value)}>{farmProfiles.map(p=><option key={p.id} value={p.id}>{p.name} · {tr('planning','perencanaan')}</option>)}<option value="custom">{tr('Other','Lainnya')}</option></Select>
    <p className="swk-muted">{farmProfiles.find(p=>p.id===kind)?.needs}</p>
    <Select id="swk-new-device-project" label={tr('Linked project','Proyek yang ditautkan')} value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">{tr('No project · planning','Tanpa proyek · perencanaan')}</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</Select>
    <label className="swk-check"><input type="checkbox" checked={required} onChange={e=>setRequired(e.target.checked)}/> {tr('Required device','Perangkat wajib')}</label>
    <Button type="submit" size="sm" disabled={!site.areas.length}>{tr('Add device','Tambah perangkat')}</Button>
   </form>
   <form className="swk-section" onSubmit={e=>{e.preventDefault();void save({...siteSnapshot(site),links:[...site.links,{id:crypto.randomUUID(),source,target,kind:linkKind,status:'declared_unverified'}]});}}>
    <h3>{tr('Network declaration','Deklarasi jaringan')}</h3>
    <Select id="swk-link-source" label={tr('From','Dari')} required value={source} onChange={e=>setSource(e.target.value)}><option value="">{tr('Choose a device','Pilih perangkat')}</option>{site.devices.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</Select>
    <Select id="swk-link-target" label={tr('To','Ke')} required value={target} onChange={e=>setTarget(e.target.value)}><option value="">{tr('Choose a device','Pilih perangkat')}</option>{site.devices.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</Select>
    <Select id="swk-link-kind" label={tr('Protocol','Protokol')} value={linkKind} onChange={e=>setLinkKind(e.target.value)}>{['wifi','mqtt','ethernet','lora'].map(k=><option key={k}>{k}</option>)}</Select>
    <Button type="submit" size="sm" variant="secondary">{tr('Add declaration','Tambah deklarasi')}</Button>
    <small className="swk-muted">{tr('Network lines are declarations, not proof. GPIO wires stay inside a single device.','Garis jaringan adalah deklarasi, belum terbukti. Kabel GPIO hanya di dalam satu perangkat.')}</small>
   </form>
  </fieldset>
 </aside>;
}
