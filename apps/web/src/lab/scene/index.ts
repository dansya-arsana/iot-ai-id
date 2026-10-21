import {Box3,BufferAttribute,BufferGeometry,CanvasTexture,DirectionalLight,Group,HemisphereLight,InstancedMesh,LineBasicMaterial,LineSegments,Mesh,MeshBasicMaterial,type Object3D,PCFShadowMap,PlaneGeometry,REVISION,Scene,ShadowMaterial,SRGBColorSpace,Sprite,Vector3,WebGLRenderer,BackSide} from 'three';
import type {BoardPin,Circuit,CreateLabScene,LabScene,LessonId,PartKind,PartProps,PartSpec,PartState,SceneSettings,ScreenPoint,SimSnapshot,ViewCommand} from '../contract';
import {BB_CX,BB_TOP,layoutCircuit} from './layout';
import {buildUno} from './board-uno';
import {buildBreadboard} from './breadboard';
import {buildPart,type PartView} from './parts';
import {buildWires} from './wires';
import {CameraRig} from './camera';
import {createPicking,type PickEntry} from './picking';
import {addOutline,disposeMaterialCache,disposeObject} from './materials';
import * as C from './palette';

const POWER_PINS=new Set(['5V','3V3','GND','VIN']);

function initialState(s:PartSpec):PartState|null{
 const p=s.props;
 switch(s.kind as PartKind){
  case 'lamp':return {kind:'lamp',distanceCm:Number(p.distanceCm??40),on:p.on!==false};
  case 'obstacle':return {kind:'obstacle',distanceCm:Number(p.distanceCm??40)};
  case 'potentiometer':return {kind:'potentiometer',value:Number(p.value??512)};
  default:return null;
 }
}

function watermark():CanvasTexture{
 const cv=document.createElement('canvas');cv.width=1024;cv.height=256;
 const g=cv.getContext('2d')!;
 g.fillStyle=C.WATERMARK;g.textAlign='center';g.textBaseline='middle';
 g.font='700 170px "Barlow", system-ui, sans-serif';g.fillText('iot.ai.id',512,128);
 const t=new CanvasTexture(cv);t.colorSpace=SRGBColorSpace;return t;
}
function gridLines():LineSegments{
 const pts:number[]=[];
 for(let v=-420;v<=420;v+=20){pts.push(v,0,-420,v,0,420,-420,0,v,420,0,v);}
 const geo=new BufferGeometry();geo.setAttribute('position',new BufferAttribute(new Float32Array(pts),3));
 const m=new LineBasicMaterial({color:C.GRID_LINE,transparent:true,opacity:0.08,depthWrite:false});
 const l=new LineSegments(geo,m);l.position.y=0.05;l.userData.noPick=true;return l;
}

