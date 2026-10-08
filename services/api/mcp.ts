import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';

/** Local MCP surface over the loopback API so agents (Jev or external) can drive the same evidence-bound operations as the web workbench. No physical flashing from MCP: physical runs still require the human USB trust + approval flow. */
const url=process.env.IOT_API_URL??'http://127.0.0.1:8787';
const endpoint=new URL(url);
if(endpoint.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname))throw new Error('Local API MCP requires a loopback http URL');
let session:string|undefined;
async function call(path:string,method:'GET'|'POST',body?:unknown){
 const attempt=async(token?:string)=>{
  const response=await fetch(url+path,{method,redirect:'error',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{'X-IOT-Session':token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  const data=await response.json().catch(()=>({}));
  return{ok:response.ok,status:response.status,data} as const;};
 if(!session){const boot=await fetch(url+'/api/session',{signal:AbortSignal.timeout(10000)});if(!boot.ok)throw new Error('Local API unavailable; run npm run api or npm run dev first');session=(await boot.json()).token as string;}
 let result=await attempt(session);
 if(result.status===403){const boot=await fetch(url+'/api/session',{signal:AbortSignal.timeout(10000)});session=(await boot.json()).token as string;result=await attempt(session);}
 if(!result.ok)throw new Error(String((result.data as any).error??`HTTP ${result.status}`));
 return result.data;
}
const text=(value:unknown)=>({content:[{type:'text' as const,text:JSON.stringify(value)}]});

const server=new McpServer({name:'iot-ai-local-api',version:'0.1.0'});
server.registerTool('list_challenges',{description:'List the challenge catalog: golden challenges have an executable recipe; drafts do not yet.',inputSchema:{}},async()=>text(await call('/api/challenges','GET')));
server.registerTool('list_projects',{description:'List local projects with status and entry point.',inputSchema:{}},async()=>text(await call('/api/projects','GET')));
server.registerTool('get_project',{description:'Get a project summary (actor field distinguishes agent runs from human runs): contract validity, design draft status, latest experiment, verification and check outcomes. Full evidence stays in the episode.',inputSchema:{projectId:z.string().uuid()}},async({projectId})=>{
 const p=await call('/api/projects/'+projectId,'GET');
 const contract=p.contracts?.find((c:any)=>c.id===p.contractId);
 const experiment=p.experiments?.at(-1);
 const verification=p.verifications?.filter((v:any)=>experiment&&v.experimentId===experiment.id).at(-1);
 return text({id:p.id,goal:p.goal,title:p.title,status:p.status,entryPoint:p.entryPoint,busy:p.busy,contract:{id:p.contractId,version:contract?.version,valid:contract?.validation?.valid,hash:contract?.hash},activeDesign:p.activeDesign?{status:p.activeDesign.status,version:p.activeDesign.version}:null,latestExperiment:experiment?{id:experiment.id,mode:experiment.mode,status:experiment.status,createdAt:experiment.createdAt}:null,verification:verification?{status:verification.status,passed:verification.passed,physical:verification.physical,checks:verification.checks}:null});
});
server.registerTool('create_project',{description:'Create a project from a goal (and optional challenge). Planning runs asynchronously; poll get_project until status leaves planning.',inputSchema:{goal:z.string().min(8).max(2000),entryPoint:z.enum(['build','learn']).optional(),challengeId:z.string().regex(/^[a-z0-9-]{3,64}$/).optional(),challengeVersion:z.number().int().positive().optional()}},async input=>text(await call('/api/projects','POST',input)));
server.registerTool('send_chat',{description:'Send a design revision or a debug complaint. Debug requires an experiment on the current contract.',inputSchema:{projectId:z.string().uuid(),message:z.string().min(1).max(2000),purpose:z.enum(['design','debug'])}},async({projectId,message,purpose})=>{
 const current=await call('/api/projects/'+projectId,'GET');
 return text(await call('/api/projects/'+projectId+'/chat','POST',{message,purpose,expectedContractId:current.contractId??null,expectedDraftId:current.activeDesign?.id??null}));
});
server.registerTool('get_challenge_progress',{description:'Judge the project challenge scenarios from stored evidence: pass/fail/pending per scenario, plus overall state. The system judges; nobody can claim done without evidence.',inputSchema:{projectId:z.string().uuid()}},async({projectId})=>text(await call('/api/projects/'+projectId+'/challenge','GET')));
server.registerTool('run_simulation',{description:'Start a simulation experiment (template-model default; wokwi-cli only when locally configured). Returns accepted; poll get_project for the verification result. Physical runs are intentionally NOT available here.',inputSchema:{projectId:z.string().uuid(),backend:z.enum(['template-model','wokwi-cli']).default('template-model'),fault:z.enum(['none','sda']).default('none')},},async({projectId,backend,fault})=>text(await call('/api/projects/'+projectId+'/run','POST',{mode:'simulation',backend,fault})));
await server.connect(new StdioServerTransport());
