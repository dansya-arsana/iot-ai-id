/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect -- imperative three.js viewport: refs mirror live state for the render loop and the effects sync an external WebGL scene */
/**
 * 3D node assembly viewport (M5-B). Selection, hover and visibility are controlled from the workspace when props are given
 * (tree and 3D then share one model); without them the viewport keeps its own state so it also runs alone.
 * Imports the lab scene parts and never edits them.
 */
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AmbientLight,Group,CanvasTexture,Color,DirectionalLight,DoubleSide,Mesh,MeshBasicMaterial,NeutralToneMapping,PerspectiveCamera,PlaneGeometry,PMREMGenerator,Raycaster,RepeatWrapping,Scene,SRGBColorSpace,Vector2,Vector3,WebGLRenderer} from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import type {ProNode} from '../../../../../packages/pro-contract/system-spec';
import {createNodeAssembly,modelSizeOf,type NodeAssembly} from './node-assembly';
import {planAssembly} from './plan';
import {fractionOf} from './explode';
import {escape as escapeVis,isolate,isVisible,showAll,toggleHidden,type VisibilityState} from './isolate';
import {formatMm,measure,snapPoints,snapToScreen,type MeasureResult} from './measure';
import {cuts,initialSection,plane,type Axis,type SectionState} from './section';
import {combine,FACE_DIR,ISO_DIR,toggleProjection,upFor,type CubeFace,type Projection} from './view-cube';
import {ViewCube,type ViewCubeHandle} from './ViewCube';
import {layoutBalloons,type Balloon} from './balloons';
import type {Vec3} from './plan';
import './cad.css';

export interface CadViewportProps{
 node:ProNode;
 selectedId?:string|null;
 onSelect?(id:string|null):void;
 hoverId?:string|null;
 onHover?(id:string|null):void;
 visibility?:VisibilityState;
 onVisibilityChange?(v:VisibilityState):void;
 /** Initial explode percent. */
 defaultExplode?:number;
 /** Label of the context chip, e.g. 'N2'. */
 contextLabel?:string;
}
type Tool='select'|'measure';
const FOV=35,FOV_ORTHO=2;
const tanH=(deg:number)=>Math.tan(deg*Math.PI/360);
const reduced=():boolean=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

const I={
 select:<path d="M4 3l8 4-3.5 1.2L7 12z"/>,
 measure:<path d="M2 11 11 2l3 3-9 9zM5 8l1.5 1.5M7.5 5.5 9 7"/>,
 section:<path d="M2 2h12v12H2zM2 14 14 2M2 8 8 2M8 14l6-6" strokeDasharray="2 1.5"/>,
 isolate:<g><circle cx="8" cy="8" r="2"/><circle cx="8" cy="8" r="5.5"/></g>,
 hide:<path d="M2 8s2.5-4.5 6-4.5S14 8 14 8s-2.5 4.5-6 4.5S2 8 2 8zM3 13 13 3"/>,
 fit:<path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/>,
};
const Ic=({n}:{n:keyof typeof I})=><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[n]}</svg>;

function hatchTexture():CanvasTexture{
 const cv=document.createElement('canvas');cv.width=cv.height=32;
 const x=cv.getContext('2d')!;x.strokeStyle='#0a0a0a';x.lineWidth=2; // ds-allow-hex
 x.beginPath();x.moveTo(0,32);x.lineTo(32,0);x.moveTo(-8,8);x.lineTo(8,-8);x.moveTo(24,40);x.lineTo(40,24);x.stroke();
 const t=new CanvasTexture(cv);t.wrapS=t.wrapT=RepeatWrapping;t.repeat.set(1,1);t.colorSpace=SRGBColorSpace;return t;
}

