/**
 * Sandboxed compile for the Lab AI builder (ADR 011). Sketch source in, firmware artifact out. Compile only, never execute.
 * The runner is a one-shot Docker container (image aiot-avr-sandbox:1.8.8, see scripts/lab-firmware/Dockerfile.sandbox):
 * no network, read-only root, tmpfs work dir, unprivileged user, no capabilities, pids/memory/cpu limits, 20 s wall clock.
 * Results are cached by sha256(source + toolchain) in the ops sqlite; identical concurrent compiles are coalesced; at most 2 run at once.
 */
import {spawn} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import type {LabBuildArtifact,LabDiagnostic} from '../../packages/ops-contract/index.js';

/** Same string as firmware/generated.ts (a test keeps them equal). */
export const LAB_TOOLCHAIN='arduino-cli 1.5.1 · arduino:avr 1.8.8 · avr-gcc 7.3.0 · -fno-lto';
export const SOURCE_MAX=20_000;
export const FLASH_MAX=32_256;
export const COMPILE_TIMEOUT_MS=20_000;
export const CACHE_TTL_MS=30*86_400_000;
export const DEFAULT_IMAGE='aiot-avr-sandbox:1.8.8';
const DUMP_MAX=16<<20;

/** Every flag here is mandatory (ADR 011), not tuning. A test pins them. */
export function sandboxArgs(image:string,name:string):string[]{
 return ['run','--rm','-i','--name',name,
  '--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
  '--pids-limit','128','--memory','512m','--memory-swap','512m','--cpus','1',
  '--user','65534:65534','--tmpfs','/work:rw,noexec,nosuid,size=96m,mode=1777',
  '-e','HOME=/work','-e','TMPDIR=/work/tmp',
  image,'sh','-c',CONTAINER_SCRIPT];
}
const FLAGS='--build-property build.extra_flags=-fno-lto --build-property compiler.c.elf.extra_flags=-fno-lto';
const CONTAINER_SCRIPT=[
 'mkdir -p /work/tmp /work/s',
 'head -c 20480 > /work/s/s.ino',
 `arduino-cli compile -b arduino:avr:uno ${FLAGS} --build-path /work/build /work/s > /work/log 2>&1`,
 'rc=$?',
 'echo "@@RC $rc"',
 'if [ $rc -eq 0 ]; then echo "@@HEX"; cat /work/build/s.ino.hex; echo "@@DUMP"; avr-objdump --dwarf=decodedline /work/build/s.ino.elf 2>/dev/null | grep -E "^[^ ]+ +[0-9]+ +(.* +)?0x[0-9a-fA-F]+"; fi',
 'echo "@@LOG"; head -c 8192 /work/log',
].join('; ');

export type RunResult={ok:true;hex:string;dump:string}|{ok:false;log:string;timedOut?:boolean};
export interface CompileRunner{readonly toolchain:string;available():Promise<boolean>;run(source:string):Promise<RunResult>}

/** Splits the container's stdout (see CONTAINER_SCRIPT). Exported for tests. */
export function parseContainerOutput(out:string):RunResult{
 const rc=/@@RC (\d+)/.exec(out)?.[1];
 const log=out.includes('@@LOG')?out.slice(out.indexOf('@@LOG')+5).trim():out.trim();
 if(rc!=='0')return{ok:false,log};
 const hex=out.slice(out.indexOf('@@HEX')+5,out.indexOf('@@DUMP')).trim();
 const dump=out.slice(out.indexOf('@@DUMP')+6,out.indexOf('@@LOG')).trim();
 return hex?{ok:true,hex,dump}:{ok:false,log:log||'The compiler produced no output.'};
}

export class DockerRunner implements CompileRunner{
 readonly toolchain=LAB_TOOLCHAIN;
 private probe?:{at:number;ok:boolean};
 constructor(readonly image=process.env.OPS_LAB_IMAGE||DEFAULT_IMAGE,readonly docker=process.env.OPS_LAB_DOCKER||'docker',readonly timeoutMs=COMPILE_TIMEOUT_MS){}
 /** True when the docker CLI works and the sandbox image exists. Cached for 30 s. */
 async available():Promise<boolean>{
  if(this.probe&&Date.now()-this.probe.at<30_000)return this.probe.ok;
  const ok=await new Promise<boolean>(done=>{
   try{const p=spawn(this.docker,['image','inspect',this.image],{stdio:'ignore'});p.on('error',()=>done(false));p.on('exit',c=>done(c===0));}catch{done(false);}
  });
  this.probe={at:Date.now(),ok};return ok;
 }
 run(source:string):Promise<RunResult>{
  const name='aiot-lab-'+randomBytes(6).toString('hex');
  return new Promise(resolve=>{
   let out='',size=0,timedOut=false,settled=false;
   const p=spawn(this.docker,sandboxArgs(this.image,name),{stdio:['pipe','pipe','ignore']});
   const finish=(r:RunResult)=>{if(settled)return;settled=true;clearTimeout(timer);resolve(r);};
   const timer=setTimeout(()=>{timedOut=true;spawn(this.docker,['kill',name],{stdio:'ignore'}).on('error',()=>{});p.kill('SIGKILL');},this.timeoutMs);
   p.stdout.on('data',(d:Buffer)=>{size+=d.length;if(size>DUMP_MAX){timedOut=true;spawn(this.docker,['kill',name],{stdio:'ignore'}).on('error',()=>{});p.kill('SIGKILL');return;}out+=d.toString('utf8');});
   p.on('error',e=>finish({ok:false,log:`The compiler could not start: ${e.message}`}));
   p.on('close',()=>finish(timedOut?{ok:false,log:'The compile took too long and was stopped.',timedOut:true}:parseContainerOutput(out)));
   p.stdin.on('error',()=>{});p.stdin.end(source);
  });
 }
}

