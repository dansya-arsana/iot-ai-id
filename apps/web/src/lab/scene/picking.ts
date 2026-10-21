import {Object3D,PerspectiveCamera,Plane,Raycaster,Vector2,Vector3,type OrthographicCamera} from 'three';
import type {PartInput,PartState,ScreenPoint,TargetId} from '../contract';
import {INPUT_RANGES} from '../contract';
import {lampCm,lampMm,obstacleCm,obstacleMm} from './layout';
import type {Interactive} from './parts';
import type {CameraRig} from './camera';

export interface PickEntry{id:string;object:Object3D;interactive?:Interactive}
export interface PickingOptions{
 canvas:HTMLCanvasElement;rig:CameraRig;
 entries():PickEntry[];
 partState(id:string):PartState|undefined;
 project(o:Object3D,out:ScreenPoint):ScreenPoint;
 onSelect(t:TargetId|null):void;
 onHover(t:TargetId|null,at:ScreenPoint|null):void;
 onInput(id:string,i:PartInput):void;
}
export interface Picking{dispose():void}

const DRAG_PX=4;


export function createPicking(o:PickingOptions):Picking{
 const {canvas,rig}=o;
 const ray=new Raycaster();const ndc=new Vector2();
 const ground=new Plane(new Vector3(0,1,0),0);
 const hitPt=new Vector3();const tmpV=new Vector3();
 const sp:ScreenPoint={x:0,y:0,visible:true};
 type Drag={id:string|null;mode:Interactive|null;sx:number;sy:number;lx:number;ly:number;moved:boolean;pointerId:number;
  startMm:number;startHit:number;entry:PickEntry|null;pressed:boolean};
 let drag:Drag|null=null;

 const setNdc=(e:PointerEvent|WheelEvent):void=>{
  const r=canvas.getBoundingClientRect();
  ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
 };
 const pick=(e:PointerEvent):{entry:PickEntry;point:Vector3}|null=>{
  setNdc(e);ray.setFromCamera(ndc,rig.camera as OrthographicCamera|PerspectiveCamera);
  const entries=o.entries();
  const hits=ray.intersectObjects(entries.map(x=>x.object),true);
  for(const h of hits){
   if(h.object.userData.noPick||h.object.visible===false)continue;
   let n:Object3D|null=h.object;
   while(n){
    const id=n.userData.targetId as string|undefined;
    if(id){const entry=entries.find(x=>x.id===id);if(entry)return {entry,point:h.point};}
    n=n.parent;
   }
  }
  return null;
 };
 const groundHit=(e:PointerEvent,y:number):Vector3|null=>{
  setNdc(e);ray.setFromCamera(ndc,rig.camera as OrthographicCamera);
  ground.constant=-y;
  return ray.ray.intersectPlane(ground,hitPt);
 };

 const onMove=(e:PointerEvent):void=>{
  if(drag&&e.pointerId===drag.pointerId){
   const d=drag;
   if(!d.moved&&Math.hypot(e.clientX-d.sx,e.clientY-d.sy)>=DRAG_PX)d.moved=true;
   if(d.mode==='rotate'&&d.entry){
    const r=canvas.getBoundingClientRect();
    o.project(d.entry.object,sp);
    // knob centre = projected centre; unsquash the isometric tilt
    const dx=e.clientX-r.left-sp.x,dy=(e.clientY-r.top-sp.y)/Math.sin(rig.elev);
    let a=(Math.atan2(dx,-dy)*180)/Math.PI;
    a=Math.max(-135,Math.min(135,a));
    o.onInput(d.id!,{kind:'potentiometer',value:Math.round(((a+135)/270)*INPUT_RANGES.potentiometer.max)});
   }else if((d.mode==='slide-x'||d.mode==='slide-z'||(d.mode==='toggle-slide'&&d.moved))&&d.entry){
    const h=groundHit(e,0);
    if(h){
     const cur=(d.mode==='slide-z'?h.z:h.x)-d.startHit+d.startMm;
     if(d.mode==='slide-z')o.onInput(d.id!,{kind:'obstacle',distanceCm:Math.round(obstacleCm(cur))});
     else o.onInput(d.id!,{kind:'lamp',distanceCm:Math.round(lampCm(cur))});
    }
   }else if(!d.id&&d.moved){
    rig.pan(e.clientX-d.lx,e.clientY-d.ly,canvas.clientHeight);
    d.lx=e.clientX;d.ly=e.clientY;
   }
   return;
  }
  const p=pick(e);
  const id=p?p.entry.id:null;
  if(p){
   const r=canvas.getBoundingClientRect();
   tmpV.copy(p.point).project(rig.camera);
   o.onHover(id,{x:((tmpV.x+1)/2)*r.width,y:((1-tmpV.y)/2)*r.height,visible:true});
  }else o.onHover(null,null);
  canvas.style.cursor=p?(p.entry.interactive?'grab':'pointer'):'';
 };
 const onDown=(e:PointerEvent):void=>{
  if(e.button!==0||drag)return;
  const p=pick(e);
  const d:Drag={id:p?p.entry.id:null,mode:p?p.entry.interactive??null:null,sx:e.clientX,sy:e.clientY,lx:e.clientX,ly:e.clientY,moved:false,pointerId:e.pointerId,startMm:0,startHit:0,entry:p?p.entry:null,pressed:false};
  drag=d;
  canvas.setPointerCapture(e.pointerId);
  if(d.mode==='press'){d.pressed=true;o.onInput(d.id!,{kind:'button',pressed:true});}
  else if(d.mode==='slide-x'||d.mode==='slide-z'||d.mode==='toggle-slide'){
   const st=o.partState(d.id!);
   const cm=st&&(st.kind==='lamp'||st.kind==='obstacle')?st.distanceCm:50;
   d.startMm=d.mode==='slide-z'?obstacleMm(cm):lampMm(cm);
   const h=groundHit(e,0);d.startHit=h?(d.mode==='slide-z'?h.z:h.x):0;
  }
  if(d.mode==='rotate')canvas.style.cursor='grabbing';
 };
 const finish=(e:PointerEvent,cancel:boolean):void=>{
  const d=drag;if(!d||e.pointerId!==d.pointerId)return;
  drag=null;
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  if(d.pressed)o.onInput(d.id!,{kind:'button',pressed:false});
  if(cancel)return;
  const click=!d.moved&&Math.hypot(e.clientX-d.sx,e.clientY-d.sy)<DRAG_PX;
  if(click){
   if(d.mode==='toggle-slide'){
    const st=o.partState(d.id!);
    o.onInput(d.id!,{kind:'lamp',on:!(st&&st.kind==='lamp'&&st.on)});
   }
   o.onSelect(d.id);
  }
 };
 const onUp=(e:PointerEvent):void=>finish(e,false);
 const onCancel=(e:PointerEvent):void=>finish(e,true);
 const onLost=(e:PointerEvent):void=>{if(drag&&e.pointerId===drag.pointerId)finish(e,true);};
 const onLeave=():void=>{if(!drag){o.onHover(null,null);canvas.style.cursor='';}};
 const onWheel=(e:WheelEvent):void=>{e.preventDefault();rig.zoomBy(Math.exp(-e.deltaY*0.0015));};

 canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerdown',onDown);
 canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',onCancel);
 canvas.addEventListener('lostpointercapture',onLost);canvas.addEventListener('pointerleave',onLeave);
 canvas.addEventListener('wheel',onWheel,{passive:false});
 return {dispose(){
  canvas.removeEventListener('pointermove',onMove);canvas.removeEventListener('pointerdown',onDown);
  canvas.removeEventListener('pointerup',onUp);canvas.removeEventListener('pointercancel',onCancel);
  canvas.removeEventListener('lostpointercapture',onLost);canvas.removeEventListener('pointerleave',onLeave);
  canvas.removeEventListener('wheel',onWheel);
  if(drag?.pressed)o.onInput(drag.id!,{kind:'button',pressed:false});
  drag=null;
 }};
}
