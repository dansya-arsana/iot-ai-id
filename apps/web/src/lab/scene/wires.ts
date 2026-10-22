import {BackSide,BoxGeometry,CanvasTexture,CatmullRomCurve3,CylinderGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,RepeatWrapping,TubeGeometry,Vector3,Color} from 'three';
import type {SimSnapshot,UnoPin,Wire,WireColor} from '../contract';
import {PWM_PINS} from '../contract';
import {wireCurve} from './layout';
import {canvasTexture,solid,toon} from './materials';
import * as C from './palette';

const HOUSING_H=12,LIFT=2.5;
const housing=new BoxGeometry(2.5,HOUSING_H,2.5);
const collar=new BoxGeometry(2.9,1.2,2.9);
const pinGeo=new CylinderGeometry(0.3,0.3,3.4,8);
const R=0.85;

let dash:CanvasTexture|null=null;
function dashTex():CanvasTexture{
 if(dash)return dash;
 const cv=document.createElement('canvas');cv.width=64;cv.height=4;
 const g=cv.getContext('2d')!;g.fillStyle='#000';g.fillRect(0,0,64,4);g.fillStyle='#fff';g.fillRect(0,0,32,4);
 dash=canvasTexture(cv,false);dash.wrapS=RepeatWrapping;dash.repeat.set(12,1);
 return dash;
}
export const disposeWireTextures=():void=>{dash?.dispose();dash=null;};

/** Path that rounds the left edge of a standing display and arrives at `b` from behind it (`reach` mm left of the pin: 54 for the 98 mm LCD2004). */
function behindPath(a:Vector3,b:Vector3,top:number,fan:number,lift:number,reach:number):Vector3[]{
 const xL=b.x-reach-fan*2,zBack=b.z-14-fan*2;
 const hi=Math.max(a.y,b.y)+top+10+lift;
 const ctl:[number,number,number][]=[
  [a.x,a.y+top,a.z],
  [a.x+(xL-a.x)*0.5,hi,a.z+(zBack-a.z)*0.5],
  [xL,b.y+top+8,zBack],
  [b.x-8,b.y+top+8,zBack],
  [b.x,b.y+top+2,b.z-5],
  [b.x,b.y+top,b.z],
 ];
 return new CatmullRomCurve3(ctl.map(q=>new Vector3(q[0],q[1],q[2]))).getPoints(96);
}

/** Path for a part standing in front of a tall display: the jumper dips to the front of the board and arrives low from the front, so it never drapes over the glass. */
function frontPath(a:Vector3,b:Vector3,top:number,fan:number,lift:number):Vector3[]{
 const zF=Math.max(b.z+16,a.z)+fan,hi=Math.max(a.y,b.y)+top+6+lift;
 const ctl:[number,number,number][]=[
  [a.x,a.y+top,a.z],
  [a.x+(b.x-a.x)*0.3,hi,(a.z+zF)/2],
  [b.x-10,b.y+top+5,zF],
  [b.x,b.y+top+3,b.z+5],
  [b.x,b.y+top,b.z],
 ];
 return new CatmullRomCurve3(ctl.map(q=>new Vector3(q[0],q[1],q[2]))).getPoints(96);
}

export interface WirePath{id:string;pts:[number,number,number][]}
export interface WireBuild{group:Group;/** the centre line of every jumper, world mm (layout checks) */paths:WirePath[];update(snap:SimSnapshot,dtMs:number):void}
const headerOf=(p:string):string=>/^D\d/.test(p)?'d':/^A\d/.test(p)?'a':'p';

/** A part-to-part jumper (Circuit.links). Both ends are resolved by the scene: a world anchor, or null to skip. */
export interface LinkEnds{id:string;color:WireColor;a:Vector3|null;b:Vector3|null}

/**
 * Builds jumper wires. `end` resolves the part-side anchor (world mm, surface) or null to skip.
 * `links` are part-to-part wires drawn after the board wires: their assembly index continues after the last board wire, and they
 * carry no pin activity (no PWM dashes), only the colour.
 */
/**
 * `behindOf(w)`: nonzero (mm to clear on the left) when this wire's part end plugs in behind a standing display (an LCD backpack): the jumper goes around the left of the display and
 * arrives from the back, so it never drapes across the screen face.
 */
