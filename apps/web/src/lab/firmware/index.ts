/**
 * The compiled firmware of every lesson. Each sketch has its own generated file `generated/<sketch>.ts` (written by
 * `npm run lab:firmware -- <sketch>`), discovered here by glob, so two people adding lessons never edit the same file.
 */
import {FIRMWARE_SPEC,LESSON_IDS} from '../contract';
import type {FirmwareBundle,FirmwareRegistry,FirmwareSketch,FirmwareVariant} from '../contract';
import {nodeLoad,pick} from '../sim/devices/core/discover';
import type {Mods} from '../sim/devices/core/discover';

function load():Mods{
 try{return import.meta.glob(['./generated/*.ts'],{eager:true}) as Mods;}
 catch{return nodeLoad(new URL(/* @vite-ignore */ './generated/',import.meta.url).href,[]);}
}
const sketches=pick<FirmwareSketch>(load(),'sketch');
const bySketch=new Map<string,FirmwareVariant>(sketches.map(s=>[s.variant.sketch,s.variant]));

const lessons:Record<string,FirmwareBundle>={};
for(const id of LESSON_IDS){
 const variants:FirmwareVariant[]=[];
 for(const spec of FIRMWARE_SPEC[id]?.variants??[]){const v=bySketch.get(`${id}-${spec.id}`);if(v)variants.push(v);}
 lessons[id]={lessonId:id,variants};
}
export const labFirmware:FirmwareRegistry={toolchain:sketches[0]?.toolchain??'unknown',lessons};
export const hasSketch=(sketch:string):boolean=>bySketch.has(sketch);
