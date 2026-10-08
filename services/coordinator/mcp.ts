import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import {JobInputSchema} from '../../packages/job-protocol/index.js';
const url=process.env.IOT_COORDINATOR_URL??'http://127.0.0.1:8790',token=process.env.IOT_OWNER_TOKEN;
if(!token||token.length<32)throw new Error('Scoped owner token required');
const endpoint=new URL(url);if(endpoint.protocol!=='https:'&&!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname))throw new Error('Remote coordinator requires HTTPS');
const server=new McpServer({name:'iot-ai-coordinator',version:'0.1.0'});
async function request(path:string,value?:unknown){const response=await fetch(url+path,{method:value===undefined?'GET':'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value),signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Coordinator rejected HTTP '+response.status);return{content:[{type:'text' as const,text:JSON.stringify(await response.json())}]};}
server.registerTool('list_projects',{description:'List owner-scoped synced project graphs; no private local conversation.',inputSchema:{}},()=>request('/v1/projects'));
server.registerTool('list_jobs',{description:'List owner-scoped jobs and their lease status.',inputSchema:{}},()=>request('/v1/jobs'));
server.registerTool('list_evidence',{description:'List node-reported bounded evidence summaries; original artifacts remain local.',inputSchema:{}},()=>request('/v1/evidence'));
server.registerTool('enqueue_job',{description:'Queue typed detect/simulate/physical job. Physical requests still require local USB trust and explicit approval.',inputSchema:{nodeId:z.string(),projectId:z.string().uuid(),operation:z.enum(['detect','simulate','physical']),contractId:z.string().uuid().nullable(),contractHash:z.string().nullable(),deviceId:z.string().nullable(),idempotencyKey:z.string()}},input=>request('/v1/jobs',JobInputSchema.parse(input)));
await server.connect(new StdioServerTransport());
