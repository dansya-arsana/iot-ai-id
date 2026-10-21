import {MathUtils,OrthographicCamera,Vector3} from 'three';
import {setMmPerPx} from './materials';

export interface SafeInsets{top:number;right:number;bottom:number;left:number}
export interface ContentRect{x:number;y:number;w:number;h:number}
/** Camera pose for the minimap: look-at point on the floor (mm), azimuth (rad, 0 = looking toward -z), visible half extents (mm). */
export interface CameraPose{x:number;z:number;az:number;halfW:number;halfH:number;zoom:number}

const DUR=500;
const IDLE_MS=2500; // turntable waits this long after the last user camera input
const FILL=0.93;
const ease=(t:number):number=>t<0.5?4*t*t*t:1-(-2*t+2)**3/2;
const rad=(d:number):number=>(d*Math.PI)/180;

/** Orthographic rig that auto-fits the lesson content to 72% of the safe rect. zoom is relative: 1 = the fit. */
export class CameraRig{
 readonly camera=new OrthographicCamera(-1,1,1,-1,-4000,4000);
 reducedMotion=false;autoRotate=false;
 elev=rad(35);
 private target=new Vector3();private zoom=1;private az=rad(45);
 private fitTarget=new Vector3();private fitHalf=60;private baseAz=rad(45);
 private corners:Vector3[]=[];
 private w=900;private h=600;private aspect=1.5;
 private insets:SafeInsets={top:0,right:0,bottom:0,left:0};
 private tw:{t:number;ft:Vector3;fz:number;faz:number;tt:Vector3;tz:number;taz:number}|null=null;
 private tmp=new Vector3();private r=new Vector3();private u=new Vector3();
 private idleMs=IDLE_MS;private mx=0;private my=0;
 constructor(){this.apply();}
 /** Any user camera input restarts the turntable idle timer. */
 touch():void{this.idleMs=0;}
 /** Held-key pan: x = right(+)/left(-), y = forward(+)/back(-), each -1..1. Applied per frame in update(). */
 setMove(x:number,y:number):void{this.mx=x;this.my=y;if(x||y){this.touch();this.tw=null;}}
 pose():CameraPose{return {x:this.target.x,z:this.target.z,az:this.az,halfW:this.halfH()*this.aspect,halfH:this.halfH(),zoom:this.zoom};}
 /** Slide the view to a floor point, keeping zoom and angle. */
 recentre(p:Vector3):void{this.touch();this.glideTo(new Vector3(p.x,this.target.y,p.z),this.tw?this.tw.tz:this.zoom,this.tw?this.tw.taz:this.az,false);}

