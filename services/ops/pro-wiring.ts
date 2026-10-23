/**
 * Pro composition root (ADR 012): connects the dispatcher (pro-tools.ts), the pure tool implementations (packages/pro-tools/impl),
 * the sandbox compiler (pro-compile.ts), the parts catalog (catalog.ts) and the skills to the agent loop (pro.ts, pro-agent.ts).
 * Nothing here decides policy: authz, limits, wrapping and the save_revision flow live in ProToolDispatcher.
 */
import type {Ops} from './ops.js';
import {Pro,proFor,hasPro,type ProDeps} from './pro.js';
import {type ProToolHost,type ToolRun} from './pro-agent.js';
import {ProToolDispatcher,type Impl,type ProToolStore,type StoredRevision,type ToolCtx as DispatchCtx,type ToolResult} from './pro-tools.js';
import {ProCompiler,DockerProRunner,type ProTarget} from './pro-compile.js';
import {catalogFor} from './catalog.js';
import {searchParts,verifiedShare,type PartRecord} from '../../packages/catalog/index.js';
import {loadSkill,skillIndex} from '../../packages/pro-skills/index.js';
import type {ProToolName} from '../../packages/pro-tools/registry.js';
import type {GateVerifiers,GateIssue} from '../../packages/pro-tools/verify-spec.js';
import type {PartLookup} from '../../packages/pro-tools/impl/common.js';
import {lowestConfidence} from '../../packages/pro-tools/impl/common.js';
import {checkCompatibility,checkNodeCompat} from '../../packages/pro-tools/impl/compatibility.js';
import {allocatePins} from '../../packages/pro-tools/impl/allocate.js';
import {validateNetlist,checkNodeNetlist} from '../../packages/pro-tools/impl/netlist.js';
import {solvePower,checkNodePower} from '../../packages/pro-tools/impl/power.js';
import {estimateLink,checkStoredLink} from '../../packages/pro-tools/impl/link.js';
import {siteClimate,ClimateError} from '../../packages/pro-tools/impl/climate.js';
import {priceBom,buildBom} from '../../packages/pro-tools/impl/bom.js';
import {runChecks} from '../../packages/pro-tools/impl/checks.js';
import {buildChecklist} from '../../packages/pro-tools/impl/checklist.js';
import {buildTestPlan} from '../../packages/pro-tools/impl/testplan.js';
import type {SystemSpec} from '../../packages/pro-contract/system-spec.js';

export interface ProWiringOptions extends ProDeps{
 /** Parts source; default is the catalog service (base data plus staff overlay). */
 lookup?:PartLookup;parts?:()=>PartRecord[];catalogVersion?:string;
 /** `false` leaves compile_code unavailable (tests); default builds the Docker sandbox compiler. */
 compiler?:ProCompiler|false;
 verifiers?:GateVerifiers;
 derive?:ConstructorParameters<typeof ProToolDispatcher>[0] extends infer D?D extends {derive?:infer F}?F:never:never;
 impls?:Partial<Record<ProToolName,Impl>>;
 dispatcher?:ProToolDispatcher;
}

const issue=(i:{code:string;severity:'error'|'warning'|'info';en:string;id:string;ref?:string}):GateIssue=>({code:i.code,severity:i.severity,en:i.en,id:i.id,...(i.ref?{ref:i.ref}:{})});
const BOARD_TARGET:Record<string,ProTarget|undefined>={'esp32-devkitc':'esp32','esp32-s3-devkitc':'esp32s3',uno:'uno',nano:'nano'};

/** Memoises the merged catalog for a few seconds: parts() applies the overlay on every call. */
function partsMemo(get:()=>PartRecord[],ttlMs=5000){
 let at=0,list:PartRecord[]=[],byId=new Map<string,PartRecord>();
 const fresh=()=>{if(Date.now()-at>ttlMs){list=get();byId=new Map(list.map(p=>[p.identity.id,p]));at=Date.now();}};
 return{list:()=>{fresh();return list;},lookup:((id:string)=>{fresh();return byId.get(id);}) as PartLookup};
}

export function proStore(pro:Pro):ProToolStore{
 const view=(projectId:string,n:number):StoredRevision|undefined=>{
  const v=pro.revisionView(projectId,n);
  return v?{revision:n,spec:v.spec,verification:v.verification,...(v.draft?{draft:true}:{})}:undefined;
 };
 return{
  owns:(subject,projectId)=>!!pro.project(projectId,subject),
  head:projectId=>{
   const r=pro.db.prepare('SELECT head_revision FROM pro_projects WHERE id=?').get(projectId) as {head_revision:number}|undefined;
   return r&&r.head_revision>0?view(projectId,r.head_revision):undefined;
  },
  revision:view,
  insert:(projectId,row)=>pro.insertRevision(projectId,row),
  propose:(subject,input)=>{
   const i=input as {partId?:string;newPart?:unknown;field:string;value:string|number|boolean;sourceUrl:string;note?:string};
   if(!i.partId||!i.field.startsWith('/'))throw new Error('proposal needs partId and a JSON pointer field');
   const r=catalogFor(pro.ops).submitProposal(subject,{partId:i.partId,ops:[{op:'replace',path:i.field.replace(/\/v$/,''),value:{v:i.value,p:{source:i.sourceUrl.slice(0,300),verifiedBy:'import',at:pro.now().toISOString().slice(0,10),confidence:'low'}}}],reason:(i.note??'proposed by the Pro agent').slice(0,600).padEnd(3,'.'),source:i.sourceUrl});
   if(!r.ok)throw new Error(r.error);
   return{proposalId:r.id};
  },
 };
}

