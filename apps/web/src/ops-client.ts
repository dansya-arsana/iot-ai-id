/** Browser client for the ops service: public routes go to /ops/v1, owner routes through the session-guarded /api/ops proxy. */
import {api} from './api';
import type {Inquiry,InquiryInput,Organization,Product,LabTask,PublicProduct,Role,Resource} from '../../../packages/ops-contract/index';

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
 createTask:(input:{title:string;feeIdr:number;labId?:string;productId?:string;instructions?:string})=>admin<LabTask>('tasks','POST',input),
 taskAction:(id:string,input:{action:string;labId?:string;evidenceRef?:string;note?:string})=>admin<LabTask>(`tasks/${id}`,'PATCH',input),
 payouts:()=>admin<{payouts:PayoutRow[];totals:{dueIdr:number;paidIdr:number}}>('payouts'),
};
export const idr=(n:number)=>'Rp'+n.toLocaleString('id-ID');
