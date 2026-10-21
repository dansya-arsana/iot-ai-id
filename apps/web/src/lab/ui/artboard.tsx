import {useEffect,useState} from 'react';
import type {ReactNode} from 'react';

export const ART_W=1600;
export const ART_H=900;

export interface Viewport{mobile:boolean;scale:number;w:number;h:number}
function measure():Viewport{
 const w=typeof window==='undefined'?1440:window.innerWidth,h=typeof window==='undefined'?900:window.innerHeight;
 const mobile=w<=760||h<=560;
 return {mobile,scale:Math.min(w/ART_W,h/ART_H),w,h};
}
export function useViewport():Viewport{
 const [v,setV]=useState<Viewport>(measure);
 useEffect(()=>{
  const on=()=>setV(measure());
  window.addEventListener('resize',on);window.addEventListener('orientationchange',on);
  return()=>{window.removeEventListener('resize',on);window.removeEventListener('orientationchange',on);};
 },[]);
 return v;
}

/** Fixed 1600x900 HUD scaled to fit on desktop; plain flow container on mobile. Same element types in both modes so the canvas never remounts. */
export function Artboard({vp,children}:{vp:Viewport;children:ReactNode}){
 const left=(vp.w-ART_W*vp.scale)/2,top=(vp.h-ART_H*vp.scale)/2;
 return (
  <div className={vp.mobile?'lab-flow':'lab-viewport'}>
   <div className={vp.mobile?'lab-flow-inner':'lab-art'} style={vp.mobile?undefined:{width:ART_W,height:ART_H,left,top,transform:`scale(${vp.scale})`}}>{children}</div>
  </div>
 );
}
