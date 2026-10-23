/** Pure provenance helpers (no React, no CSS) so unit tests can import them. */
import type {Provenance as Prov} from '../../../../packages/catalog/schema';
export type Leaf={path:string;p:Prov};
/** Every {v,p} leaf with its dotted path. */
export function leaves(rec:unknown,base=''):Leaf[]{
 const out:Leaf[]=[];
 const walk=(x:unknown,path:string)=>{
  if(!x||typeof x!=='object')return;
  const o=x as Record<string,unknown>;
  if('v' in o&&'p' in o&&o.p&&typeof o.p==='object'){out.push({path,p:o.p as Prov});return;}
  if(Array.isArray(x))x.forEach((c,i)=>walk(c,`${path}[${i}]`));else for(const[k,v]of Object.entries(o))walk(v,path?`${path}.${k}`:k);
 };
 walk(rec,base);return out;
}
const MONTH_MS=30.44*24*3600*1000;
export const isStale=(at:string,now=Date.now(),months=12)=>{const t=Date.parse(at);return Number.isNaN(t)||now-t>months*MONTH_MS;};
export const isUnverified=(p:Prov)=>p.verifiedBy==='import';
export type Summary={total:number;high:number;medium:number;low:number;stale:number;unverified:number;oldest:string};
export function summarize(rec:unknown,now=Date.now()):Summary{
 const ls=leaves(rec);const s:Summary={total:ls.length,high:0,medium:0,low:0,stale:0,unverified:0,oldest:''};
 for(const{p}of ls){s[p.confidence]++;if(isStale(p.at,now))s.stale++;if(isUnverified(p))s.unverified++;if(!s.oldest||p.at<s.oldest)s.oldest=p.at;}
 return s;
}
export type CatalogFilter='all'|'low'|'stale'|'unverified';
export const matchesFilter=(part:unknown,f:CatalogFilter,now=Date.now())=>{const s=summarize(part,now);return f==='all'||(f==='low'?s.low>0:f==='stale'?s.stale>0:s.unverified>0);};
