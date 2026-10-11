/** Shared request helpers for the ops core and the portal. */
import {z} from 'zod';
export class HttpError extends Error{constructor(readonly status:number,message:string,readonly issues?:unknown){super(message);}}
export const fail=(status:number,message:string):never=>{throw new HttpError(status,message);};
export function parse<S extends z.ZodTypeAny>(schema:S,value:unknown):z.infer<S>{const result=schema.safeParse(value);if(!result.success)throw new HttpError(400,result.error.issues[0]?.message??'Invalid input',result.error.issues.map(i=>({path:i.path.join('.'),message:i.message})));return result.data;}
/** Cookie helpers shared by the school portal and the staff login. */
export const cookieValue=(header:string|undefined,name:string)=>{for(const part of (header??'').split(';')){const [k,...v]=part.trim().split('=');if(k===name)return v.join('=');}return'';};
export const setCookie=(name:string,path:string,value:string,maxAge:number,plainLoopback:boolean)=>`${name}=${value}; Path=${path}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${plainLoopback?'':'; Secure'}`;
