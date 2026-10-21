import {useEffect,useMemo,useRef,useState} from 'react';
import {useLang} from '../../i18n';
import type {FirmwareVariant,ParamValues} from '../contract';
import {fillTemplate,highlightLines} from './highlight';
import {diffText} from './line-diff';
import {Icon} from './icons';

interface Flash{n:number;lines:number[];params:string[]}

export function CodeView({variant,params,currentLine,running,onRun,onStop,onParam,note}:{
 variant:FirmwareVariant;params:ParamValues;currentLine:number|null;running:boolean;
 onRun:()=>void;onStop:()=>void;onParam:(name:string)=>void;note:string|null;
}){
 const {tr}=useLang();
 const template=variant.template;
 const text=useMemo(()=>fillTemplate(template,params),[template,params]);
 const lines=useMemo(()=>highlightLines(template),[template]);
 const [prev,setPrev]=useState({sketch:variant.sketch,text,params});
 const [flash,setFlash]=useState<Flash>({n:0,lines:[],params:[]});
 if(prev.text!==text||prev.sketch!==variant.sketch){
  if(prev.sketch===variant.sketch){
   const names=Object.keys(params).filter(k=>params[k]!==prev.params[k]);
   setFlash({n:flash.n+1,lines:diffText(prev.text,text),params:names});
  }else setFlash({n:flash.n,lines:[],params:[]});
  setPrev({sketch:variant.sketch,text,params});
 }
 const box=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!flash.lines.length)return;
  box.current?.querySelector(`[data-line="${flash.lines[0]+1}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'});
 },[flash]);
 const [expanded,setExpanded]=useState(false);
 const [info,setInfo]=useState(false);
 const [copied,setCopied]=useState(false);
 const copy=()=>{
  try{void navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1200);},()=>undefined);}catch{/* clipboard unavailable */}
 };
 const download=()=>{
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain'}));
  const a=document.createElement('a');a.href=url;a.download=`${variant.sketch}.ino`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
 };
 const changed=new Set(flash.lines);
 return (
  <section className="lab-card lab-code-card" id="lab-sec-code" data-expanded={expanded}>
   <header className="lab-code-head">
    <span className="lab-label">{tr('TRY IT','COBA SENDIRI')}</span>
    <button type="button" className="lab-iconbtn" aria-expanded={info} aria-label={tr('About this code','Tentang kode ini')} onClick={()=>setInfo(v=>!v)}><Icon name="info" size={16}/></button>
    <span className="lab-grow"/>
    <button type="button" className="lab-iconbtn" aria-label={copied?tr('Copied','Tersalin'):tr('Copy','Salin')} title={tr('Copy','Salin')} onClick={copy}><Icon name={copied?'check':'copy'} size={16}/></button>
    <button type="button" className="lab-iconbtn" aria-label={tr('Download .ino','Unduh .ino')} title={tr('Download .ino','Unduh .ino')} onClick={download}><Icon name="download" size={16}/></button>
    <button type="button" className="lab-iconbtn" aria-label={tr('Expand','Perbesar')} title={tr('Expand','Perbesar')} aria-pressed={expanded} onClick={()=>setExpanded(v=>!v)}><Icon name="expand" size={16}/></button>
    <button type="button" className="lab-run" data-running={running} data-testid="lab-run" aria-label={running?tr('Stop','Hentikan'):tr('Run','Jalankan')} title={running?tr('Stop','Hentikan'):tr('Run','Jalankan')} onClick={running?onStop:onRun}>
     <Icon name={running?'stop':'play'} size={16}/>
    </button>
   </header>
   {info&&<p className="lab-popover" role="note">{tr(
    'This is real firmware. avr-gcc built this sketch and it runs on an emulated ATmega328P (avr8js) at 16 MHz. Values you change are written into the firmware bytes, the same result as recompiling. Free code editing needs a compiler and is not in the browser yet.',
    'Ini firmware sungguhan. avr-gcc mengompilasi sketsa ini dan berjalan di ATmega328P tiruan (avr8js) pada 16 MHz. Nilai yang kamu ubah ditulis langsung ke byte firmware, hasilnya sama seperti kompilasi ulang. Mengedit kode bebas butuh kompiler dan belum tersedia di browser.')}</p>}
   <div className="lab-code" ref={box} data-testid="lab-code" data-current-line={currentLine??''} data-sketch={variant.sketch}>
    <pre>
     {lines.map((toks,i)=>{
      const ln=i+1;
      const cur=currentLine===ln;
      const ch=changed.has(i);
      return (
       <div key={`${i}-${ch?flash.n:0}`} className={`lab-line${cur?' is-current':''}${ch?' is-changed':''}`} data-line={ln} data-current={cur?'true':undefined}>
        <span className="lab-ln">{ln}</span>
        <code>{toks.map((t,k)=>t.kind==='param'&&t.param
         ?<button key={`${k}-${flash.params.includes(t.param)?flash.n:0}`} type="button" className={`lab-chip${flash.params.includes(t.param)?' is-flash':''}`} data-param={t.param} onClick={()=>onParam(t.param!)}>{params[t.param]??t.text}</button>
         :<span key={k} className={`lab-tk lab-tk-${t.kind}`}>{t.text}</span>)}{'\n'}</code>
       </div>
      );
     })}
    </pre>
   </div>
   {note&&<p className="lab-note" role="status">{note}</p>}
   <p className="lab-code-foot">{tr('Read-only. Click a highlighted value to change it.','Hanya baca. Klik nilai yang disorot untuk mengubahnya.')}</p>
  </section>
 );
}
