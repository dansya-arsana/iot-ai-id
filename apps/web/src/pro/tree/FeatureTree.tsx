/** Feature tree: Site → Fields → Nodes → Parts, plus Links. Filter, visibility, isolate. Reads the store only. */
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import type {SystemSpec} from '../../../../../packages/pro-contract/system-spec';
import {fieldKey,nodeKey,partKey,proActions,useProSpec,useSelection,useVisibility} from '../api/spec-store';

const Icon=({d}:{d:string})=><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d}/></svg>;
const ICON={site:'M2 7l6-5 6 5v7H2zM6 14V9h4v5',field:'M2 4h12v8H2zM2 8h12M6 4v8',node:'M3 5h10v7H3zM6 5V3h4v2',gw:'M8 13V8M4.5 5.5a5 5 0 017 0M2.5 3.5a8 8 0 0111 0',part:'M5 3h6v10H5zM3 6h2M3 10h2M11 6h2M11 10h2',link:'M6.5 9.5l3-3M5 8L3.5 9.5a2.1 2.1 0 003 3L8 11M11 8l1.5-1.5a2.1 2.1 0 00-3-3L8 5',eye:'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 6.2a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6z',eyeOff:'M2 2l12 12M6.4 4a6 6 0 011.6-.5c4 0 6.5 4.5 6.5 4.5a11 11 0 01-2 2.5M4 5.6A11 11 0 001.5 8S4 12.5 8 12.5a6 6 0 002-.4',iso:'M8 2v3M8 11v3M2 8h3M11 8h3M8 6.3a1.7 1.7 0 100 3.4 1.7 1.7 0 000-3.4z',chev:'M6 4l4 4-4 4'};

interface RowProps{depth:number;icon:keyof typeof ICON;label:string;sub?:string;meta?:string;selected?:boolean;dim?:boolean;open?:boolean;onToggleOpen?:()=>void;onSelect:()=>void;visKey?:string;isoKey?:string;note?:string;num?:number;badge?:string}
function Row(p:RowProps){
 const vis=useVisibility();
 const hidden=p.visKey?vis.isHidden(p.visKey):false;
 return <div className={'pro-tree-row'+(p.selected?' is-selected':'')+(p.dim||hidden?' is-dim':'')} style={{paddingLeft:8+p.depth*14}} role="treeitem" aria-selected={!!p.selected} aria-expanded={p.onToggleOpen?!!p.open:undefined} data-testid="pro-tree-row" data-key={p.visKey??p.label}>
  {p.onToggleOpen?<button type="button" className={'pro-tree-chev'+(p.open?' is-open':'')} onClick={p.onToggleOpen} aria-label={(p.open?'Collapse ':'Expand ')+p.label}><Icon d={ICON.chev}/></button>:<span className="pro-tree-chev-pad"/>}
  <button type="button" className="pro-tree-main" onClick={p.onSelect} onDoubleClick={()=>p.isoKey&&vis.isolate(vis.isolated===p.isoKey?null:p.isoKey)}>
   {p.num!==undefined&&<span className="pro-tree-num">{p.num}</span>}
   <Icon d={ICON[p.icon]}/>
   <span className="pro-tree-label">{p.label}</span>
   {p.sub&&<span className="pro-tree-sub">{p.sub}</span>}
   {p.badge&&<span className="pro-tree-badge">{p.badge}</span>}
   {p.meta&&<span className="pro-tree-meta">{p.meta}</span>}
  </button>
  {(p.visKey||p.isoKey)&&<span className="pro-tree-actions">
   {p.isoKey&&<button type="button" className="pro-tree-act" title="Isolate" aria-label={'Isolate '+p.label} aria-pressed={vis.isolated===p.isoKey} onClick={()=>vis.isolate(vis.isolated===p.isoKey?null:p.isoKey!)}><Icon d={ICON.iso}/></button>}
   {p.visKey&&<button type="button" className="pro-tree-act" title={hidden?'Show':'Hide'} aria-label={(hidden?'Show ':'Hide ')+p.label} aria-pressed={hidden} onClick={()=>vis.toggle(p.visKey!)}><Icon d={hidden?ICON.eyeOff:ICON.eye}/></button>}
  </span>}
 </div>;
}

