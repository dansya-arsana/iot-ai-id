/**
 * Lab AI builder (ADR 011): routes under /ops/v1/lab/ (alias /ops/v1/member/lab/, the only prefix where the member cookie is sent).
 * prompt -> CircuitSpec (LLM via the api container, never here) -> validate (one repair) -> sandboxed compile -> response.
 * Anonymous visitors only get the three precomputed examples. Prompt builds need the `lab-ai` grant or a staff session.
 */
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
 INTERNAL_SPEC_PATH,InternalSpecResponseSchema,LAB_AI_DAILY_GLOBAL_CAP,LAB_AI_DAILY_MEMBER_QUOTA,LAB_AI_EXAMPLE_IDS,LabBuildRequestSchema,LabBuildResponseSchema,LabCompileRequestSchema,
 LabCompileResponseSchema,LabExamplesResponseSchema,LabHistoryResponseSchema,
 type InternalSpecRequest,type LabBuildArtifact,type LabBuildError,type LabQuota,
} from '../../packages/ops-contract/index.js';
import {parseCircuitSpec,type SpecIssue} from '../../apps/web/src/lab/circuit-spec.js';
import {cookieValue} from './http.js';
import {MEMBER_COOKIE} from './members.js';
import {STAFF_COOKIE} from './staff.js';
import {LabCompiler,DockerRunner} from './lab-compile.js';
import {RateLimit,type Ops,type OpsCall,type OpsResult} from './ops.js';

export type LabLlm={
 /** False when no model is reachable (checked before quota is spent). */
 available():boolean;
 call(req:InternalSpecRequest):Promise<{spec:unknown;provider:string;model:string}>;
};
export interface LabDeps{compiler:LabCompiler;llm:LabLlm;examplesDir:string;memberQuota:number;globalCap:number}

const EXAMPLES_DIR=fileURLToPath(new URL('../../apps/web/src/lab/ai/examples/',import.meta.url));
const TZ_MS=7*3_600_000;// quota days follow Jakarta time (UTC+7)
const GLOBAL='global';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const err=(status:number,kind:LabBuildError['kind'],error:string,extra:Partial<LabBuildError>={}):OpsResult=>({status,data:{error,kind,...extra}satisfies LabBuildError});

/** Calls the api container (which owns the provider keys) over the internal docker network. */
export function httpLlm(url=process.env.IOT_API_INTERNAL_URL,token=process.env.OPS_API_INTERNAL_TOKEN,fetcher:typeof fetch=fetch):LabLlm{
 return{
  available:()=>!!url&&!!token,
  async call(req){
   const r=await fetcher(url+INTERNAL_SPEC_PATH,{method:'POST',headers:{'content-type':'application/json','x-aiot-internal':token??''},body:JSON.stringify(req),redirect:'error',signal:AbortSignal.timeout(90_000)});
   if(!r.ok)throw new Error(`The AI service answered ${r.status}`);
   return InternalSpecResponseSchema.parse(await r.json());
  },
 };
}

type Who={kind:'anon'}|{kind:'member'|'staff';id:string;subject:string;granted:boolean};

export class LabAi{
 readonly deps:LabDeps;
 private anonLimit=new RateLimit(60,10*60_000,3000);
 /** Per-person cap on uncached recompiles (each costs up to 20 s of sandbox time). */
 private compileLimit=new RateLimit(6,10*60_000,100_000);
 constructor(readonly ops:Ops,deps:Partial<LabDeps>={}){
  const db=ops.store.db;
  this.deps={
   compiler:deps.compiler??new LabCompiler(db,new DockerRunner(),ops.clock),
   llm:deps.llm??httpLlm(),
   examplesDir:deps.examplesDir??EXAMPLES_DIR,
   memberQuota:deps.memberQuota??Number(process.env.OPS_LAB_AI_MEMBER_QUOTA??LAB_AI_DAILY_MEMBER_QUOTA),
   globalCap:deps.globalCap??Number(process.env.OPS_LAB_AI_GLOBAL_CAP??LAB_AI_DAILY_GLOBAL_CAP),
  };
  db.exec(`CREATE TABLE IF NOT EXISTS lab_usage(day TEXT NOT NULL,subject TEXT NOT NULL,n INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,subject));
CREATE TABLE IF NOT EXISTS lab_history(id TEXT PRIMARY KEY,subject TEXT NOT NULL,at TEXT NOT NULL,prompt TEXT NOT NULL,ok INTEGER NOT NULL,repaired INTEGER NOT NULL,sha256 TEXT,ms INTEGER NOT NULL,detail TEXT);
CREATE INDEX IF NOT EXISTS lab_history_subject ON lab_history(subject,at);
CREATE TABLE IF NOT EXISTS lab_prompt_cache(key TEXT PRIMARY KEY,payload TEXT NOT NULL,at INTEGER NOT NULL);`);
 }
 private get db(){return this.ops.store.db;}
 private now(){return this.ops.clock().getTime();}

