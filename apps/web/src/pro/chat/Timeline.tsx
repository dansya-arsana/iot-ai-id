import {useEffect,useRef} from 'react';
import type {TimelineItem} from './events';
import {ThinkingToggle} from './ThinkingToggle';
import {ToolCallCard} from './ToolCallCard';

const k=(n:number)=>n>=1000?`${(n/1000).toFixed(1)}k`:String(n);

export function Timeline({items,running}:{items:TimelineItem[];running:boolean}){
 const end=useRef<HTMLDivElement>(null);
 useEffect(()=>{end.current?.scrollIntoView?.({block:'end'});},[items]);
 return <div className="pchat-timeline" role="log" aria-live="polite" aria-busy={running}>
  {items.map((it,i)=>{
   switch(it.kind){
    case'user':return <div key={it.id} className="pchat-user">{it.text}</div>;
    case'text':return <p key={it.id} className="pchat-text">{it.text}</p>;
    case'thinking':return <ThinkingToggle key={it.id} text={it.text} live={running&&i===items.length-1}/>;
    case'tool':return <ToolCallCard key={it.id} item={it}/>;
    case'revision':return <div key={it.id} className="pchat-rev" data-testid="pchat-revision">
      <span>Saved r{it.revision}</span>
      <span className="pchat-rev-n">{it.verified} verified · {it.unverified} unverified{it.failed?` · ${it.failed} failed`:''}</span>
     </div>;
    case'usage':return <div key={it.id} className="pchat-usage">{it.model} · {k(it.inputTokens)} in · {k(it.outputTokens)} out{it.cacheReadTokens?` · ${k(it.cacheReadTokens)} cached`:''}</div>;
    case'error':return <div key={it.id} className="pchat-error" role="alert">{it.message||it.code}</div>;
   }
  })}
  <div ref={end}/>
 </div>;
}
