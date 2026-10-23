/** Pure checks helpers: ordering, grouping, jump target, and the provenance mapping for the popover. */
import type {SystemSpec} from '../../../../../packages/pro-contract/system-spec';
import type {Provenance} from '../../../../../packages/catalog/schema';
import type {DisplayRefs} from '../../../../../packages/pro-contract/refs';

export type Check=SystemSpec['checks'][number];
export type Severity=Check['severity'];
const RANK:Record<Severity,number>={error:0,warning:1,info:2};
export const sortChecks=(cs:Check[])=>cs.map((c,i)=>({c,i})).sort((a,b)=>RANK[a.c.severity]-RANK[b.c.severity]||a.i-b.i).map(x=>x.c);
export const countBySeverity=(cs:Check[])=>({error:cs.filter(c=>c.severity==='error').length,warning:cs.filter(c=>c.severity==='warning').length,info:cs.filter(c=>c.severity==='info').length});

export type Target={kind:'node'|'field'|'link';id:string;view:'3d'|'wiring'|'site'};
/** Where "show in 3D/wiring" goes. File-scoped checks open the node's code, so they have no 3D target but still select the node. */
export function checkTarget(spec:SystemSpec,c:Check):{select:{kind:'node'|'field'|'link';id:string}|null;views:('3d'|'wiring')[]}{
 const s=c.scope;
 if(s.linkId&&spec.links.some(l=>l.id===s.linkId))return{select:{kind:'link',id:s.linkId},views:['3d']};
 if(s.nodeId&&spec.nodes.some(n=>n.id===s.nodeId))return{select:{kind:'node',id:s.nodeId},views:['3d','wiring']};
 if(s.fileId){const f=spec.code.find(x=>x.id===s.fileId);if(f)return{select:{kind:'node',id:f.nodeId},views:['wiring']};}
 if(s.fieldId&&spec.fields.some(f=>f.id===s.fieldId))return{select:{kind:'field',id:s.fieldId},views:['3d']};
 return{select:null,views:[]};
}
export function scopeLabel(c:Check,refs:DisplayRefs){
 const s=c.scope;const out:string[]=[];
 if(s.nodeId)out.push(refs.nodes[s.nodeId]??s.nodeId);
 if(s.fieldId)out.push(refs.fields[s.fieldId]??s.fieldId);
 if(s.linkId)out.push(refs.links[s.linkId]??s.linkId);
 if(s.fileId)out.push(s.fileId);
 return out.join(' · ')||'Whole system';
}
/** JSON pointer of the verified item a check is about, if one exists. */
export function checkPointer(spec:SystemSpec,c:Check):string|null{
 const s=c.scope;
 if(s.linkId){const i=spec.links.findIndex(l=>l.id===s.linkId);return i>=0?`/links/${i}`:null;}
 if(s.fileId){const i=spec.code.findIndex(f=>f.id===s.fileId);return i>=0?`/code/${i}`:null;}
 return null;
}
/** Map a gate stamp onto catalog Provenance so the shared component renders it. Unverified maps to low confidence, never high. */
export function stampToProvenance(v:SystemSpec['verification'][string],checkRef?:string):Provenance{
 return{confidence:v.status==='verified'?'high':'low',verifiedBy:v.by,at:v.at,source:v.note??(checkRef?`ref ${checkRef}`:`inputs ${v.inputsSha.slice(0,8)}`)} as Provenance;
}
