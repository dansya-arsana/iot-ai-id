import {Box3,Group,Mesh,MeshBasicMaterial,RingGeometry,Vector3,type Object3D,type Scene} from 'three';
import {contentBox} from './bounds';
import * as C from './palette';
import type {CameraPose} from './camera';

/** Top-down footprint of something on the desk, world mm. */
export interface MapRect{id:string;kind:'uno'|'breadboard'|'part'|'feature';x0:number;z0:number;x1:number;z1:number}
export interface MinimapData{rects:MapRect[];pose:CameraPose;/** world bounds the map should cover */bounds:{x0:number;z0:number;x1:number;z1:number}}

/** Double accent ring on the desk around the selected part. update() follows it while it moves (obstacle drag). */
export interface SelectionRing{
 set(obj:Object3D|null):void;
 update(dtMs:number,reduced:boolean):void;
 dispose():void;
}
export function createSelectionRing(scene:Scene):SelectionRing{
 const root=new Group();root.visible=false;root.userData.noPick=true;root.userData.noInk=true;root.userData.noFit=true;
 const mk=(inner:number,outer:number,opacity:number):Mesh=>{
  const m=new MeshBasicMaterial({color:C.LIVE,transparent:true,opacity,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  m.userData.own=true;
  const mesh=new Mesh(new RingGeometry(inner,outer,96),m);
  mesh.rotation.x=-Math.PI/2;mesh.userData.noPick=true;mesh.userData.noInk=true;mesh.userData.noFit=true;mesh.renderOrder=3;
  return mesh;
 };
 const a=mk(0.93,1,0.95),b=mk(1.1,1.135,0.55);
 root.add(a,b);scene.add(root);
 let target:Object3D|null=null;let t=0;
 const box=new Box3(),c=new Vector3();
 const follow=():void=>{
  if(!target)return;
  contentBox([target],box);
  if(box.isEmpty()){root.visible=false;return;}
  box.getCenter(c);
  const w=box.max.x-box.min.x,d=box.max.z-box.min.z;
  root.position.set(c.x,box.min.y+0.2,c.z);
  root.scale.set(Math.max(8,w*0.62+5),1,Math.max(8,d*0.62+5));
  root.visible=true;
 };
 return {
  set(o){target=o;t=0;if(!o){root.visible=false;return;}follow();},
  update(dt,reduced){
   if(!target)return;
   follow();
   t+=dt;
   const k=reduced?0:Math.sin(t*0.004);
   (b.material as MeshBasicMaterial).opacity=0.5+0.2*k;
   b.scale.setScalar(1+0.025*k);
  },
  dispose(){
   scene.remove(root);
   for(const m of [a,b]){m.geometry.dispose();(m.material as MeshBasicMaterial).dispose();}
  },
 };
}

const bx=new Box3();
export function footprint(id:string,kind:MapRect['kind'],obj:Object3D):MapRect|null{
 contentBox([obj],bx);
 if(bx.isEmpty())return null;
 return {id,kind,x0:bx.min.x,z0:bx.min.z,x1:bx.max.x,z1:bx.max.z};
}
