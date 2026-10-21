import {useEffect,useRef} from 'react';
import {useLang} from '../../i18n';
import {LESSONS} from '../lessons';
import type {LessonId} from '../contract';
import {Icon} from './icons';

const CONCEPT:Record<LessonId,string>={
 board:'BOARD',blink:'OUTPUT',button:'INPUT',knob:'ADC',rgb:'PWM',light:'LDR',distance:'PULSEIN',sound:'TONE',motor:'TRANSISTOR',servo:'SERVO',parking:'PROJECT',
};

export function LessonStrip({active,done,celebrate,thumbs,reduced,onPick}:{active:LessonId;done:LessonId[];celebrate:LessonId|null;thumbs:Partial<Record<LessonId,string>>;reduced:boolean;onPick:(id:LessonId)=>void}){
 const {tr,lang}=useLang();
 const scroller=useRef<HTMLDivElement>(null);
 const by=(d:number)=>scroller.current?.scrollBy({left:d*456,behavior:reduced?'auto':'smooth'});
 useEffect(()=>{
  const el=scroller.current?.querySelector<HTMLElement>(`[data-testid="lab-lesson-${active}"]`);
  const sc=scroller.current;
  if(!el||!sc)return;
  // scroll only the strip (never the page) so the active card sits in the middle
  const left=el.offsetLeft-(sc.clientWidth-el.offsetWidth)/2;
  sc.scrollTo({left:Math.max(0,left),behavior:reduced?'auto':'smooth'});
 },[active,reduced]);
 return (
  <div className="lab-strip" id="lab-sec-lessons">
   <button type="button" className="lab-strip-arrow" aria-label={tr('Previous lessons','Pelajaran sebelumnya')} onClick={()=>by(-1)}><Icon name="chevron" size={18} className="lab-flip"/></button>
   <div className="lab-strip-scroll" ref={scroller} role="list">
    {LESSONS.map(l=>{
     const d=done.includes(l.id),src=thumbs[l.id];
     return (
      <button key={l.id} type="button" role="listitem" className="lab-card-lesson" data-testid={`lab-lesson-${l.id}`} data-done={d} data-active={l.id===active} data-celebrate={celebrate===l.id} aria-current={l.id===active?'true':undefined} onClick={()=>onPick(l.id)}>
       <span className="lab-thumb">{src
        ?<img src={src} alt="" width={72} height={60} decoding="async"/>
        :<Icon name={l.id} size={28}/>}</span>
       <span className="lab-card-text">
        <span className="lab-eyebrow">{String(l.n).padStart(2,'0')} · {CONCEPT[l.id]}</span>
        <span className="lab-card-title">{l.title[lang]}</span>
       </span>
       {d&&<span className="lab-card-done" aria-label={tr('Completed','Selesai')}><Icon name="check" size={12}/></span>}
      </button>
     );
    })}
   </div>
   <button type="button" className="lab-strip-arrow" aria-label={tr('Next lessons','Pelajaran berikutnya')} onClick={()=>by(1)}><Icon name="chevron" size={18}/></button>
  </div>
 );
}
