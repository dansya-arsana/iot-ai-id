import {api} from '../../api';
import {decodeFlash,patchFlash} from '../sim/flash';
import type {FirmwareVariant,ParamValues} from '../contract';

export interface HwBoard{port:string;label:string;vid:string|null;pid:string|null;clone:boolean}
export interface HwDetect{toolchain:boolean;boards:HwBoard[];trusted:Record<string,string>}
export interface HwLine{n:number;t:number;text:string}
export interface HwSerial{open:boolean;end?:{code:string;message?:string};lines:HwLine[]}
export type HwErrorCode='toolchain'|'busy'|'disconnected'|'upload_failed'|'no_board'|'not_trusted'|'bad_firmware'|'unknown';
export class HwError extends Error{constructor(readonly code:HwErrorCode,message:string){super(message);}}

/** The panel only exists on the local API (desktop app or local dev), never on the public host. */
export const isLocalHost=(host:string=globalThis.location?.hostname??'')=>host==='127.0.0.1'||host==='localhost';

async function call<T>(path:string,init?:RequestInit):Promise<T>{
 try{return await api<T>('/lab/hardware'+path,init);}
 catch(e){
  const message=e instanceof Error?e.message:'Request failed';
  const known:Record<string,HwErrorCode>={toolchain:'toolchain',busy:'busy',disconnected:'disconnected',upload_failed:'upload_failed',no_board:'no_board',not_trusted:'not_trusted'};
  throw new HwError(known[(e as {code?:string}).code??'']??guessCode(message),message);
 }
}
function guessCode(m:string):HwErrorCode{
 if(/toolchain/i.test(m))return'toolchain';
 if(/already running|busy|in use/i.test(m))return'busy';
 if(/no longer connected|disconnected/i.test(m))return'disconnected';
 if(/authorize/i.test(m))return'not_trusted';
 if(/No detected UNO/i.test(m))return'no_board';
 if(/upload|avrdude/i.test(m))return'upload_failed';
 return'unknown';
}
export const hw={
 detect:()=>call<HwDetect>('/detect'),
 trust:(port:string)=>call<{trusted:true;expiresAt:string}>('/trust',{method:'POST',body:JSON.stringify({port,authorize:true})}),
 upload:(port:string,flashBase64:string)=>call<{uploaded:true;bytes:number;sha256:string}>('/upload',{method:'POST',body:JSON.stringify({port,flashBase64})}),
 serialStart:(port:string)=>call<{started:true}>('/serial/start',{method:'POST',body:JSON.stringify({port})}),
 serialStop:()=>call<{stopped:true}>('/serial/stop',{method:'POST',body:'{}'}),
 serial:(since:number)=>call<HwSerial>(`/serial?since=${since}`),
};

/** The exact bytes the simulator runs: base firmware with the patched params applied. */
export function simFlashBase64(variant:FirmwareVariant,params:ParamValues):string{
 const {bytes}=patchFlash(decodeFlash(variant.flashBase64),variant.params,params);
 let bin='';for(let i=0;i<bytes.length;i+=0x2000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x2000));
 return globalThis.btoa(bin);
}

export {compareSerial} from './match';
export type {TLine,Match} from './match';
