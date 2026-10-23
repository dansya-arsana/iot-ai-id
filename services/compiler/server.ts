/**
 * Compile sidecar (ADR 011, ADR 012). A small HTTP service that runs arduino-cli (AVR, ESP32) and the Python lint for ops.
 * Compile only, never execute the artifact. It replaces the docker.sock idea: ops talks HTTP over an internal network.
 *
 * Self-contained on purpose: the image runs this file with plain `node` (type stripping), so it imports only node: modules
 * and uses erasable TypeScript only (no enums, no parameter properties).
 *
 *   POST /compile  {target,files:[{name,content}],fqbn?}  -> {status,diagnostics,sizes,artifact(base64),sha256,toolchain,log,dump?}
 *   POST /lint     {language,files}                       -> {status,ok,diagnostics,imports,toolchain}
 *   GET  /health
 * Auth: `Authorization: Bearer $COMPILER_TOKEN` (>= 32 chars, constant-time compare). No token configured: the service refuses to start.
 */
import {spawn} from 'node:child_process';
import {createHash,timingSafeEqual} from 'node:crypto';
import {existsSync,readdirSync} from 'node:fs';
import {chmod,chown,mkdir,mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {createServer,type IncomingMessage,type Server,type ServerResponse} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

export type Target='uno'|'nano'|'esp32'|'esp32s3';
export interface Diag{file?:string;line:number;message:string;severity:'error'|'warning'}
export interface SrcFile{name:string;content:string}

export const TOKEN_MIN=32;
export const SOURCE_TOTAL_MAX=200_000;
export const FILES_MAX=16;
export const ARTIFACT_MAX=4<<20;
export const QUEUE_MAX=4;
export const BODY_MAX=SOURCE_TOTAL_MAX*2+4096;
const LOG_KEEP=12_288;
const OUTPUT_KILL=8<<20;
export const TOOLCHAINS={
 avr:'arduino-cli 1.5.1 · arduino:avr 1.8.8 · avr-gcc 7.3.0 · -fno-lto',
 esp32:'arduino-cli 1.5.1 · esp32:esp32 3.3.12 · esp32',
 esp32s3:'arduino-cli 1.5.1 · esp32:esp32 3.3.12 · esp32s3',
 python:'python 3 · ast lint',
 micropython:'python 3 · ast lint (micropython rules)',
};
const DEFAULT_FQBN:Record<Target,string>={uno:'arduino:avr:uno',nano:'arduino:avr:nano:cpu=atmega328',esp32:'esp32:esp32:esp32',esp32s3:'esp32:esp32:esp32s3'};
const FQBN_OK:Record<'avr'|'esp32',RegExp>={avr:/^arduino:avr:(?:uno|nano(?::cpu=atmega328(?:old)?)?)$/,esp32:/^esp32:esp32:[a-z0-9_]{2,40}$/};
export const NAME_RE=/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}\.(?:ino|h|hpp|c|cpp|py)$/;
const AVR_FLAGS=['--build-property','build.extra_flags=-fno-lto','--build-property','compiler.c.elf.extra_flags=-fno-lto'];

export interface CompilerOptions{
 token:string;
 arduinoCli?:string;
 python?:string[];       // command prefix for the lint, e.g. ['python3','-I','/opt/lint.py']
 objdump?:string;        // avr-objdump, optional (Lab line map)
 tmpRoot?:string;
 timeoutMs?:{avr:number;esp32:number;lint:number};
 queueMax?:number;
 env?:Record<string,string>; // extra env for arduino-cli (data/user dirs)
}
export class HttpError extends Error{
 status:number;
 constructor(status:number,message:string){super(message);this.status=status;}
}

const sha256=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
/** Constant-time compare of two strings of any length (digests are fixed length). */
export function tokenOk(header:string|undefined,token:string):boolean{
 const m=/^Bearer (\S+)$/.exec(header??'');
 const a=createHash('sha256').update(m?.[1]??'').digest(),b=createHash('sha256').update(token).digest();
 return timingSafeEqual(a,b)&&!!m;
}

