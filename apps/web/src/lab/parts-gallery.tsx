import './lab.css';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {PMREMGenerator,SRGBColorSpace,NeutralToneMapping,WebGLRenderer} from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {useLang} from '../i18n';
import {deviceRegistry} from './sim/devices';
import {partCopy,popoverControls} from './parts-copy';
import {PartPopover} from './ui/part-popover';
import type {PopoverValue} from './ui/part-popover';
import {registry} from './scene/parts/index';
import {renderKindSheet,startLivePreview} from './scene/thumbnails';
import {createDemo,createHarness} from './scene/parts/demo';
import type {Texture} from 'three';

const PASSIVE=new Set(['resistor','capacitor','diode']);
const BOARD=new Set(['arduino-nano','esp32-devkit','nodemcu-v3','esp-01']);
const POWER=new Set(['lm7805','ams1117-3v3','breadboard-power','breadboard-power-module','battery-9v','battery-aa-4']);
const PROTO:Record<string,[string,string]>={gpio:['Digital I/O','I/O digital'],adc:['Analog','Analog'],pwm:['PWM','PWM'],pulse:['Pulse timing','Pulsa waktu'],i2c:['I2C','I2C'],onewire:['1-Wire','1-Wire'],uart:['UART','UART'],switch:['Switch','Saklar'],spi:['SPI','SPI'],twowire:['Two-wire','Dua kabel'],ws2812:['WS2812 data','Data WS2812']};

/**
 * "Try it" on a part's own page: the real popover (sliders, chips, the HC-05 terminal) bound to the part's real device model on a fake board.
 * No sketch runs here, so only what the module itself does shows (a phone line is received, a relay clicks, a joystick reads its sliders).
 */
function TryIt({kind}:{kind:string}){
 const {tr}=useLang();
 const mod=registry.get(kind);
 const h=useMemo(()=>createHarness(kind),[kind]);
 const [vals,setVals]=useState<Record<string,PopoverValue|undefined>>(()=>({...(h?.props??{})} as Record<string,PopoverValue|undefined>));
 const [live,setLive]=useState<Record<string,unknown>|undefined>(undefined);
 useEffect(()=>{
  if(!h)return;
  let raf=0,last=0;const t0=performance.now();
  const loop=():void=>{
   const now=performance.now();
   const s=h.step(now-t0);
   if(now-last>120){last=now;setLive(s.kind==='ext'?s.v:undefined);}
   raf=requestAnimationFrame(loop);
  };
  raf=requestAnimationFrame(loop);
  return()=>cancelAnimationFrame(raf);
 },[h]);
 if(!mod||!h||!(mod.interact?.controls?.length))return null;
 return <section className="parts-try" data-testid="parts-try" aria-label={tr('Try it','Coba')}>
  <p className="lab-eyebrow">{tr('Try it · the module alone, no sketch is running','Coba · modul saja, tidak ada sketch yang berjalan')}</p>
  <div className="parts-try-box">
   <PartPopover partId={kind} module={mod} controls={popoverControls(kind,mod.interact?.controls)} values={vals} live={live}
    at={{x:0,y:0}} bounds={{width:320,height:640}} onChange={(k,v)=>{h.set(k,v);setVals(p=>({...p,[k]:v}));}} onInput={i=>h.input(i)} onFocusPart={()=>undefined} onClose={()=>undefined} embedded/>
  </div>
 </section>;
}

