/** Code tab: files per board, highlighted source, copy buttons, compile/gate badges, pin cross-links to the wiring. */
import {useMemo,useState} from 'react';
import {getProState,registerDockTab,useProSpec,useSelection} from '../api/spec-store';
import {blocks,codeSummary,copyAllText,groupFiles,hasHidden,stripHidden,highlight,pinInfos,splitSymbols,type Badge,type FileEntry,type PinInfo} from './model';
import './code.css';

async function copy(text:string):Promise<boolean>{
 try{await navigator.clipboard.writeText(text);return true;}
 catch{
  const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();
  const ok=document.execCommand('copy');t.remove();return ok;
 }
}
function CopyButton({text,label,className='',testId}:{text:string;label:string;className?:string;testId?:string}){
 const [done,setDone]=useState(false);
 return <button type="button" className={`code-copy ${className}`} data-testid={testId} aria-label={label} onClick={async()=>{if(await copy(text)){setDone(true);setTimeout(()=>setDone(false),1400);}}}>{done?'Copied':label}</button>;
}
const Pill=({b,dashed}:{b:Badge;dashed?:boolean})=><span className={`code-pill is-${b.tone}${dashed?' is-dashed':''}`}>{b.label}</span>;

export function CodeTab(){
 const {spec,refs}=useProSpec();
 const {selection,select}=useSelection();
 const groups=useMemo(()=>spec&&refs?groupFiles(spec,refs):[],[spec,refs]);
 const flat=groups.flatMap(g=>g.files);
 const [pick,setPick]=useState<string|null>(null);
 if(!spec||!refs)return <div className="code-empty">No design loaded.</div>;
 if(!flat.length)return <div className="code-empty">This revision has no code yet. Ask the agent to generate firmware.</div>;
 const entry=flat.find(e=>e.file.id===pick)??flat.find(e=>selection?.nodeId===e.file.nodeId||selection?.id===e.file.nodeId)??flat[0];
 const group=groups.find(g=>g.nodeId===entry.file.nodeId)!;
 return <div className="code-tab" data-testid="code-tab">
  <nav className="code-files" aria-label="Code files">
   {groups.map(g=><div key={g.nodeId} className="code-group">
    <div className="code-group-head"><span>{g.ref} · {g.board}</span><CopyButton text={copyAllText(g)} label="Copy all" className="is-ghost" testId={`copy-all-${g.nodeId}`}/></div>
    {g.files.map(e=><button key={e.file.id} type="button" className={`code-file${e.file.id===entry.file.id?' is-active':''}`} data-status={e.file.verify.status} onClick={()=>{setPick(e.file.id);select({kind:'node',id:g.nodeId});}}>
     <span className="code-file-name">{e.file.filename}</span><span className={`code-file-state is-${e.badge.tone}`}>{e.file.verify.status==='compiled'?'built':e.file.verify.status}</span>
    </button>)}
   </div>)}
  </nav>
  <FileView key={entry.file.id} entry={entry} groupRef={group.ref} onWire={(info)=>{if(info.partId)select({kind:'part',id:info.partId,nodeId:entry.file.nodeId});}}/>
 </div>;
}

