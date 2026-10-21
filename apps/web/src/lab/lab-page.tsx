import './lab.css';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Link,Navigate,useNavigate,useParams} from 'react-router-dom';
import {DotMark} from '../brand/dot-mark';
import {LabGlyph} from './ui/lab-glyph';
import {useLang} from '../i18n';
import {LangToggle} from '../ui';
import {CIRCUITS,UNO_PINS,isLessonId} from './contract';
import type {Circuit,FirmwareVariant,LabRunner,LessonId,LoadReport,ParamValues,PartInput,PartProps,PinSample,SimSnapshot,ViewCommand} from './contract';
import {labFirmware} from './firmware';
import {GOALS} from './goals';
import type {GoalMemory} from './goals';
import {LESSONS} from './lessons';
import {createLabRunner} from './sim';
import * as store from './store';
import type {LabSettings} from './store';
import {Artboard,useViewport} from './ui/artboard';
import {createBuzzerAudio} from './ui/audio';
import type {BuzzerAudio} from './ui/audio';
import {Analyzer} from './ui/analyzer';
import {Callouts} from './ui/callouts';
import {ChipPill} from './ui/chip-pill';
import {CodeView} from './ui/code-view';
import {ControlsDock} from './ui/controls-dock';
import type {Inputs} from './ui/controls-dock';
import type {SceneV2,StageApi} from './ui/frame';
import {Icon} from './ui/icons';
import {InfoCard} from './ui/info-card';
import {Inspector} from './ui/inspector';
import type {InspectTarget} from './ui/inspector';
import {LessonStrip} from './ui/lesson-strip';
import {createPinHistory} from './ui/pin-history';
import {Progress} from './ui/progress';
import {Rail,SettingsPanel} from './ui/rail';
import {Readouts} from './ui/readouts';
import {SerialHeader,SerialLog} from './ui/serial-monitor';
import type {SerialSeg} from './ui/serial-monitor';
import {RECORDS,quoteOf} from './ui/test-record';
import type {TestRecordData} from './ui/test-record';
import {Viewbar} from './ui/viewbar';

interface Runtime{id:LessonId;variantId:string;params:ParamValues;props:Record<string,PartProps>;inputs:Inputs;circuit:Circuit}
interface UiSnap{status:SimSnapshot['status'];simTimeMs:number;currentLine:number|null;pins:Record<string,PinSample>|null;parts:SimSnapshot['parts'];speed:number}
type SceneState='loading'|'ready'|'unavailable';

const EMPTY_UI:UiSnap={status:'idle',simTimeMs:0,currentLine:null,pins:null,parts:{},speed:1};
const toUi=(s:SimSnapshot):UiSnap=>({status:s.status,simTimeMs:s.simTimeMs,currentLine:s.currentLine,pins:s.pins,parts:s.parts,speed:s.speed});
const variantOf=(id:LessonId,variantId:string):FirmwareVariant=>{
 const vs=labFirmware.lessons[id].variants;
 return vs.find(v=>v.id===variantId)??vs[0];
};
function paramsFor(v:FirmwareVariant,from?:ParamValues):ParamValues{
 const out:ParamValues={};
 for(const p of v.params){
  const x=from?.[p.name];
  out[p.name]=typeof x==='number'&&Number.isFinite(x)?Math.min(p.max,Math.max(p.min,x)):p.defaultValue;
 }
 return out;
}
function buildCircuit(id:LessonId,props:Record<string,PartProps>):Circuit{
 const c=structuredClone(CIRCUITS[id]);
 for(const p of c.parts)if(props[p.id])p.props={...p.props,...props[p.id]};
 return c;
}
function openLesson(id:LessonId):Runtime{
 const stored=store.loadLessonValues(id);
 const v=variantOf(id,stored?.variant??'');
 const props=stored?.props??{};
 return {id,variantId:v.id,params:paramsFor(v,stored?.params),props,inputs:stored?.inputs??{},circuit:buildCircuit(id,props)};
}
const nf=(n:number)=>n.toLocaleString('en-US');
const gcc=/avr-gcc [\d.]+/.exec(labFirmware.toolchain)?.[0]??labFirmware.toolchain;
const hex=(n:number)=>'0x'+n.toString(16).toUpperCase().padStart(4,'0');

