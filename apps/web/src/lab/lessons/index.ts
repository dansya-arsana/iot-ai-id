/**
 * Lesson registry with auto-discovery. Drop `lessons/<id>.ts` exporting `lesson=defineLesson({...})` and it is registered: no index to edit.
 * Lessons are numbered 1..N by ascending `order`. The tables below (CIRCUITS, FIRMWARE_SPEC, LESSON_IDS) are filled in place at load,
 * so `contract.ts` can re-export them and every existing import keeps working. Imports no runtime code from the contract (no cycle).
 */
import {nodeLoad,pick} from '../sim/devices/core/discover';
import type {Mods} from '../sim/devices/core/discover';
import {LESSON_VIEW} from '../scene/layout';
import type {Circuit,VariantSpec} from '../contract';
import type {Lesson,LessonModule} from './kit';

export type {Lesson,LessonModule,GoalFn,GoalMemory,ReadoutFn,ThumbItem,Copy,Side} from './kit';
export {defineLesson} from './kit';

const SKIP=['index.ts','kit.ts'];
function load():Mods{
 try{return import.meta.glob(['./*.ts','!./index.ts','!./kit.ts'],{eager:true}) as Mods;}
 catch{return nodeLoad(new URL('./',import.meta.url).href,SKIP);}
}

const isLesson=(v:unknown):v is LessonModule=>{
 const m=v as Partial<LessonModule>|null;
 return !!m&&typeof m==='object'&&typeof m.id==='string'&&typeof m.order==='number'&&!!m.circuit&&!!m.firmware&&typeof m.check==='function';
};

const found=pick<LessonModule>(load(),'lesson').filter(isLesson);
/** Every lesson, in teaching order (ascending `order`). */
export const LESSON_MODULES:LessonModule[]=found.slice().sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
{
 const ids=new Set<string>(),orders=new Set<number>();
 for(const m of LESSON_MODULES){
  if(!/^[a-z][a-z0-9-]*$/.test(m.id))throw new Error(`lesson id "${m.id}" must be kebab-case`);
  if(ids.has(m.id))throw new Error(`duplicate lesson id "${m.id}"`);
  if(orders.has(m.order))throw new Error(`lesson "${m.id}" reuses order ${m.order}`);
  ids.add(m.id);orders.add(m.order);
 }
}
export const LESSON_IDS:string[]=LESSON_MODULES.map(m=>m.id);
export const CIRCUITS:Record<string,Circuit>={};
export const FIRMWARE_SPEC:Record<string,{variants:VariantSpec[]}>={};
export const LESSON_BY_ID:Record<string,LessonModule>={};
for(const m of LESSON_MODULES){
 CIRCUITS[m.id]=m.circuit;
 FIRMWARE_SPEC[m.id]=m.firmware;
 LESSON_BY_ID[m.id]=m;
 if(m.view)LESSON_VIEW[m.id]=m.view;
}
/** Lesson text with its 1-based number (the position after sorting by `order`). */
export const LESSONS:Lesson[]=LESSON_MODULES.map((m,i)=>{
 const {order:_o,circuit:_c,firmware:_f,check:_k,readouts:_r,concept:_n,keyPins:_p,recordPins:_q,icon:_i,thumbnail:_t,view:_v,...text}=m;
 void [_o,_c,_f,_k,_r,_n,_p,_q,_i,_t,_v];
 return {...text,n:i+1};
});
