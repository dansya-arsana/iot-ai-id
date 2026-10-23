import {useEffect,useMemo,useRef,useState} from 'react';
import type {SystemSpec} from '../../../../../packages/pro-contract/system-spec';
import {getProState,proActions,registerDockTab,useProSpec,useSelection} from '../api/spec-store';
import {layoutWiring,wiringTables,type Verif,type WireFilter,type WWire} from './layout';
import {downloadSvg} from './svg-export';
import './wiring.css';

export type WiringEvidence={flashed:number;total:number}|null;
export type WiringPanelProps={spec?:SystemSpec;revision?:number|null;nodeId?:string;onNodeChange?:(id:string)=>void;/** flash evidence when it exists; otherwise the title block says DESIGN · NOT BUILT */evidence?:WiringEvidence};
const FILTERS:{id:WireFilter;label:string}[]=[{id:'all',label:'All wires'},{id:'signal',label:'Signal'},{id:'power',label:'Power'}];
const stamp=(e:WiringEvidence|undefined)=>e?`FLASHED ${e.flashed}/${e.total}`:'DESIGN · NOT BUILT';
const act=(fn:()=>void)=>(e:React.KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn();}};
function VerifChip({v,reason}:{v:Verif;reason:string}){
 if(v==='verified')return <span className="wr-chip is-ok">✓ verified</span>;
 return <span className="wr-chip is-warn" title={reason}>{v==='failed'?'failed':'unverified'} · {reason}</span>;
}

