/** Verifies one-time consent tokens minted by the Electron main process (apps/desktop/consent.cjs) after a native dialog click. */
import {createHmac,timingSafeEqual} from 'node:crypto';
export interface ConsentVerifier{verify(token:unknown,port:string):'ok'|'invalid'|'expired'|'replayed'|'wrong_port';}
export function createConsentVerifier(secret:string,now:()=>number=Date.now):ConsentVerifier{
 const used=new Map<string,number>();
 return{verify(token,port){
  if(typeof token!=='string'||!secret)return'invalid';
  const parts=token.split('.');if(parts.length!==3||parts[0]!=='v1')return'invalid';
  const want=createHmac('sha256',secret).update(`v1.${parts[1]}`).digest();
  let got:Buffer;try{got=Buffer.from(parts[2],'base64url');}catch{return'invalid';}
  if(got.length!==want.length||!timingSafeEqual(got,want))return'invalid';
  let p:{port?:unknown;exp?:unknown;nonce?:unknown};try{p=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));}catch{return'invalid';}
  if(typeof p.port!=='string'||typeof p.exp!=='number'||typeof p.nonce!=='string')return'invalid';
  const t=now();for(const [n,e] of used)if(e<=t)used.delete(n);
  if(p.exp<=t)return'expired';
  if(p.port!==port)return'wrong_port';
  if(used.has(p.nonce))return'replayed';
  used.set(p.nonce,p.exp);return'ok';
 }};
}
