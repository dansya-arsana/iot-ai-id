import {useEffect,useState,type FormEvent} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {ArrowUpRightIcon,CheckCircleIcon,WhatsappLogoIcon} from '@phosphor-icons/react';
import {useLang} from '../i18n';
import {PageShell,PARTNERSHIP_BRIEF} from '../site-shell';
import {AnchorButton,Button,Card,EmptyState,Eyebrow,Input,LinkButton,Notice,Select,Spinner,Tag,Textarea} from '../ui';
import {WA_DISPLAY,waLink} from '../contact';
import {track} from '../analytics';
import {fetchCatalog,OpsError,submitInquiry} from '../ops-client';
import {INQUIRY_KINDS,LOCALIZATION_ITEMS,type PublicProduct} from '../../../../packages/ops-contract/index';
import './partner-page.css';

type Kind=typeof INQUIRY_KINDS[number];
const kindCopy:Record<Kind,{en:string;id:string;hintEn:string;hintId:string}>={
 vendor:{en:'Device maker / vendor',id:'Produsen perangkat / vendor',hintEn:'Test, localize and bring your robotics, sensor or IoT hardware to Indonesia.',hintId:'Uji, lokalisasi, dan bawa hardware robotika, sensor, atau IoT Anda ke Indonesia.'},
 school:{en:'School / Lab Mitra',id:'Sekolah / Lab Mitra',hintEn:'SMK training and paid test tasks for your school lab.',hintId:'Pelatihan SMK dan tugas uji berbayar untuk lab sekolah.'},
 buyer:{en:'Buyer / institution',id:'Pembeli / institusi',hintEn:'Buy hardware that has been tested in Indonesian conditions.',hintId:'Beli hardware yang sudah diuji di kondisi Indonesia.'},
 other:{en:'Other',id:'Lainnya',hintEn:'Research, media, investment or anything else.',hintId:'Riset, media, investasi, atau hal lain.'},
};
const empty={name:'',organization:'',email:'',phone:'',country:'',interest:'',message:'',consent:false,website:''};

