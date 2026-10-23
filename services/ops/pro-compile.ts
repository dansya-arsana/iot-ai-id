/**
 * Pro `compile_code` backend (plan §7 M3-E). One file in, status + diagnostics + pinsReferenced + artifact sha out.
 * Targets: esp32/esp32s3 (arduino-cli, pinned esp32 core), uno/nano (the lab AVR image), python/micropython (static lint, never run).
 * Every container: no network, read-only root, tmpfs work dir, unprivileged user, no caps, pid/mem/cpu limits, hard wall clock.
 * Results are cached by sha256(target + file + toolchain) in ops sqlite. Artifacts (at most 4 MB) are stored by sha.
 * Identical concurrent compiles are coalesced; at most `maxParallel` containers run at once.
 */
import {spawn} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {DEFAULT_IMAGE as AVR_IMAGE,LAB_TOOLCHAIN,DockerRunner,type RunResult} from './lab-compile.js';

export type ProTarget='esp32'|'esp32s3'|'uno'|'nano'|'python'|'micropython';
export interface ProDiag{line:number;message:string;severity:'error'|'warning'}
export interface PinRef{symbol:string;pin:string;lines:number[]}
export interface ProCompileResult{
 status:'compiled'|'linted'|'failed'|'pending';
 diagnostics:ProDiag[];pinsReferenced:PinRef[];sha256:string;toolchain:string;artifactSha?:string;
}

export const ESP32_IMAGE=process.env.OPS_PRO_ESP32_IMAGE||'aiot-pro-esp32:3.3.12';
export const PY_IMAGE=process.env.OPS_PRO_PY_IMAGE||'aiot-pro-py:1';
export const TOOLCHAINS:Record<ProTarget,string>={
 esp32:'arduino-cli 1.5.1 · esp32:esp32 3.3.12 · esp32',
 esp32s3:'arduino-cli 1.5.1 · esp32:esp32 3.3.12 · esp32s3',
 uno:LAB_TOOLCHAIN,nano:LAB_TOOLCHAIN,
 python:'python 3.12 · ast lint',micropython:'python 3.12 · ast lint (micropython rules)',
};
export const FILE_MAX=40_000;
export const ARTIFACT_MAX=4<<20;
export const CACHE_TTL_MS=30*86_400_000;
/** Wall clocks, set from the measurement spike (scripts/pro-sandbox/README.md). */
export const TIMEOUT_MS:Record<'esp32'|'avr'|'py',number>={esp32:60_000,avr:20_000,py:10_000};
const OUT_MAX=12<<20;

/** Mandatory isolation flags. A test pins them. */
export function proSandboxArgs(image:string,name:string,script:string[],opts:{work?:string}={}):string[]{
 return ['run','--rm','-i','--name',name,
  '--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
  '--pids-limit','256','--memory','1g','--memory-swap','1g','--cpus','2',
  '--user','65534:65534','--tmpfs',`/work:rw,exec,nosuid,size=${opts.work??'512m'},mode=1777`,
  '-e','HOME=/work','-e','TMPDIR=/work/tmp',
  image,...script];
}
const ESP_FQBN:Record<'esp32'|'esp32s3',string>={esp32:'esp32:esp32:esp32',esp32s3:'esp32:esp32:esp32s3'};
/** stdout protocol: `@@RC n`, `@@BIN` + base64 firmware, `@@LOG` + compiler log. */
export function espScript(t:'esp32'|'esp32s3'):string[]{
 const sh=[
  'mkdir -p /work/tmp /work/s',
  'head -c 40960 > /work/s/s.ino',
  `arduino-cli compile -b ${ESP_FQBN[t]} --build-path /work/build /work/s > /work/log 2>&1`,
  'rc=$?',
  'echo "@@RC $rc"',
  'if [ $rc -eq 0 ]; then echo "@@BIN"; base64 -w0 /work/build/s.ino.bin; echo; fi',
  'echo "@@LOG"; head -c 12288 /work/log',
 ].join('; ');
 return ['sh','-c',sh];
}
export const pyScript=(t:'python'|'micropython'):string[]=>['python','-I','/opt/lint.py',t];

