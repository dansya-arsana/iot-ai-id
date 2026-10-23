/** Business operations core: SQLite store plus a transport-free request handler shared by the ops server and the local API. */
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Ledger} from './ledger.js';
import {Commissions} from './commissions.js';
import {HttpError,fail,parse} from './http.js';
import {z} from 'zod';
import {handlePortal} from './portal.js';
import {Auth} from './auth.js';
import {StaffDirectory,handleStaff,handleStaffAdmin} from './staff.js';
import {MemberDirectory,handleMember,handleMemberAdmin} from './members.js';
import {LabAi,handleLab,type LabDeps} from './lab-ai.js';
import {handleCatalog} from './catalog.js';
import {handleProAdmin} from './pro.js';
import {installPro,handleProInstalled,callTool} from './pro-wiring.js';
import {
 InquiryInputSchema,InquiryUpdateSchema,OrganizationInputSchema,OrganizationUpdateSchema,ProductInputSchema,ProductUpdateSchema,TaskInputSchema,TaskActionSchema,
 SchoolAdminInputSchema,ReasonSchema,PersonUpdateSchema,BatchCreateSchema,BatchPaidSchema,INQUIRY_STATUSES,ORG_TYPES,PRODUCT_STATUSES,TASK_STATUSES,can,permissions,resolveRole,payoutSplit,productErrors,publicProduct,taskTransition,
 type Inquiry,type Organization,type Product,type LabTask,type Batch,type Allocation,type Role,type Resource,
} from '../../packages/ops-contract/index.js';

const UuidSchema=z.string().uuid({error:'Invalid id'});
const kinds=['inquiries','organizations','products','tasks','people','allocations','batches','staff','members'] as const;
type Kind=typeof kinds[number];
type Row={id:string;createdAt:string;updatedAt:string;history:{at:string;by:string;action:string}[]};

export class OpsStore{
 readonly db:DatabaseSync;readonly ledger:Ledger;
 constructor(path:string){if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});this.db=new DatabaseSync(path);this.db.exec('PRAGMA journal_mode=WAL;');for(const kind of kinds)this.db.exec(`CREATE TABLE IF NOT EXISTS ${kind}(id TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`);this.ledger=new Ledger(this.db);}
 /** Runs `fn` atomically. Synchronous only: do not await inside. */
 tx<T>(fn:()=>T):T{this.db.exec('BEGIN IMMEDIATE');try{const out=fn();this.db.exec('COMMIT');return out;}catch(error){this.db.exec('ROLLBACK');throw error;}}
 put<T extends Row>(kind:Kind,value:T){this.db.prepare(`INSERT INTO ${kind}(id,payload,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`).run(value.id,JSON.stringify(value),value.createdAt,value.updatedAt);return value;}
 get<T>(kind:Kind,id:string):T|undefined{const row=this.db.prepare(`SELECT payload FROM ${kind} WHERE id=?`).get(id);return row?JSON.parse(row.payload as string):undefined;}
 list<T>(kind:Kind):T[]{return this.db.prepare(`SELECT payload FROM ${kind} ORDER BY created_at DESC,rowid DESC`).all().map(row=>JSON.parse(row.payload as string));}
}

/** `headers` are lowercase request headers (portal cookie and CSRF); `plainLoopback` is true only for plain-http requests straight from this machine. */
export type OpsCall={method:string;path:string;body?:unknown;ip:string;admin?:{user:string};headers?:Record<string,string|undefined>;plainLoopback?:boolean};
/** `text` replaces the JSON body (CSV export); `setCookie` is a full Set-Cookie value; `headers` are extra response headers (staff check). */
export type OpsResult={status:number;data:unknown;setCookie?:string|string[];headers?:Record<string,string>;/** 302 target (member installer). */redirect?:string;text?:{type:string;body:string;filename?:string}};

/** Per-IP and global limits for the public form. In memory: a restart resets them, which is acceptable for a contact form. */
export class RateLimit{
 private hits=new Map<string,number[]>();private global:number[]=[];
 constructor(readonly perIp=5,readonly windowMs=10*60_000,readonly globalPerHour=300){}
 take(ip:string,now=Date.now()){
  const recent=(this.hits.get(ip)??[]).filter(t=>now-t<this.windowMs);this.global=this.global.filter(t=>now-t<3_600_000);
  if(recent.length>=this.perIp||this.global.length>=this.globalPerHour){this.hits.set(ip,recent);return false;}
  recent.push(now);this.global.push(now);this.hits.set(ip,recent);if(this.hits.size>10_000)this.hits.clear();return true;
 }
}