export function Partner(){
 const{tr,lang}=useLang();const{search}=useLocation();
 const initial=new URLSearchParams(search).get('kind');
 const [kind,setKind]=useState<Kind>((INQUIRY_KINDS as readonly string[]).includes(initial??'')?initial as Kind:'vendor');
 const [form,setForm]=useState(empty);const [busy,setBusy]=useState(false);
 const [errors,setErrors]=useState<Record<string,string>>({});const [failure,setFailure]=useState('');const [done,setDone]=useState<{reference?:string}>();
 const set=(key:keyof typeof empty)=>(e:{target:{value:string}})=>setForm(f=>({...f,[key]:e.target.value}));
 const waText=(ref?:string)=>lang==='id'?`Halo AIoT, saya ${form.name||'…'}${form.organization?` dari ${form.organization}`:''}.${ref?` Referensi inquiry: ${ref}.`:''} ${form.message}`.trim():`Hello AIoT, this is ${form.name||'…'}${form.organization?` from ${form.organization}`:''}.${ref?` Inquiry reference: ${ref}.`:''} ${form.message}`.trim();
 async function submit(event:FormEvent){
  event.preventDefault();setErrors({});setFailure('');
  const local:Record<string,string>={};
  if(form.name.trim().length<2)local.name=tr('Enter your name.','Isi nama Anda.');
  if(!form.email.trim()&&!form.phone.trim())local.email=tr('Give an email or a WhatsApp number.','Isi email atau nomor WhatsApp.');
  if(form.message.trim().length<10)local.message=tr('Tell us a bit more (at least 10 characters).','Ceritakan sedikit lebih banyak (minimal 10 karakter).');
  if(!form.consent)local.consent=tr('Please agree so we can contact you.','Mohon setujui agar kami bisa menghubungi Anda.');
  if(Object.keys(local).length){setErrors(local);return;}
  setBusy(true);
  try{const result=await submitInquiry({...form,kind,source:(window.location.pathname+window.location.search).slice(0,300)});setDone(result);track('lead',{kind});requestAnimationFrame(()=>document.querySelector('.pt-layout')?.scrollIntoView({block:'start'}));}
  catch(error){
   if(error instanceof OpsError&&error.status===400&&error.issues.length){setErrors(Object.fromEntries(error.issues.map(i=>[i.path.split('.')[0]||'message',i.message])));}
   else setFailure(error instanceof OpsError&&error.status===429?tr('Too many submissions from your network. Please message us on WhatsApp instead.','Terlalu banyak pengiriman dari jaringan Anda. Silakan hubungi kami lewat WhatsApp.'):tr('The form could not be sent. Your message is still here; send it on WhatsApp instead.','Form gagal dikirim. Pesan Anda masih ada; kirim lewat WhatsApp saja.'));
  }finally{setBusy(false);}
 }
 const steps=[[tr('We reply within 1 working day','Kami balas dalam 1 hari kerja'),tr('By email or WhatsApp, from the AIoT team in Indonesia.','Lewat email atau WhatsApp, dari tim AIoT di Indonesia.')],[tr('Scoping call','Diskusi kebutuhan'),tr('Hardware, conditions, timeline and data rights.','Hardware, kondisi uji, timeline, dan hak data.')],[tr('Proposal','Proposal'),tr('A test plan, and for vendors a localization and distribution path.','Rencana uji, dan untuk vendor jalur lokalisasi dan distribusi.')]];
 return <PageShell width="wide" eyebrow={tr('PARTNER WITH AIOT','JADI PARTNER AIOT')} title={tr('Tell us what you build.','Ceritakan apa yang Anda bangun.')} lead={tr('Device makers, schools and buyers: one form, a human reply. We test in Indonesian field conditions, localize, distribute and return real-world data.','Produsen perangkat, sekolah, dan pembeli: satu form, dibalas manusia. Kami uji di kondisi lapangan Indonesia, lokalisasi, distribusikan, dan kembalikan data nyata.')}>
  <div className="pt-layout">
   {done?<Card className="pt-done" as="section" aria-live="polite">
     <CheckCircleIcon size={40} weight="fill" aria-hidden="true"/>
     <h2>{tr('Thank you. We have your message.','Terima kasih. Pesan Anda sudah kami terima.')}</h2>
     {done.reference&&<p>{tr('Reference','Referensi')}: <b className="pt-ref">{done.reference}</b></p>}
     <p>{tr('We reply within one working day. Need it faster? Message us on WhatsApp with your reference.','Kami balas dalam satu hari kerja. Perlu lebih cepat? Kirim WhatsApp dengan nomor referensi Anda.')}</p>
     <div className="pt-actions"><AnchorButton href={waLink(waText(done.reference))} data-cta="partner-wa-after" target="_blank" rel="noopener"><WhatsappLogoIcon size={18} aria-hidden="true"/> WhatsApp</AnchorButton><LinkButton variant="secondary" to="/">{tr('Back to home','Kembali ke beranda')}</LinkButton></div>
    </Card>
   :<form className="pt-form" onSubmit={submit} noValidate aria-label={tr('Partner inquiry','Inquiry partner')}>
     <fieldset className="pt-kinds"><legend>{tr('I am a…','Saya adalah…')}</legend>
      {INQUIRY_KINDS.map(k=><label key={k} className={k===kind?'is-active':''}><input type="radio" name="kind" value={k} checked={k===kind} onChange={()=>setKind(k)}/><b>{tr(kindCopy[k].en,kindCopy[k].id)}</b><span>{tr(kindCopy[k].hintEn,kindCopy[k].hintId)}</span></label>)}
     </fieldset>
     {kind==='school'&&<Notice tone="info" title={tr('Indonesian schools','Sekolah di Indonesia')}>{tr('Prices and the Lab Mitra program are on ','Harga dan Program Lab Mitra ada di ')}<Link to="/id">/id</Link>.</Notice>}
     <div className="pt-grid">
      <Input id="pt-name" label={tr('Your name','Nama Anda')} autoComplete="name" required value={form.name} onChange={set('name')} error={errors.name}/>
      <Input id="pt-org" label={tr('Company / school','Perusahaan / sekolah')} autoComplete="organization" value={form.organization} onChange={set('organization')} error={errors.organization}/>
      <Input id="pt-email" type="email" label="Email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email}/>
      <Input id="pt-phone" type="tel" label={tr('WhatsApp number','Nomor WhatsApp')} autoComplete="tel" placeholder="+62 …" value={form.phone} onChange={set('phone')} error={errors.phone}/>
      <Input id="pt-country" label={tr('Country / city','Negara / kota')} autoComplete="country-name" value={form.country} onChange={set('country')} error={errors.country}/>
      <Select id="pt-interest" label={tr('Interested in','Tertarik dengan')} value={form.interest} onChange={set('interest')}>
       <option value="">{tr('Choose…','Pilih…')}</option>
       {[['Field testing','Uji lapangan'],['Localization & distribution','Lokalisasi & distribusi'],['Real-world data','Data lapangan'],['Lab Mitra program','Program Lab Mitra'],['Buying hardware','Membeli hardware']].map(([en,id])=><option key={en} value={en}>{tr(en,id)}</option>)}
      </Select>
     </div>
     <Textarea id="pt-message" label={tr('What should we know?','Apa yang perlu kami ketahui?')} hint={tr('Device, quantities, test conditions, timeline.','Perangkat, jumlah, kondisi uji, timeline.')} rows={6} required value={form.message} onChange={set('message')} error={errors.message}/>
     <div className="pt-honey" aria-hidden="true"><label htmlFor="pt-website">Website</label><input id="pt-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')}/></div>
     <label className="pt-consent"><input type="checkbox" checked={form.consent} onChange={e=>setForm(f=>({...f,consent:e.target.checked}))} aria-invalid={!!errors.consent||undefined}/><span>{tr('AIoT may store these details and contact me about this inquiry. No marketing lists, no resale.','AIoT boleh menyimpan data ini dan menghubungi saya terkait inquiry ini. Tanpa daftar marketing, tidak dijual.')}</span></label>
     {errors.consent&&<p className="pt-error" role="alert">{errors.consent}</p>}
     {failure&&<Notice tone="error" title={tr('Not sent','Belum terkirim')} action={<AnchorButton size="sm" href={waLink(waText())} data-cta="partner-wa-fallback" target="_blank" rel="noopener">WhatsApp</AnchorButton>}>{failure}</Notice>}
     <div className="pt-actions"><Button type="submit" disabled={busy}>{busy?tr('Sending…','Mengirim…'):tr('Send inquiry','Kirim inquiry')}</Button><span className="pt-fine">{tr('Usually answered within 1 working day.','Biasanya dibalas dalam 1 hari kerja.')}</span></div>
    </form>}
   <aside className="pt-aside">
    <Card tone="raised" as="section"><Eyebrow>{tr('What happens next','Langkah berikutnya')}</Eyebrow><ol className="pt-steps">{steps.map(([h,p],i)=><li key={h}><span>0{i+1}</span><div><b>{h}</b><p>{p}</p></div></li>)}</ol></Card>
    <Card as="section"><Eyebrow>{tr('Direct contact','Kontak langsung')}</Eyebrow><p className="pt-fine">{tr('Prefer to talk now?','Mau langsung ngobrol?')}</p>
     <AnchorButton href={waLink(lang==='id'?'Halo AIoT, saya ingin berdiskusi soal kerja sama.':'Hello AIoT, I would like to discuss a partnership.')} data-cta="partner-wa" target="_blank" rel="noopener"><WhatsappLogoIcon size={18} aria-hidden="true"/> WhatsApp {WA_DISPLAY}</AnchorButton>
     <a className="pt-link" href={PARTNERSHIP_BRIEF} download data-cta="partner-brief">{tr('Download the partnership brief','Unduh partnership brief')} <ArrowUpRightIcon size={14}/></a>
     <Link className="pt-link" to="/products">{tr('See tested products','Lihat produk teruji')} <ArrowUpRightIcon size={14}/></Link>
    </Card>
   </aside>
  </div>
 </PageShell>;
}

