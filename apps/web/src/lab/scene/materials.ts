import {BackSide,Box3,CanvasTexture,Color,DataTexture,Mesh,MeshBasicMaterial,MeshToonMaterial,NearestFilter,RedFormat,Vector3,type BufferGeometry,type Material,type Object3D} from 'three';
import {INK} from './palette';

let gradient:DataTexture|null=null;
const cache=new Map<number,MeshToonMaterial>();
let inkMat:MeshBasicMaterial|null=null;

export function toonGradient():DataTexture{
 if(!gradient){
  gradient=new DataTexture(new Uint8Array([92,168,255]),3,1,RedFormat);
  gradient.minFilter=NearestFilter;gradient.magFilter=NearestFilter;gradient.generateMipmaps=false;gradient.needsUpdate=true;
 }
 return gradient;
}
/** Shared toon material (never mutate or dispose individually). */
export function toon(color:number):MeshToonMaterial{
 let m=cache.get(color);
 if(!m){m=new MeshToonMaterial({color,gradientMap:toonGradient()});cache.set(color,m);}
 return m;
}
/** Per-part material for animated colour/emissive. Disposed with the part. */
export function ownToon(color:number):MeshToonMaterial{
 const m=new MeshToonMaterial({color,gradientMap:toonGradient()});
 m.userData.own=true;
 return m;
}
export function inkMaterial():MeshBasicMaterial{
 if(!inkMat)inkMat=new MeshBasicMaterial({color:INK,side:BackSide});
 return inkMat;
}

const box=new Box3();
const size=new Vector3();
const ctr=new Vector3();
/** Inverted-hull outline: same geometry grown by t mm on each side. */
export function addOutline(mesh:Mesh,t=0.45,material:Material=inkMaterial()):Mesh{
 const g:BufferGeometry=mesh.geometry;
 g.computeBoundingBox();
 box.copy(g.boundingBox!);box.getSize(size);box.getCenter(ctr);
 const hull=new Mesh(g,material);
 const sx=size.x>1e-6?(size.x+2*t)/size.x:1+t,sy=size.y>1e-6?(size.y+2*t)/size.y:1+t,sz=size.z>1e-6?(size.z+2*t)/size.z:1+t;
 hull.scale.set(sx,sy,sz);
 hull.position.set(ctr.x-ctr.x*sx,ctr.y-ctr.y*sy,ctr.z-ctr.z*sz);
 hull.userData.noPick=true;hull.userData.hull=true;hull.userData.sharedGeometry=true;
 mesh.add(hull);
 return hull;
}

/** Free geometries and own materials/textures of an object tree. */
export function disposeObject(root:Object3D):void{
 root.traverse(o=>{
  const m=o as Mesh;
  if(m.geometry&&!o.userData.sharedGeometry&&!o.userData.hull)m.geometry.dispose();
  const mat=m.material as Material|Material[]|undefined;
  if(mat){for(const x of Array.isArray(mat)?mat:[mat]){if(x.userData.own){if(x.userData.ownMap)(x as MeshBasicMaterial).map?.dispose();x.dispose();}}}
 });
}
export function disposeMaterialCache():void{
 for(const m of cache.values())m.dispose();
 cache.clear();disposeSharedTextures();inkMat?.dispose();inkMat=null;gradient?.dispose();gradient=null;
}
export const tmpColor=new Color();

export interface SolidOpts{outline?:number|boolean;pos?:[number,number,number];rot?:[number,number,number];cast?:boolean;own?:boolean}
/** Toon mesh with optional ink outline, position and rotation. */
export function solid(geo:BufferGeometry,color:number,o:SolidOpts={}):Mesh{
 const m=new Mesh(geo,o.own?ownToon(color):toon(color));
 if(o.pos)m.position.set(o.pos[0],o.pos[1],o.pos[2]);
 if(o.rot)m.rotation.set(o.rot[0],o.rot[1],o.rot[2]);
 m.castShadow=o.cast!==false;m.receiveShadow=true;
 if(o.outline)addOutline(m,typeof o.outline==='number'?o.outline:0.4);
 return m;
}

let glow:CanvasTexture|null=null,ringTex:CanvasTexture|null=null;
function canvasTex(draw:(g:CanvasRenderingContext2D,n:number)=>void):CanvasTexture{
 const n=128,cv=document.createElement('canvas');cv.width=n;cv.height=n;
 draw(cv.getContext('2d')!,n);
 const t=new CanvasTexture(cv);return t;
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
