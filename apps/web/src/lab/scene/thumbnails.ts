import {Box3,DirectionalLight,Group,HemisphereLight,OrthographicCamera,Scene,SRGBColorSpace,Vector3,WebGLRenderTarget,type Texture,type WebGLRenderer} from 'three';
import type {LessonId,PartKind,PartSpec,PartState} from '../contract';
import {LESSON_IDS} from '../contract';
import {buildUno} from './board-uno';
import {buildPart} from './parts';
import {contentBox} from './bounds';
import {setLineResolution,setMmPerPx} from './materials';
import * as C from './palette';

const rad=(d:number):number=>(d*Math.PI)/180;
const spec=(kind:PartKind,props:Record<string,string|number|boolean>={}):PartSpec=>({id:kind,kind,net:{},props});
type Item={s:PartSpec;x:number;z?:number;state?:PartState};
const litLed:PartState={kind:'led',brightness:1,on:true,currentMa:12,overCurrent:false};
/** The hero subject of each lesson, laid out as a small tableau. */
const SUBJECT:Record<LessonId,Item[]|'uno'>={
 board:'uno',
 blink:[{s:spec('led',{color:'red'}),x:0,state:litLed},{s:spec('resistor',{ohms:220}),x:14}],
 button:[{s:spec('button'),x:0}],
 knob:[{s:spec('potentiometer',{value:640}),x:0,state:{kind:'potentiometer',value:640}}],
 rgb:[{s:spec('rgb-led'),x:0,state:{kind:'rgb-led',r:1,g:0.08,b:0.6}}],
 light:[{s:spec('ldr'),x:0},{s:spec('lamp',{distanceCm:40,on:true}),x:34,z:-6,state:{kind:'lamp',distanceCm:40,on:true}}],
 distance:[{s:spec('hcsr04'),x:0}],
 sound:[{s:spec('buzzer'),x:0}],
 motor:[{s:spec('motor'),x:0}],
 servo:[{s:spec('servo'),x:0}],
 parking:[{s:spec('hcsr04'),x:0,z:0},{s:spec('obstacle',{shape:'car',distanceCm:30}),x:0,z:34,state:{kind:'obstacle',distanceCm:30}}],
};

const next=():Promise<void>=>new Promise(r=>requestAnimationFrame(()=>r()));

/** Renders each lesson's hero subject into a render target, one per frame, and returns webp data URLs. */
export async function renderThumbnails(renderer:WebGLRenderer,env:Texture|null,o:{width:number;height:number;dpr:number;order?:LessonId[];onEach?:(id:LessonId,url:string)=>void}):Promise<Partial<Record<LessonId,string>>>{
 const W=Math.max(8,Math.round(o.width*o.dpr)),H=Math.max(8,Math.round(o.height*o.dpr));
 const rt=new WebGLRenderTarget(W,H,{samples:4,colorSpace:SRGBColorSpace});
 const scene=new Scene();scene.environment=env;scene.environmentIntensity=0.55;
 scene.add(new HemisphereLight(C.FLOOR_SKY,C.FLOOR_GROUND,0.6));
 const key=new DirectionalLight(C.WHITE,2.0);key.position.set(-140,300,40);scene.add(key);
 const fill=new DirectionalLight(C.FILL,0.35);fill.position.set(200,120,220);scene.add(fill);
 const cam=new OrthographicCamera(-1,1,1,-1,-4000,4000);
 const out:Partial<Record<LessonId,string>>={};
 const cv=document.createElement('canvas');cv.width=W;cv.height=H;
 const g=cv.getContext('2d')!;
 const px=new Uint8Array(W*H*4);
 const box=new Box3(),ctr=new Vector3();
 const az=rad(45),el=rad(30);
 const right=new Vector3(Math.cos(az),0,-Math.sin(az)),up=new Vector3(-Math.sin(az)*Math.sin(el),Math.cos(el),-Math.cos(az)*Math.sin(el));
 const dir=new Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el));
 const order=[...(o.order??[]),...LESSON_IDS].filter((id,i,a)=>a.indexOf(id)===i);
 for(const id of order){
  await next();
  const grp=new Group();scene.add(grp);
  const dispose:(()=>void)[]=[];
  if(SUBJECT[id]==='uno'){const u=buildUno();grp.add(u.group);dispose.push(()=>u.dispose());}
  else for(const it of SUBJECT[id] as Item[]){
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
