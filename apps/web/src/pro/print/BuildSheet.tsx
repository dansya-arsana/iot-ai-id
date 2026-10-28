import {revealHidden} from '../code/model';
/**
 * Build Sheet (M8): A4 EN engineering-drawing pages from one saved SystemSpec revision. Pure of fetching: PrintPage loads the data.
 * Honesty: "verified" is printed only for gated items (see model.ts); everything else says "unverified · <reason>".
 * Drafts never reach this component (revisions only). The title block says DESIGN · NOT BUILT unless evidence is passed.
 */
import {useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import type {ProNode,SystemSpec} from '../../../../../packages/pro-contract/system-spec';
import {displayRefs,type DisplayRefs} from '../../../../../packages/pro-contract/refs';
import {SitePlan} from '../site/SitePlan';
import {fmtArea} from '../site/layout';
import {planAssembly} from '../cad/plan';
import {modelSizeOf} from '../cad/node-assembly';
import {countBySeverity,sortChecks} from '../checks/checks-model';
import {CHEM_LABEL,SOURCE_LABEL} from '../power/power-model';
import {NodeWiring} from './NodeWiring';
import {renderSnapshot,type Snapshot} from './snapshot';
import {
 SCHEDULE_ON_COVER,CABLE_P2,CK_COLUMNS,PIN_P2,TABLE_CONT,cableList,checklistCounts,codeGate,collectUnverified,designators,docNo,nodeIsSmall,gateOf,idrK,idrM,isoDate,
 pinTable,planPages,showsSitePlan,powerGate,titleStatus,verifySummary,wirePointer,type Evidence,type Gate,type PageDesc
} from './model';
import './print.css';

export interface RevisionRow{revision:number;reason:string;by:string;at:string}
export interface BuildSheetProps{
 spec:SystemSpec;projectId:string;revision:number;projectName?:string;/** ISO date of the saved revision */savedAt?:string;
 revisions?:RevisionRow[];evidence?:Evidence;/** Skip the WebGL snapshots (tests, no-GPU CI). */noSnapshots?:boolean;
}
interface Ctx{spec:SystemSpec;refs:DisplayRefs;projectId:string;revision:number;name:string;date:string;model:string;status:string;N:number;revisions:RevisionRow[];snaps:Record<string,Snapshot|null|undefined>}

const nodeOf=(spec:SystemSpec,id:string)=>spec.nodes.find(n=>n.id===id)!;
const fieldOf=(spec:SystemSpec,n:ProNode)=>spec.fields.find(f=>f.id===n.fieldId);
const partName=(kind:string)=>kind.replace(/-/g,' ').replace(/\b(\w)/,c=>c.toUpperCase());

/** Gate badge: the word "verified" only comes out of a verified gate. */
function Badge({g}:{g:Gate}){
 return g.state==='verified'?<span className="bs-badge is-ok">✓ verified</span>:<span className={`bs-badge ${g.state==='failed'?'is-bad':'is-warn'}`}>{g.state==='failed'?'✕ failed':'unverified'} · {g.reason??'no reason recorded'}</span>;
}

function Page({ctx,n,section,title,scale='NTS',box,children}:{ctx:Ctx;n:number;section:string;title:string;scale?:string;box?:ReactNode;children:ReactNode}){
 const body=useRef<HTMLDivElement>(null),sheet=useRef<HTMLElement>(null);
 // overflow flag for tests and the screen outline: written to the DOM, no state, so it cannot loop
 useLayoutEffect(()=>{const el=body.current;if(el&&sheet.current)sheet.current.dataset.overflow=el.scrollHeight>el.clientHeight+1?'1':'0';});
 return <section className="bs-page" data-testid="bs-page" data-sheet={n} data-overflow="0" ref={sheet}>
  <div className="bs-frame">
   <header className="bs-head"><div><div className="bs-kicker">BUILD SHEET · SHEET {n} · {section}</div><h1 className="bs-h1">{title}</h1></div>{box&&<aside className="bs-box">{box}</aside>}</header>
   <div className="bs-body" ref={body}>{children}</div>
   <div className="bs-disclaimer">AI-generated design from a text prompt. Code is compiled or linted, never run in emulation or on hardware by this tool unless a flash record is shown. Prices are estimates, not quotes. A qualified person must check this sheet before building.</div>
   <footer className="bs-tb" data-testid="bs-titleblock">
    <div className="bs-tb-logo"><b>iot.ai.id</b><span>PRO · BUILD SHEET</span></div>
    <div className="bs-tb-cell bs-tb-wide"><span>PROJECT · DRAWING</span><b>{ctx.name} · {title}</b></div>
    <div className="bs-tb-cell"><span>DOC · REV</span><b>{docNo(ctx.projectId)} · r{ctx.revision}</b></div>
    <div className="bs-tb-cell"><span>DATE</span><b>{ctx.date}</b></div>
    <div className="bs-tb-cell"><span>SCALE</span><b>{scale}</b></div>
    <div className="bs-tb-cell"><span>SHEET</span><b>{n} of {ctx.N} · EN</b></div>
    <div className="bs-tb-cell bs-tb-r2"><span>DRAWN BY</span><b>AI · {ctx.model}</b></div>
    <div className="bs-tb-cell bs-tb-r2 bs-tb-wide"><span>CHECKED BY · SIGNATURE</span><i className="bs-blank"/></div>
    <div className="bs-tb-cell bs-tb-r2"><span>APPROVED BY</span><i className="bs-blank"/></div>
    <div className="bs-tb-cell bs-tb-r2 bs-tb-span2"><span>STATUS</span><b data-testid="bs-status">{ctx.status}</b></div>
   </footer>
  </div>
 </section>;
}
const H=({children,note}:{children:ReactNode;note?:string})=><h2 className="bs-h2"><span>{children}</span>{note&&<em>{note}</em>}<i/></h2>;

// ---------- cover ----------
function Cover({ctx,n}:{ctx:Ctx;n:number}){
 const {spec,refs}=ctx;const sum=verifySummary(spec,refs);const sev=countBySeverity(spec.checks);
 const gw=spec.nodes.find(x=>x.role==='gateway');
 const totalHa=spec.fields.reduce((a,f)=>a+f.areaM2,0);
 const open=sortChecks(spec.checks).filter(c=>c.severity!=='info')[0];
 const box=<>
  <b>VERIFICATION · spec r{ctx.revision}</b>
  <div>Wires verified <b>{sum.wires.ok}/{sum.wires.total}</b> · links <b>{sum.links.ok}/{sum.links.total}</b></div>
  <div>Code: {sum.code.compiled} compiled{sum.code.linted?` · ${sum.code.linted} linted only`:''}{sum.code.failed?` · ${sum.code.failed} failed`:''}{sum.code.other?` · ${sum.code.other} pending`:''}</div>
  <div>Checks: {sev.error} errors · {sev.warning} warnings · {sev.info} notes</div>
  <div>Run on hardware: no evidence</div>
 </>;
 const site=showsSitePlan(spec),dev=spec.nodes[0];
 return <Page ctx={ctx} n={n} section={site?'SITE AND SYSTEM':'DEVICE'} title={spec.site.name} scale="NTS" box={box}>
  <div className="bs-row2">
   <div className="bs-card"><div className="bs-cap">SUMMARY</div><p className="bs-lead">{spec.summary.en}</p>
    {site?<p className="bs-small">{spec.fields.length} fields · {fmtArea(totalHa)} · {spec.nodes.filter(x=>x.role!=='gateway').length} nodes{gw?' · 1 gateway':''} · {spec.links.length} links</p>:<p className="bs-small">Single device · {dev?.board} · {dev?.parts.length??0} parts · power {dev?.power.source}</p>}</div>
   {site?<div className="bs-card"><div className="bs-cap">SITE</div>
    <dl className="bs-dl"><dt>Region</dt><dd>{spec.site.regionId??'not set'}</dd><dt>Grid power</dt><dd>{spec.site.gridPower??'not set'}</dd><dt>Internet</dt><dd>{spec.site.internet??'not set'}</dd><dt>Stress</dt><dd>{spec.site.stress?.join(', ')||'none noted'}</dd><dt>Peak sun</dt><dd>{spec.site.peakSunHours??'n/a'} h/day</dd></dl></div>
   :<div className="bs-card"><div className="bs-cap">DEVICE</div>
    <dl className="bs-dl"><dt>Board</dt><dd>{dev?.board??'not set'}</dd><dt>Power</dt><dd>{dev?.power.source??'not set'}</dd><dt>Parts</dt><dd>{dev?.parts.length??0}</dd><dt>Enclosure</dt><dd>{dev?`${dev.enclosure.ip} · ${dev.enclosure.sizeMm.w}×${dev.enclosure.sizeMm.h}×${dev.enclosure.sizeMm.d} mm`:'not set'}</dd>{spec.site.stress?.length?<><dt>Stress</dt><dd>{spec.site.stress.join(', ')}</dd></>:null}</dl></div>}
  </div>
  {site&&<><H note="sketched from the prompt, not surveyed · distances est.">SITE PLAN</H>
  <div className="bs-site"><SitePlan spec={spec}/></div></>}
  <div className="bs-row2 bs-row2-wide">
   {spec.nodes.length<=SCHEDULE_ON_COVER?<div><H>NODE SCHEDULE</H><Schedule ctx={ctx} rows={[0,spec.nodes.length]}/></div>:<div><H>NODE SCHEDULE</H><p className="bs-small">{spec.nodes.length} nodes: see the schedule on the next sheet.</p></div>}
   <div><H>OPEN POINTS</H>{open?<div className="bs-warn"><b>{open.severity==='error'?'Error':'Warning'}{open.ref?` · ${open.ref}`:''}.</b> {open.en}</div>:<p className="bs-small">No open warnings or errors in the stored checks.</p>}
    {sev.error+sev.warning>1&&<p className="bs-small">{sev.error+sev.warning-1} more on the checks sheet.</p>}</div>
  </div>
 </Page>;
}


function Schedule({ctx,rows}:{ctx:Ctx;rows:[number,number]}){
 const {spec,refs}=ctx;
 const linkOf=(id:string)=>spec.links.find(l=>l.from===id||l.to===id);
 return <table className="bs-t"><thead><tr><th>NODE</th><th>FIELD</th><th>MEASURES / CONTROLS</th><th>LINK</th><th>POWER</th></tr></thead><tbody>
     {spec.nodes.slice(...rows).map(x=>{const f=fieldOf(spec,x),l=linkOf(x.id);return <tr key={x.id}>
      <td className="bs-b">{refs.nodes[x.id]}</td><td>{f?<>{refs.fields[f.id]} · {f.name}<br/><span className="bs-mute">{fmtArea(f.areaM2)} · {f.crop}</span></>:'Pump house'}</td>
      <td>{[...new Set(x.parts.map(p=>p.purpose.en))].slice(0,4).join(', ')}</td>
      <td className="bs-mono">{l?(l.params.medium==='lora'?`LoRa ${Math.round(l.distanceM)} m`:`${l.params.medium} ${Math.round(l.distanceM)} m`):'–'}{l&&l.estimate.marginDb!==undefined?<><br/>{l.estimate.marginDb>=0?'+':''}{Math.round(l.estimate.marginDb)} dB est.</>:null}</td>
      <td>{SOURCE_LABEL[x.power.source]??x.power.source} · {x.power.supplyV} V</td></tr>;})}
    </tbody></table>;
}
function SchedulePage({ctx,n,d}:{ctx:Ctx;n:number;d:Extract<PageDesc,{kind:'schedule'}>}){
 return <Page ctx={ctx} n={n} section="SITE AND SYSTEM" title={`Node schedule${d.chunk?' (cont.)':''}`}><H>NODE SCHEDULE</H><Schedule ctx={ctx} rows={d.lines}/></Page>;
}

// ---------- node ----------
function Figure({snap,node,ctx}:{snap:Snapshot|null|undefined;node:ProNode;ctx:Ctx}){
 if(snap===undefined)return <div className="bs-fig bs-fig-empty">Rendering 3D…</div>;
 if(snap===null)return <div className="bs-fig bs-fig-empty">3D snapshot not available in this browser. The parts list holds the same information.</div>;
 void node;void ctx;
 return <div className="bs-fig"><img src={snap.url} alt="Exploded assembly" width={snap.w} height={snap.h}/>
  <svg viewBox={`0 0 ${snap.w} ${snap.h}`} aria-hidden="true">{snap.balloons.map(b=><g key={b.ref}>
   <path d={`M${b.ax},${b.ay}L${b.bx+(b.side==='left'?24:-24)},${b.by}`} className="bs-leader"/><circle cx={b.bx} cy={b.by} r={24} className="bs-balloon"/><circle cx={b.ax} cy={b.ay} r={4} className="bs-dot"/>
   <text x={b.bx} y={b.by+9} textAnchor="middle" className="bs-bn">{b.ref}</text></g>)}</svg></div>;
}
function NodePage({ctx,n,node,part}:{ctx:Ctx;n:number;node:ProNode;part:number}){
 const {spec,refs}=ctx;const ni=spec.nodes.indexOf(node);const f=fieldOf(spec,node);
 const des=useMemo(()=>designators(node),[node]);
 const plan=useMemo(()=>planAssembly(node,modelSizeOf),[node]);
 const label=useMemo(()=>(id:string)=>plan.items.find(i=>i.id===id)?.label??partName(node.parts.find(p=>p.id===id)?.kind??id),[node,plan]);
 const files=spec.code.map((c,i)=>({c,i})).filter(x=>x.c.nodeId===node.id);
 const wOk=node.wires.filter((_w,wi)=>gateOf(spec,wirePointer(ni,wi)).state==='verified').length;
 const pg=powerGate(spec,node);
 const nref=refs.nodes[node.id]??node.id;
 const title=`${nref} ${node.id}${f?` · Field ${refs.fields[f.id]}, ${f.crop}`:node.role==='device'?' · device':' · gateway'}`;
 const box=<>
  <b>{files[0]?`CODE · ${files.map(x=>x.c.filename).join(' + ')}`:'CODE · none on this node'}</b>
  {files.map(x=>{const g=codeGate(spec,x.i);return <div key={x.i}>{g.state==='verified'?'✓ compiled':'✕ not verified'} {x.c.verify.toolchain.split(' ').slice(0,2).join(' ')} · {x.c.verify.diagnostics.length} diagnostics</div>;})}
  <div>Wires verified {wOk}/{node.wires.length} · power {pg.state==='verified'?'verified':`unverified · ${pg.reason}`}</div>
  <div>Not run on hardware{files[0]?' · listing: appendix':''}</div>
 </>;
 const small=nodeIsSmall(node);
 const tables=(cont:number)=><NodeTables node={node} des={des} nref={nref} cont={cont} full={cont===0}/>;
 const page1=<>
  <div className="bs-row2 bs-fig-row">
   <div><H note={`explode 55% · iso`}>EXPLODED ASSEMBLY</H><Figure snap={ctx.snaps[node.id]} node={node} ctx={ctx}/></div>
   <div><H>PARTS LIST</H><table className="bs-t bs-parts"><thead><tr><th>#</th><th>REF</th><th>PART</th><th>3D</th></tr></thead><tbody>
    {plan.items.map(it=>{const q=node.parts.find(p=>p.id===it.id)?.qty??1;return <tr key={it.id}><td className="bs-mono">{it.ref}</td><td className="bs-mono">{des[it.id]??(it.type==='enclosure'?'ENC':it.id)}</td><td>{it.label}{q>1?` ×${q}`:''}</td><td className="bs-mono bs-mute">{it.has3d?'':'box'}</td></tr>;})}</tbody></table></div>
  </div>
  <H note="auto-laid out from the netlist · colour code in the cable list">WIRING DIAGRAM</H>
  {node.wires.length?<NodeWiring node={node} des={des} partLabel={label}/>:<p className="bs-small">No wires are stored for this node.</p>}
 </>;
 if(part===1)return <Page ctx={ctx} n={n} section="NODE DETAIL" title={title} box={box}>{page1}{small&&tables(0)}</Page>;
 return <Page ctx={ctx} n={n} section={`NODE DETAIL · ${nref} · TABLES${part>2?` (cont.)`:''}`} title={title} box={box}>{tables(part-2)}</Page>;
}
function NodeTables({node,des,nref,cont,full}:{node:ProNode;des:Record<string,string>;nref:string;cont:number;full:boolean}){
 const pins=pinTable(node,des),cables=cableList(node,des);
 const pr:[number,number]=cont===0?[0,PIN_P2]:[PIN_P2+(cont-1)*TABLE_CONT,PIN_P2+cont*TABLE_CONT];
 const cr:[number,number]=cont===0?[0,CABLE_P2]:[CABLE_P2+(cont-1)*TABLE_CONT,CABLE_P2+cont*TABLE_CONT];
 const encl=node.enclosure;
 return <>
  <div className="bs-row2">
   <div><H note={`${node.pins.length} pins`}>{`PIN TABLE · ${nref}`}</H>
    <table className="bs-t"><thead><tr><th>GPIO</th><th>NET</th><th>TO</th><th>WIRE</th></tr></thead><tbody>
     {pins.slice(...pr).map(p=><tr key={p.boardPin+p.to}><td className="bs-b bs-mono">{p.boardPin}</td><td className="bs-mono">{p.net}</td><td>{p.to}</td><td className="bs-mono">{p.wire}</td></tr>)}
     {!pins.length&&<tr><td colSpan={4} className="bs-mute">No signal pins on this node.</td></tr>}</tbody></table></div>
   <div><H note={`${node.wires.length} wires`}>CABLE LIST</H>
    <table className="bs-t"><thead><tr><th>WIRE</th><th>COLOUR</th><th>FROM → TO</th><th>VIA</th><th>LEN</th><th>GAUGE</th></tr></thead><tbody>
     {cables.slice(...cr).map(c=><tr key={c.id}><td className="bs-b bs-mono">{c.id}</td><td>{c.color}</td><td className="bs-mono">{c.from} → {c.to}</td><td>{c.via}</td><td className="bs-mono">{c.len}</td><td>{c.gauge}</td></tr>)}
     {!cables.length&&<tr><td colSpan={6} className="bs-mute">No wires stored.</td></tr>}</tbody></table></div>
  </div>
  {full&&<>
   <H>ENCLOSURE · POWER</H>
   <p className="bs-small">{encl.ip} · {encl.mount} mount · {encl.sizeMm.w}×{encl.sizeMm.h}×{encl.sizeMm.d} mm · {encl.glands} glands. {SOURCE_LABEL[node.power.source]??node.power.source} {node.power.supplyV} V · {node.power.budget.dailyWh} Wh/day (avg {node.power.budget.avgMa} mA, peak {node.power.budget.peakMa} mA).</p>
   <H note={`sample every ${node.sampleEveryS} s`}>CONTROL RULES</H>
   {node.rules.length?<table className="bs-t"><thead><tr><th>#</th><th>WHEN</th><th>THEN</th><th>WHY</th></tr></thead><tbody>{node.rules.map((r,i)=><tr key={r.id}>
    <td className="bs-mono">{i+1}</td><td className="bs-mono">{des[r.when.part]??r.when.part} {r.when.metric} {r.when.op} {r.when.value}{r.hysteresis?` (±${r.hysteresis})`:''}{r.window?` ${r.window.from}–${r.window.to}`:''}</td>
    <td className="bs-mono">{des[r.then.part]??r.then.part} {r.then.action}{r.then.durationS?` ${r.then.durationS} s`:''}</td><td>{r.reason.en}</td></tr>)}</tbody></table>:<p className="bs-small">No automation rules: the node only reports readings.</p>}
   <H>DESIGN RATIONALE</H><p className="bs-small">{node.rationale.en}</p>
  </>}
