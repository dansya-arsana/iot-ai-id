/**
 * Pro tool dispatch (ADR 012, plan M3-C): one entry point for the agent loop and MCP loopback.
 * Order of checks: known tool -> not client-only -> access -> project ownership -> input schema -> rate limit -> run -> untrusted wrap -> output schema.
 * Implementations (D1/D2/E) and storage (B) are injected; this file owns authz, limits, wrapping and the save_revision flow.
 * Keys, SQL and the filesystem are not touched here.
 */
import {getTool,type ProToolName} from '../../packages/pro-tools/registry.js';
import {verifySpec,sha256,type GateVerifiers} from '../../packages/pro-tools/verify-spec.js';
import {applySpecPatch,splitServerOwned,EMPTY_SPEC_DOC,PatchError} from '../../packages/pro-contract/patch.js';
import {getSpecSchema,prefillServerFields,describeIssues} from '../../packages/pro-tools/impl/spec-schema.js';
import {SystemSpecSchema,PRO_LIMITS,SYSTEM_SPEC_VERSION,type SystemSpec,type ItemVerification} from '../../packages/pro-contract/system-spec.js';

export type ToolCtx={
 subject:string;
 /** Member holds the pro grant (or staff). */
 granted:boolean;
 /** Request came from the desktop local host (member-local tools). */
 local:boolean;
 /** Written into meta by save_revision. */
 meta:{lang:'en'|'id';provider:string;model:string;catalogVersion:string};
};
export type ToolError={code:string;message:string;status:number;details?:unknown};
export type ToolResult={ok:true;output:unknown;ms:number}|{ok:false;error:ToolError;ms:number};
export type Impl=(input:never,ctx:ToolCtx)=>unknown|Promise<unknown>;
export type StoredRevision={revision:number;spec:SystemSpec|Record<string,unknown>;verification?:Record<string,ItemVerification>;/** Not verified; never shown as verified and ignored by the Build Sheet. */draft?:boolean};
export interface ProToolStore{
 /** True when the project belongs to the subject. */
 owns(subject:string,projectId:string):boolean;
 head(projectId:string):StoredRevision|undefined;
 revision(projectId:string,n:number):StoredRevision|undefined;
 /** Atomic insert of revision `n`; false when `n` is already taken (lost the race). */
 insert(projectId:string,row:{revision:number;spec:SystemSpec;specSha:string;reason:string;subject:string;model:string;draft?:boolean}):boolean;
 propose?(subject:string,input:unknown):{proposalId:string};
}
export interface ProToolDeps{
 impls?:Partial<Record<ProToolName,Impl>>;
 store?:ProToolStore;
 verifiers?:GateVerifiers;
 /** D1/D2 derivation on the patched doc: W-numbers, checklist ids, BOM totals, checks. Runs before schema validation and the gate. */
 derive?:(doc:Record<string,unknown>,ctx:ToolCtx)=>Record<string,unknown>|Promise<Record<string,unknown>>;
 clock?:()=>Date;
 limits?:Partial<Record<string,Limit>>;
}
export type Limit={max:number;windowMs:number};
/** Per tool and subject. Pure tools are cheap; sandbox and write tools are tight. */
export const DEFAULT_LIMITS:Record<string,Limit>={
 compile_code:{max:20,windowMs:600_000},save_revision:{max:30,windowMs:600_000},catalog_propose:{max:10,windowMs:3_600_000},render:{max:60,windowMs:600_000},
 default:{max:400,windowMs:600_000},
};
export const MAX_OUTPUT_BYTES=100_000;
const err=(code:string,message:string,status:number,details?:unknown):{ok:false;error:ToolError}=>({ok:false,error:{code,message,status,...(details!==undefined?{details}:{})}});
// eslint-disable-next-line no-control-regex
const CTRL=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const BAD_KEYS=new Set(['__proto__','constructor','prototype']);

/** Untrusted text: control characters stripped, length capped, and always inside {untrusted}. */
export const wrapUntrusted=(v:unknown,max=4096):{untrusted:string}=>{
 if(v&&typeof v==='object'&&'untrusted' in v&&typeof (v as {untrusted:unknown}).untrusted==='string')return {untrusted:(v as {untrusted:string}).untrusted.replace(CTRL,'').slice(0,max)};
 return {untrusted:String(v??'').replace(CTRL,'').slice(0,max)};
};
const isObj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Force the untrusted channels of the three text-bearing tools into {untrusted}; the output schema then verifies it. */
export function wrapOutput(name:string,out:unknown):unknown{
 if(!isObj(out))return out;
 if(name==='catalog_search'&&Array.isArray(out.items))return {...out,items:out.items.map(i=>isObj(i)?{...i,summary:wrapUntrusted(i.summary,300)}:i)};
 if(name==='serial_read'&&Array.isArray(out.lines))return {...out,lines:out.lines.map(l=>isObj(l)?{...l,text:wrapUntrusted(l.text,400)}:l)};
 if(name==='telemetry_read'&&Array.isArray(out.messages))return {...out,messages:out.messages.map(m=>isObj(m)?{...m,payload:wrapUntrusted(typeof m.payload==='string'?m.payload:JSON.stringify(m.payload)??'',4096)}:m)};
 return out;
}

