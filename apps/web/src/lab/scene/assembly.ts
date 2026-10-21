// Step-by-step assembly animation. A pure timeline (AssemblyPlayer, no WebGL) drives a Stage; the three.js Stage
// moves the real scene objects (board drop, breadboard slide, part drop + seat pulse, wire draw via drawRange).
import {Box3,Mesh,MeshBasicMaterial,RingGeometry,TubeGeometry,Vector3,Group,type Object3D} from 'three';
import {specToCircuit,stepsOf,type CircuitSpec,type SpecStep} from '../circuit-spec';
import {contentBox} from './bounds';
import * as C from './palette';

// ---------- timings (ms at speed 1) ----------
export const T={
 board:700,bb:600,bbStart:500,introEnd:1200,
 part:480,partGap:220,wire:560,wireGap:260,afterParts:150,tail:180,
} as const;

const clamp01=(v:number):number=>v<0?0:v>1?1:v;
export const easeOutCubic=(t:number):number=>1-(1-t)**3;
export const easeOutBounce=(t:number):number=>{
 const n=7.5625,d=2.75;
 if(t<1/d)return n*t*t;
 if(t<2/d){t-=1.5/d;return n*t*t+0.75;}
 if(t<2.5/d){t-=2.25/d;return n*t*t+0.9375;}
 t-=2.625/d;return n*t*t+0.984375;
};

// ---------- pure timeline ----------
export interface Stage{
 board(k:number):void;
 breadboard(k:number):void;
 part(id:string,k:number):void;
 wire(id:string,k:number):void;
 /** Ease the camera onto the step content. Never called in instant mode. */
 frame(step:SpecStep,index:number):void;
 /** Restore the exact loadCircuit(spec) state (positions, visibility, draw ranges, camera fit). Called once. */
 finish():void;
}
export interface StepEvent{index:number;total:number;step:SpecStep;phase:'start'|'end'}
export interface PlayerOptions{speed?:number;onStep?(e:StepEvent):void;signal?:AbortSignal}
export interface PlayerState{status:'idle'|'playing'|'paused'|'done'|'aborted';index:number;total:number;timeMs:number;totalMs:number}

interface Item{kind:'board'|'bb'|'part'|'wire';id:string;start:number;dur:number;k:number}
interface Plan{step:SpecStep;start:number;end:number;items:Item[];started:boolean;ended:boolean}

export function planSteps(spec:CircuitSpec):{intro:Item[];plans:Plan[];totalMs:number}{
 const intro:Item[]=[
  {kind:'board',id:'',start:0,dur:T.board,k:0},
  {kind:'bb',id:'',start:T.bbStart,dur:T.bb,k:0},
 ];
 let t=T.introEnd;
 const plans:Plan[]=[];
 for(const step of stepsOf(spec)){
  const items:Item[]=[];
  const ps=step.add.parts??[],ws=step.add.wires??[];
  let end=0;
  ps.forEach((id,i)=>{const s=i*T.partGap;items.push({kind:'part',id,start:t+s,dur:T.part,k:0});end=Math.max(end,s+T.part);});
  const w0=ps.length?(ps.length-1)*T.partGap+T.part*0.55+T.afterParts:0;
  ws.forEach((id,i)=>{const s=w0+i*T.wireGap;items.push({kind:'wire',id,start:t+s,dur:T.wire,k:0});end=Math.max(end,s+T.wire);});
  end+=T.tail;
  plans.push({step,start:t,end:t+end,items,started:false,ended:false});
  t+=end;
 }
 return {intro,plans,totalMs:t};
}

