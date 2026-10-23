/** /api/pro/hardware/*: ESP32 detect, flash of an ops artifact by sha, serial sessions. The UNO path (lab-hardware.ts) is untouched.
 * Every physical action (flash, serial start) needs a one-time native consent token bound to port + file sha. No dev bypass, no trust window. */
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {z} from 'zod';
import {sharedNonces} from './lab-consent.js';
import {execute} from '../orchestrator/process.js';
export interface HwResult{status:number;data:unknown}
export const ESP32_IDS:Record<string,string>={'10c4:ea60':'CP210x UART','1a86:7523':'CH340 UART','303a:1001':'ESP32-S3 native USB'};
export const ESP32_FLASH_MAX=4<<20;
export const SERIAL_SHA='serial';
export type Esp32ErrorCode='toolchain'|'busy'|'disconnected'|'flash_failed';
export class Esp32Error extends Error{constructor(readonly code:Esp32ErrorCode,message:string){super(message);}}
export interface Esp32Board{port:string;label:string;vid:string;pid:string;chip:string}
export interface Esp32SerialHandle{close():void}
export interface Esp32Bridge{
 detect():Promise<{toolchain:boolean;boards:Esp32Board[]}>;
 flash(port:string,file:string):Promise<void>;
 openSerial(port:string,onLine:(text:string)=>void,onEnd:(reason:Esp32ErrorCode|'closed',message?:string)=>void):Esp32SerialHandle;
}
const hex4=(v:unknown)=>typeof v==='string'?v.toLowerCase().replace(/^0x/,'').padStart(4,'0'):null;
/** Pure: arduino-cli `board list --format json` output to ESP32 candidates by VID:PID. */
export function parseEsp32Boards(stdout:string):Esp32Board[]{
 let parsed:any;try{parsed=JSON.parse(stdout);}catch{return[];}
 const list=Array.isArray(parsed)?parsed:parsed.detected_ports??[];const out:Esp32Board[]=[];
 for(const entry of list){
  const address=entry?.port?.address;if(typeof address!=='string'||entry.port.protocol!=='serial')continue;
  const props=entry.port.properties??{};const vid=hex4(props.vid),pid=hex4(props.pid);
  if(vid===null||pid===null)continue;const label=ESP32_IDS[`${vid}:${pid}`];if(!label)continue;
  out.push({port:address,label,vid,pid,chip:vid==='303a'?'esp32s3':'esp32'});
 }
 return out;
}
/** Consent token v1: `v1.<b64url payload {port,sha,exp,nonce}>.<b64url hmac>`, minted by apps/desktop/consent.cjs. */
export function createFlashConsentVerifier(secret:string,now:()=>number=Date.now){
 const used=sharedNonces;
 return{verify(token:unknown,port:string,sha:string):'ok'|'invalid'|'expired'|'replayed'|'wrong_port'|'wrong_file'{
  if(typeof token!=='string'||!secret)return'invalid';
  const parts=token.split('.');if(parts.length!==3||(parts[0]!=='v2'&&parts[0]!=='v3'))return'invalid';
  const want=createHmac('sha256',secret).update(`${parts[0]}.${parts[1]}`).digest();
  let got:Buffer;try{got=Buffer.from(parts[2],'base64url');}catch{return'invalid';}
  if(got.length!==want.length||!timingSafeEqual(got,want))return'invalid';
  let p:{port?:unknown;sha?:unknown;fileSha?:unknown;purpose?:unknown;exp?:unknown;nonce?:unknown};try{p=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));}catch{return'invalid';}
  // v2 {port,fileSha} authorizes one flash; v3 {port,purpose:'serial'} one serial session. v1 (UNO) is never accepted here.
  if(parts[0]==='v2'&&typeof p.fileSha==='string'&&sha!==SERIAL_SHA)p.sha=p.fileSha;
  else if(parts[0]==='v3'&&p.purpose==='serial'&&sha===SERIAL_SHA)p.sha=SERIAL_SHA;
  if(typeof p.port!=='string'||typeof p.sha!=='string'||typeof p.exp!=='number'||typeof p.nonce!=='string')return'invalid';
  const t=now();for(const [n,e] of used)if(e<=t)used.delete(n);
  if(p.exp<=t)return'expired';
  if(p.port!==port)return'wrong_port';
  if(p.sha!==sha)return'wrong_file';
  if(used.has(p.nonce))return'replayed';
  used.set(p.nonce,p.exp);return'ok';
 }};
}
const esptool=()=>process.env.ESPTOOL_PATH??'esptool.py';
const cli=()=>process.env.ARDUINO_CLI_PATH??process.env.ARDUINO_CLI??'arduino-cli';
const classify=(m:string):Esp32ErrorCode=>/busy|in use|permission denied|could not open|access is denied/i.test(m)?'busy':/no such file|disconnected|device not configured|input\/output error/i.test(m)?'disconnected':'flash_failed';
/** Real bridge: esptool for flash (fixed argv, never a shell), arduino-cli for detect and monitor. */
export const esp32Bridge:Esp32Bridge={
 async detect(){
  try{await execute(esptool(),['version'],'',10000);}catch{return{toolchain:false,boards:[]};}
  try{return{toolchain:true,boards:parseEsp32Boards(await execute(cli(),['board','list','--format','json'],'',20000))};}catch{return{toolchain:true,boards:[]};}
 },
 async flash(port,file){
  const offset=process.env.AIOT_ESP32_FLASH_OFFSET??'0x10000';
  try{await execute(esptool(),['--port',port,'--baud','460800','write_flash',offset,file],'',180000);}
  catch(error){const m=error instanceof Error?error.message:'flash failed';const c=classify(m);throw new Esp32Error(c,m.slice(-300));}
 },
 openSerial(port,onLine,onEnd){
  const child=spawn(cli(),['monitor','-p',port,'-c','baudrate=115200','--quiet'],{stdio:['pipe','pipe','pipe'],shell:false});
  let buffer='',err='',closed=false;
  child.stdout.on('data',chunk=>{buffer+=String(chunk);const parts=buffer.split(/\r?\n/);buffer=parts.pop()??'';if(buffer.length>2000)buffer='';for(const line of parts)if(line)onLine(line.slice(0,300));});
  child.stderr.on('data',chunk=>{err=(err+chunk).slice(-500);});
  child.on('error',e=>{if(!closed){closed=true;onEnd('toolchain',e.message);}});
  child.on('close',()=>{if(closed)return;closed=true;onEnd(err?classify(err)==='flash_failed'?'disconnected':classify(err):'closed',err||undefined);});
  return{close(){closed=true;try{child.kill('SIGTERM');}catch{/* already exited */}}};
 },
};
const consentField=z.string().min(1).max(2000);
const flashSchema=z.object({port:z.string().min(1).max(200),artifactSha:z.string().regex(/^[0-9a-f]{64}$/),consent:consentField.optional()}).strict();
const serialSchema=z.object({port:z.string().min(1).max(200),consent:consentField.optional()}).strict();
const fail=(status:number,code:string,message:string):HwResult=>({status,data:{error:message,code}});
interface Line{n:number;t:number;text:string}
interface Session{port:string;startedAt:number;lines:Line[];counter:number;open:boolean;end?:{code:string;message?:string};handle:Esp32SerialHandle}
export function createProHardware(options:{bridge:Esp32Bridge;artifact:(sha:string)=>Promise<Buffer|undefined>|Buffer|undefined;consentSecret?:string;now?:()=>number}){
 const {bridge}=options;const now=options.now??Date.now;
 const secret=options.consentSecret??process.env.AIOT_CONSENT_SECRET??'';
 const consent=createFlashConsentVerifier(secret,now);
 let serial:Session|null=null;let busy=false;
 const stopSerial=()=>{if(serial){serial.handle.close();serial.open=false;serial=null;}};
 const needConsent=(token:unknown,port:string,sha:string):HwResult|null=>{
  if(!secret)return fail(403,'consent_required','Board access needs the AIoT desktop app (native approval)');
  const v=consent.verify(token,port,sha);
  if(v==='ok')return null;
  return fail(403,'consent_required',v==='wrong_port'?'Consent was given for a different port':v==='wrong_file'?'Consent was given for a different file':'Approve the action in the desktop app dialog first');
 };
 async function handle(method:string,path:string,query:URLSearchParams,readBody:()=>Promise<unknown>):Promise<HwResult>{
  try{
   if(path==='/api/pro/hardware/detect'&&method==='GET'){const f=await bridge.detect();return{status:200,data:{toolchain:f.toolchain,boards:f.boards}};}
   if(path==='/api/pro/hardware/flash'&&method==='POST'){
    const input=flashSchema.parse(await readBody());
    if(!secret||typeof input.consent!=='string')return needConsent(input.consent,input.port,input.artifactSha)!;
    if(busy)return fail(409,'busy','A flash is already running');
    busy=true;let dir:string|undefined;
    try{
     const bytes=await options.artifact(input.artifactSha);
     if(!bytes||createHash('sha256').update(bytes).digest('hex')!==input.artifactSha)return fail(404,'no_artifact','Artifact not found for that sha');
     if(bytes.length===0||bytes.length>ESP32_FLASH_MAX)return fail(400,'bad_firmware','Firmware size is outside the allowed range');
     const found=await bridge.detect();
     if(!found.toolchain)return fail(424,'toolchain','ESP32 toolchain missing');
     if(!found.boards.some(b=>b.port===input.port))return fail(410,'disconnected','No ESP32 on that port');
     const denied=needConsent(input.consent,input.port,input.artifactSha);if(denied)return denied;
     stopSerial();
     dir=await mkdtemp(join(tmpdir(),'aiot-esp32-'));const file=join(dir,'app.bin');
     await writeFile(file,bytes);await bridge.flash(input.port,file);
     return{status:200,data:{flashed:true,port:input.port,bytes:bytes.length,sha256:input.artifactSha}};
    }finally{busy=false;if(dir)await rm(dir,{recursive:true,force:true});}
   }
   if(path==='/api/pro/hardware/serial/start'&&method==='POST'){
    const input=serialSchema.parse(await readBody());
    if(!secret||typeof input.consent!=='string')return needConsent(input.consent,input.port,SERIAL_SHA)!;
    if(busy)return fail(409,'busy','A flash is running');
    const found=await bridge.detect();if(!found.boards.some(b=>b.port===input.port))return fail(410,'disconnected','No ESP32 on that port');
    const denied=needConsent(input.consent,input.port,SERIAL_SHA);if(denied)return denied;
    stopSerial();
    const s:Session={port:input.port,startedAt:now(),lines:[],counter:0,open:true,handle:{close(){}}};
    s.handle=bridge.openSerial(input.port,text=>{s.lines.push({n:++s.counter,t:now()-s.startedAt,text});if(s.lines.length>300)s.lines.shift();},(code,message)=>{s.open=false;if(code!=='closed')s.end={code,message};});
    serial=s;return{status:200,data:{started:true}};
   }
   if(path==='/api/pro/hardware/serial'&&method==='GET'){
    const since=Number(query.get('since')??0)||0;const s=serial;
    if(!s)return{status:200,data:{open:false,lines:[]}};
    return{status:200,data:{open:s.open,end:s.end,lines:s.lines.filter(l=>l.n>since)}};
   }
   if(path==='/api/pro/hardware/serial/stop'&&method==='POST'){stopSerial();return{status:200,data:{stopped:true}};}
   return fail(404,'not_found','Not found');
  }catch(error){
   if(error instanceof z.ZodError)return fail(400,'bad_request','Invalid request');
   if(error instanceof Esp32Error){return fail({toolchain:424,busy:409,disconnected:410,flash_failed:502}[error.code],error.code,error.message);}
   return fail(500,'flash_failed',error instanceof Error?error.message:'Hardware error');
  }
 }
 return{handle,stopSerial};
}
