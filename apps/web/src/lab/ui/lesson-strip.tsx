import {useEffect,useLayoutEffect,useRef} from 'react';
import type {ReactNode} from 'react';
import {useLang} from '../../i18n';
import {LESSONS} from '../lessons';
import type {LessonId} from '../contract';
import {Icon} from './icons';

const CONCEPT:Record<LessonId,string>={
 board:'BOARD',blink:'OUTPUT',button:'INPUT',knob:'ADC',rgb:'PWM',light:'LDR',distance:'PULSEIN',sound:'TONE',motor:'TRANSISTOR',servo:'SERVO',parking:'PROJECT',
};

export function LessonStrip({active,done,celebrate,thumbs,reduced,onPick,extra}:{extra?:ReactNode;active:LessonId|null;done:LessonId[];celebrate:LessonId|null;thumbs:Partial<Record<LessonId,string>>;reduced:boolean;onPick:(id:LessonId)=>void}){
 const {tr,lang}=useLang();
 const scroller=useRef<HTMLDivElement>(null);
 const GAP=12;
 const cardStep=():number=>{const c=scroller.current?.querySelector<HTMLElement>('.lab-card-lesson');return c?c.offsetWidth+GAP:0;};
 const perView=():number=>{const sc=scroller.current;const st=cardStep();return sc&&st?Math.max(1,Math.round((sc.clientWidth+GAP-8)/st)):1;};
 const by=(d:number)=>{const sc=scroller.current,st=cardStep();if(!sc||!st)return;sc.scrollTo({left:Math.round(sc.scrollLeft/st+d*Math.max(1,perView()-1))*st,behavior:reduced?'auto':'smooth'});};
 // size the viewport to a whole number of cards so no card is ever cut off at either end (desktop; on mobile the strip swipes)
 useLayoutEffect(()=>{
  const sc=scroller.current,strip=sc?.parentElement;
  if(!sc||!strip)return;
  const fit=()=>{
   const st=cardStep();
   if(!st||getComputedStyle(strip.querySelector('.lab-strip-arrow')!).display==='none'){sc.style.width='';sc.style.flex='';return;}
   let other=0,n=0;
   for(const ch of Array.from(strip.children)){if(ch!==sc){other+=(ch as HTMLElement).offsetWidth;n++;}}
   const room=strip.clientWidth-other-n*8-8;
   const k=Math.max(1,Math.min(LESSONS.length,Math.floor((room+GAP)/st)));
   sc.style.flex='0 1 auto';sc.style.width=`${k*st-GAP+8}px`;
  };
  fit();
  const ro=new ResizeObserver(fit);ro.observe(strip);
  return()=>ro.disconnect();
 },[]);
 useEffect(()=>{
  const sc=scroller.current,st=cardStep();
  if(!sc||!st)return;
  const idx=active?LESSONS.findIndex(l=>l.id===active):0;
  const n=perView();
  const first=Math.max(0,Math.min(LESSONS.length-n,idx-Math.floor((n-1)/2)));
  sc.scrollTo({left:first*st,behavior:reduced?'auto':'smooth'});
 },[active,reduced]);// eslint-disable-line react-hooks/exhaustive-deps
 return (
  <div className="lab-strip" id="lab-sec-lessons" data-ai={active===null}>
   {extra}
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
