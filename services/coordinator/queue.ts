import {HardwareContractSchema} from '../../packages/hardware-contract/index.js';
import {contractHash} from '../../packages/evidence/index.js';
import {portableText} from '../../packages/episodes/index.js';
import {z} from 'zod';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {JobInputSchema,JobSummarySchema,type JobInput,type JobSummary,type NodeConfig} from '../../packages/job-protocol/index.js';
export type JobState='queued'|'leased'|'awaiting_approval'|'completed'|'failed'|'uncertain';
export interface Job {id:string;owner:string;input:JobInput;state:JobState;leaseId?:string;expiresAt?:number;summary?:JobSummary;createdAt:number;}
export class CoordinatorQueue {
 readonly db:DatabaseSync;
 constructor(path:string,readonly nodes:NodeConfig[],readonly clock=Date.now,readonly leaseMs=30000){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});this.db=new DatabaseSync(path);
  this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,owner TEXT NOT NULL,node TEXT NOT NULL,idem TEXT NOT NULL,payload TEXT NOT NULL,UNIQUE(owner,node,idem)); CREATE TABLE IF NOT EXISTS projects(id TEXT NOT NULL,node TEXT NOT NULL,owner TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(id,node));');
  // Surviving leases never return to queued. Reconnect must not replay an uncertain flash.
  for(const job of this.list())if(['leased','awaiting_approval'].includes(job.state)){job.state=job.input.operation==='physical'?'uncertain':'failed';job.summary={status:'failed',message:'Coordinator restarted during leased operation; not replayed'};this.save(job);}
 }
 node(id:string){const node=this.nodes.find(n=>n.id===id);if(!node)throw new Error('Unknown node');return node;}
 authenticate(nodeId:string,token:string){const node=this.node(nodeId);const a=Buffer.from(token),b=Buffer.from(node.token);if(a.length!==b.length||!timingSafeEqual(a,b))throw new Error('Node authorization required');return node;}
 list(owner?:string,node?:string):Job[]{return this.db.prepare('SELECT payload FROM jobs ORDER BY rowid').all().map(r=>JSON.parse(r.payload as string)).filter(j=>(!owner||j.owner===owner)&&(!node||j.input.nodeId===node));}
 get(id:string):Job {const row=this.db.prepare('SELECT payload FROM jobs WHERE id=?').get(id);if(!row)throw new Error('Job not found');return JSON.parse(row.payload as string);}
 save(job:Job){this.db.prepare('UPDATE jobs SET payload=? WHERE id=?').run(JSON.stringify(job),job.id);}
 expire(){for(const job of this.list())if(['leased','awaiting_approval'].includes(job.state)&&(job.expiresAt??0)<=this.clock()){job.state=job.input.operation==='physical'?'uncertain':'failed';job.summary={status:'failed',message:'Lease expired; operation is not replayed'};this.save(job);}}
 syncProject(nodeId:string,value:unknown){
  const input=z.object({projectId:z.string().uuid(),contractId:z.string().uuid(),contractHash:z.string().regex(/^[a-f0-9]{64}$/),title:z.string().max(100),contract:HardwareContractSchema}).strict().parse(value),node=this.node(nodeId);
  if(!node.projects.includes(input.projectId))throw new Error('Project scope denied');if(contractHash(input.contract)!==input.contractHash)throw new Error('Contract hash mismatch');
  // Only selected graph data is retained; goal, private conversation and runtime logs are omitted.
  const snapshot={projectId:input.projectId,nodeId,contractId:input.contractId,contractHash:input.contractHash,title:portableText(input.title),graph:{version:input.contract.version,boardId:input.contract.board.id,components:input.contract.components.map(c=>({instanceId:c.instanceId,manifestId:c.manifest.id,address:c.address})),connections:input.contract.connections},syncedAt:this.clock()};
  this.db.prepare('INSERT INTO projects VALUES(?,?,?,?) ON CONFLICT(id,node) DO UPDATE SET owner=excluded.owner,payload=excluded.payload').run(input.projectId,nodeId,node.owner,JSON.stringify(snapshot));return snapshot;
 }
 projects(owner:string){return this.db.prepare('SELECT payload FROM projects WHERE owner=?').all(owner).map(r=>JSON.parse(r.payload as string));}
 evidence(owner:string){return this.list(owner).filter(j=>j.summary&&j.state==='completed').map(j=>({jobId:j.id,nodeId:j.input.nodeId,projectId:j.input.projectId,contractId:j.input.contractId,contractHash:j.input.contractHash,summary:j.summary,authority:'Node-reported summary; original artifacts remain local and are not independently verified by coordinator'}));}
 enqueue(owner:string,value:unknown){const input=JobInputSchema.parse(value),node=this.node(input.nodeId);if(node.owner!==owner||!node.projects.includes(input.projectId))throw new Error('Project or node scope denied');
  const snapshot=this.projects(owner).find(p=>p.projectId===input.projectId&&p.nodeId===input.nodeId);if(input.operation!=='detect'&&(!snapshot||snapshot.contractId!==input.contractId||snapshot.contractHash!==input.contractHash))throw new Error('Synced contract identity required');
  const existing=this.list(owner,input.nodeId).find(j=>j.input.idempotencyKey===input.idempotencyKey);if(existing){if(JSON.stringify(existing.input)!==JSON.stringify(input))throw new Error('Idempotency key payload mismatch');return existing;}
  const job:Job={id:randomUUID(),owner,input,state:'queued',createdAt:this.clock()};this.db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?)').run(job.id,owner,input.nodeId,input.idempotencyKey,JSON.stringify(job));return job;
 }
 lease(nodeId:string){this.expire();const jobs=this.list(),locked=new Set(jobs.filter(j=>j.input.nodeId===nodeId&&['leased','awaiting_approval','uncertain'].includes(j.state)&&j.input.deviceId).map(j=>j.input.deviceId));
  const job=jobs.find(j=>j.input.nodeId===nodeId&&j.state==='queued'&&(!j.input.deviceId||!locked.has(j.input.deviceId)));if(!job)return null;
  job.state='leased';job.leaseId=randomUUID();job.expiresAt=this.clock()+this.leaseMs;this.save(job);return job;
 }
 requireLease(nodeId:string,jobId:string,leaseId:string){this.expire();const job=this.get(jobId);if(job.input.nodeId!==nodeId||job.leaseId!==leaseId||!['leased','awaiting_approval'].includes(job.state))throw new Error('Stale or unauthorized lease');return job;}
 renew(nodeId:string,jobId:string,leaseId:string){const job=this.requireLease(nodeId,jobId,leaseId);job.expiresAt=this.clock()+this.leaseMs;this.save(job);return job;}
 result(nodeId:string,jobId:string,leaseId:string,value:unknown){const summary=JobSummarySchema.parse(value),job=this.requireLease(nodeId,jobId,leaseId);
  if(summary.status==='awaiting_approval'&&job.input.operation!=='physical')throw new Error('Only physical operation can await approval');
  if(summary.source&&(job.input.operation==='physical'?summary.source!=='physical':job.input.operation==='simulate'&&summary.source!=='simulation'))throw new Error('Evidence source mismatch');
  if(summary.verification==='VERIFIED'&&summary.source!=='physical')throw new Error('Physical verification requires physical source');
  job.summary=summary;job.state=summary.status==='awaiting_approval'?'awaiting_approval':summary.status==='failed'&&job.input.operation==='physical'?'uncertain':summary.status;this.save(job);return job;
 }
 resolve(owner:string,id:string){const job=this.get(id);if(job.owner!==owner)throw new Error('Owner scope denied');if(job.state!=='uncertain')throw new Error('Only uncertain jobs can be explicitly resolved');job.state='failed';job.summary={status:'failed',message:'Owner acknowledged uncertain execution; no replay'};this.save(job);return job;}
 close(){this.db.close();}
}
