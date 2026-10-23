import {useEffect,useState} from 'react';
import {useDockTabs,useProSpec} from '../api/spec-store';
import {registerProTabs} from './tabs';

registerProTabs();
/** Bottom dock: tabs come from registerDockTab (M6 panels). Counts are read from the stored spec. */
export function Dock(){
 const tabs=useDockTabs();
 useProSpec(); // re-render badges when the spec changes
 const [pick,setPick]=useState<string|null>(null),[max,setMax]=useState(false);
 useEffect(()=>{
  const on=(e:Event)=>{const d=(e as CustomEvent<{view?:string}>).detail;if(d?.view==='wiring')setPick('wiring');};
  window.addEventListener('pro:show',on);return()=>window.removeEventListener('pro:show',on);
 },[]);
 if(!tabs.length)return <div className="pro-dock pro-dock-empty"><span className="pro-eyebrow">Wiring · Code · Checklist · BOM · Power · Checks</span><span className="pro-muted">Panels appear here when they are registered.</span></div>;
 const active=tabs.find(t=>t.id===pick)??tabs[0];
 return <div className={'pro-dock'+(max?' is-max':'')} data-testid="pro-dock">
  <div className="pro-dock-tabs" role="tablist">{tabs.map(t=>{const b=t.badge?.();return <button key={t.id} type="button" role="tab" aria-selected={t.id===active.id} data-testid={'pro-dock-'+t.id} className={t.id===active.id?'is-active':''} onClick={()=>setPick(t.id)}>{t.label}{b&&<span className="pro-dock-count">{b}</span>}</button>;})}
   <button type="button" className="pro-dock-max" aria-pressed={max} aria-label={max?'Restore panel size':'Maximise panel'} title={max?'Restore':'Maximise'} data-testid="pro-dock-max" onClick={()=>setMax(m=>!m)}>{max?'\u2193':'\u2922'}</button>
  </div>
  <div className="pro-dock-body" role="tabpanel">{active.render()}</div>
 </div>;
}