</>;
}

// ---------- procurement ----------
function BomPage({ctx,n,d}:{ctx:Ctx;n:number;d:Extract<PageDesc,{kind:'bom'}>}){
 const {spec,refs}=ctx;const dates=[...new Set(spec.bom.lines.map(l=>l.priceSource.checkedAt))].sort();
 const box=<><b>FARM TOTAL · est.</b><div className="bs-big">{idrM(spec.bom.totalIdr)}</div><div>{spec.bom.lines.length} lines · prices {dates[dates.length-1]??'n/a'}</div></>;
 const lines=spec.bom.lines.slice(...d.lines);
 const where=(l:typeof lines[number])=>l.perNode.length===spec.nodes.length&&spec.nodes.length>2?'all':l.perNode.map(p=>refs.nodes[p.nodeId]??p.nodeId).join(', ');
 return <Page ctx={ctx} n={n} section="PROCUREMENT, POWER" title={`Bill of materials and power budget${d.chunk?' (cont.)':''}`} box={box}>
  <H note="IDR thousands · estimate ranges, not quotes">BILL OF MATERIALS</H>
  <table className="bs-t"><thead><tr><th>#</th><th>ITEM</th><th>WHERE</th><th className="bs-r">QTY</th><th className="bs-r">UNIT</th><th className="bs-r">LINE</th></tr></thead><tbody>
   {lines.map((l,i)=><tr key={l.key}><td className="bs-mono bs-mute">{d.lines[0]+i+1}</td><td>{l.name.en}{l.optional?<span className="bs-mute"> · optional</span>:null}</td><td className="bs-mono">{where(l)}</td>
    <td className="bs-mono bs-r">{l.qty}{l.unit==='pcs'?'':` ${l.unit}`}</td><td className="bs-mono bs-r">{idrK(l.priceIdr.unit)}</td><td className="bs-mono bs-r">{idrK(l.priceIdr.total)}</td></tr>)}
   {d.lines[1]>=spec.bom.lines.length&&<tr className="bs-tot"><td/><td colSpan={4}>Total, excl. shipping and tax</td><td className="bs-mono bs-r">{idrK(spec.bom.totalIdr)}</td></tr>}</tbody></table>
  {d.chunk===0&&<>
   <H note="from the stored node budgets">POWER BUDGET</H>
   <table className="bs-t"><thead><tr><th>NODE</th><th className="bs-r">WH / DAY</th><th>SOURCE</th><th className="bs-r">NO SUN</th><th>STATE</th></tr></thead><tbody>
    {spec.nodes.map(x=>{const g=powerGate(spec,x);const b=x.power.battery;return <tr key={x.id}><td className="bs-b">{refs.nodes[x.id]}</td><td className="bs-mono bs-r">{x.power.budget.dailyWh}</td>
     <td>{SOURCE_LABEL[x.power.source]??x.power.source} {x.power.supplyV} V{x.power.solar?` · ${x.power.solar.panelW} W panel`:''}{b?` · ${b.series}S${b.parallel}P ${CHEM_LABEL[b.chemistry]??b.chemistry}`:''}</td>
     <td className="bs-mono bs-r">{b?`${b.autonomyDays} d`:'–'}</td><td><Badge g={g}/></td></tr>;})}</tbody></table>
  </>}
 </Page>;
}

