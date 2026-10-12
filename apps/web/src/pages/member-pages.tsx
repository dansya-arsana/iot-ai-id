/** Member sign-in (/masuk, /login) and profile (/profile, /profil) on the public host (ADR 009 addendum). Both are noindex; the profile lists unlocked areas and holds the installer button. */
import {useEffect,useRef,useState,type FormEvent,type KeyboardEvent} from 'react';
import {Link,Navigate,useNavigate} from 'react-router-dom';
import {InfoIcon,WarningIcon} from '@phosphor-icons/react';
import {useLang} from '../i18n';
import {AREAS,InstallerButton,useAccess} from '../preview';
import {PageShell} from '../site-shell';
import {Button,Card,CardLink,Eyebrow,Input,LinkButton,Spinner,Tag} from '../ui';
import {OpsError,memberAuth} from '../ops-client';
import './admin-landing.css';
import './member-pages.css';

/** Replaces the site-wide robots tag instead of adding a second, conflicting one. */
function useNoindex(title:string){
 useEffect(()=>{
  document.title=title;const found=document.head.querySelector<HTMLMetaElement>('meta[name=robots]'),meta=found??document.createElement('meta'),before=found?.content;
  meta.name='robots';meta.content='noindex,nofollow';if(!found)document.head.append(meta);
  return()=>{if(found&&before!==undefined)found.content=before;else meta.remove();};
 },[title]);
}

type Mode='login'|'activate';
type Fields={username:string;password:string;code:string;confirm:string};
const CODE_RE=/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{10}$/;

export function MemberLogin(){
 const{tr}=useLang();const{ready,member,setMember}=useAccess();const navigate=useNavigate();
 const [mode,setMode]=useState<Mode>('login');const [f,setF]=useState<Fields>({username:'',password:'',code:'',confirm:''});
 const [errors,setErrors]=useState<Partial<Record<keyof Fields,string>>>({});const [failure,setFailure]=useState('');const [busy,setBusy]=useState(false);
 const alertRef=useRef<HTMLParagraphElement>(null);const tabs=useRef<Record<Mode,HTMLButtonElement|null>>({login:null,activate:null});
 useNoindex('Sign in | AIoT');
 const set=(key:keyof Fields)=>(e:{target:{value:string}})=>{setF(v=>({...v,[key]:key==='code'?e.target.value.toUpperCase():e.target.value}));setErrors(v=>({...v,[key]:undefined}));};
 const pick=(next:Mode)=>{setMode(next);setErrors({});setFailure('');setF(v=>({...v,password:'',confirm:''}));tabs.current[next]?.focus();};
 const onTabKey=(e:KeyboardEvent)=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='Home'||e.key==='End')pick(mode==='login'?'activate':'login');};
 if(ready&&member&&!busy)return <Navigate to="/profile" replace/>;
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
   if(mode==='activate'&&err.status===400&&!err.issues.length)return tr('This invite code is invalid, already used or expired. Ask AIoT for a new one.','Kode undangan tidak valid, sudah dipakai, atau kedaluwarsa. Minta kode baru ke AIoT.');
   return err.message;
  }
  return tr('Could not reach the server. Check your connection and try again.','Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.');
 };
 async function submit(e:FormEvent){
  e.preventDefault();if(busy)return;setFailure('');
  const found=validate();setErrors(found);
  const first=(mode==='login'?['username','password']:['code','password','confirm']).find(k=>found[k as keyof Fields]);
  if(first){document.getElementById(`ml-${first}`)?.focus();return;}
  setBusy(true);
  try{const me=mode==='login'?await memberAuth.login(f.username.trim(),f.password):await memberAuth.activate(f.code.trim(),f.password);setMember(me);navigate('/profile',{replace:true});}
  catch(err){setFailure(explain(err));setBusy(false);requestAnimationFrame(()=>alertRef.current?.focus());}
 }
 const submitLabel=mode==='login'?tr('Sign in','Masuk'):tr('Activate and sign in','Aktifkan dan masuk');
 return <PageShell width="narrow" eyebrow={tr('AIoT / members','AIoT / anggota')} title={tr('Member sign-in','Masuk anggota')} lead={tr('AIoT is open to invited partners, schools and clients. Sign in, or activate the invite code we sent you.','AIoT terbuka untuk mitra, sekolah, dan klien undangan. Masuk, atau aktifkan kode undangan yang kami kirim.')}>
  <Card tone="raised" brackets as="section" className="al-card mp-card" aria-label={tr('Member access','Akses anggota')}>
   <div className="al-tabs" role="tablist" aria-label={tr('Member access','Akses anggota')} onKeyDown={onTabKey}>
    {(['login','activate'] as const).map(m=><button key={m} ref={el=>{tabs.current[m]=el;}} type="button" role="tab" id={`ml-tab-${m}`} aria-selected={mode===m} aria-controls="ml-panel" tabIndex={mode===m?0:-1} onClick={()=>pick(m)}>{m==='login'?tr('Sign in','Masuk'):tr('Activate invite','Aktivasi undangan')}</button>)}
   </div>
   <div className="al-status" aria-live="polite" aria-atomic="true">
    {failure&&<p ref={alertRef} tabIndex={-1} className="al-msg al-msg--error" role="alert"><WarningIcon size={18} weight="bold" aria-hidden="true"/><span>{failure}</span></p>}
   </div>
   <form id="ml-panel" role="tabpanel" aria-labelledby={`ml-tab-${mode}`} className="al-form" onSubmit={submit} noValidate aria-busy={busy}>
    {mode==='login'?<>
     <Input id="ml-username" label={tr('Username','Nama pengguna')} autoComplete="username" autoCapitalize="none" spellCheck={false} value={f.username} error={errors.username} onChange={set('username')}/>
     <Input id="ml-password" type="password" label={tr('Password','Kata sandi')} autoComplete="current-password" value={f.password} error={errors.password} onChange={set('password')}/>
    </>:<>
     <Input id="ml-code" label={tr('Invite code','Kode undangan')} hint={tr('From AIoT. Valid for 7 days, single use.','Dari AIoT. Berlaku 7 hari, sekali pakai.')} autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} maxLength={15} value={f.code} error={errors.code} onChange={set('code')}/>
     <Input id="ml-password" type="password" label={tr('New password','Kata sandi baru')} hint={tr('At least 10 characters.','Minimal 10 karakter.')} autoComplete="new-password" value={f.password} error={errors.password} onChange={set('password')}/>
     <Input id="ml-confirm" type="password" label={tr('Confirm password','Ulangi kata sandi')} autoComplete="new-password" value={f.confirm} error={errors.confirm} onChange={set('confirm')}/>
    </>}
    <Button type="submit" disabled={busy}>{busy?<><Spinner label={tr('Please wait','Mohon tunggu')}/>{tr('Please wait…','Mohon tunggu…')}</>:submitLabel}</Button>
   </form>
   <p className="al-msg mp-help"><InfoIcon size={18} weight="bold" aria-hidden="true"/><span>{tr('No invitation yet?','Belum punya undangan?')} <Link to="/partner">{tr('Request access','Minta akses')}</Link></span></p>
  </Card>
 </PageShell>;
}