 // ----- quota -----
 private day(){return new Date(this.now()+TZ_MS).toISOString().slice(0,10);}
 private resetsAt(){return new Date(Math.floor((this.now()+TZ_MS)/86_400_000+1)*86_400_000-TZ_MS).toISOString();}
 private used(subject:string){return(this.db.prepare('SELECT n FROM lab_usage WHERE day=? AND subject=?').get(this.day(),subject) as {n:number}|undefined)?.n??0;}
 quota(who:Who):LabQuota|undefined{
  if(who.kind==='anon')return undefined;
  return{usedToday:this.used(who.subject),limit:who.kind==='staff'?0:this.deps.memberQuota,resetsAt:this.resetsAt()};
 }
 /** Spends one build. `person:false` (recompile) only counts toward the global cap. Returns false when a cap is reached. */
 private reserve(who:Who&{kind:'member'|'staff'},person:boolean):boolean{
  return this.ops.store.tx(()=>{
   const day=this.day();
   if(this.used(GLOBAL)>=this.deps.globalCap)return false;
   if(person&&who.kind==='member'&&this.used(who.subject)>=this.deps.memberQuota)return false;
   const bump=this.db.prepare('INSERT INTO lab_usage(day,subject,n) VALUES(?,?,1) ON CONFLICT(day,subject) DO UPDATE SET n=n+1');
   bump.run(day,GLOBAL);if(person)bump.run(day,who.subject);
   return true;
  });
 }
 /** Gives back a slot spent before the model ran when the failure was ours (provider down only; invalid designs still cost, they used model calls). */
 private refund(who:Who&{kind:'member'|'staff'}){
  this.ops.store.tx(()=>{
   const day=this.day(),dec=this.db.prepare('UPDATE lab_usage SET n=MAX(n-1,0) WHERE day=? AND subject=?');
   dec.run(day,GLOBAL);dec.run(day,who.subject);
  });
 }
 private quotaError(who:Who&{kind:'member'|'staff'},person:boolean){
  const globalHit=this.used(GLOBAL)>=this.deps.globalCap;
  return err(429,'quota',globalHit||!person?'The lab AI is at its daily limit for everyone. Try again tomorrow.':`You used all ${this.deps.memberQuota} builds for today. The count resets at midnight (Jakarta time).`,{quota:this.quota(who)});
 }

 // ----- access -----
 private who(call:OpsCall):Who{
  const cookie=call.headers?.cookie;
  const m=this.ops.members.session(cookieValue(cookie,MEMBER_COOKIE));
  if(m)return{kind:'member',id:m.id,subject:'member:'+m.id,granted:m.grants.includes('lab-ai')};
  const s=this.ops.staff.session(cookieValue(cookie,STAFF_COOKIE));
  if(s)return{kind:'staff',id:s.id,subject:'staff:'+s.id,granted:true};
  return{kind:'anon'};
 }
 /** Signed-in caller allowed to spend builds, or the error to return. Writes also need the CSRF header the member and staff routes use. */
 private builder(call:OpsCall):(Who&{kind:'member'|'staff'})|OpsResult{
  const who=this.who(call);
  if(who.kind==='anon')return err(401,'forbidden','Sign in to describe your own circuit. The three examples work without an account.');
  const h=call.headers??{};
  if(h[who.kind==='member'?'x-aiot-member':'x-aiot-staff']!=='1')return err(403,'forbidden',`Missing X-AIoT-${who.kind==='member'?'Member':'Staff'} header`);
  if(!who.granted)return err(403,'forbidden','Your account does not include the Lab AI builder yet. Ask AIoT to turn it on.');
  return who;
 }

