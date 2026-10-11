import {useEffect,useState,type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRightIcon,ArrowUpRightIcon,CheckIcon,WhatsappLogoIcon} from '@phosphor-icons/react';
import {DotMark} from '../brand/dot-mark';
import {rememberRegion} from '../region';
import {WA_DISPLAY,waLink} from '../contact';
import {fetchBoard,idr,type BoardRow} from '../ops-client';
export {WA_NUMBER,waLink} from '../contact';
import './landing-id.css';

/** Indonesian ad landing: Program Lab Mitra for SMKs. Every CTA opens WhatsApp with a prefilled message. */

const msg={
 general:'Halo AIoT, saya tertarik dengan Program Lab Mitra untuk sekolah kami. Nama sekolah: … Kota: …',
 guru:'Halo AIoT, saya mau daftar Paket Guru (Rp1.490.000/guru). Nama: … Sekolah: … Jumlah guru: …',
 lab:'Halo AIoT, saya mau daftar Paket Lab Mitra Sekolah (Rp9.900.000). Nama sekolah: … Kota: … Kontak kepala sekolah/guru: …',
 agency:'Halo AIoT, kami agency/yayasan dan ingin paket untuk beberapa sekolah. Lembaga: … Jumlah sekolah: … Wilayah: …',
};

const rates:[string,string,string][]=[
 ['Uji modul dasar','Cek sensor atau board di bench, sekitar 1 jam','Rp75rb–150rb'],
 ['Uji lingkungan & berulang','Panas, lembap, siklus daya, beberapa hari','Rp250rb–500rb'],
 ['Pilot lapangan','Pasang & pantau node di lokasi nyata','Rp1–3 jt / lokasi'],
];
const steps:[string,string][]=[
 ['Daftar via WhatsApp','Pilih paket. Kami kirim penawaran resmi dan invoice atas nama sekolah.'],
 ['Pelatihan 2 hari','Guru dan siswa belajar ESP32, sensor, wiring, dan prosedur uji standar iot.ai.id.'],
 ['Verifikasi lab','Lab sekolah dicek dengan satu tugas uji percobaan. Lulus, lab resmi jadi Lab Mitra.'],
 ['Terima tugas, dibayar','Tugas uji masuk ke dashboard. Hasil diterima, honor dibayar per tugas.'],
];
const packages=[
 {id:'guru',name:'Paket Guru',price:'Rp1.490.000',unit:'/ guru',note:'Untuk guru yang ingin naik kelas di IoT.',
  items:['Pelatihan 2 hari (online live)','Kit ESP32 + sensor dikirim ke sekolah','Sertifikat pelatihan 32 JP dari iot.ai.id','Modul ajar siap pakai di kelas'],cta:'Daftar Paket Guru'},
 {id:'lab',name:'Paket Lab Mitra Sekolah',price:'Rp9.900.000',unit:'/ sekolah',note:'Paket utama. Sekolah langsung bisa menerima tugas uji berbayar.',featured:true,
  items:['Pelatihan 3 guru + 10 siswa operator','5 kit uji (ESP32, sensor, fixture)','Onboarding & verifikasi lab','Akses tugas uji berbayar dari iot.ai.id','Masuk Papan Lab Mitra nasional'],cta:'Daftar Lab Mitra'},
 {id:'agency',name:'Agency & Yayasan',price:'Hubungi kami',unit:'',note:'Untuk dinas, yayasan, atau agency dengan banyak sekolah.',
  items:['Harga khusus multi-sekolah','Pelatihan langsung di lokasi','Koordinator wilayah','Laporan progres per sekolah'],cta:'Minta penawaran'},
] as const;
const audiences:[string,string,string][]=[
 ['Kepala sekolah','Lab yang menghasilkan','Tambahan pemasukan TEFA, portofolio kerja sama industri, dan bahan akreditasi yang jelas.'],
 ['Guru produktif','Keahlian + honor','Sertifikat pelatihan, modul ajar siap pakai, dan 15% honor setiap tugas yang dibimbing.'],
 ['Siswa SMK','Pengalaman kerja nyata','Mengerjakan uji hardware untuk perusahaan sungguhan dan mendapat 60% honor tugas.'],
];
const faq:[string,string][]=[
 ['Uang honor tugas uji datang dari mana?','Perusahaan robotika, sensor, dan AI membayar iot.ai.id untuk menguji hardware mereka di kondisi Indonesia. Pekerjaan uji itu dibagikan ke Lab Mitra, dan honornya kami bayarkan per tugas yang hasilnya diterima.'],
 ['Apakah tugas uji pasti ada setiap bulan?','Tidak kami janjikan jumlah tertentu. Tugas dibagikan bertahap ke lab yang sudah lolos verifikasi, sesuai kebutuhan partner. Tarif per tugas tertulis jelas sebelum tugas diambil.'],
 ['Biaya pelatihan untuk apa saja?','Pelatihan, kit hardware yang menjadi milik sekolah, sertifikat, modul ajar, dan onboarding lab. Tidak ada biaya bulanan.'],
 ['Siswa masih di bawah umur, bagaimana pembayarannya?','Tugas dikerjakan di lab sekolah dengan pendampingan guru. Honor dibayarkan melalui rekening resmi sekolah, lalu dibagikan sesuai porsi: 60% siswa, 25% kas TEFA, 15% guru pembimbing.'],
 ['Apakah sertifikatnya BNSP?','Bukan. Sertifikat diterbitkan oleh iot.ai.id sebagai bukti pelatihan 32 JP. Kami jujur soal ini supaya sekolah bisa memilih dengan tepat.'],
 ['Bisa bayar pakai invoice sekolah?','Bisa. Kami kirim penawaran resmi dan invoice atas nama sekolah untuk keperluan administrasi.'],
];
const split:[string,number][]=[['Siswa operator',60],['Kas TEFA sekolah',25],['Guru pembimbing',15]];
const rp=(n:number)=>'Rp'+n.toLocaleString('id-ID');

