import {Box3,Mesh,Vector3,type Object3D} from 'three';

const b=new Box3();
/** World-space bbox of real geometry only (no glows, sprites, hulls, lines or instanced helpers). */
export function contentBox(roots:Object3D[],out=new Box3()):Box3{
 out.makeEmpty();
 for(const r of roots){
  r.updateWorldMatrix(true,true);
  r.traverseVisible(o=>{
   const m=o as Mesh;
   if(!m.isMesh||o.userData.noPick||o.userData.noFit||o.userData.hull||(m as unknown as {isInstancedMesh?:boolean}).isInstancedMesh)return;
   const g=m.geometry;if(!g)return;
   if(!g.boundingBox)g.computeBoundingBox();
   b.copy(g.boundingBox!).applyMatrix4(m.matrixWorld);out.union(b);
  });
 }
 return out;
}
export function boxCorners(bx:Box3):Vector3[]{
 const out:Vector3[]=[];
 for(const x of [bx.min.x,bx.max.x])for(const y of [bx.min.y,bx.max.y])for(const z of [bx.min.z,bx.max.z])out.push(new Vector3(x,y,z));
 return out;
}
/** Oriented corners of every real mesh (tight for L-shaped layouts, unlike the union AABB). */
export function contentCorners(roots:Object3D[],shiftZ=0):Vector3[]{
 const out:Vector3[]=[];const bx=new Box3();
 for(const r of roots){
  r.updateWorldMatrix(true,true);
  r.traverseVisible(o=>{
   const m=o as Mesh;
   if(!m.isMesh||o.userData.noPick||o.userData.noFit||o.userData.hull||(m as unknown as {isInstancedMesh?:boolean}).isInstancedMesh)return;
   const g=m.geometry;if(!g)return;
   if(!g.boundingBox)g.computeBoundingBox();
   bx.copy(g.boundingBox!);
   for(const x of [bx.min.x,bx.max.x])for(const y of [bx.min.y,bx.max.y])for(const z of [bx.min.z,bx.max.z])out.push(new Vector3(x,y,z).applyMatrix4(m.matrixWorld).add(new Vector3(0,0,shiftZ)));
  });
 }
 return out;
}
