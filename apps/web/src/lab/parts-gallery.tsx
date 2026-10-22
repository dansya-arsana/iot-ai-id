import './lab.css';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {PMREMGenerator,SRGBColorSpace,NeutralToneMapping,WebGLRenderer} from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {useLang} from '../i18n';
import {deviceRegistry} from './sim/devices';
import {partCopy} from './parts-copy';
import {registry} from './scene/parts/index';
import {renderKindSheet} from './scene/thumbnails';

const PASSIVE=new Set(['resistor','capacitor','diode']);
const BOARD=new Set(['arduino-nano','esp32-devkit','nodemcu-v3','esp-01']);
const POWER=new Set(['lm7805','ams1117-3v3','breadboard-power','breadboard-power-module','battery-9v','battery-aa-4']);
const PROTO:Record<string,[string,string]>={gpio:['Digital I/O','I/O digital'],adc:['Analog','Analog'],pwm:['PWM','PWM'],pulse:['Pulse timing','Pulsa waktu'],i2c:['I2C','I2C'],onewire:['1-Wire','1-Wire'],uart:['UART','UART'],switch:['Switch','Saklar'],spi:['SPI','SPI'],twowire:['Two-wire','Dua kabel'],ws2812:['WS2812 data','Data WS2812']};

/** Parts gallery: /lab/parts (every registered kind, default props) and /lab/parts/:kind (one kind, large). */
export function PartsGallery(){
 const {kind}=useParams<{kind?:string}>();
 const {tr,lang,setLang}=useLang();
 const kinds=useMemo(()=>[...(kind&&registry.has(kind)?[kind]:registry.kinds())].sort(),[kind]);
 const [urls,setUrls]=useState<Record<string,string>>({});
 const [err,setErr]=useState(false);
 const ready=useRef(false);
 useEffect(()=>{
  let dead=false;
  const cv=document.createElement('canvas');
  let renderer:WebGLRenderer;
  try{renderer=new WebGLRenderer({canvas:cv,antialias:true,alpha:true});}catch{queueMicrotask(()=>setErr(true));return;}
  renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=NeutralToneMapping;
  const pm=new PMREMGenerator(renderer);const env=pm.fromScene(new RoomEnvironment(),0.04).texture;
  const one=kinds.length===1;
  renderKindSheet(renderer,env,kinds,{width:one?900:360,height:one?560:240,dpr:1,onEach:(k,u)=>{if(!dead)setUrls(p=>({...p,[k]:u}));}})
   .then(()=>{ready.current=true;if(!dead)document.body.dataset.partsReady='1';}).catch(()=>setErr(true));
  return()=>{dead=true;delete document.body.dataset.partsReady;env.dispose();pm.dispose();renderer.dispose();};
 },[kinds]);
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
    return <figure key={k} data-kind={k} className="lab-card parts-card">
     <Link to={`/lab/parts/${k}`}>{urls[k]?<img src={urls[k]} alt={c.name[lang]} className="parts-img"/>:<div className="parts-img parts-img--empty" role="status" aria-label={tr('Rendering preview','Membuat pratinjau')} data-testid="parts-skeleton"><span className="parts-spin" aria-hidden="true"/></div>}</Link>
     <figcaption className="parts-cap">
      <b className="parts-name">{c.name[lang]}</b>
      <span className="parts-meta"><code>{k}</code><span className="lab-eyebrow">{label(k)}</span></span>
      {ne&&<span data-badge="not-emulated" className="parts-badge">{tr('Model only · not emulated','Model saja · tidak diemulasi')}</span>}
      {kind&&<p className="parts-desc">{c.desc[lang]}</p>}
     </figcaption>
    </figure>;
   })}
  </div>
 </div>;
}
