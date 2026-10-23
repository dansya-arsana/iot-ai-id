/**
 * The save_revision verification gate (ADR 012 D15, plan M3-C).
 * Pure orchestration: the real verifiers (D1/D2 impls, the sandbox compiler) are injected, so this file does no I/O itself.
 * Rules:
 *  - The model never sets `verification`; the gate rebuilds it whole on every save.
 *  - An item is `verified` only when a verifier ran and passed. No verifier, or a pending compile, gives `unverified` with a reason.
 *  - `inputsSha` hashes the verifier inputs. An unchanged item keeps its previous stamp (same `at`); a changed one is re-verified.
 *  - Failed items are listed and counted; the revision is still saved so the model can repair it.
 */
import {createHash} from 'node:crypto';
import type {SystemSpec,ProNode,ItemVerification} from '../pro-contract/system-spec.js';

export type GateIssue={code:string;severity:'error'|'warning'|'info';en:string;id:string;ref?:string};
export type GateConfidence='high'|'medium'|'low';
export type CompileOutcome={status:'compiled'|'linted'|'failed'|'pending';diagnostics:{line:number;message:string;severity:'error'|'warning'}[];pinsReferenced:SystemSpec['code'][number]['pinsReferenced'];sha256:string;toolchain:string;bytes?:number};
/** Each verifier returns issues, or null when it is unavailable (then the item stays unverified). */
export interface GateVerifiers{
 netlist?(node:ProNode):Promise<GateIssue[]|null>|GateIssue[]|null;
 compat?(node:ProNode):Promise<GateIssue[]|null>|GateIssue[]|null;
 power?(node:ProNode,spec:SystemSpec):Promise<GateIssue[]|null>|GateIssue[]|null;
 link?(link:SystemSpec['links'][number],spec:SystemSpec):Promise<{status:'ok'|'warning'|'error';issues:GateIssue[]}|null>|{status:'ok'|'warning'|'error';issues:GateIssue[]}|null;
 compile?(file:SystemSpec['code'][number],node:ProNode|undefined):Promise<CompileOutcome|null>|CompileOutcome|null;
 /** Lowest catalog confidence among a node's part kinds, when known. */
 confidence?(kind:string):GateConfidence|undefined;
}
export type GateResult={
 spec:SystemSpec;verification:Record<string,ItemVerification>;
 counts:{verified:number;unverified:number;failed:number};
 unverified:{path:string;reason:string}[];
 checks:SystemSpec['checks'];
};

const canon=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x as Record<string,unknown>).sort(([a],[b])=>a<b?-1:a>b?1:0)):x);
export const sha256=(s:string)=>createHash('sha256').update(s).digest('hex');
const cut=(s:string,n=300)=>s.length>n?s.slice(0,n-1)+'…':s;
const checkCode=(c:string)=>{const s=c.toLowerCase().replace(/[^a-z0-9.-]+/g,'-').replace(/^[^a-z]+/,'x');return (s.length<2?s+'x':s).slice(0,48);};
const LOW='verified against low-confidence data';

