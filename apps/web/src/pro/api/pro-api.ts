/** Browser client for the Pro member API (`/ops/v1/member/pro/*`, cookie session + CSRF header). Reads SystemSpec revisions. */
import type {SystemSpec} from '../../../../../packages/pro-contract/system-spec';

export class ProApiError extends Error{constructor(message:string,readonly status:number){super(message);}}
export interface ProProject{id:string;name:string;headRevision:number;updatedAt?:string;createdAt?:string}
export interface RevisionMeta{revision:number;specSha:string;reason:string;by:string;at:string}
export interface RevisionView extends RevisionMeta{spec:SystemSpec;checks:SystemSpec['checks'];verification:SystemSpec['verification']}

async function call<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const response=await fetch('/ops/v1/member/pro'+path,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-AIoT-Member':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await response.json().catch(()=>({error:'The service did not answer'}));
 if(!response.ok)throw new ProApiError(data.error??'Request failed',response.status);
 return data as T;
}
export const proApi={
 projects:()=>call<{projects:ProProject[]}>('/projects').then(d=>d.projects),
 createProject:(name:string)=>call<ProProject>('/projects','POST',{name}),
 project:(id:string)=>call<{project:ProProject;head:RevisionView|null}>(`/projects/${encodeURIComponent(id)}`),
 revisions:(id:string)=>call<{revisions:RevisionMeta[]}>(`/projects/${encodeURIComponent(id)}/revisions`).then(d=>d.revisions),
 revision:(id:string,n:number)=>call<RevisionView>(`/projects/${encodeURIComponent(id)}/revisions/${n}`),
};