export function LabPage(){
 const {lesson}=useParams<{lesson?:string}>();
 const [fallback]=useState<LessonId>(()=>store.lastLesson()??'board');
 if(lesson&&!isLessonId(lesson))return <Navigate to="/lab" replace/>;
 const id:LessonId=lesson&&isLessonId(lesson)?lesson:isLessonId(fallback)?fallback:'board';
 return <LabInner id={id}/>;
}
export default LabPage;

function LabInner({id}:{id:LessonId}){
 const idRef=useRef<LessonId>(id);
 useEffect(()=>{idRef.current=id;},[id]);
 const {tr,lang}=useLang();
 const navigate=useNavigate();
 const vp=useViewport();
 const lesson=LESSONS.find(l=>l.id===id)??LESSONS[0];

 const [rt,setRt]=useState<Runtime>(()=>openLesson(id));
 if(rt.id!==id)setRt(openLesson(id));
 const [settings,setSettings]=useState<LabSettings>(store.loadSettings);
 const [done,setDone]=useState<LessonId[]>(store.loadDone);
 const [ui,setUi]=useState<UiSnap>(EMPTY_UI);
 const [selected,setSelected]=useState<InspectTarget|null>(null);
 const [segs,setSegs]=useState<SerialSeg[]>([]);
 const [report,setReport]=useState<LoadReport|null>(null);
 const [lastWrote,setLastWrote]=useState<string|null>(null);
 const [record,setRecord]=useState<TestRecordData|null>(null);
 const [showRecord,setShowRecord]=useState(false);
 const [thumbs,setThumbs]=useState(store.loadThumbs);
 const [sheet,setSheet]=useState(false);
 const [sceneState,setSceneState]=useState<SceneState>('loading');
 const [celebrate,setCelebrate]=useState<LessonId|null>(null);
 const [note,setNote]=useState<string|null>(null);
 const [viewUsed,setViewUsed]=useState(false);
 const [ready,setReady]=useState(false);
 const [error,setError]=useState<string|null>(null);

 const runnerRef=useRef<LabRunner|null>(null);
 const sceneRef=useRef<SceneV2|null>(null);
 const historyRef=useRef(createPinHistory());
 const stageCardRef=useRef<HTMLElement>(null);
 const safeRef=useRef({mobile:vp.mobile,callouts:true});
 const audioRef=useRef<BuzzerAudio|null>(null);
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const stageRef=useRef<HTMLDivElement>(null);
 const rtRef=useRef(rt);
 const settingsRef=useRef(settings);
 const doneRef=useRef(done);
 const snapRef=useRef<SimSnapshot|null>(null);
 const memRef=useRef<GoalMemory>({});
 const segsRef=useRef<SerialSeg[]>([]);
 const dirtyRef=useRef(false);
 const subsRef=useRef(new Set<()=>void>());
 const speedNote=useRef(false);
 const timers=useRef<number[]>([]);
 const handlers=useRef({select:(_t:string|null)=>{},input:(_i:string,_p:PartInput)=>{}});

 useEffect(()=>{rtRef.current=rt;settingsRef.current=settings;doneRef.current=done;});

 const pushSeg=useCallback((sys:boolean,text:string)=>{
  const a=segsRef.current;
  a.push({sys,text,t:runnerRef.current?.snapshot().simTimeMs??0});
  if(a.length>500)a.splice(0,a.length-500);
  dirtyRef.current=true;
 },[]);
 const later=useCallback((fn:()=>void,ms:number)=>{timers.current.push(window.setTimeout(fn,ms));},[]);

 // ---- stage api for overlays ----
 const api=useMemo<StageApi>(()=>({
  subscribe:cb=>{subsRef.current.add(cb);return()=>{subsRef.current.delete(cb);};},
  getScene:()=>sceneRef.current,
  stage:()=>stageRef.current,
  snapshot:()=>snapRef.current,
  history:()=>historyRef.current,
 }),[]);

 // ---- runtime helpers ----
 const loadCurrent=useCallback((r:Runtime)=>{
  const runner=runnerRef.current;
  if(!runner)return null;
  const v=variantOf(r.id,r.variantId);
  try{
   const rep=runner.load(v,r.params,r.circuit,labFirmware.toolchain);
   historyRef.current.reset();setReport(rep);
   for(const [pid,inp] of Object.entries(r.inputs))runner.setInput(pid,inp);
   setError(null);
   return rep;
  }catch(e){setError(e instanceof Error?e.message:String(e));return null;}
 },[]);
 const syncUi=useCallback(()=>{const r=runnerRef.current;if(r){const s=r.snapshot();snapRef.current=s;setUi(toUi(s));}},[]);
 const persist=useCallback((r:Runtime)=>{
  const inputs:Inputs={};
  for(const [k,v] of Object.entries(r.inputs))if(v.kind!=='button')inputs[k]=v;
  store.saveLessonValues(r.id,{variant:r.variantId,params:r.params,props:r.props,inputs});
 },[]);
 const printLoad=useCallback((r:Runtime,rep:NonNullable<ReturnType<typeof loadCurrent>>)=>{
  const v=variantOf(r.id,r.variantId);
  pushSeg(true,`› Firmware ${rep.sketch}.hex · ${rep.bytes} bytes · ${rep.toolchain}\n`);
  for(const p of rep.patched){
   const def=v.params.find(x=>x.name===p.name)?.defaultValue;
   if(def!==p.value){pushSeg(true,`› Wrote ${p.name} = ${p.value} at ${hex(p.offset)}\n`);setLastWrote(`Wrote ${p.name} = ${p.value} at ${hex(p.offset)} · reset`);}
  }
  pushSeg(true,'› Reset ATmega328P @ 16 MHz · running\n');
 },[pushSeg]);

 const run=useCallback(()=>{
  const runner=runnerRef.current;if(!runner)return;
  audioRef.current??=createBuzzerAudio();
  segsRef.current=[];memRef.current={};speedNote.current=false;
  setRecord(null);setShowRecord(false);setLastWrote(null);
  const r=rtRef.current;
  const rep=loadCurrent(r);
  if(!rep)return;
  printLoad(r,rep);
  runner.start();
  syncUi();
  if(window.innerWidth<=760||window.innerHeight<=560)stageCardRef.current?.scrollIntoView({block:'start',behavior:settingsRef.current.reducedMotion?'auto':'smooth'});
 },[loadCurrent,printLoad,syncUi]);
 const stop=useCallback(()=>{runnerRef.current?.stop();syncUi();},[syncUi]);

 const commit=useCallback((next:Runtime,restartMsg=true)=>{
  const wasRunning=runnerRef.current?.snapshot().status==='running';
  rtRef.current=next;setRt(next);persist(next);
  const rep=loadCurrent(next);
  if(rep&&wasRunning){
   if(restartMsg)pushSeg(true,'› Values changed, restarted\n');
   const v=variantOf(next.id,next.variantId);
   for(const p of rep.patched){if(v.params.find(x=>x.name===p.name)?.defaultValue!==p.value){pushSeg(true,`› Wrote ${p.name} = ${p.value} at ${hex(p.offset)}\n`);setLastWrote(`Wrote ${p.name} = ${p.value} at ${hex(p.offset)} · reset`);}}
   runnerRef.current?.start();
  }
  syncUi();
 },[loadCurrent,persist,pushSeg,syncUi]);

 const changeParam=useCallback((name:string,value:number)=>{
  const cur=rtRef.current;
  commit({...cur,params:{...cur.params,[name]:value}});
 },[commit]);
 const changeVariant=useCallback((variantId:string)=>{
  const cur=rtRef.current;
  const v=variantOf(cur.id,variantId);
  commit({...cur,variantId:v.id,params:paramsFor(v,cur.params)});
 },[commit]);
 const changeProps=useCallback((pid:string,props:PartProps)=>{
  const cur=rtRef.current;
  const next:Runtime={...cur,props:{...cur.props,[pid]:props},circuit:{...cur.circuit,parts:cur.circuit.parts.map(p=>p.id===pid?{...p,props}:p)}};
  rtRef.current=next;setRt(next);persist(next);
  runnerRef.current?.setPartProps(pid,props);sceneRef.current?.setPartProps(pid,props);
  setNote(lang==='id'?'Ini perangkat keras, bukan kode':'This is hardware, not code');
  later(()=>setNote(null),3000);
 },[persist,later,lang]);
 const changeInput=useCallback((pid:string,input:PartInput)=>{
  const cur=rtRef.current;
  runnerRef.current?.setInput(pid,input);
  const next:Runtime={...cur,inputs:{...cur.inputs,[pid]:input}};
  rtRef.current=next;setRt(next);persist(next);
 },[persist]);
 const view=useCallback((c:ViewCommand)=>{sceneRef.current?.view(c);setViewUsed(true);},[]);
 const changeSettings=useCallback((s:Partial<LabSettings>)=>{
  setSettings(prev=>{const n={...prev,...s};store.saveSettings(n);return n;});
 },[]);
 const resetProgress=useCallback(()=>{store.resetProgress();setDone([]);},[]);
 const goLesson=useCallback((l:LessonId)=>{navigate('/lab/'+l);},[navigate]);

 useEffect(()=>{
  handlers.current={
   select:t=>{
    if(!t){setSelected(null);return;}
    const isPart=rtRef.current.circuit.parts.some(p=>p.id===t);
    setSelected(isPart?{type:'part',id:t}:{type:'board',id:t});
   },
   input:changeInput,
  };
 },[changeInput]);

 // ---- runner + loop (page lifetime) ----
 useEffect(()=>{
  const runner=createLabRunner();
  runnerRef.current=runner;
  const off=runner.onSerial(chunk=>pushSeg(false,chunk));
  const readyT=window.setTimeout(()=>setReady(true),0);
  let raf=0,last=performance.now(),lastUi=0;
  const loop=(t:number)=>{
   raf=requestAnimationFrame(loop);
   if(document.hidden){last=t;return;}
   const dt=Math.min(100,t-last);last=t;
   const snap=runner.tick(dt);
   snapRef.current=snap;
   historyRef.current.push(snap);
   sceneRef.current?.update(snap,dt);
   for(const cb of subsRef.current)cb();
   const running=snap.status==='running';
   const rts=rtRef.current;
   if(running){
    if(!doneRef.current.includes(rts.id)&&GOALS[rts.id](snap,memRef.current)){
     const nd=store.markDone(rts.id);doneRef.current=nd;setDone(nd);setCelebrate(rts.id);
     timers.current.push(window.setTimeout(()=>setCelebrate(null),1600));
     const v=variantOf(rts.id,rts.variantId);
     const n=LESSONS.find(l=>l.id===rts.id)?.n??0;
     setRecord({lesson:rts.id,n,tMs:snap.simTimeMs,rows:RECORDS[rts.id](historyRef.current,snap),firmware:`${v.sketch} · ${nf(v.bytes)} B · ${gcc}`});
     if(settingsRef.current.reducedMotion)setShowRecord(true);
     else timers.current.push(window.setTimeout(()=>setShowRecord(true),700));
     sceneRef.current?.celebrate?.();
     if(settingsRef.current.sound)audioRef.current?.click(settingsRef.current.volume);
    }
    if(!speedNote.current&&snap.simTimeMs>600&&snap.speed<0.9){
     speedNote.current=true;pushSeg(true,`› Simulation at ${Math.round(snap.speed*100)}% speed\n`);
    }
   }
   const buzzer=Object.values(snap.parts).find(p=>p.kind==='buzzer');
   audioRef.current?.update(running,settingsRef.current.sound,buzzer?.kind==='buzzer'?buzzer.on:false,buzzer?.kind==='buzzer'?buzzer.freqHz:0,settingsRef.current.volume);
   if(t-lastUi>100){
    lastUi=t;
    setUi(toUi(snap));
    if(dirtyRef.current){dirtyRef.current=false;setSegs(segsRef.current.slice());}
   }
  };
  raf=requestAnimationFrame(loop);
  const tm=timers.current;
  return()=>{
   clearTimeout(readyT);cancelAnimationFrame(raf);off();runner.dispose();runnerRef.current=null;setReady(false);
   audioRef.current?.close();audioRef.current=null;
   tm.forEach(x=>clearTimeout(x));tm.length=0;
  };
 },[pushSeg]);

 // ---- lazy 3D scene ----
 useEffect(()=>{
  let cancelled=false;let sc:SceneV2|null=null;
  import('./scene').then(m=>{
   const canvas=canvasRef.current;
   if(cancelled||!canvas)return;
   let made:SceneV2;
   try{
    made=m.createLabScene({
     canvas,settings:{grid:settingsRef.current.grid,autoRotate:settingsRef.current.autoRotate,reducedMotion:settingsRef.current.reducedMotion},
     onSelect:t=>handlers.current.select(t),onHover:()=>undefined,onInput:(pid,i)=>handlers.current.input(pid,i),
    });
   }catch{setSceneState('unavailable');return;}
   sc=made;sceneRef.current=made;
   const r=rtRef.current;made.setLesson(r.id,r.circuit);
   const stage=stageRef.current;
   if(stage)made.resize(stage.clientWidth,stage.clientHeight,window.devicePixelRatio||1);
   made.ready.then(()=>{if(!cancelled)setSceneState('ready');},()=>{if(!cancelled)setSceneState('unavailable');});
  }).catch(()=>{if(!cancelled)setSceneState('unavailable');});
  return()=>{cancelled=true;sc?.dispose();sceneRef.current=null;};
 },[]);

 // keep canvas sized
 useEffect(()=>{
  const stage=stageRef.current;if(!stage)return;
  const apply=()=>sceneRef.current?.resize(stage.clientWidth,stage.clientHeight,(window.devicePixelRatio||1)*(vp.mobile?1:vp.scale));
  apply();
  const ro=new ResizeObserver(apply);ro.observe(stage);
  const t=window.setInterval(apply,1500);
  return()=>{ro.disconnect();clearInterval(t);};
 },[vp.scale,vp.mobile,sceneState]);

 useEffect(()=>{sceneRef.current?.setSettings({grid:settings.grid,autoRotate:settings.autoRotate,reducedMotion:settings.reducedMotion});},[settings.grid,settings.autoRotate,settings.reducedMotion,sceneState]);

 // ---- safe area for the auto-fit camera (feature-detected) ----
 const showCallouts=settings.labels&&sceneState==='ready';
 useEffect(()=>{
  safeRef.current={mobile:vp.mobile,callouts:showCallouts};
  sceneRef.current?.setSafeArea?.(vp.mobile?{top:12,right:12,bottom:12,left:12}:{top:showCallouts?80:20,right:20,bottom:44,left:20});
 },[vp.mobile,vp.artH,vp.scale,showCallouts,sceneState,id]);

 // ---- 3D lesson thumbnails: once after ready, in idle time, cached in sessionStorage ----
 useEffect(()=>{
  if(sceneState!=='ready')return;
  const sc=sceneRef.current;
  if(!sc?.thumbnails)return;
  const have=store.loadThumbs();
  if(LESSONS.every(l=>have[l.id]))return;
  let dead=false;
  const go=()=>{
   // neighbours of the open lesson first, then the rest; each thumbnail lands as soon as it is drawn
   const ids=LESSONS.map(l=>l.id),at=Math.max(0,ids.indexOf(idRef.current));
   const order=[...ids].sort((a,b)=>Math.abs(ids.indexOf(a)-at)-Math.abs(ids.indexOf(b)-at));
   sc.thumbnails?.({width:72,height:60,dpr:Math.min(2,window.devicePixelRatio||1),order,onEach:(tid,url)=>{
    if(dead)return;
    const all={...store.loadThumbs(),[tid]:url};store.saveThumbs(all);setThumbs(all);
   }}).catch(()=>undefined);
  };
  const ric=(window as unknown as {requestIdleCallback?:(f:()=>void,o?:{timeout:number})=>number}).requestIdleCallback;
  const h=ric?ric(go,{timeout:600}):window.setTimeout(go,300);
  return()=>{dead=true;if(!ric)clearTimeout(h);};
 },[sceneState]);

 // ---- open lesson ----
 useEffect(()=>{
  if(!ready)return;
  const r=rtRef.current;
  segsRef.current=[];dirtyRef.current=true;memRef.current={};speedNote.current=false;
  loadCurrent(r);
  sceneRef.current?.setLesson(r.id,r.circuit);
  store.setLastLesson(r.id);
  const stop0=window.setTimeout(()=>{setSelected(null);setNote(null);setRecord(null);setShowRecord(false);setLastWrote(null);syncUi();},0);
  return()=>clearTimeout(stop0);
 },[id,ready,loadCurrent,syncUi]);

 // ---- keyboard ----
 useEffect(()=>{
  const on=(e:KeyboardEvent)=>{
   if(e.metaKey||e.ctrlKey||e.altKey)return;
   const t=e.target as HTMLElement|null;
   const tag=t?.tagName;
   if(e.key==='Escape'){setSelected(null);return;}
   if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||tag==='BUTTON'||t?.isContentEditable)return;
   const k=e.key.toLowerCase();
   if(e.key===' '){e.preventDefault();if(runnerRef.current?.snapshot().status==='running')stop();else run();}
   else if(k==='q')view('rotate-left');
   else if(k==='e')view('rotate-right');
   else if(e.key==='+'||e.key==='=')view('zoom-in');
   else if(e.key==='-'||e.key==='_')view('zoom-out');
   else if(k==='r')view('reset');
  };
  window.addEventListener('keydown',on);
  return()=>window.removeEventListener('keydown',on);
 },[run,stop,view]);

 // ---- derived ----
 const variant=variantOf(rt.id,rt.variantId);
 const running=ui.status==='running';
 const livePins=useMemo(()=>{
  if(rt.id==='board')return ['D13'];
  const set=new Set<string>();
  for(const p of rt.circuit.parts)for(const b of Object.values(p.net))if(b&&(UNO_PINS as readonly string[]).includes(b))set.add(b);
  return [...set];
 },[rt.circuit,rt.id]);
 const overCurrent=Object.values(ui.parts).some(p=>p.kind==='led'&&p.overCurrent);
