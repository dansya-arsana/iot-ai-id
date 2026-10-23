/**
 * Pro / Architect service (ADR 012, plan M3-B): tables, project ownership, revisions, usage records and routes.
 * Member routes live under /ops/v1/member/pro/ (the only prefix where the member cookie is sent); admin routes under /ops/v1/admin/pro/.
 * Founder decision: no billing budgets or quotas. Only technical safety (per-turn limits, one global monthly kill-switch)
 * and usage records per member and per project so billing can attach later.
 * The agent loop is in pro-agent.ts. The verification gate is injected (`ProGate`, owned by pro-tools / verify-spec).
 */
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {
 DEFAULT_KILL_SWITCH,KillSwitchSchema,TURN_LIMITS,TurnRequestSchema,UsageRecordSchema,killSwitchTripped,
 type KillSwitch,type UsageRecord,
} from '../../packages/pro-contract/agent.js';
import {EMPTY_SPEC_DOC,PatchError,SpecPatchSchema,applySpecPatch,type SpecPatch} from '../../packages/pro-contract/patch.js';
import {PRO_DEFAULT_MODEL,PRO_MODELS,isProModel} from '../../packages/pro-contract/pricing.js';
import {SystemSpecSchema} from '../../packages/pro-contract/system-spec.js';
import {cookieValue} from './http.js';
import {MEMBER_COOKIE} from './members.js';
import {STAFF_COOKIE} from './staff.js';
import {ProAgent,type ProAgentDeps,type ProStreamHandle,type ToolCtx,type ToolRun} from './pro-agent.js';
import type {Ops,OpsCall,OpsResult} from './ops.js';
import type {Role} from '../../packages/ops-contract/index.js';

// ---------- gate (injected; packages/pro-tools/verify-spec.ts adapts to this) ----------
export type GateResult=
 |{ok:true;/** The spec to store, with server-derived fields and the root `verification` map. */spec:unknown;checks?:unknown[];unverified?:{path:string;reason:string}[]}
 |{ok:false;issues:{path:string;message:string}[]};
export type ProGate=(spec:unknown,ctx:{projectId:string;subject:string;revision:number})=>Promise<GateResult>|GateResult;
/** Fallback gate: the patched document must satisfy SystemSpecSchema. It stamps nothing, so no item is "verified". */
export const schemaGate:ProGate=spec=>{
 const r=SystemSpecSchema.safeParse(spec);
 if(r.success)return{ok:true,spec:r.data,checks:r.data.checks};
 return{ok:false,issues:r.error.issues.slice(0,20).map(i=>({path:'/'+i.path.join('/'),message:i.message}))};
};

export interface ProDeps extends Partial<ProAgentDeps>{
 model?:()=>string;
 gate?:ProGate;
 /** Concurrent running turns: per member and across the server (technical, not billing). */
 maxTurnsPerSubject?:number;maxTurnsGlobal?:number;
 maxProjectsPerSubject?:number;
}

export type ProWho={kind:'member'|'staff';id:string;subject:string;granted:boolean};
const err=(status:number,error:string,extra:Record<string,unknown>={}):OpsResult=>({status,data:{error,...extra}});
const isResult=(x:unknown):x is OpsResult=>!!x&&typeof x==='object'&&'status' in x;

