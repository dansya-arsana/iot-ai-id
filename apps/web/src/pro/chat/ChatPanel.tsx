import {useCallback,useEffect,useReducer,useRef,useState} from 'react';
import './chat.css';
import {emptyTimeline,reduceEvent,startTurn,type AgentEv,type TimelineState} from './events';
import {Timeline} from './Timeline';
import {ClientToolRunner,localClientTools} from './ClientToolRunner';
import type {TurnTransport} from './transport';

type Act={t:'ev';e:AgentEv}|{t:'start';m:string}|{t:'fail';m:string};
function reducer(s:TimelineState,a:Act):TimelineState{
 if(a.t==='start')return startTurn(s,a.m);
 if(a.t==='fail')return{...reduceEvent({...s,lastSeq:-1},{seq:0,type:'error',code:'client',message:a.m}),running:false,lastSeq:s.lastSeq};
 return reduceEvent(s,a.e);
}

export interface ChatPanelProps{
 transport:TurnTransport;
 /** Called for every event so the workspace can react (e.g. reload the head revision on revision_saved). */
 onEvent?:(e:AgentEv)=>void;
 placeholder?:string;
 initialMessage?:string;
}

export function ChatPanel({transport,onEvent,placeholder='Describe what you want to build',initialMessage=''}:ChatPanelProps){
 const [state,dispatch]=useReducer(reducer,emptyTimeline);
 const [draft,setDraft]=useState(initialMessage);
 const [turnId,setTurnId]=useState<string|null>(null);
 const abort=useRef<AbortController|null>(null);
 useEffect(()=>()=>abort.current?.abort(),[]);

 const send=useCallback(async()=>{
  const m=draft.trim();if(!m||state.running)return;
  setDraft('');dispatch({t:'start',m});
  const ac=new AbortController();abort.current=ac;
  try{
   const r=await transport.run(m,e=>{dispatch({t:'ev',e});onEvent?.(e);},ac.signal,localClientTools(),setTurnId);
   setTurnId(r.turnId);
  }catch(e){dispatch({t:'fail',m:e instanceof Error?e.message:'Turn failed'});}
 },[draft,state.running,transport,onEvent]);

 const cancel=()=>{abort.current?.abort();if(turnId&&transport.cancel)void transport.cancel(turnId).catch(()=>undefined);};
 const post=useCallback(async(id:string,r:{callId:string;ok:boolean;output:unknown})=>{await transport.postToolResult?.(id,r);},[transport]);

 return <section className="pchat" aria-label="Agent chat">
  <Timeline items={state.items} running={state.running}/>
  {transport.postToolResult&&<ClientToolRunner items={state.items} turnId={turnId} post={post}/>}
  <form className="pchat-form" onSubmit={ev=>{ev.preventDefault();void send();}}>
   <textarea value={draft} maxLength={2000} rows={2} placeholder={placeholder} aria-label="Message"
    onChange={e=>setDraft(e.target.value)}
    onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}}/>
   {state.running
    ?<button type="button" className="pchat-btn" onClick={cancel}>Stop</button>
    :<button type="submit" className="pchat-btn is-primary" disabled={!draft.trim()}>Send</button>}
  </form>
 </section>;
}
