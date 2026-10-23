/**
 * Staff live smoke for the Pro agent (ADR 012 open items). Runs ONE real turn per model through the real path:
 * ops loop (temp DB, staff subject, installPro dispatcher) -> http -> the real api proxy handler (handleProMessages) -> Anthropic.
 * The key comes from the CredentialVault at the dev server's secrets dir; it is read only inside the proxy handler and never printed.
 * The dev server ports are not touched: the proxy listens on an ephemeral loopback port with a throwaway token.
 *   npx tsx scripts/pro-live-smoke.ts [claude-sonnet-5-5|claude-opus-5-5 ...]
 * Cost cap: USD 2 per turn here (checked before every model call; the turn then ends with an error); the agent also has its own per-turn hard cap (default USD 3, stopReason 'budget').
 */
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import type {AddressInfo} from 'node:net';
import {CredentialVault} from '../services/api/credentials.js';
import {handleProMessages,handleProConfig,PRO_MESSAGES_PATH,PRO_CONFIG_PATH} from '../services/api/pro-model.js';
import {Ops,OpsStore,RateLimit} from '../services/ops/ops.js';
import {staffInvite} from '../services/ops/cli.js';
import {installPro} from '../services/ops/pro-wiring.js';
import {httpProLlm,type ProLlm} from '../services/ops/pro-agent.js';
import type {AgentEvent} from '../packages/pro-contract/agent.js';
import {PRO_MODELS,type AiPreferences} from '../packages/ai-providers/index.js';

const PROMPT='Small IoT for one melon greenhouse in Bogor: soil moisture, air temp/humidity, a 12 V drip valve, ESP32 node, Wi-Fi to a Raspberry Pi gateway.';
const CAP_MICROS=2_000_000;
const secrets=process.env.IOT_SECRETS_PATH??resolve('.data/secrets');
const models=process.argv.slice(2).length?process.argv.slice(2):['claude-sonnet-5-5','claude-opus-5-5'];
for(const m of models)if(!(PRO_MODELS as readonly string[]).includes(m)){console.error('unknown model',m);process.exit(2);}

