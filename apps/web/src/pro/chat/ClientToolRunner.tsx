import {useEffect,useRef} from 'react';
import {hw,isLocalHost} from '../../lab/hw/client';
import type {TimelineItem} from './events';

type ToolItem=Extract<TimelineItem,{kind:'tool'}>;
export const CLIENT_TOOLS=['device_detect','serial_read'] as const;
/** Client tools exist only on the local host (desktop app or local dev); the public site never advertises them. */
export const localClientTools=():string[]=>isLocalHost()?[...CLIENT_TOOLS]:[];

async function execute(name:string,input:unknown):Promise<{ok:boolean;output:unknown}>{
 try{
  if(name==='device_detect')return{ok:true,output:await hw.detect()};
  if(name==='serial_read'){
   const port=String((input as {port?:string})?.port??'');
   if(!port)return{ok:false,output:{error:'port required'}};
   await hw.serialStart(port);
   await new Promise(r=>setTimeout(r,1500));
   const s=await hw.serial(0);await hw.serialStop().catch(()=>undefined);
   return{ok:true,output:{lines:s.lines.slice(-50)}};
  }
  return{ok:false,output:{error:`${name} is not available in this build`}};
 }catch(e){return{ok:false,output:{error:e instanceof Error?e.message:'failed'}};}
}

/** Renders nothing. Runs pending client_tool_request items once each and posts the result. Mounted only when isLocalHost(). */
export function ClientToolRunner({items,turnId,post}:{items:TimelineItem[];turnId:string|null;post:(turnId:string,r:{callId:string;ok:boolean;output:unknown})=>Promise<void>}){
 const seen=useRef(new Set<string>());
 useEffect(()=>{
  if(!isLocalHost()||!turnId)return;
  for(const it of items){
   if(it.kind!=='tool'||!it.client||it.status!=='running'||seen.current.has(it.callId))continue;
   seen.current.add(it.callId);
   const t:ToolItem=it;
   void execute(t.name,t.input).then(r=>post(turnId,{callId:t.callId,...r})).catch(()=>undefined);
  }
 },[items,turnId,post]);
 return null;
}
