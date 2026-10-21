import {BackSide,CanvasTexture,Color,DoubleSide,EdgesGeometry,Mesh,MeshBasicMaterial,MeshStandardMaterial,SRGBColorSpace,ShaderMaterial,Vector2,type BufferGeometry,type Material,type Object3D} from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {LineMaterial} from 'three/examples/jsm/lines/LineMaterial.js';
import {LineSegments2} from 'three/examples/jsm/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import {INK} from './palette';

export type Finish='plastic'|'pcb'|'metal'|'gold'|'epoxy';
const FINISH:Record<Finish,{r:number;m:number;o?:number}>={
 plastic:{r:0.62,m:0},pcb:{r:0.5,m:0},metal:{r:0.32,m:0.85},gold:{r:0.3,m:1},epoxy:{r:0.18,m:0,o:0.93},
};
const cache=new Map<string,MeshStandardMaterial>();

let maxAniso=4;
export const setMaxAnisotropy=(n:number):void=>{maxAniso=Math.max(1,n);};
/** Canvas -> colour-managed, mip-mapped, anisotropic texture. */
export function canvasTexture(cv:HTMLCanvasElement,srgb=true):CanvasTexture{
 const t=new CanvasTexture(cv);
 if(srgb)t.colorSpace=SRGBColorSpace;
 t.anisotropy=maxAniso;t.generateMipmaps=true;
 return t;
}

function make(color:number,finish:Finish):MeshStandardMaterial{
 const f=FINISH[finish];
 const m=new MeshStandardMaterial({color,roughness:f.r,metalness:f.m});
 if(f.o){m.transparent=true;m.opacity=f.o;}
 return m;
}
/** Shared standard material (never mutate or dispose individually). Name kept from the toon era. */
export function toon(color:number,finish:Finish='plastic'):MeshStandardMaterial{
 const k=`${color}:${finish}`;
 let m=cache.get(k);
 if(!m){m=make(color,finish);cache.set(k,m);}
 return m;
}
/** Per-part material for animated colour/emissive. Disposed with the part. */
export function ownToon(color:number,finish:Finish='plastic'):MeshStandardMaterial{
 const m=make(color,finish);m.userData.own=true;return m;
}
/** Label / silkscreen material: unlit, not tone mapped. */
export function labelMaterial(map:CanvasTexture,opts:{transparent?:boolean}={}):MeshBasicMaterial{
 const m=new MeshBasicMaterial({map,transparent:opts.transparent??true,depthWrite:false,toneMapped:false});
 m.userData.own=true;m.userData.ownMap=true;return m;
}

// ---- constant-width silhouette hull (normal extrusion, no post pass) ----
const hullMats=new Set<ShaderMaterial>();
let mmPerPx=0.2;
export function makeHullMaterial(color:number,pxMul=1,opacity=1):ShaderMaterial{
 const m=new ShaderMaterial({
  side:BackSide,transparent:opacity<1,
  uniforms:{uT:{value:1.6*mmPerPx*pxMul},uCol:{value:new Color(color)},uOp:{value:opacity}},
  vertexShader:'uniform float uT;void main(){vec3 p=position+normalize(normal)*uT;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',
  fragmentShader:'uniform vec3 uCol;uniform float uOp;void main(){gl_FragColor=vec4(uCol,uOp);}',
 });
 m.userData.pxMul=pxMul;m.userData.hullMat=true;m.toneMapped=false;
 hullMats.add(m);return m;
}
/** Call when zoom/size changes: mm covered by one CSS pixel. */
export function setMmPerPx(v:number):void{
 mmPerPx=v;
 for(const m of hullMats)m.uniforms.uT!.value=1.6*v*(m.userData.pxMul as number);
}
let inkMat:ShaderMaterial|null=null;
export const inkMaterial=():ShaderMaterial=>inkMat??=makeHullMaterial(INK);

