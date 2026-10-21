import {useEffect,useState} from 'react';
import {useLang} from '../../i18n';
import {LESSONS} from '../lessons';

export function Progress({count}:{count:number}){
 const {tr}=useLang();
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);
 const total=LESSONS.length;
 return (
  <div className="lab-progress" data-testid="lab-progress" data-count={count}>
   <span className="lab-label">{tr('ARDUINO TRACK','JALUR ARDUINO')}</span>
   <div className="lab-progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={count}><i style={{width:`${(count/total)*100}%`}}/></div>
   <span className="lab-progress-n">{count}/{total}</span>
   <time className="lab-clock" dateTime={now.toISOString()}>{now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time>
  </div>
 );
}
