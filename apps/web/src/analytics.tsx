/** Consent-gated ad conversion tracking. Inert unless VITE_GA4_ID or VITE_META_PIXEL_ID is set at build time; nothing loads before the visitor accepts. */
import {useEffect,useState} from 'react';
import {useLang} from './i18n';
import {Button} from './ui';

type Gtag=(...args:unknown[])=>void;
declare global{interface Window{dataLayer?:unknown[];gtag?:Gtag;fbq?:Gtag&{queue?:unknown[];loaded?:boolean;version?:string;push?:Gtag;callMethod?:Gtag}}}
const GA=import.meta.env.VITE_GA4_ID as string|undefined,PIXEL=import.meta.env.VITE_META_PIXEL_ID as string|undefined;
export const analyticsConfigured=!!(GA||PIXEL);
const KEY='aiot-consent';
type Consent='granted'|'denied';
function stored():Consent|undefined{try{const value=localStorage.getItem(KEY);return value==='granted'||value==='denied'?value:undefined;}catch{return undefined;}}
function remember(value:Consent){try{localStorage.setItem(KEY,value);}catch{/* Private mode: ask again next visit. */}}
let loaded=false;
function script(src:string){const s=document.createElement('script');s.async=true;s.src=src;document.head.appendChild(s);}
function load(){
 if(loaded||!analyticsConfigured)return;loaded=true;
 if(GA&&/^G-[A-Z0-9]+$/.test(GA)){window.dataLayer=window.dataLayer??[];// gtag.js expects the Arguments object itself, not an array.
  // eslint-disable-next-line prefer-rest-params
  window.gtag=function gtag(){window.dataLayer!.push(arguments);};
  window.gtag('js',new Date());window.gtag('config',GA,{anonymize_ip:true});script(`https://www.googletagmanager.com/gtag/js?id=${GA}`);}
 if(PIXEL&&/^\d{6,20}$/.test(PIXEL)){const fbq:any=function(...args:unknown[]){if(fbq.callMethod)fbq.callMethod(...args);else fbq.queue.push(args);};fbq.queue=[];fbq.loaded=true;fbq.version='2.0';fbq.push=fbq;window.fbq=fbq;script('https://connect.facebook.net/en_US/fbevents.js');fbq('init',PIXEL);fbq('track','PageView');}
}

/** Conversion events: `lead` = inquiry form submitted, `contact` = WhatsApp/email click, `cta` = other tagged buttons. */
export function track(event:'lead'|'contact'|'cta',params:Record<string,string>={}){
 if(!loaded)return;
 window.gtag?.('event',event==='lead'?'generate_lead':event==='contact'?'contact':'select_content',params);
 if(event!=='cta')window.fbq?.('track',event==='lead'?'Lead':'Contact',params);
}

/** Tracks clicks on any element tagged with data-cta, and page views on client-side navigation. */
export function useTracking(pathname:string){
 useEffect(()=>{if(stored()==='granted')load();},[]);
 useEffect(()=>{if(loaded)window.gtag?.('event','page_view',{page_path:pathname});},[pathname]);
 useEffect(()=>{
  const onClick=(event:MouseEvent)=>{const el=(event.target as Element|null)?.closest?.('[data-cta]');if(!el)return;const href=el.getAttribute('href')??'';track(/wa\.me|mailto:/.test(href)?'contact':'cta',{cta:el.getAttribute('data-cta')??''});};
  document.addEventListener('click',onClick,true);return()=>document.removeEventListener('click',onClick,true);
 },[]);
}

export function ConsentBanner(){
 const{tr}=useLang();const[open,setOpen]=useState(()=>analyticsConfigured&&!stored());
 if(!open)return null;
 const choose=(value:Consent)=>{remember(value);if(value==='granted')load();setOpen(false);};
 return <aside className="ds-consent" role="region" aria-label={tr('Cookie consent','Persetujuan cookie')}>
  <p>{tr('We use Google Analytics and Meta Pixel to measure our ads, only if you allow it. No tracking runs until you accept.','Kami memakai Google Analytics dan Meta Pixel untuk mengukur iklan, hanya jika Anda izinkan. Tidak ada pelacakan sebelum Anda setuju.')}</p>
  <div><Button size="sm" variant="secondary" onClick={()=>choose('denied')}>{tr('Decline','Tolak')}</Button><Button size="sm" onClick={()=>choose('granted')}>{tr('Accept','Setuju')}</Button></div>
 </aside>;
}
