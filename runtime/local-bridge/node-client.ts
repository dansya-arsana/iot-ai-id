import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {JobSummarySchema,type JobSummary} from '../../packages/job-protocol/index.js';
import type {Job} from '../../services/coordinator/queue.js';
export interface NodeOptions {coordinator:string;nodeId:string;token:string;localApi:string;projects:string[];syncAuthorized:boolean;}
export class OutboundNode {
 private session?:string;
 constructor(readonly options:NodeOptions){if(!options.syncAuthorized)throw new Error('Explicit summary sync authorization required');const local=new URL(options.localApi);if(!['127.0.0.1','localhost','[::1]'].includes(local.hostname))throw new Error('Local API must use loopback');const remote=new URL(options.coordinator);if(remote.protocol!=='https:'&&!['127.0.0.1','localhost','[::1]'].includes(remote.hostname))throw new Error('Remote coordinator requires HTTPS');}
 async cloud(path:string,body:unknown){const response=await fetch(this.options.coordinator+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+this.options.token,'X-IOT-Node':this.options.nodeId},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Coordinator request rejected HTTP '+response.status);return response.json();}
 async local(path:string,body?:unknown){if(!this.session){const response=await fetch(this.options.localApi+'/api/session',{redirect:'error',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Local session unavailable');this.session=(await response.json()).token;}
 const response=await fetch(this.options.localApi+'/api'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-IOT-Session':this.session!},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok){if(response.status===403)this.session=undefined;throw new Error('Local API rejected HTTP '+response.status);}return response.json();}
 async execute(job:Job,signal?:AbortSignal){if(job.input.nodeId!==this.options.nodeId||!this.options.projects.includes(job.input.projectId))throw new Error('Local project sync scope denied');
  if(job.input.operation==='detect'){const status=await this.local('/status');return{status:'completed',message:'Local runtime '+(status.runtime.available?'available':'unavailable')+'; device inventory retained locally'} satisfies JobSummary;}
  const record=await this.local('/remote-jobs',{id:job.id,leaseId:job.leaseId,expiresAt:job.expiresAt,operation:job.input.operation==='simulate'?'simulate':'physical',projectId:job.input.projectId,contractId:job.input.contractId,contractHash:job.input.contractHash,deviceId:job.input.deviceId});
  if(job.input.operation==='simulate'&&record.status==='awaiting_approval')await this.local('/remote-jobs/'+job.id+'/approve',{authorize:true});
  if(job.input.operation==='physical'&&record.status==='awaiting_approval')await this.cloud('/v1/result',{jobId:job.id,leaseId:job.leaseId,summary:{status:'awaiting_approval',message:'Awaiting explicit local USB authorization and run approval'}});
  while(!signal?.aborted){const state=await this.local('/remote-jobs/'+job.id);if(['completed','failed'].includes(state.status))return JobSummarySchema.parse(state.summary);const renewed=await this.cloud('/v1/renew',{jobId:job.id,leaseId:job.leaseId});await this.local('/remote-jobs/'+job.id+'/renew',{leaseId:job.leaseId,expiresAt:renewed.expiresAt});await sleep(5000,undefined,{signal});}
  throw new Error('Node stopped; no operation replay');
 }
 async tick(signal?:AbortSignal){for(const projectId of this.options.projects){const project=await this.local('/projects/'+projectId);const contract=project.contracts.find((c:any)=>c.id===project.contractId);if(contract&&(!project.activeDesign||project.activeDesign.status==='executable'))await this.cloud('/v1/projects/sync',{projectId,contractId:contract.id,contractHash:contract.hash,title:project.title,contract:contract.contract});}const {job}=await this.cloud('/v1/lease',{});if(!job)return false;
  let summary:JobSummary;try{summary=await this.execute(job,signal);}catch{summary={status:'failed',message:'Node could not complete operation; inspect local runtime. No automatic replay.'};}
  await this.cloud('/v1/result',{jobId:job.id,leaseId:job.leaseId,summary});return true;
 }
}
export async function startNode(){const node=new OutboundNode({coordinator:process.env.IOT_COORDINATOR_URL??'http://127.0.0.1:8790',nodeId:process.env.IOT_NODE_ID??'',token:process.env.IOT_NODE_TOKEN??'',localApi:process.env.IOT_LOCAL_API_URL??'http://127.0.0.1:8787',projects:JSON.parse(process.env.IOT_NODE_PROJECTS??'[]'),syncAuthorized:process.env.IOT_SYNC_AUTHORIZED==='true'});const controller=new AbortController();for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>controller.abort());while(!controller.signal.aborted){try{await node.tick(controller.signal);}catch{console.error('Node coordination unavailable; private logs retained locally');}if(!controller.signal.aborted)await sleep(5000,undefined,{signal:controller.signal}).catch(()=>{});}}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)void startNode();