export function WiringPanel(props:WiringPanelProps){
 const store=useProSpec(),{selection}=useSelection();
 const spec=props.spec??store.spec,revision=props.revision??store.revision;
 const [own,setOwn]=useState<string|null>(null);
 const [filter,setFilter]=useState<WireFilter>('all');
 const [hover,setHover]=useState<string|null>(null);
 const [sticky,setSticky]=useState<string|null>(null);
 const svgRef=useRef<SVGSVGElement>(null);
 const nodeId=props.nodeId??own??(selection?.nodeId&&spec?.nodes.some(n=>n.id===selection.nodeId)?selection.nodeId:selection?.kind==='node'&&spec?.nodes.some(n=>n.id===selection.id)?selection.id:undefined)??spec?.nodes.find(n=>n.role!=='gateway')?.id??spec?.nodes[0]?.id??'';
 const L=useMemo(()=>spec?layoutWiring(spec,nodeId,filter):null,[spec,nodeId,filter]);
 const T=useMemo(()=>spec?wiringTables(spec,nodeId):null,[spec,nodeId]);
 useEffect(()=>{setSticky(null);setHover(null);},[nodeId]); // eslint-disable-line react-hooks/set-state-in-effect -- clears the highlight when the node changes
 if(!spec||!L||!T)return <div className="wr-root"><div className="wr-empty">No revision loaded.</div></div>;
 const node=spec.nodes.find(n=>n.id===nodeId);
 if(!node)return <div className="wr-root"><div className="wr-empty">No node selected.</div></div>;
 const nodeTag=(n:SystemSpec['nodes'][number])=>n.role==='gateway'?'GW':`N${spec.nodes.filter(x=>x.role!=='gateway').indexOf(n)+1}`;
 const active=hover??sticky;
 const selPart=selection?.kind==='part'&&selection.nodeId===nodeId?selection.id:null;
 const hot=(w:{id:string;partIds:string[]})=>w.id===active||(!active&&selPart!==null&&w.partIds.includes(selPart));
 const pickNode=(id:string)=>{setOwn(id);props.onNodeChange?.(id);};
 const pickWire=(id:string)=>setSticky(s=>s===id?null:id);
 const doSvg=()=>{if(svgRef.current)downloadSvg(svgRef.current,`wiring-${nodeId}.svg`,`${node.id} wiring diagram`);};
 const doPrint=()=>{
  document.body.classList.add('wr-printing');
  const done=()=>{document.body.classList.remove('wr-printing');window.removeEventListener('afterprint',done);};
  window.addEventListener('afterprint',done);window.print();
 };
 const cls=(base:string,w:{id:string;partIds:string[]})=>`${base}${hot(w)?' is-hot':''}`;
 return <div className="wr-root" data-testid="wiring-panel">
  <header className="wr-bar">
   <div className="wr-nodes" role="tablist" aria-label="Node">
    {spec.nodes.map(n=><button key={n.id} type="button" role="tab" aria-selected={n.id===nodeId} className={n.id===nodeId?'is-active':''} onClick={()=>pickNode(n.id)}>{nodeTag(n)}</button>)}
   </div>
   <div className="wr-title"><span className="wr-eyebrow">{nodeTag(node)} {node.id.toUpperCase()} · WIRING DIAGRAM</span><span className="wr-pill">auto-laid out from the netlist</span></div>
   <div className="wr-seg" role="group" aria-label="Wire filter">
    {FILTERS.map(f=><button key={f.id} type="button" aria-pressed={filter===f.id} className={filter===f.id?'is-active':''} onClick={()=>setFilter(f.id)}>{f.label}</button>)}
   </div>
   <div className="wr-actions"><button type="button" className="wr-btn" onClick={doSvg}>SVG</button><button type="button" className="wr-btn" onClick={doPrint}>Print</button></div>
  </header>
  <div className="wr-print-title">
   <b>{spec.site.name} · {nodeTag(node)} {node.id} · Wiring</b>
   <span>{spec.meta.model} · r{revision??'?'} · <b data-testid="wiring-stamp">{stamp(props.evidence)}</b></span>
  </div>
  <div className="wr-scroll">
   {L.empty?<div className="wr-empty">This node has no parts or wires yet.</div>:
   <svg ref={svgRef} className="wr-svg" viewBox={`0 0 ${L.width} ${L.height}`} width={L.width} height={L.height} role="img" aria-label={`Wiring diagram for ${node.id}`} data-testid="wiring-svg" onClick={()=>setSticky(null)}>
    <rect className="wr-bg" x={0} y={0} width={L.width} height={L.height}/>
    <rect className="wr-zone" x={L.enclosure.x} y={L.enclosure.y} width={L.enclosure.w} height={L.enclosure.h}/>
    <text className="wr-zone-label" x={L.fieldLabel.x} y={L.fieldLabel.y-14}>FIELD</text>
    <text className="wr-zone-label" x={L.enclosure.x+10} y={L.enclosure.y+14}>{L.enclosure.label}</text>
    {L.blocks.map(b=><g key={b.id} className={`wr-block${b.kind==='board'?' is-board':''}${selPart===b.id?' is-sel':''}`} role="button" tabIndex={0} aria-label={`${b.ref} ${b.title}`}
      onClick={e=>{e.stopPropagation();if(b.kind==='part')proActions.select({kind:'part',id:b.id,nodeId});else proActions.select({kind:'node',id:nodeId});}}
      onKeyDown={act(()=>b.kind==='part'?proActions.select({kind:'part',id:b.id,nodeId}):proActions.select({kind:'node',id:nodeId}))}>
     <rect className="wr-box" x={b.x} y={b.y} width={b.w} height={b.h}/>
     <text className="wr-ref" x={b.x+8} y={b.y+15}>{b.ref}</text>
     <text className="wr-name" x={b.x+8+b.ref.length*7+6} y={b.y+15}>{b.title.length>(b.w-40)/6.4?`${b.title.slice(0,Math.floor((b.w-48)/6.4))}…`:b.title}</text>
     <text className="wr-sub" x={b.x+8} y={b.y+28}>{b.sub.length>(b.w-12)/5.6?`${b.sub.slice(0,Math.floor((b.w-18)/5.6))}…`:b.sub}</text>
     {b.ports.map((p,i)=><g key={i} className={`wr-port${p.wireId===active?' is-hot':''}`}><circle cx={p.x} cy={p.y} r={2.6}/><text x={p.side==='l'&&b.kind==='part'||p.side==='r'&&b.kind==='board'?p.x-8:p.x+8} y={p.y+3.4} textAnchor={p.side==='l'&&b.kind==='part'||p.side==='r'&&b.kind==='board'?'end':'start'}>{p.pin}</text></g>)}
    </g>)}
    {L.wires.map(w=><g key={w.id} className={`wr-wire wr-c-${w.color}${w.dim?' is-dim':''}${hot(w)?' is-hot':''}${w.verif==='verified'?'':' is-unv'}`} onMouseEnter={()=>setHover(w.id)} onMouseLeave={()=>setHover(null)}
      onClick={e=>{e.stopPropagation();pickWire(w.id);}} role="button" tabIndex={0} aria-label={w.text} onKeyDown={act(()=>pickWire(w.id))} data-wire={w.id}>
     <path className="wr-hit" d={w.d}/><path className="wr-casing" d={w.d}/><path className="wr-core" d={w.d}/>
     <Chip w={w}/>
    </g>)}
    {L.tbs.map(t=><g key={t.ref} className="wr-tb"><rect x={t.x} y={t.y} width={t.w} height={t.h}/>
     <text className="wr-tb-ref" x={t.x+t.w/2} y={t.y-6} textAnchor="middle">{t.ref}</text>
     {t.terminals.map(x=><g key={x.n} className={x.wireId===active?'is-hot':''}><circle cx={t.x+t.w/2} cy={x.y} r={5}/><text x={t.x+t.w/2} y={x.y+2.6} textAnchor="middle">{x.n}</text></g>)}
     <g className="wr-gland"><rect x={t.x-16} y={t.y+t.h/2-6} width={8} height={12}/><text x={t.x-20} y={t.y+t.h/2-10} textAnchor="end">{t.gland}</text></g>
    </g>)}
    <g className="wr-legend" transform={`translate(24 ${L.legend.y})`}>
     <text className="wr-zone-label" x={0} y={0}>WIRE COLOUR CODE</text>
     {L.legend.colors.map((c,i)=><g key={c.color} transform={`translate(${i*150} 16)`} className={`wr-c-${c.color}`}><path className="wr-casing" d="M0 0H22"/><path className="wr-core" d="M0 0H22"/><text x={30} y={3.5}>{c.color} · {c.funcs.join('/')}</text></g>)}
     <g transform={`translate(${L.legend.colors.length*150+10} 16)`}><rect className="wr-chip-bg" x={0} y={-7} width={18} height={14}/><text x={26} y={3.5}>✓ verified</text><rect className="wr-chip-bg is-unv" x={100} y={-7} width={18} height={14}/><text x={126} y={3.5}>dashed = unverified (reason in the cable list)</text></g>
    </g>
   </svg>}
  </div>
  <div className="wr-tables">
   <section className="wr-table-wrap" aria-label="Pin table">
    <h3 className="wr-eyebrow">Pin table <span>U1 · {T.pins.length} used</span></h3>
    <table className="wr-table" data-testid="pin-table"><thead><tr><th>GPIO</th><th>Net</th><th>To</th><th>Wire</th><th>Note</th></tr></thead><tbody>
     {T.pins.map((p,i)=>{const h=p.wireId&&p.wireId===active||(!active&&selPart===p.partId);return <tr key={i} className={h?'is-hot':''} onMouseEnter={()=>p.wireId&&setHover(p.wireId)} onMouseLeave={()=>setHover(null)} onClick={()=>p.wireId&&pickWire(p.wireId)}>
      <td><b>{p.gpio}</b></td><td>{p.net}</td><td>{p.to}</td><td>{p.wireId?<WireTag id={p.wireId} w={L.wires}/>:'—'}</td><td className="wr-note">{p.note}</td></tr>;})}
     {!T.pins.length&&<tr><td colSpan={5} className="wr-note">No pin assignments.</td></tr>}
    </tbody></table>
   </section>
   <section className="wr-table-wrap" aria-label="Cable list">
    <h3 className="wr-eyebrow">Cable list <span>{T.cables.length} {T.cables.length===1?"wire":"wires"} · {T.glands} {T.glands===1?"gland":"glands"} · {T.totalM.toFixed(1)} m</span></h3>
    <table className="wr-table" data-testid="cable-table"><thead><tr><th>Wire</th><th>From → To</th><th>Via</th><th>Len</th><th>Gauge</th><th>Status</th></tr></thead><tbody>
     {T.cables.map(c=><tr key={c.wireId} className={cls('',{id:c.wireId,partIds:c.partIds}).trim()} onMouseEnter={()=>setHover(c.wireId)} onMouseLeave={()=>setHover(null)} onClick={()=>pickWire(c.wireId)} data-wire={c.wireId}>
      <td><WireTag id={c.wireId} w={L.wires}/></td><td>{c.from} → {c.to}</td><td>{c.via}</td><td>{c.len}</td><td>{c.gauge}</td><td><VerifChip v={c.verif} reason={c.reason}/></td></tr>)}
     {!T.cables.length&&<tr><td colSpan={6} className="wr-note">No wires.</td></tr>}
    </tbody></table>
   </section>
  </div>
 </div>;
}

function WireTag({id,w}:{id:string;w:WWire[]}){const x=w.find(v=>v.id===id);return <span className="wr-tag"><i className={`wr-sw wr-c-${x?.color??'grey'}`}/>{id}</span>;}
function Chip({w}:{w:WWire}){
 const {x,y,w:cw}=w.chip;
 return <g className="wr-chip-g"><rect className="wr-chip-bg" x={x} y={y-7} width={cw} height={14}/>
  <text x={x+6} y={y+3.4}>{w.verif==='verified'?<tspan className="wr-ok">✓ </tspan>:null}{w.text}</text><title>{w.verif==='verified'?`${w.text} (verified)`:`${w.text} (unverified: ${w.note})`}</title></g>;
}

/** Integrator hook: registers the Wiring dock tab (order 10). */
export function registerWiringTab(){
 return registerDockTab({id:'wiring',label:'Wiring',order:10,badge:()=>{const n=getProState().spec?.nodes.reduce((a,x)=>a+x.wires.length,0);return n?String(n):undefined;},render:()=><WiringPanel/>});
}
export default WiringPanel;
