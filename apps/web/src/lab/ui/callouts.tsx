import {useEffect,useRef} from 'react';
import {useLang} from '../../i18n';
import type {Lesson} from '../lessons';
import type {StageApi} from './frame';

const CW=210,CH=92;

export function Callouts({lesson,api,pills,show}:{lesson:Lesson;api:StageApi;pills:boolean;show:boolean}){
 const {tr,lang}=useLang();
 const cards=useRef<(HTMLDivElement|null)[]>([]);
 const lines=useRef<(SVGLineElement|null)[]>([]);
 const dots=useRef<(SVGGElement|null)[]>([]);
 useEffect(()=>{
  if(!show)return;
  return api.subscribe(()=>{
   const scene=api.getScene(),stage=api.stage();
   if(!scene||!stage)return;
   const W=stage.clientWidth,H=stage.clientHeight;
   const collapsed=pills||scene.zoomLevel()>1.6;
   const used:Record<string,number>={left:0,right:0,top:0,bottom:0};
   lesson.callouts.forEach((c,i)=>{
    const el=cards.current[i],ln=lines.current[i],dot=dots.current[i];
    if(!el||!ln||!dot)return;
    const p=scene.project(c.target);
    const k=used[c.side]++;
    if(!p||!p.visible){el.style.opacity='0';ln.style.opacity='0';dot.style.opacity='0';return;}
    el.style.opacity='1';dot.style.opacity='1';
    dot.setAttribute('transform',`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    el.dataset.pill=collapsed?'true':'false';
    if(collapsed){
     el.style.transform=`translate(${Math.min(W-130,Math.max(4,p.x+12)).toFixed(1)}px,${Math.max(4,p.y-34).toFixed(1)}px)`;
     ln.style.opacity='0';return;
    }
    let x:number,y:number;
    if(c.side==='left'){x=18;y=70+k*(CH+16);}
    else if(c.side==='right'){x=W-CW-18;y=70+k*(CH+16);}
    else if(c.side==='top'){x=W*(0.28+0.28*k)-CW/2;y=14;}
    else{x=W*(0.28+0.28*k)-CW/2;y=H-CH-70;}
    el.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    const ax=Math.min(Math.max(p.x,x),x+CW),ay=Math.min(Math.max(p.y,y),y+CH);
    ln.setAttribute('x1',ax.toFixed(1));ln.setAttribute('y1',ay.toFixed(1));
    ln.setAttribute('x2',p.x.toFixed(1));ln.setAttribute('y2',p.y.toFixed(1));ln.style.opacity='1';
   });
  });
 },[api,lesson,pills,show]);
 if(!show)return null;
 return (
  <div className="lab-callouts" data-testid="lab-callouts">
   <svg className="lab-leaders" aria-hidden="true">
    {lesson.callouts.map((c,i)=>(
     <g key={c.target+i}>
      <line ref={el=>{lines.current[i]=el;}} className="lab-leader" opacity="0"/>
     </g>
    ))}
    {lesson.callouts.map((c,i)=>(
     <g key={'d'+c.target+i} ref={el=>{dots.current[i]=el;}} opacity="0"><circle className="lab-halo" r="9"/><circle className="lab-dot-core" r="3.5"/></g>
    ))}
   </svg>
   {lesson.callouts.map((c,i)=>(
    <div key={c.target+i} ref={el=>{cards.current[i]=el;}} className="lab-callout" data-target={c.target} data-pill="false" style={{opacity:0,animationDelay:`${i*120}ms`}}
     onMouseEnter={()=>api.getScene()?.highlight(c.target)} onMouseLeave={()=>api.getScene()?.highlight(null)}>
     <strong>{c.title[lang]}</strong>
     <span>{c.body[lang]}</span>
     <em className="lab-pill-text" aria-label={tr('Callout','Penjelasan')}>{c.title[lang]}</em>
    </div>
   ))}
  </div>
 );
}
