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

/** Parts gallery: /lab/parts (every registered kind, default props) and /lab/parts/:kind (one kind, large). */
export function PartsGallery(){
 const {kind}=useParams<{kind?:string}>();
 const {tr,lang}=useLang();
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
 return <div className="parts-gallery" data-testid="parts-gallery" style={{background:'var(--lab-paper)',minHeight:'100vh',padding:'24px 28px',fontFamily:'var(--lab-mono)',color:'var(--lab-ink)'}}>
  <header style={{display:'flex',gap:16,alignItems:'baseline',marginBottom:16}}>
   <Link to="/lab" style={{color:'inherit'}}>← Lab</Link>
   <h1 style={{fontFamily:'Archivo, sans-serif',fontSize:24,margin:0}}>{tr('Parts gallery','Galeri komponen')} ({kinds.length})</h1>
   {kind&&<Link to="/lab/parts" style={{color:'inherit'}}>{tr('All parts','Semua komponen')}</Link>}
  </header>
  {err&&<p>{tr('WebGL is not available here.','WebGL tidak tersedia di sini.')}</p>}
  <div style={{display:'grid',gridTemplateColumns:kinds.length===1?'1fr':'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
   {kinds.map(k=>{
    const def=deviceRegistry.get(k);const c=partCopy(k);const ne=def?.runtime==='not-emulated';
    return <figure key={k} data-kind={k} style={{margin:0,background:'var(--lab-card)',border:'1px solid var(--lab-line)',borderRadius:6,padding:10}}>
     <Link to={`/lab/parts/${k}`}>{urls[k]?<img src={urls[k]} alt={c.name[lang]} style={{width:'100%',display:'block'}}/>:<div style={{aspectRatio:'3/2'}}/>}</Link>
     <figcaption style={{fontSize:12,marginTop:6}}>
      <b>{c.name[lang]}</b> <code>{k}</code> <span>{def?.protocol??''}</span>
      {ne&&<span data-badge="not-emulated" style={{marginLeft:6,padding:'1px 6px',border:'1px solid var(--lab-line-strong)',borderRadius:3,color:'var(--lab-ink-2)'}}>{tr('Model only · not emulated','Model saja · tidak diemulasi')}</span>}
      {kind&&<p style={{fontSize:13}}>{c.desc[lang]}</p>}
     </figcaption>
    </figure>;
   })}
  </div>
 </div>;
}