/** Parts gallery: /lab/parts (every registered kind, default props) and /lab/parts/:kind (one kind, large). */
export function PartsGallery(){
 const {kind}=useParams<{kind?:string}>();
 const {tr,lang,setLang}=useLang();
 const kinds=useMemo(()=>[...(kind&&registry.has(kind)?[kind]:registry.kinds())].sort(),[kind]);
 const [urls,setUrls]=useState<Record<string,string>>({});
 const [err,setErr]=useState(false);
 const ready=useRef(false);
 const gl=useRef<{renderer:WebGLRenderer;env:Texture}|null>(null);
 const stopLive=useRef<(()=>void)|null>(null);
 const [live,setLive]=useState<string|null>(null);
 useEffect(()=>{
  let dead=false;
  const cv=document.createElement('canvas');
  let renderer:WebGLRenderer;
  try{renderer=new WebGLRenderer({canvas:cv,antialias:true,alpha:true});}catch{queueMicrotask(()=>setErr(true));return;}
  renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=NeutralToneMapping;
  const pm=new PMREMGenerator(renderer);const env=pm.fromScene(new RoomEnvironment(),0.04).texture;
  gl.current={renderer,env};
  const one=kinds.length===1;
  renderKindSheet(renderer,env,kinds,{width:one?900:360,height:one?560:240,dpr:1,onEach:(k,u)=>{if(!dead)setUrls(p=>({...p,[k]:u}));}})
   .then(()=>{ready.current=true;if(!dead)document.body.dataset.partsReady='1';}).catch(()=>setErr(true));
  return()=>{dead=true;stopLive.current?.();stopLive.current=null;gl.current=null;delete document.body.dataset.partsReady;env.dispose();pm.dispose();renderer.dispose();};
 },[kinds]);
 /** Hover or focus a card: the part runs its demo (a display shows a pattern, LEDs glow, the servo sweeps) until the pointer leaves. */
 const startDemo=(k:string,cv:HTMLCanvasElement|null):void=>{
  stopLive.current?.();stopLive.current=null;
  const g=gl.current,demo=createDemo(k);
  if(!g||!cv||!demo||!urls[k]){setLive(null);return;}
  const one=kinds.length===1;
  stopLive.current=startLivePreview(g.renderer,g.env,k,{width:one?900:360,height:one?560:240,dpr:1,canvas:cv,demo});
  setLive(k);
 };
 const endDemo=():void=>{stopLive.current?.();stopLive.current=null;setLive(null);};
 const label=(k:string):string=>{
  if(PASSIVE.has(k))return tr('Passive','Pasif');
  if(BOARD.has(k))return tr('Board','Papan');
  if(POWER.has(k))return tr('Power','Daya');
  const p=PROTO[deviceRegistry.get(k)?.protocol??''];return p?tr(p[0],p[1]):'';
 };
 const title=kind&&registry.has(kind)?partCopy(kind).name[lang]:`${tr('Parts gallery','Galeri komponen')} (${kinds.length})`;
 useEffect(()=>{document.title=`${title} · AIoT Lab`;},[title]);
 return <div className="parts-gallery" data-testid="parts-gallery">
  <header className="parts-head">
   <Link to="/lab" className="parts-link">← Lab</Link>
   <h1 className="lab-title">{title}</h1>
   {kind&&<Link to="/lab/parts" className="parts-link">{tr('All parts','Semua komponen')}</Link>}
   <span className="lab-grow"/>
   <button type="button" className="lab-btn-ghost" data-testid="parts-lang" onClick={()=>setLang(lang==='id'?'en':'id')}>{lang==='id'?'EN':'ID'}</button>
  </header>
  {err&&<p>{tr('WebGL is not available here.','WebGL tidak tersedia di sini.')}</p>}
  <div className="parts-grid" data-one={kinds.length===1?'1':undefined}>
   {kinds.map(k=>{
    const def=deviceRegistry.get(k);const c=partCopy(k);const ne=def?.runtime==='not-emulated';
    return <figure key={k} data-kind={k} data-live={live===k?'1':undefined} className="lab-card parts-card" onPointerEnter={e=>startDemo(k,e.currentTarget.querySelector('canvas'))} onPointerLeave={endDemo} onFocus={e=>startDemo(k,e.currentTarget.querySelector('canvas'))} onBlur={endDemo}>
     <Link to={`/lab/parts/${k}`} className="parts-imgwrap">{urls[k]?<><img src={urls[k]} alt={c.name[lang]} className="parts-img"/><canvas className="parts-img parts-live" data-testid="parts-live" aria-hidden="true" hidden={live!==k}/></>:<div className="parts-img parts-img--empty" role="status" aria-label={tr('Rendering preview','Membuat pratinjau')} data-testid="parts-skeleton"><span className="parts-spin" aria-hidden="true"/></div>}</Link>
     <figcaption className="parts-cap">
      <b className="parts-name">{c.name[lang]}</b>
      <span className="parts-meta"><code>{k}</code><span className="lab-eyebrow">{label(k)}</span></span>
      {ne&&<span data-badge="not-emulated" className="parts-badge">{tr('Model only · not emulated','Model saja · tidak diemulasi')}</span>}
      {kind&&<p className="parts-desc">{c.desc[lang]}</p>}
     </figcaption>
    </figure>;
   })}
  </div>
  {kind&&registry.has(kind)&&<TryIt kind={kind}/>}
 </div>;
}
