/** Properties panel for the current selection. Shows derived values from the spec as stored; never recomputes power, BOM or checks. */
import type {ReactNode} from 'react';
import type {SystemSpec} from '../../../../../packages/pro-contract/system-spec';
import {useProSpec,useSelection} from '../api/spec-store';

const WIRE_VAR:Record<string,string>={red:'--ds-error',black:'--ds-ink',grey:'--ds-ink-3',white:'--ds-line-strong'};
const WIRE_HEX:Record<string,string>={yellow:'#c99a00',blue:'#1f4fd1',green:'#2f8a4a',orange:'#d9731a',purple:'#7a3fb5',brown:'#6b4a2b'};// ds-allow-hex
const wireColor=(c:string)=>WIRE_VAR[c]?`var(${WIRE_VAR[c]})`:WIRE_HEX[c]??'var(--ds-ink-3)';

const Sec=({title,children}:{title:string;children:ReactNode})=><section className="pro-prop-sec"><h3 className="pro-eyebrow">{title}</h3>{children}</section>;
const KV=({k,v}:{k:string;v:ReactNode})=><div className="pro-kv"><span>{k}</span><span>{v}</span></div>;
const Chip=({children,tone}:{children:ReactNode;tone?:'dark'|'ok'|'warn'})=><span className={'pro-chip'+(tone?' pro-chip-'+tone:'')}>{children}</span>;

function Head({eyebrow,title,sub,chips}:{eyebrow:string;title:string;sub?:string;chips?:ReactNode}){
 return <div className="pro-prop-head"><div className="pro-prop-eyebrow">{eyebrow}</div><div className="pro-prop-title">{title}</div>{sub&&<div className="pro-prop-sub">{sub}</div>}{chips&&<div className="pro-prop-chips">{chips}</div>}</div>;
}
const checkTone=(spec:SystemSpec,scope:Partial<Record<'nodeId'|'fieldId'|'linkId',string>>)=>spec.checks.filter(c=>Object.entries(scope).every(([k,v])=>(c.scope as Record<string,string|undefined>)[k]===v));

