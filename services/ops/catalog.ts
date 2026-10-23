/**
 * Verified catalog service (plan §6 M2, A2). Base data = packages/catalog/data/*.json (written by the importer, folded by
 * scripts/catalog-export.ts); this file adds the live layer:
 *  - catalog_overlay: staff edits as ordered JSON-patch ops per part. Merged over the base and validated on every write.
 *  - catalog_proposals: member/agent suggestions. Pending until staff approve (approval writes overlay ops) or reject.
 * Routes (registered by the integrator, see handleCatalog):
 *  staff  /ops/v1/catalog/{parts,parts/:id,parts/:id/overlay,parts/:id/lab-tested,proposals,proposals/:id/{approve,reject}}
 *  member /ops/v1/member/catalog/{search,get,propose}
 * Writes need the CSRF header (x-aiot-staff / x-aiot-member). Text from members is data, never instructions.
 */
import {randomUUID} from 'node:crypto';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {PartRecordSchema,PartSlug,ProvenanceSchema,verifiedShare,type PartRecord} from '../../packages/catalog/schema.js';
import {applySpecPatch,PatchError,SpecPatchSchema,type SpecPatch} from '../../packages/pro-contract/patch.js';
import type {LabTask} from '../../packages/ops-contract/index.js';
import {cookieValue} from './http.js';
import {MEMBER_COOKIE} from './members.js';
import {STAFF_COOKIE} from './staff.js';
import type {Ops,OpsCall,OpsResult} from './ops.js';

export const CATALOG_DATA_DIR=fileURLToPath(new URL('../../packages/catalog/data/',import.meta.url));
const STALE_MS=365*86_400_000;
const MAX_PENDING_PER_MEMBER=20;
/** Proposals may not touch identity, the lab badge, or the schema version. Staff edits may touch everything but the id. */
const PROPOSAL_DENY=/^\/(identity\/id|labTested|schemaVersion)(\/|$)/;
const STAFF_DENY=/^\/(identity\/id|schemaVersion)(\/|$)/;

/** Reads every data file: either an array of parts or `{parts:[...]}`. Invalid records are skipped (the importer's tests own that). */
export function loadBaseParts(dir=CATALOG_DATA_DIR):PartRecord[]{
 if(!existsSync(dir))return[];
 const out:PartRecord[]=[];
 for(const f of readdirSync(dir).filter(n=>n.endsWith('.json')).sort()){
  const j=JSON.parse(readFileSync(dir+f,'utf8'));
  for(const p of Array.isArray(j)?j:Array.isArray(j?.parts)?j.parts:[]){const r=PartRecordSchema.safeParse(p);if(r.success)out.push(r.data);}
 }
 return out;
}

export interface CatalogDeps{base:()=>PartRecord[]}
type Who={kind:'member'|'staff';id:string;subject:string};
type OverlayRow={id:number;part_id:string;ops:string;by:string;at:string};
type ProposalRow={id:string;part_id:string;ops:string;reason:string;source:string;status:string;by:string;at:string;decided_by:string|null;decided_at:string|null;note:string|null};

const staffPatch=z.object({ops:SpecPatchSchema,note:z.string().max(300).optional()}).strict();
const labTestedBody=z.object({schoolId:z.string().min(1).max(64).optional(),taskId:z.string().min(1).max(64)}).strict();
const proposeBody=z.object({partId:PartSlug,ops:SpecPatchSchema.max(20),reason:z.string().trim().min(3).max(600),source:z.string().trim().min(3).max(300)}).strict();
const approveBody=z.object({note:z.string().max(300).optional(),confidence:z.enum(['high','medium','low']).optional()}).strict().default({});
const rejectBody=z.object({note:z.string().max(300).optional()}).strict().default({});

