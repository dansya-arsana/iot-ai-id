/** Browser client for the Lab AI builder (ADR 011). Talks only to /ops/v1/lab/*; keys and models never reach the browser. */
import type {LabBuildArtifact,LabBuildError,LabBuildResponse,LabExamplesResponse,LabQuota} from '../../../../../packages/ops-contract';
import type {CircuitSpec} from '../circuit-spec';

export type Copy={en:string;id:string};
export type AiIssue={code:string;severity:'error'|'warning';en:string;id:string;ref?:string};
export type AiBuild={buildId:string;source:'llm'|'example'|'cache';spec:CircuitSpec;build:LabBuildArtifact;issues:AiIssue[];repaired:boolean;quota?:LabQuota};
export type AiExample={exampleId:string;prompt:Copy;spec:CircuitSpec;build:LabBuildArtifact};
export type AiErrorKind=LabBuildError['kind']|'network'|'signin';
export class AiBuildError extends Error{constructor(message:string,readonly kind:AiErrorKind,readonly issues:AiIssue[]=[],readonly diagnostics:{line:number;message:string}[]=[],readonly quota?:LabQuota){super(message);}}

export const AI_PHASES=['designing','checking','compiling','assembling'] as const;
export type AiPhase=typeof AI_PHASES[number];
export const PHASE_COPY:Record<AiPhase,Copy>={
 designing:{en:'Designing circuit',id:'Merancang rangkaian'},
 checking:{en:'Checking wiring',id:'Memeriksa kabel'},
 compiling:{en:'Compiling firmware',id:'Mengompilasi firmware'},
 assembling:{en:'Assembling',id:'Merakit'},
};

/** The member cookie is only sent under /ops/v1/member; the router answers there too. Mutating calls carry the member marker header. */
const BASE='/ops/v1/member/lab';
async function call<T>(path:string,init?:RequestInit,signal?:AbortSignal):Promise<T>{
 let response:Response;
 try{response=await fetch(BASE+path,{credentials:'same-origin',cache:'no-store',signal,...init,headers:{'Content-Type':'application/json',...(init?.method&&init.method!=='GET'?{'x-aiot-member':'1'}:{}),...init?.headers}});}
 catch(e){if((e as Error).name==='AbortError')throw e;throw new AiBuildError('The build service did not answer','network');}
 const data=await response.json().catch(()=>null) as (Partial<LabBuildError>&Record<string,unknown>)|null;
 if(!response.ok){
  const kind:AiErrorKind=response.status===401?'signin':(data?.kind??'unavailable');
  throw new AiBuildError(String(data?.error??'Request failed'),kind,(data?.issues??[]) as AiIssue[],data?.diagnostics??[],data?.quota);
 }
 return data as T;
}

export const aiClient={
 examples:(signal?:AbortSignal)=>call<LabExamplesResponse>('/examples',undefined,signal).then(r=>r.examples as AiExample[]),
 /** Anonymous-safe: the server answers from precomputed specs, no model call. */
 buildExample:(exampleId:string,lang:'en'|'id',signal?:AbortSignal)=>call<LabBuildResponse>('/build',{method:'POST',body:JSON.stringify({exampleId,lang})},signal) as Promise<AiBuild>,
 build:(prompt:string,lang:'en'|'id',signal?:AbortSignal)=>call<LabBuildResponse>('/build',{method:'POST',body:JSON.stringify({prompt,lang})},signal) as Promise<AiBuild>,
};

export function flashBytes(base64:string):Uint8Array{const s=atob(base64);const out=new Uint8Array(s.length);for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i);return out;}
/** The generated sketch lives inside the spec. */
export const sketchOf=(b:AiBuild)=>b.spec.sketch.source;
export const chipText=(b:AiBuild)=>`${/avr-gcc [\d.]+/.exec(b.build.toolchain)?.[0]??b.build.toolchain} · ${b.build.bytes.toLocaleString('en-US')} B`;
