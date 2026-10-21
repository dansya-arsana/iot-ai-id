import {Box3,Color,DirectionalLight,Group,HemisphereLight,Mesh,MeshBasicMaterial,type Object3D,NeutralToneMapping,PCFShadowMap,PlaneGeometry,PMREMGenerator,Raycaster,REVISION,RingGeometry,Scene,ShaderMaterial,ShadowMaterial,SRGBColorSpace,Sprite,Vector2,Vector3,WebGLRenderer,type InstancedMesh,type Texture} from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import type {BoardPin,Circuit,CreateLabScene,LabScene,LessonId,PartKind,PartProps,PartSpec,PartState,SceneSettings,ScreenPoint,SimSnapshot,ViewCommand} from '../contract';
import {BB_COLS,BB_CX,BB_D,BB_TOP,BB_W,LESSON_VIEW,holeX,freeHoleNear,layoutCircuit,obstacleMm} from './layout';
import {buildUno} from './board-uno';
import {buildBreadboard} from './breadboard';
import {buildPart,type PartView} from './parts/index';
import {buildWires,disposeWireTextures,type WireBuild} from './wires';
import {CameraRig,bindCameraKeys,type CameraPose,type ContentRect,type SafeInsets} from './camera';
import {createSelectionRing,footprint,type MapRect,type MinimapData} from './selection';
import {createPicking,type PickEntry} from './picking';
import {addOutline,disposeMaterialCache,disposeObject,makeHullMaterial,setLineResolution,setMaxAnisotropy} from './materials';
import {boxCorners,contentBox,contentCorners} from './bounds';
import {disposeDecals} from './decals';
import {renderThumbnails} from './thumbnails';
import * as C from './palette';
import {specToCircuit,type CircuitSpec,type SpecStep} from '../circuit-spec';
import {createAssemblyController,installAssemblyDemo,type AssemblyControl} from './assembly';
import {EXAMPLE_CLOSE_ALARM} from '../circuit-examples';

export type {ContentRect,SafeInsets,CameraPose,MinimapData,MapRect};
export interface LabSceneV2 extends LabScene{
 /** Refit the lesson framing to the canvas minus these CSS-px insets (tween 500ms, 0 if reduced motion). */
 setSafeArea(insets:SafeInsets):void;
 /** Projected bbox of the lesson content after the fit, CSS px relative to the canvas. */
 contentRect():ContentRect|null;
 /** Projected bbox of one part or board feature, CSS px relative to the canvas (null when unknown). */
 targetRect?(target:string):ContentRect|null;
 thumbnails(o:{width:number;height:number;dpr:number;order?:LessonId[];onEach?:(id:LessonId,url:string)=>void}):Promise<Partial<Record<LessonId,string>>>;
 /** One-shot success ring on the floor (900 ms; a 300 ms fade under reduced motion). */
 celebrate():void;
}

