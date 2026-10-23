import {Fragment,useMemo,useState} from 'react';
import {useProSpec} from '../api/spec-store';
import {bomCsv,idrRange,inChecklist,loadQueue,nodeLines,priceDates,procureId,PROCURE_EVENT,qtyText,saveQueue,sumRange} from './bom-model';
import './bom.css';

function download(name:string,text:string){
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));a.download=name;a.click();
 setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
export function BomTab(){
 const {spec,refs,projectId}=useProSpec();
 const [view,setView]=useState<'farm'|'node'>('farm');
 const [queue,setQueue]=useState<string[]>(()=>loadQueue(projectId));
 const dates=useMemo(()=>spec&&priceDates(spec),[spec]);
 if(!spec||!refs)return <div className="m6-empty">No design loaded.</div>;
 const add=(id:string)=>{const q=[...new Set([...queue,id])];setQueue(q);saveQueue(projectId,q);window.dispatchEvent(new CustomEvent(PROCURE_EVENT,{detail:{ckId:id,projectId}}));};
 const Add=({kind}:{kind:string})=>{
  const id=procureId({kind});const done=inChecklist(spec,{kind})||queue.includes(id);
  return <button type="button" className="pro-btn m6-add" disabled={done} onClick={()=>add(id)} title={id}>{done?'In checklist':'Add to checklist'}</button>;
 };
 return <div className="m6" data-testid="bom-tab">
  <div className="m6-bar">
   <div className="m6-seg" role="group" aria-label="BOM view"><button type="button" aria-pressed={view==='farm'} onClick={()=>setView('farm')}>Farm</button><button type="button" aria-pressed={view==='node'} onClick={()=>setView('node')}>Per node</button></div>
   <span className="pro-mono pro-muted">{spec.bom.lines.length} lines</span>
   <span className="grow"/>
   <button type="button" className="pro-btn" onClick={()=>download(`bom-${(projectId??'design')}.csv`,bomCsv(spec))}>Export CSV</button>
  </div>
  <div className="m6-scroll">
  <table className="m6-table">
   <thead><tr><th>Part</th><th className="num">Qty</th><th className="num">Unit (IDR)</th><th className="num">Total (IDR)</th><th>Price source</th><th/></tr></thead>
   {view==='farm'?<>
    <tbody>{spec.bom.lines.map(l=><tr key={l.key}>
     <td>{l.name.en}{l.optional&&<span className="m6-est">optional</span>}<span className="m6-sub">{l.perNode.map(p=>`${refs.nodes[p.nodeId]??p.nodeId}×${p.qty}`).join(' ')}</span></td>
     <td className="num">{qtyText(l)}</td><td className="num">{idrRange(l.priceIdr.unit)}</td><td className="num">{idrRange(l.priceIdr.total)}</td>
     <td><span className="pro-mono">{l.priceSource.table}</span><span className="m6-sub">checked {l.priceSource.checkedAt}</span></td>
     <td><Add kind={l.kind}/></td></tr>)}</tbody>
    <tfoot><tr><td colSpan={3}>Total<span className="m6-est">estimate</span></td><td className="num">{idrRange(spec.bom.totalIdr)}</td><td colSpan={2} className="pro-muted">Prices {dates?.oldest===dates?.newest?`checked ${dates?.oldest}`:`checked ${dates?.oldest} to ${dates?.newest}`}</td></tr></tfoot>
   </>:<>
    <tbody>{spec.nodes.map(n=>{
     const ls=nodeLines(spec,n.id);if(!ls.length)return null;
     return <Fragment key={n.id}><tr className="is-group"><td colSpan={6}>{refs.nodes[n.id]} · {n.id} · subtotal ≈ {idrRange(sumRange(ls.map(x=>x.subtotal)))}</td></tr>
      {ls.map(({line,qty,subtotal})=><tr key={n.id+line.key}><td>{line.name.en}</td><td className="num">{qty} {line.unit}</td><td className="num">{idrRange(line.priceIdr.unit)}</td><td className="num">≈ {idrRange(subtotal)}</td><td><span className="m6-sub">checked {line.priceSource.checkedAt}</span></td><td/></tr>)}
     </Fragment>;})}</tbody>
   </>}
  </table>
  </div>
  <div className="m6-note">IDR figures are estimates from a price table, not quotes. Check a shop before you buy.</div>
 </div>;
}