export class AssemblyPlayer{
 readonly done:Promise<void>;
 private resolveDone!:()=>void;private rejectDone!:(e:unknown)=>void;
 private t=0;private speed:number;private status:PlayerState['status']='idle';
 private intro:Item[];private plans:Plan[];private totalMs:number;
 private current=0;private finished=false;
 constructor(private spec:CircuitSpec,private stage:Stage,private o:PlayerOptions={}){
  this.speed=o.speed??1;
  const p=planSteps(spec);this.intro=p.intro;this.plans=p.plans;this.totalMs=p.totalMs;
  this.done=new Promise<void>((res,rej)=>{this.resolveDone=res;this.rejectDone=rej;});
  this.done.catch(()=>undefined);
 }
 state():PlayerState{return {status:this.status,index:Math.min(this.current,this.plans.length-1),total:this.plans.length,timeMs:this.t,totalMs:this.totalMs};}
 start():Promise<void>{
  const sg=this.o.signal;
  if(sg?.aborted){this.abort();return this.done;}
  sg?.addEventListener('abort',()=>this.abort(),{once:true});
  this.status='playing';
  if(!(this.speed>0)){this.t=this.totalMs;this.advance(true);}
  return this.done;
 }
 pause():void{if(this.status==='playing')this.status='paused';}
 resume():void{if(this.status==='paused')this.status='playing';}
 /** Jump to the end of the current step (or of the intro). */
 skip():void{
  if(this.status==='done'||this.status==='aborted'||this.status==='idle')return;
  if(this.t<T.introEnd)this.t=T.introEnd;
  else{const p=this.plans.find(x=>!x.ended);if(p)this.t=Math.max(this.t,p.end);}
  this.advance(false);
 }
 /** Finish every remaining step at once (steps still emit their events). */
 skipAll():void{
  if(this.status==='done'||this.status==='aborted'||this.status==='idle')return;
  this.t=this.totalMs;this.advance(false);
 }
 abort():void{
  if(this.finished)return;
  this.finished=true;this.status='aborted';this.stage.finish();
  this.rejectDone(new DOMException('Assembly aborted','AbortError'));
 }
 tick(dtMs:number):void{
  if(this.status!=='playing')return;
  this.t+=dtMs*this.speed;this.advance(false);
 }
 private apply(it:Item):void{
  const k=clamp01((this.t-it.start)/it.dur);
  if(k===it.k)return;
  it.k=k;
  if(it.kind==='board')this.stage.board(k);
  else if(it.kind==='bb')this.stage.breadboard(k);
  else if(it.kind==='part')this.stage.part(it.id,k);
  else this.stage.wire(it.id,k);
 }
 private advance(instant:boolean):void{
  for(const it of this.intro)this.apply(it);
  const total=this.plans.length;
  for(let i=0;i<total;i++){
   const p=this.plans[i]!;
   if(!p.started&&this.t>=p.start){
    p.started=true;this.current=i;
    if(!instant)this.stage.frame(p.step,i);
    this.o.onStep?.({index:i,total,step:p.step,phase:'start'});
   }
   if(p.started)for(const it of p.items)this.apply(it);
   if(p.started&&!p.ended&&this.t>=p.end){p.ended=true;this.o.onStep?.({index:i,total,step:p.step,phase:'end'});}
  }
  if(this.t>=this.totalMs&&!this.finished){
   this.finished=true;this.status='done';this.stage.finish();this.resolveDone();
  }
 }
}

// ---------- spec wire id -> circuit wire index (specToCircuit skips wires without a board end) ----------
const BOARDISH=/^(D\d+|A\d|5V|3V3|GND|VIN|rail\.(5v|gnd))$/;
export function mapSpecWires(spec:CircuitSpec,circuit:ReturnType<typeof specToCircuit>):Map<string,number>{
 const out=new Map<string,number>();
 let cur=0;
 spec.wires.forEach((w,i)=>{
  const ends=[w.from,w.to];
  const bp=ends.find(e=>BOARDISH.test(e));
  if(!bp)return;
  const pp=ends.find(e=>e!==bp)??'';
  let key:string|null=null;
  if(/^rail\./.test(pp))key=`bb.${pp==='rail.5v'?'5v-rail':'gnd-rail'}`;
  else if(!BOARDISH.test(pp)&&/^[^.]+\..+$/.test(pp))key=pp;
  if(!key)return;
  const cw=circuit.wires[cur];
  if(cw&&`${cw.componentId}.${cw.pin}`===key){out.set(w.id??`w${i}`,cur);cur++;}
 });
 return out;
}

// ---------- three.js stage ----------
export interface AssemblyHost{
 root:Object3D;uno:Object3D;breadboard:Object3D;
 part(id:string):Object3D|undefined;
 wiresRoot:Object3D;
 /** Ease the camera onto a world point (zoom relative to the fit); null returns to the fit. */
 focus(p:Vector3|null,zoom?:number):void;
 /** Diagonal (mm) of the fitted content: the zoom-1 frame. */
 fitSize():number;
}

const DROP_BOARD=42,SLIDE_BB=74,DROP_PART=18;

interface WireObjs{a:Object3D[];b:Object3D[];tubes:Mesh[]}