/** File list validation: strict names (no paths), count, total size, no NUL. Throws HttpError. */
export function validateFiles(files:unknown,exts:RegExp):SrcFile[]{
 if(!Array.isArray(files)||files.length===0)throw new HttpError(400,'files must be a non-empty array');
 if(files.length>FILES_MAX)throw new HttpError(400,`at most ${FILES_MAX} files`);
 const seen=new Set<string>();let total=0;const out:SrcFile[]=[];
 for(const f of files as Array<{name?:unknown;content?:unknown}>){
  if(!f||typeof f.name!=='string'||typeof f.content!=='string')throw new HttpError(400,'each file needs a string name and content');
  if(!NAME_RE.test(f.name)||!exts.test(f.name))throw new HttpError(400,`file name not allowed: ${f.name.slice(0,40)}`);
  if(seen.has(f.name.toLowerCase()))throw new HttpError(400,`duplicate file name: ${f.name}`);
  seen.add(f.name.toLowerCase());
  total+=Buffer.byteLength(f.content);
  if(total>SOURCE_TOTAL_MAX)throw new HttpError(413,`sources exceed ${SOURCE_TOTAL_MAX/1000} KB`);
  if(f.content.includes('\0'))throw new HttpError(400,`file contains binary data: ${f.name}`);
  out.push({name:f.name,content:f.content});
 }
 return out;
}

/** Rejects includes that could read outside the sketch, and preprocessor/assembler file access. Returns diagnostics (empty = ok). */
export function screenIncludes(files:SrcFile[]):Diag[]{
 const out:Diag[]=[];
 const bad=(file:string,line:number,message:string)=>{if(out.length<10)out.push({file,line,message,severity:'error'});};
 for(const f of files){
  const clean=f.content.replace(/\\\r?\n/g,'').replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' ')).replace(/\/\/[^\n]*/g,'');
  clean.split('\n').forEach((raw,i)=>{
   const d=/^(?:#|%:)\s*(\w+)\s*(.*)$/.exec(raw.trim());
   if(!d)return;
   if(d[1]==='include'){
    const q=/^"([^"]*)"/.exec(d[2]!),a=/^<([^>]*)>/.exec(d[2]!);
    const p=(q??a)?.[1];
    if(p===undefined)bad(f.name,i+1,'#include must name a header in quotes or angle brackets.');
    else if(p.startsWith('/')||p.includes('..')||p.includes('\\')||/^[A-Za-z]:/.test(p)||p.includes('\0'))bad(f.name,i+1,'#include with an absolute path or ".." is not allowed.');
    else if(q&&!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/.test(p))bad(f.name,i+1,'A quoted #include must name a file of the sketch.');
    else if(a&&!/^[A-Za-z0-9_./+-]+$/.test(p))bad(f.name,i+1,'#include <...> has characters that are not allowed.');
   }else if(d[1]==='include_next'||d[1]==='import')bad(f.name,i+1,'#include_next and #import are not allowed.');
  });
  if(/__has_include|\.incbin|\bincbin\b/.test(clean))bad(f.name,0,'File access from the preprocessor or assembler is not allowed.');
 }
 return out;
}

function scrub(s:string,job:string):string{
 return s.split(job).join('').replace(/\/(?:work|opt|tmp)\/\S*/g,'').replace(/s\/s\.ino/g,'s.ino');
}
/** arduino-cli gcc output -> diagnostics on the user's own files; server paths never leak. */
export function parseDiagnostics(log:string,job:string):Diag[]{
 const out:Diag[]=[];
 for(const l of log.split('\n')){
  const m=/([A-Za-z0-9_.-]+\.(?:ino|h|hpp|c|cpp)):(\d+):(?:\d+:)?\s*(?:fatal )?(error|warning):\s*(.+)$/.exec(l.split(job).join(''));
  if(m&&out.length<20)out.push({file:m[1]!,line:Number(m[2]),message:scrub(m[4]!,job).trim().slice(0,400),severity:m[3] as 'error'|'warning'});
 }
 return out;
}
export function parseSizes(log:string):{flash:number|null;ram:number|null}{
 const f=/Sketch uses (\d+) bytes/.exec(log)?.[1],r=/Global variables use (\d+) bytes/.exec(log)?.[1];
 return{flash:f?Number(f):null,ram:r?Number(r):null};
}