function FileView({entry,groupRef,onWire}:{entry:FileEntry;groupRef:string;onWire:(i:PinInfo)=>void}){
 const {spec}=useProSpec();
 const f=entry.file;
 const pins=useMemo(()=>pinInfos(spec!,f),[spec,f]);
 const bySymbol=useMemo(()=>new Map(pins.map(p=>[p.symbol,p])),[pins]);
 const symbols=useMemo(()=>new Set(bySymbol.keys()),[bySymbol]);
 const lines=useMemo(()=>highlight(f.content,f.language),[f]);
 const blks=useMemo(()=>blocks(f.content),[f]);
 const blockAt=new Map(blks.map(b=>[b.from,b]));
 const diag=new Map<number,string>();f.verify.diagnostics.forEach(d=>{if(!diag.has(d.line))diag.set(d.line,d.severity);});
 const [hover,setHover]=useState<string|null>(null);
 const hp=hover?bySymbol.get(hover):undefined;
 const errors=f.verify.diagnostics;
 return <section className="code-view" aria-label={f.filename}>
  <header className="code-head">
   <b className="code-title">{f.filename}</b>
   <Pill b={entry.badge}/><Pill b={{label:'not run on hardware',tone:'muted'}} dashed/><Pill b={entry.gate}/>
   <span className="code-meta">{f.language==='arduino-cpp'?'C++':f.language} · {lines.length} lines</span>
   <CopyButton text={stripHidden(f.content)} label="Copy file" className="is-primary" testId="copy-file"/>
  </header>
  {hasHidden(f.content)&&<p className="code-note" role="alert" data-testid="hidden-chars"><b>Hidden characters found.</b> This file has invisible or direction-control characters. They are removed when you copy. Review the file before use.</p>}
  <div className="code-body">
   <div className="code-scroll" role="region" aria-label="Source" tabIndex={0}>
    <pre className="code-src">{lines.map((toks,i)=>{
     const n=i+1,b=blockAt.get(n),sev=diag.get(n);
     return <div key={n} className={`code-line${sev?` has-${sev}`:''}`} data-line={n}>
      <span className="code-ln">{n}</span>
      <span className="code-text">{toks.length?toks.map((t,j)=><span key={j} className={`tk-${t.kind}`}>{splitSymbols(t.text,symbols).map((s,k)=>s.symbol
       ?<a key={k} href={`#wire-${bySymbol.get(s.symbol)?.wireId??''}`} className="code-pin" data-symbol={s.symbol} onMouseEnter={()=>setHover(s.symbol!)} onMouseLeave={()=>setHover(null)} onClick={e=>{e.preventDefault();const i=bySymbol.get(s.symbol!);if(i)onWire(i);}}>{s.text}</a>
       :s.text)}</span>):' '}</span>
      {b&&blks.length>1&&<CopyButton text={stripHidden(b.text)} label="Copy block" className="is-block" testId={`copy-block-${b.from}`}/>}
     </div>;
    })}</pre>
    {hp&&<div className="code-tip" role="tooltip"><span className="code-eyebrow">Hover · {hp.symbol}</span><b>{hp.pin} → {hp.partLabel}{hp.wireId?` · ${hp.wireId}`:''}</b>{hp.note&&<span>{hp.note}</span>}</div>}
   </div>
   <aside className="code-side" aria-label="Build and pins">
    <div className="code-eyebrow">Build · {groupRef}</div>
    <dl className="code-dl">
     <dt>Board</dt><dd>{f.board}</dd><dt>Toolchain</dt><dd>{f.verify.toolchain}</dd>
     {f.verify.bytes!==undefined&&<><dt>Size</dt><dd>{f.verify.bytes.toLocaleString('en-US')} B</dd></>}
     <dt>Checked</dt><dd>{f.verify.at.slice(0,16).replace('T',' ')} UTC</dd>
     {f.libraries.length>0&&<><dt>Libraries</dt><dd>{f.libraries.map(l=><div key={l.name}>{l.name} {l.version}</div>)}</dd></>}
    </dl>
    <div className="code-eyebrow code-eyebrow-pins"><span>Pin cross-check</span><span>{pins.filter(p=>p.wireId).length} / {pins.length} wired</span></div>
    {pins.length===0?<div className="code-muted">No pins referenced.</div>
    :<ul className="code-pins">{pins.map(p=><li key={p.symbol}><button type="button" onClick={()=>onWire(p)} onMouseEnter={()=>setHover(p.symbol)} onMouseLeave={()=>setHover(null)} className={hover===p.symbol?'is-hover':''}>
     <span className="code-pin-sym">{p.symbol}</span><span className="code-pin-gpio">{p.pin}</span><span className="code-pin-w">{p.wireId??'no wire'}</span><span className={p.wireId?'is-ok':'is-warn'}>{p.wireId?'✓':'!'}</span></button></li>)}</ul>}
    {f.verify.status==='failed'||f.verify.status==='pending'
     ?<p className="code-note"><b>{f.verify.status==='failed'?'Build failed.':'Not checked yet.'}</b> Do not flash this file. Ask the agent to fix it and re-verify.</p>
     :<p className="code-note"><b>{f.verify.status==='linted'?'Linted is not tested.':'Compiled is not tested.'}</b> The code {f.verify.status==='linted'?'passes the linter':'builds for this board'}. It has not run on hardware. Flash it, then do the power-up checks.</p>}
   </aside>
  </div>
  <footer className={`code-log${errors.length?' is-error':''}`}>
   {errors.length===0
    ?<span>{f.verify.status==='compiled'||f.verify.status==='linted'?`✓ ${f.verify.toolchain} · ${f.verify.status} with 0 errors${f.verify.bytes?` · ${f.verify.bytes.toLocaleString('en-US')} B`:''}`:'Not checked yet.'}</span>
    :errors.slice(0,3).map((d,i)=><div key={i}>{d.severity} · line {d.line}: {d.message}</div>)}
  </footer>
 </section>;
}

/** Registers the Code tab in the dock (the integrator calls this from the workspace wiring). */
export function registerCodeTab():()=>void{
 return registerDockTab({id:'code',label:'Code',order:20,badge:()=>{const c=getProState().spec?.code;return c?String(c.length):undefined;},render:()=><CodeTab/>});
}

/** Status-bar text, e.g. "Code: 4 compiled · 1 linted · 0 run on hardware". */
export function codeStatusText():string|null{
 const spec=getProState().spec;if(!spec)return null;
 const s=codeSummary(spec);
 return `Code: ${s.compiled} compiled · ${s.linted} linted${s.failed?` · ${s.failed} failed`:''} · ${s.runOnHardware} run on hardware`;
}
export default CodeTab;
