/** Provenance leaves of a catalog PartRecord: walk, summarise, and render as badges (plan §6 A3). */
import {Tag} from '../ui';
import {useLang} from '../i18n';
import type {Confidence,Provenance as Prov} from '../../../../packages/catalog/schema';
import {isStale} from './provenance-core';
export {leaves,isStale,isUnverified,summarize,type Leaf,type Summary} from './provenance-core';

const tone=(c:Confidence)=>c==='high'?'ok':c==='medium'?'warn':'error';
export function ConfidenceTag({confidence}:{confidence:Confidence}){const{tr}=useLang();return <Tag tone={tone(confidence)}>{confidence==='high'?tr('high','tinggi'):confidence==='medium'?tr('medium','sedang'):tr('low','rendah')}</Tag>;}
/** One leaf's provenance line: confidence, who verified, when, and the source. */
export function Provenance({p,stale}:{p:Prov;stale?:boolean}){
 const{tr}=useLang();
 return <span className="cat-prov" data-confidence={p.confidence}><ConfidenceTag confidence={p.confidence}/> <small>{p.verifiedBy} · {p.at.slice(0,10)}{stale??isStale(p.at)?` · ${tr('stale','usang')}`:''} · {p.source}</small></span>;
}
