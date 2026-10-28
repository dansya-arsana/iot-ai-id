/** Pure footprint derivation: lab pin anchors (mm, x right, z toward viewer) -> carrier-board rows. Geometry only, no vendor data. */
import type {z} from 'zod';
import type {FootprintSchema} from './schema.js';
export type Footprint=z.infer<typeof FootprintSchema>;
export interface PinPos{name:string;x:number;z:number}
export const FP_MARGIN=2,FP_PITCH=2.54;
const r2=(n:number)=>Math.round(n*1000)/1000;
/** Group pins into straight rows (same z, constant x pitch). Origins are shifted so the pin bounding box starts at FP_MARGIN. */
export function deriveFootprint(pins:PinPos[],sizeMm?:{w:number;h:number},kind:Footprint['kind']='module-headers'):Footprint{
 const minX=Math.min(...pins.map(p=>p.x)),minZ=Math.min(...pins.map(p=>p.z)),maxX=Math.max(...pins.map(p=>p.x)),maxZ=Math.max(...pins.map(p=>p.z));
 const byZ=new Map<number,PinPos[]>();
 for(const p of pins){const k=Math.round(p.z*10);byZ.set(k,[...(byZ.get(k)??[]),p]);}
 const rows:Footprint['rows']=[];
 for(const k of [...byZ.keys()].sort((a,b)=>a-b)){
  const ps=byZ.get(k)!.sort((a,b)=>a.x-b.x);
  let run:PinPos[]=[];let pitch=0;
  const flush=()=>{if(run.length)rows.push({origin:{x:r2(run[0]!.x-minX+FP_MARGIN),y:r2(run[0]!.z-minZ+FP_MARGIN)},pitch:r2(pitch||FP_PITCH),pins:run.map(p=>p.name)});run=[];pitch=0;};
  for(const p of ps){
   if(run.length===1){pitch=p.x-run[0]!.x;run.push(p);}
   else if(run.length>1&&Math.abs(p.x-run[run.length-1]!.x-pitch)<0.05)run.push(p);
   else{flush();run=[p];}
  }
  flush();
 }
 return{kind,outlineMm:{w:r2(Math.max(sizeMm?.w??0,maxX-minX+2*FP_MARGIN)),h:r2(Math.max(sizeMm?.h??0,maxZ-minZ+2*FP_MARGIN))},rows,holes:[]};
}
/** Fallback with no lab model: all pins in one header row across the long side of the module. */
export function singleRowFootprint(names:string[],sizeMm:{w:number;h:number}):Footprint{
 const w=Math.max(sizeMm.w,(names.length-1)*FP_PITCH+2*FP_MARGIN);
 return{kind:'module-headers',outlineMm:{w:r2(w),h:r2(Math.max(sizeMm.h,2*FP_MARGIN))},rows:[{origin:{x:FP_MARGIN,y:FP_MARGIN},pitch:FP_PITCH,pins:names}],holes:[]};
}
/** Pin positions implied by a footprint, relative to its first-row origin frame (absolute board coords). */
export const footprintPinPos=(f:Footprint):Map<string,{x:number;y:number}>=>{
 const m=new Map<string,{x:number;y:number}>();
 for(const r of f.rows)r.pins.forEach((n,i)=>m.set(n,{x:r.origin.x+i*r.pitch,y:r.origin.y}));
 return m;
};
