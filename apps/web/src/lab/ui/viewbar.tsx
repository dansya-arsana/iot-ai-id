import {useEffect,useState} from 'react';
import {useLang} from '../../i18n';
import type {ViewCommand} from '../contract';
import {Icon} from './icons';

export function Viewbar({onView,used}:{onView:(c:ViewCommand)=>void;used:boolean}){
 const {tr}=useLang();
 const [timeout,setTimedOut]=useState(false);
 useEffect(()=>{const t=setTimeout(()=>setTimedOut(true),9000);return()=>clearTimeout(t);},[]);
 const btn=(c:ViewCommand,icon:string,label:string)=>(
  <button type="button" className="lab-iconbtn" aria-label={label} title={label} data-testid={`lab-view-${c}`} onClick={()=>onView(c)}><Icon name={icon} size={18}/></button>
 );
 return (
  <>
   <div className={`lab-hint${timeout||used?' is-gone':''}`}>{tr('Drag to orbit · scroll to zoom · Q/E rotate','Seret untuk memutar · scroll untuk zoom · Q/E putar')}</div>
   <div className="lab-viewbar">
    {btn('rotate-left','rotl',tr('Rotate left','Putar kiri'))}
    {btn('rotate-right','rotr',tr('Rotate right','Putar kanan'))}
    {btn('zoom-out','minus',tr('Zoom out','Perkecil'))}
    {btn('zoom-in','plus',tr('Zoom in','Perbesar'))}
    {btn('reset','compass',tr('Reset view','Reset tampilan'))}
   </div>
  </>
 );
}
