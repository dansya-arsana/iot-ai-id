/** admin.iot.ai.id landing and staff login (ADR 009 addendum): shown while there is no staff session. Invite-only; no numbers or customers are claimed. */
import {useEffect,useRef,useState,type FormEvent,type KeyboardEvent} from 'react';
import {ArrowLeftIcon,HandCoinsIcon,InfoIcon,LockKeyIcon,SealCheckIcon,SlidersHorizontalIcon,TrayIcon,WarningIcon} from '@phosphor-icons/react';
import {useLang} from '../i18n';
import {PUBLIC_SITE} from '../host';
import {Brand} from '../site-shell';
import {Button,Card,Eyebrow,Input,LangToggle,Spinner} from '../ui';
import {OpsError,staffAuth,type StaffMe} from '../ops-client';
import './admin-landing.css';

type Mode='login'|'activate';
type Fields={username:string;password:string;code:string;confirm:string};
const CODE_RE=/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{10}$/;
const caps=[
 {Icon:TrayIcon,en:'Inquiries & CRM',id:'Inquiry & CRM',dEn:'Every partner and school inquiry, from first contact to a won deal.',dId:'Setiap inquiry mitra dan sekolah, dari kontak pertama sampai deal.'},
 {Icon:SealCheckIcon,en:'Tested catalog',id:'Katalog teruji',dEn:'Distributor products with test evidence and localization status.',dId:'Produk distributor dengan bukti uji dan status lokalisasi.'},
 {Icon:HandCoinsIcon,en:'Lab Mitra commissions & payouts',id:'Komisi & payout Lab Mitra',dEn:'Verified tasks, school approvals and payout batches on an append-only ledger.',dId:'Tugas terverifikasi, persetujuan sekolah, dan batch payout di ledger append-only.'},
 {Icon:SlidersHorizontalIcon,en:'AI settings',id:'Pengaturan AI',dEn:'Choose the AI provider and manage the keys behind the workspace.',dId:'Pilih provider AI dan kelola kunci di balik workspace.'},
];

