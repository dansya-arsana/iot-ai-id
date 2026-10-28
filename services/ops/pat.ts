/**
 * Personal access tokens for the remote MCP connector (plan claude-connector C1).
 * The value 'aiot_pat_'+base64url(32 bytes) is returned once; only its sha256 is stored. At most 5 live tokens per subject, default expiry 90 days, last_used and revoke.
 * Only members with the pro grant (or staff) may hold or use a token; the grant is re-checked on every use.
 */
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Ops,OpsCall,OpsResult} from './ops.js';

export const PAT_PREFIX='aiot_pat_';
export const PAT_MAX_PER_SUBJECT=5;
export const PAT_DEFAULT_DAYS=90;
export type PatRow={id:string;name:string;createdAt:string;expiresAt:string;lastUsedAt:string|null};
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const DAY=86_400_000;

export class PatStore{
 constructor(readonly ops:Ops){
  this.db.exec(`CREATE TABLE IF NOT EXISTS pro_pats(id TEXT PRIMARY KEY,subject TEXT NOT NULL,name TEXT NOT NULL,token_sha TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,last_used_at TEXT,revoked_at TEXT);
CREATE INDEX IF NOT EXISTS pro_pats_subject ON pro_pats(subject);`);
 }
 get db(){return this.ops.store.db;}
 private now(){return this.ops.clock();}
 private row(r:Record<string,unknown>):PatRow{return{id:String(r.id),name:String(r.name),createdAt:String(r.created_at),expiresAt:String(r.expires_at),lastUsedAt:r.last_used_at==null?null:String(r.last_used_at)};}
 /** Live tokens (not revoked, not expired), newest first. */
 list(subject:string):PatRow[]{
  return (this.db.prepare('SELECT * FROM pro_pats WHERE subject=? AND revoked_at IS NULL AND expires_at>? ORDER BY created_at DESC,rowid DESC').all(subject,this.now().toISOString()) as Record<string,unknown>[]).map(r=>this.row(r));
 }
 create(subject:string,name:string,days=PAT_DEFAULT_DAYS):{ok:true;token:PatRow;value:string}|{ok:false;error:string}{
  if(this.list(subject).length>=PAT_MAX_PER_SUBJECT)return{ok:false,error:`You already have ${PAT_MAX_PER_SUBJECT} tokens. Revoke one first.`};
  const value=PAT_PREFIX+randomBytes(32).toString('base64url'),id=randomUUID(),at=this.now();
  const expiresAt=new Date(at.getTime()+days*DAY).toISOString();
  this.db.prepare('INSERT INTO pro_pats(id,subject,name,token_sha,created_at,expires_at) VALUES(?,?,?,?,?,?)').run(id,subject,name,hash(value),at.toISOString(),expiresAt);
  return{ok:true,token:{id,name,createdAt:at.toISOString(),expiresAt,lastUsedAt:null},value};
 }
 revoke(subject:string,id:string):boolean{
  return Number(this.db.prepare('UPDATE pro_pats SET revoked_at=? WHERE id=? AND subject=? AND revoked_at IS NULL').run(this.now().toISOString(),id,subject).changes)>0;
 }
 /** Token value -> {id,subject} when live; stamps last_used_at. Unknown, revoked and expired answer the same. */
 verify(value:string):{id:string;subject:string}|undefined{
  if(!value.startsWith(PAT_PREFIX)||value.length>120)return undefined;
  const r=this.db.prepare('SELECT id,subject,expires_at,revoked_at FROM pro_pats WHERE token_sha=?').get(hash(value)) as {id:string;subject:string;expires_at:string;revoked_at:string|null}|undefined;
  const now=this.now().toISOString();
  if(!r||r.revoked_at||r.expires_at<=now)return undefined;
  this.db.prepare('UPDATE pro_pats SET last_used_at=? WHERE id=?').run(now,r.id);
  return{id:r.id,subject:r.subject};
 }
}
const stores=new WeakMap<Ops,PatStore>();
export const patFor=(ops:Ops)=>{let s=stores.get(ops);if(!s){s=new PatStore(ops);stores.set(ops,s);}return s;};

/** Still allowed to use Pro: an active member with the pro grant, or active staff. */
export function subjectGranted(ops:Ops,subject:string):boolean{
 const [kind,id]=subject.split(':');
 if(!id)return false;
 if(kind==='member'){const m=ops.members.get(id);return !!m&&m.status==='active'&&(m.grants as readonly string[]).includes('pro');}
 if(kind==='staff'){const s=ops.staff.get(id);return !!s&&s.status==='active';}
 return false;
}

const CreateSchema=z.object({name:z.string().trim().min(1).max(40),days:z.number().int().min(1).max(365).optional()}).strict();
/** `/ops/v1/member/pro/tokens[/:id]` for a caller already checked by Pro.caller (signed in, CSRF header on writes, pro grant). */
export function handlePat(ops:Ops,call:OpsCall,subject:string,rest:string[]):OpsResult{
 const s=patFor(ops);
 if(rest.length===0){
  if(call.method==='GET')return{status:200,data:{tokens:s.list(subject),max:PAT_MAX_PER_SUBJECT}};
  if(call.method==='POST'){
   const p=CreateSchema.safeParse(call.body??{});
   if(!p.success)return{status:400,data:{error:p.error.issues[0]?.message??'Invalid request'}};
   const r=s.create(subject,p.data.name,p.data.days);
   if(!r.ok)return{status:409,data:{error:r.error}};
   return{status:201,data:{token:r.token,value:r.value}};
  }
  return{status:405,data:{error:'Method not allowed'}};
 }
 if(rest.length===1&&call.method==='DELETE')return s.revoke(subject,rest[0]!)?{status:200,data:{ok:true}}:{status:404,data:{error:'Token not found'}};
 return{status:404,data:{error:'Not found'}};
}
