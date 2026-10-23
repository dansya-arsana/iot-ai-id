/** Section tool: one clipping plane along X, Y or Z with an offset (pure). The viewport feeds `plane()` to three's clippingPlanes. */
import type {Vec3} from './plan';
export type Axis='x'|'y'|'z';
export interface SectionState{enabled:boolean;axis:Axis;/** 0..1 across the bounds */t:number;/** which side is kept */flip:boolean}
export const initialSection=():SectionState=>({enabled:false,axis:'z',t:0.5,flip:false});
const IDX:Record<Axis,number>={x:0,y:1,z:2};
export const offsetAt=(s:SectionState,min:Vec3,max:Vec3):number=>{const i=IDX[s.axis];return min[i]!+(max[i]!-min[i]!)*Math.min(1,Math.max(0,s.t));};
/** Plane as {normal, constant}: points with normal.p + constant >= 0 are kept. */
export function plane(s:SectionState,min:Vec3,max:Vec3):{normal:Vec3;constant:number}{
 const n:Vec3=[0,0,0];n[IDX[s.axis]]=s.flip?1:-1;
 const off=offsetAt(s,min,max);
 return {normal:n,constant:s.flip?-off:off};
}
/** Does the plane cut through the box of an item (so it gets a hatched face)? */
export function cuts(s:SectionState,pos:Vec3,size:Vec3,min:Vec3,max:Vec3):boolean{
 const i=IDX[s.axis];const off=offsetAt(s,min,max);
 return off>pos[i]!-size[i]!/2&&off<pos[i]!+size[i]!/2;
}