export function createThreeStage(h:AssemblyHost,spec:CircuitSpec):Stage{
 const circuit=specToCircuit(spec);
 const wmap=mapSpecWires(spec,circuit);
 const wobjs=new Map<number,WireObjs>();
 const tagged:Object3D[]=[];
 h.wiresRoot.traverse(o=>{if(o.userData.wireIdx!==undefined)tagged.push(o);});
 for(const o of tagged){
  const wi=o.userData.wireIdx as number;
  const e=wobjs.get(wi)??{a:[],b:[],tubes:[]};wobjs.set(wi,e);
  const part=o.userData.wirePart as string;
  if(part==='a')e.a.push(o);else if(part==='b')e.b.push(o);else if((o as Mesh).geometry instanceof TubeGeometry)e.tubes.push(o as Mesh);
 }
 const tubeIdx=(m:Mesh):number=>((m.geometry as TubeGeometry).index?.count??0);
 const fullIdx=new Map<Mesh,number>();
 for(const e of wobjs.values())for(const m of e.tubes)fullIdx.set(m,tubeIdx(m));

 // base state to restore
 const unoBase=h.uno.position.clone(),bbBase=h.breadboard.position.clone(),bbVis=h.breadboard.visible,unoVis=h.uno.visible;
 const partBase=new Map<string,{o:Object3D;pos:Vector3;sy:number}>();
 for(const p of spec.parts){const o=h.part(p.id);if(o)partBase.set(p.id,{o,pos:o.position.clone(),sy:o.scale.y});}

 // per-step camera target, measured while everything is still in its final place
 const frames=new Map<SpecStep,{c:Vector3;zoom:number}>();
 const bx=new Box3(),sz=new Vector3();
 const fit=h.fitSize();
 for(const step of stepsOf(spec)){
  const objs:Object3D[]=[];
  for(const id of step.add.parts??[]){const b=partBase.get(id);if(b)objs.push(b.o);}
  for(const id of step.add.wires??[]){
   const wi=wmap.get(id);const e=wi===undefined?undefined:wobjs.get(wi);
   if(e)objs.push(...e.a,...e.b,...e.tubes);
  }
  if(!objs.length)continue;
  contentBox(objs,bx);if(bx.isEmpty())continue;
  bx.getSize(sz);
  const zoom=Math.max(1,Math.min(1.8,fit/(Math.max(sz.length(),24)*2.4)));
  frames.set(step,{c:bx.getCenter(new Vector3()),zoom});
 }

 // seat-pulse rings (flat, fading), one per part, removed in finish()
 const ringGroup=new Group();ringGroup.name='assembly-rings';h.root.add(ringGroup);
 const ringGeo=new RingGeometry(0.86,1,40);
 const rings=new Map<string,Mesh>();
 const ringFor=(id:string):Mesh|null=>{
  let r=rings.get(id);if(r)return r;
  const b=partBase.get(id);if(!b)return null;
  const mat=new MeshBasicMaterial({color:C.LIVE,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  r=new Mesh(ringGeo,mat);r.rotation.x=-Math.PI/2;r.position.set(b.pos.x,b.pos.y+0.15,b.pos.z);
  r.userData.noPick=true;r.userData.noInk=true;r.userData.noFit=true;r.visible=false;
  ringGroup.add(r);rings.set(id,r);return r;
 };

 const setWireK=(e:WireObjs,k:number):void=>{
  const on=k>0;
  for(const o of e.a)o.visible=on;
  for(const o of e.b)o.visible=k>=0.92;
  for(const m of e.tubes){
   m.visible=on;
   const full=fullIdx.get(m)??0;
   // 96 tubular segments x 72 indices each; keep whole segments so the head never tears
   const seg=Math.max(1,Math.floor(easeOutCubic(k)*96));
   m.geometry.setDrawRange(0,k>=1?Infinity:Math.min(full,seg*72));
  }
 };

 const stage:Stage={
  board(k){h.uno.visible=k>0;h.uno.position.y=unoBase.y+DROP_BOARD*(1-easeOutBounce(clamp01(k)));},
  breadboard(k){h.breadboard.visible=bbVis&&k>0;h.breadboard.position.x=bbBase.x+SLIDE_BB*(1-easeOutCubic(k));},
  part(id,k){
   const b=partBase.get(id);if(!b)return;
   b.o.visible=k>0;
   b.o.position.y=b.pos.y+DROP_PART*(1-easeOutBounce(clamp01(k)));
   const sq=k>0.55&&k<1?Math.sin(((k-0.55)/0.45)*Math.PI)*0.06:0;
   b.o.scale.y=b.sy*(1-sq);
   const r=ringFor(id);
   if(r){
    const q=clamp01((k-0.55)/0.45);
    r.visible=q>0&&q<1;
    if(r.visible){r.scale.setScalar(5+9*q);(r.material as MeshBasicMaterial).opacity=0.55*(1-q);}
   }
  },
  wire(id,k){
   const wi=wmap.get(id);const e=wi===undefined?undefined:wobjs.get(wi);
   if(e)setWireK(e,k);
  },
  frame(step){
   const f=frames.get(step);
   if(f)h.focus(f.c,f.zoom);
  },
  finish(){
   h.uno.visible=unoVis;h.uno.position.copy(unoBase);
   h.breadboard.visible=bbVis;h.breadboard.position.copy(bbBase);
   for(const b of partBase.values()){b.o.visible=true;b.o.position.copy(b.pos);b.o.scale.y=b.sy;}
   for(const e of wobjs.values()){
    for(const o of [...e.a,...e.b])o.visible=true;
    for(const m of e.tubes){m.visible=true;m.geometry.setDrawRange(0,Infinity);}
   }
   ringGroup.parent?.remove(ringGroup);
   for(const r of rings.values())(r.material as MeshBasicMaterial).dispose();
   ringGeo.dispose();
   h.focus(null);
  },
 };
 // start fully hidden: the player only calls k>0 updates
 h.uno.visible=false;h.uno.position.y=unoBase.y+DROP_BOARD;
 h.breadboard.visible=false;h.breadboard.position.x=bbBase.x+SLIDE_BB;
 for(const b of partBase.values())b.o.visible=false;
 for(const e of wobjs.values())setWireK(e,0);
 return stage;
}

// ---------- controller used by the scene ----------
export interface AssemblyControl{
 pause():void;resume():void;
 /** Jump to the end of the current step. */
 skip():void;
 /** Finish all remaining steps now. */
 skipAll():void;
 state():PlayerState;
}
export interface AssemblyController extends AssemblyControl{
 play(spec:CircuitSpec,o:{speed?:number;onStep?(e:StepEvent):void;signal?:AbortSignal},host:AssemblyHost):Promise<void>;
 tick(dtMs:number):void;
 /** Stop and restore the built state; the running promise rejects with AbortError. Safe when idle. */
 cancel():void;
}
export function createAssemblyController(reduced:()=>boolean):AssemblyController{
 let player:AssemblyPlayer|null=null;
 const idle:PlayerState={status:'idle',index:0,total:0,timeMs:0,totalMs:0};
 return {
  play(spec,o,host){
   player?.abort();
   const speed=reduced()?0:o.speed??1;
   const stage=createThreeStage(host,spec);
   const p=new AssemblyPlayer(spec,stage,{speed,onStep:o.onStep,signal:o.signal});
   player=p;
   return p.start();
  },
  tick(dt){player?.tick(dt);},
  cancel(){player?.abort();},
  pause(){player?.pause();},resume(){player?.resume();},
  skip(){player?.skip();},skipAll(){player?.skipAll();},
  state(){return player?.state()??idle;},
 };
}

// ---------- dev harness: open /lab?assembly=demo (add &speed=0.3 to slow it, &autoplay=0 to wait) ----------
export interface AssemblyDemoScene{playAssembly(spec:CircuitSpec,o?:{speed?:number;onStep?(e:StepEvent):void}):Promise<void>;assembly:AssemblyControl;ready:Promise<void>}
export function installAssemblyDemo(scene:AssemblyDemoScene,spec:CircuitSpec):void{
 if(typeof window==='undefined'||typeof document==='undefined')return;
 const q=new URLSearchParams(window.location.search);
 if(q.get('assembly')!=='demo')return;
 const cap=document.createElement('div');
 cap.setAttribute('data-testid','assembly-caption');cap.setAttribute('role','status');
 cap.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:50;max-width:min(560px,90vw);padding:10px 16px;border:1px solid CanvasText;background:Canvas;color:CanvasText;font:14px/1.4 system-ui,sans-serif;pointer-events:none';
 document.body.appendChild(cap);
 const id=document.documentElement.lang.startsWith('id');
 const play=(o:{speed?:number}={}):Promise<void>=>scene.playAssembly(spec,{
  speed:o.speed??(Number(q.get('speed'))||1),
  onStep:e=>{
   cap.dataset.step=String(e.index+1);cap.dataset.phase=e.phase;
   if(e.phase==='start')cap.textContent=`${e.index+1}/${e.total}  ${id?e.step.caption.id:e.step.caption.en}`;
  },
 }).then(()=>{cap.dataset.phase='done';cap.textContent='';},()=>undefined);
 (window as unknown as {__labAssembly:unknown}).__labAssembly={play,control:scene.assembly,spec};
 if(q.get('autoplay')!=='0')void scene.ready.then(()=>setTimeout(()=>void play(),1500));
}