/** Default derive: server-owned sections rebuilt from the model's nodes. A partial doc is left to the schema check to reject. */
export function makeDerive(lookup:PartLookup){
 return(doc:Record<string,unknown>):Record<string,unknown>=>{
  const out={...doc};
  try{
   if(Array.isArray(doc.nodes)){
    const b=buildBom({nodes:doc.nodes as SystemSpec['nodes']},lookup);
    out.bom={lines:b.lines,totalIdr:b.totalIdr};
    if(Array.isArray(doc.fields)&&Array.isArray(doc.links)&&Array.isArray(doc.code)){
     const s=out as unknown as SystemSpec;
     out.checklist=buildChecklist(s);out.tests=buildTestPlan(s);
     if(doc.site)out.checks=runChecks(s,lookup);
    }
   }
  }catch{/* leave the doc as is; SystemSpecSchema reports what is missing */}
  return out;
 };
}

export function makeVerifiers(lookup:PartLookup,compiler:ProCompiler|undefined):GateVerifiers{
 return{
  netlist:node=>checkNodeNetlist(node,lookup).map(issue),
  compat:node=>checkNodeCompat(node,lookup).map(issue),
  power:(node,spec)=>checkNodePower(node,spec,lookup).map(issue),
  link:(link,spec)=>{const r=checkStoredLink(link,spec,lookup);return{status:r.status,issues:r.issues.map(issue)};},
  ...(compiler?{compile:async file=>{
   const target:ProTarget|undefined=file.language==='python'?'python':file.language==='micropython'?'micropython':BOARD_TARGET[file.board];
   if(!target)return null;// rpi boards run python only; no verifier means "unverified", never "verified"
   const r=await compiler.compile(target,{name:file.filename,content:file.content});
   return{status:r.status,diagnostics:r.diagnostics,pinsReferenced:r.pinsReferenced as never,sha256:r.sha256,toolchain:r.toolchain};
  }}:{}),
  confidence:kind=>{const p=lookup(kind);return p?lowestConfidence(p):undefined;},
 };
}

export function makeImpls(o:{lookup:PartLookup;parts:()=>PartRecord[];catalogVersion:string;compiler?:ProCompiler;store:ProToolStore}):Partial<Record<ProToolName,Impl>>{
 const {lookup,parts,catalogVersion}=o;
 const badge=(p:PartRecord)=>({testedInLab:!!p.labTested,verifiedShare:Math.round(verifiedShare(p)*100)/100});
 return{
  catalog_search:(i:{q:string;kind?:string;protocol?:string;outdoor?:boolean;testedInLab?:boolean;limit:number})=>{
   const hits=searchParts(parts(),{q:i.q,kind:i.kind,protocol:i.protocol,outdoor:i.outdoor,labTested:i.testedInLab||undefined,limit:i.limit});
   return{items:hits.map(h=>{const p=lookup(h.id)!;return{id:h.id,name:h.name,kind:h.kind,summary:p.untrusted.summary.v.en,badges:badge(p)};}),catalogVersion};
  },
  catalog_get_part:(i:{id:string;fields?:string[]})=>{
   const p=lookup(i.id);if(!p)throw new Error('part not found');
   const part=i.fields?.length?Object.fromEntries(Object.entries(p).filter(([k])=>i.fields!.includes(k))):p;
   return{part,catalogVersion};
  },
  check_compatibility:(i:Parameters<typeof checkCompatibility>[0])=>checkCompatibility(i,lookup),
  allocate_pins:(i:Parameters<typeof allocatePins>[0])=>allocatePins(i,lookup),
  validate_netlist:(i:Parameters<typeof validateNetlist>[0])=>validateNetlist(i,lookup),
  solve_power:(i:Parameters<typeof solvePower>[0])=>solvePower(i,lookup),
  estimate_link:(i:Parameters<typeof estimateLink>[0])=>estimateLink(i,lookup),
  site_climate:(i:Parameters<typeof siteClimate>[0])=>{try{return siteClimate(i);}catch(e){if(e instanceof ClimateError)throw new Error(e.message,{cause:e});throw e;}},
  price_bom:(i:Parameters<typeof priceBom>[0])=>priceBom(i,lookup),
  load_skill:(i:{name:string})=>{const s=loadSkill(i.name);if(!s)throw new Error('skill not found');return{name:s.name,version:s.version,sha256:s.sha256,body:s.body};},
  ...(o.compiler?{compile_code:(i:{target:ProTarget;file:{name:string;content:string}})=>o.compiler!.compile(i.target,i.file)}:{}),
  // Layout checks (overlap, A4 fit) arrive with the 3D and build-sheet views; until then render only opens the view.
  render:(i:{projectId:string;revision:number;view:string})=>({ok:(r=>!!r&&!r.draft)(o.store.revision(i.projectId,i.revision)),viewUrl:`/pro/${i.projectId}?rev=${i.revision}&view=${i.view}`,layoutIssues:[]}),
  // Evidence and telemetry arrive in M7; the checklist is reported from the saved spec, all open.
  evidence_status:(i:{projectId:string;revision?:number})=>{
   const rev=i.revision?o.store.revision(i.projectId,i.revision):o.store.head(i.projectId);
   const list=((rev?.spec as {checklist?:{id:string}[]}|undefined)?.checklist??[]).slice(0,400);
   return{items:list.map(c=>({itemId:c.id,state:'open' as const})),anomalies:[]};
  },
 };
}

