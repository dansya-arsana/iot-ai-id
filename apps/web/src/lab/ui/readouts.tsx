import {useEffect,useRef} from 'react';
import type {SimSnapshot} from '../contract';
import {READOUTS} from '../goals';
import type {LessonId} from '../contract';
import type {StageApi} from './frame';

const MAX=3;

export function Readouts({lessonId,api}:{lessonId:LessonId;api:StageApi}){
 const els=useRef<(HTMLDivElement|null)[]>([]);
 const snapRef=useRef<SimSnapshot|null>(null);
 useEffect(()=>api.subscribe(()=>{
  const scene=api.getScene();
  const snap=api.snapshot();
  snapRef.current=snap;
  const items=scene&&snap&&snap.status==='running'?READOUTS[lessonId](snap):[];
  for(let i=0;i<MAX;i++){
   const el=els.current[i];if(!el)continue;
   const it=items[i];const p=it&&scene?scene.project(it.target):null;
   if(!it||!p||!p.visible){el.style.opacity='0';continue;}
   el.textContent=it.text;el.style.opacity='1';
   el.style.transform=`translate(${p.x.toFixed(1)}px,${(p.y-44).toFixed(1)}px) translateX(-50%)`;
  }
 }),[api,lessonId]);
 return <div className="lab-readouts" aria-hidden="true">{Array.from({length:MAX},(_,i)=><div key={i} ref={el=>{els.current[i]=el;}} className="lab-readout" data-testid={`lab-readout-${i}`} style={{opacity:0}}/>)}</div>;
}
