import {MathUtils,OrthographicCamera,Vector3} from 'three';
import {setMmPerPx} from './materials';

export interface SafeInsets{top:number;right:number;bottom:number;left:number}
export interface ContentRect{x:number;y:number;w:number;h:number}

const DUR=500;
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
 constructor(){this.apply();}

 /** Set the lesson framing: 8 world-space bbox corners and the view angles in degrees. */
 setContent(corners:Vector3[],azDeg:number,elevDeg:number,instant:boolean):void{
  this.corners=corners.map(c=>c.clone());this.baseAz=rad(azDeg);this.elev=rad(elevDeg);
  this.az=Math.round(this.az/(Math.PI*2))*Math.PI*2+this.baseAz;
  this.computeFit();
  this.glideTo(this.fitTarget,1,this.az,instant);
 }
 setSafe(i:SafeInsets):void{
  this.insets={...i};this.computeFit();this.glideTo(this.fitTarget,1,this.az,false);
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
  this.tw=null;
  const mpp=(2*this.halfH())/Math.max(1,viewHeightPx);
  const rx=Math.cos(this.az),rz=-Math.sin(this.az),fx=-Math.sin(this.az),fz=-Math.cos(this.az);
  const k=mpp/Math.sin(this.elev);
  this.target.x+=-rx*dxPx*mpp+fx*dyPx*k;this.target.z+=-rz*dxPx*mpp+fz*dyPx*k;
  this.apply();
 }
 zoomBy(f:number):void{
  const z=MathUtils.clamp((this.tw?this.tw.tz:this.zoom)*f,0.6,4);
  if(this.reducedMotion){this.zoom=z;this.tw=null;this.apply();return;}
  this.tw={t:0,ft:this.target.clone(),fz:this.zoom,faz:this.az,tt:(this.tw?this.tw.tt:this.target).clone(),tz:z,taz:this.tw?this.tw.taz:this.az};
 }
 rotate(dir:1|-1):void{
  const taz=(this.tw?this.tw.taz:this.az)+dir*Math.PI/2;
  if(this.reducedMotion){this.az=taz;this.tw=null;this.apply();return;}
  this.tw={t:0,ft:this.target.clone(),fz:this.zoom,faz:this.az,tt:(this.tw?this.tw.tt:this.target).clone(),tz:this.tw?this.tw.tz:this.zoom,taz};
 }
 reset():void{
  const az=Math.round(this.az/(Math.PI*2))*Math.PI*2+this.baseAz;
  this.glideTo(this.fitTarget,1,az,false);
 }
 focus(p:Vector3|null,zoomIn=1.6):void{
  if(!p){this.reset();return;}
  this.glideTo(p,zoomIn,this.az,false);
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
  if(this.tw){
   const w=this.tw;w.t=Math.min(1,w.t+dtMs/DUR);
   const e=ease(w.t);
   this.target.lerpVectors(w.ft,w.tt,e);
   this.zoom=w.fz*(w.tz/w.fz)**e;
   this.az=MathUtils.lerp(w.faz,w.taz,e);
   if(w.t>=1)this.tw=null;
   dirty=true;
  }else if(this.autoRotate&&!this.reducedMotion){this.az+=dtMs*0.00012;dirty=true;}
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
