/** Invitation-only gate for the public host, member sign-in state and the staff "presentation mode" that lifts the gate (ADR 009 addendum). Cosmetic only: the content is public JS anyway. */
import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {ArrowUpRightIcon,DownloadSimpleIcon} from '@phosphor-icons/react';
import {adminOrigin,isPublicHost} from './host';
import {useLang} from './i18n';
import {waLink} from './contact';
import {AnchorButton,Button,EmptyState,Eyebrow,LinkButton} from './ui';
import {PageShell} from './site-shell';
import {INSTALLER_PATH,OpsError,memberAuth,type MemberMe} from './ops-client';
import type {MemberGrant} from '../../../packages/ops-contract/index';
import './preview.css';

export type Preview={name:string;role:string};
/** One probe per page load, kept in memory only (no storage for auth state). */
let probe:Promise<Preview|null>|undefined;
const detect=()=>probe??=fetch(`${adminOrigin()}/ops/v1/staff/preview`,{credentials:'include',cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>d&&typeof d.name==='string'?{name:d.name,role:String(d.role)}:null).catch(()=>null);

/** The server sets this readable cookie on sign-in and clears it on sign-out; it only says whether a `me` probe is worth making and is never proof of access. */
const hasHint=()=>/(?:^|;\s*)aiot_member_hint=1(?:;|$)/.test(document.cookie);
/** 401 is a definite "anonymous". A 429, 5xx or network error is "unknown": retry with backoff, then fall back to anonymous. */
async function probeMember(live:()=>boolean):Promise<MemberMe|null>{
 for(const wait of [0,600,1800]){
  if(wait)await new Promise(r=>setTimeout(r,wait));if(!live())return null;
  try{return await memberAuth.me();}catch(e){if(e instanceof OpsError&&e.status===401)return null;}
 }
 return null;
}
/** Gated routes. A grant opens the page for a signed-in member; `null` pages need the staff workspace or the desktop app, so no grant opens them in the cloud. */
const GATES:Record<string,MemberGrant|null>={'/products':'products','/builders':'builders','/bench':'bench','/arena':'arena','/build':null,'/sites':null,'/site':null,'/design':null};
const gateKey=(to:string)=>Object.keys(GATES).find(p=>to===p||to.startsWith(p+'/')||to.startsWith(p+'?'));
export const isGated=(to:string)=>gateKey(to)!==undefined;
/** The grants a member can hold, with the page each one opens (profile cards). */
export const AREAS:{grant:Exclude<MemberGrant,'installer'>;to:string;en:string;id:string;dEn:string;dId:string}[]=[
 {grant:'products',to:'/products',en:'Tested products',id:'Produk teruji',dEn:'Distributor devices with test evidence and localization status.',dId:'Perangkat distributor dengan bukti uji dan status lokalisasi.'},
 {grant:'bench',to:'/bench',en:'PhysicalBench',id:'PhysicalBench',dEn:'Benchmark of agents against real hardware.',dId:'Tolok ukur agen terhadap hardware nyata.'},
 {grant:'arena',to:'/arena',en:'Arena',id:'Arena',dEn:'Hardware challenges for agents and people.',dId:'Tantangan hardware untuk agen dan manusia.'},
 {grant:'builders',to:'/builders',en:'Builders',id:'Builders',dEn:'The community of people building and testing on AIoT.',dId:'Komunitas pembuat dan penguji di AIoT.'},
];

type Access={/** true while the visitor has no staff preview (public host only): invitation-only views apply unless a member grant opens them. */locked:boolean;/** the staff member presenting, when preview is on. */preview:Preview|null;/** true on iot.ai.id and its alias, signed in or not. */publicHost:boolean;asPublic:boolean;setAsPublic:(v:boolean)=>void;/** the signed-in member (null when anonymous). */member:MemberMe|null;/** false until the first member probe has answered. */ready:boolean;setMember:(m:MemberMe|null)=>void;/** whether the visitor may open or see a link to this route. */can:(to:string)=>boolean};
const Ctx=createContext<Access>({locked:false,preview:null,publicHost:false,asPublic:false,setAsPublic:()=>{},member:null,ready:true,setMember:()=>{},can:()=>true});
export function PreviewProvider({children}:{children:ReactNode}){
 const publicHost=isPublicHost();const[me,setMe]=useState<Preview|null>(null);const[asPublic,setAsPublic]=useState(false);const[member,setMember]=useState<MemberMe|null>(null);const[ready,setReady]=useState(()=>!publicHost||!hasHint());
 useEffect(()=>{if(!publicHost)return;let live=true;detect().then(p=>{if(live)setMe(p);});return()=>{live=false;};},[publicHost]);
 // Member state lives in memory only: probed once per page and only when the hint cookie is present (anonymous visitors cost no request), then replaced by the sign-in and sign-out responses.
 useEffect(()=>{if(!publicHost||!hasHint())return;let live=true;probeMember(()=>live).then(m=>{if(live){setMember(m);setReady(true);}});return()=>{live=false;};},[publicHost]);
 const value=useMemo<Access>(()=>{
  const locked=publicHost&&(!me||asPublic),seen=asPublic?null:member;
  const can=(to:string)=>{const key=gateKey(to);if(!publicHost||key===undefined||!locked)return true;const grant=GATES[key];return !!grant&&!!seen?.grants.includes(grant);};
  return{publicHost,preview:me,asPublic,setAsPublic,locked,member:seen,ready,setMember,can};
 },[publicHost,me,asPublic,member,ready]);
 return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAccess=()=>useContext(Ctx);

export function InstallerButton({size}:{size?:'sm'}){
 const{tr}=useLang();
 return <AnchorButton href={INSTALLER_PATH} size={size} data-testid="installer-button" data-cta="installer"><DownloadSimpleIcon aria-hidden="true"/> {tr('Download the installer','Unduh installer')}</AnchorButton>;
}

const waInvite=(name:string)=>waLink(`Halo AIoT, saya ingin meminta akses ke ${name}.`);
/** The invitation-only block. `inline` renders just the block (for a section); otherwise a full page with the shared header and footer. `api` areas need the workspace, which runs in the desktop app (the cloud /api is owner-only). */
export function InvitationOnly({name,kind='partner',inline,api,workspace}:{name:[string,string];kind?:'partner'|'school';inline?:boolean;api?:boolean;/** Staff preview: the real page needs /api, so link to the admin workspace instead. */workspace?:string}){
 const{tr}=useLang();const{preview,member}=useAccess();
 const cta=kind==='school'?'/partner?kind=school':'/partner';
 const staff=!!(workspace&&preview),desktop=!!(api&&member&&!staff);
 const request=<LinkButton to={cta} data-cta="invite-request">{tr('Request access','Minta akses')}</LinkButton>;
 const title=desktop?tr(`${name[0]} runs in the desktop app.`,`${name[1]} berjalan di aplikasi desktop.`):tr(`${name[0]} is invitation-only.`,`${name[1]} khusus untuk anggota undangan.`);
 const body=staff?tr('Presentation mode: this page needs the staff workspace. It is not open to members yet.','Mode presentasi: halaman ini memerlukan workspace staf dan belum dibuka untuk anggota.')
  :desktop?tr('This workspace works with your own machine (USB boards, local files), so it runs in the AIoT desktop app instead of the browser.','Workspace ini bekerja dengan perangkat Anda sendiri (board USB, berkas lokal), jadi berjalan di aplikasi desktop AIoT, bukan di browser.')
  :member?tr('Your account does not include this area yet. Ask us to add it.','Akun Anda belum mencakup area ini. Minta kami menambahkannya.')
  :tr('We are opening AIoT to partners and schools in stages. Invited members sign in to see it.','Kami membuka AIoT bertahap untuk mitra dan sekolah. Anggota undangan masuk untuk melihatnya.');
 const actions=staff?<AnchorButton href={adminOrigin()+workspace} data-cta="invite-workspace">{tr('Open in workspace','Buka di workspace')} <ArrowUpRightIcon aria-hidden="true"/></AnchorButton>
  :desktop?(member?.grants.includes('installer')?<InstallerButton/>:request)
  :<>{request}<LinkButton to={member?'/profile':'/masuk'} variant="secondary" data-cta="invite-signin">{member?tr('Your profile','Profil Anda'):tr('Sign in','Masuk')}</LinkButton></>;
 const block=<EmptyState eyebrow={tr('By invitation','Khusus undangan')} title={inline?title:desktop?tr('Get the desktop app','Dapatkan aplikasi desktop'):tr('Sign in or request access','Masuk atau minta akses')} action={<>{actions}<a className="ds-button ds-button--secondary" href={waInvite(name[1])} target="_blank" rel="noopener" data-cta="invite-whatsapp">WhatsApp</a></>}>{body}</EmptyState>;
 if(inline)return <div className="invite invite--inline" data-testid="invitation-only">{block}</div>;
 return <PageShell width="narrow" eyebrow={tr('AIoT / by invitation','AIoT / khusus undangan')} title={title} lead={tr('This part of AIoT is open to invited members. Meanwhile, partner with us.','Bagian AIoT ini terbuka untuk anggota undangan. Sementara itu, bermitra dengan kami.')}><div className="invite" data-testid="invitation-only">{block}</div></PageShell>;
}

/** Wraps a route: real page when unlocked (localhost, desktop, admin host, staff preview, or a member with the grant), invitation-only otherwise. `api` pages cannot call /api from the public host, so even in preview they point to the workspace. */
export function Gated({name,kind,api,children}:{name:[string,string];kind?:'partner'|'school';api?:boolean;children:ReactNode}){
 const{publicHost,ready,locked,preview,can}=useAccess();const{pathname,search}=useLocation();const path=pathname+search;
 if(!publicHost)return <>{children}</>;
 if(!ready)return null;
 if(api||!can(pathname))return <InvitationOnly name={name} kind={kind} api={api} workspace={api&&preview&&!locked?path:undefined}/>;
 return <>{children}</>;
}

/** Header entry on the public host: "Sign in" for visitors, the member's name (linking to the profile) once signed in. */
export function MemberLink({onNavigate}:{onNavigate?:()=>void}){
 const{tr}=useLang();const{publicHost,ready,member}=useAccess();
 if(!publicHost||!ready)return null;
 return member?<Link className="ds-signin" to="/profile" onClick={onNavigate} data-testid="member-link" aria-label={tr(`Profile of ${member.name}`,`Profil ${member.name}`)}>{member.name}</Link>:<Link className="ds-signin" to="/masuk" onClick={onNavigate} data-testid="signin-link">{tr('Sign in','Masuk')}</Link>;
}

/** Fixed pill while presenting: who is signed in, a view-as-public toggle (memory only) and the way back to admin. */
export function PreviewPill(){
 const{tr}=useLang();const{preview,asPublic,setAsPublic}=useAccess();
 if(!preview)return null;
 return <aside className="preview-pill" role="status" aria-label={tr('Presentation mode','Mode presentasi')} data-testid="preview-pill">
  <Eyebrow as="span">{tr('Presentation mode','Mode presentasi')} · {preview.name}</Eyebrow>
  <Button size="sm" variant="secondary" aria-pressed={asPublic} onClick={()=>setAsPublic(!asPublic)}>{asPublic?tr('Back to preview','Kembali ke preview'):tr('View as public','Lihat sebagai publik')}</Button>
  <a href={adminOrigin()+'/'}>{tr('Admin','Admin')} <ArrowUpRightIcon size={12} aria-hidden="true"/></a>
 </aside>;
}