/** Source screening: nothing that reads files at compile time. */
export function screenPro(target:ProTarget,source:string):ProDiag[]{
 const bad=(line:number,message:string):ProDiag=>({line,message,severity:'error'});
 if(Buffer.byteLength(source)>FILE_MAX)return[bad(0,`The file is larger than ${FILE_MAX/1000} KB.`)];
 if(/\0/.test(source))return[bad(0,'The file contains binary data.')];
 if(target==='python'||target==='micropython')return[];
 const out:ProDiag[]=[];
 const clean=source.replace(/\\\r?\n/g,'').replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' ')).replace(/\/\/[^\n]*/g,'');
 clean.split('\n').forEach((raw,i)=>{
  const d=/^(?:#|%:)\s*(\w+)\s*(.*)$/.exec(raw.trim());
  if(!d)return;
  if(d[1]==='include'){
   const m=/^<([A-Za-z0-9_./+-]+)>/.exec(d[2]!);
   if(!m||m[1]!.includes('..')||m[1]!.startsWith('/'))out.push(bad(i+1,'Only #include <name.h> with a library or core header is allowed.'));
  }else if(d[1]==='include_next'||d[1]==='import')out.push(bad(i+1,'#include_next and #import are not allowed.'));
 });
 if(/__has_include|\.incbin|\bincbin\b/.test(clean))out.push(bad(0,'File access from the preprocessor or assembler is not allowed.'));
 return out.slice(0,10);
}

