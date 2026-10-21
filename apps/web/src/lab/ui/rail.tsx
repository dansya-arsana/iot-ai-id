import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useLang} from '../../i18n';
import {LESSONS} from '../lessons';
import {PARTS_COPY} from '../parts-copy';
import type {LabSettings} from '../store';
import {Icon} from './icons';
import {DotMark} from '../../brand/dot-mark';
import type {LessonId} from '../contract';

type Fly='lessons'|'parts'|'settings'|null;

export function Rail({lesson,done,settings,onSettings,onLesson,onResetProgress}:{
 lesson:LessonId;done:LessonId[];settings:LabSettings;
 onSettings:(s:Partial<LabSettings>)=>void;onLesson:(id:LessonId)=>void;onResetProgress:()=>void;
}){
 const {tr,lang}=useLang();
 const [open,setOpen]=useState<Fly>(null);
 const toggle=(f:Fly)=>setOpen(o=>o===f?null:f);
 const items:{id:Fly;icon:string;label:string}[]=[
  {id:'lessons',icon:'lessons',label:tr('Lessons','Pelajaran')},
  {id:'parts',icon:'parts',label:tr('Parts','Komponen')},
  {id:'settings',icon:'settings',label:tr('Settings','Pengaturan')},
 ];
 return (
  <nav className="lab-rail" aria-label={tr('Lab navigation','Navigasi lab')}>
   <Link className="lab-rail-btn lab-rail-home" to="/" aria-label={tr('Home','Beranda')} title={tr('Home','Beranda')}><DotMark/></Link>
   {items.map(it=>(
    <button key={it.id} type="button" className="lab-rail-btn" data-active={open===it.id} aria-expanded={open===it.id} aria-label={it.label} title={it.label} data-testid={`lab-rail-${it.id}`} onClick={()=>toggle(it.id)}>
     <Icon name={it.icon} size={24}/><span className="lab-rail-label">{it.label}</span>
    </button>
   ))}
   {open&&(
    <div className="lab-flyout" role="dialog" aria-label={items.find(i=>i.id===open)?.label}>
     <button type="button" className="lab-x" aria-label={tr('Close','Tutup')} onClick={()=>setOpen(null)}><Icon name="close" size={16}/></button>
     {open==='lessons'&&<ul className="lab-fly-list">{LESSONS.map(l=>(
      <li key={l.id}><button type="button" data-active={l.id===lesson} onClick={()=>{onLesson(l.id);setOpen(null);}}>
       <span className="lab-fly-n">{l.n}</span>{l.title[lang]}{done.includes(l.id)&&<Icon name="check" size={14} className="lab-fly-check"/>}
      </button></li>))}</ul>}
     {open==='parts'&&<ul className="lab-fly-parts">{Object.entries(PARTS_COPY).filter(([k])=>!k.startsWith('uno.')).map(([k,p])=>(
      <li key={k}><strong>{p.name[lang]}</strong><span>{p.desc[lang]}</span></li>))}</ul>}
     {open==='settings'&&<SettingsPanel settings={settings} onSettings={onSettings} onResetProgress={onResetProgress}/>}
    </div>
   )}
  </nav>
 );
}

export function SettingsPanel({settings,onSettings,onResetProgress}:{settings:LabSettings;onSettings:(s:Partial<LabSettings>)=>void;onResetProgress:()=>void}){
 const {tr}=useLang();
 const sw=(k:'labels'|'grid'|'sound'|'reducedMotion'|'autoRotate',label:string)=>(
  <label className="lab-switch-row"><span>{label}</span><input type="checkbox" role="switch" checked={settings[k]} onChange={e=>onSettings({[k]:e.target.checked})}/></label>
 );
 return (
  <div className="lab-fly-settings">
   {sw('labels',tr('Callouts','Penjelasan'))}
   {sw('grid',tr('Grid','Kisi'))}
   {sw('sound',tr('Sound','Suara'))}
   {sw('autoRotate',tr('Auto-rotate','Putar otomatis'))}
   {sw('reducedMotion',tr('Reduce motion','Kurangi gerakan'))}
   <label className="lab-switch-row"><span>{tr('Volume','Volume')}</span>
    <input type="range" min={0} max={1} step={0.05} value={settings.volume} aria-label={tr('Volume','Volume')} onChange={e=>onSettings({volume:Number(e.target.value)})}/></label>
   <button type="button" className="lab-btn-ghost" onClick={onResetProgress}>{tr('Reset progress','Reset progres')}</button>
  </div>
 );
}
