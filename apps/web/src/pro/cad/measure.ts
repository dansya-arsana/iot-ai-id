/** Measure tool math (pure). Points snap to box corners and centres of visible items, then to the free hit point. */
import type {AssemblyItem,Vec3} from './plan';

export interface MeasureResult{a:Vec3;b:Vec3;mm:number;dx:number;dy:number;dz:number}
export const distance=(a:Vec3,b:Vec3):number=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export function measure(a:Vec3,b:Vec3):MeasureResult{
 return {a,b,mm:distance(a,b),dx:Math.abs(a[0]-b[0]),dy:Math.abs(a[1]-b[1]),dz:Math.abs(a[2]-b[2])};
}
export const formatMm=(mm:number):string=>`${mm.toFixed(1)} mm`;
export function corners(pos:Vec3,size:Vec3):Vec3[]{
 const out:Vec3[]=[];
 for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1])out.push([pos[0]+sx*size[0]/2,pos[1]+sy*size[1]/2,pos[2]+sz*size[2]/2]);
 return out;
}
/** Snap candidates for an item at its current position. */
export const snapPoints=(it:AssemblyItem,pos:Vec3):Vec3[]=>[...corners(pos,it.size),pos];
/** Pick the candidate whose projection lies nearest to the pointer within `radiusPx`; null when none. */
export function snapToScreen(cands:Vec3[],project:(p:Vec3)=>[number,number],px:[number,number],radiusPx=14):Vec3|null{
 let best:Vec3|null=null,bd=radiusPx;
 for(const c of cands){const [x,y]=project(c);const d=Math.hypot(x-px[0],y-px[1]);if(d<bd){bd=d;best=c;}}
 return best;
}