async function runModel(model:string){
 const vault=new CredentialVault(secrets);
 const basePrefs=vault.preferences();
 // The founder's saved preferences stay untouched; only the model is overridden for this run.
 const preferences=():AiPreferences=>({...basePrefs,builder:{effort:'high',thinkingDisplay:'summarized',...basePrefs.builder,model} as AiPreferences['builder']});
 if(!vault.snapshot().anthropic){console.error('no Anthropic key in the vault at',secrets);process.exit(2);}
 const token=randomBytes(24).toString('hex');
 const server=createServer((req,res)=>{
  const deps={vaultKey:()=>vault.snapshot().anthropic,preferences,token};
  if(req.url===PRO_MESSAGES_PATH)void handleProMessages(req,res,deps);
  else if(req.url===PRO_CONFIG_PATH)handleProConfig(req,res,deps);
  else{res.writeHead(404);res.end();}
 });
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 const dir=mkdtempSync(join(tmpdir(),'pro-smoke-'));
 let spentMicros=0;
 const inner=httpProLlm(url,token);
 const llm:ProLlm={...inner,config:inner.config,async *stream(req,sig){
  if(spentMicros>=CAP_MICROS)throw new Error(`per-turn cap of USD ${CAP_MICROS/1e6} reached`);
  yield* inner.stream(req,sig);
 }};
 const t0=Date.now();
 const ops=new Ops(new OpsStore(join(dir,'ops.sqlite')),new Map(),new RateLimit());
 const pro=installPro(ops,{llm});
 const made=await staffInvite(ops,['smoke','owner','smoke person']);
 const a=await ops.handle({method:'POST',path:'/ops/v1/staff/activate',body:{code:made.inviteCode,password:'a long staff password'},ip:'3.3.3.3',headers:{'x-aiot-staff':'1'}});
 const staff=/aiot_admin=([^;]*)/.exec(String(a!.setCookie??''))?.[1]??'';
 const call=async(method:string,path:string,body?:unknown)=>(await ops.handle({method,path:'/ops/v1/member/pro/'+path,body,ip:'5.5.5.5',headers:{cookie:`aiot_admin=${staff}`,'x-aiot-staff':'1'}})) as {status:number;data:any};
 const pid=(await call('POST','projects',{name:'Melon smoke'})).data.id as string;
 console.log(`\n=== ${model} ===`);
 const start=await call('POST',`projects/${pid}/turns`,{message:PROMPT});
 if(start.status!==202){console.log('start failed',start.status,JSON.stringify(start.data).slice(0,300));throw new Error('turn did not start');}
 const turnId=start.data.turnId as string;
 const events:AgentEvent[]=[];let after=-1,done=false;
 while(!done){
  const r=await call('GET',`projects/${pid}/turns/${turnId}/poll/${after}`);
  for(const e of r.data.events as AgentEvent[]){
   events.push(e);after=e.seq;
   if(e.type==='tool_call')console.log(`  tool_call ${e.name}`);
   else if(e.type==='tool_result'&&!e.ok)console.log(`  tool_result ${e.name} FAILED ${JSON.stringify(e.output).slice(0,e.name==='save_revision'?240:500)}`);
   else if(e.type==='revision_saved')console.log(`  revision_saved r${e.revision}${e.draft?' (DRAFT)':''} verified=${e.verified} unverified=${e.unverified} failed=${e.failed}`);
   else if(e.type==='usage'){spentMicros+=e.usdMicros??0;console.log(`  usage in=${e.inputTokens} out=${e.outputTokens} cr=${e.cacheReadTokens} cw=${e.cacheWriteTokens} usd=${((e.usdMicros??0)/1e6).toFixed(4)}`);}
   else if(e.type==='error')console.log(`  ERROR ${e.code}: ${e.message}`);
   else if(e.type==='done')console.log(`  done stopReason=${e.stopReason}`);
  }
  done=!!r.data.done&&!r.data.events.length;
 }
 const wall=Date.now()-t0;
 const calls=events.filter(e=>e.type==='tool_call') as Extract<AgentEvent,{type:'tool_call'}>[];
 const results=events.filter(e=>e.type==='tool_result') as Extract<AgentEvent,{type:'tool_result'}>[];
 const counts:Record<string,number>={};for(const c of calls)counts[c.name]=(counts[c.name]??0)+1;
 const failedTools:Record<string,number>={};for(const r of results)if(!r.ok)failedTools[r.name]=(failedTools[r.name]??0)+1;
 const savedAll=events.filter(e=>e.type==='revision_saved') as Extract<AgentEvent,{type:'revision_saved'}>[];
 const saved=[...savedAll].reverse().find(e=>!e.draft);
 // save_revision attempts (calls, in order) up to and including the one that produced the first non-draft verified revision
 const saveCalls=new Map<string,number>();let attempts=0;let attemptsToFirstVerified:number|null=null;
 for(const e of events){
  if(e.type==='tool_call'&&e.name==='save_revision'){saveCalls.set(e.callId,++attempts);}
  else if(e.type==='tool_result'&&e.name==='save_revision'&&e.ok&&attemptsToFirstVerified===null){
   const o=e.output as {draft?:boolean;verification?:{verified?:number}}|undefined;
   if(!o?.draft&&(o?.verification?.verified??0)>0)attemptsToFirstVerified=saveCalls.get(e.callId)??null;
  }
 }
 const reasons:Record<string,number>={};
 if(saved){
  const v=pro.revisionView(pid,saved.revision);
  const map=((v?.spec as {verification?:Record<string,{status:string;note?:string}>}|undefined)?.verification)??{};
  for(const x of Object.values(map))if(x.status!=='verified'){const k=`${x.status}: ${(x.note??'(no note)').slice(0,100)}`;reasons[k]=(reasons[k]??0)+1;}
 }
 const sum=(f:(e:Extract<AgentEvent,{type:'usage'}>)=>number)=>(events.filter(e=>e.type==='usage') as Extract<AgentEvent,{type:'usage'}>[]).reduce((s,e)=>s+f(e),0);
 const summary={
  model,distinctTools:Object.keys(counts),toolCallCounts:counts,totalToolCalls:calls.length,failedToolResults:failedTools,
  revision:saved?.revision??null,
  saveRevision:{attempts,draftsSaved:savedAll.filter(x=>x.draft).length,failedAttempts:failedTools.save_revision??0,attemptsToFirstNonDraftVerifiedRevision:attemptsToFirstVerified},
  verification:saved?{verified:saved.verified,unverified:saved.unverified,failed:saved.failed,topUnverifiedReasons:Object.entries(reasons).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([reason,n])=>({reason,n}))}:null,
  tokens:{input:sum(e=>e.inputTokens),output:sum(e=>e.outputTokens),cacheRead:sum(e=>e.cacheReadTokens),cacheWrite:sum(e=>e.cacheWriteTokens)},
  usdEstimate:Number((sum(e=>e.usdMicros??0)/1e6).toFixed(4)),
  wallSeconds:Number((wall/1000).toFixed(1)),
  stopReason:(events.find(e=>e.type==='done') as {stopReason?:string}|undefined)?.stopReason??null,
  errors:events.filter(e=>e.type==='error').map(e=>(e as {code:string;message:string}).code+': '+(e as {message:string}).message),
 };
 console.log(JSON.stringify(summary,null,2));
 console.log(`save_revision attempts to the first non-draft verified revision: ${attemptsToFirstVerified??'never (no non-draft verified revision)'} (total attempts ${attempts}, drafts ${savedAll.filter(x=>x.draft).length})`);
 server.close();rmSync(dir,{recursive:true,force:true});
 return summary;
}

for(const m of models){
 const s=await runModel(m);
 if(s.errors.length&&s.stopReason!=='end_turn'){console.error('stopping early after errors');process.exitCode=1;break;}
}
process.exit(process.exitCode??0);
