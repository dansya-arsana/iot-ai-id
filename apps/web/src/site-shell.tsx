import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Link,NavLink,useLocation} from 'react-router-dom';
import {ArrowUpRightIcon,CaretDownIcon,ListIcon,XIcon} from '@phosphor-icons/react';
import {useLang} from './i18n';
import {LangToggle,LinkButton,PageHeader} from './ui';
import {DotMark} from './brand/dot-mark';
import {rememberRegion} from './region';
import {isGated,MemberLink,useAccess} from './preview';
import './site-shell.css';

export const PARTNERSHIP_BRIEF='/partnership-brief.txt';
export const RELEASES='https://github.com/dansya-arsana/iot-ai-id/releases/tag/v0.1.0-preview.1';
export const REPOSITORY='https://github.com/dansya-arsana/iot-ai-id';

type NavItem={to:string;en:string;id:string};
const primary:NavItem[]=[
 {to:'/#scenarios',en:'Scenarios',id:'Skenario'},
 {to:'/hardware',en:'Hardware',id:'Hardware'},
 {to:'/products',en:'Products',id:'Produk'},
 {to:'/learn',en:'Learn',id:'Belajar'},
 {to:'/docs',en:'Docs',id:'Dokumentasi'},
];
const groups:{en:string;id:string;items:NavItem[]}[]=[
 {en:'Workspace',id:'Workspace',items:[{to:'/build',en:'Build',id:'Bangun'},{to:'/sites',en:'Sites',id:'Lokasi'},{to:'/api',en:'API',id:'API'}]},
 {en:'Evidence & community',id:'Bukti & komunitas',items:[{to:'/research',en:'Research',id:'Riset'},{to:'/bench',en:'PhysicalBench',id:'PhysicalBench'},{to:'/arena',en:'Arena',id:'Arena'},{to:'/builders',en:'Builders',id:'Builders'}]},
];

export function Brand({wordmark=true}:{wordmark?:boolean}){
 return <Link to="/" className="ds-brand" aria-label="AIoT home"><DotMark className="ds-brand-mark" label=""/>{wordmark&&<span>AIoT</span>}</Link>;
}
/** Visitors do not see links to areas they cannot open: members see the areas they hold, presenting staff see everything with a small marker. */
function useVisible(){
 const{publicHost,locked,can}=useAccess();
 const show=(i:NavItem)=>can(i.to);
 const mark=publicHost&&!locked;
 const grouped=groups.map(g=>({...g,items:g.items.filter(show)})).filter(g=>g.items.length);
 const flat=grouped.flatMap(g=>g.items);
 // With two or fewer entries left a dropdown is pointless: they become plain nav links.
 return{mark,primary:primary.filter(show),grouped,flat,collapse:flat.length<=2};
}
function Item({item,onNavigate,mark}:{item:NavItem;onNavigate?:()=>void;mark?:boolean}){
 const{tr}=useLang();
 const label=<>{tr(item.en,item.id)}{mark&&isGated(item.to)&&<span className="ds-preview-tag">{tr('Preview','Preview')}</span>}</>;
 if(item.to.includes('#'))return <Link to={item.to} onClick={onNavigate}>{label}</Link>;
 return <NavLink to={item.to} onClick={onNavigate}>{label}</NavLink>;
}