const hullGeos=new WeakMap<BufferGeometry,BufferGeometry>();
function smoothHull(g:BufferGeometry):BufferGeometry{
 let h=hullGeos.get(g);
 if(!h){
  h=g.clone();h.deleteAttribute('uv');h.deleteAttribute('normal');
  for(const k of Object.keys(h.attributes))if(k!=='position')h.deleteAttribute(k);
  h=mergeVertices(h,1e-3);h.computeVertexNormals();
  const hh=h;hullGeos.set(g,hh);g.addEventListener('dispose',()=>hh.dispose());
 }
 return h;
}
/** Silhouette outline of constant screen width. `t` is a width multiplier (1 = about 1.6px). */
export function addOutline(mesh:Mesh,_t=1,material:Material=inkMaterial()):Mesh{
 const hull=new Mesh(smoothHull(mesh.geometry),material);
 hull.userData.noPick=true;hull.userData.hull=true;hull.userData.noInk=true;
 mesh.add(hull);
 return hull;
}

// ---- crisp edge lines on box-like parts ----
const edgeMat=new LineMaterial({color:INK,linewidth:1.25,worldUnits:false,transparent:true,opacity:0.85});
edgeMat.resolution=new Vector2(900,600);
export const setLineResolution=(w:number,h:number):void=>{edgeMat.resolution.set(w,h);};
export function addEdges(mesh:Mesh,angle=25):void{
 const lg=new LineSegmentsGeometry().fromEdgesGeometry(new EdgesGeometry(mesh.geometry,angle));
 const l=new LineSegments2(lg,edgeMat);
 l.userData.noPick=true;l.userData.noInk=true;l.userData.edge=true;l.raycast=():void=>undefined;
 mesh.add(l);
}

/** Free geometries and own materials/textures of an object tree. */
export function disposeObject(root:Object3D):void{
 root.traverse(o=>{
  const m=o as Mesh;
  if(m.geometry&&!o.userData.sharedGeometry&&!o.userData.hull)m.geometry.dispose();
  const mat=m.material as Material|Material[]|undefined;
  if(mat){for(const x of Array.isArray(mat)?mat:[mat]){if(x.userData.own){const mm=x as MeshBasicMaterial;if(x.userData.ownMap)mm.map?.dispose();x.dispose();}}}
 });
}
export function disposeMaterialCache():void{
 for(const m of cache.values())m.dispose();
 cache.clear();disposeSharedTextures();
 for(const m of hullMats)m.dispose();
 hullMats.clear();inkMat=null;
}
export const tmpColor=new Color();

export interface SolidOpts{outline?:number|boolean;edges?:boolean;pos?:[number,number,number];rot?:[number,number,number];cast?:boolean;own?:boolean;finish?:Finish}
/** Standard mesh with optional ink silhouette, edge lines, position and rotation. */
export function solid(geo:BufferGeometry,color:number,o:SolidOpts={}):Mesh{
 const m=new Mesh(geo,o.own?ownToon(color,o.finish):toon(color,o.finish));
 if(o.pos)m.position.set(o.pos[0],o.pos[1],o.pos[2]);
 if(o.rot)m.rotation.set(o.rot[0],o.rot[1],o.rot[2]);
 m.castShadow=o.cast!==false;m.receiveShadow=true;
 if(o.outline)addOutline(m);
 if(o.edges)addEdges(m);
 return m;
}

let glow:CanvasTexture|null=null,ringTex:CanvasTexture|null=null;
function canvasTex(draw:(g:CanvasRenderingContext2D,n:number)=>void):CanvasTexture{
 const n=128,cv=document.createElement('canvas');cv.width=n;cv.height=n;
 draw(cv.getContext('2d')!,n);
 return canvasTexture(cv);
}
/** Shared radial glow (white, tinted via sprite colour). */
export function glowTexture():CanvasTexture{
 return glow??=canvasTex((g,n)=>{const r=g.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(0.35,'rgba(255,255,255,0.45)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,n,n);});
}
/** Shared thin ring (white, tinted via sprite colour). */
export function ringTexture():CanvasTexture{
 return ringTex??=canvasTex((g,n)=>{g.strokeStyle='rgba(255,255,255,0.95)';g.lineWidth=n*0.05;g.beginPath();g.arc(n/2,n/2,n*0.42,0,Math.PI*2);g.stroke();});
}
export function disposeSharedTextures():void{glow?.dispose();glow=null;ringTex?.dispose();ringTex=null;}
export {DoubleSide};
