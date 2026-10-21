/** Arduino UNO side of the lab bridge: detect, upload a prebuilt hex, stream serial. Uses arduino-cli with fixed argv only. */
import {spawn} from 'node:child_process';
import {execute} from '../../services/orchestrator/process.js';
export const UNO_FQBN='arduino:avr:uno';
/** VID:PID of genuine UNO boards, plus the common CH340 and FTDI clones. */
const UNO_IDS=new Set(['2341:0043','2341:0001','2341:0243','2a03:0043','1a86:7523','0403:6001']);
export interface UnoBoard{port:string;label:string;vid:string|null;pid:string|null;clone:boolean}
export type BridgeErrorCode='toolchain'|'busy'|'disconnected'|'upload_failed'|'no_board';
export class BridgeError extends Error{constructor(readonly code:BridgeErrorCode,message:string){super(message);}}
export interface SerialHandle{close():void}
export interface UnoBridge{
 detect():Promise<{toolchain:boolean;boards:UnoBoard[]}>;
 upload(port:string,hexPath:string):Promise<void>;
 openSerial(port:string,onLine:(text:string)=>void,onEnd:(reason:BridgeErrorCode|'closed',message?:string)=>void):SerialHandle;
}
const cli=()=>process.env.ARDUINO_CLI_PATH??process.env.ARDUINO_CLI??'arduino-cli';
const hex4=(v:unknown)=>typeof v==='string'?v.toLowerCase().replace(/^0x/,'').padStart(4,'0'):null;
/** Pure: arduino-cli `board list --format json` output to UNO candidates. */
export function parseUnoBoards(stdout:string):UnoBoard[]{
 let parsed:any;try{parsed=JSON.parse(stdout);}catch{return[];}
 const list=Array.isArray(parsed)?parsed:parsed.detected_ports??[];
 const out:UnoBoard[]=[];
 for(const entry of list){
  const address=entry?.port?.address;if(typeof address!=='string'||entry.port.protocol!=='serial')continue;
  const props=entry.port.properties??{};const vid=hex4(props.vid),pid=hex4(props.pid);
  const byFqbn=(entry.matching_boards??[]).some((b:any)=>b?.fqbn===UNO_FQBN);
  const byId=vid!==null&&pid!==null&&UNO_IDS.has(`${vid}:${pid}`);
  if(!byFqbn&&!byId)continue;
  out.push({port:address,label:(entry.matching_boards?.[0]?.name as string|undefined)??'Arduino UNO',vid,pid,clone:!byFqbn&&vid!=='2341'&&vid!=='2a03'});
 }
 return out;
}
export function classifyFailure(message:string):BridgeErrorCode{
 if(/busy|in use|permission denied|access is denied|could not open/i.test(message))return'busy';
 if(/no such file|not found|disconnected|ENOENT|device not configured|input\/output error/i.test(message)&&!/platform|core/i.test(message))return'disconnected';
 if(/platform|core.*not installed|arduino:avr/i.test(message))return'toolchain';
 return'upload_failed';
}
export const arduinoCliBridge:UnoBridge={
 async detect(){
  try{await execute(cli(),['version'],'',10000);}catch{return{toolchain:false,boards:[]};}
  try{return{toolchain:true,boards:parseUnoBoards(await execute(cli(),['board','list','--format','json'],'',20000))};}catch{return{toolchain:true,boards:[]};}
 },
 async upload(port,hexPath){
  try{await execute(cli(),['upload','-p',port,'-b',UNO_FQBN,'--input-file',hexPath],'',120000);}
  catch(error){const message=error instanceof Error?error.message:'upload failed';const code=classifyFailure(message);
   throw new BridgeError(code==='disconnected'||code==='busy'||code==='toolchain'?code:'upload_failed',message.slice(-300));}
 },
 openSerial(port,onLine,onEnd){
  const child=spawn(cli(),['monitor','-p',port,'-b',UNO_FQBN,'-c','baudrate=9600','--quiet'],{stdio:['pipe','pipe','pipe'],shell:false});
  let buffer='',err='',closed=false;
  child.stdout.on('data',chunk=>{buffer+=String(chunk);const parts=buffer.split(/\r?\n/);buffer=parts.pop()??'';if(buffer.length>2000)buffer='';for(const line of parts)if(line)onLine(line.slice(0,300));});
  child.stderr.on('data',chunk=>{err=(err+chunk).slice(-500);});
  child.on('error',e=>{if(!closed){closed=true;onEnd('toolchain',e.message);}});
  child.on('close',()=>{if(closed)return;closed=true;onEnd(err?classifyFailure(err)==='upload_failed'?'disconnected':classifyFailure(err):'closed',err||undefined);});
  return{close(){closed=true;try{child.kill('SIGTERM');}catch{/* already exited */}}};
 },
};