export class Ops{
 readonly commissions:Commissions;readonly staff:StaffDirectory;readonly members:MemberDirectory;readonly labAi:LabAi;readonly loginLimit=new RateLimit(20,10*60_000,2000);readonly activateLimit=new RateLimit(10,10*60_000,500);
 constructor(readonly store:OpsStore,readonly roles=new Map<string,Role>(),readonly limit=new RateLimit(),readonly clock=()=>new Date(),labDeps:Partial<LabDeps>={}){const auth=new Auth(store,clock);this.commissions=new Commissions(store,clock,auth);this.staff=new StaffDirectory(store,clock,auth);this.members=new MemberDirectory(store,clock,auth);this.labAi=new LabAi(this,labDeps);}
 /** A staff account decides its own role (disabled: none); other users fall back to OPS_ROLES, or single-owner when none are configured (desktop and dev). */
 roleFor(user:string):Role|undefined{const r=this.staff.roleOf(user);return r===undefined?resolveRole(user,this.roles):r??undefined;}

 async handle(call:OpsCall):Promise<OpsResult|undefined>{
  try{return await this.route(call);}
  catch(error){if(error instanceof HttpError)return{status:error.status,data:{error:error.message,...(error.issues?{issues:error.issues}:{})}};throw error;}
 }

 stamp(by:string,action:string){const at=this.clock().toISOString();return{at,entry:{at,by,action}};}

