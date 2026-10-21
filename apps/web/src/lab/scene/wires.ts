import {BackSide,BoxGeometry,CanvasTexture,CatmullRomCurve3,CylinderGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,RepeatWrapping,TubeGeometry,Vector3,Color} from 'three';
import type {SimSnapshot,UnoPin,Wire} from '../contract';
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

export interface WireBuild{group:Group;update(snap:SimSnapshot,dtMs:number):void}
const headerOf=(p:string):string=>/^D\d/.test(p)?'d':/^A\d/.test(p)?'a':'p';

/** Builds jumper wires. `end` resolves the part-side anchor (world mm, surface) or null to skip. */
export function buildWires(wires:Wire[],unoAnchor:(w:Wire)=>Vector3,end:(w:Wire,railIndex:number)=>Vector3|null):WireBuild{
 const g=new Group();g.name='wires';
 const rails:Record<string,number>={};
 const seen:Record<string,number>={};
 const total:Record<string,number>={};
 for(const w of wires)total[headerOf(w.boardPin)]=(total[headerOf(w.boardPin)]??0)+1;
 const live=new Color(C.LIVE);
 const dyn:{mat:MeshStandardMaterial;ov:MeshBasicMaterial|null;pin:string;pwm:boolean}[]=[];
 for(const w of wires){
  const railKey=w.componentId==='bb'?w.pin:'';
  const idx=railKey?(rails[railKey]=(rails[railKey]??-1)+1):0;
  const b=end(w,idx);
  if(!b)continue;
  const a=unoAnchor(w);
  const hk=headerOf(w.boardPin),n=seen[hk]=(seen[hk]??-1)+1;
  const fan=(n-((total[hk]??1)-1)/2)*1.6;
  const color=C.WIRE_COLOR[w.color];
  for(const p of [a,b]){
   g.add(solid(housing,C.DUPONT,{pos:[p.x,p.y+LIFT+HOUSING_H/2,p.z],cast:true}));
   g.add(solid(collar,C.DUPONT,{pos:[p.x,p.y+LIFT+0.6,p.z],cast:false}));
   const pin=new Mesh(pinGeo,toon(C.SILVER,'metal'));pin.position.set(p.x,p.y+LIFT-1.1,p.z);pin.userData.noPick=true;g.add(pin);
  }
  const top=LIFT+HOUSING_H;
  const pts=wireCurve([a.x,a.y+top,a.z],[b.x,b.y+top,b.z],fan,2.5*n).map(p=>new Vector3(p[0],p[1],p[2]));
  const curve=new CatmullRomCurve3(pts);
  const mat=new MeshStandardMaterial({color,roughness:0.45,metalness:0});mat.userData.own=true;
  const tube=new Mesh(new TubeGeometry(curve,96,R,12,false),mat);
  tube.castShadow=true;tube.userData.targetId=`wire:${w.componentId}.${w.pin}`;
  // ink sleeve (back faces only): a constant 0.3mm outline around the coloured core
  const sm=new MeshBasicMaterial({color:C.INK,side:BackSide});sm.userData.own=true;
  const sleeve=new Mesh(new TubeGeometry(curve,96,R+0.3,12,false),sm);
  sleeve.userData.noPick=true;sleeve.userData.noInk=true;
  g.add(tube,sleeve);
  const pwm=(PWM_PINS as readonly string[]).includes(w.boardPin);
  let ov:MeshBasicMaterial|null=null;
  if(pwm){
   ov=new MeshBasicMaterial({color:C.PWM,transparent:true,opacity:0,alphaMap:dashTex(),depthWrite:false});
   ov.userData.own=true;
   const o=new Mesh(new TubeGeometry(curve,96,R+0.08,12,false),ov);o.userData.noPick=true;o.userData.noInk=true;g.add(o);
  }
  dyn.push({mat,ov,pin:w.boardPin,pwm});
 }
 return {
  group:g,
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
