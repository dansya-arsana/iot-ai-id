import {useLayoutEffect,useRef,useState} from 'react';
import {useLang} from '../../i18n';
import {FLASH_WORDS,UNO_PINS} from '../contract';
import type {FirmwareVariant,LoadReport,PinSample} from '../contract';
import type {Lesson} from '../lessons';
import {LESSONS} from '../lessons';

import {Icon} from './icons';

type Tab='overview'|'pinout'|'code'|'specs'|'firmware';
const FLASH_BYTES=FLASH_WORDS*2-512; // 32,256 B usable (0.5 KB bootloader)
const nf=(n:number)=>n.toLocaleString('en-US');
const hex4=(n:number)=>'0x'+n.toString(16).toUpperCase().padStart(4,'0');

function PinChip({pin,s}:{pin:string;s:PinSample|undefined}){
 const isPin=(UNO_PINS as readonly string[]).includes(pin);
 const pwm=!!s&&isPin&&s.mode==='output'&&s.duty>0.01&&s.duty<0.99;
 const state=!isPin||!s?'static':pwm?'pwm':s.level?'high':'low';
 const attrs=isPin?{'data-pin':pin,'data-level':s?s.level:0,'data-duty':s?s.duty.toFixed(2):'0.00'}:{};
 return (
  <span className="lab-pinchip" data-state={state} {...attrs}>
   {pwm&&<i style={{width:`${Math.round(s.duty*100)}%`}}/>}
   <b>{pin}</b>{pwm&&<em>~ {Math.round(s.duty*100)}%</em>}
  </span>
 );
}

export function InfoCard({lesson,pins,done,quote,variant,report,toolchain}:{
 lesson:Lesson;pins:Record<string,PinSample>|null;done:boolean;quote:string|null;
 variant:FirmwareVariant;report:LoadReport|null;toolchain:string;
}){
 const {tr,lang}=useLang();
 const [tab,setTab]=useState<Tab>('overview');
 const [expanded,setExpanded]=useState(false);
 const tabs:{id:Tab;label:string}[]=[
  {id:'overview',label:tr('Overview','Ringkasan')},{id:'pinout',label:tr('Pinout','Pinout')},
  {id:'code',label:tr('How it works','Cara kerja')},{id:'specs',label:tr('Specs','Spesifikasi')},{id:'firmware',label:tr('Firmware','Firmware')},
 ];
 const list=useRef<HTMLDivElement>(null);
 const [bar,setBar]=useState({x:0,w:0});
 useLayoutEffect(()=>{
  const el=list.current?.querySelector<HTMLElement>('[aria-selected="true"]');
  if(el)setBar({x:el.offsetLeft,w:el.offsetWidth});
 },[tab,lang]);
 const bytes=variant.bytes;
 const sha=variant.sha256;
 return (
  <section className="lab-card lab-info" data-expanded={expanded} data-testid="lab-info">
   <header className="lab-info-head">
    <div>
     <span className="lab-eyebrow">( {String(lesson.n).padStart(2,'0')} / {LESSONS.length} ) ——— {tr('LESSON','PELAJARAN')}</span>
     <h1 className="lab-title">{lesson.title[lang]}</h1><p className="lab-tagline">{lesson.tagline[lang]}</p>
    </div>
    <button type="button" className="lab-iconbtn" aria-label={tr('Expand','Perbesar')} aria-pressed={expanded} onClick={()=>setExpanded(v=>!v)}><Icon name="expand" size={18}/></button>
   </header>
   <div className="lab-tabs" role="tablist" ref={list}>
    {tabs.map(t=><button key={t.id} type="button" role="tab" aria-selected={tab===t.id} data-active={tab===t.id} onClick={()=>setTab(t.id)}>{t.label}</button>)}
    <i className="lab-tab-bar" style={{transform:`translateX(${bar.x}px)`,width:bar.w}}/>
   </div>
   <div className="lab-tabpanel" role="tabpanel" key={tab}>
    {tab==='overview'&&<>
     <p>{lesson.overview.body[lang]}</p>
     <ul className="lab-bullets">{lesson.overview.bullets.map((b,i)=><li key={i}><span className="lab-tile"><Icon name={b.icon} size={18}/></span><span>{b.text[lang]}</span></li>)}</ul>
    </>}
    {tab==='pinout'&&<table className="lab-table"><tbody>{lesson.pinout.map((p,i)=>(
     <tr key={i}><th scope="row">{p.pin.split(' / ').map(x=><PinChip key={x} pin={x} s={pins?.[x]}/>)}</th><td className="lab-to">{p.to[lang]}</td><td>{p.does[lang]}</td></tr>
    ))}</tbody></table>}
    {tab==='code'&&<ol className="lab-steps">{lesson.walkthrough.map((w,i)=><li key={i}>{w[lang]}</li>)}</ol>}
    {tab==='specs'&&<dl className="lab-specs">{lesson.specs.map((s,i)=><div key={i}><dt>{s.k[lang]}</dt><dd>{s.v[lang]}</dd></div>)}</dl>}
    {tab==='firmware'&&<div className="lab-fw" data-testid="lab-firmware">
     <dl className="lab-specs lab-specs--mono">
      <div><dt>{tr('file','berkas')}</dt><dd>{variant.sketch}.hex</dd></div>
      <div><dt>flash</dt><dd>{nf(bytes)} B / {nf(FLASH_BYTES)} B ({(bytes/FLASH_BYTES*100).toFixed(1)}%)</dd></div>
      <div><dt>toolchain</dt><dd>{toolchain}</dd></div>
      <div><dt>sha256</dt><dd title={sha}>{sha.slice(0,8)}…{sha.slice(-4)} <small>({tr('of the source','dari sumber')})</small></dd></div>
     </dl>
     <div className="lab-flashbar" aria-hidden="true"><i style={{width:`${Math.max(1.5,bytes/FLASH_BYTES*100)}%`}}/></div>
     <span className="lab-eyebrow">{tr('PATCHED IN FLASH','DITULIS KE FLASH')}</span>
     {report&&report.patched.length>0
      ?<ul className="lab-patches">{report.patched.map(p=><li key={p.name}><code>{p.name} = {p.value} @ {hex4(p.offset)}</code></li>)}</ul>
      :<p className="lab-muted">{tr('No values patched. This firmware has no parameters.','Tidak ada nilai yang ditulis. Firmware ini tanpa parameter.')}</p>}
    </div>}
   </div>
   <footer className="lab-goal" data-done={done} data-testid="lab-goal">
    <span className="lab-goal-box" aria-hidden="true">{done&&<Icon name="check" size={14}/>}</span>
    <div><strong>{tr('Goal','Tujuan')}</strong><span>{lesson.goal.text[lang]}</span>
     <small>{done?(quote??tr('Done. Nice work.','Selesai. Kerja bagus.')):lesson.goal.hint[lang]}</small></div>
   </footer>
  </section>
 );
}
