import {useEffect,useMemo,useRef} from 'react';
import {useLang} from '../../i18n';
import {fmtTime} from './chip-pill';
import {Icon} from './icons';

export interface SerialSeg{sys:boolean;text:string;t:number}
interface Line{t:number;sys:boolean;text:string}

/** Chunks arrive as the UART sends them; fold them into timestamped lines (t = emulated ms at arrival of the first byte). */
export function toLines(segs:SerialSeg[]):Line[]{
 const out:Line[]=[];
 let open:Line|null=null;
 for(const s of segs){
  for(const part of s.text.split(/(?<=\n)/)){
   if(!open||open.sys!==s.sys){open={t:s.t,sys:s.sys,text:''};out.push(open);}
   open.text+=part;
   if(part.endsWith('\n'))open=null;
  }
 }
 return out;
}

/** The always-mounted serial log (data-testid=lab-serial). Real UART bytes from the emulated chip. */
export function SerialLog({segments,className}:{segments:SerialSeg[];className?:string}){
 const body=useRef<HTMLDivElement>(null);
 const lines=useMemo(()=>toLines(segments),[segments]);
 useEffect(()=>{const b=body.current;if(b)b.scrollTop=b.scrollHeight;},[lines]);
 return (
  <div ref={body} className={`lab-serial-log${className?' '+className:''}`} data-testid="lab-serial" role="log" aria-live="off">
   {lines.length===0&&<div className="lab-sline lab-sline--wait"><time/>{' '}<span>› Waiting for Serial.begin()</span></div>}
   {lines.map((l,i)=>(
    <div key={i} className={`lab-sline${l.sys?' lab-sys':''}`}><time>{fmtTime(l.t)}</time>{' '}<span>{l.text.replace(/\n$/,'')}</span></div>
   ))}
  </div>
 );
}

export function SerialHeader({running,onClear,baud=9600}:{running:boolean;onClear:()=>void;baud?:number}){
 const {tr}=useLang();
 return (
  <header className="lab-serial-head">
   <span className="lab-eyebrow">SERIAL · {baud}</span>
   <i className="lab-dot" data-on={running}/>
   <span className="lab-grow"/>
   <button type="button" className="lab-iconbtn lab-iconbtn--scope" aria-label={tr('Clear','Bersihkan')} title={tr('Clear','Bersihkan')} onClick={onClear}><Icon name="trash" size={16}/></button>
  </header>
 );
}
