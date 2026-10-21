import {useRef} from 'react';
import {useLang} from '../../i18n';
import {LESSONS} from '../lessons';
import type {LessonId} from '../contract';
import {Icon} from './icons';

export function LessonStrip({active,done,celebrate,onPick}:{active:LessonId;done:LessonId[];celebrate:LessonId|null;onPick:(id:LessonId)=>void}){
 const {tr,lang}=useLang();
 const scroller=useRef<HTMLDivElement>(null);
 const by=(d:number)=>scroller.current?.scrollBy({left:d*260,behavior:'smooth'});
 return (
  <div className="lab-strip" id="lab-sec-lessons">
   <button type="button" className="lab-strip-arrow lab-strip-prev" aria-label={tr('Previous lessons','Pelajaran sebelumnya')} onClick={()=>by(-1)}><Icon name="chevron" size={18}/></button>
   <div className="lab-strip-scroll" ref={scroller} role="list">
    {LESSONS.map(l=>{
     const d=done.includes(l.id);
     return (
      <button key={l.id} type="button" role="listitem" className="lab-card-lesson" data-testid={`lab-lesson-${l.id}`} data-done={d} data-active={l.id===active} data-celebrate={celebrate===l.id} aria-current={l.id===active?'true':undefined} onClick={()=>onPick(l.id)}>
       <span className="lab-card-icon"><Icon name={l.id} size={30}/></span>
       <span className="lab-card-title">{l.n}. {l.title[lang]}</span>
       <Icon name="chevron" size={16} className="lab-card-chev"/>
       {d&&<span className="lab-card-done" aria-label={tr('Completed','Selesai')}><Icon name="check" size={12}/></span>}
      </button>
     );
    })}
   </div>
   <button type="button" className="lab-strip-arrow lab-strip-next" aria-label={tr('Next lessons','Pelajaran berikutnya')} onClick={()=>by(1)}><Icon name="chevron" size={18}/></button>
  </div>
 );
}