const toRun=(r:ToolResult):ToolRun=>r.ok?{ok:true,output:r.output}:{ok:false,output:{error:r.error.code,message:r.error.message,...(r.error.details!==undefined?{details:r.error.details}:{})}};

/** The agent loop's tool host: every tool goes through the dispatcher (grant, ownership, strict input, limits, untrusted wrap, output check). */
export function dispatcherHost(pro:Pro,d:ProToolDispatcher,catalogVersion:string):ProToolHost{
 return{
  async run(ctx,name,input){
   const dctx:DispatchCtx={subject:ctx.subject,granted:true,local:false,meta:{lang:ctx.lang,provider:'anthropic',model:pro.model(),catalogVersion}};
   return toRun(await d.call(dctx,name,input));
  },
 };
}

/** One call from a trusted caller (the owner-token loopback used by the MCP bridge). */
export function callTool(pro:Pro,subject:string,name:string,input:unknown):Promise<ToolResult>{
 const w=wiring.get(pro);if(!w)throw new Error('Pro is not installed');
 return w.dispatcher.call({subject,granted:true,local:false,meta:{lang:'en',provider:'anthropic',model:pro.model(),catalogVersion:w.catalogVersion}},name,input);
}
const wiring=new WeakMap<Pro,{dispatcher:ProToolDispatcher;catalogVersion:string}>();

/** Builds the Pro service for `ops` with the production tools. Idempotent per Ops: the first call wins (as proFor). */
export function installPro(ops:Ops,o:ProWiringOptions={}):Pro{
 if(hasPro(ops))return proFor(ops);
 const cat=catalogFor(ops);
 const memo=o.lookup?undefined:partsMemo(o.parts??(()=>cat.parts().map(x=>x.part)));
 const lookup=o.lookup??memo!.lookup;
 const parts=o.parts??(memo?memo.list:()=>[]);
 const catalogVersion=o.catalogVersion??'import';
 const compiler=o.compiler===false?undefined:o.compiler??new ProCompiler(ops.store.db,new DockerProRunner(),ops.clock);
 // Late-bound: the dispatcher needs the store, the store needs Pro, Pro needs the tool host.
 // eslint-disable-next-line prefer-const -- assigned after the dispatcher that closes over it
 let pro!:Pro;
 const host:ProToolHost={run:(ctx,name,input)=>dispatcherHost(pro,dispatcher,catalogVersion).run(ctx,name,input)};
 const store:ProToolStore={
  owns:(s,p)=>proStore(pro).owns(s,p),head:p=>proStore(pro).head(p),revision:(p,n)=>proStore(pro).revision(p,n),
  insert:(p,r)=>proStore(pro).insert(p,r),propose:(s,i)=>proStore(pro).propose!(s,i),
 };
 const verifiers=o.verifiers??makeVerifiers(lookup,compiler);
 const dispatcher=o.dispatcher??new ProToolDispatcher({store,verifiers,derive:o.derive??makeDerive(lookup),clock:()=>ops.clock(),impls:{...makeImpls({lookup,parts,catalogVersion,compiler,store}),...o.impls}});
 pro=proFor(ops,{tools:host,skills:skillIndex,...o});
 wiring.set(pro,{dispatcher,catalogVersion});
 return pro;
}

/** Route entry for `/ops/v1/member/pro/*` with the production tools installed on first use. */
export const handleProInstalled=(ops:Ops,call:Parameters<Pro['handle']>[0])=>installPro(ops).handle(call);
