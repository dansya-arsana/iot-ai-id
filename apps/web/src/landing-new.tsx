import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpRightIcon,ArrowRightIcon,ArrowLeftIcon,CircuitryIcon} from '@phosphor-icons/react';
import {mountLandingMotion} from './landing-motion';
import {idn} from './indonesia-dots';
import './landing-new.css';
const releases='https://github.com/dansya-arsana/iot-ai-id/releases/tag/v0.1.0-preview.1';
const partnership='/partnership-brief.txt';
type Lang='en'|'id';
const copy={
 en:{
  nav:['Scenarios','Verification','Network'],cta:'Partner with us',menu:'Menu',close:'Close',skip:'Skip to content',loader:'FROM THE FIELD. INTO EVIDENCE.',
  eyebrow:'INDONESIA · REAL-WORLD HARDWARE VERIFICATION',title:['Testing robots','and sensors where','the world is messy.'],
  lead:'Heat, humidity, unstable power and field conditions. Turned into verifiable evidence for robotics and AI teams.',heroCta:'Explore field testing',
  specimens:['Field telemetry node','Tactile sensor module'],renders:'CONCEPT RENDERS · NOT AVAILABLE PRODUCTS',scroll:'SCROLL ↓',
  gapIndex:'01',gapMeta:'THE GAP',gapText:'Robots and hardware agents learn from clean benchmarks and tidy datasheets. Real deployments fail on drift, corrosion, noise and power loss, and that experience is rarely recorded in a form a machine can use.',
  gapTitle:['AI can write firmware.','It has never felt','a monsoon.'],gapMetrics:[['70–90%','RELATIVE HUMIDITY'],['25–35°C','AMBIENT HEAT'],['17,000+','ISLANDS TO REACH']],gapNote:'Typical Indonesian conditions, not test results.',
  atlasEyebrow:'/ 02 SCENARIO ATLAS',atlasTitle:'Real places. Real failure modes.',atlasText:'Indonesian field environments, each described by its conditions and the failures it tends to produce.',
  scenarios:[['Aquaculture ponds','Water quality telemetry over brackish water.',['Humidity','Corrosion','Remote power']],['Greenhouses & plantations','Soil and climate sensing under tropical heat.',['Sensor drift','Heat','Intermittent network']],['Cold-chain & warehouses','Temperature logging across loading and transit.',['Condensation','Door cycles','Battery life']],['Factory floors','Industrial buses and actuators near heavy machinery.',['RS485 noise','Modbus quirks','EMI']],['Smart buildings','Air quality and occupancy in mixed-use spaces.',['Power outages','Firmware crashes','Wi-Fi contention']],['Remote telemetry','Unattended nodes far from the nearest technician.',['Signal loss','Solar power','Physical access']]],
  prev:'Previous scenarios',next:'Next scenarios',
  statsEyebrow:'WHERE WE ARE TODAY',statsTitle:'Built on a real catalog, a defined loop and a growing network.',stats:[['56','Hardware references catalogued'],['6','Field environments mapped'],['4','Steps in every verification'],['3','Planned lab cities']],
  verifyTitle:'Every test leaves evidence behind.',verifyLead:'Hardware, behaviour and environment are written as a machine-checkable contract. Operators install it, the agent runs it, and the outcome is stored, including failures.',
  verifySpec:[['INPUTS','Hardware contract','Pin map','Target environment'],['CAPTURED','Serial output','Measurements','Camera evidence'],['OUTCOMES','Verified','Failed with cause','Recovery history']],
  steps:[['Specify','Contract checked for pins, voltage and bus conflicts.'],['Deploy','Operators follow generated instructions at a bench or site.'],['Execute','Compile, flash, boot and measure.'],['Record','Identity-bound record, pass or fail.']],recordLabel:'EXAMPLE RECORD FORMAT',
  networkEyebrow:'/ 04 VERIFICATION NETWORK',networkTitle:'A DISTRIBUTED LAB',networkText:'Vocational electronics and mechatronics students operate the benches. The software handles instructions, execution and evidence, so every operator produces comparable results.',
  sites:['Bekasi','Bandung','Yogyakarta'],planned:'PLANNED LAB',networkStatus:'Lab benches · field sites · trained operators',networkNote:'Marked cities are planned locations. Site count grows with partner demand.',mapLabel:'Halftone map of Indonesia with three planned lab locations on Java',
  partnerEyebrow:'FOR ROBOTICS, SENSOR & AI TEAMS',partnerTitle:['Bring your hardware','to the real world.'],
  partnerText:'Send us a hand, a sensor or a node. We test it in humid, hot, unstable conditions and return evidence you can use for engineering and training.',
  offers:['Environmental stress testing','Field pilot deployments','Failure and recovery datasets'],partnerCta:'Download partnership brief',
  finalEyebrow:'START A CONVERSATION',finalTitle:'What should your hardware survive?',finalText:'Tell us what you build and the conditions it has to face. We will propose a test plan.',finalCta:'Partner with us',library:'Browse hardware library',
  footer:'Real-world hardware verification from Indonesia.',links:['Hardware library','Docs','Desktop','GitHub'],bottom:'INDONESIA · TESTED WHERE IT MATTERS.'
 },
 id:{
  nav:['Skenario','Verifikasi','Jaringan'],cta:'Jadi partner',menu:'Menu',close:'Tutup',skip:'Lewati ke konten',loader:'DARI LAPANGAN. JADI BUKTI.',
  eyebrow:'INDONESIA · VERIFIKASI HARDWARE DI DUNIA NYATA',title:['Menguji robot','dan sensor di dunia','yang berantakan.'],
  lead:'Panas, lembap, listrik tidak stabil, dan kondisi lapangan. Diubah menjadi bukti terverifikasi untuk tim robotika dan AI.',heroCta:'Lihat uji lapangan',
  specimens:['Node telemetri lapangan','Modul sensor taktil'],renders:'RENDER KONSEP · BUKAN PRODUK YANG DIJUAL',scroll:'GULIR ↓',
  gapIndex:'01',gapMeta:'CELAHNYA',gapText:'Robot dan agent hardware belajar dari benchmark bersih dan datasheet rapi. Deployment nyata gagal karena drift, korosi, noise, dan listrik padam, dan pengalaman itu jarang dicatat dalam bentuk yang bisa dipakai mesin.',
  gapTitle:['AI bisa menulis firmware.','Tapi belum pernah','kena musim hujan.'],gapMetrics:[['70–90%','KELEMBAPAN RELATIF'],['25–35°C','SUHU LINGKUNGAN'],['17.000+','PULAU UNTUK DIJANGKAU']],gapNote:'Kondisi umum di Indonesia, bukan hasil uji.',
  atlasEyebrow:'/ 02 ATLAS SKENARIO',atlasTitle:'Tempat nyata. Mode kegagalan nyata.',atlasText:'Lingkungan lapangan di Indonesia, masing-masing dengan kondisi dan kegagalan yang biasa muncul.',
  scenarios:[['Tambak','Telemetri kualitas air payau.',['Lembap','Korosi','Daya jarak jauh']],['Greenhouse & perkebunan','Sensor tanah dan iklim di panas tropis.',['Drift sensor','Panas','Jaringan putus-putus']],['Cold-chain & gudang','Pencatatan suhu saat bongkar muat dan distribusi.',['Kondensasi','Buka-tutup pintu','Umur baterai']],['Lantai pabrik','Bus industri dan aktuator di dekat mesin berat.',['Noise RS485','Keanehan Modbus','EMI']],['Smart building','Kualitas udara dan okupansi di gedung campuran.',['Listrik padam','Firmware crash','Wi-Fi padat']],['Telemetri jarak jauh','Node tanpa pengawasan, jauh dari teknisi.',['Sinyal hilang','Tenaga surya','Akses fisik']]],
  prev:'Skenario sebelumnya',next:'Skenario berikutnya',
  statsEyebrow:'POSISI KAMI HARI INI',statsTitle:'Dibangun di atas katalog nyata, loop yang jelas, dan jaringan yang tumbuh.',stats:[['56','Referensi hardware terkatalog'],['6','Lingkungan lapangan dipetakan'],['4','Langkah di setiap verifikasi'],['3','Kota lab yang direncanakan']],
  verifyTitle:'Setiap uji meninggalkan bukti.',verifyLead:'Hardware, perilaku, dan lingkungan ditulis sebagai kontrak yang bisa dicek mesin. Operator memasang, agent menjalankan, dan hasilnya disimpan, termasuk kegagalan.',
  verifySpec:[['INPUT','Kontrak hardware','Peta pin','Lingkungan target'],['DIREKAM','Output serial','Pengukuran','Bukti kamera'],['HASIL','Terverifikasi','Gagal beserta penyebab','Riwayat pemulihan']],
  steps:[['Spesifikasi','Kontrak dicek untuk pin, tegangan, dan konflik bus.'],['Pasang','Operator mengikuti instruksi di bench atau lokasi.'],['Jalankan','Compile, flash, boot, dan ukur.'],['Catat','Record terikat identitas, lulus atau gagal.']],recordLabel:'CONTOH FORMAT RECORD',
  networkEyebrow:'/ 04 JARINGAN VERIFIKASI',networkTitle:'LAB TERDISTRIBUSI',networkText:'Siswa SMK elektronika dan mekatronika mengoperasikan bench. Software menangani instruksi, eksekusi, dan bukti, sehingga setiap operator menghasilkan data yang sebanding.',
  sites:['Bekasi','Bandung','Yogyakarta'],planned:'LAB DIRENCANAKAN',networkStatus:'Bench lab · lokasi lapangan · operator terlatih',networkNote:'Kota yang ditandai adalah lokasi rencana. Jumlah lokasi bertambah sesuai kebutuhan partner.',mapLabel:'Peta halftone Indonesia dengan tiga lokasi lab yang direncanakan di Jawa',
  partnerEyebrow:'UNTUK TIM ROBOTIKA, SENSOR & AI',partnerTitle:['Bawa hardware Anda','ke dunia nyata.'],
  partnerText:'Kirim tangan robot, sensor, atau node. Kami uji di kondisi lembap, panas, dan tidak stabil, lalu kembalikan bukti yang bisa dipakai untuk engineering dan training.',
  offers:['Uji stres lingkungan','Pilot deployment lapangan','Dataset kegagalan dan pemulihan'],partnerCta:'Unduh partnership brief',
  finalEyebrow:'MULAI PERCAKAPAN',finalTitle:'Hardware Anda harus bertahan dari apa?',finalText:'Ceritakan apa yang Anda bangun dan kondisi yang harus dihadapinya. Kami usulkan rencana uji.',finalCta:'Jadi partner',library:'Lihat hardware library',
  footer:'Verifikasi hardware di dunia nyata, dari Indonesia.',links:['Hardware library','Dokumentasi','Desktop','GitHub'],bottom:'INDONESIA · DIUJI DI TEMPAT YANG PENTING.'
 }
};
const record=`RECORD   HW-3921 · soil moisture (generic)
BOARD    ESP32 DevKit V1 · ADC GPIO34
SITE     SC-02 · greenhouse bench

3.3V supply ........ PASS
5V output .......... UNSAFE for ESP32 ADC
dry / wet .......... 3180 / 1210

COMPILE ✓  FLASH ✓  BOOT ✓  DATA ✓
STATUS   VERIFIED`;
const ids=['scenarios','verification','network'];
const siteCoords:[number,number][]=[[106.99,-6.24],[107.61,-6.91],[110.37,-7.8]];
const dots=idn.dots.split(' ').map(p=>p.split(',').map(Number) as [number,number]);
const toGrid=([lon,lat]:[number,number])=>[(lon-idn.lon0)/idn.step,(idn.lat1-lat)/idn.step] as const;
function Brand(){return <Link to="/" className="rl-logo" aria-label="iot.ai.id home"><CircuitryIcon size={22} weight="bold"/></Link>;}
function Lines({lines}:{lines:string[]}){return <>{lines.map((l,i)=><span className="rl-line" key={i}>{l}</span>)}</>;}
const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function onceVisible(el:Element|null,fn:()=>void){if(!el)return()=>{};if(reduced()){fn();return()=>{};}const o=new IntersectionObserver(e=>{if(e[0].isIntersecting){fn();o.disconnect();}},{threshold:.4});o.observe(el);return()=>o.disconnect();}
function CountUp({value}:{value:string}){
 const ref=useRef<HTMLSpanElement>(null);const target=Number(value);const[n,setN]=useState(0);
 useEffect(()=>onceVisible(ref.current,()=>{if(reduced())return setN(target);const t0=performance.now();const tick=(t:number)=>{const p=Math.min(1,(t-t0)/1400);setN(Math.round(target*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(tick);};requestAnimationFrame(tick);}),[target]);
 return <span ref={ref} className="rl-num">{n}</span>;
}
function TypedRecord({label}:{label:string}){
 const ref=useRef<HTMLPreElement>(null);const[len,setLen]=useState(0);
 useEffect(()=>onceVisible(ref.current,()=>{if(reduced())return setLen(record.length);let i=0;const id=window.setInterval(()=>{i+=3;setLen(Math.min(i,record.length));if(i>=record.length)clearInterval(id);},24);}),[]);
 return <figure className="rl-record"><figcaption>{label}<i className={len>=record.length?'rl-led on':'rl-led'}/></figcaption><pre ref={ref} aria-label={record}><span aria-hidden="true">{record.slice(0,len)}<b className="rl-caret"/></span></pre></figure>;
}
function HalftoneMap({t}:{t:typeof copy.en}){
 const wrap=useRef<HTMLDivElement>(null);const[cross,setCross]=useState<{x:number,y:number}|null>(null);
 const W=idn.cols+1,H=idn.rows+1;
 return <div ref={wrap} className="rl-map" onPointerMove={e=>{const r=wrap.current!.getBoundingClientRect();setCross({x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H});}} onPointerLeave={()=>setCross(null)}>
  <svg viewBox={`-1 -1 ${W+1} ${H+1}`} role="img" aria-label={t.mapLabel}>
   <g className="rl-map-dots">{dots.map(([c,r],i)=>{const d=cross?Math.hypot(c-cross.x,r-cross.y):99;return <circle key={i} cx={c} cy={r} r={d<4?.4:.27} className={d<4?'hot':''}/>;})}</g>
   {cross&&<g className="rl-cross"><line x1={cross.x} y1={-1} x2={cross.x} y2={H}/><line x1={-1} y1={cross.y} x2={W} y2={cross.y}/><text x={cross.x+.8} y={cross.y-.8}>{(idn.lon0+cross.x*idn.step).toFixed(1)}°E {(idn.lat1-cross.y*idn.step).toFixed(1)}°</text></g>}
   {siteCoords.map((s,i)=>{const[x,y]=toGrid(s);return <g key={i} className="rl-site"><circle cx={x} cy={y} r="1.6" className="ring" style={{animationDelay:`${i*.6}s`}}/><circle cx={x} cy={y} r=".55"/></g>;})}
  </svg>
  <ol className="rl-site-list">{t.sites.map((s,i)=><li key={s}><b>{String(i+1).padStart(2,'0')}</b>{s}<small>{t.planned}</small></li>)}</ol>
 </div>;
}
export function Landing(){
 const root=useRef<HTMLDivElement>(null),header=useRef<HTMLElement>(null),menuButton=useRef<HTMLButtonElement>(null),rail=useRef<HTMLDivElement>(null);const[menu,setMenu]=useState(false);
 const[lang,setLang]=useState<Lang>(()=>localStorage.getItem('iot-lang')==='id'?'id':'en');const t=copy[lang];
 useEffect(()=>{localStorage.setItem('iot-lang',lang);document.documentElement.lang=lang;},[lang]);
 useEffect(()=>root.current?mountLandingMotion(root.current):undefined,[]);
 useEffect(()=>{const outside=(e:PointerEvent)=>{if(e.target instanceof Node&&!header.current?.contains(e.target))setMenu(false);};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&menu){setMenu(false);menuButton.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[menu]);
 const slide=(dir:number)=>{const r=rail.current;if(r)r.scrollBy({left:dir*r.clientWidth*.8,behavior:reduced()?'auto':'smooth'});};
 const toggle=<div className="rl-lang" role="group" aria-label="Language">{(['en','id'] as Lang[]).map(l=><button key={l} aria-pressed={lang===l} onClick={()=>setLang(l)}>{l.toUpperCase()}</button>)}</div>;
 return <div ref={root} className="result-landing">
  <div className="rl-loader" role="status" aria-label="Loading"><span><CircuitryIcon size={36}/>iot.ai.id</span><div className="rl-loader-track"><i/></div><small>{t.loader}</small></div>
  <a className="rl-skip" href="#landing-main">{t.skip}</a>
  <header ref={header} className="rl-header" data-enter><Brand/><nav className="rl-pill-nav" aria-label="Main">{t.nav.map((n,i)=><a key={i} href={`#${ids[i]}`}>{n}</a>)}</nav><div className="rl-header-right">{toggle}<a className="rl-cta-pill" href={partnership} download>{t.cta}</a></div><button ref={menuButton} className="rl-menu-toggle" aria-expanded={menu} aria-controls="landing-menu" onClick={()=>setMenu(!menu)}>{menu?t.close:t.menu}</button>{menu&&<nav id="landing-menu" className="rl-mobile-nav" aria-label="Mobile">{t.nav.map((n,i)=><a key={i} onClick={()=>setMenu(false)} href={`#${ids[i]}`}>{n}</a>)}<a href={partnership} download>{t.cta}</a>{toggle}</nav>}</header>
  <main id="landing-main" tabIndex={-1}>
   <section className="rl-hero" aria-labelledby="landing-title"><img className="rl-capsule" data-enter src="/assets/landing/hero-capsule.png" alt="Concept render: a robotic hand holding an ESP32 board inside a glass test capsule" width="1024" height="1024" fetchPriority="high"/><div className="rl-hero-copy" data-enter><p className="rl-eyebrow">{t.eyebrow}</p><h1 id="landing-title"><Lines lines={t.title}/></h1><p className="rl-hero-description">{t.lead}</p><a className="rl-button rl-button-dark" href={partnership} download>{t.heroCta} <ArrowRightIcon size={18}/></a></div><div className="rl-specimens">{[['FN-01','card-field-node'],['TS-01','card-tactile']].map(([code,img],i)=><figure className="rl-specimen rl-brackets" data-enter key={code}><img src={`/assets/landing/${img}.png`} alt={`Concept render: ${t.specimens[i]}`} width="768" height="1024" loading="lazy"/><figcaption><b>{code}</b><span>{t.specimens[i]}</span></figcaption></figure>)}</div><div className="rl-hero-bottom"><span>{t.renders}</span><a href="#gap">{t.scroll}</a></div></section>

   {/* composition: negantropy-refusal — corner-loaded flipped split with bracketed metrics */}
   <section id="gap" className="rl-section rl-gap"><div className="rl-gap-left" data-reveal><p className="rl-index">( {t.gapIndex} )<i/>{t.gapMeta}</p><p>{t.gapText}</p></div><div className="rl-gap-right" data-reveal><h2><Lines lines={t.gapTitle}/></h2><dl>{t.gapMetrics.map(([v,l])=><div key={l}><dt>[ {v} ]</dt><dd>{l}</dd></div>)}</dl><small>{t.gapNote}</small></div></section>

   {/* composition: vexon-showcase — label left, statement right, over tall bracketed cards */}
   <section id="scenarios" className="rl-section rl-atlas"><div className="rl-showcase-head" data-reveal><p className="rl-eyebrow">{t.atlasEyebrow}</p><div><h2>{t.atlasTitle}</h2><p>{t.atlasText}</p></div></div><div className="rl-rail-controls"><button onClick={()=>slide(-1)} aria-label={t.prev}><ArrowLeftIcon size={18}/></button><button onClick={()=>slide(1)} aria-label={t.next}><ArrowRightIcon size={18}/></button></div><div ref={rail} className="rl-rail" tabIndex={0} aria-label={t.atlasTitle}>{t.scenarios.map(([name,desc,tags],i)=><article className="rl-scenario rl-brackets" key={i}><span className="rl-tag">SC-0{i+1}</span><img src={`/assets/landing/sc-0${i+1}.jpg`} alt="" width="768" height="1024" loading="lazy"/><div><h3>{name as string}</h3><p>{desc as string}</p><ul>{(tags as string[]).map(tag=><li key={tag}>{tag}</li>)}</ul></div></article>)}</div></section>

   {/* composition: lumora-stats — inset inverted panel, corner statement over four-up numerals */}
   <section className="rl-stats-wrap"><div className="rl-stats" data-reveal><p className="rl-eyebrow">• {t.statsEyebrow}</p><h2>{t.statsTitle}</h2><dl>{t.stats.map(([v,l])=><div key={l}><dt><CountUp value={v}/></dt><dd>{l}</dd></div>)}</dl></div></section>

   {/* composition: creative-director-features — heading over divider, lead/spec split, asymmetric card row */}
   <section id="verification" className="rl-section rl-verify"><h2 data-reveal>{t.verifyTitle}</h2><div className="rl-verify-lead" data-reveal><p>{t.verifyLead}</p><dl>{t.verifySpec.map(([k,...v])=><div key={k}><dt>{k}</dt>{v.map(x=><dd key={x}>{x}</dd>)}</div>)}</dl></div><div className="rl-verify-row" data-reveal><TypedRecord label={t.recordLabel}/><ol className="rl-steps">{t.steps.map(([h,p],i)=><li key={i}><span>0{i+1}</span><h3>{h}</h3><p>{p}</p></li>)}</ol></div></section>

   {/* composition: vexon-about — bordered modular ledger grid, with a halftone map cell */}
   <section id="network" className="rl-section rl-network"><div className="rl-ledger" data-reveal><div className="rl-ledger-brand"><CircuitryIcon size={22} weight="bold"/><small>EST. 2026</small></div><div className="rl-ledger-head"><p className="rl-eyebrow">{t.networkEyebrow}</p><h2>{t.networkTitle}</h2></div><div className="rl-ledger-map"><HalftoneMap t={t}/></div><div className="rl-ledger-status"><span className="rl-pulse"/><small>{t.networkStatus}</small></div><div className="rl-ledger-body"><p>{t.networkText}</p><small>{t.networkNote}</small></div></div></section>

   {/* composition: artist-cta — viewport-tall inverted band, copy left, portrait plate right */}
   <section className="rl-section rl-partner"><div data-reveal><p className="rl-eyebrow"><i/>{t.partnerEyebrow}</p><h2><Lines lines={t.partnerTitle}/></h2><p>{t.partnerText}</p><ul>{t.offers.map(o=><li key={o}>{o}</li>)}</ul><a className="rl-button rl-button-light" href={partnership} download>{t.partnerCta} <ArrowUpRightIcon size={18}/></a></div><figure className="rl-portrait" data-reveal><img src="/assets/landing/partner-hand.jpg" alt="Concept render: robotic hand holding a sensor module" width="768" height="1024" loading="lazy"/></figure></section>

   {/* composition: negantropy-persist — centered manifesto stack */}
   <section className="rl-section rl-final" data-reveal><p className="rl-index">( 05 )<i/>{t.finalEyebrow}</p><h2>{t.finalTitle}</h2><p>{t.finalText}</p><div><a className="rl-button rl-button-dark" href={partnership} download>{t.finalCta} <ArrowRightIcon size={18}/></a><Link className="rl-text-link" to="/hardware">{t.library} <ArrowUpRightIcon size={18}/></Link></div></section>
  </main>
  <footer className="rl-footer"><div><span className="rl-wordmark"><CircuitryIcon size={20} weight="bold"/>iot.ai.id</span><p>{t.footer}</p></div><nav aria-label="Footer"><Link to="/hardware">{t.links[0]}</Link><Link to="/docs">{t.links[1]}</Link><a href={releases}>{t.links[2]}</a><a href="https://github.com/dansya-arsana/iot-ai-id">{t.links[3]}</a></nav><div className="rl-footer-bottom"><span>{t.bottom}</span><span>© 2026 iot.ai.id</span></div></footer>
 </div>;
}
