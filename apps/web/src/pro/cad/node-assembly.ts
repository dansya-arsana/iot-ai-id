/**
 * Three.js build of one Pro node assembly. Parts with a registered lab model use that model (lab/scene/parts, imported and never edited);
 * every other kind is a labelled box at datasheet size. The plan (plan.ts) decides placement; this file only draws it.
 */
import {Box3,BoxGeometry,CanvasTexture,EdgesGeometry,Group,LineBasicMaterial,LineSegments,Mesh,MeshBasicMaterial,MeshStandardMaterial,Plane,PlaneGeometry,SRGBColorSpace,Vector3,type Material,type Object3D} from 'three';
import type {ProNode} from '../../../../../packages/pro-contract/system-spec';
import {buildPart,registry} from '../../lab/scene/parts/index';
import {disposeObject} from '../../lab/scene/materials';
import * as C from '../../lab/scene/palette';
import {boardKindOf,planAssembly,type AssemblyItem,type AssemblyPlan,type PartSize,type SizeOf,type Vec3} from './plan';
import {explodeAll} from './explode';
import {isVisible,type VisibilityState} from './isolate';

const sizeCache=new Map<string,PartSize>();
/** Real bounding box of a registered model after it is laid on the plate (lab y up becomes plate z). */
export const modelSizeOf:SizeOf=kind=>{
 const hit=sizeCache.get(kind);if(hit)return hit;
 let out:PartSize={size:[30,20,8],has3d:false};
 const lab=registry.has(kind)?kind:null;
 if(lab){
  try{
   const view=buildPart({id:'probe',kind:lab,net:{},props:{}});
   const g=new Group();view.group.rotation.x=Math.PI/2;g.add(view.group);g.updateMatrixWorld(true);
   const b=bodyBox(g);const s=b.getSize(new Vector3());
   if(s.x>1&&s.y>1&&s.z>0.5)out={size:[round(s.x),round(s.y),round(s.z)],has3d:true,labKind:lab};
   disposeObject(g);
  }catch{/* a part that cannot build falls back to a box */}
 }
 sizeCache.set(kind,out);return out;
};
/** Box of the rigid body: cable tails (tube meshes) and transparent decal planes are left out so a pack with leads is not sized by its wires. */
export function bodyBox(root:Object3D):Box3{
 const b=new Box3(),tmp=new Box3();
 root.updateMatrixWorld(true);
 root.traverse(o=>{
  const m=o as Mesh;
  if(!m.isMesh||m.geometry.type==='TubeGeometry'||m.userData.noBody)return;
  const mat=m.material as Material&{transparent?:boolean};
  if(m.geometry.type==='PlaneGeometry'&&mat.transparent)return; // glow and shadow decals
  m.geometry.computeBoundingBox();tmp.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld);b.union(tmp);
 });
 return b.isEmpty()?new Box3().setFromObject(root):b;
}
const round=(n:number):number=>Math.round(n*10)/10;
/** Pro board id to the lab kind that draws it, when the lab has one. */
export const boardHas3d=(board:string):boolean=>registry.has(boardKindOf(board));

export interface ItemObject{item:AssemblyItem;root:Group;base:Object3D;sel:LineSegments;ink:LineSegments;materials:Material[]}
export interface NodeAssembly{
 group:Group;
 plan:AssemblyPlan;
 objects:Map<string,ItemObject>;
 /** All pickable meshes, each carries userData.itemId. */
 pickables:Object3D[];
 setExplode(k:number):void;
 setVisibility(v:VisibilityState):void;
 setSelected(id:string|null):void;
 setHover(id:string|null):void;
 /** World position of an item now (mm). */
 positionOf(id:string):Vec3|null;
 bounds():{min:Vec3;max:Vec3};
 setClipping(planes:{normal:Vec3;constant:number}|null):void;
 dispose():void;
}

function labelTexture(title:string,sub:string,w:number,h:number):CanvasTexture{
 const cv=document.createElement('canvas');const sc=6;cv.width=Math.max(64,Math.round(w*sc));cv.height=Math.max(32,Math.round(h*sc));
 const x=cv.getContext('2d')!;
 x.fillStyle=C.SILKSCREEN;x.fillRect(0,0,cv.width,cv.height);
 x.fillStyle='#0a0a0a';x.textAlign='center';x.textBaseline='middle'; // ds-allow-hex
 const fs=Math.min(cv.height*0.3,cv.width/Math.max(6,title.length*0.62));
 x.font=`600 ${fs}px "IBM Plex Mono",monospace`;x.fillText(title,cv.width/2,cv.height*0.42);
 x.fillStyle='#66645f';x.font=`500 ${fs*0.7}px "IBM Plex Mono",monospace`;x.fillText(sub,cv.width/2,cv.height*0.72); // ds-allow-hex
 const t=new CanvasTexture(cv);t.colorSpace=SRGBColorSpace;t.anisotropy=4;return t;
}
function edgesOf(size:Vec3,color:number,width=1):LineSegments{
 const l=new LineSegments(new EdgesGeometry(new BoxGeometry(size[0],size[1],size[2])),new LineBasicMaterial({color,linewidth:width,transparent:true}));
 l.userData.noPick=true;return l;
}