export function PropertiesPanel(){
 const {spec,refs}=useProSpec();
 const {selection,select}=useSelection();
 let body:ReactNode=<div className="pro-empty">Select something in the tree to see its properties.</div>;
 let kind='';
 if(spec&&refs){
  const sel=selection??{kind:'site' as const,id:'site'};
  kind=sel.kind.toUpperCase();
  if(sel.kind==='site'){
   const s=spec.site;
   body=<><Head eyebrow="Site" title={s.name} sub={`${spec.fields.length} fields · ${spec.nodes.length} nodes`}/>
    <Sec title="Conditions"><KV k="Grid power" v={s.gridPower??'n/a'}/><KV k="Internet" v={s.internet??'n/a'}/><KV k="Stress" v={s.stress?.join(', ')||'none'}/><KV k="Peak sun hours" v={s.peakSunHours!==undefined?`${s.peakSunHours} h`:'n/a'}/><KV k="Plan" v={s.plan?`${s.plan.widthM} × ${s.plan.heightM} m`:'n/a'}/></Sec>
    <Sec title="Summary"><p className="pro-prose">{spec.summary.en}</p></Sec></>;
  }else if(sel.kind==='field'){
   const f=spec.fields.find(x=>x.id===sel.id);
   if(f)body=<><Head eyebrow={refs.fields[f.id]+' · field'} title={f.name} sub={f.crop} chips={<Chip>{f.distanceSource==='user'?'Distance: you':'Distance: estimated'}</Chip>}/>
    <Sec title="Geometry"><KV k="Area" v={`${(f.areaM2/10000).toFixed(2)} ha`}/><KV k="To gateway" v={`${f.distanceToGatewayM} m`}/><KV k="Plan position" v={`${f.plan.x}, ${f.plan.y} · ${f.plan.w}×${f.plan.h} m`}/></Sec>
    <Sec title="Nodes">{spec.nodes.filter(n=>n.fieldId===f.id).map(n=><button key={n.id} type="button" className="pro-prop-link" onClick={()=>select({kind:'node',id:n.id})}>{refs.nodes[n.id]} · {n.id}</button>)}</Sec></>;
  }else if(sel.kind==='node'){
   const n=spec.nodes.find(x=>x.id===sel.id);
   if(n){
    const issues=checkTone(spec,{nodeId:n.id});
    body=<><Head eyebrow={refs.nodes[n.id]+' · '+n.role} title={n.id} sub={n.board} chips={<>{n.power.ok?<Chip tone="ok">Power OK</Chip>:<Chip tone="warn">Power short</Chip>}{issues.length>0&&<Chip tone="warn">{issues.length} checks</Chip>}</>}/>
     <Sec title="Electrical"><KV k="Supply" v={`${n.power.supplyV} V · ${n.power.source}`}/><KV k="Average" v={`${n.power.budget.avgMa} mA`}/><KV k="Peak" v={`${n.power.budget.peakMa} mA`}/><KV k="Daily" v={`${n.power.budget.dailyWh} Wh`}/>{n.power.battery&&<KV k="Battery" v={`${n.power.battery.series}S${n.power.battery.parallel}P ${n.power.battery.chemistry} · ${n.power.battery.autonomyDays} d`}/>}{n.power.solar&&<KV k="Solar" v={`${n.power.solar.panelW} W ${n.power.solar.controller.toUpperCase()}`}/>}</Sec>
     <Sec title="Enclosure"><KV k="Rating" v={n.enclosure.ip}/><KV k="Mount" v={n.enclosure.mount}/><KV k="Size" v={`${n.enclosure.sizeMm.w}×${n.enclosure.sizeMm.h}×${n.enclosure.sizeMm.d} mm`}/><KV k="Glands" v={n.enclosure.glands}/></Sec>
     <Sec title="Behaviour"><KV k="Sample every" v={`${n.sampleEveryS} s`}/><KV k="Rules" v={n.rules.length}/><p className="pro-prose">{n.rationale.en}</p></Sec>
     <Sec title={`Parts · ${n.parts.length}`}>{n.parts.map((p,i)=><button key={p.id} type="button" className="pro-prop-link" onClick={()=>select({kind:'part',id:p.id,nodeId:n.id})}><span className="pro-tree-num">{i+1}</span>{p.purpose.en}</button>)}</Sec></>;
   }
  }else if(sel.kind==='part'){
   const n=spec.nodes.find(x=>x.id===sel.nodeId),idx=n?n.parts.findIndex(p=>p.id===sel.id):-1,p=n?.parts[idx];
   if(n&&p){
    const wires=n.wires.filter(w=>w.from.part===p.id||w.to.part===p.id);
    const pins=n.pins.filter(r=>r.part===p.id);
    const stamps=wires.map(w=>spec.verification[`/nodes/${spec.nodes.indexOf(n)}/wires/${n.wires.indexOf(w)}`]).filter(Boolean);
    const allOk=stamps.length>0&&stamps.every(s=>s.status==='verified');
    body=<><Head eyebrow={`${refs.nodes[n.id]} · item ${idx+1}`} title={p.purpose.en} sub={p.kind} chips={<><Chip tone="dark">{p.role}</Chip>{stamps.length>0&&(allOk?<Chip tone="ok">✓ Wiring verified</Chip>:<Chip tone="warn">Wiring unverified</Chip>)}{p.qty>1&&<Chip>×{p.qty}</Chip>}</>}/>
     <Sec title="Placement"><KV k="Node" v={`${refs.nodes[n.id]} · ${n.id}`}/><KV k="Mounted" v={p.mount}/>{p.cableM!==undefined&&<KV k="Cable" v={`${p.cableM} m`}/>}</Sec>
     {pins.length>0&&<Sec title="Interface">{pins.map(r=><KV key={r.boardPin+r.partPin} k={r.func} v={`${r.partPin} → ${r.boardPin}`}/>)}</Sec>}
     <Sec title={`Connections · ${wires.length} wires`}>{wires.length===0?<div className="pro-prose">No wires.</div>:wires.map(w=>{const o=w.from.part===p.id?w.to:w.from,own=w.from.part===p.id?w.from:w.to;
      return <div key={w.id} className="pro-wire"><i style={{background:wireColor(w.color)}}/><span>{w.id}</span><span>{own.pin}</span><span>→ {o.part==='board'?o.pin:`${o.part} ${o.pin}`}</span></div>;})}</Sec></>;
   }
  }else if(sel.kind==='link'){
   const l=spec.links.find(x=>x.id===sel.id);
   if(l){
    const pr=l.params;
    body=<><Head eyebrow={refs.links[l.id]+' · link'} title={`${refs.nodes[l.from]} ↔ ${refs.nodes[l.to]}`} sub={`${l.distanceM} m · ${pr.medium}`} chips={<Chip tone={l.estimate.ok?'ok':'warn'}>{l.estimate.ok?'Margin OK':'Margin low'}</Chip>}/>
     <Sec title="Radio">{pr.medium==='lora'?<><KV k="Band" v={`${pr.band} · ${pr.freqMHz} MHz`}/><KV k="SF / BW" v={`SF${pr.sf} · BW${pr.bwKHz}`}/><KV k="TX power" v={`${pr.txPowerDbm} dBm`}/><KV k="Coding" v={pr.codingRate}/></>:<KV k="Medium" v={pr.medium}/>}</Sec>
     <Sec title="Estimate">{l.estimate.marginDb!==undefined&&<KV k="Margin" v={`${l.estimate.marginDb} dB est.`}/>}{l.estimate.rssiDbm!==undefined&&<KV k="RSSI" v={`${l.estimate.rssiDbm} dBm`}/>}<p className="pro-prose">{l.estimate.basis.en}</p></Sec></>;
   }
  }
 }
 return <aside className="pro-props" aria-label="Properties"><div className="pro-panel-head"><span className="pro-eyebrow">Properties</span><span className="pro-eyebrow">{kind}</span></div><div className="pro-props-scroll">{body}</div></aside>;
}