// ---------- v3 scene API (stubs: the scene builders replace the bodies, never the signatures) ----------
export interface AssemblyStepEvent{
 /** 0-based step index and total steps (after stepsOf(spec): explicit steps or derived defaults). */
 index:number;total:number;step:SpecStep;
 /** 'start' fires when the step's animation begins (show the caption), 'end' when it settled. */
 phase:'start'|'end';
}
export interface PlayAssemblyOptions{
 onStep?(e:AssemblyStepEvent):void;
 /** 1 = normal pace (about 1.2 s per step), 2 = twice as fast, 0 or reducedMotion = jump to the final state per step with no tween. */
 speed?:number;
 /** Abort to stop early; the scene then shows the fully built circuit and the promise rejects with AbortError. */
 signal?:AbortSignal;
}
/** What the user did directly in the 3D scene. The HUD turns these into sim inputs and prop edits. */
export interface InteractiveHandlers{
 /** Continuous edit by dragging: obstacle distance, lamp distance, knob value. `value` is in the prop's own unit (cm, 0..1023). */
 onDrag?(partId:string,prop:string,value:number,phase:'start'|'move'|'end'):void;
 /** Button-like press/release, or a lamp switch click. */
 onPress?(partId:string,pressed:boolean):void;
 /** Click on a part that has interact.controls: open the generic popover anchored at `at` (CSS px). */
 onOpenControls?(partId:string,at:ScreenPoint):void;
 /** Hover enter/leave for affordance styling in the HUD (cursor is set by the scene). */
 onHoverPart?(partId:string|null,at:ScreenPoint|null):void;
}
export interface LabSceneV3 extends LabSceneV2{
 /** Pause/resume/skip the running assembly (no-ops when idle). */
 assembly:AssemblyControl;
 /** Replace the scene content with a CircuitSpec (board, breadboard, parts at spec.place, wires). Stub: lays out via layoutCircuit and ignores spec.place until the loader lands. */
 loadCircuit(spec:CircuitSpec):void;
 /** Play the step-by-step assembly: board drops in, breadboard, each part placed, each wire drawn, one caption per step. Resolves when the circuit is fully built. Stub: fires onStep on a timer without animating. */
 playAssembly(spec:CircuitSpec,o?:PlayAssemblyOptions):Promise<void>;
 /** Turn direct manipulation on (pass handlers) or off (null). Off by default so lessons and the assembly are not disturbed. */
 setInteractive(handlers:InteractiveHandlers|null):void;
 /** "Zoom to it": tween the camera onto a part. Resolves when the camera arrived. Unknown ids resolve immediately. */
 focusPart(id:string):Promise<void>;
 /** Parity pack: the teal double ring on the desk around a part or board feature (null clears). */
 selectPart(id:string|null):void;
 /** Id of the part wearing the selection ring (null: none). */
 selectedPart():string|null;
 /** Top-down footprints of the board, breadboard and parts plus the live camera pose, for the minimap. */
 minimap():MinimapData;
 /** Slide the camera to a floor point (minimap click) keeping zoom and angle. */
 recentre(x:number,z:number):void;
 cameraPose():CameraPose;
}

const POWER_PINS=new Set(['5V','3V3','GND','VIN']);
const OFF_BOARD=new Set<PartKind>(['lamp','obstacle','motor','servo']);

function initialState(s:PartSpec):PartState|null{
 const p=s.props;
 switch(s.kind as PartKind){
  case 'lamp':return {kind:'lamp',distanceCm:Number(p.distanceCm??40),on:p.on!==false};
  case 'obstacle':return {kind:'obstacle',distanceCm:Number(p.distanceCm??40)};
  case 'potentiometer':return {kind:'potentiometer',value:Number(p.value??512)};
  default:return null;
 }
}

/** Floor: 10 mm ink dot grid (7%) fading out radially from the content centre, 160 to 320 mm. */
function floorDots():Mesh{
 const m=new ShaderMaterial({
  transparent:true,depthWrite:false,toneMapped:false,
  uniforms:{uC:{value:new Vector2()},uInk:{value:new Color(C.INK)}},
  vertexShader:'varying vec2 vP;void main(){vec4 w=modelMatrix*vec4(position,1.0);vP=w.xz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader:'varying vec2 vP;uniform vec2 uC;uniform vec3 uInk;void main(){vec2 q=vP/10.0;vec2 f=fract(q)-0.5;float w=fwidth(q.x)*1.2;float d=length(f);float dotv=1.0-smoothstep(0.07,0.07+w+0.02,d);float a=dotv*0.07*(1.0-smoothstep(160.0,320.0,distance(vP,uC)));if(a<0.002)discard;gl_FragColor=vec4(uInk,a);}',
 });
 m.userData.own=true;
 const mesh=new Mesh(new PlaneGeometry(900,900),m);
 mesh.rotation.x=-Math.PI/2;mesh.position.y=0.04;mesh.userData.noPick=true;mesh.userData.noInk=true;mesh.renderOrder=0;
 return mesh;
}