/** Canonical JSON (sorted keys) so spec sha is stable. */
export function canonicalJson(v:unknown):string{
 if(Array.isArray(v))return'['+v.map(canonicalJson).join(',')+']';
 if(v&&typeof v==='object')return'{'+Object.keys(v).sort().filter(k=>(v as Record<string,unknown>)[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonicalJson((v as Record<string,unknown>)[k])).join(',')+'}';
 return JSON.stringify(v)??'null';
}
export const specSha=(spec:unknown)=>createHash('sha256').update(canonicalJson(spec)).digest('hex');

export type ProjectRow={id:string;subject:string;name:string;headRevision:number;createdAt:string;updatedAt:string;archived:boolean};
export type TurnRow={id:string;projectId:string;subject:string;status:'running'|'done';stopReason?:string;model:string;lang:'en'|'id';clientTools:string[];startedAt:string};

export interface SaveInput{baseRevision:number;ops:SpecPatch;reason:string}
export type SaveOutcome=
 |{ok:true;revision:number;specSha:string;verification:{verified:number;unverified:{path:string;reason:string}[];failed:number};checks:unknown[]}
 |{ok:false;status:number;code:string;message:string;issues?:unknown;headRevision?:number};

const DEFAULT_THINKING_BUDGET=8000;

export class Pro{
 readonly agent:ProAgent;readonly gate:ProGate;readonly deps:ProDeps;
 constructor(readonly ops:Ops,deps:ProDeps={}){
  this.deps=deps;this.gate=deps.gate??schemaGate;
  this.db.exec(`CREATE TABLE IF NOT EXISTS pro_projects(id TEXT PRIMARY KEY,subject TEXT NOT NULL,name TEXT NOT NULL,head_revision INTEGER NOT NULL DEFAULT 0,archived INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS pro_projects_subject ON pro_projects(subject,updated_at);
CREATE TABLE IF NOT EXISTS pro_revisions(project_id TEXT NOT NULL,revision INTEGER NOT NULL,spec TEXT NOT NULL,verification TEXT NOT NULL,checks TEXT NOT NULL,spec_sha TEXT NOT NULL,reason TEXT NOT NULL,by TEXT NOT NULL,at TEXT NOT NULL,PRIMARY KEY(project_id,revision));
CREATE TABLE IF NOT EXISTS pro_messages(id INTEGER PRIMARY KEY AUTOINCREMENT,project_id TEXT NOT NULL,turn_id TEXT NOT NULL,role TEXT NOT NULL,content TEXT NOT NULL,at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS pro_messages_project ON pro_messages(project_id,id);
CREATE TABLE IF NOT EXISTS pro_turns(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,subject TEXT NOT NULL,status TEXT NOT NULL,stop_reason TEXT,model TEXT NOT NULL,lang TEXT NOT NULL,client_tools TEXT NOT NULL,tool_calls INTEGER NOT NULL DEFAULT 0,started_at TEXT NOT NULL,ended_at TEXT);
CREATE INDEX IF NOT EXISTS pro_turns_running ON pro_turns(status,subject);
CREATE TABLE IF NOT EXISTS pro_events(turn_id TEXT NOT NULL,seq INTEGER NOT NULL,json TEXT NOT NULL,PRIMARY KEY(turn_id,seq));
CREATE TABLE IF NOT EXISTS pro_usage(turn_id TEXT PRIMARY KEY,subject TEXT NOT NULL,project_id TEXT NOT NULL,model TEXT NOT NULL,input_tokens INTEGER NOT NULL,output_tokens INTEGER NOT NULL,cache_read_tokens INTEGER NOT NULL,cache_write_tokens INTEGER NOT NULL,usd_micros INTEGER,tool_calls INTEGER NOT NULL,month TEXT NOT NULL,at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS pro_usage_month ON pro_usage(month,subject);
CREATE TABLE IF NOT EXISTS pro_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pro_ticks(project_id TEXT NOT NULL,item_id TEXT NOT NULL,state TEXT NOT NULL,by TEXT NOT NULL,evidence_ref TEXT,at TEXT NOT NULL,PRIMARY KEY(project_id,item_id));
CREATE TABLE IF NOT EXISTS pro_evidence(id INTEGER PRIMARY KEY AUTOINCREMENT,project_id TEXT NOT NULL,node_id TEXT,kind TEXT NOT NULL,payload TEXT NOT NULL,at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS pro_evidence_project ON pro_evidence(project_id,id);
CREATE TABLE IF NOT EXISTS pro_artifacts(sha256 TEXT PRIMARY KEY,kind TEXT NOT NULL,bytes BLOB NOT NULL,at TEXT NOT NULL);`);
  this.agent=new ProAgent(this,deps);
  this.agent.recoverOrphans();
 }
 get db(){return this.ops.store.db;}
 now(){return this.ops.clock();}
 month(){return this.now().toISOString().slice(0,7);}

 // ----- settings and the kill-switch -----
 private setting<T>(key:string,schema:z.ZodType<T>):T|undefined{
  const row=this.db.prepare('SELECT value FROM pro_settings WHERE key=?').get(key) as {value:string}|undefined;
  if(!row)return undefined;
  try{const r=schema.safeParse(JSON.parse(row.value));return r.success?r.data:undefined;}catch{return undefined;}
 }
 private putSetting(key:string,value:unknown){this.db.prepare('INSERT INTO pro_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));}
 private remote?:{model:string;killSwitch:KillSwitch;at:number};
 /** Mirrors the api's model and kill-switch (the admin AI settings are the source of truth) for up to 15 s. */
 async refreshRemote(){
  const cfg=this.agent.llm().config;
  if(!cfg||(this.remote&&Date.now()-this.remote.at<15_000))return;
  const c=await cfg.call(this.agent.llm());
  if(c)this.remote={...c,at:Date.now()};
 }
 killSwitch():KillSwitch{return this.remote?.killSwitch??this.setting('kill_switch',KillSwitchSchema)??DEFAULT_KILL_SWITCH;}
 /** Admin's global model: ops setting, then OPS_PRO_MODEL, then the default. Opus is allowed for members. */
 model():string{
  const fromDeps=this.deps.model?.();if(fromDeps&&isProModel(fromDeps))return fromDeps;
  if(this.remote&&isProModel(this.remote.model))return this.remote.model;
  const s=this.setting('model',z.string());if(s&&isProModel(s))return s;
  const e=process.env.OPS_PRO_MODEL;return e&&isProModel(e)?e:PRO_DEFAULT_MODEL;
 }
 thinkingBudget():number{
  const d=this.deps.thinkingBudget?.();if(typeof d==='number')return d;
  return this.setting('thinking_budget',z.number().int().min(0).max(32_000))??DEFAULT_THINKING_BUDGET;
 }
 monthUsdMicros(month=this.month()):number{
  return (this.db.prepare('SELECT COALESCE(SUM(usd_micros),0) AS n FROM pro_usage WHERE month=?').get(month) as {n:number}).n;
 }
 killSwitchState(){const k=this.killSwitch(),used=this.monthUsdMicros();return{...k,usedUsdMicros:used,tripped:killSwitchTripped(k,used)};}

 // ----- projects -----
 private row(r:Record<string,unknown>):ProjectRow{return{id:String(r.id),subject:String(r.subject),name:String(r.name),headRevision:Number(r.head_revision),createdAt:String(r.created_at),updatedAt:String(r.updated_at),archived:!!r.archived};}
 projects(subject:string):ProjectRow[]{return (this.db.prepare('SELECT * FROM pro_projects WHERE subject=? AND archived=0 ORDER BY updated_at DESC,rowid DESC').all(subject) as Record<string,unknown>[]).map(r=>this.row(r));}
 /** A project the subject owns, else undefined (callers answer 404 either way, so ids do not leak). */
 project(id:string,subject:string):ProjectRow|undefined{
  const r=this.db.prepare('SELECT * FROM pro_projects WHERE id=? AND subject=? AND archived=0').get(id,subject) as Record<string,unknown>|undefined;
  return r?this.row(r):undefined;
 }
 createProject(subject:string,name:string):ProjectRow{
  const at=this.now().toISOString(),id=randomUUID();
  this.db.prepare('INSERT INTO pro_projects(id,subject,name,head_revision,archived,created_at,updated_at) VALUES(?,?,?,0,0,?,?)').run(id,subject,name,at,at);
  return{id,subject,name,headRevision:0,createdAt:at,updatedAt:at,archived:false};
 }

 // ----- revisions -----
 revisionRow(projectId:string,revision:number){
  return this.db.prepare('SELECT * FROM pro_revisions WHERE project_id=? AND revision=?').get(projectId,revision) as Record<string,unknown>|undefined;
 }
 revisionView(projectId:string,revision:number){
  const r=this.revisionRow(projectId,revision);if(!r)return undefined;
  return{revision,spec:JSON.parse(String(r.spec)),verification:JSON.parse(String(r.verification)),checks:JSON.parse(String(r.checks)),specSha:String(r.spec_sha),reason:String(r.reason),by:String(r.by),at:String(r.at)};
 }
 revisions(projectId:string){
  return (this.db.prepare('SELECT revision,spec_sha,reason,by,at FROM pro_revisions WHERE project_id=? ORDER BY revision DESC').all(projectId) as Record<string,unknown>[]).map(r=>({revision:Number(r.revision),specSha:String(r.spec_sha),reason:String(r.reason),by:String(r.by),at:String(r.at)}));
 }
 private tally(spec:unknown,extra?:{path:string;reason:string}[]){
  const map=((spec&&typeof spec==='object'&&(spec as {verification?:unknown}).verification)||{}) as Record<string,{status?:string;note?:string}>;
  let verified=0,failed=0;const unverified:{path:string;reason:string}[]=[];
  for(const [path,v] of Object.entries(map)){
   if(v?.status==='verified')verified++;
   else if(v?.status==='failed'){failed++;unverified.push({path,reason:String(v.note??'failed verification').slice(0,300)});}
   else unverified.push({path,reason:String(v?.note??'not verified').slice(0,300)});
  }
  for(const e of extra??[])if(!unverified.some(u=>u.path===e.path))unverified.push({path:e.path,reason:e.reason.slice(0,300)});
  return{verified,unverified:unverified.slice(0,200),failed};
 }
 /** Applies the patch to the head, runs the gate and writes r+1. Never overwrites; stale `baseRevision` gives 409. */
 async saveRevision(projectId:string,subject:string,input:SaveInput,by:string):Promise<SaveOutcome>{
  const project=this.project(projectId,subject);
  if(!project)return{ok:false,status:404,code:'not_found',message:'Project not found'};
  if(input.baseRevision!==project.headRevision)return{ok:false,status:409,code:'stale_revision',message:`baseRevision ${input.baseRevision} is stale; the head is ${project.headRevision}`,headRevision:project.headRevision};
  const ops=SpecPatchSchema.safeParse(input.ops);
  if(!ops.success)return{ok:false,status:400,code:'bad_patch',message:ops.error.issues[0]?.message??'Invalid patch'};
  const head=project.headRevision?this.revisionView(projectId,project.headRevision)?.spec:EMPTY_SPEC_DOC();
  let patched:unknown;
  try{patched=applySpecPatch(head,ops.data);}
  catch(e){if(e instanceof PatchError)return{ok:false,status:422,code:'patch_'+e.code,message:e.message,...(e.opIndex!==undefined?{issues:[{opIndex:e.opIndex}]}:{})};throw e;}
  const revision=project.headRevision+1;
  const gated=await this.gate(patched,{projectId,subject,revision});
  if(!gated.ok)return{ok:false,status:422,code:'gate_failed',message:'The design did not pass the verification gate. Nothing was saved.',issues:gated.issues.slice(0,20)};
  const verification=this.tally(gated.spec,gated.unverified),checks=gated.checks??[];
  const sha=specSha(gated.spec),at=this.now().toISOString();
  const stored=gated.spec&&typeof gated.spec==='object'?(gated.spec as {verification?:unknown}).verification??{}:{};
  const done=this.ops.store.tx(()=>{
   const cur=(this.db.prepare('SELECT head_revision FROM pro_projects WHERE id=?').get(projectId) as {head_revision:number}).head_revision;
   if(cur!==project.headRevision)return false;
   this.db.prepare('INSERT INTO pro_revisions(project_id,revision,spec,verification,checks,spec_sha,reason,by,at) VALUES(?,?,?,?,?,?,?,?,?)').run(projectId,revision,JSON.stringify(gated.spec),JSON.stringify(stored),JSON.stringify(checks),sha,input.reason.slice(0,200),by,at);
   this.db.prepare('UPDATE pro_projects SET head_revision=?,updated_at=? WHERE id=?').run(revision,at,projectId);
   return true;
  });
  if(!done)return{ok:false,status:409,code:'stale_revision',message:'Another save landed first; read the head and retry',headRevision:this.project(projectId,subject)?.headRevision};
  return{ok:true,revision,specSha:sha,verification,checks};
 }

 /** Atomic compare-and-insert of revision `n` for the dispatcher's save_revision. False when `n` is not head+1 (lost the race). */
 insertRevision(projectId:string,row:{revision:number;spec:{verification?:unknown;checks?:unknown};specSha:string;reason:string;subject:string;model:string}):boolean{
  const at=this.now().toISOString();
  return this.ops.store.tx(()=>{
   const cur=(this.db.prepare('SELECT head_revision FROM pro_projects WHERE id=?').get(projectId) as {head_revision:number}|undefined)?.head_revision;
   if(cur===undefined||cur!==row.revision-1)return false;
   this.db.prepare('INSERT INTO pro_revisions(project_id,revision,spec,verification,checks,spec_sha,reason,by,at) VALUES(?,?,?,?,?,?,?,?,?)').run(projectId,row.revision,JSON.stringify(row.spec),JSON.stringify(row.spec.verification??{}),JSON.stringify(row.spec.checks??[]),row.specSha,row.reason.slice(0,200),row.subject,at);
   this.db.prepare('UPDATE pro_projects SET head_revision=?,updated_at=? WHERE id=?').run(row.revision,at,projectId);
   return true;
  });
 }

 // ----- tool surface for the dispatcher (pro-tools.ts) and the default host -----
 /** `save_revision` as a tool: the projectId must be the turn's own project (checked by the loop and again here). */
 async toolSaveRevision(ctx:Pick<ToolCtx,'subject'|'projectId'>,input:{projectId:string;baseRevision:number;ops:SpecPatch;reason:string}):Promise<ToolRun>{
  if(input.projectId!==ctx.projectId)return{ok:false,output:{error:'project_mismatch'}};
  const r=await this.saveRevision(ctx.projectId,ctx.subject,input,ctx.subject);
  if(!r.ok)return{ok:false,output:{error:r.code,message:r.message,...(r.issues?{issues:r.issues}:{}),...(r.headRevision!==undefined?{headRevision:r.headRevision}:{})}};
  return{ok:true,output:{revision:r.revision,specSha:r.specSha,verification:r.verification,checks:r.checks}};
 }
 toolGetRevision(ctx:Pick<ToolCtx,'subject'|'projectId'>,input:{projectId:string;revision?:number;path?:string}):ToolRun{
  if(input.projectId!==ctx.projectId)return{ok:false,output:{error:'project_mismatch'}};
  const p=this.project(ctx.projectId,ctx.subject);if(!p)return{ok:false,output:{error:'not_found'}};
  const n=input.revision??p.headRevision;
  if(n<1)return{ok:false,output:{error:'no_revision',message:'The project has no saved revision yet. Use baseRevision 0.'}};
  const v=this.revisionView(ctx.projectId,n);if(!v)return{ok:false,output:{error:'not_found',message:`No revision ${n}`}};
  let spec:unknown=v.spec;
  if(input.path){
   for(const k of input.path.split('/').slice(1).map(s=>s.replace(/~1/g,'/').replace(/~0/g,'~'))){
    if(spec===null||typeof spec!=='object'||!Object.prototype.hasOwnProperty.call(spec,k))return{ok:false,output:{error:'bad_path',message:`${input.path} not found`}};
    spec=(spec as Record<string,unknown>)[k];
   }
  }
  return{ok:true,output:{revision:n,spec,verification:v.verification}};
 }

 // ----- usage (per member and per project) -----
 /** Upsert by turn id: the loop calls this after every model call, so a crash keeps the spend and the kill-switch sees it live. */
 recordUsage(u:UsageRecord){
  const r=UsageRecordSchema.parse(u);
  this.db.prepare(`INSERT INTO pro_usage(turn_id,subject,project_id,model,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,usd_micros,tool_calls,month,at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(turn_id) DO UPDATE SET model=excluded.model,input_tokens=excluded.input_tokens,output_tokens=excluded.output_tokens,cache_read_tokens=excluded.cache_read_tokens,cache_write_tokens=excluded.cache_write_tokens,usd_micros=excluded.usd_micros,tool_calls=excluded.tool_calls,at=excluded.at`)
   .run(r.turnId,r.subject,r.projectId,r.model,r.inputTokens,r.outputTokens,r.cacheReadTokens,r.cacheWriteTokens,r.usdMicros,r.toolCalls,r.at.slice(0,7),r.at);
 }
 usageSummary(filter:{subject?:string;month?:string}={}){
  const month=filter.month??this.month();
  const agg=(by:'subject'|'project_id')=>(this.db.prepare(`SELECT ${by} AS k,COUNT(*) AS turns,SUM(input_tokens) AS i,SUM(output_tokens) AS o,SUM(cache_read_tokens) AS cr,SUM(cache_write_tokens) AS cw,SUM(usd_micros) AS usd,SUM(CASE WHEN usd_micros IS NULL THEN 1 ELSE 0 END) AS unpriced,SUM(tool_calls) AS calls FROM pro_usage WHERE month=? ${filter.subject?'AND subject=?':''} GROUP BY ${by} ORDER BY k`).all(...[month,...(filter.subject?[filter.subject]:[])]) as Record<string,number|string|null>[])
   .map(r=>({[by==='subject'?'subject':'projectId']:String(r.k),turns:Number(r.turns),inputTokens:Number(r.i??0),outputTokens:Number(r.o??0),cacheReadTokens:Number(r.cr??0),cacheWriteTokens:Number(r.cw??0),usdMicros:r.usd===null?null:Number(r.usd),unpricedTurns:Number(r.unpriced),toolCalls:Number(r.calls??0)}));
  return{month,bySubject:agg('subject'),byProject:agg('project_id')};
 }

 // ----- access -----
 who(call:OpsCall):ProWho|undefined{
  const cookie=call.headers?.cookie;
  const m=this.ops.members.session(cookieValue(cookie,MEMBER_COOKIE));
  if(m)return{kind:'member',id:m.id,subject:'member:'+m.id,granted:(m.grants as readonly string[]).includes('pro')};
  const s=this.ops.staff.session(cookieValue(cookie,STAFF_COOKIE));
  if(s)return{kind:'staff',id:s.id,subject:'staff:'+s.id,granted:true};
  return undefined;
 }
 /** Signed-in caller with the `pro` grant (or staff). Writes also need the CSRF header the member and staff routes use. */
 private caller(call:OpsCall):ProWho|OpsResult{
  const who=this.who(call);
  if(!who)return err(401,'Please sign in.');
  const mutating=call.method!=='GET'&&call.method!=='HEAD';
  const h=call.headers??{};
  if(mutating&&h[who.kind==='member'?'x-aiot-member':'x-aiot-staff']!=='1')return err(403,`Missing X-AIoT-${who.kind==='member'?'Member':'Staff'} header`);
  if(!who.granted)return err(403,'By invitation: your account does not include Pro yet. Ask AIoT to turn it on.');
  return who;
 }

 private runningFor(subject?:string){
  return (this.db.prepare(`SELECT COUNT(*) AS n FROM pro_turns WHERE status='running' ${subject?'AND subject=?':''}`).get(...(subject?[subject]:[])) as {n:number}).n;
 }

 quota(who:ProWho){
  const mine=this.usageSummary({subject:who.subject}).bySubject[0]??null;
  const ks=this.killSwitchState();
  return{limits:{maxToolCalls:TURN_LIMITS.maxToolCalls,maxTurnMs:TURN_LIMITS.maxTurnMs},model:this.model(),models:PRO_MODELS,available:this.agent.available()&&!ks.tripped,paused:ks.tripped,month:this.month(),usage:mine};
 }

 // ----- routes -----
 async handle(call:OpsCall):Promise<OpsResult>{
  const rest=call.path.slice('/ops/v1/member/pro/'.length).split('/');
  if(rest.some(s=>!s))return err(404,'Not found');
  const who=this.caller(call);if(isResult(who))return who;
  const {method}=call,body=call.body;
  const [a,id,b,tid,c,d]=rest;
  if(a==='quota'&&rest.length===1&&method==='GET')return{status:200,data:this.quota(who)};
  if(a!=='projects')return err(404,'Not found');
  if(rest.length===1){
   if(method==='GET')return{status:200,data:{projects:this.projects(who.subject)}};
   if(method==='POST'){
    const p=z.object({name:z.string().trim().min(1).max(80)}).strict().safeParse(body);
    if(!p.success)return err(400,p.error.issues[0]?.message??'Invalid request');
    const max=this.deps.maxProjectsPerSubject??200;
    if(this.projects(who.subject).length>=max)return err(409,`You have ${max} projects. Archive one first.`);
    return{status:201,data:this.createProject(who.subject,p.data.name)};
   }
   return err(405,'Method not allowed');
  }
  const project=this.project(id!,who.subject);
  if(!project)return err(404,'Project not found');
  if(rest.length===2){
   if(method==='GET')return{status:200,data:{project,head:project.headRevision?this.revisionView(project.id,project.headRevision):null}};
   if(method==='DELETE'){this.db.prepare('UPDATE pro_projects SET archived=1,updated_at=? WHERE id=?').run(this.now().toISOString(),project.id);return{status:200,data:{ok:true}};}
   return err(405,'Method not allowed');
  }
  if(b==='revisions'&&method==='GET'){
   if(rest.length===3)return{status:200,data:{revisions:this.revisions(project.id)}};
   if(rest.length===4){const n=Number(tid);const v=Number.isInteger(n)&&n>0?this.revisionView(project.id,n):undefined;return v?{status:200,data:v}:err(404,'Revision not found');}
  }
  if(b==='messages'&&rest.length===3&&method==='GET')return{status:200,data:{messages:this.agent.displayMessages(project.id)}};
  if(b==='turns'&&rest.length===3&&method==='POST')return this.startTurn(who,project,body);
  if(b==='turns'&&tid){
   const turn=this.turn(tid,project.id);
   if(!turn)return err(404,'Turn not found');
   // SSE: .../events (Last-Event-ID header if the transport forwards it) or .../events/:after. JSON long-poll: .../poll/:after (the ops transport passes no query string).
   if(c==='events'&&(rest.length===5||rest.length===6)&&method==='GET')return this.events(turn,afterOf(d??call.headers?.['last-event-id']));
   if(c==='poll'&&rest.length===6&&method==='GET')return this.poll(turn,afterOf(d));
   if(c==='tool-results'&&rest.length===5&&method==='POST'){
    const r=this.agent.submitToolResult(turn.id,body);
    return r.ok?{status:200,data:{ok:true}}:err(r.status,r.error);
   }
   if(c==='cancel'&&rest.length===5&&method==='POST'){this.agent.cancel(turn.id);return{status:200,data:{ok:true}};}
  }
  return err(404,'Not found');
 }

 turn(id:string,projectId:string):TurnRow|undefined{
  const r=this.db.prepare('SELECT * FROM pro_turns WHERE id=? AND project_id=?').get(id,projectId) as Record<string,unknown>|undefined;
  if(!r)return undefined;
  return{id:String(r.id),projectId:String(r.project_id),subject:String(r.subject),status:r.status as 'running'|'done',...(r.stop_reason?{stopReason:String(r.stop_reason)}:{}),model:String(r.model),lang:r.lang as 'en'|'id',clientTools:JSON.parse(String(r.client_tools)),startedAt:String(r.started_at)};
 }

 private async startTurn(who:ProWho,project:ProjectRow,body:unknown):Promise<OpsResult>{
  const p=TurnRequestSchema.safeParse(body);
  if(!p.success)return err(400,p.error.issues[0]?.message??'Invalid request');
  await this.refreshRemote();
  if(!this.agent.available())return err(503,'The Pro agent is not configured on this server.',{kind:'unavailable'});
  if(this.killSwitchState().tripped)return err(503,'The Pro agent is paused for this month by the administrator.',{kind:'kill_switch'});
  const perSubject=this.deps.maxTurnsPerSubject??1,global=this.deps.maxTurnsGlobal??4;
  const running=(this.db.prepare(`SELECT COUNT(*) AS n FROM pro_turns WHERE status='running' AND project_id=?`).get(project.id) as {n:number}).n;
  if(running||this.runningFor(who.subject)>=perSubject)return err(409,'A turn is already running. Wait for it to finish or cancel it.',{kind:'turn_in_progress'});
  if(this.runningFor()>=global)return err(429,'The Pro agent is busy. Try again in a minute.',{kind:'busy'});
  const id=randomUUID(),at=this.now().toISOString(),model=this.model();
  this.ops.store.tx(()=>{
   this.db.prepare(`INSERT INTO pro_turns(id,project_id,subject,status,model,lang,client_tools,tool_calls,started_at) VALUES(?,?,?, 'running',?,?,?,0,?)`).run(id,project.id,who.subject,model,p.data.lang,JSON.stringify(p.data.clientTools),at);
  });
  this.agent.start({id,projectId:project.id,subject:who.subject,model,lang:p.data.lang,clientTools:p.data.clientTools,message:p.data.message});
  return{status:202,data:{turnId:id}};
 }

 private poll=async(turn:TurnRow,after:number):Promise<OpsResult>=>{
  let page=this.agent.eventsAfter(turn.id,after);
  if(!page.events.length&&!page.done)page=await this.agent.waitForEvents(turn.id,after,15_000);
  return{status:200,data:page};
 };
 /** SSE: the result carries a `stream` function for the transport to pipe. */
 private events(turn:TurnRow,after:number):OpsResult{
  const stream:ProStreamHandle=(write,end)=>this.agent.subscribe(turn.id,after,write,end);
  return{status:200,data:null,stream,headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform','x-accel-buffering':'no'}} as OpsResult;
 }
}
const afterOf=(v:string|undefined)=>{const n=Number(v);return v!==undefined&&v!==''&&Number.isInteger(n)&&n>=0?n:-1;};

// ---------- admin ----------
const AdminSettingsSchema=z.object({
 model:z.enum(PRO_MODELS).optional(),
 thinkingBudget:z.number().int().min(0).max(32_000).refine(n=>n===0||n>=1024,{error:'Thinking budget is 0 (off) or at least 1024'}).optional(),
 killSwitch:KillSwitchSchema.optional(),
}).strict().refine(v=>Object.values(v).some(x=>x!==undefined),{error:'Nothing to change'});

/** /ops/v1/admin/pro/{settings,usage}. Owner only: these decide spend. `rest` are the segments after `pro`. */
export function handleProAdmin(ops:Ops,call:OpsCall,role:Role,by:string,rest:string[]):OpsResult{
 const pro=proFor(ops);
 if(role!=='owner')return err(403,'Only the owner manages Pro settings');
 const [what]=rest;
 if(what==='settings'&&rest.length===1){
  if(call.method==='PUT'||call.method==='PATCH'){
   const p=AdminSettingsSchema.safeParse(call.body);
   if(!p.success)return err(400,p.error.issues[0]?.message??'Invalid request');
   if(p.data.model)pro['putSetting']('model',p.data.model);
   if(p.data.thinkingBudget!==undefined)pro['putSetting']('thinking_budget',p.data.thinkingBudget);
   if(p.data.killSwitch)pro['putSetting']('kill_switch',p.data.killSwitch);
   void by;
  }else if(call.method!=='GET')return err(405,'Method not allowed');
  return{status:200,data:{model:pro.model(),models:PRO_MODELS,thinkingBudget:pro.thinkingBudget(),killSwitch:pro.killSwitchState(),limits:TURN_LIMITS}};
 }
 if(what==='usage'&&rest.length===1&&call.method==='GET')return{status:200,data:pro.usageSummary()};
 return err(404,'Not found');
}

// ---------- wiring ----------
const instances=new WeakMap<Ops,Pro>();
/** One Pro per Ops. Tests pass `deps` on the first call to inject the model, gate and tool host; the integrator can do the same at startup. */
export function proFor(ops:Ops,deps?:ProDeps):Pro{
 let p=instances.get(ops);
 if(!p){p=new Pro(ops,deps);instances.set(ops,p);}
 return p;
}
/** Route entry for `/ops/v1/member/pro/*`. A result with a `stream` field is SSE: the transport calls `stream(write,end)` and pipes frames until `end`, calling the returned function on disconnect. */
export const handlePro=(ops:Ops,call:OpsCall):Promise<OpsResult>=>proFor(ops).handle(call);
export const hasPro=(ops:Ops)=>instances.has(ops);
