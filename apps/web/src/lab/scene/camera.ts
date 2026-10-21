import {MathUtils,OrthographicCamera,Vector3} from 'three';
import type {LessonId} from '../contract';
import {PRESETS} from './layout';

const ELEV=(35*Math.PI)/180;
const BASE_HALF=60; // mm of half view height at zoom 1 (landscape 3:2)
const DUR=700;
const easeOut=(t:number):number=>1-(1-t)**3;

export class CameraRig{
 readonly camera=new OrthographicCamera(-1,1,1,-1,-4000,4000);
 reducedMotion=false;autoRotate=false;
 private target=new Vector3();private zoom=1;private az=Math.PI/4;
 private presetTarget=new Vector3();private presetZoom=1;private presetAz=Math.PI/4;
 private aspect=1.5;
 private tw:{t:number;ft:Vector3;fz:number;faz:number;tt:Vector3;tz:number;taz:number}|null=null;
 private tmp=new Vector3();
 constructor(){this.apply();}

 setPreset(lesson:LessonId,instant:boolean):void{
  const p=PRESETS[lesson]??PRESETS.blink!;
  this.presetTarget.set(p.target[0],p.target[1],p.target[2]);this.presetZoom=p.zoom;
  this.glideTo(this.presetTarget,p.zoom,this.presetAz,instant);
 }
 private glideTo(t:Vector3,z:number,az:number,instant:boolean):void{
  const cz=MathUtils.clamp(z,this.presetZoom*0.6,this.presetZoom*3);
  if(instant||this.reducedMotion){this.target.copy(t);this.zoom=cz;this.az=az;this.tw=null;this.apply();return;}
  this.tw={t:0,ft:this.target.clone(),fz:this.zoom,faz:this.az,tt:t.clone(),tz:cz,taz:az};
 }
 resize(w:number,h:number):void{this.aspect=Math.max(0.1,w/Math.max(1,h));this.apply();}
 pan(dxPx:number,dyPx:number,viewHeightPx:number):void{
  this.tw=null;
  const mpp=(2*this.halfH())/Math.max(1,viewHeightPx);
  const rx=Math.cos(this.az),rz=-Math.sin(this.az),fx=-Math.sin(this.az),fz=-Math.cos(this.az);
  const k=mpp/Math.sin(ELEV);
  this.target.x+=-rx*dxPx*mpp+fx*dyPx*k;this.target.z+=-rz*dxPx*mpp+fz*dyPx*k;
  this.apply();
 }
 zoomBy(f:number):void{
  const z=MathUtils.clamp((this.tw?this.tw.tz:this.zoom)*f,this.presetZoom*0.6,this.presetZoom*3);
  if(this.reducedMotion){this.zoom=z;this.tw=null;this.apply();return;}
  this.tw={t:0,ft:this.target.clone(),fz:this.zoom,faz:this.az,tt:(this.tw?this.tw.tt:this.target).clone(),tz:z,taz:this.tw?this.tw.taz:this.az};
 }
 rotate(dir:1|-1):void{
  const taz=(this.tw?this.tw.taz:this.az)+dir*Math.PI/2;
  if(this.reducedMotion){this.az=taz;this.tw=null;this.apply();return;}
  this.tw={t:0,ft:this.target.clone(),fz:this.zoom,faz:this.az,tt:(this.tw?this.tw.tt:this.target).clone(),tz:this.tw?this.tw.tz:this.zoom,taz};
 }
 reset():void{
  this.az=Math.round(this.az/(Math.PI*2))*Math.PI*2+Math.PI/4;
  this.glideTo(this.presetTarget,this.presetZoom,this.az,false);
 }
 focus(p:Vector3|null,zoomIn=1.6):void{
  if(!p){this.glideTo(this.presetTarget,this.presetZoom,this.az,false);return;}
  this.glideTo(p,this.presetZoom*zoomIn,this.az,false);
 }
 zoomLevel():number{return this.zoom/this.presetZoom;}
 private halfH():number{return (BASE_HALF/this.zoom)*Math.max(1,1.5/this.aspect);}
 update(dtMs:number):void{
  let dirty=false;
  if(this.tw){
   const w=this.tw;w.t=Math.min(1,w.t+dtMs/DUR);
   const e=easeOut(w.t);
   this.target.lerpVectors(w.ft,w.tt,e);
   this.zoom=w.fz*(w.tz/w.fz)**e;
   this.az=MathUtils.lerp(w.faz,w.taz,e);
   if(w.t>=1)this.tw=null;
   dirty=true;
  }else if(this.autoRotate&&!this.reducedMotion){this.az+=dtMs*0.00012;dirty=true;}
  if(dirty)this.apply();
 }
 private apply():void{
  const c=this.camera,h=this.halfH(),w=h*this.aspect;
  c.left=-w;c.right=w;c.top=h;c.bottom=-h;c.updateProjectionMatrix();
  this.tmp.set(Math.sin(this.az)*Math.cos(ELEV),Math.sin(ELEV),Math.cos(this.az)*Math.cos(ELEV)).multiplyScalar(1200).add(this.target);
  c.position.copy(this.tmp);c.lookAt(this.target);c.updateMatrixWorld();
 }
}
