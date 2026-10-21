import {BufferAttribute,Group,Mesh,MeshStandardMaterial,PlaneGeometry,Vector3,type CanvasTexture} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {BB_CX,BB_COLS,BB_D,BB_ROWS,BB_TOP,BB_W,RAIL_Z,holeX,holeZ,railX} from './layout';
import {canvasTexture,toon,disposeObject} from './materials';
import {contactShadow} from './decals';
import * as C from './palette';

export interface BreadboardBuild{
 group:Group;
 holeAnchor(col:number,row:number):Vector3;
 railAnchor(rail:'5v-rail'|'gnd-rail',col:number):Vector3;
 dispose():void;
}

const TW=4096,TH=2560;
const SX=TW/BB_W,SZ=TH/BB_D;
const px=(x:number):number=>(x-(BB_CX-BB_W/2))*SX;
const pz=(z:number):number=>(z+BB_D/2)*SZ;
const hex=(n:number):string=>'#'+n.toString(16).padStart(6,'0');

function topTexture():CanvasTexture{
 const cv=document.createElement('canvas');cv.width=TW;cv.height=TH;
 const g=cv.getContext('2d')!;
 g.fillStyle=hex(C.CREAM);g.fillRect(0,0,TW,TH);
 // rail stripes
 g.lineWidth=0.35*SZ;
 for(const s of [-1,1]){
  g.strokeStyle=hex(C.RAIL_RED);g.beginPath();g.moveTo(px(BB_CX-BB_W/2+4),pz(s*24.7));g.lineTo(px(BB_CX+BB_W/2-4),pz(s*24.7));g.stroke();
  g.strokeStyle=hex(C.RAIL_BLUE);g.beginPath();g.moveTo(px(BB_CX-BB_W/2+4),pz(s*18.5));g.lineTo(px(BB_CX+BB_W/2-4),pz(s*18.5));g.stroke();
 }
 // channel
 g.fillStyle=hex(C.GROOVE);g.fillRect(0,pz(-1.2),TW,2.4*SZ);
 const hole=(x:number,z:number):void=>{
  const X=px(x),Z=pz(z),r=0.475*SZ;
  g.fillStyle=C.BB_HOLE;g.beginPath();g.arc(X,Z,r,0,Math.PI*2);g.fill();
  g.strokeStyle='rgba(0,0,0,0.35)';g.lineWidth=r*0.3;g.beginPath();g.arc(X,Z,r*0.82,Math.PI*0.95,Math.PI*1.6);g.stroke();
  g.strokeStyle='rgba(255,255,255,0.7)';g.lineWidth=r*0.28;g.beginPath();g.arc(X,Z,r*1.12,Math.PI*-0.05,Math.PI*0.6);g.stroke();
 };
 for(let c=0;c<BB_COLS;c++)for(let r=0;r<BB_ROWS;r++)hole(holeX(c),holeZ(r));
 for(const s of [-1,1])for(const z of [RAIL_Z['5v-rail'],RAIL_Z['gnd-rail']])for(let c=0;c<BB_COLS;c++)hole(railX(c),s*z);
 // labels
 g.fillStyle='#8c8981';g.textAlign='center';g.textBaseline='middle'; // ds-allow-hex
 g.font=`500 ${1.6*SZ}px "IBM Plex Mono", ui-monospace, monospace`;
 const letters='abcdefghij';
 for(let r=0;r<BB_ROWS;r++){g.fillText(letters[r]!,px(BB_CX-BB_W/2+3.2),pz(holeZ(r)));g.fillText(letters[r]!,px(BB_CX+BB_W/2-3.2),pz(holeZ(r)));}
 for(let c=0;c<BB_COLS;c++){const n=c+1;if(n===1||n%5===0){g.fillText(String(n),px(holeX(c)),pz(-16.6));g.fillText(String(n),px(holeX(c)),pz(16.6));}}
 g.font=`600 ${2.2*SZ}px "IBM Plex Mono", ui-monospace, monospace`;
 for(const s of [-1,1]){
  g.fillStyle=hex(C.RAIL_RED);g.fillText('+',px(BB_CX-BB_W/2+3.2),pz(s*22.86));
  g.fillStyle=hex(C.RAIL_BLUE);g.fillText('−',px(BB_CX-BB_W/2+3.2),pz(s*20.32));
 }
 return canvasTexture(cv);
}

export function buildBreadboard():BreadboardBuild{
 const group=new Group();group.name='breadboard';group.userData.targetId='bb';
 const BASE=BB_TOP-1.5;
 const base=new Mesh(new RoundedBoxGeometry(BB_W,BASE,BB_D,3,1.2),toon(C.CREAM_DARK));
 base.position.set(BB_CX,BASE/2,0);base.castShadow=true;base.receiveShadow=true;group.add(base);
 const tex=topTexture();
 const topMat=new MeshStandardMaterial({map:tex,roughness:0.6,metalness:0});topMat.userData.own=true;topMat.userData.ownMap=true;
 const slabD=BB_D/2-1.2;
 for(const s of [-1,1]){
  const cz=s*(1.2+slabD/2);
  const slab=new Mesh(new RoundedBoxGeometry(BB_W,1.5,slabD,2,0.5),toon(C.CREAM));
  slab.position.set(BB_CX,BASE+0.75,cz);slab.castShadow=true;slab.receiveShadow=true;group.add(slab);
  const geo=new PlaneGeometry(BB_W-0.6,slabD-0.6);
  const pos=geo.attributes.position!,uv=geo.attributes.uv as BufferAttribute;
  for(let i=0;i<pos.count;i++){uv.setXY(i,(pos.getX(i)+BB_W/2)/BB_W,1-(cz-pos.getY(i)+BB_D/2)/BB_D);}
  const top=new Mesh(geo,topMat);top.rotation.x=-Math.PI/2;top.position.set(BB_CX,BB_TOP+0.01,cz);top.receiveShadow=true;top.userData.noPick=true;group.add(top);
 }
 const cs=contactShadow(BB_W,BB_D,0.35,6);cs.position.set(BB_CX,0.03,2);group.add(cs);
 return {
  group,
  holeAnchor:(col,row)=>new Vector3(holeX(col),BB_TOP,holeZ(row)),
  railAnchor:(r,col)=>new Vector3(railX(col),BB_TOP,RAIL_Z[r]),
  dispose(){disposeObject(group);},
 };
}
