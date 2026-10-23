/**
 * HTTP compile runner (ADR 011/012). Talks to the compile sidecar (services/compiler) over an internal network,
 * so ops needs neither docker nor docker.sock. Used when OPS_COMPILER_URL and COMPILER_TOKEN are set; otherwise
 * the callers fall back to the Docker runners (local dev). Results feed the same caches as before.
 */
import {DockerRunner,LAB_TOOLCHAIN,type CompileRunner,type RunResult} from './lab-compile.js';
import {DockerProRunner,parseProDiagnostics,type ProDiag,type ProRun,type ProRunner,type ProTarget} from './pro-compile.js';

export const CLIENT_TIMEOUT_MS={avr:45_000,esp32:150_000,lint:20_000};
const ART_B64_MAX=Math.ceil((4<<20)/3)*4+16;

type Fetch=typeof fetch;
interface Remote{status:'compiled'|'failed'|'linted';ok?:boolean;diagnostics?:ProDiag[];artifact?:string;log?:string;dump?:string;timedOut?:boolean}
type Call={ok:true;body:Remote}|{ok:false;reason:string};

export class HttpCompileRunner{
 private probe?:{at:number;ok:boolean};
 readonly url:string;
 constructor(url:string,readonly token:string,readonly fetcher:Fetch=fetch,readonly timeouts=CLIENT_TIMEOUT_MS){this.url=url.replace(/\/+$/,'');}

 /** True when the sidecar answers /health. Cached for 15 s. */
 async available():Promise<boolean>{
  if(this.probe&&Date.now()-this.probe.at<15_000)return this.probe.ok;
  const ok=await this.fetcher(this.url+'/health',{signal:AbortSignal.timeout(3000)}).then(r=>r.ok,()=>false);
  this.probe={at:Date.now(),ok};return ok;
 }
 async call(path:'/compile'|'/lint',payload:unknown,timeoutMs:number):Promise<Call>{
  try{
   const r=await this.fetcher(this.url+path,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${this.token}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(timeoutMs)});
   if(r.status===429)return{ok:false,reason:'The compiler is busy. Try again in a few seconds.'};
   if(r.status===401)return{ok:false,reason:'The compiler rejected the server credentials.'};
   const text=await r.text();
   if(r.status!==200)return{ok:false,reason:`The compiler answered ${r.status}.`};
   return{ok:true,body:JSON.parse(text) as Remote};
  }catch(e){
   this.probe=undefined;
   return{ok:false,reason:`The compiler is not reachable: ${e instanceof Error?e.message.slice(0,120):'error'}`};
  }
 }
}

/** Lab AI: AVR (uno) compile of one sketch. Same RunResult as DockerRunner. */
export class HttpLabRunner implements CompileRunner{
 readonly toolchain=LAB_TOOLCHAIN;
 constructor(readonly http:HttpCompileRunner){}
 available(){return this.http.available();}
 async run(source:string):Promise<RunResult>{
  const r=await this.http.call('/compile',{target:'uno',files:[{name:'s.ino',content:source}]},this.http.timeouts.avr);
  if(!r.ok)return{ok:false,log:r.reason,unavailable:true};
  const b=r.body;
  if(b.timedOut)return{ok:false,log:'The compile took too long and was stopped.',timedOut:true};
  if(b.status!=='compiled'||!b.artifact||b.artifact.length>ART_B64_MAX)return{ok:false,log:b.log||(b.diagnostics??[]).map(d=>`s.ino:${d.line}: error: ${d.message}`).join('\n')||'The compiler produced no output.'};
  return{ok:true,hex:Buffer.from(b.artifact,'base64').toString('utf8'),dump:b.dump??''};
 }
}

/** Pro: esp32, esp32s3, uno, nano compile and python lint. */
export class HttpProRunner implements ProRunner{
 constructor(readonly http:HttpCompileRunner){}
 available(_t:ProTarget){return this.http.available();}
 async run(t:ProTarget,source:string):Promise<ProRun>{
  const py=t==='python'||t==='micropython';
  const r=py
   ?await this.http.call('/lint',{language:t,files:[{name:'main.py',content:source}]},this.http.timeouts.lint)
   :await this.http.call('/compile',{target:t,files:[{name:'s.ino',content:source}]},t==='uno'||t==='nano'?this.http.timeouts.avr:this.http.timeouts.esp32);
  const err=(message:string,extra:{unavailable?:boolean;timedOut?:boolean}={}):ProRun=>({ok:false,...extra,diagnostics:[{line:0,message,severity:'error'}]});
  if(!r.ok)return err(r.reason,{unavailable:true});
  const b=r.body;
  const diags=(b.diagnostics??[]).slice(0,20).map(d=>({line:Math.max(0,d.line|0),message:String(d.message).slice(0,400),severity:d.severity==='warning'?'warning' as const:'error' as const}));
  if(b.timedOut)return err('The compile took too long and was stopped.',{timedOut:true});
  if(py)return b.ok?{ok:true,diagnostics:diags}:{ok:false,diagnostics:diags.length?diags:err('The linter produced no result.').diagnostics};
  if(b.status!=='compiled'||!b.artifact||b.artifact.length>ART_B64_MAX){
   const d=diags.some(x=>x.severity==='error')?diags:parseProDiagnostics(b.log??'');
   return{ok:false,diagnostics:d};
  }
  return{ok:true,artifact:Buffer.from(b.artifact,'base64'),diagnostics:diags.filter(d=>d.severity==='warning')};
 }
}

/** Both factories use the sidecar when OPS_COMPILER_URL and COMPILER_TOKEN are set, else the local Docker runners. */
export function sidecarFromEnv(env:NodeJS.ProcessEnv=process.env):HttpCompileRunner|undefined{
 const url=env.OPS_COMPILER_URL?.trim(),token=env.COMPILER_TOKEN?.trim();
 return url&&token?new HttpCompileRunner(url,token):undefined;
}
export function labRunnerFromEnv(env:NodeJS.ProcessEnv=process.env):CompileRunner{
 const h=sidecarFromEnv(env);return h?new HttpLabRunner(h):new DockerRunner();
}
export function proRunnerFromEnv(env:NodeJS.ProcessEnv=process.env):ProRunner{
 const h=sidecarFromEnv(env);return h?new HttpProRunner(h):new DockerProRunner();
}
