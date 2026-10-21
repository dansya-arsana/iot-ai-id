/** /api/lab/hardware/*: sim to real for an Arduino UNO. Loopback + session gated by server.ts; physical actions need the human-approved trusted port. */
import {createHash} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {z} from 'zod';
import {BridgeError,type SerialHandle,type UnoBridge} from '../../runtime/local-bridge/uno.js';
export const UNO_FLASH_MAX=32256;
export const TRUST_MS=20*60000;
export interface HwResult{status:number;data:unknown}
interface SerialLine{n:number;t:number;text:string}
interface SerialSession{port:string;startedAt:number;lines:SerialLine[];counter:number;open:boolean;end?:{code:string;message?:string};handle:SerialHandle}
/** Raw flash bytes to Intel HEX (the format avrdude is given by arduino-cli upload --input-file). */
export function toIntelHex(bytes:Uint8Array):string{
 const rows:string[]=[];
 for(let addr=0;addr<bytes.length;addr+=16){
  const chunk=bytes.subarray(addr,Math.min(addr+16,bytes.length));
  const record=[chunk.length,(addr>>8)&255,addr&255,0,...chunk];
  const sum=record.reduce((a,b)=>a+b,0);
  rows.push(':'+[...record,(256-(sum&255))&255].map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase());
 }
 rows.push(':00000001FF');return rows.join('\n')+'\n';
}
const trustSchema=z.object({port:z.string().min(1).max(200),authorize:z.literal(true)}).strict();
const uploadSchema=z.object({port:z.string().min(1).max(200),flashBase64:z.string().min(8).max(43008).regex(/^[A-Za-z0-9+/]+={0,2}$/)}).strict();
const portSchema=z.object({port:z.string().min(1).max(200)}).strict();
const fail=(status:number,code:string,message:string):HwResult=>({status,data:{error:message,code}});
const errorResult=(error:unknown):HwResult=>{
 if(error instanceof BridgeError){
  const status={toolchain:424,busy:409,disconnected:410,upload_failed:502,no_board:404}[error.code];
  return fail(status,error.code,error.message);
 }
 return fail(500,'upload_failed',error instanceof Error?error.message:'Hardware error');
};
export function createHardware(options:{bridge:UnoBridge;trusted:Map<string,number>;now?:()=>number}){
 const {bridge,trusted}=options;const now=options.now??Date.now;
 let serial:SerialSession|null=null;let serialTimer:ReturnType<typeof setTimeout>|undefined;let busy=false;
 const stopSerial=()=>{if(serial){clearTimeout(serialTimer);serial.handle.close();serial.open=false;serial=null;}};
 async function detectedUno(port:string){const found=await bridge.detect();return{found,board:found.boards.find(b=>b.port===port)};}
 async function handle(method:string,path:string,query:URLSearchParams,readBody:()=>Promise<unknown>):Promise<HwResult>{
  try{
   if(path==='/api/lab/hardware/detect'&&method==='GET'){
    const found=await bridge.detect();
    const trust:Record<string,string>={};for(const b of found.boards){const at=trusted.get(b.port)??0;if(at>now())trust[b.port]=new Date(at).toISOString();}
    return{status:200,data:{toolchain:found.toolchain,boards:found.boards,trusted:trust}};
   }
   if(path==='/api/lab/hardware/trust'&&method==='POST'){
    const input=trustSchema.parse(await readBody());const {board,found}=await detectedUno(input.port);
    if(!found.toolchain)return fail(424,'toolchain','Arduino toolchain missing');
    if(!board)return fail(404,'no_board','No detected UNO on that port');
    const expires=now()+TRUST_MS;trusted.set(input.port,expires);
    return{status:200,data:{trusted:true,port:input.port,expiresAt:new Date(expires).toISOString()}};
   }
   if(path==='/api/lab/hardware/upload'&&method==='POST'){
    const input=uploadSchema.parse(await readBody());
    if((trusted.get(input.port)??0)<=now())return fail(403,'not_trusted','Authorize this port before uploading');
    if(busy)return fail(409,'busy','An upload is already running');
    const bytes=Buffer.from(input.flashBase64,'base64');
    if(bytes.length===0||bytes.length>UNO_FLASH_MAX)return fail(400,'bad_firmware','Firmware size is outside the UNO flash');
    busy=true;let dir:string|undefined;
    try{
     const {board,found}=await detectedUno(input.port);
     if(!found.toolchain)return fail(424,'toolchain','Arduino toolchain missing');
     if(!board)return fail(410,'disconnected','Board is no longer connected');
     stopSerial();
     dir=await mkdtemp(join(tmpdir(),'aiot-uno-'));const file=join(dir,'lab.hex');
     await writeFile(file,toIntelHex(bytes));
     await bridge.upload(input.port,file);
     return{status:200,data:{uploaded:true,port:input.port,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}};
    }finally{busy=false;if(dir)await rm(dir,{recursive:true,force:true});}
   }
   if(path==='/api/lab/hardware/serial/start'&&method==='POST'){
    const input=portSchema.parse(await readBody());
    if((trusted.get(input.port)??0)<=now())return fail(403,'not_trusted','Authorize this port before reading serial');
    if(busy)return fail(409,'busy','An upload is running');
    const {board}=await detectedUno(input.port);if(!board)return fail(410,'disconnected','Board is no longer connected');
    stopSerial();
    const session:SerialSession={port:input.port,startedAt:now(),lines:[],counter:0,open:true,handle:{close(){}}};
    session.handle=bridge.openSerial(input.port,text=>{session.lines.push({n:++session.counter,t:now()-session.startedAt,text});if(session.lines.length>300)session.lines.shift();},(code,message)=>{session.open=false;if(code!=='closed')session.end={code,message};});
    serial=session;clearTimeout(serialTimer);serialTimer=setTimeout(()=>{if(serial===session)stopSerial();},Math.max(0,(trusted.get(input.port)??0)-now()));serialTimer.unref?.();return{status:200,data:{started:true}};
   }
   if(path==='/api/lab/hardware/serial'&&method==='GET'){
    const since=Number(query.get('since')??0)||0;const s=serial;
    if(s&&(trusted.get(s.port)??0)<=now()){stopSerial();return{status:200,data:{open:false,lines:[]}};}
    if(!s)return{status:200,data:{open:false,lines:[]}};
    return{status:200,data:{open:s.open,end:s.end,lines:s.lines.filter(l=>l.n>since)}};
   }
   if(path==='/api/lab/hardware/serial/stop'&&method==='POST'){stopSerial();return{status:200,data:{stopped:true}};}
   return fail(404,'not_found','Not found');
  }catch(error){
   if(error instanceof z.ZodError)return fail(400,'bad_request','Invalid request');
   return errorResult(error);
  }
 }
 return{handle,stopSerial};
}
