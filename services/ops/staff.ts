/** Staff accounts (ADR 009 addendum): per-person logins for the admin host, on the same invite/password/session core as the school portal. Never hard-deleted. */
import {randomUUID} from 'node:crypto';
import {PortalActivateSchema,PortalLoginSchema,StaffInputSchema,StaffUpdateSchema,type Role,type Staff} from '../../packages/ops-contract/index.js';
import {Auth} from './auth.js';
import {cookieValue,fail,parse,setCookie} from './http.js';
import type {Ops,OpsCall,OpsResult,OpsStore} from './ops.js';

export const STAFF_COOKIE='aiot_admin';
export type StaffView=Staff&{activated:boolean;inviteExpires?:string};
const LAST_OWNER='This is the last active owner. Make another owner first.';

export class StaffDirectory{
 constructor(readonly store:OpsStore,readonly clock:()=>Date,readonly auth:Auth){}
 private stamp(by:string,action:string){const at=this.clock().toISOString();return{at,entry:{at,by,action}};}
 list(){return this.store.list<Staff>('staff');}
 get(id:string){return this.store.get<Staff>('staff',id);}
 byUsername(username:string){return this.list().find(s=>s.username===username);}
 activeOwners(){return this.list().filter(s=>s.role==='owner'&&s.status==='active');}
 view(s:Staff):StaffView{return{...s,...this.auth.state(s.id)};}
 private active=(id:string)=>{const s=this.get(id);return s&&s.status==='active'?s:undefined;};

 /** Creates an account and returns its one-time invite code. `force` allows a second owner (CLI only). */
 async create(input:{username:string;name:string;role:Role},by:string,opts:{force?:boolean}={}){
  if(input.role==='owner'&&!opts.force&&this.activeOwners().length)fail(409,'An active owner already exists. Create the person with another role, then promote them in Team.');
  const {at,entry}=this.stamp(by,'created');const staff:Staff={id:randomUUID(),username:input.username,name:input.name.trim(),role:input.role,status:'active',createdBy:by,createdAt:at,updatedAt:at,history:[entry]};
  const inv=await this.auth.newInvite();let code='';
  this.store.tx(()=>{
   if(this.auth.usernameTaken(staff.username))return fail(409,`Username ${staff.username} is already used`);
   this.auth.create(staff.id,staff.username);code=this.auth.storeInvite(staff.id,inv);this.store.put('staff',staff);
  });
  return{staff:this.view(staff),inviteCode:code};
 }
 /** Replaces the invite, clears the password and ends sessions. */
 async resetInvite(s:Staff,by:string){
  const inv=await this.auth.newInvite();const {at,entry}=this.stamp(by,'invite reset');let code='';
  this.store.tx(()=>{const fresh=this.active(s.id);if(!fresh)return fail(409,'Person is disabled');code=this.auth.reissue(s.id,inv);this.store.put('staff',{...fresh,updatedAt:at,history:[...fresh.history,entry]});});
  return{staff:this.view(this.get(s.id)!),inviteCode:code};
 }
 /** Role and status changes. The last active owner can be neither demoted nor disabled. Disabling ends sessions. */
 update(s:Staff,changes:{role?:Role;status?:Staff['status']},by:string){
  return this.store.tx(()=>{
   const cur=this.get(s.id);if(!cur)return fail(404,'Person not found');
   const role=changes.role??cur.role,status=changes.status??cur.status;
   if(cur.role==='owner'&&cur.status==='active'&&(role!=='owner'||status!=='active')&&this.activeOwners().length<2)return fail(409,LAST_OWNER);
   if(role===cur.role&&status===cur.status)return this.view(cur);
   const parts=[...(role!==cur.role?[`role ${cur.role} → ${role}`]:[]),...(status!==cur.status?[status==='disabled'?'disabled':'enabled']:[])];
   const {at,entry}=this.stamp(by,parts.join(', '));const next:Staff={...cur,role,status,updatedAt:at,history:[...cur.history,entry]};
   this.store.put('staff',next);if(status==='disabled'&&cur.status!=='disabled')this.auth.revoke(cur.id);
   return this.view(next);
  });
 }
 activate(code:string,password:string){return this.auth.activate(code,password,this.active.bind(this),(fresh,at)=>{this.store.put('staff',{...fresh,updatedAt:at,history:[...fresh.history,{at,by:fresh.name,action:'activated'}]});});}
 authenticate(username:string,password:string,ip:string){return this.auth.authenticate(username,password,ip,this.active.bind(this));}
 startSession(s:Staff){return this.auth.startSession(s.id);}
 session(token:string){const id=this.auth.session(token);return id?this.active(id):undefined;}
 endSession(token:string){this.auth.endSession(token);}
 /** Role for an X-Ops-User name: an account decides by itself (a disabled one gets nothing); `undefined` means "not a staff account". */
 roleOf(user:string):Role|null|undefined{const s=user?this.byUsername(user):undefined;return s?(s.status==='active'?s.role:null):undefined;}
}