const SEV={error:'✕',warning:'!',info:'i'} as const;
function ChecksPage({ctx,n,d}:{ctx:Ctx;n:number;d:Extract<PageDesc,{kind:'checks'}>}){
 const {spec,refs}=ctx;const cs=sortChecks(spec.checks).slice(...d.lines);const ck=checklistCounts(spec,refs);
 const box=<><b>CHECKLIST</b><div>{ck.total} tasks · tick in the app</div><div>This sheet is the field copy</div></>;
 const scope=(c:typeof cs[number])=>c.scope.nodeId?refs.nodes[c.scope.nodeId]:c.scope.linkId?refs.links[c.scope.linkId]:c.scope.fieldId?refs.fields[c.scope.fieldId]:'–';
 return <Page ctx={ctx} n={n} section="CHECKS, CHECKLIST" title={`Design checks and checklist${d.chunk?' (cont.)':''}`} box={d.chunk===0?box:undefined}>
  <H note="reported by the server, not verified here">DESIGN CHECKS</H>
  {cs.length?<table className="bs-t bs-checks"><tbody>{cs.map((c,i)=><tr key={c.code+i}><td className={`bs-sev is-${c.severity}`}>{SEV[c.severity]}</td><td className="bs-b">{scope(c)}</td><td>{c.en}</td></tr>)}</tbody></table>:<p className="bs-small">No checks are stored for this revision.</p>}
  {d.chunk===0&&<>
   <H note="one task per BOM line, board, wire, check and install step">CHECKLIST</H>
   <table className="bs-t"><thead><tr><th>NODE</th>{CK_COLUMNS.map(c=><th key={c.phase} className="bs-r">{c.label}</th>)}<th>SIGN</th></tr></thead><tbody>
    {ck.rows.map(r=><tr key={r.ref}><td className="bs-b">{r.ref}</td>{r.counts.map((c,i)=><td key={i} className="bs-r bs-mono">{c?<><i className="bs-cb"/> {c}</>:'–'}</td>)}<td><i className="bs-blank"/></td></tr>)}</tbody></table>
   <p className="bs-small">Ticks and readings are saved per project in the app; this sheet is the field copy.</p>
   <H note="from the stored enclosure and parts">FIELD INSTALLATION</H>
   <table className="bs-t"><thead><tr><th>NODE</th><th>MOUNT</th><th>ENCLOSURE</th><th>FIELD-MOUNTED PARTS</th></tr></thead><tbody>
    {spec.nodes.map(x=>{const fp=x.parts.filter(p=>p.mount!=='enclosure');return <tr key={x.id}><td className="bs-b">{refs.nodes[x.id]}</td><td>{x.enclosure.mount}</td><td>{x.enclosure.ip} · {x.enclosure.sizeMm.w}×{x.enclosure.sizeMm.h}×{x.enclosure.sizeMm.d} mm · {x.enclosure.glands} glands</td>
     <td>{fp.length?fp.map(p=>`${partName(p.kind)}${p.qty>1?` ×${p.qty}`:''} (${p.mount}${p.cableM?`, ${p.cableM} m cable`:''})`).join('; '):'none'}</td></tr>;})}</tbody></table>
  </>}
 </Page>;
}