const scrollTo=(sec:string)=>document.getElementById('lab-sec-'+sec)?.scrollIntoView({behavior:settings.reducedMotion?'auto':'smooth',block:'start'});
 const clearSerial=()=>{segsRef.current=[];setSegs([]);};
 const lanePins=livePins;
 const usesSerial=segs.some(x=>!x.sys);
 const receipt=`${variant.sketch} · ${nf(variant.bytes)} B · ${gcc}`;
 const quote=record&&record.lesson===id?quoteOf(record.rows):null;

 return (
  <div className={`lab${vp.mobile?' lab--mobile':''}${settings.reducedMotion?' lab--reduced':''}`} data-lesson={id} data-sim-status={ui.status} data-sim-ms={Math.round(ui.simTimeMs)} data-scene={sceneState}>
   <Artboard vp={vp}>
    {!vp.mobile&&<Rail lesson={id} done={done} settings={settings} onSettings={changeSettings} onLesson={goLesson} onResetProgress={resetProgress}/>}
    <header className="lab-header">
     <Link to="/" className="lab-wordmark" aria-label={tr('iot.ai.id home','Beranda iot.ai.id')}><LabGlyph/><span>Lab</span></Link>
     <i className="lab-divider" aria-hidden="true"/>
     <span className="lab-sub">UNO · {tr('EMULATED ATMEGA328P','ATMEGA328P TIRUAN')}</span>
     <span className="lab-grow"/>
     <ChipPill running={running} speed={ui.speed} simTimeMs={ui.simTimeMs} compact={vp.mobile}/>
     <Progress done={done} active={id} popped={celebrate}/>
     <LangToggle/>
    </header>
    {vp.mobile&&(
     <div className="lab-mobile-title">
      <span className="lab-eyebrow">( {String(lesson.n).padStart(2,'0')} / 11 ) ——— {tr('LESSON','PELAJARAN')}</span>
      <div className="lab-title">{lesson.title[lang]}</div>
     </div>
    )}
    <section className="lab-stage-card" id="lab-sec-board" ref={stageCardRef} data-running={running} data-sticky={vp.mobile&&running}>
     <div className="lab-stage" ref={stageRef}>
      <canvas ref={canvasRef} className="lab-canvas" aria-label={tr('3D view of the board','Tampilan 3D papan')} role="img"/>
      <div className="lab-atmos" aria-hidden="true"><i className="lab-corner lab-corner--tl"/><i className="lab-corner lab-corner--tr"/><i className="lab-corner lab-corner--bl"/><i className="lab-corner lab-corner--br"/></div>
      {sceneState==='loading'&&<div className="lab-loader"><DotMark animated/><div className="lab-loader-bar"><i/></div><span>{tr('Soldering the board…','Menyolder papan…')}</span></div>}
      {sceneState==='unavailable'&&<p className="lab-3d-note" role="status">{tr('3D view unavailable on this device. The simulation still runs.','Tampilan 3D tidak tersedia di perangkat ini. Simulasi tetap berjalan.')}</p>}
      <Callouts lesson={lesson} api={api} pills={vp.mobile} show={showCallouts} running={running} compact={vp.compact}/>
      <Readouts lessonId={id} api={api}/>
      {selected&&<Inspector target={selected} lesson={lesson} lessonId={id} circuit={rt.circuit} variantId={rt.variantId} params={rt.params} overCurrent={overCurrent} api={api}
       onClose={()=>setSelected(null)} onParam={changeParam} onVariant={changeVariant} onProps={changeProps} onInput={changeInput} onFocus={t=>sceneRef.current?.focus(t)}/>}
      <ControlsDock circuit={rt.circuit} inputs={rt.inputs} onInput={changeInput}/>
      <Viewbar onView={view} used={viewUsed}/>
      {error&&<p className="lab-error" role="alert">{error}</p>}
     </div>
     <Analyzer api={api} lessonId={id} lanePins={lanePins} tx={usesSerial} status={ui.status} simTimeMs={ui.simTimeMs} speed={ui.speed} pins={ui.pins}
      segs={segs} onClear={clearSerial} record={record&&record.lesson===id?record:null} showRecord={showRecord} onShowSignals={()=>setShowRecord(false)} marker={record&&record.lesson===id?record.tMs:null}
      receipt={receipt} compact={vp.compact} mobile={vp.mobile} reduced={settings.reducedMotion}/>
    </section>
    <LessonStrip active={id} done={done} celebrate={celebrate} thumbs={thumbs} reduced={settings.reducedMotion} onPick={goLesson}/>
    <aside className="lab-side">
     <InfoCard lesson={lesson} pins={ui.pins} done={done.includes(id)} quote={quote} variant={variant} report={report} toolchain={labFirmware.toolchain}/>
     <CodeView variant={variant} params={rt.params} currentLine={ui.currentLine} running={running} onRun={run} onStop={stop} onParam={name=>setSelected({type:'param',name})} note={note} log={lastWrote}/>
    </aside>
    {vp.mobile&&(
     <section className="lab-card lab-serial-card" id="lab-sec-serial">
      <SerialHeader running={running} onClear={clearSerial}/>
      <SerialLog segments={segs}/>
     </section>
    )}
   </Artboard>
   {vp.mobile&&(
    <>
     {sheet&&<div className="lab-scrim" onClick={()=>setSheet(false)}/>}
     {sheet&&(
      <div className="lab-sheet" role="dialog" aria-label={tr('Settings','Setelan')}>
       <div className="lab-sheet-head"><strong>{tr('Settings','Setelan')}</strong><button type="button" className="lab-iconbtn" aria-label={tr('Close','Tutup')} onClick={()=>setSheet(false)}><Icon name="close" size={18}/></button></div>
       <SettingsPanel settings={settings} onSettings={changeSettings} onResetProgress={resetProgress}/>
      </div>
     )}
     <nav className="lab-tabbar" aria-label={tr('Sections','Bagian')}>
      {([['lessons','lessons',tr('Lessons','Pelajaran')],['board','board',tr('Board','Papan')],['code','code',tr('Code','Kode')],['serial','serial',tr('Serial','Serial')]] as const).map(([sec,icon,label])=>(
       <button key={sec} type="button" onClick={()=>scrollTo(sec)}><Icon name={icon} size={22}/><span>{label}</span></button>
      ))}
      <button type="button" data-testid="lab-rail-settings" aria-expanded={sheet} aria-label={tr('Settings','Setelan')} onClick={()=>setSheet(v=>!v)}><Icon name="settings" size={22}/><span>{tr('Settings','Setelan')}</span></button>
     </nav>
    </>
   )}
  </div>
 );
}
