import {useState} from 'react';
/** Thinking is collapsed by default. Model text renders as React text only. */
export function ThinkingToggle({text,live}:{text:string;live:boolean}){
 const [open,setOpen]=useState(false);
 return <div className="pchat-think">
  <button type="button" className="pchat-think-btn" aria-expanded={open} onClick={()=>setOpen(!open)}>
   <span className="pchat-caret" aria-hidden="true">{open?'▾':'▸'}</span>{live?'Thinking…':'Thought'}
  </button>
  {open&&<p className="pchat-think-body">{text}</p>}
 </div>;
}
