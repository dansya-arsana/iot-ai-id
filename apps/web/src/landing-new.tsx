import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpRightIcon,ArrowRightIcon,CircuitryIcon} from '@phosphor-icons/react';
import {mountLandingMotion} from './landing-motion';
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
  gapEyebrow:'01 / THE GAP',gapTitle:['AI can write firmware.','It has never felt a monsoon.'],
  gapText:'Robots and hardware agents are trained on clean benchmarks and tidy datasheets. Real deployments fail on drift, corrosion, noise and power loss. That experience is rarely recorded in a form a machine can use.',
  gap:[['Lab conditions','Stable power, air conditioning, branded parts and documented pinouts.'],['Field conditions','Voltage drops, 90% humidity, cheap clones, RS485 noise and technicians hours away.'],['What is missing','Verified records that connect a configuration to what actually happened.']],
  atlasEyebrow:'02 / SCENARIO ATLAS',atlasTitle:['Real places.','Real failure modes.'],atlasText:'Indonesian field environments we run tests in, each described by its conditions and the failures it tends to produce.',
  scenarios:[['SC-01','Aquaculture ponds','Water quality telemetry over brackish water.',['Humidity','Corrosion','Remote power']],['SC-02','Greenhouses & plantations','Soil and climate sensing under tropical heat.',['Sensor drift','Heat','Intermittent network']],['SC-03','Cold-chain & warehouses','Temperature logging across loading and transit.',['Condensation','Door cycles','Battery life']],['SC-04','Factory floors','Industrial buses and actuators near heavy machinery.',['RS485 noise','Modbus quirks','EMI']],['SC-05','Smart buildings','Air quality and occupancy in mixed-use spaces.',['Power outages','Firmware crashes','Wi-Fi contention']],['SC-06','Remote telemetry','Unattended nodes far from the nearest technician.',['Signal loss','Solar power','Physical access']]],
  verifyEyebrow:'03 / VERIFICATION LOOP',verifyTitle:['Every test leaves','evidence behind.'],
  steps:[['Specify','Hardware, target behaviour and environment are written as a machine-checkable contract.'],['Deploy','Operators install the setup in a lab bench or field site following generated instructions.'],['Execute','The agent compiles, flashes, boots and measures, capturing serial output and readings.'],['Record','Results, camera evidence and failures are stored as an identity-bound record.']],
  recordLabel:'EXAMPLE RECORD FORMAT',
  networkEyebrow:'04 / VERIFICATION NETWORK',networkTitle:['A distributed lab,','built on local talent.'],
  networkText:'Vocational electronics and mechatronics students operate the benches. The software handles instructions, execution and evidence, so every operator produces comparable results.',
  network:[['Lab benches','Repeatable tests on controlled workstations.'],['Field sites','Long-running deployments in the scenarios above.'],['Operators','Trained technicians who install, observe and report.']],networkNote:'Network map shows the intended structure. Site count grows with partner demand.',
  partnerEyebrow:'FOR ROBOTICS, SENSOR & AI TEAMS',partnerTitle:['Bring your hardware','to the real world.'],
  partnerText:'Send us a hand, a sensor or a node. We test it in humid, hot, unstable conditions and return evidence you can use for engineering and training.',
  offers:['Environmental stress testing','Field pilot deployments','Failure and recovery datasets'],partnerCta:'Download partnership brief',
  finalEyebrow:'START A CONVERSATION',finalTitle:['What should your','hardware survive?'],finalCta:'Partner with us',library:'Browse hardware library',
  footer:'Real-world hardware verification from Indonesia.',links:['Hardware library','Docs','Desktop','GitHub'],bottom:'INDONESIA · TESTED WHERE IT MATTERS.'
 },
 id:{
  nav:['Skenario','Verifikasi','Jaringan'],cta:'Jadi partner',menu:'Menu',close:'Tutup',skip:'Lewati ke konten',loader:'DARI LAPANGAN. JADI BUKTI.',
  eyebrow:'INDONESIA · VERIFIKASI HARDWARE DI DUNIA NYATA',title:['Menguji robot','dan sensor di dunia','yang berantakan.'],
  lead:'Panas, lembap, listrik tidak stabil, dan kondisi lapangan. Diubah menjadi bukti terverifikasi untuk tim robotika dan AI.',heroCta:'Lihat uji lapangan',
  specimens:['Node telemetri lapangan','Modul sensor taktil'],renders:'RENDER KONSEP · BUKAN PRODUK YANG DIJUAL',scroll:'GULIR ↓',
  gapEyebrow:'01 / CELAHNYA',gapTitle:['AI bisa menulis firmware.','Tapi belum pernah kena musim hujan.'],
  gapText:'Robot dan agent hardware dilatih dengan benchmark bersih dan datasheet rapi. Deployment nyata gagal karena drift, korosi, noise, dan listrik padam. Pengalaman itu jarang dicatat dalam bentuk yang bisa dipakai mesin.',
  gap:[['Kondisi lab','Listrik stabil, ber-AC, komponen bermerek, pinout terdokumentasi.'],['Kondisi lapangan','Tegangan turun, kelembapan 90%, komponen clone, noise RS485, teknisi berjam-jam jauhnya.'],['Yang belum ada','Catatan terverifikasi yang menghubungkan konfigurasi dengan apa yang benar-benar terjadi.']],
  atlasEyebrow:'02 / ATLAS SKENARIO',atlasTitle:['Tempat nyata.','Mode kegagalan nyata.'],atlasText:'Lingkungan lapangan di Indonesia tempat kami menguji, masing-masing dengan kondisi dan kegagalan yang biasa muncul.',
  scenarios:[['SC-01','Tambak','Telemetri kualitas air payau.',['Lembap','Korosi','Daya jarak jauh']],['SC-02','Greenhouse & perkebunan','Sensor tanah dan iklim di panas tropis.',['Drift sensor','Panas','Jaringan putus-putus']],['SC-03','Cold-chain & gudang','Pencatatan suhu saat bongkar muat dan distribusi.',['Kondensasi','Buka-tutup pintu','Umur baterai']],['SC-04','Lantai pabrik','Bus industri dan aktuator di dekat mesin berat.',['Noise RS485','Keanehan Modbus','EMI']],['SC-05','Smart building','Kualitas udara dan okupansi di gedung campuran.',['Listrik padam','Firmware crash','Wi-Fi padat']],['SC-06','Telemetri jarak jauh','Node tanpa pengawasan, jauh dari teknisi.',['Sinyal hilang','Tenaga surya','Akses fisik']]],
  verifyEyebrow:'03 / LOOP VERIFIKASI',verifyTitle:['Setiap uji','meninggalkan bukti.'],
  steps:[['Spesifikasi','Hardware, perilaku target, dan lingkungan ditulis sebagai kontrak yang bisa dicek mesin.'],['Pasang','Operator memasang setup di bench lab atau lokasi lapangan sesuai instruksi yang dihasilkan.'],['Jalankan','Agent melakukan compile, flash, boot, dan pengukuran, sambil merekam serial dan pembacaan.'],['Catat','Hasil, bukti kamera, dan kegagalan disimpan sebagai record yang terikat identitas.']],
  recordLabel:'CONTOH FORMAT RECORD',
  networkEyebrow:'04 / JARINGAN VERIFIKASI',networkTitle:['Lab terdistribusi,','dibangun dari talenta lokal.'],
  networkText:'Siswa SMK elektronika dan mekatronika mengoperasikan bench. Software menangani instruksi, eksekusi, dan bukti, sehingga setiap operator menghasilkan data yang sebanding.',
  network:[['Bench lab','Uji berulang di workstation terkontrol.'],['Lokasi lapangan','Deployment jangka panjang di skenario di atas.'],['Operator','Teknisi terlatih yang memasang, mengamati, dan melapor.']],networkNote:'Peta menunjukkan struktur yang direncanakan. Jumlah lokasi bertambah sesuai kebutuhan partner.',
  partnerEyebrow:'UNTUK TIM ROBOTIKA, SENSOR & AI',partnerTitle:['Bawa hardware Anda','ke dunia nyata.'],
  partnerText:'Kirim tangan robot, sensor, atau node. Kami uji di kondisi lembap, panas, dan tidak stabil, lalu kembalikan bukti yang bisa dipakai untuk engineering dan training.',
  offers:['Uji stres lingkungan','Pilot deployment lapangan','Dataset kegagalan dan pemulihan'],partnerCta:'Unduh partnership brief',
  finalEyebrow:'MULAI PERCAKAPAN',finalTitle:['Hardware Anda harus','bertahan dari apa?'],finalCta:'Jadi partner',library:'Lihat hardware library',
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
function Brand(){return <Link to="/" className="rl-logo" aria-label="iot.ai.id home"><CircuitryIcon size={22} weight="bold"/></Link>;}
function Lines({lines}:{lines:string[]}){return <>{lines.map((l,i)=><span className="rl-line" key={i}>{l}</span>)}</>;}
export function Landing(){
 const root=useRef<HTMLDivElement>(null),header=useRef<HTMLElement>(null),menuButton=useRef<HTMLButtonElement>(null);const[menu,setMenu]=useState(false);
 const[lang,setLang]=useState<Lang>(()=>localStorage.getItem('iot-lang')==='id'?'id':'en');const t=copy[lang];
 useEffect(()=>{localStorage.setItem('iot-lang',lang);document.documentElement.lang=lang;},[lang]);
 useEffect(()=>root.current?mountLandingMotion(root.current):undefined,[]);
 useEffect(()=>{const outside=(e:PointerEvent)=>{if(e.target instanceof Node&&!header.current?.contains(e.target))setMenu(false);};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&menu){setMenu(false);menuButton.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[menu]);
 const toggle=<div className="rl-lang" role="group" aria-label="Language">{(['en','id'] as Lang[]).map(l=><button key={l} aria-pressed={lang===l} onClick={()=>setLang(l)}>{l.toUpperCase()}</button>)}</div>;
 return <div ref={root} className="result-landing">
  <div className="rl-loader" role="status" aria-label="Loading"><span><CircuitryIcon size={36}/>iot.ai.id</span><div className="rl-loader-track"><i/></div><small>{t.loader}</small></div>
  <a className="rl-skip" href="#landing-main">{t.skip}</a>
  <header ref={header} className="rl-header" data-enter><Brand/><nav className="rl-pill-nav" aria-label="Main">{t.nav.map((n,i)=><a key={i} href={`#${ids[i]}`}>{n}</a>)}</nav><div className="rl-header-right">{toggle}<a className="rl-cta-pill" href={partnership} download>{t.cta}</a></div><button ref={menuButton} className="rl-menu-toggle" aria-expanded={menu} aria-controls="landing-menu" onClick={()=>setMenu(!menu)}>{menu?t.close:t.menu}</button>{menu&&<nav id="landing-menu" className="rl-mobile-nav" aria-label="Mobile">{t.nav.map((n,i)=><a key={i} onClick={()=>setMenu(false)} href={`#${ids[i]}`}>{n}</a>)}<a href={partnership} download>{t.cta}</a>{toggle}</nav>}</header>
  <main id="landing-main" tabIndex={-1}>
   <section className="rl-hero" aria-labelledby="landing-title"><img className="rl-capsule" data-enter src="/assets/landing/hero-capsule.png" alt="Concept render: a robotic hand holding an ESP32 board inside a glass test capsule" width="1024" height="1024" fetchPriority="high"/><div className="rl-hero-copy" data-enter><p className="rl-eyebrow">{t.eyebrow}</p><h1 id="landing-title"><Lines lines={t.title}/></h1><p className="rl-hero-description">{t.lead}</p><a className="rl-button rl-button-dark" href={partnership} download>{t.heroCta} <ArrowRightIcon size={18}/></a></div><div className="rl-specimens">{[['FN-01','card-field-node'],['TS-01','card-tactile']].map(([code,img],i)=><figure className="rl-specimen" data-enter key={code}><img src={`/assets/landing/${img}.png`} alt={`Concept render: ${t.specimens[i]}`} width="768" height="1024" loading="lazy"/><figcaption><b>{code}</b><span>{t.specimens[i]}</span></figcaption></figure>)}</div><div className="rl-hero-bottom"><span>{t.renders}</span><a href="#gap">{t.scroll}</a></div></section>

   <section id="gap" className="rl-section rl-gap"><div className="rl-intro" data-reveal><p className="rl-eyebrow">{t.gapEyebrow}</p><h2><Lines lines={t.gapTitle}/></h2><p>{t.gapText}</p></div><div className="rl-gap-grid" data-reveal>{t.gap.map(([h,p],i)=><article key={i} className={i===2?'rl-gap-accent':''}><small>0{i+1}</small><h3>{h}</h3><p>{p}</p></article>)}</div></section>

   <section id="scenarios" className="rl-section rl-atlas"><div className="rl-intro" data-reveal><p className="rl-eyebrow">{t.atlasEyebrow}</p><h2><Lines lines={t.atlasTitle}/></h2><p>{t.atlasText}</p></div><div className="rl-atlas-grid">{t.scenarios.map(([code,name,desc,tags],i)=><article className="rl-scenario" data-reveal key={i}><header><b>{code as string}</b><span>ID</span></header><h3>{name as string}</h3><p>{desc as string}</p><ul>{(tags as string[]).map(tag=><li key={tag}>{tag}</li>)}</ul></article>)}</div></section>

   <section id="verification" className="rl-section rl-verify"><div className="rl-intro" data-reveal><p className="rl-eyebrow">{t.verifyEyebrow}</p><h2><Lines lines={t.verifyTitle}/></h2></div><div className="rl-verify-body"><ol className="rl-steps" data-reveal>{t.steps.map(([h,p],i)=><li key={i}><span>0{i+1}</span><div><h3>{h}</h3><p>{p}</p></div></li>)}</ol><figure className="rl-record" data-reveal><figcaption>{t.recordLabel}</figcaption><pre>{record}</pre></figure></div></section>

   <section id="network" className="rl-section rl-network"><div className="rl-intro" data-reveal><p className="rl-eyebrow">{t.networkEyebrow}</p><h2><Lines lines={t.networkTitle}/></h2><p>{t.networkText}</p></div><div className="rl-network-body" data-reveal><svg className="rl-network-map" viewBox="0 0 600 300" role="img" aria-label="Diagram: iot.ai.id verification queue distributing tasks to lab benches and field sites"><g fill="none" stroke="#c9c7c2"><path d="M300 70V130M300 130H110V200M300 130V200M300 130H490V200"/></g><rect x="200" y="30" width="200" height="44" rx="22" fill="#0a0a0a"/><text x="300" y="57" textAnchor="middle" fill="#fff">iot.ai.id · queue</text>{[[110,'LAB BENCH'],[300,'FIELD SITE'],[490,'OPERATOR']].map(([x,l])=><g key={l as string}><rect x={(x as number)-75} y="200" width="150" height="56" rx="10" fill="#fff" stroke="#d6d4cf"/><text x={x as number} y="233" textAnchor="middle" fill="#0a0a0a">{l}</text></g>)}</svg><div className="rl-network-list">{t.network.map(([h,p],i)=><article key={i}><h3>{h}</h3><p>{p}</p></article>)}<small>{t.networkNote}</small></div></div></section>

   <section className="rl-section rl-partner"><div data-reveal><p className="rl-eyebrow">{t.partnerEyebrow}</p><h2><Lines lines={t.partnerTitle}/></h2></div><div data-reveal><p>{t.partnerText}</p><ul>{t.offers.map(o=><li key={o}>{o}</li>)}</ul><a className="rl-button rl-button-light" href={partnership} download>{t.partnerCta} <ArrowUpRightIcon size={18}/></a></div></section>

   <section className="rl-section rl-final" data-reveal><p className="rl-eyebrow">{t.finalEyebrow}</p><h2><Lines lines={t.finalTitle}/></h2><div><a className="rl-button rl-button-dark" href={partnership} download>{t.finalCta} <ArrowRightIcon size={18}/></a><Link className="rl-text-link" to="/hardware">{t.library} <ArrowUpRightIcon size={18}/></Link></div></section>
  </main>
  <footer className="rl-footer"><div><span className="rl-wordmark"><CircuitryIcon size={20} weight="bold"/>iot.ai.id</span><p>{t.footer}</p></div><nav aria-label="Footer"><Link to="/hardware">{t.links[0]}</Link><Link to="/docs">{t.links[1]}</Link><a href={releases}>{t.links[2]}</a><a href="https://github.com/dansya-arsana/iot-ai-id">{t.links[3]}</a></nav><div className="rl-footer-bottom"><span>{t.bottom}</span><span>© 2026 iot.ai.id</span></div></footer>
 </div>;
}
