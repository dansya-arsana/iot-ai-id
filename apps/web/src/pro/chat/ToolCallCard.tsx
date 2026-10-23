import {useState} from 'react';
import type {TimelineItem} from './events';

type ToolItem=Extract<TimelineItem,{kind:'tool'}>;
const short=(v:unknown,n=90)=>{let s:string;try{s=typeof v==='string'?v:JSON.stringify(v)??'';}catch{s='';}return s.length>n?s.slice(0,n-1)+'…':s;};
const pretty=(v:unknown)=>{try{return JSON.stringify(v,null,1)??'';}catch{return'';}};

export function ToolCallCard({item}:{item:ToolItem}){
 const [open,setOpen]=useState(false);
 return <div className={`pchat-tool is-${item.status}`} data-testid="pchat-tool">
  <button type="button" className="pchat-tool-head" aria-expanded={open} onClick={()=>setOpen(!open)}>
   <span className="pchat-dot" aria-hidden="true"/>
   <span className="pchat-tool-name">{item.name}</span>
   {item.client&&<span className="pchat-chip">device</span>}
   {item.verify&&<span className={`pchat-chip is-${item.verify.tone}`}>{item.verify.label}</span>}
   <span className="pchat-tool-ms">{item.status==='running'?'running…':item.ms!==undefined?`${item.ms} ms`:''}</span>
  </button>
  <div className="pchat-tool-sum">{short(item.input)}</div>
  {open&&<div className="pchat-tool-detail">
   <div className="pchat-label">Input</div><pre>{pretty(item.input)}</pre>
   {item.output!==undefined&&<><div className="pchat-label">Output</div><pre>{pretty(item.output)}</pre></>}
  </div>}
 </div>;
}
