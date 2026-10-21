import {useEffect,useState} from 'react';
import type {ReactNode} from 'react';

export const ART_W=1440;
export const ART_MIN=760,ART_MAX=1200;

export interface Viewport{mobile:boolean;scale:number;w:number;h:number;artH:number;compact:boolean}
function measure():Viewport{
 const w=typeof window==='undefined'?1440:window.innerWidth,h=typeof window==='undefined'?900:window.innerHeight;
 const mobile=w<=760||h<=560;
 let scale=Math.min(1.25,w/ART_W),artH=h/scale;
 if(artH<ART_MIN){scale=h/ART_MIN;artH=ART_MIN;}
 artH=Math.min(ART_MAX,artH);
 return {mobile,scale,w,h,artH,compact:artH<860};
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

/** 1440-wide, height-flexible HUD scaled to fit on desktop; plain flow container on mobile. Same element types in both modes so the canvas never remounts. */
export function Artboard({vp,children}:{vp:Viewport;children:ReactNode}){
 const left=(vp.w-ART_W*vp.scale)/2,top=(vp.h-vp.artH*vp.scale)/2;
 return (
  <div className={vp.mobile?'lab-flow':'lab-viewport'}>
   <div className={vp.mobile?'lab-flow-inner':'lab-art'} data-compact={vp.compact} style={vp.mobile?undefined:{width:ART_W,height:vp.artH,left,top,transform:`scale(${vp.scale})`}}>{children}</div>
  </div>
 );
}
