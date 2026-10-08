import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import {CoordinatorQueue} from './queue.js';
import {NodeConfigSchema,LeaseResultSchema} from '../../packages/job-protocol/index.js';
const ownerSchema=z.object({owner:z.string().regex(/^[\w-]{1,128}$/),token:z.string().min(32)}).strict();
async function body(req:IncomingMessage){let text='';for await(const chunk of req){text+=chunk;if(text.length>16000)throw new Error('Request too large');}return JSON.parse(text||'{}');}
export function coordinatorServer(queue:CoordinatorQueue,owners:z.infer<typeof ownerSchema>[]){
 return createServer(async(req:IncomingMessage,res:ServerResponse)=>{const send=(code:number,value:unknown)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};try{
  const url=new URL(req.url??'/', 'http://coordinator'),token=(req.headers.authorization??'').replace(/^Bearer /,'');
  if(url.pathname==='/health'&&req.method==='GET'){send(200,{status:'ok',deployment:'self-hosted coordinator'});return;}
  const nodeId=req.headers['x-iot-node'];
  if(typeof nodeId==='string'){
   queue.authenticate(nodeId,token);
   if(url.pathname==='/v1/projects/sync'&&req.method==='POST'){send(200,queue.syncProject(nodeId,await body(req)));return;}
   if(url.pathname==='/v1/lease'&&req.method==='POST'){send(200,{job:queue.lease(nodeId)});return;}
   if(url.pathname==='/v1/result'&&req.method==='POST'){const input=LeaseResultSchema.parse(await body(req));send(200,queue.result(nodeId,input.jobId,input.leaseId,input.summary));return;}
   if(url.pathname==='/v1/renew'&&req.method==='POST'){const input=z.object({jobId:z.string().uuid(),leaseId:z.string().uuid()}).strict().parse(await body(req));send(200,queue.renew(nodeId,input.jobId,input.leaseId));return;}
   throw new Error('Node scope denied');
  }
  const owner=owners.find(o=>{const a=Buffer.from(token),b=Buffer.from(o.token);return a.length===b.length&&timingSafeEqual(a,b);});if(!owner)throw new Error('Owner authorization required');
  if(url.pathname==='/v1/projects'&&req.method==='GET'){send(200,{projects:queue.projects(owner.owner)});return;}
  if(url.pathname==='/v1/graph'&&req.method==='GET'){send(200,{projects:queue.projects(owner.owner).map(p=>({projectId:p.projectId,nodeId:p.nodeId,contractHash:p.contractHash,graph:p.graph}))});return;}
  if(url.pathname==='/v1/evidence'&&req.method==='GET'){send(200,{evidence:queue.evidence(owner.owner)});return;}
  if(url.pathname==='/v1/jobs'&&req.method==='POST'){send(201,queue.enqueue(owner.owner,await body(req)));return;}
  if(url.pathname==='/v1/jobs'&&req.method==='GET'){queue.expire();send(200,{jobs:queue.list(owner.owner)});return;}
  const match=url.pathname.match(/^\/v1\/jobs\/([\w-]+)\/resolve$/);if(match&&req.method==='POST'){const confirmation=z.object({acknowledgeUncertain:z.literal(true)}).strict().parse(await body(req));if(confirmation.acknowledgeUncertain)send(200,queue.resolve(owner.owner,match[1]));return;}
  send(404,{error:'Route not found'});
 }catch(error){const message=error instanceof Error?error.message:'Request failed';send(/authorization|scope|Unknown node/.test(message)?403:/not found/.test(message)?404:400,{error:message.slice(0,400)});}});
}
export function startCoordinator(){const nodes=NodeConfigSchema.parse(JSON.parse(process.env.IOT_COORDINATOR_NODES??'[]')),owners=z.array(ownerSchema).min(1).parse(JSON.parse(process.env.IOT_COORDINATOR_OWNERS??'[]'));if(new Set(nodes.map(n=>n.id)).size!==nodes.length||new Set([...nodes.map(n=>n.token),...owners.map(o=>o.token)]).size!==nodes.length+owners.length)throw new Error('Credentials and node identifiers must be unique');const queue=new CoordinatorQueue(process.env.IOT_COORDINATOR_DB??resolve('.data/coordinator.sqlite'),nodes),server=coordinatorServer(queue,owners);server.listen(Number(process.env.IOT_COORDINATOR_PORT??8790),process.env.IOT_COORDINATOR_HOST??'127.0.0.1',()=>console.log('IOT coordinator listening'));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{queue.close();process.exit(0);}));return server;}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)startCoordinator();
