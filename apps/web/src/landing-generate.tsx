/** Landing: the "describe it, we design it" entry under the hero map. A brief typed here is handed to /pro through sessionStorage (never the URL) and prefilled, not sent. */
import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ArrowRightIcon} from '@phosphor-icons/react';
import {useLang} from './i18n';

export const BRIEF_KEY='aiot:brief';
const copy={
 en:{index:'›',meta:'GENERATE',title:['Describe your device.','We design the system.'],
  lead:'One sentence is enough. The agent picks verified parts, wires each node, writes the firmware, sizes the power and draws a carrier board you can order, then a local lab builds and tests it.',
  label:'Describe your device',placeholder:'Soil moisture + automatic watering, 4 melon beds in Bogor, solar power',go:'Start a design',
  examples:['Water quality telemetry for a shrimp pond, LoRa','Greenhouse climate node with a pump relay, Wi-Fi','Cold-room temperature logger with SMS alert'],
  stages:['Brief','Parts','Wiring','Code','Board','Build Sheet','Field'],
  note:'Pro is invitation-only for now. Checks, exports and downloads are free; you see the agent cost before each run.'},
 id:{index:'›',meta:'GENERATE',title:['Ceritakan alatnya.','Kami rancang sistemnya.'],
  lead:'Satu kalimat cukup. Agent memilih part terverifikasi, merangkai tiap node, menulis firmware, menghitung daya, dan menggambar carrier board yang bisa dipesan, lalu lab lokal merakit dan mengujinya.',
  label:'Ceritakan alat Anda',placeholder:'Kelembapan tanah + siram otomatis, 4 bedeng melon di Bogor, listrik solar',go:'Mulai desain',
  examples:['Telemetri kualitas air tambak udang, LoRa','Node iklim greenhouse dengan relay pompa, Wi-Fi','Logger suhu cold-room dengan alarm SMS'],
  stages:['Brief','Part','Wiring','Kode','Board','Build Sheet','Lapangan'],
  note:'Pro masih khusus undangan. Cek, export, dan download gratis; biaya agent tampil sebelum tiap run.'}
};

export function GenerateEntry(){
 const{lang}=useLang();const t=copy[lang];const nav=useNavigate();
 const[text,setText]=useState('');
 const go=()=>{const b=text.trim();try{if(b)sessionStorage.setItem(BRIEF_KEY,b.slice(0,2000));}catch{/* storage blocked: /pro opens empty */}nav('/pro');};
 return <section id="generate" className="rl-section rl-generate" aria-labelledby="generate-title">
  <div className="rl-generate-head" data-reveal>
   <p className="rl-index">( {t.index} )<i/>{t.meta}</p>
   <h2 id="generate-title">{t.title.map(l=><span className="rl-line" key={l}>{l}</span>)}</h2>
   <p>{t.lead}</p>
  </div>
  <div className="rl-generate-box rl-brackets" data-reveal>
   <form onSubmit={e=>{e.preventDefault();go();}}>
    <label htmlFor="generate-brief" className="rl-eyebrow">› {t.label}</label>
    <textarea id="generate-brief" rows={2} maxLength={2000} value={text} placeholder={t.placeholder} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();go();}}} data-testid="landing-brief"/>
    <div className="rl-generate-row">
     <ul aria-label="Examples">{t.examples.map(x=><li key={x}><button type="button" onClick={()=>setText(x)}>{x}</button></li>)}</ul>
     <button type="submit" className="rl-button rl-button-dark" data-cta="generate-start">{t.go} <ArrowRightIcon size={16} weight="bold"/></button>
    </div>
   </form>
   <ol className="rl-generate-stages">{t.stages.map((s,i)=><li key={s}><span>{String(i+1).padStart(2,'0')}</span>{s}</li>)}</ol>
   <small>{t.note}</small>
  </div>
 </section>;
}