const ok=(data:unknown,status=200):OpsResult=>({status,data});
const tooMany={status:429,data:{error:'Too many attempts. Please wait a few minutes and try again.'}};
const me=(s:Staff)=>({username:s.username,name:s.name,role:s.role});

/** Public auth routes under /ops/v1/staff/ plus the internal nginx auth_request target `check`. */
export async function handleStaff(ops:Ops,call:OpsCall):Promise<OpsResult>{
 const {method,path,body,ip,headers={}}=call,dir=ops.staff;
 const rest=path.slice('/ops/v1/staff/'.length).split('/');
 if(rest.length!==1||!rest[0])return{status:404,data:{error:'Not found'}};// No trailing slash or empty segments: nginx limits exact paths only.
 const [resource]=rest,loopback=!!call.plainLoopback,cookie=(v:string,age:number)=>setCookie(STAFF_COOKIE,'/',v,age,loopback);
 const token=cookieValue(headers.cookie,STAFF_COOKIE);
 // Internal only: nginx calls this for auth_request and never proxies it from the public host. Ops itself is not reachable from outside.
 if(resource==='check'&&method==='GET'){const s=dir.session(token);return s?{status:204,data:null,headers:{'X-Staff-User':s.username,'X-Staff-Role':s.role}}:{status:401,data:{error:'Please sign in.'}};}
 const mutating=method!=='GET'&&method!=='HEAD';
 if(mutating&&headers['x-aiot-staff']!=='1')return{status:403,data:{error:'Missing X-AIoT-Staff header'}};
 const start=(s:Staff)=>{const session=dir.startSession(s);return{...ok(me(s)),setCookie:cookie(session.token,session.maxAgeSeconds)};};
 if(resource==='activate'&&method==='POST'){
  if(!ops.activateLimit.take(ip))return tooMany;
  const input=parse(PortalActivateSchema,body);const s=await dir.activate(input.code,input.password);
  return s?start(s):{status:400,data:{error:'This invite code is invalid, used or expired. Ask for a new one.'}};
 }
 if(resource==='login'&&method==='POST'){
  if(!ops.loginLimit.take(ip))return tooMany;
  const input=parse(PortalLoginSchema,body);const s=await dir.authenticate(input.username,input.password,ip);
  return s?start(s):{status:401,data:{error:'Wrong username or password, or the account is locked for 15 minutes.'}};
 }
 if(resource==='logout'&&method==='POST'){if(token)dir.endSession(token);return{...ok({ok:true}),setCookie:cookie('',0)};}
 if(resource==='me'&&method==='GET'){const s=dir.session(token);return s?ok(me(s)):{status:401,data:{error:'Please sign in.'}};}
 return{status:404,data:{error:'Not found'}};
}

/** Owner-only staff management under /ops/v1/admin/staff. `sub` is the id, `action` the optional third segment. */
export async function handleStaffAdmin(ops:Ops,call:OpsCall,role:Role,by:string,id?:string,action?:string):Promise<OpsResult|undefined>{
 const {method,body}=call,dir=ops.staff;
 if(role!=='owner')fail(403,'Only the owner manages staff');
 if(!id&&method==='GET')return ok({staff:dir.list().map(s=>dir.view(s))});
 if(!id&&method==='POST')return ok(await dir.create(parse(StaffInputSchema,body),by),201);
 const s=id?dir.get(id):undefined;if(!s)return{status:404,data:{error:'Person not found'}};
 if(!action&&method==='PATCH')return ok(dir.update(s,parse(StaffUpdateSchema,body),by));
 if(action==='invite'&&method==='POST'){if(s.username===by)fail(400,'Use the CLI to reset your own invite');return ok(await dir.resetInvite(s,by));}
 return undefined;
}
