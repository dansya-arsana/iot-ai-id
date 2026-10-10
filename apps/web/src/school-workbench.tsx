import {approvalPending} from '../../../packages/job-protocol/approval';
import {lazy,Suspense,useCallback,useEffect,useRef, useState} from 'react';
import {Link, useParams,useSearchParams} from 'react-router-dom';
import {api, post} from './api';
const HardwareFlow=lazy(()=>import('./hardware-flow').then(module=>({default:module.HardwareFlow})));
import './school-workbench.css';
import {HardwareChat} from './hardware-chat';
import {currentRun} from './workbench-state';
import {SiteWorkspace,useSiteWorkspace,SiteIntentChat} from './site-workspace';
import {useLang} from './i18n';
import {Brand,RELEASES} from './site-shell';
import {Button,CodeBlock,EmptyState,Eyebrow,IconButton,LangToggle,LinkButton,Notice,Select,Spinner,Tag,Textarea} from './ui';
import {ArrowUpRightIcon,ChatCircleTextIcon,CheckIcon,CopyIcon,DownloadSimpleIcon,PlayIcon,PulseIcon,WarningIcon,XIcon} from '@phosphor-icons/react';

const checks: Record<string, [string, string]> = {board_detected:['Board detected','Board terdeteksi'], compiled:['Firmware compiled','Firmware dikompilasi'], flashed:['Firmware flashed','Firmware diunggah'], device_addresses:['I2C addresses detected','Alamat I2C terdeteksi'], sensor_readings:['Readings within range','Pembacaan dalam rentang'], oled_initialized:['OLED initialised + ACK','OLED diinisialisasi + ACK'], button_input:['Button input read','Input tombol terbaca'], output_commanded:['Output command sent','Perintah output dikirim'], behavior_sequence:['Press-release sequence complete','Urutan tekan-lepas lengkap']};
/** Runtime fallback message set before translation is available; mapped to the active language at render. */
const USB_UNAVAILABLE='Runtime USB tidak tersedia.';