function Wa({kind,children,className='lid-btn lid-btn--dark'}:{kind:keyof typeof msg;children:ReactNode;className?:string}){
 return <a className={className} href={waLink(msg[kind])} target="_blank" rel="noopener" data-cta={kind}><WhatsappLogoIcon size={20} weight="fill" aria-hidden="true"/>{children}</a>;
}

export function LandingID(){
 useEffect(()=>rememberRegion('id'),[]);
 const [board,setBoard]=useState<BoardRow[]>([]);
 useEffect(()=>{let live=true;fetchBoard().then(rows=>{if(live)setBoard(rows);}).catch(()=>{/* Board stays on open slots. */});return()=>{live=false;};},[]);
 const slots=Math.max(0,5-board.length);
 const example=150000;
 return <div className="lid">
  <header className="lid-header">
   <Link to="/id" className="lid-brand" aria-label="AIoT Indonesia"><DotMark className="lid-brand-mark" label=""/><span>AIoT</span></Link>
   <nav aria-label="Navigasi halaman"><a href="#cara-kerja">Cara kerja</a><a href="#paket">Paket & harga</a><a href="#papan">Papan</a><a href="#faq">FAQ</a></nav>
   <Link className="lid-global" to="/" onClick={()=>rememberRegion('global')} hrefLang="en">Global site (EN)</Link>
   <Wa kind="general" className="lid-btn lid-btn--dark lid-btn--sm">Daftar</Wa>
  </header>

  <main id="main">
   <section className="lid-hero" aria-labelledby="lid-title">
    <div className="lid-hero-copy">
     <p className="lid-eyebrow"><span className="lid-dot"/>PROGRAM LAB MITRA · KHUSUS SMK · ANGKATAN PERTAMA</p>
     <h1 id="lid-title">Lab SMK Anda bisa <em>dibayar</em> untuk menguji hardware.</h1>
     <p className="lid-lead">Kami latih guru dan siswa IoT, lalu kirim tugas uji hardware dari perusahaan robotika dan sensor ke lab sekolah Anda. Setiap tugas yang lulus dibayar.</p>
     <div className="lid-actions"><Wa kind="lab">Daftar via WhatsApp</Wa><a className="lid-btn lid-btn--line" href="#paket">Lihat paket & harga <ArrowRightIcon size={18}/></a></div>
     <dl className="lid-chips">
      <div><dt>Mulai Rp75.000</dt><dd>honor per tugas uji</dd></div>
      <div><dt>60%</dt><dd>honor untuk siswa</dd></div>
      <div><dt>2 hari</dt><dd>pelatihan sampai siap</dd></div>
     </dl>
    </div>
    <figure className="lid-hero-photo"><img src="/assets/id/student.jpg" alt="Siswa SMK menguji board ESP32 dengan multimeter di bench lab" width="896" height="1120" fetchPriority="high"/>
     <figcaption><span>TUGAS UJI · CONTOH</span><b>HW-3921 · sensor kelembapan tanah</b><span>Honor tugas <strong>Rp150.000</strong> · status LULUS</span></figcaption>
    </figure>
   </section>

   <section className="lid-strip" aria-label="Untuk siapa">{audiences.map(([who,head,text])=><article key={who}><p className="lid-eyebrow">{who.toUpperCase()}</p><h2>{head}</h2><p>{text}</p></article>)}</section>

   <section className="lid-section lid-money" aria-labelledby="lid-money-title">
    <div className="lid-money-head"><p className="lid-eyebrow">UANGNYA DARI MANA?</p><h2 id="lid-money-title">Perusahaan butuh hardware-nya diuji di Indonesia. Lab Anda yang mengerjakan.</h2><p>Robot dan sensor harus tahan panas, lembap, dan listrik tidak stabil. Perusahaan membayar untuk bukti uji nyata, dan pekerjaan itu kami bagikan ke Lab Mitra.</p></div>
    <div className="lid-rates"><table><caption>Tarif honor tugas uji</caption><thead><tr><th scope="col">Jenis tugas</th><th scope="col">Honor</th></tr></thead><tbody>{rates.map(([n,d,p])=><tr key={n}><th scope="row"><b>{n}</b><span>{d}</span></th><td>{p}</td></tr>)}</tbody></table><small>Tarif per tugas yang hasilnya diterima. Jumlah tugas mengikuti kebutuhan partner dan tidak dijamin per bulan.</small></div>
    <div className="lid-split"><p className="lid-eyebrow">CONTOH PEMBAGIAN 1 TUGAS {rp(example).toUpperCase()}</p><div className="lid-bar" role="img" aria-label="60% siswa, 25% kas TEFA, 15% guru">{split.map(([l,p])=><i key={l} style={{flexGrow:p}}/>)}</div><dl>{split.map(([l,p])=><div key={l}><dt>{rp(example*p/100)}</dt><dd>{l} · {p}%</dd></div>)}</dl></div>
   </section>

   <section id="cara-kerja" className="lid-section lid-steps" aria-labelledby="lid-steps-title">
    <div className="lid-steps-head"><p className="lid-eyebrow">CARA KERJA</p><h2 id="lid-steps-title">Dari daftar sampai dibayar, 4 langkah.</h2><img src="/assets/id/teacher.jpg" alt="Guru membimbing dua siswa SMK merakit sensor IoT" width="896" height="1120" loading="lazy"/></div>
    <ol>{steps.map(([h,p],i)=><li key={h}><span>0{i+1}</span><h3>{h}</h3><p>{p}</p></li>)}</ol>
   </section>

   <section id="paket" className="lid-section lid-pricing" aria-labelledby="lid-pricing-title">
    <div className="lid-pricing-head"><p className="lid-eyebrow">PAKET & HARGA</p><h2 id="lid-pricing-title">Sekali bayar. Kit jadi milik sekolah.</h2><p>Sebagai pembanding, pelatihan IoT bersertifikat BNSP di pasaran Rp6–14,5 juta untuk satu orang. Paket Lab Mitra melatih 13 orang dan membuka akses tugas berbayar.</p><img src="/assets/id/kit.png" alt="Kit uji: ESP32, breadboard, sensor DHT22, sensor kelembapan tanah, kabel jumper, dan casing akrilik" width="800" height="800" loading="lazy"/></div>
    <div className="lid-cards">{packages.map(p=><article key={p.id} className={'featured' in p&&p.featured?'lid-card lid-card--featured':'lid-card'}>
     {'featured' in p&&p.featured&&<span className="lid-badge">PAKET UTAMA</span>}
     <h3>{p.name}</h3><p className="lid-price"><b>{p.price}</b>{p.unit&&<span>{p.unit}</span>}</p><p className="lid-card-note">{p.note}</p>
     <ul>{p.items.map(x=><li key={x}><CheckIcon size={16} weight="bold" aria-hidden="true"/>{x}</li>)}</ul>
     <Wa kind={p.id} className={'featured' in p&&p.featured?'lid-btn lid-btn--light':'lid-btn lid-btn--dark'}>{p.cta}</Wa>
    </article>)}</div>
   </section>

   <section id="papan" className="lid-section lid-board" aria-labelledby="lid-board-title">
    <div className="lid-board-head"><p className="lid-eyebrow">PAPAN LAB MITRA 2026</p><h2 id="lid-board-title">{board.length?'Lab Mitra yang sudah lulus verifikasi.':'Peringkat pertama masih kosong.'}</h2><p>Papan ini diisi dari record uji yang benar-benar lulus: jumlah tugas, ketepatan, dan honor yang sudah dibayar. Lab yang bergabung di angkatan pertama punya kesempatan pertama menempati posisi teratas.</p><Wa kind="lab">Ambil slot sekolah Anda</Wa></div>
    <div className="lid-table-wrap"><table className="lid-leader"><thead><tr><th scope="col">#</th><th scope="col">Sekolah</th><th scope="col">Kota</th><th scope="col">Tugas lulus</th><th scope="col">Honor dibayar</th></tr></thead>
     <tbody>{board.map((b,i)=><tr key={b.name}><td>{String(i+1).padStart(2,'0')}</td><td><b>{b.name}</b></td><td>{b.city||'—'}</td><td>{b.passed}</td><td>{idr(b.paidIdr)}</td></tr>)}{Array.from({length:slots},(_,n)=><tr key={'slot'+n}><td>{String(board.length+n+1).padStart(2,'0')}</td><td><span className="lid-slot">Slot terbuka</span></td><td>—</td><td>0</td><td>Rp0</td></tr>)}</tbody></table>
     <small>{board.length?'Hanya sekolah aktif yang setuju ditampilkan. Angka dari tugas yang lolos verifikasi.':'Belum ada lab aktif. Papan diperbarui otomatis setelah lab pertama lolos verifikasi.'}</small></div>
   </section>

   <section id="faq" className="lid-section lid-faq" aria-labelledby="lid-faq-title">
    <div><p className="lid-eyebrow">PERTANYAAN KEPALA SEKOLAH</p><h2 id="lid-faq-title">Yang biasanya ditanyakan dulu.</h2></div>
    <div>{faq.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
   </section>

   <section className="lid-final" aria-labelledby="lid-final-title">
    <DotMark className="lid-final-mark" label=""/>
    <h2 id="lid-final-title">Kuota angkatan pertama terbatas.</h2>
    <p>Chat kami sekarang. Kami balas dengan penawaran resmi untuk sekolah Anda.</p>
    <Wa kind="general" className="lid-btn lid-btn--light">Chat WhatsApp {WA_DISPLAY}</Wa>
    <Link className="lid-final-form" to="/partner?kind=school">Lebih suka isi form? Kirim lewat formulir</Link>
   </section>
  </main>

  <footer className="lid-footer"><span>© 2026 AIoT · iot.ai.id · Program Lab Mitra</span><span>Foto adalah ilustrasi. Sertifikat diterbitkan iot.ai.id, bukan BNSP.</span><Link to="/" onClick={()=>rememberRegion('global')} hrefLang="en">Global site (EN) <ArrowUpRightIcon size={12}/></Link></footer>
  <Wa kind="general" className="lid-btn lid-btn--dark lid-sticky">Daftar via WhatsApp</Wa>
 </div>;
}
