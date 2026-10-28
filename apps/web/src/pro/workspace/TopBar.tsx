import {useEffect,useRef,useState} from 'react';
import {useProSpec} from '../api/spec-store';
import {estimateTurnCost} from './cost-estimate';
import type {ProProject,RevisionMeta} from '../api/pro-api';

export interface TopBarProps{
 projects:ProProject[];revisions:RevisionMeta[];onPickProject?:(id:string)=>void;onPickRevision?:(n:number)=>void;
 onPrompt?:(text:string)=>void;promptBusy?:boolean;onBuildSheet?:()=>void;
 /** Per-turn USD cap and recent per-turn USD (null when unknown); Workspace may pass them, defaults apply otherwise. */
 turnCapUsd?:number;recentTurnUsd?:(number|null)[];
}
export function TopBar(p:TopBarProps){
 const {spec,revision,projectId}=useProSpec();
 const [menu,setMenu]=useState(false),[text,setText]=useState('');
 const box=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!menu)return;const off=(e:MouseEvent)=>{if(!box.current?.contains(e.target as Node))setMenu(false);};document.addEventListener('mousedown',off);return()=>document.removeEventListener('mousedown',off);},[menu]);
 const errors=spec?.checks.filter(c=>c.severity==='error').length??0,warns=spec?.checks.filter(c=>c.severity==='warning').length??0;
 const name=p.projects.find(x=>x.id===projectId)?.name??spec?.site.name??'No project';
 const isDraft=!!p.revisions.find(r=>r.revision===revision)?.draft;
 const est=estimateTurnCost(p.turnCapUsd,p.recentTurnUsd);
 const submit=()=>{const t=text.trim();if(!t||!p.onPrompt)return;p.onPrompt(t);setText('');};
 return <header className="pro-top">
  <a className="pro-brand" href="/"><span>iot.ai.id</span><b>PRO</b></a>
  <div className="pro-switch" ref={box}>
   <button type="button" className="pro-switch-btn" aria-haspopup="listbox" aria-expanded={menu} onClick={()=>setMenu(m=>!m)} data-testid="pro-project-switch"><span className="pro-switch-name">{name}</span>{revision!==null&&<span className="pro-mono pro-muted">r{revision}</span>}{isDraft&&<span className="pro-draft" data-testid="pro-draft">DRAFT</span>}<span aria-hidden="true">▾</span></button>
   {menu&&<div className="pro-menu" role="listbox">
    <div className="pro-menu-label">Projects</div>
    {p.projects.length===0&&<div className="pro-menu-empty">{spec?spec.site.name:'No projects yet'}</div>}
    {p.projects.map(x=><button key={x.id} type="button" role="option" aria-selected={x.id===projectId} className="pro-menu-item" onClick={()=>{setMenu(false);p.onPickProject?.(x.id);}}><span>{x.name}</span><span className="pro-mono pro-muted">r{x.headRevision}</span></button>)}
    {p.revisions.length>0&&<><div className="pro-menu-label">Revisions</div>{p.revisions.map(r=><button key={r.revision} type="button" role="option" aria-selected={r.revision===revision} className="pro-menu-item" onClick={()=>{setMenu(false);p.onPickRevision?.(r.revision);}}><span>r{r.revision} · {r.reason}{r.draft&&<span className="pro-draft">DRAFT</span>}</span></button>)}</>}
   </div>}
  </div>
  <form className="pro-prompt" onSubmit={e=>{e.preventDefault();submit();}}>
   <span className="pro-dot" aria-hidden="true"/>
   <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();submit();}}} placeholder={spec?'Ask for a change…':'Describe your farm or site…'} aria-label="Prompt" maxLength={2000} disabled={p.promptBusy}/>
   {spec&&<span className="pro-model" title="Model that saved this revision">{spec.meta.model}</span>}
   <span className="pro-muted" data-testid="pro-cost-estimate" title={est.free.en+' / '+est.free.id}>{est.label.en} · {est.free.en}</span>
   <button type="submit" className="pro-prompt-go" disabled={!p.onPrompt||p.promptBusy||!text.trim()}>{p.promptBusy?'Generating…':spec?<>Regenerate <kbd>⌘↵</kbd></>:'Generate'}</button>
  </form>
  <span className={'pro-pill '+(!spec?'':errors?'is-error':'is-ok')} data-testid="pro-valid-pill"><i/>{!spec?'No design':errors?`${errors} error${errors>1?'s':''}`:'Valid'}{spec&&warns>0&&<span className="pro-pill-warn">· {warns} ⚠</span>}</span>
  <button type="button" className="pro-build" disabled={!p.onBuildSheet||!spec||isDraft} onClick={p.onBuildSheet} data-testid="pro-build-sheet" title={isDraft?'A draft is not printed: the Build Sheet uses saved, verified revisions only':'Open the printable Build Sheet'}>Build Sheet</button>
 </header>;
}
