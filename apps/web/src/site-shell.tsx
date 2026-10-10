import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Link,NavLink,useLocation} from 'react-router-dom';
import {ArrowUpRightIcon,CaretDownIcon,CircuitryIcon,ListIcon,XIcon} from '@phosphor-icons/react';
import {useLang} from './i18n';
import {AnchorButton,LangToggle,PageHeader} from './ui';
import './site-shell.css';

export const PARTNERSHIP_BRIEF='/partnership-brief.txt';
export const RELEASES='https://github.com/dansya-arsana/iot-ai-id/releases/tag/v0.1.0-preview.1';
export const REPOSITORY='https://github.com/dansya-arsana/iot-ai-id';

type NavItem={to:string;en:string;id:string};
const primary:NavItem[]=[
 {to:'/#scenarios',en:'Scenarios',id:'Skenario'},
 {to:'/hardware',en:'Hardware',id:'Hardware'},
 {to:'/learn',en:'Learn',id:'Belajar'},
 {to:'/docs',en:'Docs',id:'Dokumentasi'},
];
const groups:{en:string;id:string;items:NavItem[]}[]=[
 {en:'Workspace',id:'Workspace',items:[{to:'/build',en:'Build',id:'Bangun'},{to:'/sites',en:'Sites',id:'Lokasi'},{to:'/api',en:'API',id:'API'}]},
 {en:'Evidence & community',id:'Bukti & komunitas',items:[{to:'/research',en:'Research',id:'Riset'},{to:'/bench',en:'PhysicalBench',id:'PhysicalBench'},{to:'/arena',en:'Arena',id:'Arena'},{to:'/builders',en:'Builders',id:'Builders'}]},
];

export function Brand({wordmark=true}:{wordmark?:boolean}){
 return <Link to="/" className="ds-brand" aria-label="iot.ai.id home"><span className="ds-brand-mark"><CircuitryIcon size={20} weight="bold"/></span>{wordmark&&<span>iot.ai.id</span>}</Link>;
}
function Item({item,onNavigate}:{item:NavItem;onNavigate?:()=>void}){
 const{tr}=useLang();
 if(item.to.includes('#'))return <Link to={item.to} onClick={onNavigate}>{tr(item.en,item.id)}</Link>;
 return <NavLink to={item.to} onClick={onNavigate}>{tr(item.en,item.id)}</NavLink>;
}

/** Shared site header. `overlay` floats it transparently over a full-bleed hero. */
export function SiteHeader({overlay,className,...rest}:{overlay?:boolean;className?:string;'data-enter'?:boolean}){
 const{tr}=useLang();const{pathname}=useLocation();
 const ref=useRef<HTMLElement>(null);const[menu,setMenu]=useState(false);const[resources,setResources]=useState(false);
 const resourcesActive=groups.some(g=>g.items.some(i=>pathname===i.to||pathname.startsWith(i.to+'/')));

 useEffect(()=>{
  const outside=(e:PointerEvent)=>{if(e.target instanceof Node&&!ref.current?.contains(e.target)){setMenu(false);setResources(false);}};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setMenu(false);setResources(false);}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[]);
 return <header ref={ref} className={['ds-header',overlay&&'ds-header--overlay',className].filter(Boolean).join(' ')} {...(rest['data-enter']?{'data-enter':''}:{})}>
  <Brand/>
  <nav className="ds-nav" aria-label={tr('Main','Utama')}>
   {primary.map(i=><Item key={i.to} item={i}/>)}
   <div className="ds-nav-resources">
    <button type="button" aria-expanded={resources} aria-controls="ds-resources" aria-current={resourcesActive?'true':undefined} onClick={()=>setResources(!resources)}>{tr('Resources','Sumber daya')} <CaretDownIcon size={13} aria-hidden="true"/></button>
    {resources&&<div id="ds-resources" className="ds-menu">{groups.map(g=><div key={g.en}><span>{tr(g.en,g.id)}</span>{g.items.map(i=><Item key={i.to} item={i} onNavigate={()=>setResources(false)}/>)}</div>)}</div>}
   </div>
  </nav>
  <div className="ds-header-actions"><LangToggle/><AnchorButton href={PARTNERSHIP_BRIEF} download>{tr('Partner with us','Jadi partner')}</AnchorButton></div>
  <button type="button" className="ds-menu-toggle" aria-expanded={menu} aria-controls="ds-mobile-menu" aria-label={menu?tr('Close menu','Tutup menu'):tr('Open menu','Buka menu')} onClick={()=>setMenu(!menu)}>{menu?<XIcon size={18}/>:<ListIcon size={18}/>}</button>
  {menu&&<nav id="ds-mobile-menu" className="ds-mobile-menu" aria-label={tr('Mobile','Mobile')}>
   {primary.map(i=><Item key={i.to} item={i} onNavigate={()=>setMenu(false)}/>)}
   {groups.map(g=><div key={g.en} className="ds-mobile-group"><span>{tr(g.en,g.id)}</span>{g.items.map(i=><Item key={i.to} item={i} onNavigate={()=>setMenu(false)}/>)}</div>)}
   <div className="ds-mobile-foot"><LangToggle/><AnchorButton href={PARTNERSHIP_BRIEF} download size="sm">{tr('Partner with us','Jadi partner')}</AnchorButton></div>
  </nav>}
 </header>;
}

export function SiteFooter({className,...rest}:{className?:string;'data-enter'?:boolean}){
 const{tr}=useLang();
 return <footer className={['ds-footer',className].filter(Boolean).join(' ')} {...(rest['data-enter']?{'data-enter':''}:{})}>
  <div className="ds-footer-brand"><Brand/><p>{tr('Real-world hardware verification from Indonesia.','Verifikasi hardware di dunia nyata, dari Indonesia.')}</p></div>
  <nav aria-label={tr('Footer','Footer')}>
   <div><span>{tr('Explore','Jelajahi')}</span><Link to="/#scenarios">{tr('Scenarios','Skenario')}</Link><Link to="/hardware">{tr('Hardware library','Pustaka hardware')}</Link><Link to="/learn">{tr('Learn','Belajar')}</Link></div>
   <div><span>{tr('Build','Bangun')}</span><Link to="/docs">{tr('Docs','Dokumentasi')}</Link><Link to="/api">API</Link><a href={RELEASES}>{tr('Desktop app','Aplikasi desktop')}</a></div>
   <div><span>{tr('Company','Perusahaan')}</span><a href={PARTNERSHIP_BRIEF} download>{tr('Partnership brief','Partnership brief')}</a><Link to="/research">{tr('Research','Riset')}</Link><a href={REPOSITORY}>GitHub <ArrowUpRightIcon size={12}/></a></div>
  </nav>
  <div className="ds-footer-bottom"><span>{tr('INDONESIA · TESTED WHERE IT MATTERS.','INDONESIA · DIUJI DI TEMPAT YANG PENTING.')}</span><span>© 2026 iot.ai.id</span></div>
 </footer>;
}

/** Standard content page: shared header, page header, body and footer. */
export function PageShell({eyebrow,title,lead,actions,children,width='default'}:{eyebrow?:ReactNode;title:ReactNode;lead?:ReactNode;actions?:ReactNode;children:ReactNode;width?:'default'|'narrow'|'wide'}){
 return <div className="ds-app"><SiteHeader/><main id="main" className={`ds-page ds-page--${width}`}><PageHeader eyebrow={eyebrow} title={title} lead={lead} actions={actions}/>{children}</main><SiteFooter/></div>;
}