/** RFC 6901 read. Returns undefined for a missing path; rejects prototype keys. */
export function readPointer(doc:unknown,path:string):{found:boolean;value?:unknown}{
 if(path===''||path==='/')return {found:true,value:doc};
 if(!path.startsWith('/'))return {found:false};
 let cur:unknown=doc;
 for(const raw of path.slice(1).split('/')){
  const k=raw.replace(/~1/g,'/').replace(/~0/g,'~');
  if(BAD_KEYS.has(k))return {found:false};
  if(Array.isArray(cur)){if(!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=cur.length)return {found:false};cur=cur[Number(k)];}
  else if(isObj(cur)&&Object.hasOwn(cur,k))cur=cur[k];
  else return {found:false};
 }
 return {found:true,value:cur};
}

export class ProToolDispatcher{
 private hits=new Map<string,number[]>();
 constructor(readonly deps:ProToolDeps={}){}
 private clock(){return (this.deps.clock??(()=>new Date()))();}
 private take(subject:string,tool:string):boolean{
  const lim=this.deps.limits?.[tool]??DEFAULT_LIMITS[tool]??this.deps.limits?.default??DEFAULT_LIMITS.default;
  const now=this.clock().getTime(),key=subject+'\0'+tool;
  const recent=(this.hits.get(key)??[]).filter(t=>now-t<lim.windowMs);
  if(recent.length>=lim.max){this.hits.set(key,recent);return false;}
  recent.push(now);this.hits.set(key,recent);
  if(this.hits.size>20_000)this.hits.clear();
  return true;
 }

 async call(ctx:ToolCtx,name:string,raw:unknown):Promise<ToolResult>{
  const t0=Date.now(),done=(r:{ok:true;output:unknown}|{ok:false;error:ToolError}):ToolResult=>({...r,ms:Date.now()-t0}) as ToolResult;
  const tool=getTool(name);
  if(!tool)return done(err('unknown_tool','Unknown tool.',404));
  if(tool.runsAt==='client'||tool.mcp===false)return done(err('client_only','This tool runs in the desktop app, not on the server.',400));
  if(!ctx.granted)return done(err('forbidden','The Pro grant is required.',403));
  if(tool.access==='member-local'&&!ctx.local)return done(err('local_only','This tool works only from the desktop app.',403));
  const parsed=tool.input.safeParse(raw??{});
  if(!parsed.success)return done(err('bad_input',parsed.error.issues.slice(0,5).map(i=>`${i.path.join('.')||'input'}: ${i.message}`).join('; '),400));
  const input=parsed.data as Record<string,unknown>;
  if(typeof input.projectId==='string'){
   // Same answer for "not yours" and "does not exist": no probing of other members' projects.
   if(!this.deps.store||!this.deps.store.owns(ctx.subject,input.projectId))return done(err('not_found','Project not found.',404));
  }
  if(!this.take(ctx.subject,name))return done(err('rate_limited','Too many calls to this tool. Wait a few minutes.',429));
  let out:unknown;
  try{
   const impl=this.deps.impls?.[name as ProToolName]??(name==='get_spec_schema'?getSpecSchema:undefined);
   if(impl)out=await (impl as (i:unknown,c:ToolCtx)=>unknown)(input,ctx);
   else if(name==='save_revision'||name==='get_revision'||name==='catalog_propose'){
    const r=name==='save_revision'?await this.saveRevision(ctx,input):name==='get_revision'?this.getRevision(input):this.propose(ctx,input);
    if(!r.ok)return done(r);
    out=r.output;
   }
   else return done(err('not_available','This tool is not available yet.',503));
  }catch(e){
   if(e instanceof PatchError)return done(err('patch_'+e.code,e.message,400,{opIndex:e.opIndex}));
   return done(err('tool_failed','The tool failed.',500));
  }
  out=wrapOutput(name,out);
  const checked=tool.output.safeParse(out);
  if(!checked.success)return done(err('output_invalid','The tool returned an invalid result.',502,checked.error.issues.slice(0,3).map(i=>i.path.join('.')+': '+i.message)));
  if(JSON.stringify(checked.data).length>MAX_OUTPUT_BYTES)return done(err('output_too_large','The result is too large; narrow the request.',502));
  return done({ok:true,output:checked.data});
 }

 private propose(ctx:ToolCtx,input:Record<string,unknown>){
  if(!this.deps.store?.propose)return err('not_available','Proposals are not available yet.',503);
  const r=this.deps.store.propose(ctx.subject,input);
  return {ok:true as const,output:{proposalId:r.proposalId,status:'pending' as const}};
 }

