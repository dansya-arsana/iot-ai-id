/** Merge importer fragments into PartRecords (per-field source priority, defaults flagged low) and apply staff overlays. */
import {CATALOG_SCHEMA_VERSION,PartRecordSchema} from './schema.js';
import type {PartRecord} from './schema.js';
import {applySpecPatch} from '../pro-contract/patch.js';
import type {SpecPatch} from '../pro-contract/patch.js';
import {tag} from './import/common.js';
import type {Fragment,ImportSource,Tagged} from './import/common.js';

type Prio=readonly ImportSource[];
const P={
 name:['hardware-library','component-catalog','hardware-contract','lab-registry'],
 kind:['hardware-contract','hardware-library'],
 electrical:['component-catalog','hardware-contract','lab-registry'],
 pins:['hardware-contract','component-catalog','lab-registry'],
 protocols:['component-catalog','hardware-library','lab-registry'],
 drivers:['component-catalog'],
 summary:['hardware-library','lab-registry'],
 model3d:['lab-registry'],
} as const satisfies Record<string,Prio>;

export interface Merged{parts:PartRecord[];aliases:Record<string,string[]>}

function first<T>(frags:Fragment[],prio:Prio,get:(f:Fragment)=>T|undefined):T|undefined{
 for(const s of prio){const f=frags.find(x=>x.source===s);const v=f&&get(f);if(v!==undefined)return v;}
 return undefined;
}
const DEF='default (not in any imported source)';

export function mergeFragments(all:readonly Fragment[]):Merged{
 const byId=new Map<string,Fragment[]>();
 for(const f of all)byId.set(f.id,[...(byId.get(f.id)??[]),f]);
 const parts:PartRecord[]=[];const aliases:Record<string,string[]>={};
 for(const id of [...byId.keys()].sort()){
  const fr=byId.get(id)!;
  const name=first(fr,P.name,f=>f.name)??tag(id,DEF,'low');
  const kind=first(fr,P.kind,f=>f.kind)??tag('part',DEF,'low');
  const pitfalls:Tagged<{en:string;id:string}>[]=[];
  const seen=new Set<string>();
  for(const f of fr)for(const t of f.pitfalls??[])if(!seen.has(t.v.en)){seen.add(t.v.en);pitfalls.push(t);}
  const logic=first(fr,P.electrical,f=>f.logicLevelV);
  const rec={
   schemaVersion:CATALOG_SCHEMA_VERSION,
   identity:{id,name,kind},
   electrical:{
    supplyV:first(fr,P.electrical,f=>f.supplyV)??tag({min:3,max:5.5},DEF,'low'),
    ...(logic?{logicLevelV:logic}:{}),
    currentMa:first(fr,P.electrical,f=>f.currentMa)??tag({typ:10,peak:20},DEF,'low'),
   },
   pins:first(fr,P.pins,f=>f.pins?.length?f.pins:undefined)??[],
   protocols:{
    supported:first(fr,P.protocols,f=>f.protocols)??tag([],DEF,'low'),
    ...(first(fr,['component-catalog'],f=>f.i2cAddresses)?{i2cAddresses:first(fr,['component-catalog'],f=>f.i2cAddresses)}:{}),
   },
   mechanical:{sizeMm:tag({w:20,h:20,d:10},DEF,'low')},
   environment:{outdoor:tag(false,DEF,'low'),tempC:tag({min:-10,max:60},DEF,'low')},
   drivers:first(fr,P.drivers,f=>f.drivers)??[],
   compatibleWith:tag([] as string[],DEF,'low'),
   model3d:first(fr,P.model3d,f=>f.model3d)??{kind:tag('none' as const,DEF,'low'),status:tag('none' as const,DEF,'low')},
   untrusted:{
    summary:first(fr,P.summary,f=>f.summary)??tag({en:name.v,id:name.v},DEF,'low'),
    pitfalls:pitfalls.slice(0,20),
   },
  };
  parts.push(PartRecordSchema.parse(rec));
  const al=[...new Set(fr.flatMap(f=>f.aliases??[]).map(a=>a.toLowerCase().trim()).filter(Boolean))].sort();
  if(al.length)aliases[id]=al;
 }
 return{parts,aliases};
}

export interface OverlayEntry{partId:string;ops:SpecPatch}
/** Apply staff overlay patches (RFC 6901 on the PartRecord) and re-validate. A bad overlay is skipped and reported, never half-applied. */
export function applyOverlay(parts:readonly PartRecord[],overlays:readonly OverlayEntry[]):{parts:PartRecord[];rejected:{partId:string;error:string}[]}{
 const map=new Map(parts.map(p=>[p.identity.id,p as unknown]));
 const rejected:{partId:string;error:string}[]=[];
 for(const o of overlays){
  const cur=map.get(o.partId);
  if(!cur){rejected.push({partId:o.partId,error:'unknown part'});continue;}
  try{
   const next=PartRecordSchema.parse(applySpecPatch(cur,o.ops,{allowServerOwned:true}));
   if(next.identity.id!==o.partId)throw new Error('identity.id must not change');
   map.set(o.partId,next);
  }catch(e){rejected.push({partId:o.partId,error:e instanceof Error?e.message:String(e)});}
 }
 return{parts:[...map.values()] as PartRecord[],rejected};
}