const mergeChecks=(a:SystemSpec['checks'],b:SystemSpec['checks'])=>{const seen=new Set<string>();return [...a,...b].filter(c=>{const k=canon(c);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,300);};

export async function verifySpec(spec:SystemSpec,prev:Record<string,ItemVerification>|undefined,v:GateVerifiers,now:Date=new Date()):Promise<GateResult>{
 const out:Record<string,ItemVerification>={},checks:SystemSpec['checks']=[],unverified:{path:string;reason:string}[]=[];
 const counts={verified:0,unverified:0,failed:0};
 const at=now.toISOString();
 const nodeById=new Map(spec.nodes.map(n=>[n.id,n]));
 const stamp=(path:string,by:string,input:unknown,status:ItemVerification['status'],note?:string)=>{
  const inputsSha=sha256(canon([by,input]));
  const old=prev?.[path];
  // Keep the earlier stamp only when nothing changed; a changed input is re-stamped.
  const item:ItemVerification=old&&old.by===by&&old.inputsSha===inputsSha&&old.status===status&&old.note===(note?cut(note):undefined)?old:{status,by,at,inputsSha,...(note?{note:cut(note)}:{})};
  out[path]=item;counts[status]++;
  if(status!=='verified')unverified.push({path,reason:item.note??'not verified'});
  return item;
 };
 const lowNote=(n:ProNode)=>v.confidence&&n.parts.some(p=>v.confidence?.(p.kind)==='low')?LOW:undefined;
 const addChecks=(issues:GateIssue[],scope:SystemSpec['checks'][number]['scope'])=>{
  for(const i of issues){if(i.severity==='info'&&checks.length>=100)continue;if(checks.length>=299)break;
   checks.push({code:checkCode(i.code),severity:i.severity,scope,en:cut(i.en),id:cut(i.id),...(i.ref?{ref:i.ref.slice(0,60)}:{})});}
 };
 const fail=(issues:GateIssue[])=>issues.some(i=>i.severity==='error');
 const reasonOf=(issues:GateIssue[])=>cut(issues.filter(i=>i.severity==='error').map(i=>i.en).join('; ')||'verifier reported an error');
 const run=async<T>(f:()=>Promise<T>|T):Promise<{ok:true;value:T}|{ok:false;why:string}>=>{try{return{ok:true,value:await f()};}catch(e){return{ok:false,why:'verifier crashed: '+cut(String((e as Error).message??e),120)};}};

 for(const [ni,n] of spec.nodes.entries()){
  const base=`/nodes/${ni}`,low=lowNote(n);
  // wires: validate_netlist
  const netIn={board:n.board,parts:n.parts.map(p=>[p.id,p.kind,p.qty]),pins:n.pins,wires:n.wires.map(w=>({...w,id:undefined}))};
  const net=v.netlist?await run(()=>v.netlist!(n)):undefined;
  const netIssues=net&&net.ok?net.value:null;
  if(netIssues)addChecks(netIssues.filter(i=>i.severity!=='info'),{nodeId:n.id});
  n.wires.forEach((w,wi)=>{
   const path=`${base}/wires/${wi}`;
   if(!v.netlist)return void stamp(path,'validate_netlist',netIn,'unverified','no netlist verifier is available');
   if(!net?.ok)return void stamp(path,'validate_netlist',netIn,'unverified',net?net.why:'no netlist verifier');
   if(!netIssues)return void stamp(path,'validate_netlist',netIn,'unverified','netlist verifier is unavailable');
   const own=netIssues.filter(i=>i.severity==='error'&&(i.ref===w.id||!i.ref));
   if(own.length)stamp(path,'validate_netlist',netIn,'failed',reasonOf(own));else stamp(path,'validate_netlist',netIn,'verified',low);
  });
  // parts: check_compatibility
  if(n.parts.length){
   const path=`${base}/parts`,inp={board:n.board,parts:n.parts.map(p=>[p.kind,p.qty]),supplyV:n.power.supplyV};
   if(!v.compat)stamp(path,'check_compatibility',inp,'unverified','no compatibility verifier is available');
   else{
    const r=await run(()=>v.compat!(n));
    if(!r.ok)stamp(path,'check_compatibility',inp,'unverified',r.why);
    else if(!r.value)stamp(path,'check_compatibility',inp,'unverified','compatibility verifier is unavailable');
    else{addChecks(r.value.filter(i=>i.severity!=='info'),{nodeId:n.id});stamp(path,'check_compatibility',inp,fail(r.value)?'failed':'verified',fail(r.value)?reasonOf(r.value):low);}
   }
  }
  // power: solve_power
  {
   const path=`/power/${n.id}`,inp={source:n.power.source,supplyV:n.power.supplyV,parts:n.parts.map(p=>[p.kind,p.qty]),sample:n.sampleEveryS,battery:n.power.battery,solar:n.power.solar,sun:spec.site.peakSunHours};
   if(!v.power)stamp(path,'solve_power',inp,'unverified','no power verifier is available');
   else{
    const r=await run(()=>v.power!(n,spec));
    if(!r.ok)stamp(path,'solve_power',inp,'unverified',r.why);
    else if(!r.value)stamp(path,'solve_power',inp,'unverified','power verifier is unavailable');
    else{addChecks(r.value.filter(i=>i.severity!=='info'),{nodeId:n.id});stamp(path,'solve_power',inp,fail(r.value)?'failed':'verified',fail(r.value)?reasonOf(r.value):low);}
   }
  }
 }
 for(const [li,l] of spec.links.entries()){
  const path=`/links/${li}`,inp={from:l.from,to:l.to,d:l.distanceM,params:l.params};
  if(!v.link){stamp(path,'estimate_link',inp,'unverified','no link verifier is available');continue;}
  const r=await run(()=>v.link!(l,spec));
  if(!r.ok)stamp(path,'estimate_link',inp,'unverified',r.why);
  else if(!r.value)stamp(path,'estimate_link',inp,'unverified','link verifier is unavailable');
  else{
   addChecks(r.value.issues.filter(i=>i.severity!=='info'),{linkId:l.id});
   if(r.value.status==='error'||fail(r.value.issues))stamp(path,'estimate_link',inp,'failed',reasonOf(r.value.issues));
   else stamp(path,'estimate_link',inp,'verified',r.value.status==='warning'?'link margin is a warning (estimate)':undefined);
  }
 }
 const code=spec.code.map(c=>({...c}));
 for(const [ci,c] of code.entries()){
  const path=`/code/${ci}`,inp={board:c.board,filename:c.filename,content:c.content};
  if(!v.compile){stamp(path,'compile_code',inp,'unverified','no compiler is available');continue;}
  const r=await run(()=>v.compile!(c,nodeById.get(c.nodeId)));
  if(!r.ok){stamp(path,'compile_code',inp,'unverified',r.why);continue;}
  const o=r.value;
  if(!o){stamp(path,'compile_code',inp,'unverified','compiler is unavailable');continue;}
  // The result is the only source of verify and pinsReferenced; whatever the model sent is replaced.
  c.verify={status:o.status,toolchain:o.toolchain.slice(0,160)||'unknown',at,sha256:o.sha256,...(o.bytes?{bytes:o.bytes}:{}),diagnostics:o.diagnostics.slice(0,20).map(d=>({line:d.line,message:cut(d.message,400),severity:d.severity}))};
  c.pinsReferenced=o.pinsReferenced;
  if(o.status==='failed'){addChecks([{code:'code.compile',severity:'error',en:cut(`${c.filename} did not compile`),id:cut(`${c.filename} gagal dikompilasi`)}],{nodeId:c.nodeId,fileId:c.id});stamp(path,'compile_code',inp,'failed',o.diagnostics.find(d=>d.severity==='error')?.message??'compile failed');}
  else if(o.status==='pending')stamp(path,'compile_code',inp,'unverified','sandbox compile is pending');
  else stamp(path,'compile_code',inp,'verified',o.status==='linted'?'linted only; not compiled':undefined);
 }
 return {spec:{...spec,code,verification:out,checks:mergeChecks(spec.checks,checks)} as SystemSpec,verification:out,counts,unverified,checks:mergeChecks(spec.checks,checks)};
}
