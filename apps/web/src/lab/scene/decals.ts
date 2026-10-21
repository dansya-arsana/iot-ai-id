import {CanvasTexture,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import {canvasTexture} from './materials';

let tex:CanvasTexture|null=null;
const shadowTex=():CanvasTexture=>{
 if(tex)return tex;
 const cv=document.createElement('canvas');cv.width=cv.height=128;
 const g=cv.getContext('2d')!;
 g.filter='blur(9px)';g.fillStyle='#000';
 g.beginPath();g.roundRect(28,28,72,72,14);g.fill();
 tex=canvasTexture(cv,false);return tex;
};
const mats=new Map<number,MeshBasicMaterial>();
/** Soft contact-shadow decal lying on the floor/board (y = 0 in the parent), w x d mm plus padding. */
export function contactShadow(w:number,d:number,opacity=0.35,pad=6):Mesh{
 let m=mats.get(opacity);
 if(!m){m=new MeshBasicMaterial({map:shadowTex(),transparent:true,opacity,depthWrite:false,color:0x000000,toneMapped:false});mats.set(opacity,m);} // ds-allow-hex
 const mesh=new Mesh(new PlaneGeometry((w+pad*2)*1.7,(d+pad*2)*1.7),m);
 mesh.rotation.x=-Math.PI/2;mesh.userData.noPick=true;mesh.userData.noInk=true;mesh.renderOrder=0;
 return mesh;
}
export function disposeDecals():void{for(const m of mats.values())m.dispose();mats.clear();tex?.dispose();tex=null;}
