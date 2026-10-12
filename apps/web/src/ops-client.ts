/** Browser client for the ops service: public routes go to /ops/v1, owner routes through the session-guarded /api/ops proxy. */
import {api,apiDownload,saveBlob} from './api';
import type {Inquiry,InquiryInput,Organization,Product,LabTask,PublicProduct,Role,Resource,Person,Allocation,Batch,Share,Staff,Member,MemberMe,MemberGrant} from '../../../packages/ops-contract/index';

export class OpsError extends Error{constructor(message:string,readonly status:number,readonly issues:{path:string;message:string}[]=[]){super(message);}}
async function publicCall<T>(path:string,init?:RequestInit):Promise<T>{
 const response=await fetch('/ops/v1'+path,{...init,headers:{'Content-Type':'application/json',...init?.headers}});
 const data=await response.json().catch(()=>({error:'The service did not answer'}));
 if(!response.ok)throw new OpsError(data.error??'Request failed',response.status,data.issues);
 return data;
}
export const submitInquiry=(input:Omit<InquiryInput,'consent'>&{consent:boolean;website:string})=>publicCall<{ok:true;reference?:string}>('/inquiries',{method:'POST',body:JSON.stringify(input)});
export const fetchCatalog=()=>publicCall<{products:PublicProduct[]}>('/catalog').then(d=>d.products);
export type BoardRow={name:string;city:string;passed:number;paidIdr:number};
export const fetchBoard=()=>publicCall<{labs:BoardRow[]}>('/labs').then(d=>d.labs);