/** Shared site header. `overlay` floats it transparently over a full-bleed hero. */
export function SiteHeader({overlay,className,...rest}:{overlay?:boolean;className?:string;'data-enter'?:boolean}){
 const{tr}=useLang();const{pathname}=useLocation();
 const ref=useRef<HTMLElement>(null);const[menu,setMenu]=useState(false);const[resources,setResources]=useState(false);
 const vis=useVisible();
 const resourcesActive=vis.grouped.some(g=>g.items.some(i=>pathname===i.to||pathname.startsWith(i.to+'/')));

 useEffect(()=>{const el=ref.current;if(!el)return;const onScroll=()=>el.toggleAttribute('data-scrolled',window.scrollY>8);onScroll();window.addEventListener('scroll',onScroll,{passive:true});return()=>window.removeEventListener('scroll',onScroll);},[]);
 useEffect(()=>{
  const outside=(e:PointerEvent)=>{if(e.target instanceof Node&&!ref.current?.contains(e.target)){setMenu(false);setResources(false);}};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setMenu(false);setResources(false);}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[]);
 return <header ref={ref} className={['ds-header',overlay&&'ds-header--overlay',className].filter(Boolean).join(' ')} {...(rest['data-enter']?{'data-enter':''}:{})}>
  <Brand/>
  <nav className="ds-nav" aria-label={tr('Main','Utama')}>
   {vis.primary.map(i=><Item key={i.to} item={i} mark={vis.mark}/>)}
   {vis.collapse?vis.flat.map(i=><Item key={i.to} item={i} mark={vis.mark}/>):<div className="ds-nav-resources">
    <button type="button" aria-expanded={resources} aria-controls="ds-resources" aria-current={resourcesActive?'true':undefined} onClick={()=>setResources(!resources)}>{tr('Resources','Sumber daya')} <CaretDownIcon size={13} aria-hidden="true"/></button>
    {resources&&<div id="ds-resources" className="ds-menu">{vis.grouped.map(g=><div key={g.en}><span>{tr(g.en,g.id)}</span>{g.items.map(i=><Item key={i.to} item={i} mark={vis.mark} onNavigate={()=>setResources(false)}/>)}</div>)}</div>}
   </div>}
  </nav>
  <div className="ds-header-actions"><MemberLink/><LangToggle/><LinkButton to="/partner" data-cta="header-partner">{tr('Partner with us','Jadi partner')}</LinkButton></div>
  <button type="button" className="ds-menu-toggle" aria-expanded={menu} aria-controls="ds-mobile-menu" aria-label={menu?tr('Close menu','Tutup menu'):tr('Open menu','Buka menu')} onClick={()=>setMenu(!menu)}>{menu?<XIcon size={18}/>:<ListIcon size={18}/>}</button>
  {menu&&<nav id="ds-mobile-menu" className="ds-mobile-menu" aria-label={tr('Mobile','Mobile')}>
   {vis.primary.map(i=><Item key={i.to} item={i} mark={vis.mark} onNavigate={()=>setMenu(false)}/>)}
   {vis.grouped.map(g=><div key={g.en} className="ds-mobile-group"><span>{tr(g.en,g.id)}</span>{g.items.map(i=><Item key={i.to} item={i} mark={vis.mark} onNavigate={()=>setMenu(false)}/>)}</div>)}
   <div className="ds-mobile-foot"><LangToggle/><MemberLink onNavigate={()=>setMenu(false)}/><LinkButton to="/partner" size="sm" data-cta="menu-partner">{tr('Partner with us','Jadi partner')}</LinkButton></div>
  </nav>}
 </header>;
}

export function SiteFooter({className,...rest}:{className?:string;'data-enter'?:boolean}){
 const{tr}=useLang();const{publicHost,preview,member,can}=useAccess();
 return <footer className={['ds-footer',className].filter(Boolean).join(' ')} {...(rest['data-enter']?{'data-enter':''}:{})}>
  <div className="ds-footer-brand"><Brand/><p>{tr('The real-world gateway for AI robotics in Indonesia.','Gerbang AI robotika ke Indonesia.')}</p></div>
  <nav aria-label={tr('Footer','Footer')}>
   <div><span>{tr('Explore','Jelajahi')}</span><Link to="/#scenarios">{tr('Scenarios','Skenario')}</Link><Link to="/hardware">{tr('Hardware library','Pustaka hardware')}</Link><Link to="/learn">{tr('Learn','Belajar')}</Link></div>
   <div><span>{tr('Build','Bangun')}</span><Link to="/docs">{tr('Docs','Dokumentasi')}</Link><Link to="/api">API</Link>{/* The public host does not link the release assets: members get the installer from their profile. */}{publicHost&&!preview?(member?<Link to="/profile">{tr('Desktop app (profile)','Aplikasi desktop (profil)')}</Link>:<Link to="/partner">{tr('Desktop app: request access','Aplikasi desktop: minta akses')}</Link>):<a href={RELEASES}>{tr('Desktop app','Aplikasi desktop')}</a>}</div>
   <div><span>{tr('Company','Perusahaan')}</span><Link to="/partner">{tr('Partner with us','Jadi partner')}</Link>{can('/products')&&<Link to="/products">{tr('Tested products','Produk teruji')}</Link>}<a href={PARTNERSHIP_BRIEF} download>{tr('Partnership brief','Partnership brief')}</a><Link to="/research">{tr('Research','Riset')}</Link><a href={REPOSITORY}>GitHub <ArrowUpRightIcon size={12}/></a><Link to="/id" hrefLang="id" onClick={()=>rememberRegion('id')}>{tr('Indonesia: SMK program','Program SMK Indonesia')}</Link><Link to="/mitra">{tr('Lab Mitra portal sign in','Masuk portal mitra')}</Link></div>
  </nav>
  <div className="ds-footer-bottom"><span>{tr('TESTED IN INDONESIA. READY FOR INDONESIA.','DIUJI DI LAPANGAN. SIAP DIPASARKAN.')}</span><span>© 2026 AIoT · iot.ai.id</span></div>
 </footer>;
}

/** Standard content page: shared header, page header, body and footer. */
export function PageShell({eyebrow,title,lead,actions,children,width='default'}:{eyebrow?:ReactNode;title:ReactNode;lead?:ReactNode;actions?:ReactNode;children:ReactNode;width?:'default'|'narrow'|'wide'}){
 return <div className="ds-app"><SiteHeader/><main id="main" className={`ds-page ds-page--${width}`}><PageHeader eyebrow={eyebrow} title={title} lead={lead} actions={actions}/>{children}</main><SiteFooter/></div>;
}