 /** Set the lesson framing: 8 world-space bbox corners and the view angles in degrees. */
 setContent(corners:Vector3[],azDeg:number,elevDeg:number,instant:boolean):void{
  this.corners=corners.map(c=>c.clone());this.baseAz=rad(azDeg);this.elev=rad(elevDeg);
  this.az=Math.round(this.az/(Math.PI*2))*Math.PI*2+this.baseAz;
  this.computeFit();
  this.glideTo(this.fitTarget,1,this.az,instant);
 }
 setSafe(i:SafeInsets):void{
  this.insets={...i};this.computeFit();
  // a visibility toggle must not undo a focused or user-moved view: only re-glide when the camera is sitting on the fit
  if(this.tw?this.tw.tz===1:Math.abs(this.zoom-1)<0.001)this.glideTo(this.fitTarget,1,this.az,false);
 }
 /** Keep an in-flight or settled fit pinned to the freshly computed fit (resize before/while tweening). */
 private followFit():void{
  if(this.tw&&this.tw.tz===1)this.tw.tt.copy(this.fitTarget);
  else if(!this.tw&&Math.abs(this.zoom-1)<0.001)this.target.copy(this.fitTarget);
 }
 resize(w:number,h:number):void{
  this.w=Math.max(1,w);this.h=Math.max(1,h);this.aspect=this.w/this.h;
  this.computeFit();
  this.followFit();
  this.apply();
 }
 private basis(az:number):void{
  this.r.set(Math.cos(az),0,-Math.sin(az));
  this.u.set(-Math.sin(az)*Math.sin(this.elev),Math.cos(this.elev),-Math.cos(az)*Math.sin(this.elev));
 }
 private computeFit():void{
  if(!this.corners.length)return;
  this.basis(this.baseAz);
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  for(const c of this.corners){const x=c.dot(this.r),y=c.dot(this.u);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  const {top,right,bottom,left}=this.insets;
  const sw=Math.max(40,this.w-left-right),sh=Math.max(40,this.h-top-bottom);
  const mpp=Math.max((x1-x0)/(FILL*sw),(y1-y0)/(FILL*sh));
  this.fitHalf=mpp*this.h/2;
  const sx=(left+(this.w-right))/2-this.w/2,sy=(top+(this.h-bottom))/2-this.h/2;
  const cx=(x0+x1)/2-sx*mpp,cy=(y0+y1)/2+sy*mpp;
  this.fitTarget.copy(this.r).multiplyScalar(cx).addScaledVector(this.u,cy);
 }
 private glideTo(t:Vector3,z:number,az:number,instant:boolean):void{
  const cz=MathUtils.clamp(z,0.6,4);
  if(instant||this.reducedMotion){this.target.copy(t);this.zoom=cz;this.az=az;this.tw=null;this.apply();return;}
  this.tw={t:0,ft:this.target.clone(),fz:this.zoom,faz:this.az,tt:t.clone(),tz:cz,taz:az};
 }
 pan(dxPx:number,dyPx:number,viewHeightPx:number):void{
  this.tw=null;this.touch();
  const mpp=(2*this.halfH())/Math.max(1,viewHeightPx);
  const rx=Math.cos(this.az),rz=-Math.sin(this.az),fx=-Math.sin(this.az),fz=-Math.cos(this.az);
  const k=mpp/Math.sin(this.elev);
  this.target.x+=-rx*dxPx*mpp+fx*dyPx*k;this.target.z+=-rz*dxPx*mpp+fz*dyPx*k;
  this.apply();
 }
 zoomBy(f:number):void{
  this.touch();
  const z=MathUtils.clamp((this.tw?this.tw.tz:this.zoom)*f,0.6,4);
  if(this.reducedMotion){this.zoom=z;this.tw=null;this.apply();return;}
  this.tw={t:0,ft:this.target.clone(),fz:this.zoom,faz:this.az,tt:(this.tw?this.tw.tt:this.target).clone(),tz:z,taz:this.tw?this.tw.taz:this.az};
 }
 rotate(dir:1|-1):void{
  this.touch();
  const taz=(this.tw?this.tw.taz:this.az)+dir*Math.PI/2;
  if(this.reducedMotion){this.az=taz;this.tw=null;this.apply();return;}
  this.tw={t:0,ft:this.target.clone(),fz:this.zoom,faz:this.az,tt:(this.tw?this.tw.tt:this.target).clone(),tz:this.tw?this.tw.tz:this.zoom,taz};
 }
 reset():void{
  this.touch();
  const az=Math.round(this.az/(Math.PI*2))*Math.PI*2+this.baseAz;
  this.glideTo(this.fitTarget,1,az,false);
 }
 focus(p:Vector3|null,zoomIn=1.8):void{
  this.touch();
  if(!p){this.reset();return;}
  this.glideTo(p,zoomIn,this.az,false);
 }
 /** Largest zoom at which the box corners, seen around centre c, still sit inside the safe rect. */
 zoomThatFits(corners:Vector3[],c:Vector3):number{
  const az=this.tw?this.tw.taz:this.az;
  const r=new Vector3(Math.cos(az),0,-Math.sin(az));
  const u=new Vector3(-Math.sin(az)*Math.sin(this.elev),Math.cos(this.elev),-Math.cos(az)*Math.sin(this.elev));
  const {top,right,bottom,left}=this.insets;
  const ppm=this.h/(2*this.fitHalf);
  let z=4;
  for(const k of corners){
   const d=k.clone().sub(c),dx=d.dot(r),dy=d.dot(u);
   if(Math.abs(dx)>1e-6)z=Math.min(z,(dx>0?this.w/2-right:this.w/2-left)/(Math.abs(dx)*ppm));
   if(Math.abs(dy)>1e-6)z=Math.min(z,(dy>0?this.h/2-top:this.h/2-bottom)/(Math.abs(dy)*ppm));
  }
  return Math.max(0.6,z);
 }
 zoomLevel():number{return this.zoom;}
 private halfH():number{return this.fitHalf/this.zoom;}
 /** Content bbox projected to canvas CSS px (current camera). */
 contentRect():ContentRect|null{
  if(!this.corners.length)return null;
  this.camera.updateMatrixWorld();
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  for(const c of this.corners){
   this.tmp.copy(c).project(this.camera);
   const x=((this.tmp.x+1)/2)*this.w,y=((1-this.tmp.y)/2)*this.h;
   x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
  }
  return {x:x0,y:y0,w:x1-x0,h:y1-y0};
 }
 update(dtMs:number):void{
  let dirty=false;
  this.idleMs+=dtMs;
  if((this.mx||this.my)&&dtMs>0){
   const k=this.halfH()*1.4*dtMs/1000;
   const rx=Math.cos(this.az),rz=-Math.sin(this.az),fx=-Math.sin(this.az),fz=-Math.cos(this.az);
   this.target.x+=(rx*this.mx+fx*this.my)*k;this.target.z+=(rz*this.mx+fz*this.my)*k;
   this.idleMs=0;dirty=true;
  }else if(this.tw){
   const w=this.tw;w.t=Math.min(1,w.t+dtMs/DUR);
   const e=ease(w.t);
   this.target.lerpVectors(w.ft,w.tt,e);
   this.zoom=w.fz*(w.tz/w.fz)**e;
   this.az=MathUtils.lerp(w.faz,w.taz,e);
   if(w.t>=1)this.tw=null;
   dirty=true;
  }else if(this.autoRotate&&!this.reducedMotion&&this.idleMs>=IDLE_MS){this.az+=dtMs*0.00012;dirty=true;}
  if(dirty)this.apply();
 }
 /** Re-apply camera + hull scale (after offscreen renders changed the shared scale). */
 refresh():void{this.apply();}
 private apply():void{
  const c=this.camera,h=this.halfH(),w=h*this.aspect;
  c.left=-w;c.right=w;c.top=h;c.bottom=-h;c.updateProjectionMatrix();
  const ce=Math.cos(this.elev);
  this.tmp.set(Math.sin(this.az)*ce,Math.sin(this.elev),Math.cos(this.az)*ce).multiplyScalar(1200).add(this.target);
  c.position.copy(this.tmp);c.lookAt(this.target);c.updateMatrixWorld();
  setMmPerPx(2*h/this.h);
 }
}

/**
 * Keyboard pan for the stage: W/A/S/D move the view over the floor while held. Ignored while typing in a field.
 * Q/E/+/-/R stay in the page-level handler. Returns the unbind function.
 */
export function bindCameraKeys(rig:CameraRig,target:Window=window):()=>void{
 const held=new Set<string>();
 const typing=(t:EventTarget|null):boolean=>{
  const el=t as HTMLElement|null;const tag=el?.tagName;
  return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||!!el?.isContentEditable;
 };
 const push=():void=>rig.setMove((held.has('d')?1:0)-(held.has('a')?1:0),(held.has('w')?1:0)-(held.has('s')?1:0));
 const down=(e:KeyboardEvent):void=>{
  if(e.metaKey||e.ctrlKey||e.altKey||typing(e.target))return;
  const k=e.key.toLowerCase();
  if(k!=='w'&&k!=='a'&&k!=='s'&&k!=='d')return;
  held.add(k);push();
 };
 const up=(e:KeyboardEvent):void=>{held.delete(e.key.toLowerCase());push();};
 const clear=():void=>{held.clear();push();};
 target.addEventListener('keydown',down);target.addEventListener('keyup',up);target.addEventListener('blur',clear);
 return ()=>{target.removeEventListener('keydown',down);target.removeEventListener('keyup',up);target.removeEventListener('blur',clear);clear();};
}
