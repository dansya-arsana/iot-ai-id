/** Member accounts (ADR 009 addendum): invited clients, partners and schools whose login unlocks areas of iot.ai.id. Same invite/password/session core as staff and the school portal, a separate table and cookie. Never hard-deleted. */
import {randomUUID} from 'node:crypto';
import {MemberInputSchema,MemberUpdateSchema,PortalActivateSchema,PortalLoginSchema,can,type Member,type MemberMe,type Organization,type Role} from '../../packages/ops-contract/index.js';
import {Auth} from './auth.js';
import {cookieValue,fail,parse,setCookie} from './http.js';
import type {Ops,OpsCall,OpsResult,OpsStore} from './ops.js';

export const MEMBER_COOKIE='aiot_member',MEMBER_PATH='/ops/v1/member',HINT_COOKIE='aiot_member_hint';
export type MemberView=Member&{activated:boolean;inviteExpires?:string};

export class MemberDirectory{
 constructor(readonly store:OpsStore,readonly clock:()=>Date,readonly auth:Auth){}
 private stamp(by:string,action:string){const at=this.clock().toISOString();return{at,entry:{at,by,action}};}
 list(){return this.store.list<Member>('members');}
 get(id:string){return this.store.get<Member>('members',id);}
 view(m:Member):MemberView{return{...m,...this.auth.state(m.id)};}
 private active=(id:string)=>{const m=this.get(id);return m&&m.status==='active'?m:undefined;};
 /** An organization link must point at an existing organization; its name fills an empty `orgName`. */
 private org(orgId:string|undefined|null){if(!orgId)return undefined;const o=this.store.get<Organization>('organizations',orgId);if(!o)return fail(400,'Unknown organization');return o;}

 /** Creates an account and returns its one-time invite code. */
 async create(input:{username:string;name:string;orgName:string;orgId?:string;grants:Member['grants']},by:string){
  const org=this.org(input.orgId),{at,entry}=this.stamp(by,'created');
  const m:Member={id:randomUUID(),username:input.username,name:input.name.trim(),orgName:input.orgName.trim()||org?.name||'',...(org?{orgId:org.id}:{}),grants:input.grants,status:'active',createdBy:by,createdAt:at,updatedAt:at,history:[entry]};
  const inv=await this.auth.newInvite();let code='';
  this.store.tx(()=>{
   if(this.auth.usernameTaken(m.username))return fail(409,`Username ${m.username} is already used`);
   this.auth.create(m.id,m.username);code=this.auth.storeInvite(m.id,inv);this.store.put('members',m);
  });
  return{member:this.view(m),inviteCode:code};
 }
 /** Replaces the invite, clears the password and ends sessions. */
 async resetInvite(m:Member,by:string){
  const inv=await this.auth.newInvite();const {at,entry}=this.stamp(by,'invite reset');let code='';
  this.store.tx(()=>{const fresh=this.active(m.id);if(!fresh)return fail(409,'Member is disabled');code=this.auth.reissue(m.id,inv);this.store.put('members',{...fresh,updatedAt:at,history:[...fresh.history,entry]});});
  return{member:this.view(this.get(m.id)!),inviteCode:code};
 }
 /** Name, organization, grants and status changes, each recorded in the history. Disabling ends sessions. Enabling a member who never activated issues a fresh invite (returned once as `inviteCode`), because disabling voided the old one. */
 async update(m:Member,changes:{name?:string;orgName?:string;orgId?:string|null;grants?:Member['grants'];status?:Member['status']},by:string){
  const before=this.get(m.id);
  const inv=before&&changes.status==='active'&&before.status==='disabled'&&!this.auth.state(before.id).activated?await this.auth.newInvite():undefined;
  let code:string|undefined;
  const view=this.store.tx(()=>{
   const cur=this.get(m.id);if(!cur)return fail(404,'Member not found');
   const org=this.org(changes.orgId),next:Member={...cur};const parts:string[]=[];
   if(changes.name!==undefined&&changes.name.trim()!==cur.name){next.name=changes.name.trim();parts.push('name');}
   if(changes.orgId===null&&cur.orgId){delete next.orgId;parts.push('organization unlinked');}
   if(org&&org.id!==cur.orgId){next.orgId=org.id;if(changes.orgName===undefined)next.orgName=org.name;parts.push(`organization → ${org.name}`);}
   if(changes.orgName!==undefined&&changes.orgName.trim()!==next.orgName){next.orgName=changes.orgName.trim();parts.push('organization name');}
   if(changes.grants&&changes.grants.join()!==cur.grants.join()){next.grants=changes.grants;parts.push(`grants ${cur.grants.join(',')||'none'} → ${changes.grants.join(',')||'none'}`);}
   if(changes.status&&changes.status!==cur.status){next.status=changes.status;parts.push(changes.status==='disabled'?'disabled':'enabled');}
   const reinvite=!!inv&&cur.status==='disabled'&&next.status==='active'&&!this.auth.state(cur.id).activated;
   if(reinvite)parts.push('new invite issued');
   if(!parts.length)return this.view(cur);
   const {at,entry}=this.stamp(by,parts.join(', '));next.updatedAt=at;next.history=[...cur.history,entry];
   this.store.put('members',next);if(next.status==='disabled'&&cur.status!=='disabled')this.auth.revoke(cur.id);
   if(reinvite)code=this.auth.reissue(cur.id,inv!);
   return this.view(next);
  });
  return code?{...view,inviteCode:code}:view;
 }
 /** Records an installer download in the member's history. */
 logDownload(m:Member){const cur=this.get(m.id);if(!cur)return;const {at,entry}=this.stamp(cur.name,'installer download');this.store.put('members',{...cur,updatedAt:at,history:[...cur.history,entry]});}
 activate(code:string,password:string){return this.auth.activate(code,password,this.active.bind(this),(fresh,at)=>{this.store.put('members',{...fresh,updatedAt:at,history:[...fresh.history,{at,by:fresh.name,action:'activated'}]});});}
 authenticate(username:string,password:string,ip:string){return this.auth.authenticate(username,password,ip,this.active.bind(this));}
 startSession(m:Member){return this.auth.startSession(m.id);}
 session(token:string){const id=this.auth.session(token);return id?this.active(id):undefined;}
 endSession(token:string){this.auth.endSession(token);}
}

