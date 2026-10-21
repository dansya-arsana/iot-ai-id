import {useEffect,useRef} from 'react';
import {useLang} from '../../i18n';
import {Icon} from './icons';

export interface SerialSeg{sys:boolean;text:string}

export function SerialMonitor({segments,running,open,height,onHeight,onClear,onOpen,onClose}:{
 segments:SerialSeg[];running:boolean;open:boolean;height:number;
 onHeight:(h:number)=>void;onClear:()=>void;onOpen:()=>void;onClose:()=>void;
}){
 const {tr}=useLang();
 const body=useRef<HTMLPreElement>(null);
 useEffect(()=>{const b=body.current;if(b)b.scrollTop=b.scrollHeight;},[segments,open]);
 const grip=(e:React.PointerEvent<HTMLDivElement>)=>{
  e.preventDefault();
  const y0=e.clientY,h0=height;
  const scale=(e.currentTarget.closest('.lab-art') as HTMLElement|null)?.getBoundingClientRect().width;
  const k=scale?scale/1600:1;
  const move=(m:PointerEvent)=>onHeight(Math.max(90,Math.min(520,h0+(y0-m.clientY)/k)));
  const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
 };
 if(!open)return <button type="button" className="lab-serial-tab" id="lab-sec-serial" onClick={onOpen} data-testid="lab-serial-open"><Icon name="serial" size={16}/>{tr('SERIAL MONITOR','SERIAL MONITOR')}</button>;
 return (
  <section className="lab-serial" id="lab-sec-serial" style={{height}} aria-label={tr('Serial monitor','Serial monitor')}>
   <div className="lab-serial-grip" role="separator" aria-orientation="horizontal" onPointerDown={grip}/>
   <header>
    <i className="lab-dot" data-on={running}/>
    <span className="lab-label">{tr('SERIAL MONITOR','SERIAL MONITOR')} · {running?tr('RUNNING','BERJALAN'):tr('STOPPED','BERHENTI')}</span>
    <span className="lab-grow"/>
    <button type="button" className="lab-iconbtn" aria-label={tr('Clear','Bersihkan')} onClick={onClear}><Icon name="trash" size={15}/></button>
    <button type="button" className="lab-iconbtn" aria-label={tr('Close','Tutup')} onClick={onClose}><Icon name="close" size={15}/></button>
   </header>
   <pre ref={body} data-testid="lab-serial">{segments.map((s,i)=><span key={i} className={s.sys?'lab-sys':undefined}>{s.text}</span>)}</pre>
  </section>
 );
}