export const createLabScene:CreateLabScene=(o):LabSceneV3=>{
 const canvas=o.canvas;
 let renderer:WebGLRenderer;
 try{renderer=new WebGLRenderer({canvas,antialias:true,alpha:true});}
 catch{throw new Error('webgl-unavailable');}
 canvas.dataset.engine='three.js r'+REVISION;
 renderer.setClearAlpha(0);
 renderer.outputColorSpace=SRGBColorSpace;
 renderer.toneMapping=NeutralToneMapping;renderer.toneMappingExposure=1.0;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFShadowMap;
 setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

 const settings:SceneSettings={...o.settings};
 const scene=new Scene();
 const rig=new CameraRig();
 rig.reducedMotion=settings.reducedMotion;rig.autoRotate=settings.autoRotate;

 const pmrem=new PMREMGenerator(renderer);
 const roomEnv=new RoomEnvironment();
 const envRT=pmrem.fromScene(roomEnv,0.04);
 scene.environment=envRT.texture;scene.environmentIntensity=0.55;
 roomEnv.dispose();pmrem.dispose();

 scene.add(new HemisphereLight(C.FLOOR_SKY,C.FLOOR_GROUND,0.6));
 const sun=new DirectionalLight(C.WHITE,2.0);
 const SUN_OFF=new Vector3(-140,300,40);
 sun.position.copy(SUN_OFF);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.radius=4;sun.shadow.bias=-0.0002;sun.shadow.normalBias=0.25;
 scene.add(sun,sun.target);
 const fill=new DirectionalLight(C.FILL,0.35);fill.position.set(200,120,220);scene.add(fill);

 const ground=new Mesh(new PlaneGeometry(2400,2400),new ShadowMaterial({color:C.SHADOW,opacity:0.22}));
 ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.userData.noPick=true;scene.add(ground);
 ground.material.userData.own=true;
 const dots=floorDots();dots.visible=settings.grid;scene.add(dots);

 // celebrate ring
 const ringMat=new MeshBasicMaterial({color:C.LIVE,transparent:true,opacity:0,depthWrite:false,toneMapped:false});ringMat.userData.own=true;
 const ring=new Mesh(new RingGeometry(0.97,1,96),ringMat);
 ring.rotation.x=-Math.PI/2;ring.position.y=0.08;ring.visible=false;ring.userData.noPick=true;ring.userData.noInk=true;scene.add(ring);
 let ringT=-1,ringR=100;

 const selRing=createSelectionRing(scene);
 let selId:string|null=null;
 const unbindKeys=bindCameraKeys(rig);
 const uno=buildUno();scene.add(uno.group);
 const bb=buildBreadboard();scene.add(bb.group);
 const partsRoot=new Group(),wiresRoot=new Group();scene.add(partsRoot,wiresRoot);

 let views:{id:string;view:PartView}[]=[];
 const byId=new Map<string,PartView>();
 let wires:WireBuild|null=null;
 let entries:PickEntry[]=[];
 let lastSnap:SimSnapshot|null=null;
 let cssW=1,cssH=1,baseDpr=1,pr=1,adaptive=true;
 let built=false;
 let resolveReady:()=>void=()=>undefined;
 const ready=new Promise<void>(r=>{resolveReady=r;});
 const frames:number[]=[];

 const rimMat=makeHullMaterial(C.LIVE,2,0.85);
 let rims:Mesh[]=[];let hlTarget:string|null=null;let hlT=0;
 let hoverHl:string|null=null; // direct-manipulation hover/keyboard rim; the lesson highlight wins when set

 const resolve=(id:string):Object3D|null=>{
  const v=byId.get(id);if(v)return v.group;
  const f=(uno.features as Record<string,Object3D|undefined>)[id];
  return f??null;
 };
 const box=new Box3(),ubox=new Box3(),vec=new Vector3();
 const toScreen=(v:Vector3,out:ScreenPoint):ScreenPoint=>{
  rig.camera.updateMatrixWorld();
  v.project(rig.camera);
  out.x=((v.x+1)/2)*cssW;out.y=((1-v.y)/2)*cssH;
  out.visible=v.x>=-1&&v.x<=1&&v.y>=-1&&v.y<=1&&v.z>=-1&&v.z<=1;
  return out;
 };
 /** Hotspot on the visible top surface: top-centre of the real geometry (D13 socket for the digital header). */
 const hotspot=(id:string,obj:Object3D,into:Vector3):Vector3=>{
  if(id==='uno.digital-header')return into.copy(uno.pinAnchor('D13'));
  const hs=obj.getObjectByName('hotspot');
  if(hs){hs.updateWorldMatrix(true,false);return into.setFromMatrixPosition(hs.matrixWorld);}
  contentBox([obj],box);
  return box.isEmpty()?into.setFromMatrixPosition(obj.matrixWorld):into.set((box.min.x+box.max.x)/2,box.max.y,(box.min.z+box.max.z)/2);
 };
 const projectObject=(obj:Object3D,out:ScreenPoint):ScreenPoint=>{
  contentBox([obj],box);box.getCenter(vec);return toScreen(vec,out);
 };

 // occlusion test for project(): cached briefly per target
 const ray=new Raycaster();const ndc=new Vector2();
 const occ=new Map<string,{t:number;hidden:boolean}>();
 const occluded=(p:Vector3,own:Object3D|null,key:string):boolean=>{
  const now=performance.now(),c=occ.get(key);
  if(c&&now-c.t<150)return c.hidden;
  const q=p.clone().project(rig.camera);ndc.set(q.x,q.y);
  ray.setFromCamera(ndc,rig.camera);
  const dTarget=vec.copy(p).sub(ray.ray.origin).dot(ray.ray.direction);
  let hidden=false;
  const hits=ray.intersectObjects([uno.group,bb.group,partsRoot,wiresRoot],true);
  for(const h of hits){
   const ob=h.object;
   {let w:Object3D|null=ob;let isWire=false;while(w){if(w===wiresRoot){isWire=true;break;}w=w.parent;}if(isWire)continue;}
   if(ob.userData.noPick||ob.userData.hull||ob.userData.noInk||ob.visible===false||(ob as Sprite).isSprite)continue;
   let n:Object3D|null=ob,mine=false;
   while(n){if(n===own){mine=true;break;}n=n.parent;}
   if(!mine&&h.distance<dTarget-1.5)hidden=true;
   break;
  }
  occ.set(key,{t:now,hidden});
  return hidden;
 };

 const clearRims=():void=>{for(const r of rims)r.parent?.remove(r);rims=[];};
 const applyHighlight=():void=>{
  clearRims();
  const hl=hlTarget??hoverHl;
  if(!hl)return;
  const obj=resolve(hl);if(!obj)return;
  const meshes:Mesh[]=[];
  obj.traverse(c=>{
   const m=c as Mesh;
   if(m.isMesh&&!(m as unknown as InstancedMesh).isInstancedMesh&&!c.userData.noPick&&!c.userData.hull&&!c.userData.noInk&&!(c as unknown as Sprite).isSprite)meshes.push(m);
  });
  for(const m of meshes.slice(0,60))rims.push(addOutline(m,1,rimMat));
 };

 const disposeLesson=():void=>{
  clearRims();selRing.set(null);selId=null;
  for(const c of [...partsRoot.children]){partsRoot.remove(c);disposeObject(c);}
  for(const c of [...wiresRoot.children]){wiresRoot.remove(c);disposeObject(c);}
  views=[];byId.clear();entries=[];wires=null;
 };

 const interactive:{handlers:InteractiveHandlers|null}={handlers:null};
 const assembly=createAssemblyController(()=>settings.reducedMotion);
 const picking=createPicking({
  canvas,rig,entries:()=>entries,
  partState:id=>lastSnap?.parts[id],
  project:projectObject,
  onSelect:o.onSelect,onHover:o.onHover,onInput:o.onInput,
  handlers:()=>interactive.handlers,
  module:id=>byId.get(id)?.module,
  hoverHighlight:id=>{hoverHl=id;applyHighlight();},
 });

 const centre=new Vector3(48,0,0);let radius=100;let fitMaxX=holeX(BB_COLS-1);
 const fitLesson=(lesson:LessonId,instant:boolean):void=>{
  const lv=LESSON_VIEW[lesson]??LESSON_VIEW.blink!;
  bb.group.visible=lv.board;
  // frame the Uno, the wires and only the populated stretch of the breadboard (not its empty far end)
  const roots:Object3D[]=[uno.group,wiresRoot];
  const b=contentBox(roots).clone();
  const pts=contentCorners(roots);
  if(lv.board){
   const x0=BB_CX-BB_W/2,x1=Math.min(BB_CX+BB_W/2,fitMaxX+8);
   const z=BB_D/2;
   for(const x of [x0,x1])for(const y of [0,BB_TOP])for(const zz of [-z,z]){pts.push(new Vector3(x,y,zz));b.expandByPoint(pts[pts.length-1]!);}
  }
  for(const {id,view} of views){
   if(byId.get(id)&&(view.group.userData.kind==='obstacle'||id.startsWith('obs'))){
    const ob=contentBox([view.group]).clone();
    const lim=view.group.position.z+obstacleMm(250);
    let sh=0;
    if(ob.min.z>lim){sh=ob.min.z-lim;ob.min.z-=sh;ob.max.z-=sh;}
    b.union(ob);pts.push(...contentCorners([view.group],-sh));
   }else{b.union(contentBox([view.group]));pts.push(...contentCorners([view.group]));}
  }
  b.getCenter(centre);radius=Math.max(40,b.getSize(vec).length()/2);
  dots.position.set(centre.x,0.04,centre.z);(dots.material as ShaderMaterial).uniforms.uC!.value.set(centre.x,centre.z);
  // shadow frustum + light follow the content (+25 mm)
  const R=radius+25;
  sun.position.copy(centre).add(SUN_OFF);sun.target.position.copy(centre);sun.target.updateMatrixWorld();
  Object.assign(sun.shadow.camera,{left:-R,right:R,top:R,bottom:-R,near:10,far:900});
  sun.shadow.camera.updateProjectionMatrix();
  rig.setContent(pts.length?pts:boxCorners(b),lv.az,lv.elev,instant);
 };

 const setPr=(v:number):void=>{pr=v;renderer.setPixelRatio(v);renderer.setSize(cssW,cssH,false);};

 const scene_:LabSceneV3={
  ready,
  setLesson(lesson:LessonId,circuit:Circuit):void{
   assembly.cancel();
   disposeLesson();occ.clear();
   const place=layoutCircuit(circuit);
   fitMaxX=Math.max(holeX(12),...Object.values(place).flatMap(p=>p.onBoard?[p.x,...(p.holes??[]).map(h=>holeX(h[0]))]:[]));
   const usedPins=new Set<string>();
   for(const spec of circuit.parts){
    const pl=place[spec.id];if(!pl)continue;
    const view=buildPart(spec);
    view.group.position.set(pl.x,pl.onBoard?BB_TOP:0,pl.z);view.group.rotation.y=pl.rotY;
    partsRoot.add(view.group);views.push({id:spec.id,view});byId.set(spec.id,view);
    if(spec.kind==='obstacle')view.group.userData.kind='obstacle';
    const st=initialState(spec);if(st)view.apply(st,0);
    for(const v of Object.values(spec.net))if(v&&/^(D\d+|A\d)$/.test(v))usedPins.add(v);
   }
   partsRoot.updateMatrixWorld(true);
   const wb=buildWires(circuit.wires,
    w=>uno.pinAnchor(w.boardPin as BoardPin),
    (w,idx)=>{
     if(w.componentId==='bb'){return bb.railAnchor(w.pin==='5v-rail'?'5v-rail':'gnd-rail',idx*2);}
     const v=byId.get(w.componentId);if(!v)return null;
     const p=v.group.localToWorld(v.pinAnchor(w.pin));
     const spec=circuit.parts.find(s=>s.id===w.componentId);
     if(spec&&!OFF_BOARD.has(spec.kind)){const h=freeHoleNear(p.x,p.z);return new Vector3(h.x,BB_TOP,h.z);}
     return p;
    });
   wires=wb;wiresRoot.add(wb.group);
   for(const w of circuit.wires)if(/^(D\d+|A\d)$/.test(w.boardPin))usedPins.add(w.boardPin);
   uno.setUsedPins(usedPins);
   entries=[
    ...views.map(({id,view})=>({id,object:view.group,interactive:view.interactive})),
    ...Object.entries(uno.features).map(([id,object])=>({id,object})),
   ];
   fitLesson(lesson,!built);
   if(!built){built=true;canvas.dataset.ready='1';resolveReady();}
   if(hlTarget||hoverHl)applyHighlight();
  },
  setPartProps(id:string,props:PartProps):void{
   const v=byId.get(id);if(!v)return;
   if((hlTarget??hoverHl)===id)clearRims();
   v.setProps(props);
   if((hlTarget??hoverHl)===id)applyHighlight();
  },
  update(snap:SimSnapshot,dtMs:number):void{
   lastSnap=snap;
   for(let i=0;i<views.length;i++){
    const e=views[i]!;const st=snap.parts[e.id];if(st)e.view.apply(st,dtMs);
   }
   // real machine state on the hardware: LEDs, socket indicators, wires, chip decal
   uno.setLeds({l:snap.pins.D13.duty,tx:snap.txActive,on:true});
   uno.setLive(snap,dtMs);
   assembly.tick(dtMs);
   wires?.update(snap,dtMs);
   rig.update(dtMs);
   selRing.update(dtMs,settings.reducedMotion);
   if(hlTarget||hoverHl){hlT+=dtMs;rimMat.uniforms.uOp!.value=0.65+0.25*Math.sin(hlT*0.006);}
   if(ringT>=0){
    ringT+=dtMs;
    const dur=settings.reducedMotion?300:900,k=Math.min(1,ringT/dur);
    ring.visible=true;ring.position.x=centre.x;ring.position.z=centre.z;
    if(settings.reducedMotion){ring.scale.setScalar(ringR);ringMat.opacity=0.35*(1-k);}
    else{ring.scale.setScalar(ringR*(0.5+0.9*(1-(1-k)**3)));ringMat.opacity=0.35*(1-k);}
    if(k>=1){ringT=-1;ring.visible=false;}
   }
   renderer.render(scene,rig.camera);
   if(adaptive&&dtMs>0){
    frames.push(dtMs);
    if(frames.length>=60){
     const med=[...frames].sort((a,b)=>a-b)[30]!;frames.length=0;
     if(med>22&&pr>baseDpr){adaptive=false;setPr(baseDpr);}
    }
   }
  },
  resize(w:number,h:number,dpr:number):void{
   cssW=Math.max(1,w);cssH=Math.max(1,h);baseDpr=Math.max(0.5,dpr);
   if(adaptive)pr=Math.min(2,Math.max(1.25,baseDpr));else pr=baseDpr;
   renderer.setPixelRatio(pr);renderer.setSize(cssW,cssH,false);rig.resize(cssW,cssH);setLineResolution(cssW,cssH);
  },
  loadCircuit(spec:CircuitSpec):void{scene_.setLesson('blink',specToCircuit(spec));},
  assembly,
  async playAssembly(spec:CircuitSpec,po:PlayAssemblyOptions={}):Promise<void>{
   scene_.loadCircuit(spec);
   return assembly.play(spec,{speed:po.speed,onStep:po.onStep,signal:po.signal},{
    root:scene,uno:uno.group,breadboard:bb.group,wiresRoot,part:id=>byId.get(id)?.group,
    focus:(p2,z)=>{if(p2)rig.focus(p2,z);else rig.reset();},
    fitSize:()=>radius*2,
   });
  },
  setInteractive(h:InteractiveHandlers|null):void{interactive.handlers=h;},
  focusPart(id:string):Promise<void>{
   if(!byId.has(id))return Promise.resolve();
   scene_.focus(id);
   return new Promise<void>(r=>setTimeout(r,settings.reducedMotion?0:500));
  },
  selectPart(id:string|null):void{const o=id?resolve(id):null;selId=o?id:null;selRing.set(o);},
  selectedPart():string|null{return selId;},
  minimap():MinimapData{
   const rects:MapRect[]=[];
   const add=(r:MapRect|null):void=>{if(r)rects.push(r);};
   add(footprint('uno','uno',uno.group));
   if(bb.group.visible)add(footprint('breadboard','breadboard',bb.group));
   for(const {id,view} of views)add(footprint(id,'part',view.group));
   let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9;
   for(const r of rects){x0=Math.min(x0,r.x0);z0=Math.min(z0,r.z0);x1=Math.max(x1,r.x1);z1=Math.max(z1,r.z1);}
   if(!rects.length){x0=-40;x1=40;z0=-40;z1=40;}
   return {rects,pose:rig.pose(),bounds:{x0,z0,x1,z1}};
  },
  recentre(x:number,z:number):void{rig.recentre(new Vector3(x,0,z));},
  cameraPose():CameraPose{return rig.pose();},
  setSafeArea(i:SafeInsets):void{rig.setSafe(i);},
  contentRect():ContentRect|null{return rig.contentRect();},
  targetRect(target:string):ContentRect|null{
   const obj=resolve(target);if(!obj)return null;
   contentBox([obj],box);if(box.isEmpty())return null;
   rig.camera.updateMatrixWorld();
   let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
   for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    vec.set(x,y,z).project(rig.camera);
    const sx=((vec.x+1)/2)*cssW,sy=((1-vec.y)/2)*cssH;
    x0=Math.min(x0,sx);x1=Math.max(x1,sx);y0=Math.min(y0,sy);y1=Math.max(y1,sy);
   }
   return {x:x0,y:y0,w:x1-x0,h:y1-y0};
  },
  thumbnails(t){
   return renderThumbnails(renderer,scene.environment as Texture|null,t).finally(()=>{rig.refresh();setLineResolution(cssW,cssH);});
  },
  celebrate():void{ringT=0;ringR=Math.max(40,radius*0.9);},
  project(target:string):ScreenPoint|null{
   const out:ScreenPoint={x:0,y:0,visible:false};
   const obj=resolve(target);
   const p=new Vector3();
   if(obj){
    hotspot(target,obj,p);toScreen(p.clone(),out);
    if(out.visible&&occluded(p,obj,target))out.visible=false;
    return out;
   }
   if(POWER_PINS.has(target)||/^(D\d+|A\d)$/.test(target)){
    p.copy(uno.pinAnchor(target as BoardPin));toScreen(p.clone(),out);
    if(out.visible&&occluded(p,uno.group,target))out.visible=false;
    return out;
   }
   return null;
  },
  view(cmd:ViewCommand):void{
   if(cmd==='rotate-left')rig.rotate(-1);
   else if(cmd==='rotate-right')rig.rotate(1);
   else if(cmd==='zoom-in')rig.zoomBy(1.25);
   else if(cmd==='zoom-out')rig.zoomBy(0.8);
   else rig.reset();
  },
  focus(target:string|null):void{
   if(!target){rig.focus(null);return;}
   const obj=resolve(target);
   if(obj){
    contentBox([obj],box);
    // big targets (the whole Uno, the breadboard) zoom only as far as keeps them fully in view; small ones get the full 1.8x
    const diag=box.getSize(new Vector3()).length();
    const z=Math.max(1,Math.min(1.8,radius*2/(Math.max(diag,24)*1.7)));
    if(target.startsWith('uno.')){ // a part of the Uno: lean towards the board centre so the USB port, jack and pin labels stay in frame
     contentBox([uno.group],ubox);
     const bc=ubox.getCenter(new Vector3()),pc=box.getCenter(new Vector3()),bs=ubox.getSize(new Vector3()).length()*0.35;
     const g=bc.clone().sub(pc);if(g.length()>1e-6)g.setLength(bs);
     const gb=box.clone().expandByVector(new Vector3(bs*0.3,0,bs*0.3)).union(box.clone().translate(g));
     const cs:Vector3[]=[];
     for(const x of [gb.min.x,gb.max.x])for(const y of [gb.min.y,gb.max.y])for(const zz of [gb.min.z,gb.max.z])cs.push(new Vector3(x,y,zz));
     const fp2=gb.getCenter(new Vector3());
     const fit=rig.zoomThatFits(cs,fp2);
     rig.focus(fp2,Math.max(1.25,Math.min(1.8,Number.isFinite(fit)?fit:1.25)));return;
    }
    rig.focus(box.getCenter(vec).clone(),z);return;
   }
   if(POWER_PINS.has(target)||/^(D\d+|A\d)$/.test(target)){
    contentBox([uno.group],ubox);
    rig.focus(uno.pinAnchor(target as BoardPin).clone().lerp(ubox.getCenter(new Vector3()),0.5),1.25);
   }
  },
  highlight(target:string|null):void{hlTarget=target;applyHighlight();},
  setSettings(s:Partial<SceneSettings>):void{
   Object.assign(settings,s);
   dots.visible=settings.grid;rig.autoRotate=settings.autoRotate;rig.reducedMotion=settings.reducedMotion;
   canvas.dataset.grid=String(settings.grid);canvas.dataset.turntable=String(settings.autoRotate);
  },
  zoomLevel():number{return rig.zoomLevel();},
  dispose():void{
   interactive.handlers=null;assembly.cancel();
   picking.dispose();unbindKeys();selRing.dispose();
   disposeLesson();
   uno.dispose();bb.dispose();
   disposeObject(ground);disposeObject(dots);ring.geometry.dispose();disposeObject(ring);
   rimMat.dispose();sun.shadow.map?.dispose();envRT.dispose();
   disposeWireTextures();disposeDecals();disposeMaterialCache();
   renderer.dispose();renderer.forceContextLoss();
   delete canvas.dataset.ready;
  },
 };
 installAssemblyDemo(scene_,EXAMPLE_CLOSE_ALARM);
 return scene_;
};
