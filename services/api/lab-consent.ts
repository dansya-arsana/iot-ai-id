/** Verifies one-time consent tokens minted by the Electron main process (apps/desktop/consent.cjs) after a native dialog click. */
import {createHmac,timingSafeEqual} from 'node:crypto';
export interface ConsentVerifier{verify(token:unknown,port:string,fileSha?:string):'ok'|'invalid'|'expired'|'replayed'|'wrong_port'|'wrong_sha';}
/** One nonce store for every verifier in the process, so a token can be spent only once anywhere. */
export const sharedNonces=new Map<string,number>();
export function createConsentVerifier(secret:string,now:()=>number=Date.now):ConsentVerifier{
 const used=sharedNonces;
 return{verify(token,port,fileSha){
  if(typeof token!=='string'||!secret)return'invalid';
  const parts=token.split('.');if(parts.length!==3||parts[0]!=='v1'&&parts[0]!=='v2')return'invalid';
  const want=createHmac('sha256',secret).update(`${parts[0]}.${parts[1]}`).digest();
  let got:Buffer;try{got=Buffer.from(parts[2],'base64url');}catch{return'invalid';}
  if(got.length!==want.length||!timingSafeEqual(got,want))return'invalid';
  let p:{port?:unknown;fileSha?:unknown;exp?:unknown;nonce?:unknown};try{p=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));}catch{return'invalid';}
  if(typeof p.port!=='string'||typeof p.exp!=='number'||typeof p.nonce!=='string')return'invalid';
  if(parts[0]==='v2'&&typeof p.fileSha!=='string')return'invalid';
  const t=now();for(const [n,e] of used)if(e<=t)used.delete(n);
  if(p.exp<=t)return'expired';
  if(p.port!==port)return'wrong_port';
  if(parts[0]==='v2'&&fileSha===undefined)return'wrong_sha';
  if(fileSha!==undefined&&(parts[0]!=='v2'||p.fileSha!==fileSha))return'wrong_sha';
  if(used.has(p.nonce))return'replayed';
  used.set(p.nonce,p.exp);return'ok';
 }};
}
