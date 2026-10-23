/** Explode slider math. 0 = assembled, 1 = fully apart. The offsets are the assembly order reversed: later parts travel further. */
import type {AssemblyItem,AssemblyPlan,Vec3} from './plan';
import {explodedPos} from './plan';

export const clamp01=(v:number):number=>v<0?0:v>1?1:v;
/** Slider percent (0..100) to fraction. */
export const fractionOf=(pct:number):number=>clamp01(pct/100);
/** Where each item sits at fraction k; items stagger so the last ones leave first and never pass through each other. */
export function explodeAll(plan:AssemblyPlan,k:number):Map<string,Vec3>{
 const out=new Map<string,Vec3>();
 const n=Math.max(1,plan.items.length-1);
 for(const it of plan.items){
  const stagger=it.type==='enclosure'?0:0.55+0.45*(it.ref/n);
  out.set(it.id,explodedPos(it,clamp01(k)*Math.min(1,stagger)));
 }
 return out;
}
export const explodeOne=(it:AssemblyItem,k:number):Vec3=>explodedPos(it,clamp01(k));
