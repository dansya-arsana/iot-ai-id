import {Box3,DirectionalLight,Group,HemisphereLight,OrthographicCamera,Scene,SRGBColorSpace,Vector3,WebGLRenderTarget,type Texture,type WebGLRenderer} from 'three';
import type {LessonId,PartKind,PartSpec,PartState} from '../contract';
import {LESSON_IDS} from '../contract';
import {LESSON_MODULES} from '../lessons/index';
import type {LessonModule} from '../lessons/index';
import {buildUno} from './board-uno';
import {buildPart} from './parts/index';
import {contentBox} from './bounds';
import {setLineResolution,setMmPerPx} from './materials';
import * as C from './palette';

const rad=(d:number):number=>(d*Math.PI)/180;
const spec=(kind:PartKind,props:Record<string,string|number|boolean>={}):PartSpec=>({id:kind,kind,net:{},props});
type Item={s:PartSpec;x:number;z?:number;state?:PartState};
const LIT_LED:PartState={kind:'led',brightness:1,on:true,currentMa:12,overCurrent:false};
const PASSIVE=new Set(['resistor','diode','transistor','capacitor']);
/** The hero subject of a lesson, laid out as a small tableau: its `thumbnail` data, else the first two non-passive parts of its circuit. */
function subjectOf(m:LessonModule):Item[]|'uno'{
 if(m.thumbnail==='uno')return 'uno';
 if(m.thumbnail)return m.thumbnail.map(t=>({s:spec(t.kind,t.props),x:t.x,...(t.z!==undefined?{z:t.z}:{}),...(t.state?{state:t.state}:{})}));
 const kinds=[...new Set(m.circuit.parts.map(p=>p.kind))].filter(k=>!PASSIVE.has(k)).slice(0,2);
 return (kinds.length?kinds:['led']).map((k,i)=>({s:spec(k,k==='led'?{color:'red'}:{}),x:i*34,...(k==='led'?{state:LIT_LED}:{})}));
}

const next=():Promise<void>=>new Promise(r=>requestAnimationFrame(()=>r()));

/** Renders each lesson's hero subject into a render target, one per frame, and returns webp data URLs. */
export async function renderThumbnails(renderer:WebGLRenderer,env:Texture|null,o:{width:number;height:number;dpr:number;order?:LessonId[];onEach?:(id:LessonId,url:string)=>void}):Promise<Partial<Record<LessonId,string>>>{
 const order=[...(o.order??[]),...LESSON_IDS].filter((id,i,a)=>a.indexOf(id)===i);
 const SUBJECT:Record<string,Item[]|'uno'>={};
 for(const m of LESSON_MODULES)SUBJECT[m.id]=subjectOf(m);
 return renderSubjects<LessonId>(renderer,env,SUBJECT,order,o);
}

/** One part per tile (default props), for the parts gallery. */
export function renderKindSheet(renderer:WebGLRenderer,env:Texture|null,kinds:string[],o:{width:number;height:number;dpr:number;onEach?:(k:string,url:string)=>void}):Promise<Partial<Record<string,string>>>{
 const subj:Record<string,Item[]>={};
 for(const k of kinds)subj[k]=[{s:spec(k),x:0}];
 return renderSubjects<string>(renderer,env,subj,kinds,o);
}

async function renderSubjects<K extends string>(renderer:WebGLRenderer,env:Texture|null,SUBJ:Record<K,Item[]|'uno'>,order:K[],o:{width:number;height:number;dpr:number;onEach?:(id:K,url:string)=>void}):Promise<Partial<Record<K,string>>>{
 const W=Math.max(8,Math.round(o.width*o.dpr)),H=Math.max(8,Math.round(o.height*o.dpr));
 const rt=new WebGLRenderTarget(W,H,{samples:4,colorSpace:SRGBColorSpace});
 const scene=new Scene();scene.environment=env;scene.environmentIntensity=0.55;
 scene.add(new HemisphereLight(C.FLOOR_SKY,C.FLOOR_GROUND,0.6));
 const key=new DirectionalLight(C.WHITE,2.0);key.position.set(-140,300,40);scene.add(key);
 const fill=new DirectionalLight(C.FILL,0.35);fill.position.set(200,120,220);scene.add(fill);
 const cam=new OrthographicCamera(-1,1,1,-1,-4000,4000);
 const out:Partial<Record<K,string>>={};
 const cv=document.createElement('canvas');cv.width=W;cv.height=H;
 const g=cv.getContext('2d')!;
 const px=new Uint8Array(W*H*4);
 const box=new Box3(),ctr=new Vector3();
 const az=rad(45),el=rad(30);
 const right=new Vector3(Math.cos(az),0,-Math.sin(az)),up=new Vector3(-Math.sin(az)*Math.sin(el),Math.cos(el),-Math.cos(az)*Math.sin(el));
 const dir=new Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el));
 for(const id of order){
  await next();
  const grp=new Group();scene.add(grp);
  const dispose:(()=>void)[]=[];
  if(SUBJ[id]==='uno'){const u=buildUno();grp.add(u.group);dispose.push(()=>u.dispose());}
  else for(const it of SUBJ[id] as Item[]){
   const v=buildPart(it.s);v.group.position.set(it.x,0,it.z??0);grp.add(v.group);
   if(it.state)v.apply(it.state,0);
  }
  contentBox([grp],box);
  const pts:Vector3[]=[];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])pts.push(new Vector3(x,y,z));
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  for(const p of pts){const a=p.dot(right),b=p.dot(up);x0=Math.min(x0,a);x1=Math.max(x1,a);y0=Math.min(y0,b);y1=Math.max(y1,b);}
  const mpp=Math.max((x1-x0)/(0.85*W),(y1-y0)/(0.85*H));
  const hw=mpp*W/2,hh=mpp*H/2;
  cam.left=-hw;cam.right=hw;cam.top=hh;cam.bottom=-hh;cam.updateProjectionMatrix();
  ctr.copy(right).multiplyScalar((x0+x1)/2).addScaledVector(up,(y0+y1)/2);
  cam.position.copy(ctr).addScaledVector(dir,1200);cam.lookAt(ctr);cam.updateMatrixWorld();
  setMmPerPx(mpp*o.dpr);setLineResolution(W/o.dpr,H/o.dpr);
  const prevTarget=renderer.getRenderTarget();
  renderer.setRenderTarget(rt);renderer.setClearColor(0x000000,0);renderer.clear();renderer.render(scene,cam); // ds-allow-hex
  renderer.readRenderTargetPixels(rt,0,0,W,H,px);
  renderer.setRenderTarget(prevTarget);
  const img=g.createImageData(W,H);
  for(let y=0;y<H;y++)img.data.set(px.subarray((H-1-y)*W*4,(H-y)*W*4),y*W*4);
  g.putImageData(img,0,0);
  try{out[id]=cv.toDataURL('image/webp',0.92);}catch{out[id]=cv.toDataURL('image/png');}
  if(out[id])o.onEach?.(id,out[id]!);
  scene.remove(grp);
  grp.traverse(c=>{(c as {geometry?:{dispose():void}}).geometry?.dispose?.();});
  for(const d of dispose)d();
 }
 rt.dispose();
 return out;
}