export function AdminLanding({ended,onSignedIn}:{ended?:boolean;onSignedIn:(me:StaffMe)=>void}){
 const{tr,lang}=useLang();
 const [mode,setMode]=useState<Mode>('login');const [f,setF]=useState<Fields>({username:'',password:'',code:'',confirm:''});
 const [errors,setErrors]=useState<Partial<Record<keyof Fields,string>>>({});const [failure,setFailure]=useState('');const [busy,setBusy]=useState(false);
 const alertRef=useRef<HTMLParagraphElement>(null);const tabs=useRef<Record<Mode,HTMLButtonElement|null>>({login:null,activate:null});
 useEffect(()=>{// Replace the site-wide robots tag instead of adding a second, conflicting one.
  document.title='Admin | AIoT';const found=document.head.querySelector<HTMLMetaElement>('meta[name=robots]'),meta=found??document.createElement('meta'),before=found?.content;
  meta.name='robots';meta.content='noindex,nofollow';if(!found)document.head.append(meta);
  return()=>{if(found&&before!==undefined)found.content=before;else meta.remove();};
 },[]);
 useEffect(()=>{document.getElementById('al-username')?.focus({preventScroll:true});},[]);
 const set=(key:keyof Fields)=>(e:{target:{value:string}})=>{setF(v=>({...v,[key]:key==='code'?e.target.value.toUpperCase():e.target.value}));setErrors(v=>({...v,[key]:undefined}));};
 const pick=(next:Mode)=>{setMode(next);setErrors({});setFailure('');setF(v=>({...v,password:'',confirm:''}));tabs.current[next]?.focus();};
 const onTabKey=(e:KeyboardEvent)=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='Home'||e.key==='End')pick(mode==='login'?'activate':'login');};
 function validate(){
  const e:Partial<Record<keyof Fields,string>>={};
  if(mode==='login'){
   if(f.username.trim().length<3)e.username=tr('Enter your username (at least 3 characters).','Masukkan nama pengguna (minimal 3 karakter).');
   if(!f.password)e.password=tr('Enter your password.','Masukkan kata sandi.');
  }else{
   if(!CODE_RE.test(f.code.trim()))e.code=tr('Invite codes look like ABCD-EFGHJKMNPQ.','Kode undangan berbentuk ABCD-EFGHJKMNPQ.');
   if(f.password.length<10)e.password=tr('Password needs at least 10 characters.','Kata sandi minimal 10 karakter.');
   if(f.confirm!==f.password)e.confirm=tr('The two passwords do not match.','Kedua kata sandi tidak sama.');
  }
  return e;
 }
 const explain=(err:unknown)=>{
  if(err instanceof OpsError){
   if(err.status===429)return tr('Too many attempts. Try again in 15 minutes.','Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
   if(mode==='login'&&err.status===401)return tr('Wrong username or password. After 5 failed attempts the account locks: try again in 15 minutes.','Nama pengguna atau kata sandi salah. Setelah 5 kali gagal akun terkunci: coba lagi dalam 15 menit.');
   if(mode==='activate'&&err.status===400&&!err.issues.length)return tr('This invite code is invalid, already used or expired. Ask an owner for a new one.','Kode undangan tidak valid, sudah dipakai, atau kedaluwarsa. Minta kode baru ke owner.');
   return err.message;
  }
  return tr('Could not reach the server. Check your connection and try again.','Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.');
 };
 async function submit(e:FormEvent){
  e.preventDefault();if(busy)return;setFailure('');
  const found=validate();setErrors(found);
  const first=(mode==='login'?['username','password']:['code','password','confirm']).find(k=>found[k as keyof Fields]);
  if(first){document.getElementById(`al-${first}`)?.focus();return;}
  setBusy(true);
  try{onSignedIn(mode==='login'?await staffAuth.login(f.username.trim(),f.password):await staffAuth.activate(f.code.trim(),f.password));}
  catch(err){setFailure(explain(err));setBusy(false);requestAnimationFrame(()=>alertRef.current?.focus());}
 }
 const submitLabel=mode==='login'?tr('Sign in','Masuk'):tr('Activate and sign in','Aktifkan dan masuk');
 return <div className="al">
  <header className="al-top"><Brand/><Eyebrow as="span" className="al-top-label">{tr('Admin console','Konsol admin')}</Eyebrow></header>
  <main className="al-main">
   <section className="al-hero" aria-labelledby="al-title">
    <Eyebrow rule>AIoT · ADMIN CONSOLE</Eyebrow>
    <h1 id="al-title">{lang==='id'?<>Kendalikan <em>gerbangnya.</em></>:<>Run the <em>gateway.</em></>}</h1>
    <p className="al-lead">{tr('One workspace for the AIoT team: partners, tested products and Lab Mitra payouts.','Satu ruang kerja untuk tim AIoT: mitra, produk teruji, dan payout Lab Mitra.')}</p>
    <ul className="al-caps" aria-label={tr('What the console covers','Cakupan konsol')}>
     {caps.map(({Icon,en,id,dEn,dId})=><li key={en}><span className="al-cap-icon"><Icon size={20} weight="regular" aria-hidden="true"/></span><span><b>{tr(en,id)}</b><small>{tr(dEn,dId)}</small></span></li>)}
    </ul>
    <p className="al-note"><LockKeyIcon size={14} weight="bold" aria-hidden="true"/>{tr('Access is by invitation. Every action is logged.','Akses hanya dengan undangan. Setiap tindakan dicatat.')}</p>
   </section>
   <section className="al-card-wrap" aria-label={tr('Staff access','Akses staf')}>
    <Card tone="raised" brackets as="div" className="al-card">
     <div className="al-tabs" role="tablist" aria-label={tr('Staff access','Akses staf')} onKeyDown={onTabKey}>
      {(['login','activate'] as const).map(m=><button key={m} ref={el=>{tabs.current[m]=el;}} type="button" role="tab" id={`al-tab-${m}`} aria-selected={mode===m} aria-controls="al-panel" tabIndex={mode===m?0:-1} onClick={()=>pick(m)}>{m==='login'?tr('Sign in','Masuk'):tr('Activate invite','Aktivasi undangan')}</button>)}
     </div>
     <div className="al-status" aria-live="polite" aria-atomic="true">
      {failure?<p ref={alertRef} tabIndex={-1} className="al-msg al-msg--error" role="alert"><WarningIcon size={18} weight="bold" aria-hidden="true"/><span>{failure}</span></p>
      :ended?<p className="al-msg"><InfoIcon size={18} weight="bold" aria-hidden="true"/><span>{tr('Your session ended. Sign in again to continue.','Sesi Anda berakhir. Masuk lagi untuk melanjutkan.')}</span></p>:null}
     </div>
     <form id="al-panel" role="tabpanel" aria-labelledby={`al-tab-${mode}`} className="al-form" onSubmit={submit} noValidate aria-busy={busy}>
      {mode==='login'?<>
       <Input id="al-username" label={tr('Username','Nama pengguna')} autoComplete="username" autoCapitalize="none" spellCheck={false} value={f.username} error={errors.username} onChange={set('username')}/>
       <Input id="al-password" type="password" label={tr('Password','Kata sandi')} autoComplete="current-password" value={f.password} error={errors.password} onChange={set('password')}/>
      </>:<>
       <Input id="al-code" label={tr('Invite code','Kode undangan')} hint={tr('From an AIoT owner. Valid for 7 days, single use.','Dari owner AIoT. Berlaku 7 hari, sekali pakai.')} autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} maxLength={15} value={f.code} error={errors.code} onChange={set('code')}/>
       <Input id="al-password" type="password" label={tr('New password','Kata sandi baru')} hint={tr('At least 10 characters.','Minimal 10 karakter.')} autoComplete="new-password" value={f.password} error={errors.password} onChange={set('password')}/>
       <Input id="al-confirm" type="password" label={tr('Confirm password','Ulangi kata sandi')} autoComplete="new-password" value={f.confirm} error={errors.confirm} onChange={set('confirm')}/>
      </>}
      <Button type="submit" disabled={busy}>{busy?<><Spinner label={tr('Please wait','Mohon tunggu')}/>{tr('Please wait…','Mohon tunggu…')}</>:submitLabel}</Button>
     </form>
    </Card>
   </section>
  </main>
  <footer className="al-foot"><a className="ds-text-link" href={PUBLIC_SITE}><ArrowLeftIcon size={14} weight="bold" aria-hidden="true"/>iot.ai.id</a><LangToggle/></footer>
 </div>;
}
