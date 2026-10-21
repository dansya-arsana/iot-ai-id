import {Object3D,PerspectiveCamera,Plane,Raycaster,Vector2,Vector3,type OrthographicCamera} from 'three';
import type {PartInput,PartState,ScreenPoint,TargetId} from '../contract';
import {INPUT_RANGES} from '../contract';
import {lampCm,lampMm,obstacleCm,obstacleMm} from './layout';
import type {Interactive} from './parts/index';
import type {PartModule} from './parts/types';
import type {InteractiveHandlers} from './index';
import {cursorsFor,keyNudge,pointerAngle,relativeKnob,snapCm} from './drag';
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
 /** v3 direct manipulation (all optional: without them picking behaves exactly like v2). */
 handlers?():InteractiveHandlers|null;
 module?(id:string):PartModule|undefined;
 /** Hover/drag/keyboard-focus rim on a part (null clears). */
 hoverHighlight?(id:string|null):void;
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
  startMm:number;startHit:number;entry:PickEntry|null;pressed:boolean;startVal:number;startAng:number;last:number|null;touch:boolean;at:ScreenPoint};
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

 const dragRange=(id:string,mode:Interactive|null):readonly [number,number]=>{
  const r=o.module?.(id)?.interact?.drag?.range;
  if(r)return r;
  const k=mode==='slide-z'?INPUT_RANGES.obstacle:INPUT_RANGES.lamp;return [k.min,k.max];
 };
 /** One continuous edit: sim input first (real values), then the HUD handler. Deduplicated. */
 const emit=(d:Drag,kind:'potentiometer'|'obstacle'|'lamp',prop:string,v:number,phase:'start'|'move'|'end'):void=>{
  if(phase!=='end'&&v===d.last)return;
  d.last=v;
  if(kind==='potentiometer')o.onInput(d.id!,{kind,value:v});else o.onInput(d.id!,{kind,distanceCm:v});
  o.handlers?.()?.onDrag?.(d.id!,prop,v,phase);
 };
 const hovered:{id:string|null}={id:null};
 const setHl=(id:string|null):void=>{if(hovered.id===id)return;hovered.id=id;o.hoverHighlight?.(id);};
 let sel:string|null=null;
 const cursorFor=(e:PickEntry|null,active:boolean):string=>{
  if(!e)return '';
  const c=cursorsFor(o.module?.(e.id)?.interact?.drag);
  if(c)return active?c.active:c.hover;
  return e.interactive?(active?'grabbing':'grab'):'pointer';
 };
 const hasControls=(id:string):boolean=>!!o.module?.(id)?.interact?.controls?.length;
 const stateVal=(id:string):number=>{
  const st=o.partState(id);
  return st?.kind==='potentiometer'?st.value:st&&(st.kind==='lamp'||st.kind==='obstacle')?st.distanceCm:0;
 };

 const onMove=(e:PointerEvent):void=>{
  if(drag&&e.pointerId===drag.pointerId){
   const d=drag;
   if(!d.moved&&Math.hypot(e.clientX-d.sx,e.clientY-d.sy)>=DRAG_PX)d.moved=true;
   if(d.mode==='rotate'&&d.entry){
    const r=canvas.getBoundingClientRect();
    o.project(d.entry.object,sp);
    const ang=pointerAngle(e.clientX-r.left-sp.x,e.clientY-r.top-sp.y,rig.elev);
    emit(d,'potentiometer','value',relativeKnob(d.startVal,d.startAng,ang),'move');
   }else if((d.mode==='slide-x'||d.mode==='slide-z'||(d.mode==='toggle-slide'&&d.moved))&&d.entry){
    const h=groundHit(e,0);
    if(h){
     const cur=(d.mode==='slide-z'?h.z:h.x)-d.startHit+d.startMm;
     const range=dragRange(d.id!,d.mode);
     const cm=snapCm(d.mode==='slide-z'?obstacleCm(cur):lampCm(cur),range,e.shiftKey);
     emit(d,d.mode==='slide-z'?'obstacle':'lamp','distanceCm',cm,'move');
    }
   }else if(!d.id&&d.moved){
    rig.pan(e.clientX-d.lx,e.clientY-d.ly,canvas.clientHeight);
    d.lx=e.clientX;d.ly=e.clientY;
   }
   return;
  }
  if(e.pointerType==='touch')return;
  const p=pick(e);
  const id=p?p.entry.id:null;
  if(p){
   const r=canvas.getBoundingClientRect();
   tmpV.copy(p.point).project(rig.camera);
   const at={x:((tmpV.x+1)/2)*r.width,y:((1-tmpV.y)/2)*r.height,visible:true};
   o.onHover(id,at);o.handlers?.()?.onHoverPart?.(id,at);
  }else{o.onHover(null,null);o.handlers?.()?.onHoverPart?.(null,null);}
  const live=!!o.handlers?.();
  setHl(live&&p&&(p.entry.interactive||hasControls(p.entry.id))?p.entry.id:null);
  canvas.style.cursor=cursorFor(p?p.entry:null,false);
 };
 const projectHit=(pt:Vector3):ScreenPoint=>{
  const r=canvas.getBoundingClientRect();tmpV.copy(pt).project(rig.camera);
  return {x:((tmpV.x+1)/2)*r.width,y:((1-tmpV.y)/2)*r.height,visible:true};
 };
 const onDown=(e:PointerEvent):void=>{
  if(e.button!==0||drag)return;
  const p=pick(e);
  const d:Drag={id:p?p.entry.id:null,mode:p?p.entry.interactive??null:null,sx:e.clientX,sy:e.clientY,lx:e.clientX,ly:e.clientY,moved:false,pointerId:e.pointerId,startMm:0,startHit:0,entry:p?p.entry:null,pressed:false,startVal:0,startAng:0,last:null,touch:e.pointerType==='touch',at:p?projectHit(p.point):{x:0,y:0,visible:false}};
  drag=d;
  canvas.setPointerCapture(e.pointerId);
  if(d.id){sel=d.id;if(o.handlers?.())setHl(d.id);}
  if(d.mode==='press'){d.pressed=true;o.onInput(d.id!,{kind:'button',pressed:true});o.handlers?.()?.onPress?.(d.id!,true);}
  else if(d.mode==='slide-x'||d.mode==='slide-z'||d.mode==='toggle-slide'){
   const st=o.partState(d.id!);
   const cm=st&&(st.kind==='lamp'||st.kind==='obstacle')?st.distanceCm:50;
   d.startMm=d.mode==='slide-z'?obstacleMm(cm):lampMm(cm);
   const h=groundHit(e,0);d.startHit=h?(d.mode==='slide-z'?h.z:h.x):0;
   d.last=Math.round(cm);
   o.handlers?.()?.onDrag?.(d.id!,'distanceCm',Math.round(cm),'start');
  }else if(d.mode==='rotate'){
   const r=canvas.getBoundingClientRect();
   o.project(d.entry!.object,sp);
   d.startVal=stateVal(d.id!);
   d.startAng=pointerAngle(e.clientX-r.left-sp.x,e.clientY-r.top-sp.y,rig.elev);
   d.last=d.startVal;
   o.handlers?.()?.onDrag?.(d.id!,'value',d.startVal,'start');
  }
  if(d.id&&d.mode)canvas.style.cursor=cursorFor(d.entry,true);
 };
 const finish=(e:PointerEvent,cancel:boolean):void=>{
  const d=drag;if(!d||e.pointerId!==d.pointerId)return;
  drag=null;
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  if(d.pressed){o.onInput(d.id!,{kind:'button',pressed:false});o.handlers?.()?.onPress?.(d.id!,false);}
  if(d.moved&&d.last!==null&&d.id)o.handlers?.()?.onDrag?.(d.id,d.mode==='rotate'?'value':'distanceCm',d.last,'end');
  if(d.id)canvas.style.cursor=d.touch?'':cursorFor(d.entry,false);
  if(cancel)return;
  const click=!d.moved&&Math.hypot(e.clientX-d.sx,e.clientY-d.sy)<DRAG_PX;
  if(click){
   const h=o.handlers?.();
   const popover=!!(h?.onOpenControls&&d.id&&hasControls(d.id));
   if(d.mode==='toggle-slide'&&!popover){
    const st=o.partState(d.id!);
    const on=!(st&&st.kind==='lamp'&&st.on);
    o.onInput(d.id!,{kind:'lamp',on});h?.onPress?.(d.id!,on);
   }
   o.onSelect(d.id);
   if(popover)h!.onOpenControls!(d.id!,d.at);
  }
  if(d.touch)setHl(null);
 };
 const onUp=(e:PointerEvent):void=>finish(e,false);
 const onCancel=(e:PointerEvent):void=>finish(e,true);
 const onLost=(e:PointerEvent):void=>{if(drag&&e.pointerId===drag.pointerId)finish(e,true);};
 const onLeave=():void=>{if(!drag){o.onHover(null,null);o.handlers?.()?.onHoverPart?.(null,null);setHl(null);canvas.style.cursor='';}};
 const focusable=():string[]=>o.handlers?.()?o.entries().map(x=>x.id).filter(id=>o.module?.(id)?.interact):[];
 const openAt=(id:string):void=>{
  const ent=o.entries().find(x=>x.id===id);if(!ent)return;
  o.project(ent.object,sp);
  o.handlers?.()?.onOpenControls?.(id,{x:sp.x,y:sp.y,visible:true});
 };
 let keyPress:string|null=null;
 const onKey=(e:KeyboardEvent):void=>{
  if(!o.handlers?.()||e.altKey||e.ctrlKey||e.metaKey)return;
  const list=focusable();
  if(e.key==='Tab'){
   if(!list.length)return;
   const i=sel?list.indexOf(sel):-1,n=i+(e.shiftKey?-1:1);
   if(n<0||n>=list.length){sel=null;setHl(null);return;} // let focus leave the canvas
   e.preventDefault();sel=list[n]!;setHl(sel);o.onSelect(sel);return;
  }
  if(!sel||!list.includes(sel))return;
  const m=o.module?.(sel),drag=m?.interact?.drag;
  if(e.key==='Enter'&&hasControls(sel)){e.preventDefault();openAt(sel);return;}
  if((e.key===' '||e.key==='Enter')&&drag?.handle==='press'){
   e.preventDefault();if(keyPress)return;keyPress=sel;
   o.onInput(sel,{kind:'button',pressed:true});o.handlers?.()?.onPress?.(sel,true);return;
  }
  if(e.key===' '&&drag?.handle==='toggle-slide'){
   e.preventDefault();const st=o.partState(sel);const on=!(st&&st.kind==='lamp'&&st.on);
   o.onInput(sel,{kind:'lamp',on});o.handlers?.()?.onPress?.(sel,on);return;
  }
  const v=keyNudge(e.key,e.shiftKey,stateVal(sel),drag);
  if(v!==null&&m){
   e.preventDefault();
   const k=m.kind;
   if(k==='potentiometer')o.onInput(sel,{kind:k,value:v});
   else if(k==='obstacle'||k==='lamp')o.onInput(sel,{kind:k,distanceCm:v});
   o.handlers?.()?.onDrag?.(sel,drag!.prop!,v,'end');
  }
 };
 const onKeyUp=(e:KeyboardEvent):void=>{
  if(keyPress&&(e.key===' '||e.key==='Enter')){o.onInput(keyPress,{kind:'button',pressed:false});o.handlers?.()?.onPress?.(keyPress,false);keyPress=null;}
 };
 const onBlur=():void=>{
  if(keyPress){o.onInput(keyPress,{kind:'button',pressed:false});keyPress=null;}
  sel=null;setHl(null);
 };
 const onWheel=(e:WheelEvent):void=>{e.preventDefault();rig.zoomBy(Math.exp(-e.deltaY*0.0015));};

 canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerdown',onDown);
 canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',onCancel);
 canvas.addEventListener('lostpointercapture',onLost);canvas.addEventListener('pointerleave',onLeave);
 canvas.addEventListener('wheel',onWheel,{passive:false});
 if(!canvas.hasAttribute('tabindex'))canvas.tabIndex=0;
 canvas.addEventListener('keydown',onKey);canvas.addEventListener('keyup',onKeyUp);canvas.addEventListener('blur',onBlur);
 return {dispose(){
  canvas.removeEventListener('keydown',onKey);canvas.removeEventListener('keyup',onKeyUp);canvas.removeEventListener('blur',onBlur);
  setHl(null);
  canvas.removeEventListener('pointermove',onMove);canvas.removeEventListener('pointerdown',onDown);
  canvas.removeEventListener('pointerup',onUp);canvas.removeEventListener('pointercancel',onCancel);
  canvas.removeEventListener('lostpointercapture',onLost);canvas.removeEventListener('pointerleave',onLeave);
  canvas.removeEventListener('wheel',onWheel);
  if(drag?.pressed)o.onInput(drag.id!,{kind:'button',pressed:false});
  drag=null;
 }};
}
