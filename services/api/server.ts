import {CredentialVault,ProviderName,SecretInput,testCredential} from './credentials.js';
import {AiPreferencesSchema,allowedProviders,type DeploymentMode} from '../../packages/ai-providers/index.js';
import {hardwareLibrary,HardwareLibraryFilterSchema,hardwareKnowledgeDocument} from '../../packages/hardware-library/index.js';
import {receiveRemoteJob,approveRemoteJob,reconcileRemoteJobs} from './remote-jobs.js';
import {ChatInputSchema,ComponentChangeSchema,WiringChangeSchema} from '../../packages/agent-tools/index.js';
import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,extname,dirname} from 'node:path';
import {z} from 'zod';
import {Store} from './store.js';
import {SiteEngine,RevisionConflict} from './site-engine.js';
import {farmProfiles} from '../../packages/application-catalog/index.js';
import {backofficeAggregates} from './backoffice-aggregates.js';
import {Ops,OpsStore} from '../ops/ops.js';
import {parseRoles} from '../../packages/ops-contract/index.js';
import {Engine,id,now,safeError} from './engine.js';
import {JevProvider,cliAvailability} from '../orchestrator/provider.js';
import {terminateActiveProcesses} from '../orchestrator/process.js';
import {FixtureAgent} from '../orchestrator/fixture.js';
import {components,esp32Devkit} from '../../packages/component-catalog/index.js';
import {challengeReference,publicChallenges,getChallenge,judgeChallenge} from '../../packages/challenge-catalog/index.js';
const port=Number(process.env.API_PORT??8787),webPort=Number(process.env.WEB_PORT??5173),bindHost=process.env.API_BIND??'127.0.0.1';
async function coordinatorView(){const url=process.env.IOT_COORDINATOR_URL,token=process.env.IOT_COORDINATOR_OWNER_TOKEN;if(!url||!token)return{status:'unconfigured' as const};try{const get=async(path:string)=>{const response=await fetch(url+path,{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error('Coordinator HTTP '+response.status);return response.json() as Promise<any>;};const [projects,jobs,evidence]=await Promise.all([get('/v1/projects'),get('/v1/jobs'),get('/v1/evidence')]);return{status:'online' as const,url,projects:projects.projects??[],jobs:jobs.jobs??[],evidence:evidence.evidence??[]};}catch(error){return{status:'unreachable' as const,url,error:safeError(error)};}}
const session=randomBytes(32).toString('hex');
const store=new Store(process.env.IOT_DB_PATH??resolve('.data/iot.sqlite'));
const credentialVault=new CredentialVault(process.env.IOT_SECRETS_PATH??resolve(dirname(process.env.IOT_DB_PATH??resolve('.data/iot.sqlite')),'secrets'));
const deployment:DeploymentMode=process.env.IOT_DEPLOYMENT==='cloud'?'cloud':'local';
const dailyLimit=process.env.IOT_AI_DAILY_LIMIT?Number(process.env.IOT_AI_DAILY_LIMIT):deployment==='cloud'?300:Infinity;
const usage={day:'',count:0};
function countFrontierCall(){const day=new Date().toISOString().slice(0,10);if(usage.day!==day){usage.day=day;usage.count=0;}if(usage.count>=dailyLimit)throw new Error('Daily AI limit reached');usage.count++;}
const agent=new JevProvider(()=>credentialVault.snapshot(),()=>credentialVault.preferences(),deployment,countFrontierCall);
const credentialProviders=()=>[...allowedProviders(deployment).map(p=>p.id as string),'typesafe'];
const auditUser=(req:IncomingMessage)=>String(req.headers['x-remote-user']||'local').slice(0,80);
const catalogSeed=store.seedHardwareLibrary(hardwareLibrary);
const fixture=process.env.IOT_AGENT_PROVIDER==='fixture';
async function providerAvailability():Promise<{status:string;available:boolean;active?:{id:string;label:string;model:string};error?:string}>{if(fixture)return{status:'fixture' as const,available:true};try{const active=await agent.preflight();return{status:'configured' as const,available:true,active};}catch(error){return{status:'unavailable' as const,available:false,error:safeError(error)};}}
const engine=new Engine(store,fixture?new FixtureAgent():agent);
reconcileRemoteJobs(engine);
const sites=new SiteEngine(store);
let opsLocal:Ops|undefined;
/** Desktop/dev: business ops run in-process next to the workspace DB. Cloud sets OPS_URL and proxies to the ops service. */
const localOps=()=>opsLocal??=new Ops(new OpsStore(process.env.OPS_DB??resolve(dirname(process.env.IOT_DB_PATH??resolve('.data/iot.sqlite')),'ops.sqlite')),parseRoles(process.env.OPS_ROLES));
async function opsUpstream(method:string,path:string,user:string,payload:unknown){
 const response=await fetch(process.env.OPS_URL+path,{method,headers:{Authorization:'Bearer '+(process.env.OPS_OWNER_TOKEN??''),'X-Ops-User':user,'Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(10000)});
 return{status:response.status,data:await response.json().catch(()=>({error:'Ops service returned an invalid response'}))};
}
const cloudRefusal='Provider not available in cloud; use the desktop app for your own keys.';
const trusted=new Map<string,number>();
const origins=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`,`http://127.0.0.1:${webPort}`,`http://localhost:${webPort}`]);
function json(res:ServerResponse,status:number,data:unknown){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function body(req:IncomingMessage){let text='';for await(const chunk of req){text+=chunk;if(text.length>100000)throw new Error('Request too large');}return text?JSON.parse(text):{};}
function authorize(req:IncomingMessage){if(req.headers['x-iot-session']!==session)throw new Error('Local session authorization required');}
function background(promise:Promise<unknown>){promise.catch(error=>console.error(safeError(error)));}
import {ProjectMetadataSchema,HumanActionSchema,EnvironmentRecordSchema,RightsRecordSchema,ExportPurposeSchema} from '../../packages/episodes/index.js';
const createSchema=z.object({goal:z.string().trim().min(8).max(2000),entryPoint:z.enum(['build','learn']).optional(),actor:z.enum(['human','agent']).optional(),challengeId:z.string().regex(/^[a-z0-9-]{3,64}$/).optional(),challengeVersion:z.number().int().positive().optional()}).strict().superRefine((value,ctx)=>{try{challengeReference(value);}catch(error){ctx.addIssue({code:'custom',message:error instanceof Error?error.message:'Invalid challenge reference'});}});
const runSchema=z.object({mode:z.enum(['simulation','physical']),fault:z.enum(['none','sda']).default('none'),port:z.string().optional(),parentId:z.string().uuid().optional(),repairConfirmed:z.boolean().optional(),backend:z.enum(['template-model','wokwi-cli']).default('template-model')});
const server=createServer(async(req,res)=>{try{
 const host=req.headers.host??'';if(!new Set([`127.0.0.1:${port}`,`localhost:${port}`,`127.0.0.1:${webPort}`,`localhost:${webPort}`]).has(host)){json(res,403,{error:'Untrusted host'});return;}
 if(req.headers.origin&&!origins.has(req.headers.origin)){json(res,403,{error:'Untrusted origin'});return;}
 const path=new URL(req.url??'/',`http://127.0.0.1:${port}`).pathname;
 if(path.startsWith('/ops/v1/admin/')){json(res,404,{error:'Not found'});return;}
 if(path.startsWith('/ops/v1/')){if(process.env.OPS_URL){json(res,404,{error:'Not found'});return;}const result=await localOps().handle({method:req.method??'GET',path,body:req.method==='POST'?await body(req):undefined,ip:req.socket.remoteAddress??'local'});json(res,result?.status??404,result?.data??{error:'Not found'});return;}
 if(path==='/api/session'&&req.method==='GET'){json(res,200,{token:session,local:true});return;}
 if(path==='/api'&&req.method==='GET'){json(res,200,{name:'iot.ai.id local API',version:'v1',auth:'GET /api/session then X-IOT-Session header; loopback Host/Origin only',endpoints:{'GET /api':'this directory','GET /api/session':'local session token','GET|POST|PATCH /api/ops/*':'business ops: inquiries, organizations, products, lab tasks, payouts (role-checked)','POST /ops/v1/inquiries':'public inquiry form (rate-limited)','GET /ops/v1/catalog':'public distributor catalog','GET /ops/v1/labs':'public Lab Mitra board','GET /api/status':'runtime, simulators, knowledge, counts','GET /api/backoffice':'operator dashboard aggregate (coordinator proxy)','GET /api/comparisons':'agent vs human challenge attempts','GET /api/hardware':'board + component manifests','GET /api/challenges':'challenge catalog with scenarios','GET /api/remote-jobs':'active remote jobs','POST /api/remote-jobs':'enqueue local remote job (node use)','POST /api/remote-jobs/:id/approve':'human approval (physical requires trusted port)','POST /api/remote-jobs/:id/renew':'extend approval window','GET /api/sites':'locations and farm planning profiles','POST /api/sites':'create site snapshot','GET /api/sites/:id':'site and derived evidence status','PUT /api/sites/:id':'CAS {expectedRevision,snapshot}','GET /api/projects/:id/sites':'validated site memberships','GET /api/projects':'list projects','POST /api/projects':'create {goal, entryPoint?, actor?, challengeId?, challengeVersion?}','GET /api/projects/:id/challenge':'challenge scenario verdicts judged from evidence','GET /api/projects/:id':'full project state','GET /api/projects/:id/events?after=':'ordered event replay','GET /api/projects/:id/episode?purpose=':'episode export','POST /api/projects/:id/chat':'design/debug chat revision','POST /api/projects/:id/components':'catalog add/remove draft','POST /api/projects/:id/wiring':'strict external wiring snapshot revision','POST /api/projects/:id/run':'simulation or physical run','POST /api/projects/:id/retry':'repair retest','POST /api/projects/:id/replan':'regenerate plan','POST /api/projects/:id/actions':'human action record','POST /api/projects/:id/environment':'environment record','POST /api/projects/:id/rights':'rights attestation','POST /api/runtime/trust':'authorize a USB port for 20 minutes'},agent:{mcp:'npm run api:mcp (MCP stdio server over this API)',docs:'/api route in the web app'}});return;}
 if(path.startsWith('/api/')){
 authorize(req);
 if(path.startsWith('/api/ops/')){const sub='/ops/v1/admin/'+path.slice('/api/ops/'.length);const user=String(req.headers['x-remote-user']??'');const payload=req.method==='GET'?undefined:await body(req);
  const result=process.env.OPS_URL?await opsUpstream(req.method??'GET',sub,user,payload):await localOps().handle({method:req.method??'GET',path:sub,body:payload,ip:'local',admin:{user}});json(res,result?.status??404,result?.data??{error:'Not found'});return;}
 if(path==='/api/ai-settings'&&req.method==='GET'){const cli=await cliAvailability();json(res,200,{...credentialVault.metadata(),deployment,preferences:credentialVault.preferences(),registry:allowedProviders(deployment).map(p=>({id:p.id,label:p.label,protocol:p.protocol,models:p.models,keyUrl:p.keyUrl,scope:p.scope,...(p.protocol==='cli'?{available:cli[p.id as 'codex-cli']}:{})})),dailyLimit:Number.isFinite(dailyLimit)?dailyLimit:null});return;}
 if(path==='/api/ai-settings/preferences'&&req.method==='PUT'){const input=AiPreferencesSchema.parse(await body(req)),allowed=allowedProviders(deployment).map(p=>p.id as string);if(deployment==='cloud'&&(input.customBaseUrl!==undefined||(input.active&&!allowed.includes(input.active))||Object.keys(input.models).some(id=>!allowed.includes(id)))){json(res,400,{error:cloudRefusal});return;}credentialVault.setPreferences(input,auditUser(req));json(res,200,{...credentialVault.metadata(),deployment,preferences:credentialVault.preferences()});return;}
 const aiSetting=path.match(/^\/api\/ai-settings\/(openai|anthropic|minimax|zai|custom|typesafe)(?:\/(test))?$/);
 if(aiSetting){const provider=ProviderName.parse(aiSetting[1]),user=auditUser(req);if(!credentialProviders().includes(provider)){json(res,400,{error:cloudRefusal});return;}
  if(!aiSetting[2]&&req.method==='PUT'){const input=SecretInput.parse(await body(req));credentialVault.save(provider,input.key,user);json(res,200,credentialVault.metadata());return;}
  if(!aiSetting[2]&&req.method==='DELETE'){credentialVault.remove(provider,user);json(res,200,credentialVault.metadata());return;}
  if(aiSetting[2]==='test'&&req.method==='POST'){z.object({}).strict().parse(await body(req));const key=credentialVault.snapshot()[provider];if(!key){json(res,400,{error:'Simpan API key sebelum menguji koneksi.'});return;}const fingerprint=credentialVault.metadata().providers[provider].fingerprint!;const result=await testCredential(provider,key,fetch,credentialVault.preferences().customBaseUrl);credentialVault.recordTest(provider,fingerprint,result.connected,user);json(res,200,{...result,settings:credentialVault.metadata()});return;}
 }

 if(path==='/api/sites'&&req.method==='GET'){json(res,200,{sites:sites.list(),profiles:farmProfiles});return;}
 if(path==='/api/sites'&&req.method==='POST'){json(res,201,sites.create(await body(req)));return;}
 const siteMatch=path.match(/^\/api\/sites\/([\w-]+)$/);
 if(siteMatch&&req.method==='GET'){json(res,200,sites.get(siteMatch[1]));return;}
 if(siteMatch&&req.method==='PUT'){json(res,200,sites.update(siteMatch[1],await body(req)));return;}
 const membershipMatch=path.match(/^\/api\/projects\/([\w-]+)\/sites$/);
 if(membershipMatch&&req.method==='GET'){json(res,200,{memberships:sites.memberships(membershipMatch[1])});return;}
 if(path==='/api/status'&&req.method==='GET'){const runtime=await engine.runtime.detect();json(res,200,{runtime,simulators:await engine.simulationCapabilities(),knowledge:{url:engine.knowledge.url},counts:{projects:store.list('projects').length,components:components.length,physicalVerified:store.list('verifications').filter(v=>v.physical===true&&v.status==='VERIFIED').length,simulatedVerified:store.list('verifications').filter(v=>v.status==='SIMULATED_VERIFIED').length},providers:await(async()=>{const availability=await providerAvailability();return{...availability,credentials:credentialVault.metadata(),default:fixture?'FixtureAgent (deterministic verification mode)':'JevProvider',frontier:availability.active?.model??'gpt-6.1-sol',reasoning:'low'};})()});return;}
 if(path==='/api/comparisons'&&req.method==='GET'){
  const grouped=new Map<string,any[]>();
  for(const project of store.list('projects')){if(!project.challengeId)continue;const key=`${project.challengeId}@${project.challengeVersion??1}`;grouped.set(key,[...(grouped.get(key)??[]),project]);}
  const verdict=(project:any)=>{const challenge=getChallenge(project.challengeId,project.challengeVersion??undefined);return judgeChallenge(challenge,{contractId:project.contractId,experiments:store.list('experiments',project.id),observations:store.list('observations',project.id)});};
  const comparisons=[...grouped.entries()].map(([key,projects])=>({challenge:key.split('@')[0],version:Number(key.split('@')[1]),
   attempts:projects.sort((a:any,b:any)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).map((project:any)=>({projectId:project.id,actor:project.actor??'human',status:project.status,updatedAt:project.updatedAt,
    latestExperiment:store.list('experiments',project.id).at(-1)?.status??null,verification:store.list('verifications',project.id).at(-1)?.status??null,
    scenarios:verdict(project)}))}));
  json(res,200,{comparisons});return;}
 if(path==='/api/backoffice'&&req.method==='GET'){
  const projects=store.list('projects');
  const rows=projects.map((p:any)=>{const experiments=store.list('experiments',p.id);return{id:p.id,goal:p.goal,title:p.title,status:p.status,entryPoint:p.entryPoint??'build',updatedAt:p.updatedAt,chatCount:store.list('chat_messages',p.id).length,contractVersions:store.list('contracts',p.id).length,experimentCount:experiments.length,lastVerification:store.list('verifications',p.id).at(-1)??null};});
  const allExperiments=projects.flatMap((p:any)=>store.list('experiments',p.id).map((e:any)=>({id:e.id,projectId:p.id,title:p.title,mode:e.mode,status:e.status,createdAt:e.createdAt}))).sort((a:any,b:any)=>b.createdAt.localeCompare(a.createdAt));
  const recentExperiments=allExperiments.slice(0,60);
  const allRemoteJobs=store.list('remote_jobs');
  const aggregates=backofficeAggregates(allExperiments,allRemoteJobs);
  const verifications=store.list('verifications');
  json(res,200,{generatedAt:new Date().toISOString(),projects:rows,recentExperiments,experimentDaily:aggregates.experimentDaily,activeJobs:aggregates.activeJobs,remoteJobs:allRemoteJobs.slice(0,20),counts:{activeRemoteJobs:aggregates.activeRemoteJobs,awaitingApproval:aggregates.awaitingApproval,projects:rows.length,experiments:rows.reduce((sum:number,r:any)=>sum+r.experimentCount,0),physicalVerified:verifications.filter(v=>v.physical===true&&v.status==='VERIFIED').length,simulatedVerified:verifications.filter(v=>v.status==='SIMULATED_VERIFIED').length},knowledge:{url:engine.knowledge.url},coordinator:await coordinatorView()});return;}
 if(path==='/api/hardware'&&req.method==='GET'){const params=new URL(req.url!,'http://local').searchParams;const filter=HardwareLibraryFilterSchema.parse(Object.fromEntries(['q','kind','category','family','protocol'].filter(key=>params.has(key)).map(key=>[key,params.get(key)])));const all=store.hardwareLibrary(),catalog=store.hardwareLibrary(filter);json(res,200,{board:esp32Devkit,components,boards:all.filter(r=>r.kind==='board'),catalog,metadata:{storage:'sqlite',total:all.length,matched:catalog.length,boards:all.filter(r=>r.kind==='board').length,categories:[...new Set(all.map(r=>r.category))].sort(),families:[...new Set(all.map(r=>r.family))].sort(),protocols:[...new Set(all.flatMap(r=>r.protocols))].sort(),seed:catalogSeed,reviewStatus:'specification_only'}});return;}
 if(path.startsWith('/api/hardware/')&&req.method==='GET'){const record=store.hardwareReference(decodeURIComponent(path.slice('/api/hardware/'.length)));json(res,record?200:404,record??{error:'Hardware reference not found'});return;}
 if(path==='/api/challenges'&&req.method==='GET'){json(res,200,{challenges:publicChallenges()});return;}
 if(path==='/api/remote-jobs'&&req.method==='GET'){json(res,200,{jobs:store.list('remote_jobs').filter((j:any)=>['awaiting_approval','running'].includes(j.status))});return;}
 if(path==='/api/remote-jobs'&&req.method==='POST'){json(res,201,receiveRemoteJob(engine,await body(req)));return;}
 const remoteMatch=path.match(/^\/api\/remote-jobs\/([\w-]+)(?:\/(approve|renew))?$/);
 if(remoteMatch){const job=store.get('remote_jobs',remoteMatch[1]);if(!job)throw new Error('Remote job not found');if(!remoteMatch[2]&&req.method==='GET'){json(res,200,job);return;}if(remoteMatch[2]==='renew'&&req.method==='POST'){const input=z.object({leaseId:z.string().uuid(),expiresAt:z.number().int().positive()}).strict().parse(await body(req));if(input.leaseId!==job.input.leaseId||input.expiresAt<=Date.now()||input.expiresAt>Date.now()+31000||job.input.expiresAt<=Date.now())throw new Error('Stale remote lease');store.update('remote_jobs',{...job,input:{...job.input,expiresAt:input.expiresAt}});json(res,200,{renewed:true});return;}if(remoteMatch[2]==='approve'&&req.method==='POST'){const input=z.object({authorize:z.literal(true),port:z.string().max(200).optional()}).strict().parse(await body(req));if(job.input.operation==='physical'&&(!input.port||(trusted.get(input.port)??0)<Date.now()))throw new Error('Authorize selected local USB node before flashing');background(approveRemoteJob(engine,job.id,input.port));json(res,202,{accepted:true});return;}}
 if(path==='/api/projects'&&req.method==='GET'){json(res,200,{projects:store.list('projects')});return;}
 if(path==='/api/projects'&&req.method==='POST'){const input=createSchema.parse(await body(req));const project=engine.create(input.goal,ProjectMetadataSchema.parse({entryPoint:input.entryPoint,actor:input.actor,challengeId:input.challengeId,challengeVersion:input.challengeVersion}));background(engine.plan(project.id));json(res,202,project);return;}
 if(path==='/api/runtime/trust'&&req.method==='POST'){const input=z.object({port:z.string(),authorize:z.literal(true)}).parse(await body(req));const detected=await engine.runtime.detect();if(!detected.devices.some((d:any)=>d.port===input.port&&d.candidate))throw new Error('No detected USB serial candidate selected');trusted.set(input.port,Date.now()+20*60000);json(res,200,{trusted:true,port:input.port,expiresAt:new Date(trusted.get(input.port)!).toISOString()});return;}
 const match=path.match(/^\/api\/projects\/([\w-]+)(?:\/(events|run|retry|replan|actions|environment|rights|episode|chat|components|wiring|challenge))?$/);
 if(match){const projectId=match[1];if(!store.get('projects',projectId)){json(res,404,{error:'Project not found'});return;}
 if(!match[2]&&req.method==='GET'){json(res,200,engine.project(projectId));return;}
 if(match[2]==='chat'&&req.method==='POST'){json(res,200,await engine.chat(projectId,ChatInputSchema.parse(await body(req))));return;}
 if(match[2]==='components'&&req.method==='POST'){json(res,201,engine.changeComponent(projectId,ComponentChangeSchema.parse(await body(req))));return;}
 if(match[2]==='wiring'&&req.method==='POST'){json(res,201,engine.reviseWiring(projectId,WiringChangeSchema.parse(await body(req))));return;}
 if(match[2]==='actions'&&req.method==='POST'){json(res,201,engine.recordAction(projectId,HumanActionSchema.parse(await body(req))));return;}
 if(match[2]==='environment'&&req.method==='POST'){json(res,201,engine.recordEnvironment(projectId,EnvironmentRecordSchema.parse(await body(req))));return;}
 if(match[2]==='rights'&&req.method==='POST'){json(res,201,engine.recordRights(projectId,RightsRecordSchema.parse(await body(req))));return;}
 if(match[2]==='challenge'&&req.method==='GET'){const p=engine.project(projectId);if(!p.challengeId)throw new Error('Project has no challenge reference');const challenge=getChallenge(p.challengeId,p.challengeVersion??undefined);json(res,200,{challenge:{id:challenge.id,version:challenge.version,title:challenge.title,support:challenge.support},actor:p.actor??'human',verdicts:judgeChallenge(challenge,p)});return;}
 if(match[2]==='episode'&&req.method==='GET'){const purpose=ExportPurposeSchema.parse(new URL(req.url!,'http://local').searchParams.get('purpose')??'local');json(res,200,engine.episode(projectId,purpose));return;}
 if(match[2]==='events'&&req.method==='GET'){const after=Number(new URL(req.url!,'http://local').searchParams.get('after')??0);json(res,200,{events:store.events(projectId,Number.isFinite(after)?after:0)});return;}
 if(match[2]==='replan'&&req.method==='POST'){if(engine.busy.has(projectId))throw new Error('Operation already running');background(engine.plan(projectId));json(res,202,{accepted:true});return;}
 if(['run','retry'].includes(match[2])&&req.method==='POST'){const input=runSchema.parse(await body(req));if(engine.busy.has(projectId))throw new Error('Operation already running');const p=engine.assertExecutable(projectId);if(input.mode==='simulation')await engine.selectedSimulator(input.backend);if(!p.contractId||!p.contracts.find((c:any)=>c.id===p.contractId)?.validation.valid)throw new Error('Valid hardware contract required');if(input.mode==='physical'&&(!input.port||(trusted.get(input.port)??0)<Date.now()))throw new Error('Authorize selected local USB node before flashing');if(input.mode==='physical'&&input.port&&engine.ports.has(input.port))throw new Error('Physical port already in use');if(match[2]==='retry'){const parent=p.experiments.find((e:any)=>e.id===input.parentId);if(parent&&parent.contractId!==p.contractId)throw new Error('Recovery requires current contract evidence');if(!parent||!['FAILED','ERROR'].includes(parent.status))throw new Error('Failed parent experiment required');const repair=p.repairs.find((r:any)=>r.experimentId===parent.id);if(!repair||(input.mode==='physical'&&!repair.retryAllowed))throw new Error('A permitted repair is required');if(input.repairConfirmed!==true)throw new Error('Confirm repair before retesting');if(parent.mode!==input.mode)throw new Error('Recovery must use the same evidence mode');store.event(projectId,'repair.confirmed',{repairId:repair.id,parentId:parent.id,mode:input.mode});}else if(input.parentId)throw new Error('Use retry endpoint for recovery');background(engine.run(projectId,input.mode,match[2]==='retry'?'none':input.fault,input.port,input.parentId,input.backend));json(res,202,{accepted:true});return;}
 }
 json(res,404,{error:'API route not found'});return;
 }
 if(req.method!=='GET'){json(res,405,{error:'Method not allowed'});return;}
 const root=resolve('dist/web');let file=resolve(root,'.'+decodeURIComponent(path));if(file!==root&&!file.startsWith(root+'/')){json(res,403,{error:'Invalid path'});return;}
 try{if(!(await stat(file)).isFile())file=resolve(root,'index.html');}catch{file=resolve(root,'index.html');}
 if(!existsSync(file)){json(res,404,{error:'Use npm run dev for development, or npm run build first.'});return;}
 const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.json':'application/json'};res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(await readFile(file));
 }catch(error){const errorStatus=error instanceof RevisionConflict?409:/Daily AI limit/.test(safeError(error))?429:/authorization|Untrusted/.test(safeError(error))?403:/not found/.test(safeError(error))?404:400;const text=error instanceof Error&&error.message==='Local session authorization required'?'Local session authorization required':(req.url??'').startsWith('/api/ai-settings')?'Pengaturan AI gagal. Periksa format key atau integritas penyimpanan.':safeError(error);json(res,errorStatus,{error:text});}});
server.listen(port,bindHost,()=>console.log(`IOT AI ID API: http://${bindHost==='0.0.0.0'?'127.0.0.1':bindHost}:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{terminateActiveProcesses();server.close(()=>{store.close();process.exit(0);});});
// A first-entry probe prevents fan-out when the knowledge backend is unavailable.
background((async()=>{const records=store.hardwareLibrary();if(!records.length)return;const remember=async(record:typeof records[number])=>{const receipt=await engine.knowledge.remember('hardware-catalog/'+record.id,hardwareKnowledgeDocument(record));store.insert('knowledge_receipts','system',{id:id(),operation:'seed_catalog',referenceId:record.id,referenceVersion:record.version,...receipt,createdAt:now()});return receipt;};const first=await remember(records[0]);if(first.status!=='stored')return;let cursor=1;await Promise.all(Array.from({length:3},async()=>{while(cursor<records.length){const record=records[cursor++];await remember(record);}}));})());
