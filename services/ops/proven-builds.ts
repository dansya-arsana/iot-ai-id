/** P5: Proven Builds. A deployed, evidenced Pro project that staff mark publishable becomes a /products entry DRAFT (Product input shape, published:false, evidence summary).
 *  Pure core plus a thin db layer (pro_proven). Never edits /products itself: staff import the draft through the existing products route. */
import {createHash} from 'node:crypto';
import type {ProductInput} from '../../packages/ops-contract/index.js';
export interface BuildFacts{projectId:string;name:string;summary:string;category?:string;vendorId:string;wireless:boolean;nodes:{nodeId:string;proven:boolean;since?:string;parts:string[]}[];tickCount:number;anomalies:number}
const slugify=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'build';
/** Why a build cannot be published yet; empty means eligible. */
export function publishBlockers(f:BuildFacts):string[]{
 const b:string[]=[];
 if(!f.nodes.length)b.push('No nodes in the design');
 for(const n of f.nodes)if(!n.proven)b.push(`Node ${n.nodeId} is not field-proven yet`);
 if(f.anomalies>0)b.push(`${f.anomalies} open anomalies`);
 return b;
}
export function evidenceSummary(f:BuildFacts):string{
 const since=f.nodes.map(n=>n.since??'').sort().pop()?.slice(0,10);
 return `Field-proven: ${f.nodes.filter(n=>n.proven).length}/${f.nodes.length} nodes passed all evidence checks (${f.tickCount} ticks from real telemetry)${since?` as of ${since}`:''}. Parts: ${[...new Set(f.nodes.flatMap(n=>n.parts))].join(', ')||'none'}.`.slice(0,600);
}
/** Product-shaped draft. status 'testing' and published false: staff finish localization before it can go public. */
export function toProductDraft(f:BuildFacts):ProductInput{
 const sum=evidenceSummary(f);
 return{slug:`${slugify(f.name)}-${createHash('sha256').update(f.projectId).digest('hex').slice(0,6)}`,vendorId:f.vendorId,name:f.name.slice(0,120).padEnd(2,' '),category:(f.category??'Proven Build').slice(0,60),summary:(f.summary.length>=10?f.summary:`${f.name}: a field-proven AIoT build`).slice(0,600),wireless:f.wireless,status:'testing',
  localization:{sdppi:'todo',manual_id:'todo',warranty:'todo',service_center:'todo',stock:'todo',pricing:'todo'},evidence:[],testSummary:sum,priceNote:'',published:false};
}
interface Db{prepare(sql:string):{run(...a:unknown[]):unknown;all(...a:unknown[]):unknown[];get(...a:unknown[]):unknown}}
export class ProvenBuilds{
 constructor(private db:Db,private now:()=>Date=()=>new Date()){
  (db as unknown as {exec(s:string):void}).exec('CREATE TABLE IF NOT EXISTS pro_proven(project_id TEXT PRIMARY KEY,publishable INTEGER NOT NULL,by TEXT NOT NULL,note TEXT NOT NULL,at TEXT NOT NULL)');
 }
 /** Staff only (caller checks the role). Refuses while blockers remain; unmarking is always allowed. */
 mark(f:BuildFacts,publishable:boolean,by:string,note=''):{ok:true}|{ok:false;blockers:string[]}{
  const blockers=publishable?publishBlockers(f):[];if(blockers.length)return{ok:false,blockers};
  this.db.prepare('INSERT INTO pro_proven(project_id,publishable,by,note,at) VALUES(?,?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET publishable=excluded.publishable,by=excluded.by,note=excluded.note,at=excluded.at').run(f.projectId,publishable?1:0,by,note.slice(0,300),this.now().toISOString());
  return{ok:true};
 }
 isPublishable(projectId:string):boolean{return !!(this.db.prepare('SELECT publishable FROM pro_proven WHERE project_id=?').get(projectId) as {publishable:number}|undefined)?.publishable;}
 list():{projectId:string;by:string;at:string}[]{return (this.db.prepare('SELECT project_id,by,at FROM pro_proven WHERE publishable=1 ORDER BY at DESC').all() as {project_id:string;by:string;at:string}[]).map(r=>({projectId:r.project_id,by:r.by,at:r.at}));}
 /** The /products draft, only for builds staff marked publishable. */
 draft(f:BuildFacts):ProductInput|undefined{return this.isPublishable(f.projectId)?toProductDraft(f):undefined;}
}