const err=(status:number,error:string,extra:Record<string,unknown>={}):OpsResult=>({status,data:{error,...extra}});
const stale=(rec:PartRecord,now:number)=>{let old=false;const walk=(x:unknown)=>{if(!x||typeof x!=='object'||old)return;const o=x as Record<string,unknown>;if('v' in o&&ProvenanceSchema.safeParse(o.p).success){if(now-Date.parse((o.p as {at:string}).at)>STALE_MS)old=true;return;}for(const v of Object.values(o))walk(v);};walk(rec);return old;};
const lowConfidence=(rec:PartRecord)=>{let low=false;const walk=(x:unknown)=>{if(!x||typeof x!=='object'||low)return;const o=x as Record<string,unknown>;if('v' in o&&ProvenanceSchema.safeParse(o.p).success){if((o.p as {confidence:string}).confidence==='low')low=true;return;}for(const v of Object.values(o))walk(v);};walk(rec);return low;};
/** True when every leaf is imported/lab/staff verified (no 'import' only). "Unverified" = nothing beyond the importer touched it. */
const unverified=(rec:PartRecord)=>{let n=0,human=0;const walk=(x:unknown)=>{if(!x||typeof x!=='object')return;const o=x as Record<string,unknown>;if('v' in o&&ProvenanceSchema.safeParse(o.p).success){n++;if((o.p as {verifiedBy:string}).verifiedBy!=='import')human++;return;}for(const v of Object.values(o))walk(v);};walk(rec);return n>0&&human===0;};

export class Catalog{
 private db;
 readonly deps:CatalogDeps;
 constructor(readonly ops:Ops,deps:Partial<CatalogDeps>={}){
  this.db=ops.store.db;this.deps={base:deps.base??(()=>loadBaseParts())};
  this.db.exec(`CREATE TABLE IF NOT EXISTS catalog_overlay(id INTEGER PRIMARY KEY AUTOINCREMENT,part_id TEXT NOT NULL,ops TEXT NOT NULL,by TEXT NOT NULL,at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS catalog_overlay_part ON catalog_overlay(part_id,id);
CREATE TABLE IF NOT EXISTS catalog_proposals(id TEXT PRIMARY KEY,part_id TEXT NOT NULL,ops TEXT NOT NULL,reason TEXT NOT NULL,source TEXT NOT NULL,status TEXT NOT NULL,by TEXT NOT NULL,at TEXT NOT NULL,decided_by TEXT,decided_at TEXT,note TEXT);
CREATE INDEX IF NOT EXISTS catalog_proposals_status ON catalog_proposals(status,at);`);
 }
 private now(){return this.ops.clock();}
 private overlayRows(partId?:string){return(partId?this.db.prepare('SELECT * FROM catalog_overlay WHERE part_id=? ORDER BY id').all(partId):this.db.prepare('SELECT * FROM catalog_overlay ORDER BY id').all())as unknown as OverlayRow[];}

 /** Base part with its overlay ops applied in order. A row that no longer validates is skipped, so one bad edit cannot hide a part. */
 private merged(base:PartRecord,rows:OverlayRow[]):PartRecord{
  let cur:PartRecord=base;
  for(const r of rows){
   try{const next=PartRecordSchema.safeParse(applySpecPatch(cur,JSON.parse(r.ops)as SpecPatch,{allowServerOwned:true}));if(next.success)cur=next.data;}catch{/* skip */}
  }
  return cur;
 }
 parts():{part:PartRecord;overlay:boolean}[]{
  const rows=this.overlayRows(),by=new Map<string,OverlayRow[]>();
  for(const r of rows)(by.get(r.part_id)??by.set(r.part_id,[]).get(r.part_id)!).push(r);
  return this.deps.base().map(b=>({part:this.merged(b,by.get(b.identity.id)??[]),overlay:by.has(b.identity.id)}));
 }
 part(id:string){return this.parts().find(p=>p.part.identity.id===id);}

 private summary(p:PartRecord,overlay:boolean,now:number){
  return{id:p.identity.id,name:p.identity.name.v,kind:p.identity.kind.v,mpn:p.identity.mpn?.v??null,verifiedShare:Math.round(verifiedShare(p)*100)/100,
   lowConfidence:lowConfidence(p),stale:stale(p,now),unverified:unverified(p),overlay,labTested:p.labTested??null};
 }
 private search(q:string,kind:string|undefined,limit:number){
  const terms=q.toLowerCase().split(/\s+/).filter(Boolean),now=this.now().getTime();
  const rows=this.parts().filter(x=>!kind||x.part.identity.kind.v===kind).map(x=>{
   const p=x.part,hay={id:p.identity.id,name:p.identity.name.v.toLowerCase(),kind:p.identity.kind.v,mpn:(p.identity.mpn?.v??'').toLowerCase(),proto:p.protocols.supported.v.join(' ')};
   let score=terms.length?0:1;
   for(const t of terms){if(hay.id===t)score+=10;else if(hay.id.includes(t))score+=4;if(hay.name.includes(t))score+=3;if(hay.mpn&&hay.mpn.includes(t))score+=3;if(hay.kind===t)score+=2;if(hay.proto.includes(t))score+=1;}
   return{score,x};
  }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.x.part.identity.id.localeCompare(b.x.part.identity.id)).slice(0,limit);
  return rows.map(r=>({...this.summary(r.x.part,r.x.overlay,now),untrusted:{summary:r.x.part.untrusted.summary.v}}));
 }

