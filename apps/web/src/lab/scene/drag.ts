/** Pure helpers for direct manipulation in the 3D scene: value snapping, knob angle, control routing, cursors. No three.js. */
import type {PartInput,PartKind,PartProps} from '../contract';
import {INPUT_RANGES} from '../contract';
import type {DragHandle,DragSpec} from './parts/types';

export const KNOB_SWEEP=135; // degrees either side of centre
const clamp=(v:number,lo:number,hi:number):number=>Math.max(lo,Math.min(hi,v));

/** Snap a distance to whole cm; with `coarse` (Shift) to 5 cm steps. Always clamped to the range. */
export function snapCm(cm:number,range:readonly [number,number],coarse=false):number{
 const s=coarse?5:1;
 return clamp(Math.round(cm/s)*s,range[0],range[1]);
}

/** Knob value (0..1023) <-> pointer angle in degrees (0 = straight up, clockwise positive, clamped to +-135). */
export const valueToAngle=(v:number):number=>((clamp(v,0,INPUT_RANGES.potentiometer.max)/INPUT_RANGES.potentiometer.max)*2-1)*KNOB_SWEEP;
export const angleToValue=(a:number):number=>Math.round(((clamp(a,-KNOB_SWEEP,KNOB_SWEEP)+KNOB_SWEEP)/(2*KNOB_SWEEP))*INPUT_RANGES.potentiometer.max);
/** Pointer angle around the knob centre; dy is unsquashed for the isometric tilt (divide by sin(elev)). */
export const pointerAngle=(dx:number,dy:number,elev:number):number=>(Math.atan2(dx,-(dy/Math.sin(elev)))*180)/Math.PI;
/** Relative turn: the knob follows the pointer from where it was grabbed (no jump on pickup); shortest-way wrap. */
export function relativeKnob(startValue:number,startPointerDeg:number,pointerDeg:number):number{
 let d=pointerDeg-startPointerDeg;
 if(d>180)d-=360;else if(d<-180)d+=360;
 return angleToValue(valueToAngle(startValue)+d);
}

export interface Cursors{hover:string;active:string}
export function cursorsFor(drag:DragSpec|undefined):Cursors|null{
 if(!drag)return null;
 if(drag.cursor)return drag.cursor;
 const h:DragHandle=drag.handle;
 if(h==='press')return {hover:'pointer',active:'pointer'};
 if(h==='rotate')return {hover:'grab',active:'grabbing'};
 if(h==='slide-z')return {hover:'ns-resize',active:'ns-resize'};
 if(h==='slide-x'||h==='toggle-slide')return {hover:'ew-resize',active:'ew-resize'};
 return {hover:'grab',active:'grabbing'};
}

/** Where a popover control value goes: a sim input (continuous, live) or a part-prop edit (rebuilds the 3D part). */
export interface ControlRoute{input?:PartInput;props?:PartProps}
export function routeControl(kind:PartKind,key:string,value:string|number|boolean):ControlRoute{
 if(key==='distanceCm'&&(kind==='obstacle'||kind==='lamp')){
  const r=INPUT_RANGES[kind];
  return {input:{kind,distanceCm:clamp(Math.round(Number(value)),r.min,r.max)},props:{distanceCm:clamp(Math.round(Number(value)),r.min,r.max)}};
 }
 if(key==='on'&&kind==='lamp')return {input:{kind:'lamp',on:!!value},props:{on:!!value}};
 if(key==='value'&&kind==='potentiometer')return {input:{kind:'potentiometer',value:clamp(Math.round(Number(value)),0,INPUT_RANGES.potentiometer.max)}};
 return {props:{[key]:value}};
}

/** Keyboard nudge for a focused part: returns the new value of its drag prop, or null. */
export function keyNudge(key:string,shift:boolean,cur:number,drag:DragSpec|undefined):number|null{
 if(!drag?.prop||!drag.range)return null;
 const dir=key==='ArrowRight'||key==='ArrowUp'?1:key==='ArrowLeft'||key==='ArrowDown'?-1:0;
 if(!dir)return null;
 const big=drag.handle==='rotate'?(shift?128:32):(shift?10:1);
 // obstacle is "closer" to the left/down: ArrowUp/Right grow the distance for both desk handles
 return clamp(cur+dir*big,drag.range[0],drag.range[1]);
}