/** Pins the code references, parsed from the source (never from the model). Symbol must be UPPER_SNAKE. */
export function parsePins(target:ProTarget,source:string):PinRef[]{
 const lines=source.split('\n');
 const py=target==='python'||target==='micropython';
 const defs=new Map<string,{pin:string;line:number}>();
 const defRe=py
  ?/^\s*([A-Z][A-Z0-9_]{0,31})\s*=\s*(\d{1,3})\s*(?:#.*)?$/
  :/^\s*(?:#define\s+([A-Z][A-Z0-9_]{0,31})\s+(A?\d{1,3})\b|(?:static\s+)?(?:constexpr\s+|const\s+)(?:u?int\d*_t|int|byte|uint8_t|unsigned\s+int)\s+([A-Z][A-Z0-9_]{0,31})\s*=\s*(A?\d{1,3})\s*;)/;
 lines.forEach((l,i)=>{
  const m=defRe.exec(l);if(!m)return;
  const sym=m[1]??m[3]!,pin=m[2]??m[4]!;
  if(!defs.has(sym))defs.set(sym,{pin,line:i+1});
 });
 const out:PinRef[]=[];
 for(const [symbol,d] of defs){
  const re=new RegExp(`\\b${symbol}\\b`);
  const used=lines.flatMap((l,i)=>i+1!==d.line&&re.test(l)?[i+1]:[]).slice(0,50);
  if(used.length)out.push({symbol,pin:(/^A\d/.test(d.pin)?d.pin:/^\d/.test(d.pin)&&!py&&target!=='uno'&&target!=='nano'?'GPIO'+d.pin:d.pin).slice(0,12),lines:used});
 }
 return out.slice(0,80);
}

/** Compiler messages as diagnostics on the user's own lines; container paths never leak. */
export function parseProDiagnostics(log:string):ProDiag[]{
 const out:ProDiag[]=[];
 for(const l of log.split('\n')){
  const m=/s\.ino:(\d+):(?:\d+:)?\s*(?:fatal )?(error|warning):\s*(.+)$/.exec(l);
  if(m&&out.length<20)out.push({line:Number(m[1]),message:m[3]!.replace(/\/(?:work|opt)\/\S*/g,'').trim().slice(0,400),severity:m[2] as 'error'|'warning'});
 }
 if(!out.some(d=>d.severity==='error')){
  const last=log.split('\n').map(x=>x.trim()).filter(Boolean).pop();
  out.push({line:0,message:(last??'The file did not compile.').replace(/\/(?:work|opt)\/\S*/g,'').slice(0,400),severity:'error'});
 }
 return out.slice(0,20);
}

export type ProRun=
 |{ok:true;artifact?:Buffer;diagnostics:ProDiag[]}
 |{ok:false;diagnostics:ProDiag[];timedOut?:boolean;unavailable?:boolean};
export interface ProRunner{available(target:ProTarget):Promise<boolean>;run(target:ProTarget,source:string):Promise<ProRun>}

/** Splits the ESP32 container stdout. Exported for tests. */
export function parseEspOutput(out:string):ProRun{
 const rc=/@@RC (\d+)/.exec(out)?.[1];
 const log=out.includes('@@LOG')?out.slice(out.indexOf('@@LOG')+5).trim():out.trim();
 if(rc!=='0')return{ok:false,diagnostics:parseProDiagnostics(log)};
 const b64=out.slice(out.indexOf('@@BIN')+5,out.indexOf('@@LOG')).trim();
 const bin=Buffer.from(b64,'base64');
 if(!bin.length)return{ok:false,diagnostics:[{line:0,message:'The compiler produced no output.',severity:'error'}]};
 return{ok:true,artifact:bin,diagnostics:parseProDiagnostics(log).filter(d=>d.severity==='warning')};
}
/** Parses lint.py JSON. Exported for tests. */
export function parseLintOutput(out:string):ProRun{
 try{
  const j=JSON.parse(out.trim().split('\n').pop()??'') as {ok:boolean;diagnostics:ProDiag[]};
  const diagnostics=(j.diagnostics??[]).slice(0,20).map(d=>({line:Math.max(0,d.line|0),message:String(d.message).slice(0,400),severity:d.severity==='warning'?'warning' as const:'error' as const}));
  return j.ok?{ok:true,diagnostics}:{ok:false,diagnostics};
 }catch{return{ok:false,diagnostics:[{line:0,message:'The linter produced no result.',severity:'error'}]};}
}

export class DockerProRunner implements ProRunner{
 private probes=new Map<string,{at:number;ok:boolean}>();
 private avr:DockerRunner;
 constructor(readonly docker=process.env.OPS_LAB_DOCKER||'docker',readonly timeouts=TIMEOUT_MS){this.avr=new DockerRunner(AVR_IMAGE,docker,timeouts.avr);}
 private image(t:ProTarget){return t==='esp32'||t==='esp32s3'?ESP32_IMAGE:t==='python'||t==='micropython'?PY_IMAGE:AVR_IMAGE;}
 available(t:ProTarget):Promise<boolean>{
  const image=this.image(t),hit=this.probes.get(image);
  if(hit&&Date.now()-hit.at<30_000)return Promise.resolve(hit.ok);
  return new Promise<boolean>(done=>{
   const fin=(ok:boolean)=>{this.probes.set(image,{at:Date.now(),ok});done(ok);};
   try{const p=spawn(this.docker,['image','inspect',image],{stdio:'ignore'});p.on('error',()=>fin(false));p.on('exit',c=>fin(c===0));}catch{fin(false);}
  });
 }
 async run(t:ProTarget,source:string):Promise<ProRun>{
  if(t==='uno'||t==='nano'){
   const r:RunResult=await this.avr.run(source);
   if(!r.ok)return r.timedOut?{ok:false,timedOut:true,diagnostics:[{line:0,message:r.log,severity:'error'}]}:{ok:false,diagnostics:parseProDiagnostics(r.log)};
   return{ok:true,artifact:Buffer.from(r.hex,'utf8'),diagnostics:[]};
  }
  const py=t==='python'||t==='micropython';
  const ms=py?this.timeouts.py:this.timeouts.esp32;
  const name='aiot-pro-'+randomBytes(6).toString('hex');
  const args=py?proSandboxArgs(PY_IMAGE,name,pyScript(t as 'python'|'micropython'),{work:'16m'}):proSandboxArgs(ESP32_IMAGE,name,espScript(t as 'esp32'|'esp32s3'));
  return new Promise(resolve=>{
   let out='',size=0,timedOut=false,settled=false;
   const kill=()=>{timedOut=true;spawn(this.docker,['kill',name],{stdio:'ignore'}).on('error',()=>{});p.kill('SIGKILL');};
   const p=spawn(this.docker,args,{stdio:['pipe','pipe','ignore']});
   const finish=(r:ProRun)=>{if(settled)return;settled=true;clearTimeout(timer);resolve(r);};
   const timer=setTimeout(kill,ms);
   p.stdout.on('data',(d:Buffer)=>{size+=d.length;if(size>OUT_MAX){kill();return;}out+=d.toString('utf8');});
   p.on('error',e=>finish({ok:false,unavailable:true,diagnostics:[{line:0,message:`The compiler could not start: ${e.message}`,severity:'error'}]}));
   p.on('close',()=>finish(timedOut?{ok:false,timedOut:true,diagnostics:[{line:0,message:'The compile took too long and was stopped.',severity:'error'}]}:py?parseLintOutput(out):parseEspOutput(out)));
   p.stdin.on('error',()=>{});p.stdin.end(source);
  });
 }
}

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const isLint=(t:ProTarget)=>t==='python'||t==='micropython';

export class ProCompiler{
 private inflight=new Map<string,Promise<ProCompileResult>>();
 private running=0;private waiting:(()=>void)[]=[];
 constructor(readonly db:DatabaseSync,readonly runner:ProRunner,readonly clock:()=>Date=()=>new Date(),readonly maxParallel=2,readonly queueMs=8000){
  db.exec('CREATE TABLE IF NOT EXISTS pro_compile(key TEXT PRIMARY KEY,result TEXT NOT NULL,at INTEGER NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS pro_artifacts_bin(sha TEXT PRIMARY KEY,bytes BLOB NOT NULL,at INTEGER NOT NULL)');
 }
 key(target:ProTarget,content:string){return sha(`${target}\n${TOOLCHAINS[target]}\n--\n${content}`);}
 /** Artifact bytes by sha, or undefined. */
 artifact(artifactSha:string):Buffer|undefined{
  const r=this.db.prepare('SELECT bytes FROM pro_artifacts_bin WHERE sha=?').get(artifactSha) as {bytes:Uint8Array}|undefined;
  return r?Buffer.from(r.bytes):undefined;
 }
 private cached(key:string):ProCompileResult|undefined{
  const row=this.db.prepare('SELECT result,at FROM pro_compile WHERE key=?').get(key) as {result:string;at:number}|undefined;
  if(!row)return undefined;
  if(this.clock().getTime()-row.at>CACHE_TTL_MS){this.db.prepare('DELETE FROM pro_compile WHERE key=?').run(key);return undefined;}
  const r=JSON.parse(row.result) as ProCompileResult;
  if(r.artifactSha&&!this.artifact(r.artifactSha))return undefined;
  return r;
 }
 private async slot():Promise<boolean>{
  if(this.running<this.maxParallel){this.running++;return true;}
  return new Promise<boolean>(resolve=>{
   const timer=setTimeout(()=>{const i=this.waiting.indexOf(go);if(i>=0)this.waiting.splice(i,1);resolve(false);},this.queueMs);
   const go=()=>{clearTimeout(timer);this.running++;resolve(true);};
   this.waiting.push(go);
  });
 }
 private release(){this.running--;this.waiting.shift()?.();}

 async compile(target:ProTarget,file:{name:string;content:string}):Promise<ProCompileResult>{
  const key=this.key(target,file.content),toolchain=TOOLCHAINS[target];
  const failed=(diagnostics:ProDiag[]):ProCompileResult=>({status:'failed',diagnostics,pinsReferenced:[],sha256:key,toolchain});
  const screen=screenPro(target,file.content);
  if(screen.length)return failed(screen);
  const hit=this.cached(key);
  if(hit)return hit;
  const pending=this.inflight.get(key);
  if(pending)return pending;
  const job=this.build(target,file.content,key).finally(()=>this.inflight.delete(key));
  this.inflight.set(key,job);return job;
 }
 private async build(target:ProTarget,source:string,key:string):Promise<ProCompileResult>{
  const toolchain=TOOLCHAINS[target];
  const pending=(message:string):ProCompileResult=>({status:'pending',diagnostics:[{line:0,message,severity:'warning'}],pinsReferenced:[],sha256:key,toolchain});
  if(!await this.runner.available(target))return pending('The compiler is not configured on this server.');
  if(!await this.slot())return pending('The compiler is busy. Try again in a few seconds.');
  let r:ProRun;
  try{r=await this.runner.run(target,source);}finally{this.release();}
  if(!r.ok){
   if(r.unavailable)return pending(r.diagnostics[0]?.message??'The compiler is not available.');
   const res:ProCompileResult={status:'failed',diagnostics:r.diagnostics.slice(0,20),pinsReferenced:[],sha256:key,toolchain};
   if(!r.timedOut)this.store(key,res);   // a timeout may be load; do not cache it
   return res;
  }
  const pinsReferenced=parsePins(target,source);
  const res:ProCompileResult={status:isLint(target)?'linted':'compiled',diagnostics:r.diagnostics.slice(0,20),pinsReferenced,sha256:key,toolchain};
  if(r.artifact){
   if(r.artifact.length>ARTIFACT_MAX)return{...res,status:'failed',diagnostics:[{line:0,message:`The firmware is ${r.artifact.length} bytes; the limit is ${ARTIFACT_MAX}.`,severity:'error'}]};
   const artifactSha=createHash('sha256').update(r.artifact).digest('hex');
   this.db.prepare('INSERT OR IGNORE INTO pro_artifacts_bin(sha,bytes,at) VALUES(?,?,?)').run(artifactSha,r.artifact,this.clock().getTime());
   res.artifactSha=artifactSha;
  }
  this.store(key,res);
  return res;
 }
 private store(key:string,res:ProCompileResult){
  this.db.prepare('INSERT OR REPLACE INTO pro_compile(key,result,at) VALUES(?,?,?)').run(key,JSON.stringify(res),this.clock().getTime());
 }
}