 // ----- examples -----
 private examples(){
  const items=LAB_AI_EXAMPLE_IDS.map(id=>JSON.parse(readFileSync(this.deps.examplesDir+id+'.json','utf8')));
  return LabExamplesResponseSchema.parse({examples:items});
 }
 private buildExample(exampleId:string):OpsResult{
  const ex=this.examples().examples.find(e=>e.exampleId===exampleId);
  if(!ex)return err(404,'bad-request','Unknown example');
  const r=parseCircuitSpec(ex.spec);
  return{status:200,data:LabBuildResponseSchema.parse({buildId:'ex-'+exampleId,source:'example',spec:ex.spec,build:ex.build,issues:r.issues.filter(i=>i.severity==='warning'),repaired:false})};
 }

 // ----- prompt build -----
 private log(who:{subject:string},id:string,prompt:string,ok:boolean,repaired:boolean,sha256:string|undefined,ms:number,detail?:unknown){
  this.db.prepare('INSERT INTO lab_history(id,subject,at,prompt,ok,repaired,sha256,ms,detail) VALUES(?,?,?,?,?,?,?,?,?)').run(id,who.subject,this.ops.clock().toISOString(),prompt,ok?1:0,repaired?1:0,sha256??null,ms,detail===undefined?null:JSON.stringify(detail).slice(0,4000));
 }
 private async build(call:OpsCall,input:{prompt:string;lang:'en'|'id'}):Promise<OpsResult>{
  const who=this.builder(call);if('status' in who)return who;
  const {prompt,lang}=input,started=Date.now(),id=randomUUID();
  const key=sha(lang+'\0'+prompt.trim().replace(/\s+/g,' ').toLowerCase());
  const row=this.db.prepare('SELECT payload,at FROM lab_prompt_cache WHERE key=?').get(key) as {payload:string;at:number}|undefined;
  if(row&&this.now()-row.at<30*86_400_000){
   const hit=JSON.parse(row.payload) as {spec:unknown;build:LabBuildArtifact;issues:SpecIssue[]};
   this.log(who,id,prompt,true,false,hit.build.sha256,Date.now()-started,{cache:true});
   return{status:200,data:LabBuildResponseSchema.parse({buildId:id,source:'cache',spec:hit.spec,build:hit.build,issues:hit.issues,repaired:false,quota:this.quota(who)})};
  }
  if(!this.deps.llm.available())return err(503,'unavailable','The AI builder is not configured on this server.');
  if(!await this.deps.compiler.available())return err(503,'unavailable','compiler not configured');
  if(!this.reserve(who,true))return this.quotaError(who,true);

  const issuesOf=(r:{issues:SpecIssue[]})=>r.issues.filter(i=>i.severity==='error');
  let repaired=false;
  try{
   let answer=await this.deps.llm.call({prompt,lang});
   let parsed=parseCircuitSpec(answer.spec);
   if(!parsed.ok){
    repaired=true;
    answer=await this.deps.llm.call({prompt,lang,repair:{previous:answer.spec,issues:issuesOf(parsed).slice(0,20).map(i=>({code:i.code,en:i.en,...(i.ref?{ref:i.ref}:{})}))}});
    parsed=parseCircuitSpec(answer.spec);
   }
   if(!parsed.ok){
    this.log(who,id,prompt,false,repaired,undefined,Date.now()-started,{kind:'validation',issues:issuesOf(parsed).map(i=>i.code)});
    return err(422,'validation','The design did not pass the safety and wiring checks, even after a second try. Try describing it differently.',{issues:parsed.issues,quota:this.quota(who)});
   }
   const out=await this.deps.compiler.compile(parsed.spec.sketch.source);
   if(!out.ok){
    this.log(who,id,prompt,false,repaired,undefined,Date.now()-started,{kind:out.kind,diagnostics:out.diagnostics.slice(0,3)});
    return out.kind==='unavailable'?err(503,'unavailable',out.message,{quota:this.quota(who)}):err(422,'compile',out.message,{diagnostics:out.diagnostics,quota:this.quota(who)});
   }
   const warnings=parsed.issues.filter(i=>i.severity==='warning');
   this.db.prepare('INSERT OR REPLACE INTO lab_prompt_cache(key,payload,at) VALUES(?,?,?)').run(key,JSON.stringify({spec:parsed.spec,build:out.build,issues:warnings}),this.now());
   this.log(who,id,prompt,true,repaired,out.build.sha256,Date.now()-started,{provider:answer.provider,model:answer.model});
   return{status:200,data:LabBuildResponseSchema.parse({buildId:id,source:'llm',spec:parsed.spec,build:out.build,issues:warnings,repaired,quota:this.quota(who)})};
  }catch(e){
   this.refund(who);
   console.error('lab-ai build failed:',e instanceof Error?e.message:e);
   this.log(who,id,prompt,false,repaired,undefined,Date.now()-started,{kind:'unavailable'});
   return err(503,'unavailable','The AI service could not answer. Try again in a minute.',{quota:this.quota(who)});
  }
 }