 private async route(call:OpsCall):Promise<OpsResult|undefined>{
  const {method,path,body,ip,admin}=call;
  if(!path.startsWith('/ops/v1/'))return undefined;
  // Public surface: the inquiry form, the distributor catalog and the Lab Mitra board.
  if(path==='/ops/v1/inquiries'&&method==='POST'){
   const raw=(body&&typeof body==='object'?body:{}) as Record<string,unknown>;
   const {website,...input}=raw;
   if(typeof website==='string'&&website.trim())return{status:202,data:{ok:true}};// Honeypot: accept silently, store nothing.
   if(!this.limit.take(ip))return{status:429,data:{error:'Too many requests. Please try again later or contact us on WhatsApp.'}};
   const data=parse(InquiryInputSchema,input);const {consent:_consent,...fields}=data;const {at}=this.stamp('public','received');
   const inquiry:Inquiry={...fields,id:randomUUID(),status:'new',assignee:'',consentAt:at,createdAt:at,updatedAt:at,history:[{at,by:'public',action:'received'}]};
   this.store.put('inquiries',inquiry);
   return{status:201,data:{ok:true,reference:inquiry.id.slice(0,8).toUpperCase()}};
  }
  if(path==='/ops/v1/catalog'&&method==='GET'){
   const vendors=new Map(this.store.list<Organization>('organizations').map(o=>[o.id,o.name]));
   const products=this.store.list<Product>('products').filter(p=>p.published&&p.status!=='evaluating'&&p.status!=='discontinued').map(p=>publicProduct(p,vendors.get(p.vendorId)??''));
   return{status:200,data:{products}};
  }
  if(path==='/ops/v1/labs'&&method==='GET')return{status:200,data:{labs:this.board()}};
  if(path.startsWith('/ops/v1/portal/'))return handlePortal(this,call);
  if(path.startsWith('/ops/v1/staff/'))return handleStaff(this,call);
  if(path.startsWith('/ops/v1/lab/')||path.startsWith('/ops/v1/member/lab/'))return handleLab(this,call);// Lab AI builder (ADR 011); the member/ alias is where the member cookie is sent.
  if(path.startsWith('/ops/v1/catalog/')||path.startsWith('/ops/v1/member/catalog/'))return handleCatalog(this,call);// Parts catalog (plan M2): staff review, member search and proposals. The query string is kept on call.path.
  if(path.startsWith('/ops/v1/member/pro/'))return handleProInstalled(this,call);// Pro architect (ADR 012).
  if(path.startsWith('/ops/v1/member/'))return handleMember(this,call);
  if(!path.startsWith('/ops/v1/admin/'))return{status:404,data:{error:'Not found'}};

  // Owner side: the caller has already authenticated the gateway user; roles decide what they may do.
  if(!admin)return{status:401,data:{error:'Admin authorization required'}};
  const role=this.roleFor(admin.user);if(!role)return{status:403,data:{error:`User ${admin.user||'(none)'} has no role. Add it to OPS_ROLES.`}};
  const by=admin.user||'owner';
  const need=(resource:Resource,write:boolean)=>{if(!can(role,resource,write))fail(403,`Role ${role} cannot ${write?'change':'read'} ${resource}`);};
  const rest=path.slice('/ops/v1/admin/'.length).split('/');const [resource,id,sub]=rest;

  if(resource==='staff'){const r=await handleStaffAdmin(this,call,role,by,id,sub);if(r)return r;}
  if(resource==='members'){const r=await handleMemberAdmin(this,call,role,by,id,sub);if(r)return r;}
  if(resource==='pro'){
   // Owner-token loopback for the MCP bridge: POST /ops/v1/admin/pro/tools/:name {input,subject?}. Same dispatcher, same checks; the subject must own the project.
   if(id==='tools'&&sub&&method==='POST'){
    if(role!=='owner')return{status:403,data:{error:'Only the owner may call Pro tools directly'}};
    const b=(body&&typeof body==='object'?body:{}) as {input?:unknown;subject?:unknown};
    const r=await callTool(installPro(this),typeof b.subject==='string'&&/^(member|staff):[\w-]{1,64}$/.test(b.subject)?b.subject:'staff:'+by,sub,b.input);
    return r.ok?{status:200,data:r.output}:{status:r.error.status,data:{error:r.error.code,message:r.error.message}};
   }
   installPro(this);return handleProAdmin(this,call,role,by,rest.slice(1));
  }
  if(resource==='me'&&method==='GET')return{status:200,data:{user:by,role,permissions:permissions(role)}};
  if(resource==='summary'&&method==='GET')return{status:200,data:this.summary()};

  if(resource==='inquiries'){
   if(!id&&method==='GET'){need('inquiries',false);return{status:200,data:{inquiries:this.store.list<Inquiry>('inquiries')}};}
   const inquiry=id?this.store.get<Inquiry>('inquiries',id):undefined;if(!inquiry)return{status:404,data:{error:'Inquiry not found'}};
   if(!sub&&method==='PATCH'){
    need('inquiries',true);const input=parse(InquiryUpdateSchema,body);const {at}=this.stamp(by,'');const history=[...inquiry.history];
    if(input.status&&input.status!==inquiry.status)history.push({at,by,action:`status ${inquiry.status} → ${input.status}`});
    if(input.assignee!==undefined&&input.assignee!==inquiry.assignee)history.push({at,by,action:`assigned to ${input.assignee||'nobody'}`});
    if(input.note)history.push({at,by,action:`note: ${input.note}`});
    const next={...inquiry,status:input.status??inquiry.status,assignee:input.assignee??inquiry.assignee,updatedAt:at,history};
    return{status:200,data:this.store.put('inquiries',next)};
   }
   if(sub==='convert'&&method==='POST'){
    need('organizations',true);need('inquiries',true);
    if(inquiry.organizationId)return{status:409,data:{error:'Inquiry already converted',organizationId:inquiry.organizationId}};
    const type=({vendor:'vendor',school:'school',buyer:'buyer',other:'partner'} as const)[inquiry.kind];
    const {at}=this.stamp(by,'');
    const org:Organization={...parse(OrganizationInputSchema,{type,name:inquiry.organization||inquiry.name,country:inquiry.country||'Indonesia',contactName:inquiry.name,contactEmail:inquiry.email,contactPhone:inquiry.phone,notes:inquiry.message.slice(0,4000)}),id:randomUUID(),inquiryId:inquiry.id,createdAt:at,updatedAt:at,history:[{at,by,action:`created from inquiry ${inquiry.id.slice(0,8).toUpperCase()}`}]};
    this.store.put('organizations',org);
    this.store.put('inquiries',{...inquiry,organizationId:org.id,status:inquiry.status==='new'||inquiry.status==='contacted'?'qualified':inquiry.status,updatedAt:at,history:[...inquiry.history,{at,by,action:`converted to ${type} ${org.name}`}]});
    return{status:201,data:org};
   }
  }

  if(resource==='organizations'){
   if(!id&&method==='GET'){need('organizations',false);return{status:200,data:{organizations:this.store.list<Organization>('organizations')}};}
   if(!id&&method==='POST'){need('organizations',true);const {at}=this.stamp(by,'');const org:Organization={...parse(OrganizationInputSchema,body),id:randomUUID(),createdAt:at,updatedAt:at,history:[{at,by,action:'created'}]};return{status:201,data:this.store.put('organizations',org)};}
   const org=id?this.store.get<Organization>('organizations',id):undefined;if(!org)return{status:404,data:{error:'Organization not found'}};
   if(method==='PATCH'){need('organizations',true);const changes=parse(OrganizationUpdateSchema,body);const merged=parse(OrganizationInputSchema,{...strip(org),...changes});const {at}=this.stamp(by,'');return{status:200,data:this.store.put('organizations',{...org,...merged,updatedAt:at,history:[...org.history,{at,by,action:`updated ${Object.keys(changes).join(', ')||'nothing'}`}]})};}
  }

  if(resource==='products'){
   if(!id&&method==='GET'){need('products',false);return{status:200,data:{products:this.store.list<Product>('products')}};}
   if(!id&&method==='POST'){
    need('products',true);const input=parse(ProductInputSchema,body);this.vendor(input.vendorId);
    if(this.store.list<Product>('products').some(p=>p.slug===input.slug))return{status:409,data:{error:`Slug ${input.slug} is already used`}};
    const {at}=this.stamp(by,'');return{status:201,data:this.store.put('products',{...input,id:randomUUID(),createdAt:at,updatedAt:at,history:[{at,by,action:'created'}]} satisfies Product)};
   }
   const product=id?this.store.get<Product>('products',id):undefined;if(!product)return{status:404,data:{error:'Product not found'}};
   if(method==='PATCH'){
    need('products',true);const changes=parse(ProductUpdateSchema,body) as Partial<Product>;
    const merged={...strip(product),...changes,localization:{...product.localization,...(changes.localization??{})}} as Product;
    const errors=productErrors(merged);if(errors.length)return{status:400,data:{error:errors[0],issues:errors.map(message=>({path:'',message}))}};
    const input=parse(ProductInputSchema,merged);if(changes.vendorId)this.vendor(input.vendorId);
    if(changes.slug&&this.store.list<Product>('products').some(p=>p.slug===changes.slug&&p.id!==product.id))return{status:409,data:{error:`Slug ${changes.slug} is already used`}};
    const {at}=this.stamp(by,'');return{status:200,data:this.store.put('products',{...product,...input,updatedAt:at,history:[...product.history,{at,by,action:`updated ${Object.keys(changes).join(', ')}`}]})};
   }
  }

  if(resource==='tasks'){
   if(!id&&method==='GET'){need('tasks',false);return{status:200,data:{tasks:this.store.list<LabTask>('tasks').map(t=>({...t,payout:payoutSplit(t.feeIdr)}))}};}
   if(!id&&method==='POST'){
    need('tasks',true);const input=parse(TaskInputSchema,body);if(input.labId)this.lab(input.labId);if(input.leadId)this.lead(input.leadId,input.labId!);if(input.partnerId)this.org(input.partnerId);if(input.productId&&!this.store.get('products',input.productId))fail(400,'Unknown product');
    const {at}=this.stamp(by,'');const task:LabTask={...input,id:randomUUID(),status:input.labId?'assigned':'open',evidenceRef:'',createdAt:at,updatedAt:at,history:[{at,by,action:input.labId?'created and assigned':'created'}]};
    return{status:201,data:this.store.put('tasks',task)};
   }
   const task=id?this.store.get<LabTask>('tasks',id):undefined;if(!task)return{status:404,data:{error:'Task not found'}};
   if(sub==='reverse-accrual'&&method==='POST'){need('tasks',true);parse(UuidSchema,id);return{status:200,data:this.commissions.reverseAccrual(task,by,parse(ReasonSchema,body).reason)};}
   if(method==='PATCH'){
    need('tasks',true);const input=parse(TaskActionSchema,body);if(input.labId)this.lab(input.labId);
    const step=taskTransition(task,input);if('error' in step)return{status:409,data:{error:step.error}};
    if(input.leadId&&input.action!=='assign')fail(400,'A lead teacher is set when assigning');
    const {at}=this.stamp(by,'');const labId=input.action==='assign'?input.labId:task.labId;const evidenceRef=input.evidenceRef??task.evidenceRef;
    const leadId=input.action==='assign'?(input.leadId??(labId===task.labId?task.leadId:undefined)):task.leadId;if(leadId)this.lead(leadId,labId!);
    const action=`${input.action}${input.action==='assign'?` → ${this.lab(labId!).name}${leadId?`, lead ${this.commissions.person(leadId)?.name}`:''}`:''}${input.note?`: ${input.note}`:''}`;
    const next:LabTask={...task,labId,leadId,evidenceRef,status:step.status,updatedAt:at,history:[...task.history,{at,by,action}]};if(!leadId)delete next.leadId;
    return{status:200,data:this.store.tx(()=>{if(step.status==='verified')this.commissions.accrue(next,by,at);if(input.action==='assign'&&(labId!==task.labId||leadId!==task.leadId))this.commissions.voidPending(a=>a.taskId===task.id,'task school or lead changed',by);return this.store.put('tasks',next);})};
   }
  }

  // Lab Mitra commissions: school people, allocations waiting for approval, payout batches and the ledger.
  if(resource==='people'){
   need('organizations',false);
   if(!id&&method==='GET')return{status:200,data:{people:this.commissions.people().map(p=>this.commissions.view(p))}};
   if(!id&&method==='POST'){need('organizations',true);const input=parse(SchoolAdminInputSchema,body);const org=this.lab(input.orgId);const {person,inviteCode}=await this.commissions.createPerson(org,{role:'school_admin',name:input.name},by);return{status:201,data:{person,inviteCode}};}
   const person=id?this.commissions.person(id):undefined;if(!person)return{status:404,data:{error:'Person not found'}};
   if(sub==='invite'&&method==='POST'){need('organizations',true);return{status:200,data:await this.commissions.resetInvite(person,by)};}
   if(!sub&&method==='PATCH'){need('organizations',true);const changes=parse(PersonUpdateSchema,body);if(changes.status===undefined||Object.keys(changes).length!==1)fail(400,'Admins can only enable or disable a person');return{status:200,data:this.commissions.updatePerson(person,changes,by)};}
  }
  if(resource==='commissions'&&method==='GET'){need('tasks',false);return{status:200,data:this.commissionOverview()};}
  if(resource==='batches'){
   need('tasks',false);
   if(!id&&method==='POST'){need('tasks',true);const input=parse(BatchCreateSchema,body);this.lab(input.orgId);return{status:201,data:(()=>{const r=this.commissions.createBatch(input.orgId,by);return{...this.commissions.batchView(r.batch),skipped:r.skipped};})()};}
   const batch=id?this.store.get<Batch>('batches',id):undefined;if(!batch)return{status:404,data:{error:'Batch not found'}};
   if(sub==='paid'&&method==='POST'){need('tasks',true);return{status:200,data:this.commissions.batchView(this.commissions.markPaid(batch,parse(BatchPaidSchema,body),by))};}
   if(sub==='csv'&&method==='GET')return{status:200,data:{},text:{type:'text/csv; charset=utf-8',body:this.commissions.csv(batch),filename:`batch-${batch.id.slice(0,8)}.csv`}};
  }
  if(resource==='allocations'&&id&&sub==='reverse'&&method==='POST'){
   need('tasks',true);parse(UuidSchema,id);const reason=parse(ReasonSchema,body).reason;const a=this.store.get<Allocation>('allocations',id);if(!a)return{status:404,data:{error:'Allocation not found'}};
   return{status:200,data:this.commissions.allocationView(this.commissions.reverseAllocation(a,by,reason))};
  }
  if(resource==='ledger'){
   need('tasks',false);
   if(!id&&method==='GET')return{status:200,data:{entries:this.store.ledger.entries().reverse().slice(0,500)}};
  }

  if(resource==='payouts'&&method==='GET'){
   need('tasks',false);
   const labs=new Map(this.store.list<Organization>('organizations').map(o=>[o.id,o]));
   const rows=this.store.list<LabTask>('tasks').filter(t=>t.status==='verified'||t.status==='paid').map(t=>({taskId:t.id,title:t.title,lab:labs.get(t.labId??'')?.name??'',labId:t.labId,status:t.status,feeIdr:t.feeIdr,...payoutSplit(t.feeIdr)}));
   const sum=(status:string)=>rows.filter(r=>r.status===status).reduce((n,r)=>n+r.feeIdr,0);
   return{status:200,data:{payouts:rows,totals:{dueIdr:sum('verified'),paidIdr:sum('paid')}}};
  }
  return{status:404,data:{error:'Not found'}};
 }