 private getRevision(input:Record<string,unknown>){
  const store=this.deps.store!,pid=input.projectId as string;
  const rev=typeof input.revision==='number'?store.revision(pid,input.revision):store.head(pid);
  if(!rev)return err('not_found','Revision not found.',404);
  const path=typeof input.path==='string'?input.path:undefined;
  let spec:unknown=rev.spec;
  if(path){const r=readPointer(rev.spec,path);if(!r.found)return err('bad_path','Path not found in this revision.',404);spec=r.value;}
  const ver=rev.verification??(isObj(rev.spec)&&isObj(rev.spec.verification)?rev.spec.verification as Record<string,ItemVerification>:undefined);
  const verification=ver&&path?Object.fromEntries(Object.entries(ver).filter(([k])=>k===path||k.startsWith(path+'/'))):ver;
  return {ok:true as const,output:{revision:rev.revision,spec,...(rev.draft?{draft:true}:{}),...(verification?{verification}:{})}};
 }

 /** apply patch -> derive -> schema -> gate -> insert r+1. Nothing is stored unless the whole chain passes the schema. */
 private async saveRevision(ctx:ToolCtx,input:Record<string,unknown>){
  const store=this.deps.store,pid=input.projectId as string;
  if(!store)return err('not_available','Storage is not available.',503);
  const head=store.head(pid),headRev=head?.revision??0;
  if(input.baseRevision!==headRev)return err('stale_revision',`baseRevision is ${String(input.baseRevision)} but the head is ${headRev}. Read the head with get_revision and rebase the patch.`,409,{headRevision:headRev});
  const draft=input.draft===true;
  // Server-owned paths are IGNORED with a warning (the model must not be punished for guessing a derived path).
  const split=splitServerOwned(input.ops as never);
  const warnings=split.ignored.map(i=>({path:i.path.slice(0,300),message:i.message.slice(0,400)}));
  if(!split.ops.length)return err('patch_empty',`Every op touched a server-owned path and was ignored: ${split.ignored.map(i=>i.path).join(', ').slice(0,300)}. Send the parent object whole (for example /nodes/0/power) or other fields.`,422,{warnings});
  let doc=applySpecPatch(head?.spec??EMPTY_SPEC_DOC(),split.ops) as Record<string,unknown>;
  // Server-owned: anything the model could have placed there is rebuilt.
  doc.verification={};doc.checks=[];
  prefillServerFields(doc,this.clock().toISOString());
  if(this.deps.derive)doc=await this.deps.derive(doc,ctx);
  const m=isObj(doc.meta)?doc.meta:{};
  const usage=isObj(m.usage)?m.usage:undefined;
  doc.meta={...ctx.meta,version:SYSTEM_SPEC_VERSION,generatedAt:this.clock().toISOString(),...(typeof m.promptSha256==='string'?{promptSha256:m.promptSha256}:{}),...(usage?{usage}:{})};
  if(JSON.stringify(doc).length>PRO_LIMITS.specBytes)return err('spec_too_large','The spec is larger than 512 KB.',400);
  const v=SystemSpecSchema.safeParse(doc);
  const headRev1=headRev+1;
  if(draft){
   // A draft is stored as is (no gate, no verification), so progress survives and the next patch builds on it.
   const issues=v.success?[]:describeIssues(v.error.issues as never);
   const stored={...doc,verification:{},checks:[]} as unknown as SystemSpec;
   const dsha=sha256(JSON.stringify(stored));
   if(!store.insert(pid,{revision:headRev1,spec:stored,specSha:dsha,reason:input.reason as string,subject:ctx.subject,model:ctx.meta.model,draft:true}))
    return err('stale_revision','Another save won the race. Read the head with get_revision and retry.',409);
   return {ok:true as const,output:{revision:headRev1,specSha:dsha,draft:true,verification:{verified:0,unverified:[],failed:0},checks:[],...(warnings.length?{warnings}:{}),issues}};
  }
  if(!v.success){
   const issues=describeIssues(v.error.issues as never);
   return err('spec_invalid',`The spec does not pass the schema: ${issues.length} issue(s), all listed. Fix them in one patch and save again (draft:true keeps progress).${warnings.length?` Ignored server-owned paths: ${warnings.map(w=>w.path).join(', ').slice(0,200)}.`:''}`,422,issues);
  }
  const prev=head?.verification??(isObj(head?.spec)&&isObj((head?.spec as Record<string,unknown>).verification)?(head?.spec as {verification:Record<string,ItemVerification>}).verification:undefined);
  const gate=await verifySpec(v.data,prev,this.deps.verifiers??{},this.clock());
  const final=SystemSpecSchema.safeParse(gate.spec);
  if(!final.success)return err('spec_invalid','The verified spec does not pass the schema.',422,describeIssues(final.error.issues as never,20));
  const specSha=sha256(JSON.stringify(final.data));
  const revision=headRev1;
  if(!store.insert(pid,{revision,spec:final.data,specSha,reason:input.reason as string,subject:ctx.subject,model:ctx.meta.model}))
   return err('stale_revision','Another save won the race. Read the head with get_revision and retry.',409);
  return {ok:true as const,output:{revision,specSha,verification:{verified:gate.counts.verified,unverified:gate.unverified.slice(0,200).map(u=>({path:u.path,reason:u.reason.slice(0,300)})),failed:gate.counts.failed},checks:gate.checks,...(warnings.length?{warnings}:{})}};
 }
}