interface Exec{code:number|null;out:string;timedOut:boolean;overflow:boolean}
function run(cmd:string,args:string[],o:{cwd:string;env:Record<string,string>;timeoutMs:number;stdin?:string;ids?:{uid:number;gid:number}}):Promise<Exec>{
 return new Promise(resolve=>{
  let out='',size=0,timedOut=false,overflow=false,done=false;
  const p=spawn(cmd,args,{cwd:o.cwd,env:o.env,detached:true,stdio:['pipe','pipe','pipe'],...(o.ids?{uid:o.ids.uid,gid:o.ids.gid}:{})});
  const killGroup=()=>{try{if(p.pid)process.kill(-p.pid,'SIGKILL');}catch{try{p.kill('SIGKILL');}catch{/* gone */}}};
  const finish=(code:number|null)=>{if(done)return;done=true;clearTimeout(timer);killGroup();resolve({code,out,timedOut,overflow});};
  const timer=setTimeout(()=>{timedOut=true;killGroup();},o.timeoutMs);
  const take=(d:Buffer)=>{size+=d.length;if(size>OUTPUT_KILL){overflow=true;killGroup();return;}if(out.length<LOG_KEEP*4)out+=d.toString('utf8');};
  p.stdout.on('data',take);p.stderr.on('data',take);
  p.on('error',e=>{out+=`spawn failed: ${e.message}`;finish(null);});
  p.on('close',c=>finish(c));
  p.stdin.on('error',()=>{});p.stdin.end(o.stdin??'');
 });
}

export interface CompileResponse{
 status:'compiled'|'failed';diagnostics:Diag[];sizes:{flash:number|null;ram:number|null};artifact:string;sha256:string;toolchain:string;log:string;dump?:string;timedOut?:boolean;
}
const failed=(toolchain:string,diagnostics:Diag[],extra:Partial<CompileResponse>={}):CompileResponse=>({status:'failed',diagnostics,sizes:{flash:null,ram:null},artifact:'',sha256:'',toolchain,log:'',...extra});

export class CompilerService{
 private running=0;private waiting:(()=>void)[]=[];
 readonly queueMax:number;readonly timeouts:{avr:number;esp32:number;lint:number};readonly tmpRoot:string;readonly o:CompilerOptions;
 constructor(o:CompilerOptions){
  this.o=o;
  if(typeof o.token!=='string'||o.token.length<TOKEN_MIN)throw new Error(`COMPILER_TOKEN must be at least ${TOKEN_MIN} characters`);
  this.queueMax=o.queueMax??QUEUE_MAX;this.timeouts=o.timeoutMs??{avr:30_000,esp32:90_000,lint:10_000};this.tmpRoot=o.tmpRoot??tmpdir();
 }
 /** One job at a time; up to queueMax wait. Returns a release function, or throws 429. */
 private async acquire():Promise<()=>void>{
  const rel=()=>{this.running--;this.waiting.shift()?.();};
  if(this.running<1){this.running++;return rel;}
  if(this.waiting.length>=this.queueMax)throw new HttpError(429,'compiler is busy');
  await new Promise<void>(go=>this.waiting.push(()=>{this.running++;go();}));
  return rel;
 }
 get load(){return{running:this.running,queued:this.waiting.length};}

 private ids():{uid:number;gid:number}|undefined{
  return typeof process.getuid==='function'&&process.getuid()===0?{uid:65534,gid:65534}:undefined;
 }
 private async jobDir():Promise<string>{
  const dir=await mkdtemp(join(this.tmpRoot,'job-'));
  await chmod(dir,0o700);
  const ids=this.ids();if(ids)await chown(dir,ids.uid,ids.gid);
  return dir;
 }
 private env(job:string):Record<string,string>{
  return{PATH:'/usr/local/bin:/usr/bin:/bin',HOME:job,TMPDIR:join(job,'tmp'),LANG:'C.UTF-8',
   ARDUINO_UPDATER_ENABLE_NOTIFICATION:'false',ARDUINO_DIRECTORIES_DOWNLOADS:join(job,'dl'),...this.o.env};
 }