 private org(id:string){const org=this.store.get<Organization>('organizations',id);if(!org)fail(400,'Unknown organization');return org!;}
 private vendor(id:string){const org=this.org(id);if(org.type!=='vendor')fail(400,`${org.name} is not a vendor`);return org;}
 private lead(id:string,labId:string){const p=this.commissions.person(id,labId);if(!p||p.role!=='teacher'||p.status!=='active')fail(400,'The lead must be an active teacher of the assigned school');return p;}
 private lab(id:string){const org=this.org(id);if(org.type!=='school')fail(400,`${org.name} is not a Lab Mitra school`);if(org.status!=='active')fail(400,`${org.name} is not active`);return org;}

 /** Public Lab Mitra board: only schools that agreed to be listed, ranked by verified tasks. */
 board(){
  const tasks=this.store.list<LabTask>('tasks');
  return this.store.list<Organization>('organizations').filter(o=>o.type==='school'&&o.publicListing&&o.status==='active').map(o=>{const done=tasks.filter(t=>t.labId===o.id&&(t.status==='verified'||t.status==='paid'));return{name:o.name,city:o.city,passed:done.length,paidIdr:done.filter(t=>t.status==='paid').reduce((n,t)=>n+t.feeIdr,0)};}).sort((a,b)=>b.passed-a.passed||b.paidIdr-a.paidIdr||a.name.localeCompare(b.name));
 }


