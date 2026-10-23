import {parseJsonl,parseSse,type AgentEv} from './events';
import farmTurn from '../../../../../packages/pro-contract/fixtures/agent/farm-turn.jsonl?raw';

export interface TurnTransport{
 /** Starts a turn and streams events until done; resolves when the stream ends. */
 run(message:string,onEvent:(e:AgentEv)=>void,signal:AbortSignal,clientTools:string[],onTurn?:(turnId:string)=>void):Promise<{turnId:string}>;
 postToolResult?(turnId:string,r:{callId:string;ok:boolean;output:unknown}):Promise<void>;
 cancel?(turnId:string):Promise<void>;
}

const BASE='/ops/v1/member/pro';
const hdr=(post:boolean)=>({'Content-Type':'application/json',...(post?{'x-aiot-member':'1'}:{})});
async function post(path:string,body:unknown){
 const r=await fetch(BASE+path,{method:'POST',credentials:'same-origin',headers:hdr(true),body:JSON.stringify(body)});
 const j=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(String((j as {error?:string}).error??`Request failed (${r.status})`));
 return j as Record<string,unknown>;
}

/** Real transport: POST turns, then read the SSE stream with fetch (cookie auth, resumable by `events/:after`). */
export const opsTransport=(projectId:string,lang:'en'|'id'='en'):TurnTransport=>({
 async run(message,onEvent,signal,clientTools,onTurn){
  const {turnId}=await post(`/projects/${projectId}/turns`,{message,lang,clientTools}) as {turnId:string};
  onTurn?.(turnId);
  let after=-1;
  for(let attempt=0;attempt<4&&!signal.aborted;attempt++){
   try{
    const r=await fetch(`${BASE}/projects/${projectId}/turns/${turnId}/events${after>=0?'/'+after:''}`,{credentials:'same-origin',signal});
    if(!r.ok||!r.body)throw new Error(`Stream failed (${r.status})`);
    const rd=r.body.getReader(),dec=new TextDecoder();let buf='';
    for(;;){
     const {done,value}=await rd.read();if(done)break;
     buf+=dec.decode(value,{stream:true});
     const p=parseSse(buf);buf=p.rest;
     for(const e of p.events){after=Math.max(after,e.seq);onEvent(e);if(e.type==='done')return{turnId};}
    }
   }catch(e){if(signal.aborted)break;if(attempt===3)throw e;await new Promise(res=>setTimeout(res,500*(attempt+1)));}
  }
  return{turnId};
 },
 async postToolResult(turnId,r){await post(`/projects/${projectId}/turns/${turnId}/tool-results`,r);},
 async cancel(turnId){await post(`/projects/${projectId}/turns/${turnId}/cancel`,{});},
});

/** Fixture transport: replays packages/pro-contract/fixtures/agent/farm-turn.jsonl with a small delay. */
export const fixtureTransport=(delayMs=120):TurnTransport=>({
 async run(_m,onEvent,signal,_c,onTurn){
  onTurn?.('fixture');
  for(const e of parseJsonl(farmTurn)){
   if(signal.aborted)break;
   await new Promise(r=>setTimeout(r,delayMs));
   onEvent(e);
  }
  return{turnId:'fixture'};
 },
});
