import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useLang} from '../../i18n';
import {LESSONS} from '../lessons';
import type {LabSettings} from '../store';
import {LabGlyph} from './lab-glyph';
import {Icon} from './icons';
import type {Circuit,LessonId} from '../contract';
import {ComponentsPanel} from './components-panel';

type Fly='lessons'|'parts'|'settings'|null;

export function Rail({lesson,done,settings,circuit,focusId,running,onSettings,onLesson,onResetProgress,onFocusPart,onRun,onFlyChange}:{
 lesson:LessonId;done:LessonId[];settings:LabSettings;circuit:Circuit;focusId:string|null;running:boolean;
 onSettings:(s:Partial<LabSettings>)=>void;onLesson:(id:LessonId)=>void;onResetProgress:()=>void;onFocusPart:(id:string)=>void;onRun:()=>void;onFlyChange?:(open:boolean)=>void;
}){
 const {tr,lang}=useLang();
 const [open,setOpen]=useState<Fly>(null);
 const [top,setTop]=useState(60);
 const [expanded,setExpanded]=useState(false);
 const nav=useRef<HTMLElement>(null);
 const toggle=(f:Fly,e:React.MouseEvent<HTMLElement>)=>{setTop(e.currentTarget.offsetTop);setOpen(o=>o===f?null:f);};
 useEffect(()=>{onFlyChange?.(open==='settings'||open==='parts');},[open,onFlyChange]);
 useEffect(()=>{
  if(!open)return;
  const on=(e:PointerEvent)=>{if(nav.current&&!nav.current.contains(e.target as Node))setOpen(null);};
  const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(null);};
  window.addEventListener('pointerdown',on);window.addEventListener('keydown',esc);
  return()=>{window.removeEventListener('pointerdown',on);window.removeEventListener('keydown',esc);};
 },[open]);
 const items:{id:Exclude<Fly,null>;icon:string;label:string}[]=[
  {id:'lessons',icon:'lessons',label:tr('Lessons','Pelajaran')},
  {id:'parts',icon:'parts',label:tr('Components','Komponen')},
 ];
 const settingsLabel=tr('Settings','Setelan');
 return (
  <nav className="lab-rail" ref={nav} aria-label={tr('Lab navigation','Navigasi lab')} data-expanded={expanded}>
   <Link className="lab-rail-btn lab-rail-home" to="/" aria-label={tr('Home','Beranda')} title={tr('Home','Beranda')}><LabGlyph/>{expanded&&<span className="lab-rail-label">{tr('Home','Beranda')}</span>}</Link>
   {items.map(it=>(
    <button key={it.id} type="button" className="lab-rail-btn" data-active={open===it.id} aria-expanded={open===it.id} aria-label={it.label} title={it.label} data-testid={`lab-rail-${it.id}`} onClick={e=>toggle(it.id,e)}>
     <Icon name={it.icon} size={22}/><span className="lab-rail-label">{it.label}</span>
    </button>
   ))}
   <button type="button" className="lab-rail-btn lab-rail-run" data-running={running} aria-pressed={running} aria-label={running?tr('Stop simulation','Hentikan simulasi'):tr('Run simulation','Jalankan simulasi')} title={running?tr('Stop simulation','Hentikan simulasi'):tr('Run simulation','Jalankan simulasi')} data-testid="lab-rail-run" onClick={onRun}>
    <Icon name={running?'stop':'play'} size={22}/><span className="lab-rail-label">{running?tr('Stop','Berhenti'):tr('Run','Jalan')}</span>
   </button>
   <button type="button" className="lab-rail-btn" data-active={open==='settings'} aria-expanded={open==='settings'} aria-label={settingsLabel} title={settingsLabel} data-testid="lab-rail-settings" onClick={e=>toggle('settings',e)}>
    <Icon name="settings" size={22}/><span className="lab-rail-label">{settingsLabel}</span>
   </button>
   <span className="lab-rail-grow"/>
   <button type="button" className="lab-rail-btn lab-rail-expand" aria-pressed={expanded} aria-label={expanded?tr('Collapse sidebar','Ciutkan bilah'):tr('Expand sidebar','Lebarkan bilah')} title={expanded?tr('Collapse sidebar','Ciutkan bilah'):tr('Expand sidebar','Lebarkan bilah')} data-testid="lab-rail-expand" onClick={()=>setExpanded(v=>!v)}>
    <Icon name="chevron" size={20}/>
   </button>
   {open&&(
    <div className="lab-flyout" role="dialog" aria-label={open==='settings'?settingsLabel:items.find(i=>i.id===open)?.label} data-fly={open} style={{top,maxHeight:`calc(100% - ${top}px)`}}>
     <button type="button" className="lab-x" aria-label={tr('Close','Tutup')} onClick={()=>setOpen(null)}><Icon name="close" size={16}/></button>
     {open==='lessons'&&<ul className="lab-fly-list">{LESSONS.map(l=>(
      <li key={l.id}><button type="button" data-active={l.id===lesson} onClick={()=>{onLesson(l.id);setOpen(null);}}>
       <span className="lab-fly-n">{String(l.n).padStart(2,'0')}</span>{l.title[lang]}{done.includes(l.id)&&<Icon name="check" size={14} className="lab-fly-check"/>}
      </button></li>))}</ul>}
     {open==='parts'&&<ComponentsPanel circuit={circuit} active={focusId} onFocus={id=>{onFocusPart(id);setOpen(null);}}/>}
     {open==='settings'&&<><h2 className="lab-set-title">{settingsLabel}</h2><SettingsPanel settings={settings} onSettings={onSettings} onResetProgress={onResetProgress}/></>}
    </div>
   )}
  </nav>
 );
}

export function SettingsPanel({settings,onSettings,onResetProgress}:{settings:LabSettings;onSettings:(s:Partial<LabSettings>)=>void;onResetProgress:()=>void}){
 const {tr}=useLang();
 const sw=(k:'labels'|'grid'|'sound'|'reducedMotion'|'autoRotate',label:string,hint?:string)=>(
  <label className="lab-switch-row"><span>{label}{hint&&<small>{hint}</small>}</span><input className="lab-sw" type="checkbox" role="switch" checked={settings[k]} data-testid={`lab-set-${k}`} aria-label={label} onChange={e=>onSettings({[k]:e.target.checked})}/></label>
 );
 return (
  <div className="lab-fly-settings">
   {sw('labels',tr('Callout labels','Label penjelasan'))}
   {sw('grid',tr('Floor grid','Kisi lantai'))}
   {sw('autoRotate',tr('Turntable','Meja putar'),tr('Auto-rotate when idle','Putar otomatis saat diam'))}
   {sw('sound',tr('Sound','Suara'))}
   {sw('reducedMotion',tr('Reduce motion','Kurangi gerakan'))}
   {settings.sound&&<label className="lab-switch-row"><span>{tr('Volume','Volume')}</span>
    <input className="lab-range" type="range" min={0} max={1} step={0.05} value={settings.volume} aria-label={tr('Volume','Volume')} onChange={e=>onSettings({volume:Number(e.target.value)})}/></label>}
   <button type="button" className="lab-btn-ghost" data-testid="lab-set-reset" onClick={onResetProgress}>{tr('Reset progress','Reset progres')}</button>
  </div>
 );
}
