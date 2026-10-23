import {useEffect,useMemo,useState} from 'react';
import type {ChecklistItem} from '../../../../../packages/pro-contract/system-spec';
import {useProSpec,useSelection} from '../api/spec-store';
import {PHASES,PHASE_LABEL,PHASE_SHORT,codes,groups,isDone,isEvidence,nextOpen,pct,rollup,unverifiedReason,type Count,type Filter,type Progress,type Tick} from './model';
import {useTicks,type SaveState} from './ticks';
import './checklist.css';

const SAVE_TEXT:Record<SaveState,string>={loading:'loading ticks',saved:'saved · synced',saving:'saving…',local:'saved on this device only',offline:'offline · ticking is off',error:'not saved'};
const time=(at?:string)=>{if(!at)return '';const d=new Date(at);return Number.isNaN(+d)?'':d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});};

function Bar({c,tall}:{c:Count;tall?:boolean}){return <span className={`ck-bar${tall?' ck-bar-tall':''}`} aria-hidden="true"><i className={c.total&&c.done===c.total?'is-full':''} style={{width:`${pct(c)}%`}}/></span>;}
const frac=(c:Count)=>c.total?`${c.done}/${c.total}`:'n/a';

export function ChecklistPanel(){
 const {spec,projectId,refs}=useProSpec();
 const {selection,select}=useSelection();
 const {ticks,save,error,set,online}=useTicks(projectId);
 const [scope,setScope]=useState('all');
 const [filter,setFilter]=useState<Filter>('all');
 const [phase,setPhase]=useState<string|null>(null);
 useEffect(()=>{if(selection?.kind==='node')setScope(selection.id);},[selection]); // eslint-disable-line react-hooks/set-state-in-effect -- follows the workspace selection
 const items=useMemo(()=>spec?.checklist??[],[spec]);
 const roll=useMemo(()=>rollup(items,ticks),[items,ticks]);
 const code=useMemo(()=>codes(items),[items]);
 const grp=useMemo(()=>groups(items,ticks,scope,filter).filter(g=>!phase||g.phase===phase),[items,ticks,scope,filter,phase]);
 if(!spec)return <div className="ck ck-empty">No design loaded.</div>;
 if(!items.length)return <div className="ck ck-empty">No checklist yet. It is generated when a revision is saved.</div>;

 const nodes=spec.nodes.filter(n=>roll.byNode[n.id]);
 const nodeRef=(id:string)=>refs?.nodes[id]??id;
 const fieldName=(id?:string)=>spec.fields.find(f=>f.id===id)?.name;
 const pick=(s:string)=>{setScope(s);if(s!=='all'&&s!=='site')select({kind:'node',id:s});};
 const next=nextOpen(items,ticks,scope);
 const canTick=online&&!!projectId;
 const scopeLabel=scope==='all'?'All tasks':scope==='site'?'Site':`${nodeRef(scope)} ${scope}`;
 const scopeProg=scope==='all'?roll.overall:scope==='site'?roll.site:roll.byNode[scope]??roll.overall;
 const o=roll.overall.all;

 const Row=({it}:{it:ChecklistItem})=>{
  const t:Tick|undefined=ticks[it.id],done=isDone(t),auto=isEvidence(t),why=unverifiedReason(spec,it);
  return <li className={`ck-item${done?' is-done':''}${next?.id===it.id?' is-next':''}`} data-ck={it.id}>
   <button type="button" role="checkbox" aria-checked={done} className="ck-box" disabled={!canTick} onClick={()=>set(it.id,!done)}
    aria-label={`${done?(auto?'Untick (auto ticked from evidence)':'Untick'):'Tick'} ${code[it.id]} ${it.title.en}`}>{done&&<svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 8.5l3.2 3L13 4.8" fill="none" stroke="currentColor" strokeWidth="2"/></svg>}</button>
   <span className="ck-code">{code[it.id]}</span>
   <div className="ck-main">
    <span className="ck-title">{it.title.en}</span>
    <span className="ck-sub">
     {it.detail&&<span>{it.detail.en}</span>}
     {scope==='all'&&it.nodeId&&<span className="ck-node">{nodeRef(it.nodeId)}</span>}
     {why&&<span className="ck-tag ck-tag-warn">{why}</span>}
    </span>
   </div>
   <span className="ck-side">{auto?<span className="ck-tag ck-tag-auto" title={t?.evidenceRef}>auto · evidence</span>:done?<span className="ck-time">{time(t?.at)}</span>:null}</span>
  </li>;
 };

 return <section className="ck" aria-label="Checklist">
  <header className="ck-head">
   <div className="ck-big"><strong>{o.done} of {o.total}</strong><span className="ck-muted">tasks done · {pct(o)}%</span></div>
   <div className="ck-bigbar"><Bar c={o} tall/><div className="ck-seg" aria-hidden="true">{PHASES.map(p=><span key={p}><Bar c={roll.overall.phase[p]}/><em>{PHASE_SHORT[p]}</em></span>)}</div></div>
   <span className={`ck-save ck-save-${save}`} role="status" title={error}>{SAVE_TEXT[save]}{error&&save==='error'?` · ${error}`:''}</span>
   <div className="ck-seg-ctl" role="group" aria-label="Show">{(['all','open','done'] as Filter[]).map(f=><button key={f} type="button" className={filter===f?'is-active':''} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f[0]!.toUpperCase()+f.slice(1)}</button>)}</div>
  </header>

  <div className="ck-phases" role="group" aria-label="Phases">{PHASES.map((p,i)=>{const c=roll.overall.phase[p];return <button key={p} type="button" disabled={!c.total} aria-pressed={phase===p} className={`ck-phase${phase===p?' is-active':''}`} onClick={()=>setPhase(phase===p?null:p)}>
   <span className="ck-phase-t">{i+1} · {PHASE_LABEL[p]}</span><Bar c={c}/><span className="ck-phase-n">{frac(c)}</span></button>;})}</div>

  <nav className="ck-chips" aria-label="Scope">
   <button type="button" className={scope==='all'?'is-active':''} onClick={()=>pick('all')}>All <span>{frac(roll.overall.all)}</span></button>
   {nodes.map(n=><button key={n.id} type="button" className={scope===n.id?'is-active':''} onClick={()=>pick(n.id)}>{nodeRef(n.id)} <span>{frac(roll.byNode[n.id]!.all)}</span></button>)}
   {roll.site.all.total>0&&<button type="button" className={scope==='site'?'is-active':''} onClick={()=>pick('site')}>Site <span>{frac(roll.site.all)}</span></button>}
  </nav>

  <div className="ck-body">
   <div className="ck-table" role="table" aria-label="Progress by field and node">
    <p className="ck-eyebrow">Progress by field and node</p>
    <div className="ck-tr ck-th" role="row"><span role="columnheader">Field · node</span>{PHASES.map(p=><span key={p} role="columnheader">{PHASE_SHORT[p]}</span>)}</div>
    {spec.fields.map(f=>{const fp=roll.byField[f.id];const own=nodes.filter(n=>n.fieldId===f.id);if(!fp)return null;
     return <div key={f.id} className="ck-fgroup">
      {own.length!==1&&<Line label={`${refs?.fields[f.id]??''} · ${f.name}`} p={fp} strong/>}
      {own.map(n=><Line key={n.id} label={own.length===1?`${f.name} · ${nodeRef(n.id)}`:`${nodeRef(n.id)} · ${n.id}`} p={roll.byNode[n.id]!} active={scope===n.id} onPick={()=>pick(n.id)}/>)}
     </div>;})}
    {nodes.filter(n=>!n.fieldId).map(n=><Line key={n.id} label={`${nodeRef(n.id)} · ${n.id}`} p={roll.byNode[n.id]!} active={scope===n.id} onPick={()=>pick(n.id)}/>)}
    {roll.site.all.total>0&&<Line label="Site" p={roll.site} active={scope==='site'} onPick={()=>pick('site')}/>}
   </div>

   <div className="ck-tasks">
    <div className="ck-tasks-head"><span className="ck-eyebrow">{scopeLabel}{scope!=='all'&&scope!=='site'&&fieldName(spec.nodes.find(n=>n.id===scope)?.fieldId)?` · ${fieldName(spec.nodes.find(n=>n.id===scope)?.fieldId)}`:''}</span><span className="ck-eyebrow">{scopeProg.all.total-scopeProg.all.done} open / {scopeProg.all.total}</span></div>
    {grp.length===0?<p className="ck-none">{filter==='open'?'Nothing open here.':filter==='done'?'Nothing ticked yet.':'No tasks in this scope.'}</p>:
     grp.map(g=><div key={g.phase} className="ck-group"><h3><span>{PHASE_LABEL[g.phase]}</span><em>{g.done} / {g.total}</em></h3><ul>{g.items.map(it=><Row key={it.id} it={it}/>)}</ul></div>)}
   </div>
  </div>

  <footer className="ck-next">
   <div><span className="ck-eyebrow">Next</span><strong>{next?`${code[next.id]} · ${next.title.en}`:'All tasks done'}</strong></div>
   <button type="button" className="ck-tick" disabled={!next||!canTick} onClick={()=>next&&set(next.id,true)}>Tick</button>
  </footer>
 </section>;
}

function Line({label,p,strong,active,onPick}:{label:string;p:Progress;strong?:boolean;active?:boolean;onPick?:()=>void}){
 const body=<><span className="ck-name">{label}</span>{PHASES.map(ph=><span key={ph} className="ck-cell"><span className="ck-cell-n">{frac(p.phase[ph])}</span><Bar c={p.phase[ph]}/></span>)}</>;
 return onPick?<button type="button" role="row" className={`ck-tr ck-line${active?' is-active':''}`} onClick={onPick}>{body}</button>:<div role="row" className={`ck-tr ck-line${strong?' ck-strong':''}`}>{body}</div>;
}
