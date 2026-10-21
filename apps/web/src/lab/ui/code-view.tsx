import {useEffect,useMemo,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {useLang} from '../../i18n';
import type {FirmwareVariant,ParamValues} from '../contract';
import {fillTemplate,highlightLines} from './highlight';
import {diffText} from './line-diff';
import {FLASH_WORDS} from '../contract';
import {Icon} from './icons';

const FLASH_BYTES=FLASH_WORDS*2-512;
const nf=(n:number)=>n.toLocaleString('en-US');

interface Flash{n:number;lines:number[];params:string[]}

export function CodeView({variant,params,currentLine,running,onRun,onStop,onParam,note,log,hideRun,badge,runLocked}:{runLocked?:boolean;badge?:ReactNode;
 variant:FirmwareVariant;params:ParamValues;currentLine:number|null;running:boolean;
 onRun:()=>void;onStop:()=>void;onParam:(name:string)=>void;note:string|null;log:string|null;hideRun?:boolean;
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
 useEffect(()=>{
  const b=box.current;if(!b||!running||!currentLine)return;
  const el=b.querySelector<HTMLElement>(`[data-line="${currentLine}"]`);if(!el)return;
  if(b.scrollHeight<=b.clientHeight+1)return; // everything fits: nothing to scroll
  const top=el.offsetTop-b.scrollTop,h=b.clientHeight;
  if(top<h/3-10||top>h*2/3){
   // snap to whole line heights so the first visible line is never cut in half; the top of the file keeps its padding
   const l1=b.querySelector<HTMLElement>('[data-line="1"]'),l2=b.querySelector<HTMLElement>('[data-line="11"]');
   const lh=(l1&&l2?(l2.offsetTop-l1.offsetTop)/10:0)||el.offsetHeight||20,pad=(b.querySelector<HTMLElement>('[data-line="1"]')?.offsetTop)??0;
   const kMax=Math.max(0,Math.floor((b.scrollHeight-h-pad)/lh));
   const k=Math.min(kMax,Math.max(0,Math.round((el.offsetTop-h/2-pad)/lh)));
   b.scrollTop=k===0?0:Math.min(Math.floor((b.scrollHeight-h-pad)/lh)*lh+pad,pad+k*lh);
  }
 },[currentLine,running]);
 const [expanded,setExpanded]=useState(false);
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
    <span className="lab-file">sketch.ino</span>{badge}
    <span className="lab-receipt">{nf(variant.bytes)} B · {(variant.bytes/FLASH_BYTES*100).toFixed(1)}% flash</span>
    <span className="lab-grow"/>
    <button type="button" className="lab-iconbtn" aria-label={copied?tr('Copied','Tersalin'):tr('Copy','Salin')} title={tr('Copy','Salin')} onClick={copy}><Icon name={copied?'check':'copy'} size={18}/></button>
    <button type="button" className="lab-iconbtn" aria-label={tr('Download .ino','Unduh .ino')} title={tr('Download .ino','Unduh .ino')} onClick={download}><Icon name="download" size={18}/></button>
    <button type="button" className="lab-iconbtn" aria-label={tr('Expand','Perbesar')} title={tr('Expand','Perbesar')} aria-pressed={expanded} onClick={()=>setExpanded(v=>!v)}><Icon name="expand" size={18}/></button>
    <button type="button" className="lab-run" data-running={running} data-hide={hideRun} data-testid="lab-run" aria-label={running?tr('Stop','Hentikan'):tr('Run','Jalankan')} title={runLocked&&!running?tr('Assembling…','Merakit…'):running?tr('Stop','Hentikan'):tr('Run','Jalankan')} disabled={runLocked&&!running} onClick={running?onStop:onRun}>
     {running
      ?<svg key="s" className="lab-run-glyph" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect width="12" height="12" rx="2" fill="currentColor"/></svg>
      :<svg key="p" className="lab-run-glyph" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 1.2v11.6a.6.6 0 0 0 .9.5l9.2-5.8a.6.6 0 0 0 0-1L3.4.7a.6.6 0 0 0-.9.5z" fill="currentColor"/></svg>}
     <span className="lab-run-label">{running?tr('Stop','Henti'):tr('Run','Jalan')}</span>
    </button>
   </header>
   <div className="lab-code" ref={box} data-testid="lab-code" data-current-line={currentLine??''} data-sketch={variant.sketch}>
    <pre>
     {lines.map((toks,i)=>{
      const ln=i+1;
      const cur=currentLine===ln;
      const ch=changed.has(i);
      return (
       <div key={`${i}-${ch?flash.n:0}`} className={`lab-line${cur?' is-current':''}${ch?' is-changed':''}`} data-line={ln} data-current={cur?'true':undefined} title={cur?tr(`L${ln} · mapped from the program counter`,`L${ln} · dipetakan dari program counter`):undefined}>
        <span className="lab-ln">{ln}</span>
        <code>{toks.map((t,k)=>t.kind==='param'&&t.param
         ?<button key={`${k}-${flash.params.includes(t.param)?flash.n:0}`} type="button" className={`lab-chip${flash.params.includes(t.param)?' is-flash':''}`} data-param={t.param} onClick={()=>onParam(t.param!)}>{params[t.param]??t.text}</button>
         :<span key={k} className={`lab-tk lab-tk-${t.kind}`}>{t.text}</span>)}{'\n'}</code>
       </div>
      );
     })}
    </pre>
   </div>
   <p className="lab-code-foot" data-log={!!log} data-note={!!note} role={note?'status':undefined}>{note?<><Icon name="chip" size={14}/>{note}</>:log?<>{log}</>:tr('Click a highlighted value to change it.','Klik nilai yang disorot untuk mengubahnya.')}</p>
  </section>
 );
}
