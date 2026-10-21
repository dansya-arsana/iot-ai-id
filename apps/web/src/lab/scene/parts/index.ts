/** Part registry: one PartModule per PartKind, plus buildPart(spec) which the scene uses. */
import {Group,Vector3} from 'three';
import type {PartKind,PartProps,PartSpec,PartState} from '../../contract';
import {PART_PINS} from '../../contract';
import '../../sim/devices';
import {nodeLoad} from '../../sim/devices/core/discover';
import type {Mods} from '../../sim/devices/core/discover';
import {PITCH,PIN_COLS} from '../layout';
import {disposeObject} from '../materials';
import type {DragHandle,PartModule,PartRegistry} from './types';

export type {Callout,ControlSpec,Copy,DragHandle,DragSpec,Footprint,InteractSpec,PartCtx,PartModule,PartRegistry,PinDef,PinType} from './types';
/** Handles the picking layer understands. Kept as the old name for scene code. */
export type Interactive=Exclude<DragHandle,'drag-xz'>;

/** Auto-discovery: every parts/<file>.ts that exports a PartModule is registered by its kind. No list to edit. */
const SKIP=['index.ts','kit.ts','types.ts'];
function load():Mods{
 try{return import.meta.glob(['./*.ts','!./index.ts','!./kit.ts','!./types.ts'],{eager:true}) as Mods;}
 catch{return nodeLoad(new URL('./',import.meta.url).href,SKIP);}
}
const isPart=(v:unknown):v is PartModule=>{
 const m=v as Partial<PartModule>|null;
 return !!m&&typeof m==='object'&&typeof m.kind==='string'&&typeof m.build==='function'&&typeof m.apply==='function'&&!!m.pins;
};
const MODULES:Record<string,PartModule>={};
const mods=load();
for(const f of Object.keys(mods).sort())for(const v of Object.values(mods[f]!))if(isPart(v))MODULES[v.kind]=v;
export const registry:PartRegistry={
 get:k=>MODULES[k],
 has:k=>Object.prototype.hasOwnProperty.call(MODULES,k),
 kinds:()=>Object.keys(MODULES),
};
export const partModule=(kind:PartKind):PartModule=>MODULES[kind];

export interface PartView{
 group:Group;
 module:PartModule;
 pinAnchor(pin:string):Vector3;
 apply(state:PartState,dtMs:number):void;
 setProps(p:PartProps):void;
 interactive?:Interactive;
}

export function buildPart(spec:PartSpec):PartView{
 const mod=MODULES[spec.kind];
 const ctx={reducedMotion:false};
 let props:PartProps={...spec.props};
 let group=mod.build(props,ctx);
 // the scene keeps one Group per part for its whole life: rebuild contents in place on setProps
 const root=new Group();root.name=spec.id;root.userData.targetId=spec.id;
 const adopt=(g:Group):void=>{for(const ch of [...g.children])root.add(ch);root.userData.rt=g.userData.rt;};
 adopt(group);
 const handle=():Interactive|undefined=>{const h=mod.interact?.drag?.handle;return h&&h!=='drag-xz'?h:undefined;};
 const view:PartView={
  group:root,module:mod,
  interactive:handle(),
  pinAnchor(pin){
   const p=mod.pins[pin];
   if(p)return new Vector3(p.at[0],p.at[1],p.at[2]);
   const i=PART_PINS[spec.kind].indexOf(pin),cols=PIN_COLS[spec.kind];
   return new Vector3(i>=0&&cols?cols[i]!*PITCH:0,0,0);
  },
  apply(s,dt){mod.apply(root,s,dt);},
  setProps(p){
   props={...props,...p};
   for(const ch of [...root.children]){root.remove(ch);disposeObject(ch);}
   group=mod.build(props,ctx);adopt(group);
  },
 };
 return view;
}