function TestsPage({ctx,n,d}:{ctx:Ctx;n:number;d:Extract<PageDesc,{kind:'tests'}>}){
 const {spec,refs}=ctx;const ts=spec.tests.slice(...d.lines);const first=d.lines[0];
 const at=(t:typeof ts[number])=>t.nodeId?refs.nodes[t.nodeId]:t.linkId?refs.links[t.linkId]:'all';
 return <Page ctx={ctx} n={n} section="TEST PLAN, SIGN-OFF" title={`Test plan and sign-off${d.chunk?' (cont.)':''}`}>
  <H note="run each test, write the result">TEST PLAN</H>
  {ts.length?<table className="bs-t"><thead><tr><th>ID</th><th>PHASE</th><th>AT</th><th>TEST</th><th>PASS WHEN</th><th>RESULT</th></tr></thead><tbody>
   {ts.map((t,i)=><tr key={t.id}><td className="bs-b bs-mono">T-{String(first+i+1).padStart(2,'0')}</td><td>{t.phase}</td><td className="bs-mono">{at(t)}</td>
    <td><b>{t.title.en}</b><ol className="bs-steps">{t.steps.map((s,j)=><li key={j}>{s.en}</li>)}</ol></td>
    <td>{t.expect.en}{t.measure?<><br/><span className="bs-mono">{t.measure.quantity}{t.measure.min!==undefined?` ≥ ${t.measure.min}`:''}{t.measure.max!==undefined?` ≤ ${t.measure.max}`:''} {t.measure.unit}</span></>:null}</td><td><i className="bs-blank"/></td></tr>)}</tbody></table>:<p className="bs-small">No tests are stored for this revision.</p>}
  {d.last&&<>
   <div className="bs-sign">{['BUILT BY','TESTED BY','ACCEPTED BY · OWNER'].map(t=><div key={t} className="bs-card"><div className="bs-cap">{t}</div>{['Name','Signature','Date'].map(l=><div key={l} className="bs-sline"><span>{l}</span><i className="bs-blank"/></div>)}</div>)}</div>
   <H>REVISIONS</H>
   <table className="bs-t"><thead><tr><th>REV</th><th>DATE</th><th>CHANGE</th><th>BY</th></tr></thead><tbody>
    {(ctx.revisions.length?ctx.revisions:[{revision:ctx.revision,reason:'This revision',by:'AI · '+ctx.model,at:ctx.date}]).slice(-8).map(r=><tr key={r.revision}><td className="bs-b bs-mono">r{r.revision}</td><td className="bs-mono">{isoDate(r.at)}</td><td>{r.reason}</td><td className="bs-mono">{r.by}</td></tr>)}</tbody></table>
  </>}
 </Page>;
}

