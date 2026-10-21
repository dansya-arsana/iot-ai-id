import React,{useEffect,lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Navigate,Route,Routes,useLocation} from 'react-router-dom';
import {isAdminHost} from './host';
import {Gated,PreviewPill,PreviewProvider} from './preview';
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
import {Mitra} from './pages/mitra-page';
import {MemberLogin,Profile} from './pages/member-pages';
import {AdminGate} from './admin-gate';
import {ConsentBanner,useTracking} from './analytics';
import {Bench,Arena,ArenaDetail,Builders,Research,Docs,Learn,EpisodePage,NotFound} from './pages/content-pages';
const LazyDesignSystem=lazy(()=>import('./design-page').then(m=>({default:m.DesignSystemPage})));
function DesignSystem(){return <Suspense fallback={null}><LazyDesignSystem/></Suspense>;}
const LazySites=lazy(()=>import('./site-workbench').then(m=>({default:m.Sites})));
const LazySiteWorkbench=lazy(()=>import('./site-workbench').then(m=>({default:m.SiteWorkbench})));
function RouteLoading({en,id}:{en:string;id:string}){const{tr}=useLang();return <div className="route-loading"><Spinner label={tr(en,id)}/><span>{tr(en,id)}</span></div>;}
const LazyLab=lazy(()=>import('./lab/lab-page').then(m=>({default:m.LabPage})));
function Lab(){return <Suspense fallback={<RouteLoading en="Loading lab…" id="Memuat lab…"/>}><LazyLab/></Suspense>;}
function Sites(){return <Suspense fallback={<RouteLoading en="Loading sites…" id="Memuat lokasi…"/>}><LazySites/></Suspense>;}
function SiteWorkbench(){return <Suspense fallback={<RouteLoading en="Loading canvas…" id="Memuat canvas…"/>}><LazySiteWorkbench/></Suspense>;}
function Home(){return <Landing/>;}
const SITE_TITLE='AIoT';
const routeTitles:[RegExp,string][]=[[/^\/$/,'AIoT — The real-world gateway for AI robotics in Indonesia.'],[/^\/id\/?$/,'Program Lab Mitra SMK — pelatihan IoT & tugas uji berbayar | AIoT'],[/^\/hardware\/?$/,'Hardware library'],[/^\/partner\/?$/,'Partner with us'],[/^\/mitra\/?$/,'Lab Mitra portal'],[/^\/(masuk|login)\/?$/,'Sign in'],[/^\/(profile|profil)\/?$/,'Profile'],[/^\/products\/?$/,'Tested products'],[/^\/learn\/?$/,'Learn'],[/^\/lab\/?$/,'Arduino lab'],[/^\/lab\/[^/]+/,'Arduino lab lesson'],[/^\/docs\/?$/,'Documentation'],[/^\/api\/?$/,'API'],[/^\/research\/?$/,'Research'],[/^\/bench\/?$/,'PhysicalBench'],[/^\/arena\/?$/,'Hardware Arena'],[/^\/arena\/[^/]+/,'Arena challenge'],[/^\/builders\/?$/,'Builders'],[/^\/build\/?$/,'Build'],[/^\/sites\/?$/,'Sites'],[/^\/site\//,'Site workbench'],[/^\/project\/[^/]+\/episode/,'Episode'],[/^\/project\//,'Project'],[/^\/backoffice/,'Backoffice'],[/^\/design\/?$/,'Design system']];
function useRouteTitle(){
 const {pathname}=useLocation();
 useEffect(()=>{
  const hw=pathname.match(/^\/hardware\/([a-z0-9-]+)\/?$/);
  if(hw){let live=true;document.title=`Hardware reference | ${SITE_TITLE}`;import('../../../packages/hardware-library/index').then(({hardwareLibrary})=>{if(!live)return;const name=hardwareLibrary.find(h=>h.id===hw[1])?.name;document.title=name?`${name} — specifications, pinout and limits | ${SITE_TITLE}`:`Hardware not found | ${SITE_TITLE}`;});return()=>{live=false;};}
  const match=routeTitles.find(([re])=>re.test(pathname));
  if(isAdminHost()&&pathname==='/')return;// AdminGate sets the title: Admin while signed out, Backoffice once in.
  document.title=!match?`Not found | ${SITE_TITLE}`:pathname==='/'||match[1].endsWith(SITE_TITLE)?match[1]:`${match[1]} | ${SITE_TITLE}`;
 },[pathname]);
}
/** Old admin.iot.ai.id/backoffice links land on the admin root, keeping the section hash. */
function AdminRoot(){const{hash}=useLocation();return <Navigate to={{pathname:'/',hash}} replace/>;}
function App(){useRouteTitle();const{pathname}=useLocation();useTracking(pathname);return <><Routes><Route path="/partner" element={<Partner/>}/><Route path="/products" element={<Gated name={['Products','Produk']}><Products/></Gated>}/><Route path="/mitra" element={<Mitra/>}/><Route path="/masuk" element={<MemberLogin/>}/><Route path="/login" element={<MemberLogin/>}/><Route path="/profile" element={<Profile/>}/><Route path="/profil" element={<Profile/>}/><Route path="/" element={isAdminHost()?<AdminGate/>:<Home/>}/><Route path="/id" element={<LandingID/>}/><Route path="/build" element={<Gated api name={['Build','Build']}><Build/></Gated>}/><Route path="/sites" element={<Gated api name={['Sites','Lokasi']}><Sites/></Gated>}/><Route path="/site/:id" element={<Gated api name={['Sites','Lokasi']}><SiteWorkbench/></Gated>}/><Route path="/site/:id/area/:areaId" element={<Gated api name={['Sites','Lokasi']}><SiteWorkbench/></Gated>}/><Route path="/learn" element={<Learn/>}/><Route path="/lab" element={<Lab/>}/><Route path="/lab/:lesson" element={<Lab/>}/><Route path="/backoffice" element={isAdminHost()?<AdminRoot/>:<Backoffice/>}/><Route path="/project/:id/episode" element={<EpisodePage/>}/><Route path="/project/:id" element={<SchoolWorkbench/>}/><Route path="/hardware" element={<Hardware/>}/><Route path="/hardware/:slug" element={<HardwareDetail/>}/><Route path="/bench" element={<Gated name={['PhysicalBench','PhysicalBench']}><Bench/></Gated>}/><Route path="/arena" element={<Gated name={['Arena','Arena']}><Arena/></Gated>}/><Route path="/arena/:id" element={<Gated name={['Arena','Arena']}><ArenaDetail/></Gated>}/><Route path="/builders" element={<Gated name={['Builders','Builders']}><Builders/></Gated>}/><Route path="/research" element={<Research/>}/><Route path="/docs" element={<Docs/>}/><Route path="/api" element={<Docs apiOverview/>}/><Route path="/design" element={<Gated name={['Design system','Design system']}><DesignSystem/></Gated>}/><Route path="*" element={<NotFound/>}/></Routes><PreviewPill/><ConsentBanner/></>;}
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><LangProvider><PreviewProvider><App/></PreviewProvider></LangProvider></BrowserRouter></React.StrictMode>);