export const createLabScene:CreateLabScene=(o):LabScene=>{
 const canvas=o.canvas;
 let renderer:WebGLRenderer;
 try{renderer=new WebGLRenderer({canvas,antialias:true,alpha:true});}
 catch{throw new Error('webgl-unavailable');}
 canvas.dataset.engine='three.js r'+REVISION;
 renderer.setClearAlpha(0);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFShadowMap;

 const settings:SceneSettings={...o.settings};
 const scene=new Scene();
 const rig=new CameraRig();
 rig.reducedMotion=settings.reducedMotion;rig.autoRotate=settings.autoRotate;

 scene.add(new HemisphereLight(C.FLOOR_SKY,C.FLOOR_GROUND,1.7));
 const sun=new DirectionalLight(C.WHITE,2.3);
 sun.position.set(150,260,190);sun.target.position.set(50,0,20);
 sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.radius=4;sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.4;
 Object.assign(sun.shadow.camera,{left:-290,right:290,top:290,bottom:-290,near:10,far:800});
 sun.shadow.camera.updateProjectionMatrix();
 scene.add(sun,sun.target);

 const ground=new Mesh(new PlaneGeometry(2400,2400),new ShadowMaterial({color:C.INK,opacity:0.16}));
 ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.userData.noPick=true;scene.add(ground);
 ground.material.userData.own=true;
 const grid=gridLines();(grid.material as LineBasicMaterial).userData.own=true;grid.visible=settings.grid;scene.add(grid);
 const wm=new Mesh(new PlaneGeometry(170,42.5),new MeshBasicMaterial({map:watermark(),transparent:true,opacity:0.08,depthWrite:false}));
 wm.material.userData.own=true;
 wm.rotation.x=-Math.PI/2;wm.position.set(BB_CX-20,0.06,105);wm.userData.noPick=true;scene.add(wm);

 const uno=buildUno();scene.add(uno.group);
 const bb=buildBreadboard();scene.add(bb.group);
 const partsRoot=new Group(),wiresRoot=new Group();scene.add(partsRoot,wiresRoot);

 let views:{id:string;view:PartView}[]=[];
 const byId=new Map<string,PartView>();
 let entries:PickEntry[]=[];
 let lastSnap:SimSnapshot|null=null;
 let cssW=1,cssH=1;
 let built=false;
 let resolveReady:()=>void=()=>undefined;
 const ready=new Promise<void>(r=>{resolveReady=r;});

 const rimMat=new MeshBasicMaterial({color:C.TEAL,side:BackSide,transparent:true,opacity:0.85});
 let rims:Mesh[]=[];let hlTarget:string|null=null;let hlT=0;

 const resolve=(id:string):Object3D|null=>{
  const v=byId.get(id);if(v)return v.group;
  const f=(uno.features as Record<string,Object3D|undefined>)[id];
  return f??null;
 };
 const box=new Box3(),vec=new Vector3();
 const toScreen=(v:Vector3,out:ScreenPoint):ScreenPoint=>{
  rig.camera.updateMatrixWorld();
  v.project(rig.camera);
  out.x=((v.x+1)/2)*cssW;out.y=((1-v.y)/2)*cssH;
  out.visible=v.x>=-1&&v.x<=1&&v.y>=-1&&v.y<=1&&v.z>=-1&&v.z<=1;
  return out;
 };
 const projectObject=(obj:Object3D,out:ScreenPoint):ScreenPoint=>{
  box.setFromObject(obj);box.getCenter(vec);return toScreen(vec,out);
 };

 const clearRims=():void=>{for(const r of rims)r.parent?.remove(r);rims=[];};
 const applyHighlight=():void=>{
  clearRims();
  if(!hlTarget)return;
  const obj=resolve(hlTarget);if(!obj)return;
  const meshes:Mesh[]=[];
  obj.traverse(c=>{
   const m=c as Mesh;
   if(m.isMesh&&!(m as unknown as InstancedMesh).isInstancedMesh&&!c.userData.noPick&&!c.userData.hull&&!(c as unknown as Sprite).isSprite)meshes.push(m);
  });
  for(const m of meshes.slice(0,60))rims.push(addOutline(m,0.8,rimMat));
 };

 const disposeLesson=():void=>{
  clearRims();
  for(const c of [...partsRoot.children]){partsRoot.remove(c);disposeObject(c);}
  for(const c of [...wiresRoot.children]){wiresRoot.remove(c);disposeObject(c);}
  views=[];byId.clear();entries=[];
 };

 const picking=createPicking({
  canvas,rig,entries:()=>entries,
  partState:id=>lastSnap?.parts[id],
  project:projectObject,
  onSelect:o.onSelect,onHover:o.onHover,onInput:o.onInput,
 });

 const scene_:LabScene={
  ready,
  setLesson(lesson:LessonId,circuit:Circuit):void{
   disposeLesson();
   const place=layoutCircuit(circuit);
   for(const spec of circuit.parts){
    const pl=place[spec.id];if(!pl)continue;
    const view=buildPart(spec);
    view.group.position.set(pl.x,pl.onBoard?BB_TOP:0,pl.z);view.group.rotation.y=pl.rotY;
    partsRoot.add(view.group);views.push({id:spec.id,view});byId.set(spec.id,view);
    const st=initialState(spec);if(st)view.apply(st,0);
   }
   partsRoot.updateMatrixWorld(true);
   wiresRoot.add(buildWires(circuit.wires,
    w=>uno.pinAnchor(w.boardPin as BoardPin),
    (w,idx)=>{
     if(w.componentId==='bb'){return bb.railAnchor(w.pin==='5v-rail'?'5v-rail':'gnd-rail',idx*2);}
     const v=byId.get(w.componentId);if(!v)return null;
     return v.group.localToWorld(v.pinAnchor(w.pin));
    }));
   void POWER_PINS;
   entries=[
    ...views.map(({id,view})=>({id,object:view.group,interactive:view.interactive})),
    ...Object.entries(uno.features).map(([id,object])=>({id,object})),
   ];
   rig.setPreset(lesson,!built);
   if(!built){built=true;canvas.dataset.ready='1';resolveReady();}
   if(hlTarget)applyHighlight();
  },
  setPartProps(id:string,props:PartProps):void{
   const v=byId.get(id);if(!v)return;
   if(hlTarget===id)clearRims();
   v.setProps(props);
   if(hlTarget===id)applyHighlight();
  },
  update(snap:SimSnapshot,dtMs:number):void{
   lastSnap=snap;
   for(let i=0;i<views.length;i++){
    const e=views[i]!;const st=snap.parts[e.id];if(st)e.view.apply(st,dtMs);
   }
   uno.setLeds({l:snap.pins.D13.duty,tx:snap.txActive,on:true});
   rig.update(dtMs);
   if(hlTarget){hlT+=dtMs;rimMat.opacity=0.65+0.25*Math.sin(hlT*0.006);}
   renderer.render(scene,rig.camera);
  },
  resize(w:number,h:number,dpr:number):void{
   cssW=Math.max(1,w);cssH=Math.max(1,h);
   renderer.setPixelRatio(dpr);renderer.setSize(cssW,cssH,false);rig.resize(cssW,cssH);
  },
  project(target:string):ScreenPoint|null{
   const out:ScreenPoint={x:0,y:0,visible:false};
   const obj=resolve(target);
   if(obj)return projectObject(obj,out);
   if(POWER_PINS.has(target)||/^(D\d+|A\d)$/.test(target))return toScreen(uno.pinAnchor(target as BoardPin),out);
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
   if(obj){box.setFromObject(obj);rig.focus(box.getCenter(vec).clone());return;}
   if(POWER_PINS.has(target)||/^(D\d+|A\d)$/.test(target))rig.focus(uno.pinAnchor(target as BoardPin),2);
  },
  highlight(target:string|null):void{hlTarget=target;applyHighlight();},
  setSettings(s:Partial<SceneSettings>):void{
   Object.assign(settings,s);
   grid.visible=settings.grid;rig.autoRotate=settings.autoRotate;rig.reducedMotion=settings.reducedMotion;
  },
  zoomLevel():number{return rig.zoomLevel();},
  dispose():void{
   picking.dispose();
   disposeLesson();
   uno.dispose();bb.dispose();
   disposeObject(ground);disposeObject(grid);
   wm.material.map?.dispose();disposeObject(wm);
   rimMat.dispose();sun.shadow.map?.dispose();
   disposeMaterialCache();
   renderer.dispose();renderer.forceContextLoss();
   delete canvas.dataset.ready;
  },
 };
 return scene_;
};
