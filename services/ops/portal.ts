/** School portal API (ADR 010): /ops/v1/portal/*. Cookie session, CSRF header on mutations, every read and write scoped to the session's school. */
import {AllocationDecisionSchema,AllocationProposalSchema,EvidenceSchema,PersonUpdateSchema,PortalActivateSchema,PortalLoginSchema,PortalPersonInputSchema,payoutSplit,portalCan,taskTransition,type Allocation,type Batch,type LabTask,type Organization,type PortalAction} from '../../packages/ops-contract/index.js';
import type {Ops,OpsCall,OpsResult} from './ops.js';
import {fail,parse} from './http.js';

const COOKIE='aiot_portal',PATH='/ops/v1/portal';
const cookieValue=(header:string|undefined)=>{for(const part of (header??'').split(';')){const [k,...v]=part.trim().split('=');if(k===COOKIE)return v.join('=');}return'';};
const setCookie=(value:string,maxAge:number,plainLoopback:boolean)=>`${COOKIE}=${value}; Path=${PATH}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${plainLoopback?'':'; Secure'}`;
const ok=(data:unknown,status=200):OpsResult=>({status,data});
const tooMany={status:429,data:{error:'Too many attempts. Please wait a few minutes and try again.'}};

export async function handlePortal(ops:Ops,call:OpsCall):Promise<OpsResult>{
 const {method,path,body,ip,headers={}}=call,c=ops.commissions,store=ops.store;
 const rest=path.slice('/ops/v1/portal/'.length).split('/');
 if(rest.some(x=>!x))return{status:404,data:{error:'Not found'}};// No trailing slash or empty segments: nginx limits exact paths only.
 const [resource,id,sub]=rest;
 const mutating=method!=='GET'&&method!=='HEAD';
 if(mutating&&headers['x-aiot-portal']!=='1')return{status:403,data:{error:'Missing X-AIoT-Portal header'}};
 const loopback=!!call.plainLoopback;

 if(resource==='activate'&&method==='POST'){
  if(!ops.activateLimit.take(ip))return tooMany;
  const input=parse(PortalActivateSchema,body);const person=await c.activate(input.code,input.password);
  if(!person)return{status:400,data:{error:'This invite code is invalid, used or expired. Ask for a new one.'}};
  const session=c.startSession(person);return{...ok({username:person.username,name:person.name,role:person.role}),setCookie:setCookie(session.token,session.maxAgeSeconds,loopback)};
 }
 if(resource==='login'&&method==='POST'){
  if(!ops.loginLimit.take(ip))return tooMany;
  const input=parse(PortalLoginSchema,body);const person=await c.authenticate(input.username,input.password,ip);
  if(!person)return{status:401,data:{error:'Wrong username or password, or the account is locked for 15 minutes.'}};
  const session=c.startSession(person);return{...ok({username:person.username,name:person.name,role:person.role}),setCookie:setCookie(session.token,session.maxAgeSeconds,loopback)};
 }
 const token=cookieValue(headers.cookie);
 if(resource==='logout'&&method==='POST'){if(token)c.endSession(token);return{...ok({ok:true}),setCookie:setCookie('',0,loopback)};}

 const me=c.session(token);if(!me)return{status:401,data:{error:'Please sign in.'}};
 const org=store.get<Organization>('organizations',me.orgId)!;
 const need=(action:PortalAction)=>{if(!portalCan(me.role,action))fail(403,'Your role cannot do this');};
 const ownTask=(taskId:string|undefined):LabTask=>{const t=taskId?store.get<LabTask>('tasks',taskId):undefined;if(!t||t.labId!==me.orgId)return fail(404,'Task not found');return t;};
 const taskView=(t:LabTask)=>({id:t.id,title:t.title,instructions:t.instructions,status:t.status,evidenceRef:t.evidenceRef,feeIdr:t.feeIdr,payout:payoutSplit(t.feeIdr),leadId:t.leadId??null,leadName:(t.leadId&&c.person(t.leadId)?.name)||'',mine:t.leadId===me.id,batchId:t.batchId??null,allocation:(()=>{const a=c.allocations(me.orgId).filter(x=>x.taskId===t.id&&(x.status==='pending'||x.status==='approved'))[0]??c.allocations(me.orgId).find(x=>x.taskId===t.id);return a?{id:a.id,status:a.status}:null;})()});
 const ownAllocation=(allocId:string|undefined)=>{const a=allocId?store.get<Allocation>('allocations',allocId):undefined;if(!a||a.orgId!==me.orgId)return fail(404,'Allocation not found');return a;};
 const ownBatch=(batchId:string|undefined)=>{const b=batchId?store.get<Batch>('batches',batchId):undefined;if(!b||b.orgId!==me.orgId||b.status==='created')return fail(404,'Batch not found');return b;};

 if(resource==='me'&&method==='GET')return ok({person:{id:me.id,name:me.name,role:me.role,username:me.username},school:{id:org.id,name:org.name,city:org.city},can:Object.fromEntries((['summary.read','people.write','allocations.propose','allocations.decide','batches.confirm'] as const).map(a=>[a,portalCan(me.role,a)]))});
 if(resource==='summary'&&method==='GET'){need('summary.read');return ok(c.totals(me.orgId));}

 if(resource==='people'){
  need('people.read');
  const mine=c.people(me.orgId);
  if(!id&&method==='GET')return ok({people:(me.role==='school_admin'?mine:mine.filter(p=>p.role==='student'&&p.status==='active')).map(p=>{const v=c.view(p);return me.role==='school_admin'?{...v,...(p.role==='student'?c.personTotals(p.id):{})}:{id:p.id,name:p.name,role:p.role,className:p.className,status:p.status};})});
  if(!id&&method==='POST'){
   need('people.write');const input=parse(PortalPersonInputSchema,body);const {person,inviteCode}=await c.createPerson(org,input,me.name);
   return ok({person,inviteCode},201);
  }
  const person=id?c.person(id,me.orgId):undefined;if(!person)return fail(404,'Person not found');
  if(!sub&&method==='PATCH'){need('people.write');if(person.role==='school_admin')fail(403,'School admins are managed by AIoT');return ok(c.updatePerson(person,parse(PersonUpdateSchema,body),me.name));}
  if(sub==='invite'&&method==='POST'){need('people.write');if(person.role!=='teacher')fail(403,'Only teacher invites can be reset here; ask AIoT for a school admin');return ok(await c.resetInvite(person,me.name,{requireIdle:true}));}
 }

 if(resource==='tasks'){
  need('tasks.read');
  if(!id&&method==='GET')return ok({tasks:store.list<LabTask>('tasks').filter(t=>t.labId===me.orgId).map(taskView)});
  if(id&&sub==='evidence'&&method==='POST'){
   need('tasks.evidence');const task=ownTask(id);if(task.leadId!==me.id)fail(403,'Only the lead teacher can submit evidence');
   const input=parse(EvidenceSchema,body);const step=taskTransition(task,{action:'submit',evidenceRef:input.evidenceRef});if('error' in step)return{status:409,data:{error:step.error}};
   const {at,entry}=ops.stamp(me.name,`submit: ${input.evidenceRef}`);
   return ok(taskView(store.put('tasks',{...task,evidenceRef:input.evidenceRef,status:step.status,updatedAt:at,history:[...task.history,entry]})));
  }
 }

 if(resource==='allocations'){
  need('allocations.read');
  const visible=(a:Allocation)=>me.role==='school_admin'||store.get<LabTask>('tasks',a.taskId)?.leadId===me.id;
  if(!id&&method==='GET')return ok({allocations:c.allocations(me.orgId).filter(a=>visible(a)&&(a.status!=='pending'||c.livePending(a))).map(a=>c.allocationView(a))});
  if(!id&&method==='POST'){need('allocations.propose');const input=parse(AllocationProposalSchema,body);return ok(c.allocationView(c.propose(me,ownTask(input.taskId),input.shares)),201);}
  if(id&&method==='POST'&&(sub==='approve'||sub==='reject')){
   need('allocations.decide');const a=ownAllocation(id);
   return ok(c.allocationView(sub==='approve'?c.approve(me,a):c.reject(me,a,parse(AllocationDecisionSchema,body??{}).note)));
  }
 }

 if(resource==='batches'){
  need('batches.read');
  if(!id&&method==='GET')return ok({batches:c.batches(me.orgId).filter(b=>b.status!=='created').map(b=>c.batchView(b))});
  if(id&&sub==='confirm'&&method==='POST'){need('batches.confirm');return ok(c.batchView(c.confirmDistributed(ownBatch(id),me)));}
  if(id&&sub==='csv'&&method==='GET'){const b=ownBatch(id);return{status:200,data:{},text:{type:'text/csv; charset=utf-8',body:c.csv(b),filename:`batch-${b.id.slice(0,8)}.csv`}};}
 }
 return{status:404,data:{error:'Not found'}};
}