function boxBody(it:AssemblyItem):Object3D{
 const g=new Group();
 const [w,h,d]=it.size;
 const mat=new MeshStandardMaterial({color:C.CREAM,roughness:0.8,metalness:0});
 const m=new Mesh(new BoxGeometry(w,h,d),mat);g.add(m);
 const face=new Mesh(new PlaneGeometry(w*0.96,h*0.96),new MeshBasicMaterial({map:labelTexture(it.label,'BOX · no 3D model',w,h),toneMapped:false}));
 face.position.z=d/2+0.05;g.add(face);
 g.add(edgesOf(it.size,C.INK));
 return g;
}
function enclosureBody(it:AssemblyItem):Object3D{
 const g=new Group();
 const [w,h,d]=it.size;
 const shell=new Mesh(new BoxGeometry(w,h,d),new MeshStandardMaterial({color:C.SILVER,transparent:true,opacity:0.14,roughness:0.6,depthWrite:false}));
 shell.userData.enclosure=true;g.add(shell);
 const plate=new Mesh(new BoxGeometry(w-2,h-2,2),new MeshStandardMaterial({color:C.CREAM_DARK,roughness:0.9}));
 plate.position.z=-d/2+1;g.add(plate);
 g.add(edgesOf(it.size,C.SILVER_DARK));
 return g;
}
function modelBody(it:AssemblyItem):Object3D{
 const view=buildPart({id:it.id,kind:it.labKind!,net:{},props:{}});
 const inner=view.group;inner.rotation.x=Math.PI/2;
 const wrap=new Group();wrap.add(inner);wrap.updateMatrixWorld(true);
 const c=bodyBox(wrap).getCenter(new Vector3());
 inner.position.sub(c);
 return wrap;
}

export function createNodeAssembly(node:ProNode,sizeOf:SizeOf=modelSizeOf):NodeAssembly{
 const plan=planAssembly(node,sizeOf);
 const group=new Group();group.name=`node-${node.id}`;
 const objects=new Map<string,ItemObject>();
 const pickables:Object3D[]=[];
 let sel:string|null=null,hov:string|null=null;
 let vis:VisibilityState={hidden:new Set(),isolated:null};
 let k=0;
 for(const it of plan.items){
  const root=new Group();root.userData.itemId=it.id;
  const base=it.type==='enclosure'?enclosureBody(it):it.has3d&&it.labKind?modelBody(it):boxBody(it);
  root.add(base);
  const selLine=edgesOf(it.size.map(v=>v+1.2) as Vec3,C.LIVE,2);selLine.visible=false;
  const inkLine=edgesOf(it.size.map(v=>v+0.6) as Vec3,C.INK,1);inkLine.visible=false;
  root.add(selLine,inkLine);
  const materials:Material[]=[];
  root.traverse(o=>{o.userData.itemId=it.id;const m=(o as Mesh).material;if(m)(Array.isArray(m)?m:[m]).forEach(x=>materials.push(x));if((o as Mesh).isMesh&&!o.userData.noPick)pickables.push(o);});
  root.position.set(...it.pos);
  group.add(root);
  objects.set(it.id,{item:it,root,base,sel:selLine,ink:inkLine,materials});
 }
 const paint=():void=>{
  for(const [id,o] of objects){
   o.root.visible=isVisible(id,vis);
   o.sel.visible=id===sel;
   o.ink.visible=id===hov&&id!==sel;
  }
 };
 const place=():void=>{const m=explodeAll(plan,k);for(const [id,o] of objects){const p=m.get(id)!;o.root.position.set(p[0],p[1],p[2]);}};
 const api:NodeAssembly={
  group,plan,objects,pickables,
  setExplode(v){k=v;place();},
  setVisibility(v){vis=v;paint();},
  setSelected(id){sel=id;paint();},
  setHover(id){hov=id;paint();},
  positionOf(id){const o=objects.get(id);return o?[o.root.position.x,o.root.position.y,o.root.position.z]:null;},
  bounds(){
   const b=new Box3();
   for(const o of objects.values()){const bb=new Box3().setFromCenterAndSize(o.root.position,new Vector3(...o.item.size));b.union(bb);}
   return {min:[b.min.x,b.min.y,b.min.z],max:[b.max.x,b.max.y,b.max.z]};
  },
  setClipping(p){
   const planes=p?[new Plane(new Vector3(...p.normal),p.constant)]:[];
   for(const o of objects.values())for(const m of o.materials)(m as Material).clippingPlanes=planes;
  },
  dispose(){disposeObject(group);},
 };
 paint();
 return api;
}
