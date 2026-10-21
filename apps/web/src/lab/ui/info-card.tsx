import {useState} from 'react';
import {useLang} from '../../i18n';
import type {Lesson} from '../lessons';
import type {PinSample} from '../contract';
import {Icon} from './icons';

type Tab='overview'|'pinout'|'code'|'specs';

export function InfoCard({lesson,livePins,pins,done}:{lesson:Lesson;livePins:string[];pins:Record<string,PinSample>|null;done:boolean}){
 const {tr,lang}=useLang();
 const [tab,setTab]=useState<Tab>('overview');
 const [expanded,setExpanded]=useState(false);
 const tabs:{id:Tab;label:string}[]=[
  {id:'overview',label:tr('OVERVIEW','RINGKASAN')},{id:'pinout',label:tr('PINOUT','PINOUT')},
  {id:'code',label:tr('HOW THE CODE WORKS','CARA KERJA KODE')},{id:'specs',label:tr('SPECS','SPESIFIKASI')},
 ];
 return (
  <section className="lab-card lab-info" data-expanded={expanded} data-testid="lab-info">
   <header className="lab-info-head">
    <div><span className="lab-label">{tr('LESSON','PELAJARAN')} {lesson.n}/11</span><h1 className="lab-title">{lesson.title[lang]}</h1><p className="lab-tagline">{lesson.tagline[lang]}</p></div>
    <button type="button" className="lab-iconbtn" aria-label={tr('Expand','Perbesar')} aria-pressed={expanded} onClick={()=>setExpanded(v=>!v)}><Icon name="expand" size={16}/></button>
   </header>
   <div className="lab-tabs" role="tablist">
    {tabs.map(t=><button key={t.id} type="button" role="tab" aria-selected={tab===t.id} data-active={tab===t.id} onClick={()=>setTab(t.id)}>{t.label}</button>)}
   </div>
   <div className="lab-tabpanel" role="tabpanel">
    {tab==='overview'&&<>
     <p>{lesson.overview.body[lang]}</p>
     <ul className="lab-bullets">{lesson.overview.bullets.map((b,i)=><li key={i}><Icon name={b.icon} size={18}/><span>{b.text[lang]}</span></li>)}</ul>
    </>}
    {tab==='pinout'&&<>
     <table className="lab-table"><tbody>{lesson.pinout.map(p=><tr key={p.pin}><th scope="row">{p.pin}</th><td>{p.to[lang]}</td><td>{p.does[lang]}</td></tr>)}</tbody></table>
     {livePins.length>0&&<div className="lab-live">
      <span className="lab-label">{tr('LIVE PINS','PIN LANGSUNG')}</span>
      <div className="lab-live-row">{livePins.map(p=>{
       const s=pins?.[p];
       return <span key={p} className="lab-pin" data-pin={p} data-level={s?s.level:0} data-duty={s?s.duty.toFixed(2):'0.00'}><b>{p}</b><i style={{width:`${Math.round((s?.duty??0)*100)}%`}}/><em>{s?(s.mode==='output'&&s.duty>0&&s.duty<1?`${Math.round(s.duty*100)}%`:s.level?'HIGH':'LOW'):'-'}</em></span>;
      })}</div>
     </div>}
    </>}
    {tab==='code'&&<ol className="lab-steps">{lesson.walkthrough.map((w,i)=><li key={i}>{w[lang]}</li>)}</ol>}
    {tab==='specs'&&<dl className="lab-specs">{lesson.specs.map((s,i)=><div key={i}><dt>{s.k[lang]}</dt><dd>{s.v[lang]}</dd></div>)}</dl>}
   </div>
   <footer className="lab-goal" data-done={done} data-testid="lab-goal">
    <span className="lab-goal-box" aria-hidden="true">{done&&<Icon name="check" size={14}/>}</span>
    <div><strong>{tr('GOAL','TUJUAN')}</strong> {lesson.goal.text[lang]}<small>{done?tr('Done. Nice work.','Selesai. Kerja bagus.'):lesson.goal.hint[lang]}</small></div>
   </footer>
  </section>
 );
}
