/** packages/hardware-library -> fragments: names, kind (category), aliases, summary, pitfalls from `limitations`, protocols. */
import {hardwareLibrary} from '../../hardware-library/index.js';
import type {HardwareReference} from '../../hardware-library/index.js';
import {confidenceFromGrade,PART_PROTOCOLS} from '../schema.js';
import type {Fragment,Bi} from './common.js';
import {tag} from './common.js';

const SRC='packages/hardware-library';
const slugKind=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,32)||'part';
const protos=new Set<string>(PART_PROTOCOLS);
/** The library is Indonesian-first with a few English entries; we keep the text as `id` and do not invent a translation for `en`. */
const bi=(t:string):Bi=>({en:t.slice(0,300),id:t.slice(0,300)});

export function importHardwareLibrary(records:readonly HardwareReference[]=hardwareLibrary):Fragment[]{
 return records.map(r=>{
  // Recipe-backed records were exercised end to end (grade B); spec-only references are grade C.
  const conf=confidenceFromGrade(r.support==='recipe_available'?'B':'C');
  const src=r.sources[0]?.url??SRC;
  const supported=r.protocols.map(p=>p.toLowerCase()).filter(p=>protos.has(p)) as never[];
  return{
   id:r.id,source:'hardware-library',
   name:tag(r.name.slice(0,80),src,conf),
   kind:tag(r.kind==='board'?'board':slugKind(r.category),SRC,conf),
   aliases:[...r.aliases,r.family],
   protocols:supported.length?tag(supported,SRC,conf):undefined,
   summary:tag(bi(r.summary),SRC,conf),
   pitfalls:r.limitations.slice(0,20).map(l=>tag(bi(l),src,conf)),
  };
 });
}