 private who(call:OpsCall):Who|undefined{
  const c=call.headers?.cookie;
  const m=this.ops.members.session(cookieValue(c,MEMBER_COOKIE));if(m)return{kind:'member',id:m.id,subject:'member:'+m.id};
  const s=this.ops.staff.session(cookieValue(c,STAFF_COOKIE));if(s)return{kind:'staff',id:s.id,subject:'staff:'+s.id};
  return undefined;
 }
 private csrfOk(call:OpsCall,who:Who){return call.headers?.[who.kind==='staff'?'x-aiot-staff':'x-aiot-member']==='1';}

 /** Validates `ops` against a part (current merged state) and returns the new record or the problem. */
 private tryApply(cur:PartRecord,ops:SpecPatch,deny:RegExp):{ok:true;rec:PartRecord}|{ok:false;error:string}{
  for(const o of ops)if(deny.test(o.path))return{ok:false,error:`Path ${o.path} cannot be changed this way`};
  try{
   const r=PartRecordSchema.safeParse(applySpecPatch(cur,ops,{allowServerOwned:true}));
   return r.success?{ok:true,rec:r.data}:{ok:false,error:'The edit makes the part invalid: '+r.error.issues.slice(0,3).map(i=>i.path.join('/')+' '+i.message).join('; ')};
  }catch(e){return{ok:false,error:e instanceof PatchError?e.message:'Bad patch'};}
 }
 private addOverlay(partId:string,ops:SpecPatch,by:string){this.db.prepare('INSERT INTO catalog_overlay(part_id,ops,by,at) VALUES(?,?,?,?)').run(partId,JSON.stringify(ops),by,this.now().toISOString());}
 private proposal(r:ProposalRow){return{id:r.id,partId:r.part_id,ops:JSON.parse(r.ops),reason:r.reason,source:r.source,status:r.status,by:r.by,at:r.at,decidedBy:r.decided_by,decidedAt:r.decided_at,note:r.note};}

 /** Shared by the member route and the Pro agent's catalog_propose: same checks, same pending cap. */
 submitProposal(subject:string,input:{partId:string;ops:SpecPatch;reason:string;source:string}):{ok:true;id:string}|{ok:false;error:string}{
  const p=proposeBody.safeParse(input);if(!p.success)return{ok:false,error:'Invalid proposal: '+p.error.issues.map(i=>i.path.join('.')+' '+i.message).join('; ')};
  const hit=this.part(p.data.partId);if(!hit)return{ok:false,error:'Part not found'};
  const t=this.tryApply(hit.part,p.data.ops,PROPOSAL_DENY);if(!t.ok)return{ok:false,error:t.error};
  const pending=(this.db.prepare("SELECT COUNT(*) n FROM catalog_proposals WHERE by=? AND status='pending'").get(subject)as {n:number}).n;
  if(pending>=MAX_PENDING_PER_MEMBER)return{ok:false,error:'Too many proposals are waiting for review'};
  const id=randomUUID();
  this.db.prepare('INSERT INTO catalog_proposals(id,part_id,ops,reason,source,status,by,at) VALUES(?,?,?,?,?,?,?,?)').run(id,p.data.partId,JSON.stringify(p.data.ops),p.data.reason,p.data.source,'pending',subject,this.now().toISOString());
  return{ok:true,id};
 }

