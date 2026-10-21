import {useEffect,useRef} from 'react';
import {useLang} from '../../i18n';
import type {LabSceneV3} from '../scene';
import type {StageApi} from './frame';
import './minimap.css';

const W=156,H=118,PAD=10;

/** Top-down board footprint with the camera view cone and a north marker. Click recentres the camera. Shown while a part is focused. */
export function Minimap({scene,api,selected}:{scene:LabSceneV3|null;api:StageApi;selected:string|null}){
 const {tr}=useLang();
 const cv=useRef<HTMLCanvasElement>(null);
 const map=useRef({s:1,ox:0,oz:0,x0:0,z0:0});
 useEffect(()=>{
  const el=cv.current;if(!el||!scene)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  el.width=W*dpr;el.height=H*dpr;
  const g=el.getContext('2d');if(!g)return;
  const css=getComputedStyle(el);
  const col=(n:string,f:string):string=>css.getPropertyValue(n).trim()||f;
  let last=0;
  const draw=():void=>{
   const now=performance.now();if(now-last<60)return;last=now;
   const m=scene.minimap();
   // frame the board and breadboard; parts far off (the obstacle at 60 cm) sit on the edge instead of shrinking the map
   let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9;
   for(const r of m.rects)if(r.kind==='uno'||r.kind==='breadboard'){x0=Math.min(x0,r.x0);z0=Math.min(z0,r.z0);x1=Math.max(x1,r.x1);z1=Math.max(z1,r.z1);}
   if(x0>x1){x0=m.bounds.x0;z0=m.bounds.z0;x1=m.bounds.x1;z1=m.bounds.z1;}
   for(const r of m.rects)if(r.kind==='part'&&r.x1>x0-60&&r.x0<x1+60&&r.z1>z0-60&&r.z0<z1+60){x0=Math.min(x0,r.x0);z0=Math.min(z0,r.z0);x1=Math.max(x1,r.x1);z1=Math.max(z1,r.z1);}
   const b={x0,z0,x1,z1};
   const bw=Math.max(40,b.x1-b.x0),bd=Math.max(40,b.z1-b.z0);
   const s=Math.min((W-PAD*2)/bw,(H-PAD*2-8)/bd);
   const ox=(W-bw*s)/2-b.x0*s,oz=(H-bd*s)/2+4-b.z0*s;
   map.current={s,ox,oz,x0:b.x0,z0:b.z0};
   const X=(x:number):number=>x*s+ox,Z=(z:number):number=>z*s+oz;
   g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
   const ink=col('--lab-ink','#0a0a0a'),line=col('--lab-line-strong','#c9c5ba'),live=col('--lab-live','#3fcf6e'),paper=col('--lab-paper-deep','#e9e6df'),card=col('--lab-card','#fff');
   for(const r of m.rects){
    const x=X(r.x0),z=Z(r.z0),w=(r.x1-r.x0)*s,h=(r.z1-r.z0)*s;
    if(r.kind==='uno'){g.fillStyle=paper;g.strokeStyle=ink;g.lineWidth=1.2;g.beginPath();g.roundRect(x,z,w,h,3);g.fill();g.stroke();}
    else if(r.kind==='breadboard'){g.fillStyle=card;g.strokeStyle=line;g.lineWidth=1;g.beginPath();g.roundRect(x,z,w,h,2);g.fill();g.stroke();}
    else{
     const sel=r.id===selected;
     g.fillStyle=sel?live:ink;g.globalAlpha=sel?1:0.78;
     const cx=Math.min(W-6,Math.max(6,x+w/2)),cz=Math.min(H-6,Math.max(6,z+h/2)),off=cx!==x+w/2||cz!==z+h/2;
     if(off){g.beginPath();g.arc(cx,cz,3.2,0,Math.PI*2);g.fill();}
     else g.fillRect(x,z,Math.max(3,w),Math.max(3,h));
     g.globalAlpha=1;
    }
   }
   // view cone: apex at the eye side of the look-at point, widening toward what the camera sees
   const p=m.pose,sinA=Math.sin(p.az),cosA=Math.cos(p.az);
   const lx=-sinA,lz=-cosA,rx=cosA,rz=-sinA; // look and right on the floor
   const back=p.halfH*1.1,far=p.halfH*1.7,half=p.halfW;
   const ax=X(p.x-lx*back),az=Z(p.z-lz*back);
   const c1x=X(p.x+lx*far+rx*half),c1z=Z(p.z+lz*far+rz*half);
   const c2x=X(p.x+lx*far-rx*half),c2z=Z(p.z+lz*far-rz*half);
   g.save();g.beginPath();g.rect(Math.max(1,X(b.x0)-3),Math.max(1,Z(b.z0)-3),Math.min(W-2,bw*s+6),Math.min(H-2,bd*s+6));g.clip();
   g.beginPath();g.moveTo(ax,az);g.lineTo(c1x,c1z);g.lineTo(c2x,c2z);g.closePath();
   g.fillStyle=live;g.globalAlpha=0.2;g.fill();g.globalAlpha=1;g.strokeStyle=live;g.lineWidth=1.2;g.stroke();
   g.restore();
   g.beginPath();g.arc(X(p.x),Z(p.z),2.6,0,Math.PI*2);g.fillStyle=ink;g.fill();
  };
  return api.subscribe(draw);
 },[scene,api,selected]);
 const onClick=(e:React.MouseEvent<HTMLCanvasElement>):void=>{
  const r=e.currentTarget.getBoundingClientRect();
  const {s,ox,oz}=map.current;
  scene?.recentre(((e.clientX-r.left)/r.width*W-ox)/s,((e.clientY-r.top)/r.height*H-oz)/s);
 };
 return (
  <div className="lab-minimap" data-testid="lab-minimap" role="group" aria-label={tr('Minimap','Peta mini')}>
   <canvas ref={cv} style={{width:W,height:H}} onClick={onClick} aria-label={tr('Minimap: click to recentre the view','Peta mini: klik untuk memusatkan tampilan')} data-testid="lab-minimap-canvas"/>
   <span className="lab-minimap-n" aria-hidden="true"><i/>N</span>
  </div>
 );
}
