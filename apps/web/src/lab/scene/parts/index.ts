/** Part registry: one PartModule per PartKind, plus buildPart(spec) which the scene uses. */
import {Group,Vector3} from 'three';
import type {PartKind,PartProps,PartSpec,PartState} from '../../contract';
import {PART_PINS} from '../../contract';
import {PITCH,PIN_COLS} from '../layout';
import {disposeObject} from '../materials';
import {led} from './led';
import {rgbLed} from './rgb-led';
import {resistor} from './resistor';
import {diode} from './diode';
import {button} from './button';
import {potentiometer} from './potentiometer';
import {ldr} from './ldr';
import {buzzer} from './buzzer';
import {transistor} from './transistor';
import {hcsr04} from './hcsr04';
import {obstacle} from './obstacle';
import {lamp} from './lamp';
import {motor} from './motor';
import {servo} from './servo';
import type {DragHandle,PartModule,PartRegistry} from './types';

export type {Callout,ControlSpec,Copy,DragHandle,DragSpec,Footprint,InteractSpec,PartCtx,PartModule,PartRegistry,PinDef,PinType} from './types';
/** Handles the picking layer understands. Kept as the old name for scene code. */
export type Interactive=Exclude<DragHandle,'drag-xz'>;

const MODULES:Record<PartKind,PartModule>={
 led,'rgb-led':rgbLed,resistor,diode,button,potentiometer,ldr,buzzer,transistor,hcsr04,obstacle,lamp,motor,servo,
};
export const registry:PartRegistry={
 get:k=>(MODULES as Record<string,PartModule|undefined>)[k],
 has:k=>Object.prototype.hasOwnProperty.call(MODULES,k),
 kinds:()=>Object.keys(MODULES) as PartKind[],
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