 async handle(call:OpsCall):Promise<OpsResult>{
  const {method,body}=call;
  const [path,qs='']=call.path.split('?');const query=new URLSearchParams(qs);
  const who=this.who(call);
  if(!who)return err(401,'Sign in first');
  const write=method!=='GET';
  if(write&&!this.csrfOk(call,who))return err(403,`Missing X-AIoT-${who.kind==='staff'?'Staff':'Member'} header`);

  // ----- member surface (staff may use it too) -----
  const mm=/^\/ops\/v1\/member\/catalog\/(search|get|propose)$/.exec(path);
  if(mm){
   if(mm[1]==='search'&&method==='GET'){
    const limit=Math.min(Math.max(Number(query.get('limit')??10)||10,1),25);
    return{status:200,data:{parts:this.search((query.get('q')??'').slice(0,200),query.get('kind')?.slice(0,32)||undefined,limit)}};
   }
   if(mm[1]==='get'&&method==='GET'){
    const id=PartSlug.safeParse(query.get('id'));const hit=id.success?this.part(id.data):undefined;
    return hit?{status:200,data:{part:hit.part,summary:this.summary(hit.part,hit.overlay,this.now().getTime())}}:err(404,'Part not found');
   }
   if(mm[1]==='propose'&&method==='POST'){
    const p=proposeBody.safeParse(body);if(!p.success)return err(400,'Invalid proposal',{issues:p.error.issues.map(i=>i.path.join('.')+' '+i.message)});
    const hit=this.part(p.data.partId);if(!hit)return err(404,'Part not found');
    const t=this.tryApply(hit.part,p.data.ops,PROPOSAL_DENY);if(!t.ok)return err(422,t.error);
    const pending=(this.db.prepare("SELECT COUNT(*) n FROM catalog_proposals WHERE by=? AND status='pending'").get(who.subject)as {n:number}).n;
    if(pending>=MAX_PENDING_PER_MEMBER)return err(429,'Too many proposals are waiting for review');
    const id=randomUUID();
    this.db.prepare('INSERT INTO catalog_proposals(id,part_id,ops,reason,source,status,by,at) VALUES(?,?,?,?,?,?,?,?)').run(id,p.data.partId,JSON.stringify(p.data.ops),p.data.reason,p.data.source,'pending',who.subject,this.now().toISOString());
    return{status:201,data:{id,status:'pending'}};
   }
   return err(405,'Method not allowed');
  }

  // ----- staff surface -----
  if(who.kind!=='staff')return err(403,'Staff only');
  const m=/^\/ops\/v1\/catalog\/(parts|proposals)(?:\/([^/]+))?(?:\/([a-z-]+))?$/.exec(path);
  if(!m)return err(404,'Not found');
  const [,res,id,sub]=m;
  if(res==='parts'){
   if(!id&&method==='GET'){
    const now=this.now().getTime();let items=this.parts().map(x=>this.summary(x.part,x.overlay,now));
    const f=query.get('filter');
    if(f==='low')items=items.filter(i=>i.lowConfidence);else if(f==='stale')items=items.filter(i=>i.stale);else if(f==='unverified')items=items.filter(i=>i.unverified);
    // ?full=1: whole records with provenance for the review page (staff only, about 0.6 MB).
    if(query.get('full')==='1'){const keep=new Set(items.map(i=>i.id));return{status:200,data:{parts:this.parts().map(x=>x.part).filter(p=>keep.has(p.identity.id))}};}
    return{status:200,data:{parts:items}};
   }
   const hit=id?this.part(id):undefined;if(!hit)return err(404,'Part not found');
   if(!sub&&method==='GET')return{status:200,data:{part:hit.part,summary:this.summary(hit.part,hit.overlay,this.now().getTime()),overlay:this.overlayRows(id).map(r=>({id:r.id,ops:JSON.parse(r.ops),by:r.by,at:r.at}))}};
   if(!sub&&method==='PATCH'){
    const p=staffPatch.safeParse(body);if(!p.success)return err(400,'Invalid edit',{issues:p.error.issues.map(i=>i.path.join('.')+' '+i.message)});
    const t=this.tryApply(hit.part,p.data.ops,STAFF_DENY);if(!t.ok)return err(422,t.error);
    this.addOverlay(id!,p.data.ops,who.subject);
    return{status:200,data:{part:t.rec}};
   }
   if(sub==='overlay'&&method==='DELETE'){this.db.prepare('DELETE FROM catalog_overlay WHERE part_id=?').run(id!);return{status:200,data:{ok:true}};}
   if(sub==='lab-tested'&&(method==='PUT'||method==='DELETE')){
    if(method==='DELETE'){
     const t=this.tryApply(hit.part,[{op:'remove',path:'/labTested'}],/^$/);
     if(!hit.part.labTested)return{status:200,data:{ok:true}};
     if(!t.ok)return err(422,t.error);this.addOverlay(id!,[{op:'remove',path:'/labTested'}],who.subject);return{status:200,data:{ok:true}};
    }
    const p=labTestedBody.safeParse(body);if(!p.success)return err(400,'taskId is required');
    const task=this.ops.store.get<LabTask>('tasks',p.data.taskId);
    if(!task||(p.data.schoolId&&task.labId!==p.data.schoolId)||(task.status!=='verified'&&task.status!=='paid'))return err(422,'The badge needs a Lab Mitra task that AIoT has verified for that school');
    const at=this.now().toISOString().slice(0,10),value={schoolId:task.labId,taskId:p.data.taskId,at,by:who.subject};
    const t=this.tryApply(hit.part,[{op:'add',path:'/labTested',value}],/^$/);if(!t.ok)return err(422,t.error);
    this.addOverlay(id!,[{op:'add',path:'/labTested',value}],who.subject);
    return{status:200,data:{part:t.rec}};
   }
   return err(405,'Method not allowed');
  }
  // proposals
  if(!id&&method==='GET'){
   const st=query.get('status');const rows=(st?this.db.prepare('SELECT * FROM catalog_proposals WHERE status=? ORDER BY at DESC').all(st):this.db.prepare('SELECT * FROM catalog_proposals ORDER BY at DESC').all())as unknown as ProposalRow[];
   return{status:200,data:{proposals:rows.map(r=>this.proposal(r))}};
  }
  const row=id?this.db.prepare('SELECT * FROM catalog_proposals WHERE id=?').get(id)as unknown as ProposalRow|undefined:undefined;
  if(!row)return err(404,'Proposal not found');
  if(!sub&&method==='GET')return{status:200,data:{proposal:this.proposal(row)}};
  if((sub==='approve'||sub==='reject')&&method==='POST'){
   if(row.status!=='pending')return err(409,'Already decided');
   const at=this.now().toISOString();
   if(sub==='reject'){
    const b=rejectBody.safeParse(body);if(!b.success)return err(400,'Invalid body');
    this.db.prepare("UPDATE catalog_proposals SET status='rejected',decided_by=?,decided_at=?,note=? WHERE id=?").run(who.subject,at,b.data.note??null,row.id);
    return{status:200,data:{status:'rejected'}};
   }
   const b=approveBody.safeParse(body);if(!b.success)return err(400,'Invalid body');
   const hit=this.part(row.part_id);if(!hit)return err(404,'Part no longer exists');
   // Approved leaves are re-stamped: staff is the verifier, the proposal source is kept, confidence defaults to medium (never above what staff chose).
   const stamped=(JSON.parse(row.ops)as SpecPatch).map(o=>{
    if(o.op==='remove'||!o.value||typeof o.value!=='object'||!('p' in (o.value as object)))return o;
    return{...o,value:{...(o.value as object),p:{source:row.source.slice(0,300),verifiedBy:'staff:'+who.id,at:at.slice(0,10),confidence:b.data.confidence??'medium'}}};
   })as SpecPatch;
   const t=this.tryApply(hit.part,stamped,STAFF_DENY);if(!t.ok)return err(422,t.error);
   this.ops.store.tx(()=>{
    this.addOverlay(row.part_id,stamped,who.subject);
    this.db.prepare("UPDATE catalog_proposals SET status='approved',decided_by=?,decided_at=?,note=? WHERE id=?").run(who.subject,at,b.data.note??null,row.id);
   });
   return{status:200,data:{status:'approved',part:t.rec}};
  }
  return err(405,'Method not allowed');
 }
}

const instances=new WeakMap<Ops,Catalog>();
/** Route target for `/ops/v1/catalog/*` and `/ops/v1/member/catalog/*` (before the generic `/ops/v1/member/` branch). */
export const handleCatalog=(ops:Ops,call:OpsCall,deps?:Partial<CatalogDeps>)=>{let c=instances.get(ops);if(!c){c=new Catalog(ops,deps);instances.set(ops,c);}return c.handle(call);};
export const catalogFor=(ops:Ops,deps?:Partial<CatalogDeps>)=>{let c=instances.get(ops);if(!c){c=new Catalog(ops,deps);instances.set(ops,c);}return c;};
