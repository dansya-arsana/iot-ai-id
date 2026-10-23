/** Pure reducer: Pro agent SSE events (packages/pro-contract/agent.ts) to a render-ready timeline. No React, no I/O. */
export type AgentEv=
 |{seq:number;type:'text_delta'|'thinking_delta';text:string}
 |{seq:number;type:'tool_call';callId:string;name:string;input:unknown}
 |{seq:number;type:'tool_result';callId:string;name:string;ok:boolean;output:unknown;ms?:number}
 |{seq:number;type:'client_tool_request';callId:string;name:string;input:unknown;timeoutMs:number}
 |{seq:number;type:'revision_saved';revision:number;specSha:string;verified:number;unverified:number;failed:number}
 |{seq:number;type:'usage';model:string;inputTokens:number;outputTokens:number;cacheReadTokens:number;cacheWriteTokens:number;usdMicros:number|null}
 |{seq:number;type:'done';stopReason:string}
 |{seq:number;type:'error';code:string;message:string};

export type Verify={tone:'ok'|'warn'|'fail';label:string};
export type TimelineItem=
 |{kind:'user';id:string;text:string}
 |{kind:'text';id:string;text:string}
 |{kind:'thinking';id:string;text:string}
 |{kind:'tool';id:string;callId:string;name:string;input:unknown;status:'running'|'ok'|'failed';output?:unknown;ms?:number;client?:boolean;verify?:Verify}
 |{kind:'revision';id:string;revision:number;verified:number;unverified:number;failed:number}
 |{kind:'usage';id:string;model:string;inputTokens:number;outputTokens:number;cacheReadTokens:number;usdMicros:number|null}
 |{kind:'error';id:string;code:string;message:string};

export interface TimelineState{items:TimelineItem[];running:boolean;stopReason?:string;lastSeq:number}
export const emptyTimeline:TimelineState={items:[],running:false,lastSeq:-1};
export const startTurn=(s:TimelineState,message:string):TimelineState=>({items:[...s.items,{kind:'user',id:`u${s.items.length}`,text:message}],running:true,lastSeq:-1});

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const num=(v:unknown)=>typeof v==='number'?v:0;

/** One-line verification verdict from a tool result; undefined when the tool has none worth showing. */
export function verifyOf(name:string,ok:boolean,output:unknown):Verify|undefined{
 const o=obj(output);
 if(!ok)return{tone:'fail',label:'failed'};
 if(name==='compile_code'){
  const st=String(o.status??'');
  if(st==='compiled')return{tone:'ok',label:'compiled'};
  if(st==='pending')return{tone:'warn',label:'not compiled (unverified)'};
  return{tone:'fail',label:st||'compile error'};
 }
 if(name==='save_revision'){
  const v=obj(o.verification);const un=Array.isArray(v.unverified)?v.unverified.length:0;
  return{tone:un?'warn':'ok',label:`${num(v.verified)} verified · ${un} unverified`};
 }
 if(Array.isArray(o.checks)&&o.checks.length){
  const bad=o.checks.filter(c=>{const s=String(obj(c).severity??'');return s==='error'||s==='fail';}).length;
  return{tone:bad?'fail':'warn',label:`${o.checks.length} check${o.checks.length===1?'':'s'}${bad?` · ${bad} blocking`:''}`};
 }
 if(name==='check_compatibility'||name==='allocate_pins'||name==='solve_power')return{tone:'ok',label:'passed'};
 return undefined;
}

export function reduceEvent(s:TimelineState,e:AgentEv):TimelineState{
 if(e.seq<=s.lastSeq)return s; // replay after reconnect
 const items=s.items.slice(),last=items[items.length-1];
 const id=`e${e.seq}`;
 let running=s.running,stopReason=s.stopReason;
 switch(e.type){
  case'text_delta':
   if(last?.kind==='text')items[items.length-1]={...last,text:last.text+e.text};else items.push({kind:'text',id,text:e.text});break;
  case'thinking_delta':
   if(last?.kind==='thinking')items[items.length-1]={...last,text:last.text+e.text};else items.push({kind:'thinking',id,text:e.text});break;
  case'tool_call':items.push({kind:'tool',id,callId:e.callId,name:e.name,input:e.input,status:'running'});break;
  case'client_tool_request':items.push({kind:'tool',id,callId:e.callId,name:e.name,input:e.input,status:'running',client:true});break;
  case'tool_result':{
   const i=items.findIndex(x=>x.kind==='tool'&&x.callId===e.callId);
   const v=verifyOf(e.name,e.ok,e.output);
   if(i>=0){const t=items[i] as Extract<TimelineItem,{kind:'tool'}>;items[i]={...t,status:e.ok?'ok':'failed',output:e.output,...(e.ms!==undefined?{ms:e.ms}:{}),...(v?{verify:v}:{})};}
   else items.push({kind:'tool',id,callId:e.callId,name:e.name,input:undefined,status:e.ok?'ok':'failed',output:e.output,...(e.ms!==undefined?{ms:e.ms}:{}),...(v?{verify:v}:{})});
   break;}
  case'revision_saved':items.push({kind:'revision',id,revision:e.revision,verified:e.verified,unverified:e.unverified,failed:e.failed});break;
  case'usage':items.push({kind:'usage',id,model:e.model,inputTokens:e.inputTokens,outputTokens:e.outputTokens,cacheReadTokens:e.cacheReadTokens,usdMicros:e.usdMicros});break;
  case'error':items.push({kind:'error',id,code:e.code,message:e.message});break;
  case'done':running=false;stopReason=e.stopReason;break;
 }
 return{items,running,...(stopReason?{stopReason}:{}),lastSeq:e.seq};
}

/** Parse a transcript (one JSON event per line); bad lines are skipped. */
export function parseJsonl(text:string):AgentEv[]{
 const out:AgentEv[]=[];
 for(const l of text.split('\n')){const t=l.trim();if(!t)continue;try{const e=JSON.parse(t);if(e&&typeof e.type==='string'&&typeof e.seq==='number')out.push(e);}catch{/* skip */}}
 return out;
}
/** Parse one SSE buffer; returns events plus the unconsumed tail. */
export function parseSse(buf:string):{events:AgentEv[];rest:string}{
 const parts=buf.split('\n\n'),rest=parts.pop()??'',events:AgentEv[]=[];
 for(const p of parts){const d=p.split('\n').find(l=>l.startsWith('data:'));if(!d)continue;try{const e=JSON.parse(d.slice(5).trim());if(e&&typeof e.type==='string')events.push(e);}catch{/* skip */}}
 return{events,rest};
}