function UnverifiedPage({ctx,n,d}:{ctx:Ctx;n:number;d:Extract<PageDesc,{kind:'unverified'}>}){
 const items=collectUnverified(ctx.spec,ctx.refs);const sum=verifySummary(ctx.spec,ctx.refs);
 return <Page ctx={ctx} n={n} section="UNVERIFIED ITEMS" title={`Unverified items${d.chunk?' (cont.)':''}`} box={<><b>{items.length} UNVERIFIED</b><div>Wires {sum.wires.total-sum.wires.ok} · links {sum.links.total-sum.links.ok}</div><div>Code {sum.code.total-sum.code.compiled} · power {sum.power.total-sum.power.ok}</div></>}>
  <H note="nothing below is covered by a verifier; check it by hand before fixing">UNVERIFIED ITEMS</H>
  {items.length?<table className="bs-t"><thead><tr><th>TYPE</th><th>REF</th><th>WHERE</th><th>STATE</th><th>REASON</th></tr></thead><tbody>
   {items.slice(...d.lines).map(i=><tr key={i.key}><td>{i.kind}</td><td className="bs-b bs-mono">{i.ref}</td><td>{i.where}</td><td>{i.state}</td><td>{i.reason}</td></tr>)}</tbody></table>
   :<p className="bs-small" data-testid="bs-none-unverified">No unverified items: every wire, link, code file and power budget on this sheet carries a verified stamp from the save gate. Prices and distances are still estimates.</p>}
  <p className="bs-small">Sections that never claim verification: IDR prices (ranges), site distances (sketched), the checklist and the test plan (to be done by a person).</p>
 </Page>;
}