 async compile(body:{target?:unknown;files?:unknown;fqbn?:unknown}):Promise<CompileResponse>{
  const t=body.target as Target;
  if(typeof t!=='string'||!Object.hasOwn(DEFAULT_FQBN,t))throw new HttpError(400,'target must be uno, nano, esp32 or esp32s3');
  const fam=t==='uno'||t==='nano'?'avr':'esp32';
  const toolchain=fam==='avr'?TOOLCHAINS.avr:TOOLCHAINS[t as 'esp32'|'esp32s3'];
  let fqbn=DEFAULT_FQBN[t];
  if(body.fqbn!==undefined){
   if(typeof body.fqbn!=='string'||!FQBN_OK[fam].test(body.fqbn))throw new HttpError(400,'fqbn not allowed for this target');
   fqbn=body.fqbn;
  }
  const files=validateFiles(body.files,/\.(?:ino|h|hpp|c|cpp)$/);
  const firstIno=files.findIndex(f=>f.name.endsWith('.ino'));
  if(firstIno<0)throw new HttpError(400,'at least one .ino file is required');
  const screen=screenIncludes(files);
  if(screen.length)return failed(toolchain,screen);

  const release=await this.acquire();
  const job=await this.jobDir();
  try{
   const sk=join(job,'s');await mkdir(sk,{recursive:true});await mkdir(join(job,'tmp'));await mkdir(join(job,'dl'));
   // arduino-cli wants the sketch folder and the main .ino to share a name: the first .ino becomes s.ino.
   const names=files.map((f,i)=>i===firstIno?'s.ino':f.name);
   if(new Set(names.map(n=>n.toLowerCase())).size!==names.length)throw new HttpError(400,'duplicate file name: s.ino');
   for(let i=0;i<files.length;i++)await writeFile(join(sk,names[i]!),files[i]!.content,{mode:0o600});
   const ids=this.ids();if(ids){await chown(sk,ids.uid,ids.gid);for(const n of names)await chown(join(sk,n),ids.uid,ids.gid);}
   const build=join(job,'build');
   const args=['compile','-b',fqbn,...(fam==='avr'?AVR_FLAGS:[]),'--build-path',build,sk];
   const ms=fam==='avr'?this.timeouts.avr:this.timeouts.esp32;
   const r=await run(this.o.arduinoCli??'arduino-cli',args,{cwd:job,env:this.env(job),timeoutMs:ms,ids});
   if(r.timedOut)return failed(toolchain,[{line:0,message:'The compile took too long and was stopped.',severity:'error'}],{timedOut:true});
   if(r.overflow)return failed(toolchain,[{line:0,message:'The compiler produced too much output and was stopped.',severity:'error'}]);
   const log=scrub(r.out,job).slice(0,LOG_KEEP);
   const diagnostics=parseDiagnostics(r.out,job);
   if(r.code!==0){
    if(!diagnostics.some(d=>d.severity==='error')){const last=log.split('\n').map(x=>x.trim()).filter(Boolean).pop();diagnostics.push({line:0,message:(last??'The file did not compile.').slice(0,400),severity:'error'});}
    return failed(toolchain,diagnostics.slice(0,20),{log});
   }
   const file=join(build,fam==='avr'?'s.ino.hex':'s.ino.bin');
   const info=await stat(file).catch(()=>undefined);
   if(!info||info.size===0)return failed(toolchain,[{line:0,message:'The compiler produced no output.',severity:'error'}],{log});
   if(info.size>ARTIFACT_MAX)return failed(toolchain,[{line:0,message:`The firmware is ${info.size} bytes; the limit is ${ARTIFACT_MAX}.`,severity:'error'}],{log});
   const bin=await readFile(file);
   const res:CompileResponse={status:'compiled',diagnostics:diagnostics.filter(d=>d.severity==='warning').slice(0,20),sizes:parseSizes(r.out),artifact:bin.toString('base64'),sha256:sha256(bin),toolchain,log};
   if(fam==='avr'&&this.o.objdump){
    // Reads the ELF with objdump (a static dump); the artifact is never executed.
    const d=await run(this.o.objdump,['--dwarf=decodedline',join(build,'s.ino.elf')],{cwd:job,env:this.env(job),timeoutMs:15_000,ids});
    res.dump=scrub(d.out,job).split('\n').filter(l=>/^[^ ]+ +[0-9]+ +(.* +)?0x[0-9a-fA-F]+/.test(l)).join('\n').slice(0,4<<20);
   }
   return res;
  }finally{
   await rm(job,{recursive:true,force:true}).catch(()=>{});
   release();
  }
 }

 async lint(body:{language?:unknown;files?:unknown}):Promise<Record<string,unknown>>{
  const lang=body.language;
  if(lang!=='python'&&lang!=='micropython')throw new HttpError(400,'language must be python or micropython');
  const files=validateFiles(body.files,/\.py$/);
  const release=await this.acquire();
  const job=await this.jobDir();
  try{
   const cmd=this.o.python??['python3','-I','/opt/lint.py'];
   const diagnostics:Diag[]=[];const imports=new Set<string>();let ok=true;
   for(const f of files){
    const r=await run(cmd[0]!,[...cmd.slice(1),lang],{cwd:job,env:{PATH:'/usr/local/bin:/usr/bin:/bin',HOME:job,LANG:'C.UTF-8'},timeoutMs:this.timeouts.lint,stdin:f.content,ids:this.ids()});
    if(r.timedOut){ok=false;diagnostics.push({file:f.name,line:0,message:'The lint took too long and was stopped.',severity:'error'});continue;}
    try{
     const j=JSON.parse(r.out.trim().split('\n').pop()??'') as {ok:boolean;diagnostics:Diag[];imports?:string[]};
     if(!j.ok)ok=false;
     for(const d of j.diagnostics??[])if(diagnostics.length<20)diagnostics.push({file:f.name,line:Math.max(0,d.line|0),message:String(d.message).slice(0,400),severity:d.severity==='warning'?'warning':'error'});
     for(const i of j.imports??[])imports.add(String(i).slice(0,64));
    }catch{ok=false;diagnostics.push({file:f.name,line:0,message:'The linter produced no result.',severity:'error'});}
   }
   return{status:ok?'linted':'failed',ok,diagnostics,imports:[...imports].sort(),toolchain:lang==='python'?TOOLCHAINS.python:TOOLCHAINS.micropython};
  }finally{
   await rm(job,{recursive:true,force:true}).catch(()=>{});
   release();
  }
 }
}