// ---------- source screening ----------
/** Headers a sketch may include: the AVR core, libc basics and the allow-listed Servo library. */
const INCLUDE_OK=/^(Arduino\.h|Servo\.h|avr\/[\w./]+\.h|util\/[\w.]+\.h|(math|stdlib|string|stdint|stdbool|stdio|limits|ctype)\.h)$/;
/** Returns diagnostics for sources that must not reach the compiler: oversize, binary, quoted/odd includes, asm file reads. */
export function screenSource(source:string):LabDiagnostic[]{
 const bad=(line:number,message:string):LabDiagnostic=>({line,message});
 if(Buffer.byteLength(source)>SOURCE_MAX)return[bad(0,`The sketch is larger than ${SOURCE_MAX/1000} KB.`)];
 if(/\0/.test(source))return[bad(0,'The sketch contains binary data.')];
 const out:LabDiagnostic[]=[];
 // Splice continuation lines and blank out comments (keeping newlines so line numbers hold) before looking at directives.
 const spliced=source.replace(/\\\r?\n/g,'');
 const clean=spliced.replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' ')).replace(/\/\/[^\n]*/g,'');
 clean.split('\n').forEach((raw,i)=>{
  const d=/^(?:#|%:)\s*(\w+)\s*(.*)$/.exec(raw.trim());
  if(!d)return;
  if(d[1]==='include'){
   const m=/^<([^>]*)>/.exec(d[2]!);
   if(!m)out.push(bad(i+1,'Only #include <...> of Arduino.h, Servo.h and standard AVR headers is allowed.'));
   else if(!INCLUDE_OK.test(m[1]!.trim()))out.push(bad(i+1,`#include <${m[1]}> is not available in the lab. Use Arduino.h or Servo.h.`));
  }else if(d[1]==='include_next'||d[1]==='import')out.push(bad(i+1,'Only #include <...> of Arduino.h, Servo.h and standard AVR headers is allowed.'));
 });
 if(/__has_include|\.incbin|\bincbin\b/.test(clean))out.push(bad(0,'File access from the preprocessor or assembler is not allowed.'));
 return out.slice(0,10);
}

// ---------- artifact ----------
function parseHex(hex:string):Uint8Array{
 const mem=new Map<number,number>();let base=0,max=0;
 for(const raw of hex.split(/\r?\n/)){
  const l=raw.trim();if(!l.startsWith(':'))continue;
  const len=parseInt(l.slice(1,3),16),addr=parseInt(l.slice(3,7),16),type=parseInt(l.slice(7,9),16);
  if(type===4)base=parseInt(l.slice(9,13),16)<<16;
  else if(type===0)for(let i=0;i<len;i++){mem.set(base+addr+i,parseInt(l.slice(9+i*2,11+i*2),16));max=Math.max(max,base+addr+i+1);}
 }
 const out=new Uint8Array(max);for(const [a,b] of mem)out[a]=b;return out;
}
/** DWARF decoded line rows -> runs [firstWord,lastWord,inoLine]. Same algorithm as scripts/build-lab-firmware.ts. */
export function parseLines(objdump:string):[number,number,number][]{
 const rows:{addr:number;line:number;ino:boolean}[]=[];
 for(const l of objdump.split('\n')){
  const m=/^(\S.*?)\s+(\d+)\s+(?:\d+\s+)?(0x[0-9a-fA-F]+)\b/.exec(l);
  if(m)rows.push({addr:parseInt(m[3]!,16),line:Number(m[2]),ino:/\.ino$/.test(m[1]!)});
 }
 rows.sort((a,b)=>a.addr-b.addr);
 const runs:[number,number,number][]=[];
 for(let i=0;i<rows.length;i++){
  const r=rows[i]!;
  if(!r.ino||(i+1<rows.length&&rows[i+1]!.addr===r.addr))continue;
  let j=i+1;while(j<rows.length&&rows[j]!.addr===r.addr)j++;
  const next=j<rows.length?rows[j]!.addr:r.addr+2;
  if(next<=r.addr)continue;
  const first=r.addr>>1,last=(next>>1)-1,prev=runs[runs.length-1];
  if(prev&&prev[2]===r.line&&prev[1]+1===first)prev[1]=last;else runs.push([first,last,r.line]);
 }
 return runs;
}
/** Compiler messages as diagnostics on the user's own line numbers; container paths never leak. */
export function parseDiagnostics(log:string):LabDiagnostic[]{
 const out:LabDiagnostic[]=[];
 for(const l of log.split('\n')){
  const m=/s\.ino:(\d+):(?:\d+:)?\s*(?:fatal )?error:\s*(.+)$/.exec(l);
  if(m)out.push({line:Number(m[1]),message:m[2]!.replace(/\/work\/\S*/g,'').trim().slice(0,400)});
 }
 if(!out.length){const last=log.split('\n').map(x=>x.trim()).filter(Boolean).pop();out.push({line:0,message:(last??'The sketch did not compile.').replace(/\/work\/\S*/g,'').slice(0,400)});}
 return out.slice(0,10);
}

