import {useState} from 'react';
import {useDockTabs} from '../api/spec-store';

/** Bottom dock: tabs come from registerDockTab (M6 panels). */
export function Dock(){
 const tabs=useDockTabs();
 const [pick,setPick]=useState<string|null>(null);
 if(!tabs.length)return <div className="pro-dock pro-dock-empty"><span className="pro-eyebrow">Wiring · Code · Checklist · BOM · Power · Checks</span><span className="pro-muted">Panels appear here when they are registered.</span></div>;
 const active=tabs.find(t=>t.id===pick)??tabs[0];
 return <div className="pro-dock">
  <div className="pro-dock-tabs" role="tablist">{tabs.map(t=>{const b=t.badge?.();return <button key={t.id} type="button" role="tab" aria-selected={t.id===active.id} className={t.id===active.id?'is-active':''} onClick={()=>setPick(t.id)}>{t.label}{b&&<span className="pro-mono pro-muted">{b}</span>}</button>;})}</div>
  <div className="pro-dock-body" role="tabpanel">{active.render()}</div>
 </div>;
}
