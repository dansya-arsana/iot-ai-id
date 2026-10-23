/** Deterministic part search: token scoring over id, name, aliases, kind, protocols, summary. Pure; overlay-merged parts go in. */
import type {PartRecord,Confidence} from './schema.js';
import {verifiedShare,CONFIDENCE} from './schema.js';

export interface SearchQuery{
 q?:string;kind?:string;protocol?:string;i2cAddress?:number;outdoor?:boolean;labTested?:boolean;
 /** Keep parts whose verified share (leaves at high confidence) is at least this. */
 minVerifiedShare?:number;minConfidence?:Confidence;limit?:number;
}
export interface SearchHit{id:string;name:string;kind:string;protocols:string[];score:number;verifiedShare:number;labTested:boolean}

const tok=(s:string):string[]=>s.toLowerCase().split(/[^a-z0-9]+/).filter(t=>t.length>0);
const rank=(c:Confidence)=>CONFIDENCE.length-CONFIDENCE.indexOf(c);

/** Lowest leaf confidence of identity, electrical and pins (what a wiring tool relies on). */
export function floorConfidence(p:PartRecord):Confidence{
 const cs=[p.identity.name.p.confidence,p.electrical.supplyV.p.confidence,p.electrical.currentMa.p.confidence,...p.pins.map(x=>x.p.confidence)];
 return cs.reduce((m,c)=>rank(c)<rank(m)?c:m,'high' as Confidence);
}

export function searchParts(parts:readonly PartRecord[],query:SearchQuery={},aliases:Record<string,string[]>={}):SearchHit[]{
 const terms=tok(query.q??'');
 const hits:SearchHit[]=[];
 for(const p of parts){
  const id=p.identity.id;
  if(query.kind&&p.identity.kind.v!==query.kind)continue;
  if(query.protocol&&!p.protocols.supported.v.includes(query.protocol as never))continue;
  if(query.i2cAddress!==undefined&&!p.protocols.i2cAddresses?.v.includes(query.i2cAddress))continue;
  if(query.outdoor!==undefined&&p.environment.outdoor.v!==query.outdoor)continue;
  if(query.labTested&&!p.labTested)continue;
  const share=verifiedShare(p);
  if(query.minVerifiedShare!==undefined&&share<query.minVerifiedShare)continue;
  if(query.minConfidence&&rank(floorConfidence(p))<rank(query.minConfidence))continue;
  let score=0;
  if(terms.length){
   const nameT=new Set(tok(p.identity.name.v)),idT=new Set(tok(id)),alT=new Set((aliases[id]??[]).flatMap(tok));
   const kindT=new Set(tok(p.identity.kind.v)),protoT=new Set(p.protocols.supported.v);
   const sumT=new Set([...tok(p.untrusted.summary.v.en),...tok(p.untrusted.summary.v.id)]);
   for(const t of terms){
    let s=0;
    if(id===t)s=Math.max(s,12);
    if(idT.has(t))s=Math.max(s,8);
    if(nameT.has(t))s=Math.max(s,8);
    if(alT.has(t))s=Math.max(s,6);
    if(kindT.has(t)||protoT.has(t as never))s=Math.max(s,4);
    if(sumT.has(t))s=Math.max(s,2);
    if(!s&&t.length>=3&&(id.includes(t)||p.identity.name.v.toLowerCase().includes(t)))s=3;
    if(!s)continue;
    score+=s;
   }
   if(!score)continue;
  }else score=1;
  if(p.labTested)score+=1;
  hits.push({id,name:p.identity.name.v,kind:p.identity.kind.v,protocols:[...p.protocols.supported.v],score,verifiedShare:Math.round(share*1000)/1000,labTested:!!p.labTested});
 }
 hits.sort((a,b)=>b.score-a.score||b.verifiedShare-a.verifiedShare||a.id.localeCompare(b.id));
 return hits.slice(0,Math.min(Math.max(query.limit??10,1),50));
}