const itemLabel:Record<typeof LOCALIZATION_ITEMS[number],[string,string]>={sdppi:['SDPPI certification','Sertifikasi SDPPI'],manual_id:['Indonesian manual','Manual Bahasa Indonesia'],warranty:['Local warranty','Garansi lokal'],service_center:['Service center','Service center'],stock:['Local stock','Stok lokal'],pricing:['IDR pricing','Harga Rupiah']};
const statusLabel:Record<string,[string,string]>={testing:['In field testing','Sedang diuji'],localizing:['Localizing','Proses lokalisasi'],available:['Available in Indonesia','Tersedia di Indonesia']};

export function Products(){
 const{tr}=useLang();
 const [products,setProducts]=useState<PublicProduct[]>();const [error,setError]=useState(false);
 useEffect(()=>{fetchCatalog().then(setProducts).catch(()=>setError(true));},[]);
 return <PageShell width="wide" eyebrow={tr('DISTRIBUTION / TESTED IN INDONESIA','DISTRIBUSI / DIUJI DI INDONESIA')} title={tr('Hardware, tested before it ships.','Hardware yang diuji sebelum dijual.')} lead={tr('Partner devices on their way into Indonesia. Each one shows its test status and localization checklist; "Tested in Indonesia" appears only with linked evidence.','Perangkat partner yang sedang masuk ke Indonesia. Setiap produk menampilkan status uji dan checklist lokalisasi; label "Diuji di Indonesia" hanya muncul jika ada bukti tertaut.')} actions={<LinkButton to="/partner?kind=buyer" data-cta="products-quote">{tr('Request a quote','Minta penawaran')}</LinkButton>}>
  {error?<Notice tone="warn" title={tr('Catalog unavailable','Katalog tidak tersedia')}>{tr('The catalog could not be loaded. Please try again later.','Katalog gagal dimuat. Coba lagi nanti.')}</Notice>
  :!products?<div className="pt-loading"><Spinner label={tr('Loading catalog','Memuat katalog')}/></div>
  :!products.length?<EmptyState eyebrow={tr('Catalog','Katalog')} title={tr('No partner products listed yet.','Belum ada produk partner yang tercantum.')} action={<LinkButton to="/partner?kind=vendor" data-cta="products-vendor">{tr('Bring your device to Indonesia','Bawa perangkat Anda ke Indonesia')}</LinkButton>}>{tr('We list a device only after a vendor partnership is signed. Device makers can start with a field test.','Kami mencantumkan perangkat hanya setelah kerja sama vendor ditandatangani. Produsen perangkat bisa mulai dari uji lapangan.')}</EmptyState>
  :<ul className="pt-products">{products.map(p=><li key={p.slug}><Card as="article" className="pt-product">
    <div className="pt-product-head"><Eyebrow as="span">{p.vendor} · {p.category}</Eyebrow>{p.testedInIndonesia&&<Tag tone="ok">{tr('Tested in Indonesia','Diuji di Indonesia')}</Tag>}</div>
    <h2>{p.name}</h2><p>{p.summary}</p>
    <Tag tone={p.status==='available'?'ok':'neutral'}>{tr(...(statusLabel[p.status]??[p.status,p.status]))}</Tag>
    {p.testSummary&&<p className="pt-fine">{p.testSummary}</p>}
    {p.evidence.length>0&&<ul className="pt-evidence">{p.evidence.map(e=><li key={e.url}><a href={e.url} target="_blank" rel="noopener">{e.label} <ArrowUpRightIcon size={12}/></a></li>)}</ul>}
    <ul className="pt-checklist" aria-label={tr('Localization checklist','Checklist lokalisasi')}>{LOCALIZATION_ITEMS.filter(k=>p.localization[k]!=='not_applicable').map(k=><li key={k} data-state={p.localization[k]}>{tr(...itemLabel[k])}</li>)}</ul>
    <div className="pt-actions">{p.priceNote&&<span className="pt-fine">{p.priceNote}</span>}<LinkButton size="sm" variant="secondary" to={`/partner?kind=buyer`} data-cta={`quote-${p.slug}`}>{tr('Request a quote','Minta penawaran')}</LinkButton></div>
   </Card></li>)}</ul>}
 </PageShell>;
}