function CodePage({ctx,n,d}:{ctx:Ctx;n:number;d:Extract<PageDesc,{kind:'code'}>}){
 const f=ctx.spec.code[d.fileIndex]!;const g=codeGate(ctx.spec,d.fileIndex);const src=revealHidden(f.content).replace(/\r\n?/g,'\n').replace(/\n$/,'').split('\n');
 const nref=ctx.refs.nodes[f.nodeId]??f.nodeId;
 return <Page ctx={ctx} n={n} section={`APPENDIX A · CODE · ${nref}`} title={`${f.filename}${d.chunks>1?` (${d.chunk+1}/${d.chunks})`:''}`}
  box={<><b>{f.language} · {f.board}</b><div>{g.state==='verified'?'✓ compiled':`unverified · ${g.reason}`}</div><div className="bs-mono">sha {f.verify.sha256.slice(0,12)}</div></>}>
  <p className="bs-small">{f.verify.toolchain} · lines {d.lines[0]}–{d.lines[1]} of {src.length}{f.libraries.length?` · libraries ${f.libraries.map(l=>`${l.name} ${l.version}`).join(', ')}`:''}</p>
  <pre className="bs-code" data-testid="bs-code">{src.slice(d.lines[0]-1,d.lines[1]).map((l,i)=><span key={i} className="bs-ln"><b>{String(d.lines[0]+i).padStart(3,' ')}</b>{l||' '}{'\n'}</span>)}</pre>
 </Page>;
}