export type Me={user:string;role:Role;permissions:Record<Resource,'r'|'rw'>};
export type Summary={inquiries:Record<string,number>;organizations:Record<string,number>;products:Record<string,number>;tasks:Record<string,number>;payoutDueIdr:number};
export type TaskRow=LabTask&{payout:{students:number;tefa:number;teacher:number}};
export type PayoutRow={taskId:string;title:string;lab:string;status:string;feeIdr:number;students:number;tefa:number;teacher:number};
const admin=<T>(path:string,method='GET',body?:unknown)=>api<T>('/ops/'+path,{method,...(body===undefined?{}:{body:JSON.stringify(body)})});
export const opsAdmin={
 me:()=>admin<Me>('me'),
 summary:()=>admin<Summary>('summary'),
 inquiries:()=>admin<{inquiries:Inquiry[]}>('inquiries').then(d=>d.inquiries),
 updateInquiry:(id:string,changes:{status?:string;assignee?:string;note?:string})=>admin<Inquiry>(`inquiries/${id}`,'PATCH',changes),
 convertInquiry:(id:string)=>admin<Organization>(`inquiries/${id}/convert`,'POST',{}),
 organizations:()=>admin<{organizations:Organization[]}>('organizations').then(d=>d.organizations),
 createOrganization:(input:Partial<Organization>)=>admin<Organization>('organizations','POST',input),
 updateOrganization:(id:string,changes:Partial<Organization>)=>admin<Organization>(`organizations/${id}`,'PATCH',changes),
 products:()=>admin<{products:Product[]}>('products').then(d=>d.products),
 createProduct:(input:Partial<Product>)=>admin<Product>('products','POST',input),
 updateProduct:(id:string,changes:Partial<Product>)=>admin<Product>(`products/${id}`,'PATCH',changes),
 tasks:()=>admin<{tasks:TaskRow[]}>('tasks').then(d=>d.tasks),
 createTask:(input:{title:string;feeIdr:number;labId?:string;leadId?:string;productId?:string;instructions?:string})=>admin<LabTask>('tasks','POST',input),
 taskAction:(id:string,input:{action:string;labId?:string;leadId?:string;evidenceRef?:string;note?:string})=>admin<LabTask>(`tasks/${id}`,'PATCH',input),
 payouts:()=>admin<{payouts:PayoutRow[];totals:{dueIdr:number;paidIdr:number}}>('payouts'),
 staff:()=>admin<{staff:StaffView[]}>('staff').then(d=>d.staff),
 createStaff:(input:{username:string;name:string;role:Role})=>admin<{staff:StaffView;inviteCode:string}>('staff','POST',input),
 updateStaff:(id:string,changes:{role?:Role;status?:'active'|'disabled'})=>admin<StaffView>(`staff/${id}`,'PATCH',changes),
 resetStaffInvite:(id:string)=>admin<{staff:StaffView;inviteCode:string}>(`staff/${id}/invite`,'POST',{}),
 members:()=>admin<{members:MemberView[]}>('members').then(d=>d.members),
 createMember:(input:{username:string;name:string;orgName?:string;orgId?:string;grants:MemberGrant[]})=>admin<{member:MemberView;inviteCode:string}>('members','POST',input),
 updateMember:(id:string,changes:{name?:string;orgName?:string;orgId?:string|null;grants?:MemberGrant[];status?:'active'|'disabled'})=>admin<MemberView&{inviteCode?:string}>(`members/${id}`,'PATCH',changes),
 resetMemberInvite:(id:string)=>admin<{member:MemberView;inviteCode:string}>(`members/${id}/invite`,'POST',{}),
 people:()=>admin<{people:PersonView[]}>('people').then(d=>d.people),
 createSchoolAdmin:(input:{orgId:string;name:string})=>admin<{person:PersonView;inviteCode:string}>('people','POST',input),
 resetInvite:(id:string)=>admin<{person:PersonView;inviteCode:string}>(`people/${id}/invite`,'POST',{}),
 setPersonStatus:(id:string,status:'active'|'disabled')=>admin<PersonView>(`people/${id}`,'PATCH',{status}),
 commissions:()=>admin<Commissions>('commissions'),
 createBatch:(orgId:string)=>admin<BatchView>('batches','POST',{orgId}),
 markBatchPaid:(id:string,input:{transferRef:string;paidAt:string})=>admin<BatchView>(`batches/${id}/paid`,'POST',input),
 downloadBatch:(id:string)=>apiDownload(`/ops/batches/${id}/csv`,`batch-${id.slice(0,8)}.csv`),
};
export type PersonView=Person&{activated:boolean;inviteExpires?:string};
export type Totals={accruedIdr:number;pendingApprovalIdr:number;approvedIdr:number;paidIdr:number;distributedIdr:number;waitingIdr:number;owedIdr:number};
export type ShareView=Share&{name:string;className:string};
export type AllocationView=Omit<Allocation,'shares'>&{shares:ShareView[];taskTitle:string;taskStatus:string;studentPoolIdr:number;proposedByName:string};
export type BatchView=Batch&{tasks:{id:string;title:string;feeIdr:number}[];orgName?:string};
export type Commissions={schools:{orgId:string;name:string;status:string;totals:Totals;people:{teachers:number;students:number};pending:AllocationView[];readyForBatch:number}[];batches:BatchView[]};