export function buildWires(wires:Wire[],unoAnchor:(w:Wire)=>Vector3,end:(w:Wire,railIndex:number)=>Vector3|null,links:readonly LinkEnds[]=[],behindOf:(w:Wire)=>number=()=>0,frontOf:(w:Wire)=>boolean=()=>false):WireBuild{
 const g=new Group();g.name='wires';
 const rails:Record<string,number>={};
 const seen:Record<string,number>={};
 const total:Record<string,number>={};
 for(const w of wires)total[headerOf(w.boardPin)]=(total[headerOf(w.boardPin)]??0)+1;
 const live=new Color(C.LIVE);
 const paths:WirePath[]=[];
 const dyn:{mat:MeshStandardMaterial;ov:MeshBasicMaterial|null;pin:string;pwm:boolean}[]=[];
 /** One jumper: housings at both ends, a sleeved tube between them. `pin` is the board pin it follows (null for a link). */
 const draw=(wi:number,a:Vector3,b:Vector3,colorName:Wire['color'],targetId:string,fan:number,lift:number,pin:string|null,behind=0,front=false):void=>{
  const first=g.children.length;
  const color=C.WIRE_COLOR[colorName];
  for(const p of [a,b]){
   g.add(solid(housing,C.DUPONT,{pos:[p.x,p.y+LIFT+HOUSING_H/2,p.z],cast:true}));
   g.add(solid(collar,C.DUPONT,{pos:[p.x,p.y+LIFT+0.6,p.z],cast:false}));
   const pinMesh=new Mesh(pinGeo,toon(C.SILVER,'metal'));pinMesh.position.set(p.x,p.y+LIFT-1.1,p.z);pinMesh.userData.noPick=true;g.add(pinMesh);
  }
  const top=LIFT+HOUSING_H;
  const pts=behind>0?behindPath(a,b,top,fan,lift,behind):front?frontPath(a,b,top,fan,lift):wireCurve([a.x,a.y+top,a.z],[b.x,b.y+top,b.z],fan,lift).map(q=>new Vector3(q[0],q[1],q[2]));
  const curve=new CatmullRomCurve3(pts);
  paths.push({id:targetId,pts:pts.map(q=>[q.x,q.y,q.z])});
  const mat=new MeshStandardMaterial({color,roughness:0.45,metalness:0});mat.userData.own=true;
  const tube=new Mesh(new TubeGeometry(curve,96,R,12,false),mat);
  tube.castShadow=true;tube.userData.targetId=targetId;
  // ink sleeve (back faces only): a constant 0.3mm outline around the coloured core
  const sm=new MeshBasicMaterial({color:C.INK,side:BackSide});sm.userData.own=true;
  const sleeve=new Mesh(new TubeGeometry(curve,96,R+0.3,12,false),sm);
  sleeve.userData.noPick=true;sleeve.userData.noInk=true;
  g.add(tube,sleeve);
  const pwm=pin!==null&&(PWM_PINS as readonly string[]).includes(pin);
  let ov:MeshBasicMaterial|null=null;
  if(pwm){
   ov=new MeshBasicMaterial({color:C.PWM,transparent:true,opacity:0,alphaMap:dashTex(),depthWrite:false});
   ov.userData.own=true;
   const o=new Mesh(new TubeGeometry(curve,96,R+0.08,12,false),ov);o.userData.noPick=true;o.userData.noInk=true;g.add(o);
  }
  // assembly animation handles: wire index, end A (board side: first 3 objects), end B (next 3), the rest are tubes
  for(let c=first;c<g.children.length;c++){const o=g.children[c]!;o.userData.wireIdx=wi;o.userData.wirePart=c-first<3?'a':c-first<6?'b':'tube';}
  if(pin!==null)dyn.push({mat,ov,pin,pwm});
 };
 for(const [wi,w] of wires.entries()){
  const railKey=w.componentId==='bb'?w.pin:'';
  const idx=railKey?(rails[railKey]=(rails[railKey]??-1)+1):0;
  const b=end(w,idx);
  if(!b)continue;
  const a=unoAnchor(w);
  const hk=headerOf(w.boardPin),n=seen[hk]=(seen[hk]??-1)+1;
  const fan=(n-((total[hk]??1)-1)/2)*1.6;
  draw(wi,a,b,w.color,`wire:${w.componentId}.${w.pin}`,fan,2.5*n,w.boardPin,behindOf(w),frontOf(w));
 }
 links.forEach((l,i)=>{if(l.a&&l.b)draw(wires.length+i,l.a,l.b,l.color,`wire:${l.id}`,(i%3-1)*1.6,2.5*i,null);});
 return {
  group:g,paths,
  update(snap,dt){
   let speed=0;
   for(const d of dyn){
    const s=snap.pins[d.pin as UnoPin] as SimSnapshot['pins'][UnoPin]|undefined;
    if(!s||snap.status!=='running'){d.mat.emissive.setScalar(0);if(d.ov)d.ov.opacity=0;continue;}
    const high=s.mode==='output'&&s.level===1;
    const pwming=d.pwm&&s.mode==='output'&&s.duty>0.02&&s.duty<0.98;
    d.mat.emissive.copy(live).multiplyScalar(high&&!pwming?0.35:0);
    if(d.ov){
     d.ov.opacity=pwming?Math.min(1,0.25+0.75*s.duty):0;
     if(pwming)speed=Math.max(speed,s.freqHz>700?0.006:0.003);
    }
   }
   if(speed>0)dashTex().offset.x-=dt*speed;
  },
 };
}
