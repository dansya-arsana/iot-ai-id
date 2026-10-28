/** Board dock panel: top-view preview of the selected node's carrier board (client-side layout) and the free KiCad .zip download. */
import {useMemo,useState} from 'react';
import {useProSpec,useSelection} from '../api/spec-store';
import {useLang} from '../../i18n';
import {layoutBoard,zipBlobParts} from './board-view';
import './board.css';

export function BoardPanel(){
 const {spec,projectId,revision}=useProSpec();
 const {selection}=useSelection();
 const {tr}=useLang();
 const [busy,setBusy]=useState(false),[err,setErr]=useState('');
 const node=useMemo(()=>spec?(spec.nodes.find(n=>n.id===(selection?.nodeId??selection?.id))??spec.nodes[0]):null,[spec,selection]);
 const view=useMemo(()=>node?layoutBoard(node):null,[node]);
 if(!spec||!node||!view)return <div className="pro-board">{tr('No design loaded.','Belum ada desain.')}</div>;
 const download=async()=>{
  setBusy(true);setErr('');
  try{
   // Needs the export endpoint (see handoff): POST .../projects/:id/export-kicad {nodeId,revision?} -> export_kicad output.
   const r=await fetch(`/ops/v1/member/pro/projects/${encodeURIComponent(projectId??'')}/export-kicad`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-AIoT-Member':'1'},body:JSON.stringify({nodeId:node.id,revision:revision??undefined})});
   const d=await r.json().catch(()=>({}));
   if(!r.ok||!d.zipBase64)throw new Error(d.error??'export failed');
   const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([zipBlobParts(d.zipBase64) as BlobPart],{type:'application/zip'}));a.download=`${node.id}-kicad.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }catch(e){setErr(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 };
 const issues=[...view.issues.map(i=>tr(i.en,i.id)),...(err?[err]:[])];
 return <div className="pro-board" data-testid="board-panel">
  <div className="pro-board-bar"><strong>{node.id}</strong><span className="pro-muted">{tr('Preview layout, not final PCB','Pratinjau tata letak, bukan PCB final')}</span><span className="grow"/>
   <button type="button" className="pro-btn" disabled={busy||!projectId} onClick={download}>{tr('Download KiCad (.zip)','Unduh KiCad (.zip)')}</button></div>
  <div className="pro-board-body">
   <svg viewBox={`0 0 ${view.w} ${view.h}`} role="img" aria-label={tr('Carrier board top view','Tampak atas papan pembawa')}>
    <rect className="b-out" x={0} y={0} width={view.w} height={view.h}/>
    {view.nets.map(n=><line key={n.id} className="b-net" x1={n.a.x} y1={n.a.y} x2={n.b.x} y2={n.b.y}/>)}
    {view.modules.map(m=><g key={m.ref}><rect className="b-mod" x={m.x} y={m.y} width={m.w} height={m.h}/><text x={m.x+1} y={m.y+3}>{m.ref}</text></g>)}
    {view.pads.map(p=><g key={p.id}><circle className="b-pad" cx={p.x} cy={p.y} r={.8}/><text x={p.x-2} y={p.y-1.2}>{p.id}</text></g>)}
   </svg>
   {issues.length>0&&<ul>{issues.map((t,i)=><li key={i}>{t}</li>)}</ul>}
  </div>
 </div>;
};
