import React,{useEffect,lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Route,Routes,useLocation} from 'react-router-dom';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/500.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo/800.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './design/tokens.css';
import './styles.css';
import './experience.css';
import {SchoolWorkbench} from './school-workbench';
import {Landing} from './landing-new';
import {LandingID} from './pages/landing-id';
import {Backoffice} from './backoffice';
import {LangProvider,useLang} from './i18n';
import {Spinner} from './ui';
import {Build} from './pages/build-page';
import {Hardware,HardwareDetail} from './pages/hardware-pages';
import {Partner,Products} from './pages/partner-page';
import {ConsentBanner,useTracking} from './analytics';
import {Bench,Arena,ArenaDetail,Builders,Research,Docs,Learn,EpisodePage,NotFound} from './pages/content-pages';
const LazyDesignSystem=lazy(()=>import('./design-page').then(m=>({default:m.DesignSystemPage})));
function DesignSystem(){return <Suspense fallback={null}><LazyDesignSystem/></Suspense>;}
const LazySites=lazy(()=>import('./site-workbench').then(m=>({default:m.Sites})));
const LazySiteWorkbench=lazy(()=>import('./site-workbench').then(m=>({default:m.SiteWorkbench})));
function RouteLoading({en,id}:{en:string;id:string}){const{tr}=useLang();return <div className="route-loading"><Spinner label={tr(en,id)}/><span>{tr(en,id)}</span></div>;}
function Sites(){return <Suspense fallback={<RouteLoading en="Loading sites…" id="Memuat lokasi…"/>}><LazySites/></Suspense>;}
function SiteWorkbench(){return <Suspense fallback={<RouteLoading en="Loading canvas…" id="Memuat canvas…"/>}><LazySiteWorkbench/></Suspense>;}
function Home(){return <Landing/>;}
const SITE_TITLE='AIoT';
const routeTitles:[RegExp,string][]=[[/^\/$/,'AIoT — The real-world gateway for AI robotics in Indonesia.'],[/^\/id\/?$/,'Program Lab Mitra SMK — pelatihan IoT & tugas uji berbayar | AIoT'],[/^\/hardware\/?$/,'Hardware library'],[/^\/partner\/?$/,'Partner with us'],[/^\/products\/?$/,'Tested products'],[/^\/learn\/?$/,'Learn'],[/^\/docs\/?$/,'Documentation'],[/^\/api\/?$/,'API'],[/^\/research\/?$/,'Research'],[/^\/bench\/?$/,'PhysicalBench'],[/^\/arena\/?$/,'Hardware Arena'],[/^\/arena\/[^/]+/,'Arena challenge'],[/^\/builders\/?$/,'Builders'],[/^\/build\/?$/,'Build'],[/^\/sites\/?$/,'Sites'],[/^\/site\//,'Site workbench'],[/^\/project\/[^/]+\/episode/,'Episode'],[/^\/project\//,'Project'],[/^\/backoffice/,'Backoffice'],[/^\/design\/?$/,'Design system']];
function useRouteTitle(){
 const {pathname}=useLocation();
 useEffect(()=>{
  const hw=pathname.match(/^\/hardware\/([a-z0-9-]+)\/?$/);
  if(hw){let live=true;document.title=`Hardware reference | ${SITE_TITLE}`;import('../../../packages/hardware-library/index').then(({hardwareLibrary})=>{if(!live)return;const name=hardwareLibrary.find(h=>h.id===hw[1])?.name;document.title=name?`${name} — specifications, pinout and limits | ${SITE_TITLE}`:`Hardware not found | ${SITE_TITLE}`;});return()=>{live=false;};}
  const match=routeTitles.find(([re])=>re.test(pathname));
  document.title=!match?`Not found | ${SITE_TITLE}`:pathname==='/'||match[1].endsWith(SITE_TITLE)?match[1]:`${match[1]} | ${SITE_TITLE}`;
 },[pathname]);
}
function App(){useRouteTitle();const{pathname}=useLocation();useTracking(pathname);return <><Routes><Route path="/partner" element={<Partner/>}/><Route path="/products" element={<Products/>}/><Route path="/" element={<Home/>}/><Route path="/id" element={<LandingID/>}/><Route path="/build" element={<Build/>}/><Route path="/sites" element={<Sites/>}/><Route path="/site/:id" element={<SiteWorkbench/>}/><Route path="/site/:id/area/:areaId" element={<SiteWorkbench/>}/><Route path="/learn" element={<Learn/>}/><Route path="/backoffice" element={<Backoffice/>}/><Route path="/project/:id/episode" element={<EpisodePage/>}/><Route path="/project/:id" element={<SchoolWorkbench/>}/><Route path="/hardware" element={<Hardware/>}/><Route path="/hardware/:slug" element={<HardwareDetail/>}/><Route path="/bench" element={<Bench/>}/><Route path="/arena" element={<Arena/>}/><Route path="/arena/:id" element={<ArenaDetail/>}/><Route path="/builders" element={<Builders/>}/><Route path="/research" element={<Research/>}/><Route path="/docs" element={<Docs/>}/><Route path="/api" element={<Docs apiOverview/>}/><Route path="/design" element={<DesignSystem/>}/><Route path="*" element={<NotFound/>}/></Routes><ConsentBanner/></>;}
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><LangProvider><App/></LangProvider></BrowserRouter></React.StrictMode>);