function readBody(req:IncomingMessage):Promise<unknown>{
 return new Promise((resolve,reject)=>{
  const chunks:Buffer[]=[];let size=0,over=false;
  req.on('data',(c:Buffer)=>{size+=c.length;if(over)return;if(size>BODY_MAX){over=true;chunks.length=0;reject(new HttpError(413,'request body too large'));return;}chunks.push(c);});
  req.on('end',()=>{if(over)return;try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(new HttpError(400,'body must be JSON'));}});
  req.on('error',()=>reject(new HttpError(400,'request aborted')));
 });
}
function send(res:ServerResponse,status:number,body:unknown,headers:Record<string,string>={}){
 const s=JSON.stringify(body);
 res.writeHead(status,{'content-type':'application/json','content-length':Buffer.byteLength(s),'cache-control':'no-store',...headers});res.end(s);
}

export function createCompilerServer(o:CompilerOptions):{server:Server;service:CompilerService}{
 const service=new CompilerService(o);   // throws without a valid token
 const server=createServer(async(req,res)=>{
  try{
   const path=(req.url??'/').split('?')[0];
   if(path==='/health'){if(req.method!=='GET')throw new HttpError(405,'method not allowed');return send(res,200,{ok:true,...service.load});}
   if(!tokenOk(req.headers.authorization,o.token))throw new HttpError(401,'unauthorized');
   if(path!=='/compile'&&path!=='/lint')throw new HttpError(404,'not found');
   if(req.method!=='POST')throw new HttpError(405,'method not allowed');
   const body=await readBody(req) as Record<string,unknown>;
   if(!body||typeof body!=='object'||Array.isArray(body))throw new HttpError(400,'body must be a JSON object');
   send(res,200,path==='/compile'?await service.compile(body):await service.lint(body));
  }catch(e){
   if(e instanceof HttpError)return send(res,e.status,{error:e.message},e.status===429?{'retry-after':'10'}:e.status===413?{connection:'close'}:{});
   console.error('compiler error',e instanceof Error?e.message:e);
   send(res,500,{error:'internal error'});
  }
 });
 server.requestTimeout=30_000;server.headersTimeout=10_000;
 return{server,service};
}

/** avr-objdump lives inside the pinned core; find it once at start. */
function findObjdump():string|undefined{
 if(process.env.COMPILER_OBJDUMP)return process.env.COMPILER_OBJDUMP;
 try{
  const base=join(process.env.ARDUINO_DIRECTORIES_DATA??'/opt/arduino/data','packages/arduino/tools/avr-gcc');
  for(const v of readdirSync(base)){const p=join(base,v,'bin/avr-objdump');if(existsSync(p))return p;}
 }catch{/* none */}
 return undefined;
}

const isMain=process.argv[1]!==undefined&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(isMain){
 const token=process.env.COMPILER_TOKEN??'';
 if(token.length<TOKEN_MIN){console.error(`COMPILER_TOKEN is missing or shorter than ${TOKEN_MIN} characters; refusing to start.`);process.exit(1);}
 const env:Record<string,string>={};
 for(const k of ['ARDUINO_DIRECTORIES_DATA','ARDUINO_DIRECTORIES_USER','ARDUINO_BOARD_MANAGER_ADDITIONAL_URLS'])if(process.env[k])env[k]=process.env[k]!;
 const {server}=createCompilerServer({token,objdump:findObjdump(),env,python:process.env.COMPILER_LINT?process.env.COMPILER_LINT.split(' '):undefined});
 const port=Number(process.env.COMPILER_PORT||8795),host=process.env.COMPILER_HOST||'127.0.0.1';
 server.listen(port,host,()=>console.log(`compiler listening on ${host}:${port}`));
 for(const s of ['SIGTERM','SIGINT'])process.on(s,()=>server.close(()=>process.exit(0)));
}