// ---------- sheet ----------
export function BuildSheet({spec,projectId,revision,projectName,savedAt,revisions=[],evidence,noSnapshots}:BuildSheetProps){
 const refs=useMemo(()=>displayRefs(spec),[spec]);
 const pages=useMemo(()=>planPages(spec,refs),[spec,refs]);
 const [snaps,setSnaps]=useState<Ctx['snaps']>({});
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(noSnapshots)return;
  let live=true;
  // one WebGL context at a time; yield between nodes so the page stays responsive
  (async()=>{for(const n of spec.nodes){await new Promise(r=>setTimeout(r,0));if(!live)return;let s:Snapshot|null=null;try{s=renderSnapshot(n);}catch{s=null;}setSnaps(p=>({...p,[n.id]:s}));}})();
  return()=>{live=false;};
 },[spec,noSnapshots]);
 const shown:Ctx['snaps']=noSnapshots?Object.fromEntries(spec.nodes.map(n=>[n.id,null])):snaps;
 const ready=spec.nodes.every(n=>shown[n.id]!==undefined);
 const ctx:Ctx={spec,refs,projectId,revision,name:projectName??spec.site.name,date:isoDate(savedAt??spec.meta.generatedAt),model:spec.meta.model,status:titleStatus(evidence),N:pages.length,revisions,snaps:shown};
 return <div className="bs-doc" ref={root} data-testid="build-sheet" data-ready={ready?'1':'0'} data-pages={pages.length} lang="en">
  {pages.map((p,i)=>{const n=i+1,k=`${p.kind}-${i}`;
   switch(p.kind){
    case 'cover':return <Cover key={k} ctx={ctx} n={n}/>;
    case 'schedule':return <SchedulePage key={k} ctx={ctx} n={n} d={p}/>;
    case 'node':return <NodePage key={k} ctx={ctx} n={n} node={nodeOf(spec,p.nodeId)} part={p.part}/>;
    case 'bom':return <BomPage key={k} ctx={ctx} n={n} d={p}/>;
    case 'checks':return <ChecksPage key={k} ctx={ctx} n={n} d={p}/>;
    case 'tests':return <TestsPage key={k} ctx={ctx} n={n} d={p}/>;
    case 'unverified':return <UnverifiedPage key={k} ctx={ctx} n={n} d={p}/>;
    case 'code':return <CodePage key={k} ctx={ctx} n={n} d={p}/>;
   }})}
 </div>;
}