 /** Per-school commission balances, allocations waiting for school approval and payout batches, for the backoffice. */
 commissionOverview(){
  const c=this.commissions,orgs=this.store.list<Organization>('organizations').filter(o=>o.type==='school');
  const schools=orgs.map(o=>({orgId:o.id,name:o.name,status:o.status,totals:c.totals(o.id),people:{teachers:c.people(o.id).filter(p=>p.role==='teacher'&&p.status==='active').length,students:c.people(o.id).filter(p=>p.role==='student'&&p.status==='active').length},pending:c.allocations(o.id).filter(a=>c.livePending(a)).map(a=>c.allocationView(a)),readyForBatch:c.allocations(o.id).filter(a=>a.status==='approved'&&!a.batchId).length}));
  return{schools,batches:c.batches().map(b=>({...c.batchView(b),orgName:orgs.find(o=>o.id===b.orgId)?.name??''}))};
 }

 summary(){
  const count=<T extends string>(items:{[k:string]:any}[],key:string,values:readonly T[])=>Object.fromEntries(values.map(v=>[v,items.filter(i=>i[key]===v).length])) as Record<T,number>;
  const inquiries=this.store.list<Inquiry>('inquiries'),orgs=this.store.list<Organization>('organizations'),products=this.store.list<Product>('products'),tasks=this.store.list<LabTask>('tasks');
  const due=tasks.filter(t=>t.status==='verified').reduce((n,t)=>n+t.feeIdr,0);
  return{inquiries:count(inquiries,'status',INQUIRY_STATUSES),organizations:count(orgs,'type',ORG_TYPES),products:count(products,'status',PRODUCT_STATUSES),tasks:count(tasks,'status',TASK_STATUSES),payoutDueIdr:due};
 }
}

function strip<T extends Row>(row:T){const {id:_id,createdAt:_c,updatedAt:_u,history:_h,...rest}=row as T&{inquiryId?:string};delete (rest as {inquiryId?:string}).inquiryId;return rest;}