 // ----- router -----
 async handle(call:OpsCall):Promise<OpsResult>{
  const {method,body}=call;
  const resource=call.path.replace(/^\/ops\/v1\/(?:member\/)?lab\//,'');
  if(resource.includes('/')||!resource)return{status:404,data:{error:'Not found'}};
  if(resource==='examples'&&method==='GET'){
   if(!this.anonLimit.take(call.ip))return err(429,'quota','Too many requests. Please wait a few minutes.');
   return{status:200,data:this.examples()};
  }
  if(resource==='history'&&method==='GET'){
   const who=this.who(call);
   if(who.kind==='anon')return err(401,'forbidden','Please sign in.');
   const items=(this.db.prepare('SELECT id,at,prompt,ok,repaired,sha256 FROM lab_history WHERE subject=? ORDER BY at DESC,rowid DESC LIMIT 100').all(who.subject) as {id:string;at:string;prompt:string;ok:number;repaired:number;sha256:string|null}[])
    .map(r=>({buildId:r.id,at:r.at,prompt:r.prompt,ok:!!r.ok,repaired:!!r.repaired,...(r.sha256?{sha256:r.sha256}:{})}));
   return{status:200,data:LabHistoryResponseSchema.parse({items,quota:this.quota(who)})};
  }
  if(resource==='build'&&method==='POST'){
   const p=LabBuildRequestSchema.safeParse(body);
   if(!p.success)return err(400,'bad-request',p.error.issues[0]?.message??'Invalid request');
   if(p.data.exampleId){
    if(!this.anonLimit.take(call.ip))return err(429,'quota','Too many requests. Please wait a few minutes.');
    return this.buildExample(p.data.exampleId);
   }
   return this.build(call,{prompt:p.data.prompt!,lang:p.data.lang});
  }
  if(resource==='compile'&&method==='POST'){
   const who=this.builder(call);if('status' in who)return who;
   const p=LabCompileRequestSchema.safeParse(body);
   if(!p.success)return err(400,'bad-request',p.error.issues[0]?.message??'Invalid request');
   if(!await this.deps.compiler.available())return err(503,'unavailable','compiler not configured');
   // A cached artifact costs nothing; a real compile counts toward the global cap only.
   const known=this.db.prepare('SELECT 1 FROM lab_compile WHERE key=?').get(this.deps.compiler.key(p.data.source));
   if(!known&&!this.compileLimit.take(who.subject))return err(429,'quota','Too many recompiles. Please wait a few minutes.');
   if(!known&&!this.reserve(who,false))return this.quotaError(who,false);
   const out=await this.deps.compiler.compile(p.data.source);
   if(!out.ok)return out.kind==='unavailable'?err(503,'unavailable',out.message):err(422,'compile',out.message,{diagnostics:out.diagnostics});
   return{status:200,data:LabCompileResponseSchema.parse({build:out.build,cached:out.cached})};
  }
  return{status:404,data:{error:'Not found'}};
 }
}
export const handleLab=(ops:Ops,call:OpsCall)=>ops.labAi.handle(call);