export function CadViewport(p:CadViewportProps){
 const {node}=p;
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const rootRef=useRef<HTMLDivElement>(null);
 const cubeRef=useRef<ViewCubeHandle>(null);
 const [failed,setFailed]=useState(false);
 const [compact,setCompact]=useState(false);
 const [tool,setTool]=useState<Tool>('select');
 const [explode,setExplode]=useState(p.defaultExplode??0);
 const [projection,setProjection]=useState<Projection>('persp');
 const [section,setSection]=useState<SectionState>(initialSection());
 const [meas,setMeas]=useState<{a:Vec3|null;res:MeasureResult|null}>({a:null,res:null});
 const [innerSel,setInnerSel]=useState<string|null>(null);
 const [innerHover,setInnerHover]=useState<string|null>(null);
 const [innerVis,setInnerVis]=useState<VisibilityState>(showAll());
 const [balloons,setBalloons]=useState<Balloon[]>([]);
 const [dimPts,setDimPts]=useState<{a:[number,number];b:[number,number]}|null>(null);
 const sel=p.selectedId!==undefined?p.selectedId:innerSel;
 const hover=p.hoverId!==undefined?p.hoverId:innerHover;
 const vis=p.visibility??innerVis;
 const setSel=(id:string|null)=>{setInnerSel(id);p.onSelect?.(id);};
 const setHover=(id:string|null)=>{setInnerHover(id);p.onHover?.(id);};
 const setVis=(v:VisibilityState)=>{setInnerVis(v);p.onVisibilityChange?.(v);};

 const asm=useRef<NodeAssembly|null>(null);
 const rt=useRef<{render():void;dirty():void;snap(dir:Vec3,ms?:number):void;fit():void;setProj(pr:Projection):void;project(v:Vec3):[number,number]|null;pick(x:number,y:number):{id:string;point:Vec3}|null;hatch(s:SectionState|null,cutBoxes:{pos:Vec3;size:Vec3}[],min:Vec3,max:Vec3):void}|null>(null);
 const live=useRef({tool,sel,vis,hover,meas,section,explode});
 live.current={tool,sel,vis,hover,meas,section,explode};
 const cb=useRef({setSel,setHover,setMeas});cb.current={setSel,setHover,setMeas};

 const [built,setBuilt]=useState<NodeAssembly|null>(null);
 useEffect(()=>{const a=createNodeAssembly(node);asm.current=a;setBuilt(a);return()=>{a.dispose();if(asm.current===a)asm.current=null;setBuilt(null);};},[node]);
 const planData=useMemo(()=>planAssembly(node,modelSizeOf),[node]);
 const plan=built as NodeAssembly;

 // ---- renderer, camera, controls (once per node) ----
 useEffect(()=>{
  const canvas=canvasRef.current;if(!canvas||!plan)return;
  let renderer:WebGLRenderer;
  try{renderer=new WebGLRenderer({canvas,antialias:true,alpha:true});}catch{setFailed(true);return;}
  renderer.setClearAlpha(0);renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=NeutralToneMapping;renderer.localClippingEnabled=true;
  const scene=new Scene();
  const pm=new PMREMGenerator(renderer);const env=new RoomEnvironment();const envRT=pm.fromScene(env,0.04);
  scene.environment=envRT.texture;scene.environmentIntensity=0.7;env.dispose();pm.dispose();
  scene.add(new AmbientLight(new Color(1,1,1),0.5));
  const sun=new DirectionalLight(new Color(1,1,1),1.6);sun.position.set(-200,400,500);scene.add(sun);
  scene.add(plan.group);
  const hatchMat=new MeshBasicMaterial({map:hatchTexture(),transparent:true,opacity:0.55,side:DoubleSide,depthWrite:false});
  const hatch=new Group();hatch.userData.noPick=true;scene.add(hatch);
  const cam=new PerspectiveCamera(FOV,1,1,60000);
  const controls=new OrbitControls(cam,canvas);controls.enableDamping=!reduced();controls.dampingFactor=0.12;controls.screenSpacePanning=true;
  const target=new Vector3();
  const ray=new Raycaster();const v2=new Vector2();
  let dirty=true,raf=0,disposed=false,tween:{t0:number;dur:number;fromDir:Vector3;toDir:Vector3;fromD:number;toD:number}|null=null;
  let pr:Projection='persp';
  const size=()=>{const r=canvas.getBoundingClientRect();return {w:Math.max(1,r.width),h:Math.max(1,r.height)};};
  const radius=()=>{const b=plan.bounds();return Math.max(60,Math.hypot(b.max[0]-b.min[0],b.max[1]-b.min[1],b.max[2]-b.min[2])/2);};
  const centre=()=>{const b=plan.bounds();return new Vector3((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2);};
  const fitDistance=()=>{const {w,h}=size();const f=pr==='ortho'?FOV_ORTHO:FOV;const vf=tanH(f);const hf=vf*Math.min(1,w/h);return radius()*1.0/Math.min(vf,hf>0?hf:vf);};
  const dirNow=()=>cam.position.clone().sub(target).normalize();
  const setDirDist=(d:Vector3,dist:number)=>{cam.up.set(...upFor([d.x,d.y,d.z]));cam.position.copy(target).addScaledVector(d,dist);cam.lookAt(target);controls.update();dirty=true;};
  const snap=(dir:Vec3,ms=380)=>{
   const to=new Vector3(...dir).normalize();
   if(reduced()||ms<=0){setDirDist(to,fitDistanceKeep());return;}
   tween={t0:performance.now(),dur:ms,fromDir:dirNow(),toDir:to,fromD:cam.position.distanceTo(target),toD:cam.position.distanceTo(target)};
  };
  const fitDistanceKeep=()=>cam.position.distanceTo(target);
  const fit=()=>{target.copy(centre());controls.target.copy(target);setDirDist(dirNow(),fitDistance());};
  const setProj=(next:Projection)=>{
   const from=pr==='ortho'?FOV_ORTHO:FOV,to=next==='ortho'?FOV_ORTHO:FOV;
   const dist=cam.position.distanceTo(target)*tanH(from)/tanH(to);
   pr=next;cam.fov=to;cam.updateProjectionMatrix();setDirDist(dirNow(),dist);
  };
  const resize=()=>{const {w,h}=size();const dpr=Math.min(2,window.devicePixelRatio||1);renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();dirty=true;};
  const project=(v:Vec3):[number,number]|null=>{const {w,h}=size();const q=new Vector3(...v).project(cam);if(q.z>1)return null;return [(q.x+1)/2*w,(1-q.y)/2*h];};
  const pick=(x:number,y:number)=>{
   const {w,h}=size();v2.set(x/w*2-1,-(y/h)*2+1);ray.setFromCamera(v2,cam);
   const hits=ray.intersectObjects(plan.pickables.filter(o=>{let n:typeof o|null=o;while(n){if(n.visible===false)return false;n=n.parent;}return true;}),false);
   const real=hits.find(h=>!h.object.userData.enclosure&&!h.object.userData.noPick)??hits.find(h=>!h.object.userData.noPick);
   return real?{id:real.object.userData.itemId as string,point:[real.point.x,real.point.y,real.point.z] as Vec3}:null;
  };
  const setHatch=(s:SectionState|null,cutBoxes:{pos:Vec3;size:Vec3}[],min:Vec3,max:Vec3)=>{
   hatch.clear();
   if(!s){dirty=true;return;}
   const i={x:0,y:1,z:2}[s.axis];const [a,b]=[0,1,2].filter(n=>n!==i) as [number,number];
   const off=min[i]!+(max[i]!-min[i]!)*s.t;
   for(const c of cutBoxes){
    const w=c.size[a]!,hh=c.size[b]!;
    const mat=hatchMat.clone();mat.map=hatchMat.map;
    const geo=new PlaneGeometry(w,hh);const uv=geo.attributes.uv!;for(let k=0;k<uv.count;k++)uv.setXY(k,uv.getX(k)*w/5,uv.getY(k)*hh/5);
    const m=new Mesh(geo,mat);m.userData.noPick=true;
    const pos=[...c.pos];pos[i]=off;m.position.set(pos[0]!,pos[1]!,pos[2]!);
    // PlaneGeometry lies in XY; turn it onto the cut plane
    m.rotation.set(s.axis==='x'?0:s.axis==='y'?-Math.PI/2:0,s.axis==='x'?Math.PI/2:0,0);
    m.scale.set(1,1,1);hatch.add(m);
   }
   dirty=true;
  };
  rt.current={hatch:setHatch,render:()=>{dirty=true;},dirty:()=>{dirty=true;},snap,fit,setProj,project,pick};
  // overlay state derived from the camera each frame
  let lastKey='';
  const overlay=()=>{
   const {w,h}=size();
   const l=live.current;
   const items=plan.plan.items.filter(i=>i.type!=='enclosure'&&isVisible(i.id,l.vis));
   const ins=items.flatMap(i=>{const pos=plan.positionOf(i.id)!;const s=project(pos);return s?[{id:i.id,ref:i.ref,label:`${i.label}`,ax:s[0],ay:s[1]}]:[];});
   const compact=w<520;setCompact(c=>c===compact?c:compact);
   const bl=layoutBalloons(ins,w,h,compact?22:44,26,compact);
   const a=l.meas.a&&project(l.meas.a);const res=l.meas.res;
   const dp=res?{a:project(res.a)!,b:project(res.b)!}:null;
   void a;
   const key=JSON.stringify([bl.map(b=>[b.id,Math.round(b.ax),Math.round(b.ay),Math.round(b.by)]),dp&&[Math.round(dp.a?.[0]??0),Math.round(dp.a?.[1]??0),Math.round(dp.b?.[0]??0),Math.round(dp.b?.[1]??0)]]);
   if(key!==lastKey){lastKey=key;setBalloons(bl);setDimPts(dp&&dp.a&&dp.b?dp:null);}
  };
  const frame=(now:number)=>{
   if(disposed)return;
   if(tween){const k=Math.min(1,(now-tween.t0)/tween.dur);const e=1-(1-k)**3;const d=tween.fromDir.clone().lerp(tween.toDir,e).normalize();setDirDist(d,tween.fromD+(tween.toD-tween.fromD)*e);if(k>=1)tween=null;}
   if(controls.enableDamping&&controls.update())dirty=true;
   if(dirty){
    dirty=false;
    cam.updateMatrixWorld();
    cubeRef.current?.setRotation(cam.matrixWorldInverse.elements);
    renderer.render(scene,cam);
    overlay();
   }
   raf=requestAnimationFrame(frame);
  };
  const ro=new ResizeObserver(()=>resize());ro.observe(canvas);
  controls.addEventListener('change',()=>{dirty=true;});
  // click and hover
  let down:[number,number]|null=null;
  const rel=(e:PointerEvent):[number,number]=>{const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
  const onDown=(e:PointerEvent)=>{down=rel(e);rootRef.current?.focus({preventScroll:true});};
  const onUp=(e:PointerEvent)=>{
   const d=down;down=null;if(!d)return;const [x,y]=rel(e);if(Math.hypot(x-d[0],y-d[1])>4)return;
   const hit=pick(x,y);const l=live.current;
   if(l.tool==='measure'){
    if(!hit)return;
    const it=plan.plan.items.find(i=>i.id===hit.id)!;const pos=plan.positionOf(hit.id)!;
    const pt=snapToScreen(snapPoints(it,pos),project as never,[x,y])??hit.point;
    if(!l.meas.a||l.meas.res)cb.current.setMeas({a:pt,res:null});
    else cb.current.setMeas({a:l.meas.a,res:measure(l.meas.a,pt)});
    return;
   }
   cb.current.setSel(hit?hit.id:null);
  };
  let hoverRaf=0;
  const onMove=(e:PointerEvent)=>{if(e.buttons)return;if(hoverRaf)return;const [x,y]=rel(e);hoverRaf=requestAnimationFrame(()=>{hoverRaf=0;const h=pick(x,y);cb.current.setHover(h&&h.id!=='enclosure'?h.id:null);});};
  const onLeave=()=>cb.current.setHover(null);
  canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerleave',onLeave);
  plan.setExplode(fractionOf(live.current.explode));plan.setVisibility(live.current.vis);plan.setSelected(live.current.sel);plan.setHover(live.current.hover);
  resize();fit();snap([...ISO_DIR],0);fit();
  canvas.dataset.ready='1';
  raf=requestAnimationFrame(frame);
  return()=>{
   disposed=true;cancelAnimationFrame(raf);cancelAnimationFrame(hoverRaf);ro.disconnect();controls.dispose();
   canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointerup',onUp);canvas.removeEventListener('pointermove',onMove);canvas.removeEventListener('pointerleave',onLeave);
   scene.remove(plan.group);hatchMat.map?.dispose();hatchMat.dispose();hatch.clear();envRT.dispose();renderer.dispose();rt.current=null;
  };
   
 },[plan]);

 // ---- push state into the scene ----
 useEffect(()=>{if(!plan)return;plan.setExplode(fractionOf(explode));rt.current?.dirty();},[plan,explode]);
 useEffect(()=>{if(!plan)return;plan.setVisibility(vis);rt.current?.dirty();},[plan,vis]);
 useEffect(()=>{if(!plan)return;plan.setSelected(sel);rt.current?.dirty();},[plan,sel]);
 useEffect(()=>{if(!plan)return;plan.setHover(hover);rt.current?.dirty();},[plan,hover]);
 useEffect(()=>{
  if(!plan)return;
  if(!section.enabled){plan.setClipping(null);rt.current?.hatch(null,[],[0,0,0],[0,0,0]);return;}
  const b=plan.bounds();plan.setClipping(plane(section,b.min,b.max));rt.current?.hatch(section,plan.plan.items.filter(i=>cuts(section,plan.positionOf(i.id)!,i.size,b.min,b.max)).map(i=>({pos:plan.positionOf(i.id)!,size:i.size})),b.min,b.max);
 },[plan,built,section,explode]);
 useEffect(()=>{setMeas({a:null,res:null});},[tool,node]);

 const visibleIds=useMemo(()=>planData.items.filter(i=>i.type!=='enclosure').map(i=>i.id),[planData]);
 const hiddenN=visibleIds.filter(id=>!isVisible(id,vis)).length;
 const selType=sel?planData.items.find(i=>i.id===sel):undefined;
 const cutN=useMemo(()=>{
  if(!section.enabled||!plan)return 0;const b=plan.bounds();return plan.plan.items.filter(i=>cuts(section,plan.positionOf(i.id)!,i.size,b.min,b.max)).length;
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[plan,section,explode]);

 const doIsolate=useCallback(()=>{if(sel)setVis(isolate(vis,vis.isolated?.has(sel)?[]:[sel]));},[sel,vis]); // eslint-disable-line react-hooks/exhaustive-deps
 const doHide=useCallback(()=>{if(sel){setVis(toggleHidden(vis,sel));}},[sel,vis]); // eslint-disable-line react-hooks/exhaustive-deps
 const onKey=(e:React.KeyboardEvent)=>{
  if((e.target as HTMLElement).tagName==='INPUT')return;
  const k=e.key.toLowerCase();
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  if(k==='s')setTool('select');
  else if(k==='m')setTool(t=>t==='measure'?'select':'measure');
  else if(k==='x')setSection(s=>({...s,enabled:!s.enabled}));
  else if(k==='i')doIsolate();
  else if(k==='h')doHide();
  else if(k==='f')rt.current?.fit();
  else if(k==='5'){const n=toggleProjection(projection);setProjection(n);rt.current?.setProj(n);}
  else if(k==='escape'){
   if(meas.a||meas.res)setMeas({a:null,res:null});
   else if(tool==='measure')setTool('select');
   else if(sel)setSel(null);
   else setVis(escapeVis(vis));
  }else return;
  e.preventDefault();
 };
 const snapFace=(f:CubeFace)=>rt.current?.snap([...FACE_DIR[f]]);
 const cubeEdge=(...f:CubeFace[])=>rt.current?.snap([...combine(f)]);void cubeEdge;
 const ctx=p.contextLabel??node.id;
 const measureText=meas.res?`Measure · point to point · ${formatMm(meas.res.mm)}`:meas.a?'Measure · pick the second point':tool==='measure'?'Measure · pick the first point (snaps to corners)':null;

 if(failed)return <div className="cad cad-error" data-testid="cad-viewport">3D is not available in this browser. The feature tree and the BOM hold the same information.</div>;
 return <div className="cad" ref={rootRef} tabIndex={0} onKeyDown={onKey} onPointerEnter={e=>{if(e.pointerType==='mouse'&&!(document.activeElement instanceof HTMLInputElement))e.currentTarget.focus({preventScroll:true});}} data-testid="cad-viewport" data-tool={tool} data-compact={compact} data-selected={sel??''} data-boxes={planData.boxCount} aria-label={`3D assembly of ${node.id}. The feature tree and the BOM list the same parts.`}>
  <canvas ref={canvasRef} className="cad-canvas" data-testid="cad-canvas" role="img" aria-label={`3D assembly of ${node.id}, ${planData.items.length} items. Use the feature tree for the same list.`}/>
  <svg className="cad-overlay" aria-hidden="true">
   {balloons.map(b=><path key={b.id} className="cad-leader" data-sel={b.id===sel} d={`M${b.ax},${b.ay}L${b.bx+(b.side==='left'?8:-8)},${b.by}`}/>)}
   {dimPts&&<g><line className="cad-dim" x1={dimPts.a[0]} y1={dimPts.a[1]} x2={dimPts.b[0]} y2={dimPts.b[1]}/><circle className="cad-dim-dot" cx={dimPts.a[0]} cy={dimPts.a[1]} r="3.5"/><circle className="cad-dim-dot" cx={dimPts.b[0]} cy={dimPts.b[1]} r="3.5"/></g>}
  </svg>
  {balloons.map(b=><button key={b.id} type="button" className="cad-balloon" data-side={b.side} data-sel={b.id===sel} data-hover={b.id===hover} data-testid={`cad-balloon-${b.id}`} style={{left:b.bx,top:b.by}} onClick={()=>setSel(b.id)} onMouseEnter={()=>setHover(b.id)} onMouseLeave={()=>setHover(null)} aria-label={`Item ${b.ref}, ${b.label}`}><i>{b.ref}</i><span>{b.label}</span></button>)}
  {dimPts&&meas.res&&<div className="cad-tag" style={{left:(dimPts.a[0]+dimPts.b[0])/2,top:(dimPts.a[1]+dimPts.b[1])/2}} data-testid="cad-dim-label">{formatMm(meas.res.mm)}</div>}
  <div className="cad-bar" role="toolbar" aria-label="3D tools">
   <div className="cad-group">
    <button type="button" className="cad-tool" aria-pressed={tool==='select'} title="Select (S)" aria-label="Select" data-testid="cad-tool-select" onClick={()=>setTool('select')}><Ic n="select"/></button>
    <button type="button" className="cad-tool" aria-pressed={tool==='measure'} title="Measure (M)" aria-label="Measure" data-testid="cad-tool-measure" onClick={()=>setTool(t=>t==='measure'?'select':'measure')}><Ic n="measure"/></button>
    <button type="button" className="cad-tool" aria-pressed={section.enabled} title="Section (X)" aria-label="Section" data-testid="cad-tool-section" onClick={()=>setSection(s=>({...s,enabled:!s.enabled}))}><Ic n="section"/></button>
   </div>
   <div className="cad-group">
    <button type="button" className="cad-tool" aria-pressed={!!vis.isolated} disabled={!sel&&!vis.isolated} title="Isolate (I)" aria-label="Isolate" data-testid="cad-tool-isolate" onClick={()=>vis.isolated&&!sel?setVis(isolate(vis,[])):doIsolate()}><Ic n="isolate"/></button>
    <button type="button" className="cad-tool" aria-pressed={!!sel&&vis.hidden.has(sel)} disabled={!sel} title="Hide (H)" aria-label="Hide" data-testid="cad-tool-hide" onClick={doHide}><Ic n="hide"/></button>
    <button type="button" className="cad-tool" title="Fit (F)" aria-label="Fit" data-testid="cad-tool-fit" onClick={()=>rt.current?.fit()}><Ic n="fit"/></button>
   </div>
   <label className="cad-group cad-explode"><span>Explode</span><input type="range" min={0} max={100} value={explode} onChange={e=>setExplode(Number(e.target.value))} aria-label="Explode" data-testid="cad-explode"/><output>{explode}%</output></label>
   {(vis.isolated||hiddenN>0)&&<span className="cad-pill" data-testid="cad-context">{vis.isolated?<><b>Isolated</b> · {ctx}</>:<>{hiddenN} hidden</>}</span>}
  </div>
  {section.enabled&&<div className="cad-section" data-testid="cad-section">
   {(['x','y','z'] as Axis[]).map(a=><button key={a} type="button" aria-pressed={section.axis===a} onClick={()=>setSection(s=>({...s,axis:a}))}>{a.toUpperCase()}</button>)}
   <input type="range" min={0} max={100} value={Math.round(section.t*100)} aria-label="Section position" onChange={e=>setSection(s=>({...s,t:Number(e.target.value)/100}))}/>
   <button type="button" aria-pressed={section.flip} onClick={()=>setSection(s=>({...s,flip:!s.flip}))}>flip</button>
  </div>}
  <ViewCube ref={cubeRef} projection={projection} onFace={snapFace} onHome={()=>rt.current?.snap([...ISO_DIR])} onToggleProjection={()=>{const n=toggleProjection(projection);setProjection(n);rt.current?.setProj(n);}}/>
  <div className="cad-chip cad-chip-l">
   {measureText&&<span data-testid="cad-measure-chip">{measureText}</span>}
   <span data-testid="cad-status">{section.enabled?`Section ${section.axis.toUpperCase()} · ${cutN} cut`:'Section off'} · {planData.items.length-1-hiddenN} parts · {hiddenN} hidden{selType?` · ${selType.label}`:''}</span>
  </div>
  {planData.boxCount>0&&<div className="cad-chip cad-chip-r" data-testid="cad-box-chip"><em>BOX</em>{planData.boxCount} {planData.boxCount===1?'part':'parts'} without a 3D model {planData.boxCount===1?'is':'are'} drawn as a labelled box</div>}
  <div className="cad-sr" aria-live="polite">{sel&&selType?`Selected item ${selType.ref}, ${selType.label}`:''}</div>
 </div>;
}
