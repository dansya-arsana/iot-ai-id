/** Business operations core: SQLite store plus a transport-free request handler shared by the ops server and the local API. */
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {
 InquiryInputSchema,InquiryUpdateSchema,OrganizationInputSchema,OrganizationUpdateSchema,ProductInputSchema,ProductUpdateSchema,TaskInputSchema,TaskActionSchema,
 INQUIRY_STATUSES,ORG_TYPES,PRODUCT_STATUSES,TASK_STATUSES,can,permissions,resolveRole,payoutSplit,productErrors,publicProduct,taskTransition,
 type Inquiry,type Organization,type Product,type LabTask,type Role,type Resource,
} from '../../packages/ops-contract/index.js';

const kinds=['inquiries','organizations','products','tasks'] as const;
type Kind=typeof kinds[number];
type Row={id:string;createdAt:string;updatedAt:string;history:{at:string;by:string;action:string}[]};

export class OpsStore{
 readonly db:DatabaseSync;
 constructor(path:string){if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});this.db=new DatabaseSync(path);this.db.exec('PRAGMA journal_mode=WAL;');for(const kind of kinds)this.db.exec(`CREATE TABLE IF NOT EXISTS ${kind}(id TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`);}
 put<T extends Row>(kind:Kind,value:T){this.db.prepare(`INSERT INTO ${kind}(id,payload,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`).run(value.id,JSON.stringify(value),value.createdAt,value.updatedAt);return value;}
 get<T>(kind:Kind,id:string):T|undefined{const row=this.db.prepare(`SELECT payload FROM ${kind} WHERE id=?`).get(id);return row?JSON.parse(row.payload as string):undefined;}
 list<T>(kind:Kind):T[]{return this.db.prepare(`SELECT payload FROM ${kind} ORDER BY created_at DESC,rowid DESC`).all().map(row=>JSON.parse(row.payload as string));}
}

export type OpsCall={method:string;path:string;body?:unknown;ip:string;admin?:{user:string}};
export type OpsResult={status:number;data:unknown};
class HttpError extends Error{constructor(readonly status:number,message:string,readonly issues?:unknown){super(message);}}
const fail=(status:number,message:string):never=>{throw new HttpError(status,message);};
function parse<S extends z.ZodTypeAny>(schema:S,value:unknown):z.infer<S>{const result=schema.safeParse(value);if(!result.success)throw new HttpError(400,result.error.issues[0]?.message??'Invalid input',result.error.issues.map(i=>({path:i.path.join('.'),message:i.message})));return result.data;}

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
 constructor(readonly store:OpsStore,readonly roles=new Map<string,Role>(),readonly limit=new RateLimit(),readonly clock=()=>new Date()){}

 async handle(call:OpsCall):Promise<OpsResult|undefined>{
  try{return await this.route(call);}
  catch(error){if(error instanceof HttpError)return{status:error.status,data:{error:error.message,...(error.issues?{issues:error.issues}:{})}};throw error;}
 }

 private stamp(by:string,action:string){const at=this.clock().toISOString();return{at,entry:{at,by,action}};}

 private async route({method,path,body,ip,admin}:OpsCall):Promise<OpsResult|undefined>{
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
  if(!path.startsWith('/ops/v1/admin/'))return{status:404,data:{error:'Not found'}};

  // Owner side: the caller has already authenticated the gateway user; roles decide what they may do.
  if(!admin)return{status:401,data:{error:'Admin authorization required'}};
  const role=resolveRole(admin.user,this.roles);if(!role)return{status:403,data:{error:`User ${admin.user||'(none)'} has no role. Add it to OPS_ROLES.`}};
  const by=admin.user||'owner';
  const need=(resource:Resource,write:boolean)=>{if(!can(role,resource,write))fail(403,`Role ${role} cannot ${write?'change':'read'} ${resource}`);};
  const rest=path.slice('/ops/v1/admin/'.length).split('/');const [resource,id,sub]=rest;

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
    need('tasks',true);const input=parse(TaskInputSchema,body);if(input.labId)this.lab(input.labId);if(input.partnerId)this.org(input.partnerId);if(input.productId&&!this.store.get('products',input.productId))fail(400,'Unknown product');
    const {at}=this.stamp(by,'');const task:LabTask={...input,id:randomUUID(),status:input.labId?'assigned':'open',evidenceRef:'',createdAt:at,updatedAt:at,history:[{at,by,action:input.labId?'created and assigned':'created'}]};
    return{status:201,data:this.store.put('tasks',task)};
   }
   const task=id?this.store.get<LabTask>('tasks',id):undefined;if(!task)return{status:404,data:{error:'Task not found'}};
   if(method==='PATCH'){
    need('tasks',true);const input=parse(TaskActionSchema,body);if(input.labId)this.lab(input.labId);
    const step=taskTransition(task,input);if('error' in step)return{status:409,data:{error:step.error}};
    const {at}=this.stamp(by,'');const labId=input.action==='assign'?input.labId:task.labId;const evidenceRef=input.evidenceRef??task.evidenceRef;
    const action=`${input.action}${input.action==='assign'?` → ${this.lab(labId!).name}`:''}${input.note?`: ${input.note}`:''}`;
    return{status:200,data:this.store.put('tasks',{...task,labId,evidenceRef,status:step.status,updatedAt:at,history:[...task.history,{at,by,action}]})};
   }
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
 private lab(id:string){const org=this.org(id);if(org.type!=='school')fail(400,`${org.name} is not a Lab Mitra school`);if(org.status!=='active')fail(400,`${org.name} is not active`);return org;}

 /** Public Lab Mitra board: only schools that agreed to be listed, ranked by verified tasks. */
 board(){
  const tasks=this.store.list<LabTask>('tasks');
  return this.store.list<Organization>('organizations').filter(o=>o.type==='school'&&o.publicListing&&o.status==='active').map(o=>{const done=tasks.filter(t=>t.labId===o.id&&(t.status==='verified'||t.status==='paid'));return{name:o.name,city:o.city,passed:done.length,paidIdr:done.filter(t=>t.status==='paid').reduce((n,t)=>n+t.feeIdr,0)};}).sort((a,b)=>b.passed-a.passed||b.paidIdr-a.paidIdr||a.name.localeCompare(b.name));
 }

 summary(){
  const count=<T extends string>(items:{[k:string]:any}[],key:string,values:readonly T[])=>Object.fromEntries(values.map(v=>[v,items.filter(i=>i[key]===v).length])) as Record<T,number>;
  const inquiries=this.store.list<Inquiry>('inquiries'),orgs=this.store.list<Organization>('organizations'),products=this.store.list<Product>('products'),tasks=this.store.list<LabTask>('tasks');
  const due=tasks.filter(t=>t.status==='verified').reduce((n,t)=>n+t.feeIdr,0);
  return{inquiries:count(inquiries,'status',INQUIRY_STATUSES),organizations:count(orgs,'type',ORG_TYPES),products:count(products,'status',PRODUCT_STATUSES),tasks:count(tasks,'status',TASK_STATUSES),payoutDueIdr:due};
 }
}

function strip<T extends Row>(row:T){const {id:_id,createdAt:_c,updatedAt:_u,history:_h,...rest}=row as T&{inquiryId?:string};delete (rest as {inquiryId?:string}).inquiryId;return rest;}