const ha=(m2:number)=>`${(m2/10000).toFixed(m2>=100000?1:2)} ha`;
const mediumLabel=(l:SystemSpec['links'][number])=>l.params.medium==='lora'?'LoRa':l.params.medium==='wifi'?'Wi-Fi':l.params.medium==='rs485'?'RS-485':l.params.medium==='ethernet'?'Ethernet':'Cellular';

export function FeatureTree(){
 const {spec,refs}=useProSpec();
 const {selection,select}=useSelection();
 const vis=useVisibility();
 const [filter,setFilter]=useState('');
 const [closed,setClosed]=useState<Record<string,boolean>>({});
 const input=useRef<HTMLInputElement>(null);
 const q=filter.trim().toLowerCase();
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   const t=e.target as HTMLElement|null;const typing=!!t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable);
   if(e.key==='/'&&!typing){e.preventDefault();input.current?.focus();}
   if(e.key==='Escape'&&!typing&&vis.isolated)vis.isolate(null);
  };
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[vis.isolated]);// eslint-disable-line react-hooks/exhaustive-deps
 const open=(k:string)=>!closed[k];
 const toggle=(k:string)=>setClosed(c=>({...c,[k]:open(k)}));
 const rows=useMemo<ReactNode[]>(()=>{
  if(!spec||!refs)return [];
  const out:ReactNode[]=[];
  const match=(...s:(string|undefined)[])=>!q||s.some(x=>x?.toLowerCase().includes(q));
  const sel=(kind:string,id:string)=>selection?.kind===kind&&selection.id===id;
  out.push(<Row key="site" depth={0} icon="site" label={spec.site.name} meta={spec.site.kind==='device'?'device':`${(spec.fields.reduce((a,f)=>a+f.areaM2,0)/10000).toFixed(1)} ha`} selected={selection?.kind==='site'} open={open('site')} onToggleOpen={()=>toggle('site')} onSelect={()=>select({kind:'site',id:'site'})}/>);
  if(!open('site')&&!q)return out;
  const nodeRows=(nodeId:string,depth:number)=>{
   const node=spec.nodes.find(n=>n.id===nodeId);if(!node)return;
   const link=spec.links.find(l=>l.from===node.id||l.to===node.id);
   const partMatches=node.parts.filter(p=>match(p.kind,p.purpose.en,p.purpose.id,p.id));
   if(q&&!match(node.id,refs.nodes[node.id])&&!partMatches.length)return;
   const nk=`n:${node.id}`,pk=`p:${node.id}`;
   out.push(<Row key={nk} depth={depth} icon={node.role==='gateway'?'gw':'node'} label={node.id} sub={refs.nodes[node.id]} meta={link&&node.role!=='gateway'?`${mediumLabel(link)} ${link.distanceM} m`:node.role==='gateway'?node.board:undefined}
    selected={sel('node',node.id)} open={open(nk)||!!q} onToggleOpen={()=>toggle(nk)} onSelect={()=>select({kind:'node',id:node.id})} visKey={nodeKey(node.id)} isoKey={nodeKey(node.id)}/>);
   if(!open(nk)&&!q)return;
   out.push(<Row key={pk} depth={depth+1} icon="part" label="Parts" meta={String(node.parts.length)} open={open(pk)||!!q} onToggleOpen={()=>toggle(pk)} onSelect={()=>toggle(pk)} dim={false}/>);
   if(!open(pk)&&!q)return;
   const hiddenNode=vis.isHidden(nodeKey(node.id));
   node.parts.forEach((p,i)=>{
    if(q&&!partMatches.includes(p))return;
    out.push(<Row key={`${node.id}/${p.id}`} depth={depth+2} icon="part" num={i+1} label={p.purpose.en} sub={p.qty>1?`×${p.qty}`:undefined} selected={selection?.kind==='part'&&selection.id===p.id&&selection.nodeId===node.id} dim={hiddenNode}
     onSelect={()=>select({kind:'part',id:p.id,nodeId:node.id})} visKey={partKey(node.id,p.id)} isoKey={partKey(node.id,p.id)}/>);
   });
  };
  const gw=spec.nodes.find(n=>n.role==='gateway');
  if(gw)nodeRows(gw.id,1);
  spec.nodes.filter(n=>n.role==='device'||(!n.fieldId&&n.role==='repeater')).forEach(n=>nodeRows(n.id,1)); // single-device mode: the node sits under the root
  spec.fields.forEach(f=>{
   const nodes=spec.nodes.filter(n=>n.fieldId===f.id);
   if(q&&!match(f.name,f.crop,refs.fields[f.id])&&!nodes.some(n=>match(n.id)||n.parts.some(p=>match(p.kind,p.purpose.en,p.id))))return;
   const fk=`f:${f.id}`;
   out.push(<Row key={fk} depth={1} icon="field" label={f.name} sub={refs.fields[f.id]} meta={ha(f.areaM2)} selected={sel('field',f.id)} open={open(fk)||!!q} onToggleOpen={()=>toggle(fk)} onSelect={()=>select({kind:'field',id:f.id})} visKey={fieldKey(f.id)}/>);
   if(!open(fk)&&!q)return;
   nodes.forEach(n=>nodeRows(n.id,2));
  });
  if(spec.links.length&&(!q||match('links','link'))){
   out.push(<Row key="links" depth={1} icon="link" label="Links" meta={String(spec.links.length)} open={open('links')} onToggleOpen={()=>toggle('links')} onSelect={()=>toggle('links')} visKey="links"/>);
   if(open('links'))spec.links.forEach(l=>out.push(<Row key={l.id} depth={2} icon="link" label={`${refs.nodes[l.from]} ↔ ${refs.nodes[l.to]}`} sub={refs.links[l.id]} meta={`${mediumLabel(l)} ${l.distanceM} m`} selected={sel('link',l.id)} onSelect={()=>select({kind:'link',id:l.id})}/>));
  }
  return out;
 },[spec,refs,q,selection,closed,vis.hidden,vis.isolated]);// eslint-disable-line react-hooks/exhaustive-deps
 const isoLabel=useMemo(()=>{
  if(!spec||!vis.isolated)return null;
  const [k,rest='']=vis.isolated.split(':');
  if(k==='node')return `${refs?.nodes[rest]??''} ${rest}`.trim();
  const [n,p]=rest.split('/');const part=spec.nodes.find(x=>x.id===n)?.parts.find(x=>x.id===p);
  return part?.purpose.en??rest;
 },[spec,refs,vis.isolated]);
 return <aside className="pro-tree" aria-label="Feature tree">
  <div className="pro-panel-head"><span className="pro-eyebrow">Feature tree</span></div>
  <div className="pro-tree-filter"><input ref={input} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter parts, wires, pins" aria-label="Filter feature tree" onKeyDown={e=>{if(e.key==='Escape'){setFilter('');e.currentTarget.blur();}}}/><kbd>/</kbd></div>
  <div className="pro-tree-scroll" role="tree">{spec?rows:<div className="pro-empty">No design yet. Describe your farm in the prompt bar.</div>}{spec&&q&&rows.length<=1&&<div className="pro-empty">Nothing matches “{filter}”.</div>}</div>
  {(vis.isolated||vis.hidden.length>0)&&<div className="pro-tree-iso">
   {vis.isolated&&<div className="pro-tree-iso-row"><span>Isolated: <b>{isoLabel}</b></span><button type="button" className="pro-btn" onClick={()=>proActions.isolate(null)}>Exit <kbd>Esc</kbd></button></div>}
   <div className="pro-tree-iso-sub">{vis.hidden.length} hidden <button type="button" className="pro-link" onClick={proActions.showAll}>Show all</button></div>
  </div>}
 </aside>;
}
