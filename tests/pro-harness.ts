/** Shared setup for the pro-ops and pro-agent tests (not a test file). */
import {Ops,OpsStore,RateLimit} from '../services/ops/ops.js';
import {staffInvite} from '../services/ops/cli.js';
import {proFor,type ProDeps} from '../services/ops/pro.js';
import type {AgentEvent} from '../packages/pro-contract/agent.js';
import type {ProLlm,ProLlmRequest,StreamEvent} from '../services/ops/pro-agent.js';

export type R={status:number;data:any;setCookie?:string|string[];stream?:(w:(f:string)=>void,e:()=>void)=>()=>void};

/** Gate that accepts anything and stamps one verified and one unverified item. */
export const stubGate:NonNullable<ProDeps['gate']>=spec=>({
 ok:true,spec:{...(spec as object),verification:{'/nodes/0':{status:'verified',by:'t',at:'2026-10-23T00:00:00Z',inputsSha:'0'.repeat(64)},'/links/0':{status:'unverified',by:'t',at:'2026-10-23T00:00:00Z',inputsSha:'0'.repeat(64),note:'LoRa margin is an estimate'}}},checks:[],
});

export function harness(deps:ProDeps={}){
 const clock={t:Date.parse('2026-10-23T03:00:00Z')};
 const ops=new Ops(new OpsStore(':memory:'),new Map(),new RateLimit(),()=>new Date(clock.t));
 const pro=proFor(ops,{retryDelaysMs:[0,0],gate:stubGate,...deps});
 const admin=async(user:string,method:string,path:string,body?:unknown):Promise<R>=>(await ops.handle({method,path:'/ops/v1/admin/'+path,body,ip:'9.9.9.9',admin:{user}}))as R;
 async function staff(){const made=await staffInvite(ops,['daniel','owner','daniel person']);const r=await ops.handle({method:'POST',path:'/ops/v1/staff/activate',body:{code:made.inviteCode,password:'a long staff password'},ip:'3.3.3.3',headers:{'x-aiot-staff':'1'}});return/aiot_admin=([^;]*)/.exec(String(r!.setCookie??''))?.[1]??'';}
 /** `pro` is not in MEMBER_GRANTS until the integrator adds it, so the grant is written straight to the store. */
 async function member(username:string,withPro:boolean){
  const m=await admin('daniel','POST','members',{username,name:`${username} member`,orgName:'SMK',grants:[]});
  const a=await ops.handle({method:'POST',path:'/ops/v1/member/activate',body:{code:m.data.inviteCode,password:'a long member password'},ip:'4.4.4.4',headers:{'x-aiot-member':'1'}});
  if(withPro){const cur=ops.store.get<any>('members',m.data.member.id)!;ops.store.put('members',{...cur,grants:['pro']});}
  return{cookie:/aiot_member=([^;]*)/.exec([a!.setCookie??[]].flat().join('\n'))?.[1]??'',id:m.data.member.id as string};
 }
 const call=async(method:string,path:string,body?:unknown,who:{member?:string;staff?:string;csrf?:boolean;/** In-process api path on the desktop local host (sets trustedLocal). */local?:boolean}={}):Promise<R>=>{
  const cookie=[who.member?`aiot_member=${who.member}`:'',who.staff?`aiot_admin=${who.staff}`:''].filter(Boolean).join('; ')||undefined;
  const csrf=who.csrf!==false;
  return (await pro.handle({method,path:'/ops/v1/member/pro/'+path,body,ip:'5.5.5.5',...(who.local?{trustedLocal:true}:{}),headers:{cookie,'x-aiot-member':who.member&&csrf?'1':'','x-aiot-staff':who.staff&&csrf?'1':''}}))as R;
 };
 return{ops,pro,clock,admin,staff,member,call};
}

/** Waits for a turn to finish by polling the JSON event route; returns every event. */
export async function runTurn(h:Pick<ReturnType<typeof harness>,'call'>,pid:string,who:{member?:string;staff?:string;local?:boolean},message='design a farm',extra:Record<string,unknown>={}){
 const start=await h.call('POST',`projects/${pid}/turns`,{message,...extra},who);
 if(start.status!==202)return{start,events:[] as AgentEvent[],turnId:''};
 const turnId=start.data.turnId as string;const events:AgentEvent[]=[];let after=-1;
 for(let i=0;i<400;i++){
  const r=await h.call('GET',`projects/${pid}/turns/${turnId}/poll/${after}`,undefined,who);
  for(const e of r.data.events as AgentEvent[]){events.push(e);after=e.seq;}
  if(r.data.done&&!r.data.events.length)break;
 }
 return{start,events,turnId};
}

/** A model that answers each call from a script of steps. A step is a function producing stream events, or a plain array. */
export function scriptedLlm(steps:(StreamEvent[]|((req:ProLlmRequest,signal:AbortSignal)=>AsyncIterable<StreamEvent>))[],log:ProLlmRequest[]=[]):ProLlm{
 let n=0;
 return{available:()=>true,stream(req,signal){
  log.push(structuredClone(req));
  const step=steps[Math.min(n++,steps.length-1)]!;
  if(typeof step==='function')return step(req,signal);
  return(async function*(){for(const e of step)yield e;})();
 }};
}
export const usageEv=(i=100):StreamEvent=>({type:'message_start',message:{usage:{input_tokens:i,output_tokens:1,cache_read_input_tokens:0,cache_creation_input_tokens:0}}});
export const textMsg=(text:string,inTok=100,outTok=50):StreamEvent[]=>[usageEv(inTok),{type:'content_block_start',index:0,content_block:{type:'text',text:''}},{type:'content_block_delta',index:0,delta:{type:'text_delta',text}},{type:'content_block_stop',index:0},{type:'message_delta',delta:{stop_reason:'end_turn'},usage:{output_tokens:outTok}},{type:'message_stop'}];
export const toolMsg=(calls:{id:string;name:string;input:unknown}[],inTok=100,outTok=50):StreamEvent[]=>[usageEv(inTok),
 ...calls.flatMap((c,i)=>[{type:'content_block_start',index:i,content_block:{type:'tool_use',id:c.id,name:c.name,input:{}}},{type:'content_block_delta',index:i,delta:{type:'input_json_delta',partial_json:JSON.stringify(c.input)}},{type:'content_block_stop',index:i}]),
 {type:'message_delta',delta:{stop_reason:'tool_use'},usage:{output_tokens:outTok}},{type:'message_stop'}];