const ok=(data:unknown,status=200):OpsResult=>({status,data});
const tooMany={status:429,data:{error:'Too many attempts. Please wait a few minutes and try again.'}};
const me=(m:Member):MemberMe=>({name:m.name,org:m.orgName,grants:m.grants});
/** The configured installer link; only https URLs are ever redirected to. */
const installerUrl=()=>{try{const u=new URL(process.env.OPS_INSTALLER_URL??'');return u.protocol==='https:'?u.href:undefined;}catch{return undefined;}};

/** Public member routes under /ops/v1/member/: sign in with an invite code, `me`, `installer`. Cookie session, CSRF header on writes. */
export async function handleMember(ops:Ops,call:OpsCall):Promise<OpsResult>{
 const {method,path,body,ip,headers={}}=call,dir=ops.members;
 const rest=path.slice('/ops/v1/member/'.length).split('/');
 if(rest.length!==1||!rest[0])return{status:404,data:{error:'Not found'}};// No trailing slash or empty segments: nginx limits exact paths only.
 const [resource]=rest,loopback=!!call.plainLoopback,cookie=(v:string,age:number)=>setCookie(MEMBER_COOKIE,MEMBER_PATH,v,age,loopback);
 const token=cookieValue(headers.cookie,MEMBER_COOKIE);
 const mutating=method!=='GET'&&method!=='HEAD';
 if(mutating&&headers['x-aiot-member']!=='1')return{status:403,data:{error:'Missing X-AIoT-Member header'}};
 // A readable hint cookie tells the page whether a `me` probe is worth making; it is never proof of access.
 const hint=(on:boolean,age=0)=>setCookie(HINT_COOKIE,'/',on?'1':'',age,loopback).replace('; HttpOnly','');
 const start=(m:Member)=>{const session=dir.startSession(m);return{...ok(me(m)),setCookie:[cookie(session.token,session.maxAgeSeconds),hint(true,session.maxAgeSeconds)]};};
 if(resource==='activate'&&method==='POST'){
  if(!ops.activateLimit.take(ip))return tooMany;
  const input=parse(PortalActivateSchema,body);const m=await dir.activate(input.code,input.password);
  return m?start(m):{status:400,data:{error:'This invite code is invalid, used or expired. Ask for a new one.'}};
 }
 if(resource==='login'&&method==='POST'){
  if(!ops.loginLimit.take(ip))return tooMany;
  const input=parse(PortalLoginSchema,body);const m=await dir.authenticate(input.username,input.password,ip);
  return m?start(m):{status:401,data:{error:'Wrong username or password, or the account is locked for 15 minutes.'}};
 }
 if(resource==='logout'&&method==='POST'){if(token)dir.endSession(token);return{...ok({ok:true}),setCookie:[cookie('',0),hint(false)]};}
 if(resource==='me'&&method==='GET'){const m=dir.session(token);return m?ok(me(m)):{status:401,data:{error:'Please sign in.'},setCookie:hint(false)};}
 if(resource==='installer'&&method==='GET'){
  const m=dir.session(token);if(!m)return{status:401,data:{error:'Please sign in.'}};
  if(!m.grants.includes('installer'))return{status:403,data:{error:'Your account does not include the installer yet.'}};
  const url=installerUrl();if(!url)return{status:503,data:{error:'The installer download is not configured yet. Please contact AIoT.'}};
  dir.logDownload(m);return{status:302,data:null,redirect:url};
 }
 return{status:404,data:{error:'Not found'}};
}

/** Member management under /ops/v1/admin/members, for the owner and sales (the roles that may change organizations). `id` and `action` are the path segments after `members`. */
export async function handleMemberAdmin(ops:Ops,call:OpsCall,role:Role,by:string,id?:string,action?:string):Promise<OpsResult|undefined>{
 const {method,body}=call,dir=ops.members;
 if(!can(role,'organizations',true))fail(403,'Only the owner and sales manage members');
 if(!id&&method==='GET')return ok({members:dir.list().map(m=>dir.view(m))});
 if(!id&&method==='POST')return ok(await dir.create(parse(MemberInputSchema,body),by),201);
 const m=id?dir.get(id):undefined;if(!m)return{status:404,data:{error:'Member not found'}};
 if(!action&&method==='PATCH')return ok(await dir.update(m,parse(MemberUpdateSchema,body),by));
 if(action==='invite'&&method==='POST')return ok(await dir.resetInvite(m,by));
 return undefined;
}