export function Profile(){
 const{tr}=useLang();const{ready,member,setMember}=useAccess();const [busy,setBusy]=useState(false);const [left,setLeft]=useState(false);
 useNoindex('Profile | AIoT');
 if(!ready)return <PageShell width="narrow" title={tr('Your profile','Profil Anda')}><div className="route-loading"><Spinner label={tr('Loading','Memuat')}/></div></PageShell>;
 if(!member)return <Navigate to={left?'/':'/masuk'} replace/>;
 const signOut=()=>{setBusy(true);setLeft(true);void memberAuth.logout().catch(()=>undefined).finally(()=>setMember(null));};
 const has=(g:string)=>member.grants.includes(g as never);
 return <PageShell width="wide" eyebrow={tr('AIoT / profile','AIoT / profil')} title={member.name} lead={member.org||tr('Invited member','Anggota undangan')} actions={<Button variant="secondary" onClick={signOut} disabled={busy} data-testid="sign-out">{tr('Sign out','Keluar')}</Button>}>
  <section className="mp-section" aria-labelledby="mp-areas"><Eyebrow rule>{tr('Your access','Akses Anda')}</Eyebrow><h2 id="mp-areas" className="mp-h">{tr('Unlocked areas','Area yang terbuka')}</h2>
   <div className="mp-grid">
    {AREAS.map(a=>has(a.grant)
     ?<CardLink key={a.grant} to={a.to} className="mp-card-area" data-testid={`area-${a.grant}`}><Tag tone="ok">{tr('Unlocked','Terbuka')}</Tag><h3>{tr(a.en,a.id)}</h3><p>{tr(a.dEn,a.dId)}</p></CardLink>
     :<Card key={a.grant} as="div" className="mp-card-area mp-card-locked" data-testid={`locked-${a.grant}`}><Tag>{tr('Invitation only','Khusus undangan')}</Tag><h3>{tr(a.en,a.id)}</h3><p>{tr(a.dEn,a.dId)}</p><LinkButton to="/partner" size="sm" variant="secondary">{tr('Request access','Minta akses')}</LinkButton></Card>)}
   </div>
  </section>
  <section className="mp-section" aria-labelledby="mp-app"><Eyebrow rule>{tr('Desktop app','Aplikasi desktop')}</Eyebrow><h2 id="mp-app" className="mp-h">{tr('Build and test on your own machine','Bangun dan uji di perangkat Anda')}</h2>
   {has('installer')
    ?<Card as="div" className="mp-card-area" data-testid="installer-card"><p>{tr('The workspace (Build, Sites) runs in the desktop app, next to your boards and files. Download it here.','Workspace (Build, Sites) berjalan di aplikasi desktop, di samping board dan berkas Anda. Unduh di sini.')}</p><div><InstallerButton/></div></Card>
    :<Card as="div" className="mp-card-area mp-card-locked" data-testid="installer-locked"><Tag>{tr('Invitation only','Khusus undangan')}</Tag><p>{tr('The desktop installer is not part of your account yet.','Installer desktop belum termasuk dalam akun Anda.')}</p><div><LinkButton to="/partner" size="sm" variant="secondary">{tr('Request access','Minta akses')}</LinkButton></div></Card>}
  </section>
 </PageShell>;
}
