/**
 * Exploded 3D snapshot of one node for the Build Sheet: an off-screen WebGL render of the same assembly the workspace shows
 * (createNodeAssembly), iso view, returned as a PNG data URL plus balloon anchors. Returns null when WebGL is unavailable.
 */
import {AmbientLight,Color,DirectionalLight,NeutralToneMapping,PerspectiveCamera,PMREMGenerator,Scene,SRGBColorSpace,Vector3,WebGLRenderer} from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import type {ProNode} from '../../../../../packages/pro-contract/system-spec';
import {createNodeAssembly} from '../cad/node-assembly';
import {ISO_DIR,upFor} from '../cad/view-cube';
import {layoutBalloons} from '../cad/balloons';

export interface Snapshot{url:string;w:number;h:number;balloons:{ref:number;ax:number;ay:number;bx:number;by:number;side:'left'|'right'}[]}
const FOV=35;

export function renderSnapshot(node:ProNode,explodePct=55,w=1400,h=820):Snapshot|null{
 let renderer:WebGLRenderer;
 const canvas=document.createElement('canvas');
 try{renderer=new WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});}catch{return null;}
 const asm=createNodeAssembly(node);
 try{
  renderer.setPixelRatio(1);renderer.setSize(w,h,false);renderer.setClearAlpha(0);renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=NeutralToneMapping;
  const scene=new Scene();
  const pm=new PMREMGenerator(renderer),env=new RoomEnvironment(),rt=pm.fromScene(env,0.04);
  scene.environment=rt.texture;scene.environmentIntensity=0.7;env.dispose();pm.dispose();
  scene.add(new AmbientLight(new Color(1,1,1),0.5));
  const sun=new DirectionalLight(new Color(1,1,1),1.6);sun.position.set(-200,400,500);scene.add(sun);
  asm.setExplode(Math.max(0,Math.min(1,explodePct/100)));scene.add(asm.group);
  const b=asm.bounds();
  const c=new Vector3((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2);
  const radius=Math.max(60,Math.hypot(b.max[0]-b.min[0],b.max[1]-b.min[1],b.max[2]-b.min[2])/2);
  const cam=new PerspectiveCamera(FOV,w/h,1,60000);
  const dir=new Vector3(...ISO_DIR).normalize();
  const vf=Math.tan(FOV*Math.PI/360),hf=vf*Math.min(1,w/h);
  cam.up.set(...upFor([dir.x,dir.y,dir.z]));cam.position.copy(c).addScaledVector(dir,radius/Math.min(vf,hf)*0.82);cam.lookAt(c);cam.updateMatrixWorld();
  renderer.render(scene,cam);
  const url=canvas.toDataURL('image/png');
  const ins=asm.plan.items.filter(i=>i.type!=='enclosure').flatMap(i=>{
   const pos=asm.positionOf(i.id);if(!pos)return [];
   const q=new Vector3(...pos).project(cam);if(q.z>1)return [];
   return [{id:i.id,ref:i.ref,label:'',ax:(q.x+1)/2*w,ay:(1-q.y)/2*h}];
  });
  const bl=layoutBalloons(ins,w,h,64,40,false);
  return {url,w,h,balloons:bl.map(x=>({ref:x.ref,ax:x.ax,ay:x.ay,bx:x.bx,by:x.by,side:x.side}))};
 }finally{asm.dispose();renderer.dispose();renderer.forceContextLoss();}
}