/** Publishes the height of the floating workbench chrome so panels start below it while the canvas stays full-viewport. */
function useChromeHeight(){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const root=ref.current;if(!root)return;
    const measure=()=>{let h=0;for(const el of root.querySelectorAll<HTMLElement>(':scope>.wb-bar,:scope>.wb-subbar,:scope>.wb-notices'))h+=el.offsetHeight;root.style.setProperty('--wb-chrome-h',h+'px');};
    const observer=new ResizeObserver(measure);for(const el of root.children)observer.observe(el);measure();
    const mutations=new MutationObserver(()=>{observer.disconnect();for(const el of root.children)observer.observe(el);measure();});mutations.observe(root,{childList:true});
    return()=>{observer.disconnect();mutations.disconnect();};
  },[]);
  return ref;
}
export function SchoolWorkbench({projectId}:{projectId?:string|null}={}){const {id}=useParams();const [query]=useSearchParams();const site=useSiteWorkspace();if(!site&&query.get('site'))return <SiteWorkspace siteId={query.get('site')!} initialProjectId={id}>{active=><ProjectWorkbench key={active??'planning'} projectId={active}/>}</SiteWorkspace>;return <ProjectWorkbench key={projectId??id??'planning'} projectId={projectId===undefined?id:projectId}/>;}
function ProjectWorkbench({projectId}:{projectId?:string|null}) {
  const chromeRef=useChromeHeight();
  const id=projectId,siteWorkspace=useSiteWorkspace();
  const {tr}=useLang();
  const cloudWorkspace=window.location.hostname==='iot.ai.id'||window.location.hostname.endsWith('.iot.ai.id');
  const [storedProject, setProject] = useState<any>();
  const project=storedProject??(!id&&siteWorkspace?{id:'planning:'+siteWorkspace.site.id,title:siteWorkspace.site.name,goal:tr('Choose a device or add a project intent through Area.','Pilih perangkat atau tambahkan intent proyek melalui Area.'),contracts:[],firmwareArtifacts:[],experiments:[],verifications:[],observations:[],repairs:[],status:'clarification'}:undefined);
  const [catalog,setCatalog]=useState<any[]>([]);
  const [status, setStatus] = useState<any>();
  const [scanningUSB,setScanningUSB]=useState(false);
  const [usbError,setUSBError]=useState('');
  const usbRequest=useRef(0),selectedPort=useRef('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('Desain');
  const [wiringDirty,setWiringDirty]=useState(false);
  const [chatOpen,setChatOpen]=useState(false);
  const [runtimeOpen,setRuntimeOpen]=useState(false);
  const [mode, setMode] = useState<'simulation' | 'physical'>('simulation');
  const [port, setPort] = useState('');
  const [trustedPort, setTrustedPort] = useState('');
  const [busy, setBusy] = useState(false);
  const [remoteJobs, setRemoteJobs] = useState<any[]>([]);
  const [challengeProgress, setChallengeProgress] = useState<any>();
  const [nowTs, setNowTs] = useState(()=>Date.now());
  const [confirmation, setConfirmation] = useState('');
  const [completed, setCompleted] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState('');
  const [noteProvenance, setNoteProvenance] = useState('human_reported');
  const [noteStatus, setNoteStatus] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  useEffect(()=>{const timer=setInterval(()=>setNowTs(Date.now()),1000);return()=>clearInterval(timer);},[]);
  useEffect(() => {
    if(!id)return;
    let live = true;
    const refresh = () => Promise.all([api('/projects/' + id), api('/remote-jobs')]).then(([p, r]) => {if (live) {setProject(p); setRemoteJobs(r.jobs ?? []); setNowTs(Date.now());}}).catch(e => {if (live) setError(e.message);});
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => {live = false; clearInterval(timer);};
  }, [id]);
  const scanUSB=useCallback(async()=>{
    const request=++usbRequest.current;
    setScanningUSB(true);setUSBError('');
    try{const next=await api('/status');if(request!==usbRequest.current)return;setStatus(next);
      if(selectedPort.current&&!(next.runtime?.devices??[]).some((device:any)=>device.candidate&&device.port===selectedPort.current)){
        selectedPort.current='';setPort('');setTrustedPort('');setConfirmation('');
      }
      if(next.runtime?.available===false)setUSBError(next.runtime.error??USB_UNAVAILABLE);
    }catch(error){if(request===usbRequest.current){setUSBError((error as Error).message);setTrustedPort('');}}
    finally{if(request===usbRequest.current)setScanningUSB(false);}
  },[]);
  useEffect(()=>{
    const requests=usbRequest;
    const timer=project?.busy?undefined:setTimeout(()=>{void scanUSB();},0);
    return()=>{clearTimeout(timer);requests.current++;};
  },[project?.busy,runtimeOpen,mode,scanUSB]);
  useEffect(()=>{api('/hardware').then(data=>setCatalog(data.components)).catch(()=>{});},[]);
  useEffect(() => {
    if (!project?.challengeId) return;
    let live = true;
    const load = () => api('/projects/' + id + '/challenge').then(c => {if (live) setChallengeProgress(c);}).catch(() => {});
    load();
    const timer = setInterval(load, 2000);
    return () => {live = false; clearInterval(timer);};
  }, [id, project?.challengeId]);
  async function refreshProject(){if(id)setProject(await api('/projects/'+id));}
  const version = project?.contracts.find((c: any) => c.id === project.contractId);
  const contract = version?.contract;
  const lessons=contract?.recipe?.id==='esp32-button-led'?[tr('Identify the button and the LED indicator','Kenali tombol dan indikator LED'),tr('Read the GPIO27 input and GPIO26 output','Baca input GPIO27 dan output GPIO26'),tr('Check the 10kΩ pull-up and 330Ω series resistor','Periksa pull-up 10kΩ dan resistor seri 330Ω')]:[tr('Learn what each of the three parts does','Kenali fungsi ketiga komponen'),tr('Trace the SDA and SCL connections','Baca sambungan SDA dan SCL'),tr('Check 3.3V and the shared ground','Periksa 3.3V dan ground bersama')];
  const draftBlocked=!!project?.activeDesign&&project.activeDesign.status!=='executable';
  const run = project ? currentRun(project) : {experiment: undefined, verification: undefined, observations: [], repair: undefined};
  const {experiment, verification, observations, repair} = run;
  const operationBusy = busy || project?.busy;
  const runtimeError = experiment?.status === 'ERROR' ? experiment.error ?? tr('The device operation stopped without a verification result.','Operasi perangkat berhenti tanpa hasil verifikasi.') : '';
  const unsuccessful = ['FAILED', 'ERROR'].includes(experiment?.status);
  const trusted = !!port && trustedPort === port;
  const remoteApproval = remoteJobs.find((j: any) => approvalPending(j,nowTs) && j.input.projectId === id);
  const remoteApprovable = !!remoteApproval && (remoteApproval.input.operation !== 'physical' || (trusted && port === remoteApproval.input.deviceId));
  const remoteSecondsLeft = remoteApproval && nowTs ? Math.max(0, Math.round((remoteApproval.input.expiresAt - nowTs) / 1000)) : 0;
  const ready = !!version?.validation.valid && !draftBlocked && !operationBusy && !wiringDirty && (mode === 'simulation' || (trusted && status?.runtime.toolchain && !scanningUSB && !usbError));
  const confirmationKey = `${experiment?.id}:${mode}`;
  const confirmed = confirmation === confirmationKey;
  const retryReady = ready && confirmed && experiment?.status === 'FAILED' && experiment?.mode === mode && (mode === 'simulation' || repair?.retryAllowed);
  const firmware = project?.firmwareArtifacts.filter((f:any)=>f.contractHash===version?.hash).at(-1);
  async function execute(fault: 'none' | 'sda' = 'none', retry = false) {
    if (!ready || (retry && !retryReady) || (fault === 'sda' && mode !== 'simulation')) return;
    setBusy(true); setError(''); setConfirmation(''); setTab('Uji');
    try {await post(`/projects/${id}/${retry ? 'retry' : 'run'}`, {mode, fault, port, parentId:retry ? experiment.id : undefined, repairConfirmed:retry ? true : undefined}); setProject(await api('/projects/' + id));}
    catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  async function authorize() {setBusy(true); setError(''); try {await post('/runtime/trust', {port, authorize:true}); setTrustedPort(port);} catch (e) {setError((e as Error).message);} finally {setBusy(false);}}
  async function approveRemoteJob() {
    if (!remoteApproval || !approvalPending(remoteApproval) || !remoteApprovable || operationBusy || wiringDirty) return;
    setBusy(true); setError('');
    try {await post('/remote-jobs/' + remoteApproval.id + '/approve', {authorize:true, port: remoteApproval.input.operation === 'physical' ? port : undefined});}
    catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  async function saveNote() {
    if (!note.trim() || savingNote) return;
    setSavingNote(true); setNoteStatus('');
    try {await post(`/projects/${id}/actions`, {actionType:'note', description:note.trim(), provenance:noteProvenance, experimentId:experiment?.id, contractId:version?.id}); setNote(''); setNoteStatus(tr('Note saved to the local episode.','Catatan tersimpan dalam episode lokal.'));}
    catch (e) {setNoteStatus((e as Error).message);} finally {setSavingNote(false);}
  }
  function changeMode(next: 'simulation' | 'physical') {setMode(next); setConfirmation('');}
  function download() {const url = URL.createObjectURL(new Blob([firmware.source], {type:'text/plain'})); const anchor = document.createElement('a'); anchor.href = url; anchor.download = (contract?.recipe?.id==='esp32-button-led'?'button_led':'room_monitor')+'.ino'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);}
  const nextStep = operationBusy ? tr('The experiment is running. Wait for the latest evidence.','Eksperimen sedang berjalan. Tunggu bukti terbaru.') : runtimeError ? tr('Test stopped. Read the error, check the USB connection and runtime, then try again.','Uji terhenti. Baca pesan kesalahan, periksa sambungan USB dan runtime, lalu coba lagi.') : experiment?.status === 'FAILED' ? tr('Read the mismatch, review the diagnosis, then confirm the repair.','Baca ketidaksesuaian, periksa diagnosis, lalu konfirmasi perbaikan.') : verification?.passed ? tr('Read each check result. Try a controlled failure to practise recovery.','Baca hasil tiap pemeriksaan. Coba kegagalan terkontrol untuk belajar pemulihan.') : mode === 'physical' && !trusted ? tr('Choose a USB device and authorize it before flashing firmware.','Pilih perangkat USB dan beri izin sebelum mengunggah firmware.') : tr('Get to know the parts, follow the wiring guide, then run the experiment.','Kenali komponen, ikuti panduan kabel, lalu jalankan eksperimen.');
  const statusText = operationBusy ? tr('Working','Sedang bekerja') : verification?.passed ? verification.physical ? tr('Physically verified','Terverifikasi fisik') : tr('Practice passed','Latihan lolos') : unsuccessful ? tr('Needs checking','Perlu diperiksa') : tr('Ready to learn','Siap belajar');
  const statusTone = operationBusy ? 'neutral' : verification?.passed ? 'ok' : unsuccessful ? 'warn' : 'neutral';
  const challengeActive = !!(project?.challengeId && challengeProgress && challengeProgress.challenge.id === project.challengeId);
  const tabLabels: Record<string, string> = {Desain:tr('Design','Desain'), Kode:tr('Code','Kode'), Uji:tr('Test','Uji')};
  const firmwareName = contract?.recipe?.id==='esp32-button-led'?'button_led.ino':'room_monitor.ino';
  const onDirtyChange = (dirty: boolean) => {setWiringDirty(dirty); siteWorkspace?.setDirty(dirty);};
  const canvasFallback = <div className="wb-canvas-loading"><Spinner label={tr('Loading canvas','Memuat canvas')}/><span>{tr('Loading canvas…','Memuat canvas…')}</span></div>;
  return <div className="wb" ref={chromeRef}>
    <header className="wb-bar">
      <div className="wb-bar-brand"><Brand wordmark={false}/><nav className="wb-bar-nav" aria-label={tr('Workspace navigation','Navigasi ruang kerja')}><Link to="/build">{tr('Projects','Proyek')}</Link><Link to="/docs">{tr('Guides','Panduan')}</Link></nav></div>
      <div className="wb-bar-title">
        <Eyebrow as="span" className="wb-bar-eyebrow">{tr('Workbench','Meja kerja')} / {siteWorkspace?.site.name??'ESP32'}</Eyebrow>
        <div className="wb-bar-heading"><h1>{project?.title ?? tr('Opening workspace…','Membuka ruang kerja…')}</h1><span className="school-status" role="status"><Tag tone={statusTone}>{statusText}</Tag></span></div>
        {project?.goal && <p className="wb-bar-goal">{project.goal}</p>}
      </div>
      <div className="wb-bar-actions">
        <Button size="sm" variant={chatOpen?'primary':'secondary'} className="chat-toggle" onClick={()=>setChatOpen(!chatOpen)} aria-expanded={chatOpen} aria-controls="workbench-chat"><ChatCircleTextIcon aria-hidden="true"/>{chatOpen?tr('Close chat','Tutup chat'):tr('Open chat','Buka chat')}</Button>
        <Button size="sm" variant={runtimeOpen?'primary':'secondary'} className="runtime-toggle" onClick={()=>setRuntimeOpen(!runtimeOpen)} aria-expanded={runtimeOpen} aria-controls="workbench-runtime"><PulseIcon aria-hidden="true"/>{tr('Runtime & evidence','Runtime & bukti')}</Button>
        <LinkButton size="sm" variant="ghost" className="school-episode" to={`/project/${id}/episode`} aria-label={tr('Open episode','Buka episode')}><span className="wb-hide-sm">Episode</span><ArrowUpRightIcon aria-hidden="true"/></LinkButton>
        <span className="wb-lang"><LangToggle/></span>
      </div>
    </header>
    {contract && <div className="wb-subbar">
      <div className="school-tabbar">
        <div className="wb-tabs" role="tablist" aria-label={tr('Project views','Tampilan proyek')}>{['Desain','Kode','Uji'].map(t => <button type="button" role="tab" id={`school-tab-${t}`} aria-controls="school-view" aria-selected={tab === t} tabIndex={tab === t ? 0 : -1} onKeyDown={e => {const tabs = ['Desain','Kode','Uji']; const index = tabs.indexOf(t); const next = e.key === 'ArrowRight' ? tabs[(index + 1) % 3] : e.key === 'ArrowLeft' ? tabs[(index + 2) % 3] : e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[2] : undefined; if (next) {e.preventDefault(); setTab(next); document.getElementById(`school-tab-${next}`)?.focus();}}} key={t} onClick={() => setTab(t)}>{tabLabels[t]}</button>)}</div>
        <span className="wb-revision">{tr('Revision','Revisi')} {version.version}</span>
      </div>
      <div className="school-run">
        <div className="wb-run-copy"><strong>{mode === 'physical' ? tr('Local device','Perangkat lokal') : tr('Model practice','Latihan model')}</strong><small>{operationBusy ? tr('Wait for the operation to finish.','Tunggu operasi selesai.') : wiringDirty ? tr('Apply or discard wiring edits before Run.','Terapkan atau buang edit kabel sebelum Run.') : !version.validation.valid ? tr('The contract is not valid yet.','Contract belum valid.') : tr('Check the wiring before you start.','Periksa kabel sebelum mulai.')}</small></div>
        <Button size="sm" className="school-primary" disabled={!ready} onClick={() => execute()}><PlayIcon weight="fill" aria-hidden="true"/>{operationBusy ? tr('Working…','Sedang bekerja…') : mode === 'physical' ? tr('Compile, flash & test','Kompilasi, unggah & uji') : tr('Run practice','Jalankan latihan')}</Button>
      </div>
    </div>}
    <div className="wb-notices">
      {status?.providers?.available===false && <Notice tone="warn" title={tr('AI is not available yet.','AI belum tersedia.')}>{tr('A Jev and Codex configuration or an API key is required to create plans and AI conversations. The catalog and project evidence stay available; simulation of an already valid project still works.','Konfigurasi Jev dan Codex atau API key diperlukan untuk membuat rencana dan percakapan AI. Katalog dan bukti proyek tetap dapat dibuka; simulasi proyek yang sudah valid tetap tersedia.')}{status.providers.error && <span className="wb-notice-detail">{status.providers.error}</span>}</Notice>}
      {runtimeError && <Notice tone="error" title={tr('Test stopped.','Uji terhenti.')}>{runtimeError}<span className="wb-notice-detail">{tr('This result does not verify the device yet. Check the runtime before trying again.','Hasil ini belum memverifikasi perangkat. Periksa runtime sebelum mencoba lagi.')}</span></Notice>}
      {error && <Notice tone="error" action={<IconButton className="wb-icon-sm" label={tr('Dismiss error','Tutup pesan kesalahan')} onClick={() => setError('')}><XIcon size={16}/></IconButton>}>{error}</Notice>}
      {remoteApproval && <section className="school-remote" role="region" aria-label={tr('Remote request awaiting approval','Permintaan jarak jauh menunggu persetujuan')}>
        <WarningIcon className="wb-remote-icon" size={18} weight="bold" aria-hidden="true"/>
        <div className="wb-remote-body">
          <Eyebrow as="span">{tr('Remote request','Permintaan jarak jauh')}</Eyebrow>
          <h2>{remoteApproval.input.operation === 'physical' ? tr('The project owner requests a physical device experiment on this node','Pemilik proyek meminta eksperimen perangkat fisik di node ini') : tr('The project owner requests a model practice run on this node','Pemilik proyek meminta latihan model di node ini')}</h2>
          <p>Job <code>{remoteApproval.id.slice(0,8)}</code> · {tr('USB device','perangkat USB')} <code>{remoteApproval.input.deviceId ?? '—'}</code> · {tr(`permission expires automatically in ${remoteSecondsLeft} s.`,`izin kedaluwarsa otomatis dalam ${remoteSecondsLeft} detik.`)}</p>
          <small>{tr('Approval runs the current validated contract on the local runtime. Check the wiring and make sure power is safe before approving physical work. Unapproved jobs are not retried automatically.','Persetujuan menjalankan kontrak tervalidasi saat ini di runtime lokal. Periksa kabel dan pastikan daya aman sebelum menyetujui pekerjaan fisik. Pekerjaan yang tidak disetujui tidak diulang otomatis.')}</small>
          {remoteApproval.input.operation === 'physical' && !remoteApprovable && <p className="wb-remote-hint">{tr('Select and authorize the requested USB device in the Where to run panel.','Pilih dan izinkan perangkat USB yang diminta di panel Tempat menjalankan.')}</p>}
        </div>
        <Button size="sm" className="school-primary" disabled={!remoteApprovable || operationBusy || wiringDirty} onClick={approveRemoteJob}>{operationBusy ? tr('Working…','Sedang bekerja…') : tr('Approve & run','Setujui & jalankan')}</Button>
      </section>}
      {challengeActive && <div className="school-challenge-strip" role="group" aria-label={tr('Challenge scenario progress','Progres skenario challenge')}><Eyebrow as="span">Challenge · {challengeProgress.challenge.title}</Eyebrow><div className="school-challenge-chips">{challengeProgress.verdicts.map((v: any) => <button type="button" key={v.name} className={'chip ' + v.status} title={v.expect + ' — ' + v.evidence} onClick={() => setTab('Uji')}><span aria-hidden="true">{v.status === 'pass' ? '✓' : v.status === 'fail' ? '!' : '—'}</span>{v.name}</button>)}</div><small>{tr('Scored by the system from evidence · select for detail','Dinilai sistem dari bukti · klik untuk detail')}</small></div>}
      {project?.activeDesign?.status==='executable' && <section className="design-draft"><Eyebrow as="span">{tr('Design intent','Intent rancangan')}</Eyebrow><h2>{tr('Requested intent','Intent yang diminta')} · {tr('revision','revisi')} {project.activeDesign.version}</h2><p>{project.activeDesign.desiredBehavior}</p><p>{tr('Size / mounting','Ukuran / pemasangan')}: {project.activeDesign.sizeConstraint||tr('Not specified yet','Belum ditentukan')}</p><small>{tr('The intent is stored as a request. Wiring and code validation do not prove that size, mounting or physical behaviour are met.','Intent tersimpan sebagai permintaan. Validasi wiring dan kode tidak membuktikan ukuran, pemasangan, atau perilaku fisik terpenuhi.')}</small></section>}
      {draftBlocked && <section className="design-draft is-blocked"><Eyebrow as="span">{tr('Draft','Draft')}</Eyebrow><h2>{tr('Draft revision','Draft revisi')} {project.activeDesign.version} · {tr('not executable yet','belum executable')}</h2><p>{project.activeDesign.desiredBehavior}</p><p>{tr('Size / mounting','Ukuran / pemasangan')}: {project.activeDesign.sizeConstraint||tr('Not specified yet','Belum ditentukan')}</p><ul>{project.activeDesign.unresolved.map((item:string,i:number)=><li key={i}>{item}</li>)}</ul><p>{project.activeDesign.reason}</p><strong>{project.activeDesign.source==='wiring'?tr('This wiring revision is blocked. Fix the wires, then Apply.','Revisi wiring ini diblokir. Perbaiki kabel lalu Apply.'):tr('The canvas shows the draft selection without wires; the code is from the previous archive. Run is blocked.','Canvas menampilkan pilihan draft tanpa kabel; kode arsip sebelumnya. Run diblokir.')}</strong></section>}
    </div>
    <main className={'wb-stage ' + (chatOpen ? 'chat-open' : 'chat-closed')}>
      {!contract ? <section className="school-empty" aria-label={tr('Planning canvas','Canvas perencanaan')}>
        {project ? <div className="wb-canvas"><Suspense fallback={canvasFallback}><HardwareFlow project={project} catalog={catalog} onRefresh={refreshProject} onDirtyChange={onDirtyChange}/></Suspense></div> : <div className="wb-loading"><EmptyState eyebrow={tr('Workbench','Meja kerja')} title={tr('Opening workspace…','Membuka ruang kerja…')}>{tr('Loading the project, its contract and the latest evidence.','Memuat proyek, contract, dan bukti terbaru.')}</EmptyState></div>}
        {project && <div className="wb-planning">
          <Eyebrow as="span">{tr('Planning','Perencanaan')}</Eyebrow>
          <h2>{!id ? tr('Site planning','Perencanaan lokasi') : project?.status === 'planning' ? tr('AI is drafting a plan','AI sedang menyusun rencana') : project?.status === 'clarification' ? tr('This recipe is not supported yet','Resep ini belum didukung') : tr('Preparing the circuit','Menyiapkan rangkaian')}</h2>
          <p>{!id ? project?.goal : project?.clarification ?? project?.error ?? tr('No device execution yet. First circuit: ESP32 + BME280 + SSD1306.','Belum ada eksekusi perangkat. Rangkaian pertama: ESP32 + BME280 + SSD1306.')}</p>
          <div className="wb-planning-actions"><LinkButton size="sm" variant="secondary" to="/build">{tr('Back to projects','Kembali ke proyek')}</LinkButton>{id && project && project.status !== 'planning' && <Button size="sm" variant="ghost" onClick={() => post(`/projects/${id}/replan`, {}).catch(e => setError(e.message))}>{tr('Redraft the plan','Susun ulang rencana')}</Button>}</div>
        </div>}
      </section> : <div className="school-layout">
        <section className="school-center" aria-label={tr('Project view','Tampilan proyek')}><div id="school-view" role="tabpanel" aria-labelledby={`school-tab-${tab}`}>
          <div className={tab === 'Desain' ? 'wb-design' : 'wb-design is-hidden'}>
            <div className="wb-canvas"><Suspense fallback={canvasFallback}><HardwareFlow key={project.id} project={project} catalog={catalog} onRefresh={refreshProject} onDirtyChange={onDirtyChange}/></Suspense></div>
            <details className="contract-disclosure">
              <summary>{tr('Contract & technical validation','Contract & validasi teknis')}</summary>
              <div className="wb-disclosure-body">
                <Tag tone={version.validation.valid ? 'ok' : 'error'}>{version.validation.valid ? tr('Contract rules pass','Aturan contract lolos') : tr('Contract blocked','Contract diblokir')}</Tag>
                <p>{version.validation.valid ? tr('Contract rules pass. The physical connection is not proven yet.','Aturan contract lolos. Sambungan fisik belum dibuktikan.') : tr('The contract is blocked.','Contract diblokir.')}</p>
                {version.validation.errors.map((e:any,i:number)=><p key={i}><code>{e.code}</code>: {e.message}</p>)}
                <p>{project.summary}</p>
                <table><thead><tr><th>{tr('Component','Komponen')}</th><th>Pin</th><th>ESP32</th></tr></thead><tbody>{contract.connections.map((w:any,i:number)=><tr key={i}><td>{w.componentId}</td><td>{w.pin}</td><td>{w.boardPin}</td></tr>)}</tbody></table>
                <CodeBlock label="contract.json">{JSON.stringify(contract,null,2)}</CodeBlock>
                <small className="wb-hash">SHA256 / {version.hash}</small>
              </div>
            </details>
          </div>
          {tab === 'Desain' ? null : tab === 'Kode' ? <div className="school-code wb-view"><div className="wb-view-inner">
            <div className="wb-view-head"><div><Eyebrow as="span">Firmware</Eyebrow><h2 className="wb-mono-title">{firmwareName}</h2></div><div className="wb-view-actions"><Button size="sm" variant="secondary" disabled={!firmware?.source} onClick={download}><DownloadSimpleIcon aria-hidden="true"/>{tr('Download .ino','Unduh .ino')}</Button><Button size="sm" variant="secondary" disabled={!firmware?.source} onClick={() => navigator.clipboard.writeText(firmware.source).then(() => setCopied(true)).catch(e => setError(e.message))}>{copied ? <CheckIcon aria-hidden="true"/> : <CopyIcon aria-hidden="true"/>}{copied ? tr('Copied','Tersalin') : tr('Copy code','Salin kode')}</Button></div></div>
            <CodeBlock label={firmwareName}><code>{firmware?.source ?? tr('Firmware is not available yet.','Firmware belum tersedia.')}</code></CodeBlock>
            <small className="wb-hash">SHA256 / {firmware?.hash ?? '—'}</small>
          </div></div> : <div className="school-tests wb-view"><div className="wb-view-inner">
            <Eyebrow as="span">{tr('Verification','Verifikasi')}</Eyebrow>
            <h2>{operationBusy ? tr('Collecting evidence…','Mengumpulkan bukti…') : verification?.passed ? tr('This experiment passed its checks','Pemeriksaan eksperimen ini lolos') : runtimeError ? tr('Test stopped','Uji terhenti') : experiment?.status === 'FAILED' ? tr('Let’s check the results','Mari periksa hasilnya') : tr('No evidence yet','Belum ada bukti')}</h2>
            {operationBusy && <ol className="school-stepper" aria-label={tr('Running experiment stages','Tahap eksperimen berjalan')}><li className="on">{tr('Plan','Rencana')}</li><li className="on pulse">{tr('Running','Menjalankan')}</li><li>{tr('Verify','Verifikasi')}</li><li>{tr('Done','Selesai')}</li></ol>}
            <p className="wb-muted">{experiment ? `${tr('Experiment','Eksperimen')} ${experiment.id.slice(0,8)} · ${experiment.mode === 'physical' ? tr('local device','perangkat lokal') : tr('model practice, no physical evidence','latihan model, tanpa bukti fisik')}` : tr('Run an experiment to see the checks.','Jalankan eksperimen untuk melihat pemeriksaan.')}</p>
            <ul className="wb-checks">{Object.entries(checks).filter(([key])=>contract.verification.checks.includes(key)).map(([key,[en,idLabel]]) => {const row = observations.filter((o: any) => o.evidence.check === key).at(-1); return <li className={'school-check ' + (row ? row.evidence.passed ? 'passed' : 'failed' : 'pending')} key={key}><span className="wb-check-icon" aria-hidden="true">{row ? row.evidence.passed ? '✓' : '!' : '—'}</span><div><strong>{tr(en,idLabel)}</strong><code>{row ? JSON.stringify(row.evidence.data) : tr('Waiting for evidence from this experiment','Menunggu bukti eksperimen ini')}</code></div><Tag tone={row ? row.evidence.passed ? 'ok' : 'error' : 'neutral'}>{row ? row.evidence.source === 'physical' ? tr('Physical','Fisik') : tr('Model','Model') : tr('Not tested','Belum diuji')}</Tag></li>;})}</ul>
            {repair && <div className="school-repair"><h3>{tr('Check & recover','Periksa & pulihkan')}</h3><p>{repair.summary}</p><details><summary>{tr('AI diagnosis & check steps','Diagnosis AI & langkah pemeriksaan')}</summary><ol>{repair.checks.map((c: string) => <li key={c}>{c}</li>)}</ol><p>{repair.repair}</p></details><label className="wb-check-label"><input type="checkbox" checked={confirmed} onChange={e => setConfirmation(e.target.checked ? confirmationKey : '')}/><span>{experiment.mode === 'physical' ? tr('I have switched off power, checked the wiring and finished the repair.','Saya sudah mematikan daya, memeriksa kabel, dan menyelesaikan perbaikan.') : tr('I confirm the repair has been applied to the model practice.','Saya mengonfirmasi penerapan perbaikan pada latihan model.')}</span></label>{experiment.mode !== mode && <p>{tr('Choose the same mode as the failed experiment before retesting.','Pilih mode yang sama dengan eksperimen gagal sebelum menguji ulang.')}</p>}<Button size="sm" disabled={!retryReady} onClick={() => execute('none', true)}>{tr('Repair & retest','Perbaiki & uji ulang')}</Button></div>}
            {project.diagnosisError && <Notice tone="error">{tr('Diagnosis unavailable:','Diagnosis tidak tersedia:')} {project.diagnosisError}</Notice>}
            <details className="school-disclosure"><summary>{tr('Evidence, hashes & verification result','Bukti, hash & hasil verifikasi')}</summary><CodeBlock label="evidence.json">{JSON.stringify({verification, observations}, null, 2)}</CodeBlock></details>
            {contract.connections.some((w:any)=>w.role==='sda') && <div className="school-fault"><h3>{tr('Learn from failure','Belajar dari kegagalan')}</h3><p>{mode === 'physical' ? tr('A physical failure must be done by hand: switch off power, change the SDA wire, then run a new experiment.','Kegagalan fisik harus dilakukan manual: matikan daya, ubah kabel SDA, lalu jalankan eksperimen baru.') : tr('The model can try an SDA-loss scenario. It does not change the real device.','Model dapat mencoba skenario kehilangan SDA. Tidak mengubah perangkat nyata.')}</p><Button size="sm" variant="secondary" disabled={!ready || mode !== 'simulation' || experiment?.mode !== 'simulation' || !verification?.passed} onClick={() => execute('sda')}>{tr('Try an SDA failure on the model','Coba kegagalan SDA pada model')}</Button></div>}
            {challengeActive && <details className="school-disclosure" open><summary>{tr('Challenge scenario','Skenario challenge')} · {challengeProgress.challenge.title} — {tr('scored by the system from evidence','dinilai sistem dari bukti')}</summary><ul className="wb-verdicts">{challengeProgress.verdicts.map((v: any) => <li key={v.name}><Tag tone={v.status === 'pass' ? 'ok' : v.status === 'fail' ? 'error' : 'neutral'}>{v.status === 'pass' ? tr('Pass','Lolos') : v.status === 'fail' ? tr('Fail','Gagal') : tr('Waiting','Menunggu')}</Tag><strong>{v.name}</strong><small>{v.expect}</small><small>{v.evidence}</small></li>)}</ul><small>{tr('Verbal claims do not count. Each scenario is scored from stored experiment observations.','Klaim lisan tidak dihitung. Setiap skenario dinilai dari observasi eksperimen tersimpan.')}</small></details>}
            <details className="school-disclosure"><summary>{tr('Experiment history','Riwayat eksperimen')} ({project.experiments.length})</summary><ul className="wb-history">{project.experiments.map((e: any) => <li key={e.id}><code>{e.id.slice(0,8)}</code> · {e.mode === 'physical' ? tr('Physical','Fisik') : tr('Model','Model')} · {e.status}</li>)}</ul></details>
          </div></div>}
        </div></section>
        <aside id="workbench-runtime" className={'school-coach ' + (runtimeOpen ? 'runtime-open' : '')} aria-label={tr('Runtime & evidence panel','Panel runtime & bukti')}>
          <div className="wb-panel-head"><Eyebrow as="span">{tr('Runtime & evidence','Runtime & bukti')}</Eyebrow><IconButton className="runtime-close wb-icon-sm" label={tr('Close runtime','Tutup runtime')} onClick={() => setRuntimeOpen(false)}><XIcon size={16}/></IconButton></div>
          <section className="wb-panel-section school-coach-intro"><Eyebrow as="span">{tr('Learning coach','Pendamping belajar')}</Eyebrow><h2>{tr('One step at a time.','Selangkah demi selangkah.')}</h2><p>{nextStep}</p><small>{tr('Guidance follows the project state. This is not a live AI conversation.','Panduan sesuai status proyek. Bukan percakapan AI langsung.')}</small></section>
          <section className="wb-panel-section school-learning"><h3 className="wb-section-label">{tr('Know your circuit','Kenali rangkaianmu')}</h3>{lessons.map((l,i) => <label key={l} className="wb-check-label"><input type="checkbox" checked={completed.includes(i)} onChange={e => setCompleted(e.target.checked ? [...completed,i] : completed.filter(n => n !== i))}/><span>{l}</span></label>)}<small>{tr('Local learning checklist. Not stored as physical evidence.','Checklist belajar lokal. Tidak disimpan sebagai bukti fisik.')}</small></section>
          <section className="wb-panel-section school-target"><h3 className="wb-section-label">{tr('Where to run','Tempat menjalankan')}</h3>
            {cloudWorkspace && <Notice tone="info">{tr('The cloud workspace cannot read your laptop’s USB. Use the ','Workspace cloud tidak membaca USB laptop. Gunakan ')}<a href={RELEASES} target="_blank" rel="noreferrer">{tr('desktop app','app desktop')}</a>{tr(' to compile, flash and test a local board. Cloud projects do not sync to the desktop automatically yet.',' untuk compile, flash dan uji board lokal. Proyek cloud belum otomatis tersinkron ke desktop.')}</Notice>}
            <div className="ds-segmented ds-segmented--sm school-mode" role="group" aria-label={tr('Run target','Target eksekusi')}><button type="button" aria-pressed={mode === 'simulation'} disabled={operationBusy} onClick={() => changeMode('simulation')}>{tr('Model practice','Latihan model')}</button><button type="button" aria-pressed={mode === 'physical'} disabled={operationBusy||cloudWorkspace} onClick={() => changeMode('physical')}>{tr('Local USB','USB lokal')}</button></div>
            {mode === 'physical' ? <div className="wb-usb">
              <Button size="sm" variant="secondary" disabled={operationBusy||scanningUSB} onClick={()=>void scanUSB()}>{scanningUSB ? tr('Detecting USB…','Mendeteksi USB…') : tr('Rescan USB','Deteksi ulang USB')}</Button>
              <p role="status" className="wb-muted">{scanningUSB ? tr('Checking local USB devices.','Memeriksa perangkat USB lokal.') : usbError ? tr('USB detection failed.','Deteksi USB gagal.') : (status?.runtime?.devices??[]).some((device:any)=>device.candidate) ? tr('USB device found. Select it, then authorize it.','Perangkat USB ditemukan. Pilih lalu izinkan perangkat.') : tr('No USB candidates yet. Connect the board, then rescan.','Belum ada kandidat USB. Sambungkan board lalu deteksi ulang.')}</p>
              {usbError && <Notice tone="error">{usbError === USB_UNAVAILABLE ? tr('USB runtime unavailable.','Runtime USB tidak tersedia.') : usbError}</Notice>}
              <Select id="school-port" label={tr('Detected USB device','Perangkat USB terdeteksi')} value={port} disabled={operationBusy} onChange={e => {selectedPort.current=e.target.value;setPort(e.target.value);setTrustedPort('');setConfirmation('');}}><option value="">{tr('Choose device','Pilih perangkat')}</option>{status?.runtime?.devices?.filter((d: any) => d.candidate).map((d: any) => <option key={d.port} value={d.port}>{d.port}</option>)}</Select>
              <p className="wb-muted">{tr('Switch off power before wiring. Local permission allows compiling and flashing firmware.','Matikan daya sebelum merangkai. Izin lokal mengizinkan kompilasi dan unggah firmware.')}</p>
              <Button size="sm" variant={trusted ? 'secondary' : 'primary'} disabled={!port || trusted || operationBusy || scanningUSB || !!usbError} onClick={authorize}>{trusted ? tr('Device authorized','Perangkat diizinkan') : tr('Authorize this device','Izinkan perangkat ini')}</Button>
              {!status?.runtime.toolchain && <p className="wb-muted">{tr('Arduino CLI is not ready yet.','Arduino CLI belum siap.')} <Link to="/docs">{tr('Open the guide','Buka panduan')}</Link>.</p>}
            </div> : <p className="wb-muted">{contract?.recipe?.id === 'esp32-button-led' ? tr('Template model; a physical run needs the button pressed and released while the experiment runs so the behaviour sequence is proven.','Model template; jalankan fisik membutuhkan tombol ditekan-lepas saat eksperimen berjalan agar urutan perilaku terbukti.') : tr('Template model; firmware and board are not executed. Wokwi CLI is not enabled yet.','Model template; firmware dan board tidak dieksekusi. Wokwi CLI belum diaktifkan.')}</p>}
          </section>
          <section className="wb-panel-section school-provenance"><h3 className="wb-section-label">{tr('Latest result source','Asal hasil terbaru')}</h3><strong className="wb-provenance">{!experiment ? tr('No experiment yet','Belum ada eksperimen') : experiment.mode === 'physical' ? tr('Local device runtime','Runtime perangkat lokal') : tr('Model · no physical evidence','Model · tanpa bukti fisik')}</strong><p className="wb-muted">{verification?.physical ? tr('Physical checks passed with stored evidence. An OLED ACK does not prove the pixels are visible.','Pemeriksaan fisik lolos dengan bukti tersimpan. ACK OLED tidak membuktikan piksel terlihat.') : tr('Visuals, checklists and AI confidence do not verify the device.','Visual, checklist dan keyakinan AI tidak memverifikasi perangkat.')}</p>
            {(contract?.expected.valueRanges.temperature?['temperature','humidity']:[]).map((key,i) => {const value = observations.filter((o: any) => o.evidence.check === 'sensor_readings').at(-1)?.evidence.data[key]; return <div className="school-reading" key={key}><span>{i ? tr('Humidity','Kelembapan') : tr('Temperature','Suhu')}</span><strong>{typeof value === 'number' ? value.toFixed(1) : '—'} {i ? '%' : '°C'}</strong></div>;})}
            {(() => {const series = project.observations.filter((o: any) => o.evidence.check === 'sensor_readings' && typeof o.evidence.data?.temperature === 'number' && o.evidence.experimentId && project.experiments.some((e: any) => e.id === o.evidence.experimentId && e.contractId === project.contractId)).slice(-14); if (series.length < 2) return null; const temps = series.map((o: any) => o.evidence.data.temperature as number), hums = series.map((o: any) => o.evidence.data.humidity as number); const lo = Math.min(...temps, ...hums) - 2, hi = Math.max(...temps, ...hums) + 2; const pts = (values: number[]) => values.map((v, i) => `${(i / (values.length - 1)) * 116 + 2},${34 - ((v - lo) / (hi - lo || 1)) * 30}`).join(' '); return <div className="school-spark"><svg viewBox="0 0 120 36" role="img" aria-label={tr('Temperature and humidity history','Riwayat suhu dan kelembapan')}><polyline className="wb-spark-temp" points={pts(temps)} fill="none" strokeWidth="2"/><polyline className="wb-spark-hum" points={pts(hums)} fill="none" strokeWidth="2" strokeDasharray="3 3"/></svg><small>{tr('Temperature (solid) · Humidity (dashed)','Suhu (garis penuh) · Kelembapan (putus-putus)')} · {series.length} {tr('latest readings','pembacaan terakhir')}</small></div>;})()}
          </section>
          <form className="wb-panel-section school-note" onSubmit={e => {e.preventDefault(); saveNote();}}>
            <h3 className="wb-section-label">{tr('What did you learn?','Apa yang kamu pelajari?')}</h3>
            <Textarea id="school-note" label={tr('Observation or reflection note','Catatan pengamatan atau refleksi')} value={note} onChange={e => setNote(e.target.value)} maxLength={1000} rows={3} placeholder={tr('Example: the sensor is not detected; I will check the SDA label.','Contoh: sensor belum terdeteksi; saya akan memeriksa label SDA.')}/>
            <Select id="school-note-source" label={tr('Note source','Asal catatan')} value={noteProvenance} onChange={e => setNoteProvenance(e.target.value)}><option value="human_reported">{tr('Reported by a person','Dilaporkan manusia')}</option><option value="test_fixture">{tr('Fixture / agent demo','Fixture / demo agen')}</option></Select>
            <small>{tr('Stored locally without names or personal data. Notes do not pass checks or grant research use.','Simpan lokal tanpa nama atau data pribadi. Catatan tidak meloloskan pemeriksaan atau memberi izin penggunaan riset.')}</small>
            <Button type="submit" size="sm" variant="secondary" disabled={!note.trim() || savingNote}>{savingNote ? tr('Saving…','Menyimpan…') : tr('Save note','Simpan catatan')}</Button>
            <p role="status" className="wb-muted">{noteStatus}</p>
          </form>
          <Link className="wb-panel-section school-episode-note" to={`/project/${id}/episode`}><span>{tr('Save the lesson in the episode','Simpan pelajaran dalam episode')} <ArrowUpRightIcon aria-hidden="true"/></span><small>{tr('Actions, evidence, usage rights and local export.','Aksi, bukti, hak penggunaan dan ekspor lokal.')}</small></Link>
          <p className="wb-disclaimer">{tr('Reference visual · switch off power before changing wires · not electrical proof.','Visual referensi · matikan daya sebelum mengubah kabel · bukan bukti listrik.')} <Link to="/docs">{tr('Runtime documentation','Dokumentasi runtime')}</Link></p>
        </aside>
      </div>}
      {project && id && <aside id="workbench-chat" className="workbench-chat" inert={!chatOpen} aria-hidden={!chatOpen}>{siteWorkspace && <p className="chat-device-context"><Eyebrow as="span">{tr('Active device','Perangkat aktif')}</Eyebrow> {siteWorkspace.site.devices.find(d=>d.id===siteWorkspace.activeDeviceId)?.name}</p>}<HardwareChat project={project} onRefresh={refreshProject} blocked={wiringDirty}/></aside>}
      {!id && siteWorkspace && <aside id="workbench-chat" className="workbench-chat" inert={!chatOpen} aria-hidden={!chatOpen}><SiteIntentChat/></aside>}
    </main>
  </div>;
}
