/** Shared geometry helpers and the definePart adapter for parts/<kind>.ts. */
import {AdditiveBlending,Box3,BoxGeometry,Group,LatheGeometry,Mesh,MeshBasicMaterial,PlaneGeometry,Sprite,SpriteMaterial,Vector2,type CanvasTexture} from 'three';
import type {PartKind,PartProps,PartState} from '../../contract';
import {PIN_COLS,PITCH,BODY_X,isOnBoardKind} from '../layout';
import {glowTexture,solid} from '../materials';
import {contactShadow} from '../decals';
import {contentBox} from '../bounds';
import * as C from '../palette';
import type {Callout,Copy,InteractSpec,PartModule,PinDef} from './types';

/** Per-instance runtime returned by a kind's builder; kept on group.userData.rt. */
export interface Inner{apply(s:PartState,dt:number):void}
export type Make=(props:PartProps,g:Group)=>Inner;

export const noop=():void=>undefined;
export const clamp01=(v:number):number=>Math.min(1,Math.max(0,v));
export const HALF_PI=Math.PI/2;
export const hex=(n:number):string=>'#'+n.toString(16).padStart(6,'0');
export const MONO='"IBM Plex Mono", ui-monospace, monospace';
export const c=(en:string,id:string):Copy=>({en,id});
export const sprite=(map:CanvasTexture,color:number,size:number,y:number,x=0,additive=true):Sprite=>{
 const m=new SpriteMaterial({map,color,transparent:true,blending:additive?AdditiveBlending:1,depthWrite:false,opacity:0});
 m.userData.own=true;
 const s=new Sprite(m);s.scale.set(size,size,1);s.position.set(x,y,0);s.userData.noPick=true;s.renderOrder=3;
 return s;
};
/** 0.6mm metal lead, visible above the board. */
export const leg=(x:number,h:number,z=0):Mesh=>solid(new BoxGeometry(0.6,h,0.6),C.SILVER,{pos:[x,h/2,z],cast:false,finish:'metal'});
export const num=(v:unknown,d:number):number=>typeof v==='number'?v:d;
export const pool=(color:number,x:number):Mesh=>{
 const m=new Mesh(new PlaneGeometry(40,40),new MeshBasicMaterial({map:glowTexture(),color,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));
 m.material.userData.own=true;m.rotation.x=-HALF_PI;m.position.set(x,0.08,0);m.userData.noPick=true;m.userData.noInk=true;m.renderOrder=1;return m;
};
export function domeGeo():LatheGeometry{
 const pts=[[0,2.6],[3.9,2.6],[3.9,3.4],[3.6,3.4],[3.6,9.6],[3.2,11.4],[2.2,12.5],[1.1,12.95],[0,13]].map(([r,y])=>new Vector2(r!,y!));
 return new LatheGeometry(pts,32);
}
export const ledBright=(duty:number):number=>Math.sqrt(clamp01(duty));
export function addShadow(g:Group,w:number,d:number,a:number,pad:number,x:number,y:number,z:number):void{
 const m=contactShadow(w,d,a,pad);m.position.set(x,y,z);g.add(m);
}

const fp=new Box3();
/** Soft blob under on-board parts and the servo/motor, added after the builder ran. */
export function addBlob(group:Group,kind:PartKind):void{
 if(!isOnBoardKind(kind)&&kind!=='motor'&&kind!=='servo')return;
 contentBox([group],fp);if(fp.isEmpty())return;
 const w=fp.max.x-fp.min.x,d=fp.max.z-fp.min.z;
 const s=contactShadow(w,d,0.25,kind==='motor'||kind==='servo'?5:2.5);
 s.position.set((fp.min.x+fp.max.x)/2,0.03,(fp.min.z+fp.max.z)/2);s.userData.blob=true;
 group.add(s);
}

/** Pin definition helper. */
export const pin=(at:readonly [number,number,number],type:PinDef['type'],en?:string,id?:string):PinDef=>({at,type,...(en?{label:c(en,id??en)}:{})});
export const callout=(id:string,at:readonly [number,number,number],en:string,idn:string):Callout=>({id,at,text:c(en,idn)});

/** Footprint derived from the single placement table in layout.ts. */
export function footprintOf(kind:PartKind,deskMm?:readonly [number,number]):PartModule['footprint']{
 const holes=PIN_COLS[kind]??[];
 const bodyX=BODY_X[kind];
 return {onBoard:holes.length>0,holes,widthHoles:holes.length?Math.max(...holes)+1:0,...(bodyX?{bodyX}:{}),...(deskMm?{deskMm}:{})};
}

export interface PartDef{
 kind:PartKind;name:Copy;pins:Record<string,PinDef>;callouts?:Callout[];interact?:InteractSpec;
 deskMm?:readonly [number,number];
 make:Make;
}
/** Wrap a legacy-style builder (`make(props,group)` returning {apply}) into a PartModule. */
export function definePart(d:PartDef):PartModule{
 return {
  kind:d.kind,name:d.name,pins:d.pins,callouts:d.callouts??[],
  ...(d.interact?{interact:d.interact}:{}),
  footprint:footprintOf(d.kind,d.deskMm),
  build(props){
   const g=new Group();
   const rt=d.make(props,g);
   g.userData.rt=rt;
   addBlob(g,d.kind);
   return g;
  },
  apply(group,state,dt){(group.userData.rt as Inner|undefined)?.apply(state,dt);},
 };
}
export {PITCH};