// School portal (/mitra): cookie session on the public host, CSRF header on every write.
async function portalCall<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const response=await fetch('/ops/v1/portal'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-AIoT-Portal':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await response.json().catch(()=>({error:'The service did not answer'}));
 if(!response.ok)throw new OpsError(data.error??'Request failed',response.status,data.issues);
 return data;
}
export type PortalMe={person:{id:string;name:string;role:'school_admin'|'teacher';username:string};school:{id:string;name:string;city:string};can:Record<string,boolean>};
export type PortalTask={id:string;title:string;instructions:string;status:string;evidenceRef:string;feeIdr:number;payout:{students:number;tefa:number;teacher:number};leadId:string|null;leadName:string;mine:boolean;batchId:string|null;allocation:{id:string;status:string}|null};
export type PortalPerson=Partial<PersonView>&{id:string;name:string;role:string;status:string;className?:string;allocatedIdr?:number;distributedIdr?:number;balanceIdr?:number};
export const portal={
 activate:(code:string,password:string)=>portalCall<{username:string;name:string}>('/activate','POST',{code,password}),
 login:(username:string,password:string)=>portalCall<{username:string;name:string}>('/login','POST',{username,password}),
 logout:()=>portalCall<{ok:true}>('/logout','POST',{}),
 me:()=>portalCall<PortalMe>('/me'),
 summary:()=>portalCall<Totals>('/summary'),
 people:()=>portalCall<{people:PortalPerson[]}>('/people').then(d=>d.people),
 addTeacher:(name:string)=>portalCall<{person:PersonView;inviteCode:string}>('/people','POST',{role:'teacher',name}),
 addStudent:(input:{name:string;className:string;nisn?:string;guardianConsent:boolean})=>portalCall<{person:PersonView}>('/people','POST',{role:'student',...input}),
 setStatus:(id:string,status:'active'|'disabled')=>portalCall<PersonView>(`/people/${id}`,'PATCH',{status}),
 resetInvite:(id:string)=>portalCall<{person:PersonView;inviteCode:string}>(`/people/${id}/invite`,'POST',{}),
 tasks:()=>portalCall<{tasks:PortalTask[]}>('/tasks').then(d=>d.tasks),
 submitEvidence:(taskId:string,evidenceRef:string)=>portalCall<PortalTask>(`/tasks/${taskId}/evidence`,'POST',{evidenceRef}),
 allocations:()=>portalCall<{allocations:AllocationView[]}>('/allocations').then(d=>d.allocations),
 propose:(taskId:string,shares:Share[])=>portalCall<AllocationView>('/allocations','POST',{taskId,shares}),
 decide:(id:string,action:'approve'|'reject',note?:string)=>portalCall<AllocationView>(`/allocations/${id}/${action}`,'POST',note?{note}:{}),
 batches:()=>portalCall<{batches:BatchView[]}>('/batches').then(d=>d.batches),
 confirmBatch:(id:string)=>portalCall<BatchView>(`/batches/${id}/confirm`,'POST',{}),
 downloadBatch:async(id:string)=>{const response=await fetch(`/ops/v1/portal/batches/${id}/csv`,{credentials:'same-origin'});if(!response.ok)throw new OpsError('Download failed',response.status);saveBlob(await response.blob(),`batch-${id.slice(0,8)}.csv`);},
};
export const idr=(n:number)=>'Rp'+n.toLocaleString('id-ID');

// Staff login on the admin host: cookie session (aiot_admin), CSRF header on every write. A 401 means signed out.
export type StaffView=Staff&{activated:boolean;inviteExpires?:string};
export type StaffMe={username:string;name:string;role:Role};
async function staffCall<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const response=await fetch('/ops/v1/staff'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-AIoT-Staff':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await response.json().catch(()=>({error:'The service did not answer'}));
 if(!response.ok)throw new OpsError(data.error??'Request failed',response.status,data.issues);
 return data;
}
export const staffAuth={
 me:()=>staffCall<StaffMe>('/me'),
 login:(username:string,password:string)=>staffCall<StaffMe>('/login','POST',{username,password}),
 activate:(code:string,password:string)=>staffCall<StaffMe>('/activate','POST',{code,password}),
 logout:()=>staffCall<{ok:true}>('/logout','POST',{}),
};

// Member accounts on the public host: cookie session (aiot_member), CSRF header on every write. A 401 means signed out.
export type MemberView=Member&{activated:boolean;inviteExpires?:string};
export type {MemberMe};
export const INSTALLER_PATH='/ops/v1/member/installer';
async function memberCall<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const response=await fetch('/ops/v1/member'+path,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-AIoT-Member':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await response.json().catch(()=>({error:'The service did not answer'}));
 if(!response.ok)throw new OpsError(data.error??'Request failed',response.status,data.issues);
 return data;
}
export const memberAuth={
 me:()=>memberCall<MemberMe>('/me'),
 login:(username:string,password:string)=>memberCall<MemberMe>('/login','POST',{username,password}),
 activate:(code:string,password:string)=>memberCall<MemberMe>('/activate','POST',{code,password}),
 logout:()=>memberCall<{ok:true}>('/logout','POST',{}),
};