export type CompileOutcome=
 |{ok:true;build:LabBuildArtifact;cached:boolean}
 |{ok:false;kind:'compile'|'unavailable';message:string;diagnostics:LabDiagnostic[]};
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');

export class LabCompiler{
 private inflight=new Map<string,Promise<CompileOutcome>>();
 private running=0;private waiting:(()=>void)[]=[];
 constructor(readonly db:DatabaseSync,readonly runner:CompileRunner,readonly clock:()=>Date=()=>new Date(),readonly maxParallel=2,readonly queueMs=5000){
  db.exec('CREATE TABLE IF NOT EXISTS lab_compile(key TEXT PRIMARY KEY,artifact TEXT NOT NULL,at INTEGER NOT NULL)');
 }
 available():Promise<boolean>{return this.runner.available();}
 get toolchain(){return this.runner.toolchain;}
 key(source:string){return sha(source+'\n--\n'+this.runner.toolchain);}
 private cached(key:string):LabBuildArtifact|undefined{
  const row=this.db.prepare('SELECT artifact,at FROM lab_compile WHERE key=?').get(key) as {artifact:string;at:number}|undefined;
  if(!row)return undefined;
  if(this.clock().getTime()-row.at>CACHE_TTL_MS){this.db.prepare('DELETE FROM lab_compile WHERE key=?').run(key);return undefined;}
  return JSON.parse(row.artifact) as LabBuildArtifact;
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

 async compile(source:string):Promise<CompileOutcome>{
  const diag=screenSource(source);
  if(diag.length)return{ok:false,kind:'compile',message:'The sketch cannot be compiled.',diagnostics:diag};
  const key=this.key(source),hit=this.cached(key);
  if(hit)return{ok:true,build:hit,cached:true};
  const pending=this.inflight.get(key);
  if(pending)return pending.then(r=>r.ok?{...r,cached:true}:r);
  const job=this.build(source,key).finally(()=>this.inflight.delete(key));
  this.inflight.set(key,job);return job;
 }
 private async build(source:string,key:string):Promise<CompileOutcome>{
  if(!await this.runner.available())return{ok:false,kind:'unavailable',message:'compiler not configured',diagnostics:[]};
  if(!await this.slot())return{ok:false,kind:'unavailable',message:'The compiler is busy. Try again in a few seconds.',diagnostics:[]};
  let r:RunResult;
  try{r=await this.runner.run(source);}finally{this.release();}
  if(!r.ok)return{ok:false,kind:'compile',message:r.timedOut?'The compile took too long.':'The sketch did not compile.',diagnostics:r.timedOut?[{line:0,message:r.log}]:parseDiagnostics(r.log)};
  const flash=parseHex(r.hex);
  if(flash.length===0||flash.length>FLASH_MAX)return{ok:false,kind:'compile',message:'The sketch does not fit.',diagnostics:[{line:0,message:flash.length?`The program is ${flash.length} bytes; the board holds ${FLASH_MAX}.`:'The compiler produced an empty program.'}]};
  const build:LabBuildArtifact={sha256:key,flashBase64:Buffer.from(flash).toString('base64'),bytes:flash.length,lines:parseLines(r.dump),toolchain:this.runner.toolchain};
  this.db.prepare('INSERT OR REPLACE INTO lab_compile(key,artifact,at) VALUES(?,?,?)').run(key,JSON.stringify(build),this.clock().getTime());
  return{ok:true,build,cached:false};
 }
}
