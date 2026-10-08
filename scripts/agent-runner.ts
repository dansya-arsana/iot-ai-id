/** Autonomous agent runner: one bounded attempt at a challenge through the public local API.
 *  Produces an agent-side trajectory in the same evidence-bound episode structure as human runs
 *  (project actor=agent, agent_runs recorded by the engine). Deterministic with the fixture provider;
 *  real frontier when IOT_AGENT_PROVIDER is unset. Exit code 0 only when every scenario passes. */
const url=process.env.IOT_API_URL??'http://127.0.0.1:8787';
const challengeId=process.env.IOT_AGENT_CHALLENGE??'room-monitor';
const endpoint=new URL(url);
if(endpoint.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname))throw new Error('Agent runner requires a loopback API URL');
let session:string|undefined;
async function call(path:string,method:'GET'|'POST',body?:unknown){
 const attempt=async(token?:string)=>{
  const response=await fetch(url+path,{method,redirect:'error',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{'X-IOT-Session':token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(180000)});
  const data=await response.json().catch(()=>({}));
  return{ok:response.ok,status:response.status,data} as const;};
 if(!session){const boot=await fetch(url+'/api/session',{signal:AbortSignal.timeout(10000)});if(!boot.ok)throw new Error('Local API unavailable; start npm run dev or npm run api first');session=(await boot.json()).token as string;}
 let result=await attempt(session);
 if(result.status===403){const boot=await fetch(url+'/api/session',{signal:AbortSignal.timeout(10000)});session=(await boot.json()).token as string;result=await attempt(session);}
 if(!result.ok)throw new Error(String((result.data as any).error??`HTTP ${result.status}`));
 return result.data;
}
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function settle(projectId:string,timeoutMs=180000){
 const deadline=Date.now()+timeoutMs;
 for(;;){
  const p=await call('/api/projects/'+projectId,'GET');
  if(!p.busy&&p.status!=='running'&&p.experiments.length&&['VERIFIED','SIMULATED_VERIFIED','FAILED','ERROR'].includes(p.experiments.at(-1).status))return p;
  if(Date.now()>deadline)throw new Error('Timed out waiting for the experiment to settle');
  await sleep(1000);
 }
}
const catalog=await call('/api/challenges','GET');
const challenge=(catalog.challenges as any[]).find(c=>c.id===challengeId);
if(!challenge)throw new Error(`Unknown challenge ${challengeId}`);
if(challenge.support!=='golden'){console.error(`Challenge ${challengeId} is a draft; no executable recipe to attempt yet.`);process.exit(2);}
console.log(`[agent-runner] attempting ${challenge.id} v${challenge.version}: ${challenge.title}`);
const project=await call('/api/projects','POST',{goal:challenge.goal,entryPoint:'build',actor:'agent',challengeId:challenge.id,challengeVersion:challenge.version});
console.log(`[agent-runner] project ${project.id} (actor=agent); planning…`);
let current:any;
for(let i=0;i<60;i++){current=await call('/api/projects/'+project.id,'GET');if(current.status!=='planning')break;await sleep(1000);}
if(current.status!=='ready'){console.error(`[agent-runner] planning ended in ${current.status}: ${current.clarification??current.error??''}`);process.exit(2);}
console.log('[agent-runner] contract ready; healthy run');
await call('/api/projects/'+project.id+'/run','POST',{mode:'simulation',backend:'template-model',fault:'none'});
current=await settle(project.id);
let latest=current.experiments.at(-1);
if(latest.status!=='SIMULATED_VERIFIED'&&latest.status!=='VERIFIED'){console.error(`[agent-runner] healthy run ended ${latest.status}; refusing to stage the deliberate failure on top`);process.exit(1);}
console.log('[agent-runner] healthy run verified; staging deliberate SDA failure');
await call('/api/projects/'+project.id+'/run','POST',{mode:'simulation',backend:'template-model',fault:'sda'});
current=await settle(project.id);
latest=current.experiments.at(-1);
if(latest.status==='FAILED'){
 console.log('[agent-runner] deliberate failure observed; requesting grounded diagnosis');
 await call('/api/projects/'+project.id+'/chat','POST',{message:'Eksperimen gagal; mohon diagnosis berbasis bukti terbaru.',purpose:'debug',expectedContractId:current.contractId,expectedDraftId:current.activeDesign?.id??null});
 await call('/api/projects/'+project.id+'/retry','POST',{mode:'simulation',backend:'template-model',parentId:latest.id,repairConfirmed:true});
 current=await settle(project.id);
 latest=current.experiments.at(-1);
}
const progress=await call('/api/projects/'+project.id+'/challenge','GET');
console.log(`[agent-runner] final experiment: ${latest.status}`);
for(const verdict of progress.verdicts as any[])console.log(`  ${verdict.status==='pass'?'PASS':verdict.status==='fail'?'FAIL':'PEND'}  ${verdict.name} — ${verdict.evidence}`);
const passed=(progress.verdicts as any[]).every(v=>v.status==='pass');
console.log(`[agent-runner] challenge ${challenge.id}: ${passed?'ALL SCENARIOS PASS':'not complete'}`);
process.exit(passed?0:1);

export {};
