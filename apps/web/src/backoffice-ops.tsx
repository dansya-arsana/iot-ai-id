/** Backoffice business panels: inquiry inbox, organizations (vendors, schools, buyers), distributor products, Lab Mitra tasks and payouts. */
import {useCallback,useEffect,useMemo,useState,type FormEvent,type ReactNode} from 'react';
import {useLang} from './i18n';
import {Button,Eyebrow,Input,Notice,Select,Stat,StatGrid,Tag,Textarea} from './ui';
import {idr,opsAdmin,type Me,type PayoutRow,type Summary,type TaskRow} from './ops-client';
import {CHECK_STATES,INQUIRY_STATUSES,LOCALIZATION_ITEMS,ORG_STATUSES,ORG_TYPES,PRODUCT_STATUSES,SCHOOL_PACKAGES,type Inquiry,type Organization,type Product} from '../../../packages/ops-contract/index';

export const opsSections=[
 {hash:'#bo-inquiries',en:'Inquiries',id:'Inquiry'},
 {hash:'#bo-orgs',en:'Organizations',id:'Organisasi'},
 {hash:'#bo-products',en:'Products',id:'Produk'},
 {hash:'#bo-tasks',en:'Lab tasks & payouts',id:'Tugas lab & payout'},
];
async function fetchAll():Promise<Data>{const [me,summary,inquiries,orgs,products,tasks,payouts]=await Promise.all([opsAdmin.me(),opsAdmin.summary(),opsAdmin.inquiries(),opsAdmin.organizations(),opsAdmin.products(),opsAdmin.tasks(),opsAdmin.payouts()]);return{me,summary,inquiries,orgs,products,tasks,payouts};}
type Data={me:Me;summary:Summary;inquiries:Inquiry[];orgs:Organization[];products:Product[];tasks:TaskRow[];payouts:{payouts:PayoutRow[];totals:{dueIdr:number;paidIdr:number}}};
const when=(iso:string,locale:string)=>new Date(iso).toLocaleString(locale,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const tone=(status:string):'ok'|'warn'|'error'|'neutral'=>['won','active','available','verified','paid','done'].includes(status)?'ok':['new','submitted','in_progress','testing','localizing','proposal'].includes(status)?'warn':['lost','spam','rejected','ended','discontinued'].includes(status)?'error':'neutral';

function Section({id,eyebrow,title,aside,children}:{id:string;eyebrow:ReactNode;title:ReactNode;aside?:ReactNode;children:ReactNode}){
 return <section id={id} className="bo-panel bo-wide bo-ops"><div className="bo-panel-head"><div><Eyebrow>{eyebrow}</Eyebrow><h2>{title}</h2></div>{aside&&<div className="bo-panel-aside">{aside}</div>}</div>{children}</section>;
}

export function BusinessOps(){
 const{tr,lang}=useLang();const locale=lang==='id'?'id-ID':'en-GB';
 const [data,setData]=useState<Data>();const [error,setError]=useState('');const [notice,setNotice]=useState<{tone:'ok'|'error';text:string}>();
 const load=useCallback(()=>fetchAll().then(next=>{setData(next);setError('');}).catch(e=>setError(e instanceof Error?e.message:String(e))),[]);
 useEffect(()=>{let live=true;fetchAll().then(next=>{if(!live)return;setData(next);// Ops panels load after the first paint and push later sections down, so re-apply any section hash.
 const hash=window.location.hash;if(/^#bo-[a-z-]+$/.test(hash))requestAnimationFrame(()=>document.querySelector(hash)?.scrollIntoView());}).catch(e=>{if(live)setError(e instanceof Error?e.message:String(e));});return()=>{live=false;};},[]);
 const run=useCallback(async(action:()=>Promise<unknown>,ok:string)=>{setNotice(undefined);try{await action();setNotice({tone:'ok',text:ok});await load();return true;}catch(e){setNotice({tone:'error',text:e instanceof Error?e.message:String(e)});return false;}},[load]);
 if(error&&!data)return <Notice tone="warn" title={tr('Business data unavailable','Data bisnis tidak tersedia')} action={<Button size="sm" onClick={()=>void load()}>{tr('Retry','Coba lagi')}</Button>}>{error}</Notice>;
 if(!data)return null;
 const write=(r:keyof Me['permissions'])=>data.me.permissions[r]==='rw';
 const s=data.summary;
 return <>
  <section className="bo-ops-head" aria-label={tr('Business overview','Ringkasan bisnis')}>
   <div className="bo-ops-who"><Eyebrow as="span">{tr('Business','Bisnis')}</Eyebrow><span>{tr('Signed in as','Masuk sebagai')} <b>{data.me.user||'owner'}</b> · <Tag>{data.me.role}</Tag></span></div>
   <StatGrid>
    <Stat label={tr('New inquiries','Inquiry baru')} value={s.inquiries.new??0}/>
    <Stat label={tr('Open pipeline','Pipeline aktif')} value={(s.inquiries.contacted??0)+(s.inquiries.qualified??0)+(s.inquiries.proposal??0)}/>
    <Stat label={tr('Vendors / schools','Vendor / sekolah')} value={`${s.organizations.vendor??0} / ${s.organizations.school??0}`}/>
    <Stat label={tr('Products available','Produk tersedia')} value={s.products.available??0}/>
    <Stat label={tr('Tasks to verify','Tugas perlu diverifikasi')} value={s.tasks.submitted??0}/>
    <Stat label={tr('Payout due','Payout tertunda')} value={idr(s.payoutDueIdr)}/>
   </StatGrid>
   {notice&&<Notice tone={notice.tone==='ok'?'ok':'error'}>{notice.text}</Notice>}
  </section>
  <Inquiries data={data} locale={locale} canWrite={write('inquiries')&&write('organizations')} run={run}/>
  <Organizations data={data} canWrite={write('organizations')} run={run}/>
  <Products data={data} canWrite={write('products')} run={run}/>
  <Tasks data={data} canWrite={write('tasks')} run={run}/>
 </>;
}
type Run=(action:()=>Promise<unknown>,ok:string)=>Promise<boolean>;

function Inquiries({data,locale,canWrite,run}:{data:Data;locale:string;canWrite:boolean;run:Run}){
 const{tr}=useLang();const [filter,setFilter]=useState('open');const [openId,setOpenId]=useState('');const [note,setNote]=useState('');
 const rows=data.inquiries.filter(i=>filter==='all'||(filter==='open'?!['won','lost','spam'].includes(i.status):i.status===filter));
 return <Section id="bo-inquiries" eyebrow={tr('Inbox','Kotak masuk')} title={tr('Inquiries','Inquiry')} aside={<Select id="bo-inq-filter" hideLabel label={tr('Filter','Filter')} value={filter} onChange={e=>setFilter(e.target.value)}><option value="open">{tr('Open','Aktif')}</option><option value="all">{tr('All','Semua')}</option>{INQUIRY_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</Select>}>
  {!rows.length?<p className="bo-muted">{tr('No inquiries here yet. The /partner form and WhatsApp follow-ups land in this inbox.','Belum ada inquiry. Form /partner dan tindak lanjut WhatsApp masuk ke kotak ini.')}</p>:
  <ul className="bo-ops-list">{rows.map(i=><li key={i.id} className={openId===i.id?'is-open':''}>
   <button type="button" className="bo-ops-row" aria-expanded={openId===i.id} onClick={()=>{setOpenId(openId===i.id?'':i.id);setNote('');}}>
    <Tag tone={tone(i.status)}>{i.status}</Tag><span className="bo-ops-main"><b>{i.organization||i.name}</b><small>{i.kind} · {i.name}{i.country?` · ${i.country}`:''}</small></span><small className="bo-ops-meta">{i.id.slice(0,8).toUpperCase()} · {when(i.createdAt,locale)}</small>
   </button>
   {openId===i.id&&<div className="bo-ops-detail">
    <p className="bo-ops-message">{i.message}</p>
    <dl className="bo-ops-facts"><div><dt>Email</dt><dd>{i.email?<a href={`mailto:${i.email}`}>{i.email}</a>:'—'}</dd></div><div><dt>WhatsApp</dt><dd>{i.phone?<a href={`https://wa.me/${i.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener">{i.phone}</a>:'—'}</dd></div><div><dt>{tr('Interest','Minat')}</dt><dd>{i.interest||'—'}</dd></div><div><dt>{tr('Source','Sumber')}</dt><dd>{i.source||'—'}</dd></div><div><dt>{tr('Assignee','Penanggung jawab')}</dt><dd>{i.assignee||'—'}</dd></div></dl>
    {canWrite&&<div className="bo-ops-actions">
     <Select id={`st-${i.id}`} label="Status" value={i.status} onChange={e=>void run(()=>opsAdmin.updateInquiry(i.id,{status:e.target.value}),tr('Status updated','Status diperbarui'))}>{INQUIRY_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</Select>
     <Button size="sm" variant="secondary" onClick={()=>void run(()=>opsAdmin.updateInquiry(i.id,{assignee:data.me.user||'owner'}),tr('Assigned to you','Ditugaskan ke Anda'))}>{tr('Assign to me','Tugaskan ke saya')}</Button>
     {!i.organizationId&&<Button size="sm" variant="secondary" onClick={()=>void run(()=>opsAdmin.convertInquiry(i.id),tr('Organization created','Organisasi dibuat'))}>{tr('Convert to organization','Jadikan organisasi')}</Button>}
    </div>}
    {canWrite&&<form className="bo-ops-note" onSubmit={e=>{e.preventDefault();if(note.trim())void run(()=>opsAdmin.updateInquiry(i.id,{note:note.trim()}),tr('Note added','Catatan ditambahkan')).then(ok=>ok&&setNote(''));}}><Input id={`note-${i.id}`} hideLabel label={tr('Add a note','Tambah catatan')} placeholder={tr('Add a note (call outcome, next step)…','Tambah catatan (hasil telepon, langkah berikutnya)…')} value={note} onChange={e=>setNote(e.target.value)}/><Button size="sm" type="submit">{tr('Add note','Simpan catatan')}</Button></form>}
    <ol className="bo-ops-history">{[...i.history].reverse().map((h,n)=><li key={n}><small>{when(h.at,locale)} · {h.by}</small> {h.action}</li>)}</ol>
   </div>}
  </li>)}</ul>}
 </Section>;
}

function Organizations({data,canWrite,run}:{data:Data;canWrite:boolean;run:Run}){
 const{tr}=useLang();const [type,setType]=useState('all');const [form,setForm]=useState({type:'vendor',name:'',country:'Indonesia',city:'',contactName:'',contactEmail:'',contactPhone:''});
 const rows=data.orgs.filter(o=>type==='all'||o.type===type);
 const submit=(e:FormEvent)=>{e.preventDefault();void run(()=>opsAdmin.createOrganization(form as Partial<Organization>),tr('Organization added','Organisasi ditambahkan')).then(ok=>ok&&setForm(f=>({...f,name:'',city:'',contactName:'',contactEmail:'',contactPhone:''})));};
 return <Section id="bo-orgs" eyebrow="CRM" title={tr('Organizations','Organisasi')} aside={<Select id="bo-org-filter" hideLabel label={tr('Type','Tipe')} value={type} onChange={e=>setType(e.target.value)}><option value="all">{tr('All types','Semua tipe')}</option>{ORG_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</Select>}>
  {canWrite&&<form className="bo-ops-form" onSubmit={submit} aria-label={tr('Add organization','Tambah organisasi')}>
   <Select id="org-type" label={tr('Type','Tipe')} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{ORG_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</Select>
   <Input id="org-name" label={tr('Name','Nama')} required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
   <Input id="org-country" label={tr('Country','Negara')} value={form.country} onChange={e=>setForm({...form,country:e.target.value})}/>
   <Input id="org-city" label={tr('City','Kota')} value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/>
   <Input id="org-contact" label={tr('Contact person','Kontak')} value={form.contactName} onChange={e=>setForm({...form,contactName:e.target.value})}/>
   <Input id="org-email" label="Email" type="email" value={form.contactEmail} onChange={e=>setForm({...form,contactEmail:e.target.value})}/>
   <Input id="org-phone" label="WhatsApp" value={form.contactPhone} onChange={e=>setForm({...form,contactPhone:e.target.value})}/>
   <Button type="submit" size="sm">{tr('Add organization','Tambah organisasi')}</Button>
  </form>}
  {!rows.length?<p className="bo-muted">{tr('No organizations yet. Convert an inquiry or add one above.','Belum ada organisasi. Jadikan inquiry atau tambahkan di atas.')}</p>:
  <div className="bo-ops-table"><table><thead><tr><th scope="col">{tr('Name','Nama')}</th><th scope="col">{tr('Type','Tipe')}</th><th scope="col">{tr('Location','Lokasi')}</th><th scope="col">{tr('Contact','Kontak')}</th><th scope="col">Status</th><th scope="col">{tr('Lab Mitra','Lab Mitra')}</th></tr></thead><tbody>{rows.map(o=><tr key={o.id}>
   <th scope="row">{o.name}</th><td>{o.type}</td><td>{[o.city,o.country].filter(Boolean).join(', ')||'—'}</td><td>{o.contactName||'—'}{o.contactPhone?<small> · {o.contactPhone}</small>:null}</td>
   <td>{canWrite?<Select id={`org-st-${o.id}`} hideLabel label="Status" value={o.status} onChange={e=>void run(()=>opsAdmin.updateOrganization(o.id,{status:e.target.value as Organization['status']}),tr('Organization updated','Organisasi diperbarui'))}>{ORG_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</Select>:<Tag tone={tone(o.status)}>{o.status}</Tag>}</td>
   <td>{o.type!=='school'?'—':canWrite?<div className="bo-ops-inline"><Select id={`org-pk-${o.id}`} hideLabel label={tr('Package','Paket')} value={o.package} onChange={e=>void run(()=>opsAdmin.updateOrganization(o.id,{package:e.target.value as Organization['package']}),tr('Package updated','Paket diperbarui'))}>{SCHOOL_PACKAGES.map(p=><option key={p} value={p}>{p}</option>)}</Select><label className="bo-ops-check"><input type="checkbox" checked={o.publicListing} onChange={e=>void run(()=>opsAdmin.updateOrganization(o.id,{publicListing:e.target.checked}),tr('Board listing updated','Tampilan papan diperbarui'))}/>{tr('On public board','Tampil di papan')}</label></div>:`${o.package}${o.publicListing?' · board':''}`}</td>
  </tr>)}</tbody></table></div>}
 </Section>;
}

const itemLabel:Record<typeof LOCALIZATION_ITEMS[number],string>={sdppi:'SDPPI',manual_id:'Manual ID',warranty:'Warranty',service_center:'Service',stock:'Stock',pricing:'IDR price'};
function Products({data,canWrite,run}:{data:Data;canWrite:boolean;run:Run}){
 const{tr}=useLang();const vendors=useMemo(()=>data.orgs.filter(o=>o.type==='vendor'),[data.orgs]);const vendorName=(id:string)=>vendors.find(v=>v.id===id)?.name??'—';
 const [form,setForm]=useState({vendorId:'',slug:'',name:'',category:'',summary:'',wireless:true});const [evidence,setEvidence]=useState<Record<string,{label:string;url:string;summary:string}>>({});
 const submit=(e:FormEvent)=>{e.preventDefault();void run(()=>opsAdmin.createProduct(form),tr('Product added','Produk ditambahkan')).then(ok=>ok&&setForm(f=>({...f,slug:'',name:'',category:'',summary:''})));};
 const patch=(p:Product,changes:Partial<Product>,ok=tr('Product updated','Produk diperbarui'))=>void run(()=>opsAdmin.updateProduct(p.id,changes),ok);
 return <Section id="bo-products" eyebrow={tr('Distribution','Distribusi')} title={tr('Products','Produk')} aside={<a className="bo-ops-link" href="/products" target="_blank" rel="noopener">{tr('Public catalog','Katalog publik')} ↗</a>}>
  <p className="bo-muted">{tr('A product can be marked available only when every localization item is done or not applicable and test evidence is linked. Wireless devices always need SDPPI.','Produk hanya bisa ditandai tersedia jika semua item lokalisasi selesai atau tidak berlaku dan bukti uji sudah ditautkan. Perangkat nirkabel selalu butuh SDPPI.')}</p>
  {canWrite&&(vendors.length?<form className="bo-ops-form" onSubmit={submit} aria-label={tr('Add product','Tambah produk')}>
   <Select id="pr-vendor" label="Vendor" required value={form.vendorId} onChange={e=>setForm({...form,vendorId:e.target.value})}><option value="">{tr('Choose vendor','Pilih vendor')}</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</Select>
   <Input id="pr-name" label={tr('Product name','Nama produk')} required value={form.name} onChange={e=>setForm({...form,name:e.target.value,slug:form.slug||''})}/>
   <Input id="pr-slug" label="Slug" required placeholder="vendor-model" value={form.slug} onChange={e=>setForm({...form,slug:e.target.value.toLowerCase()})}/>
   <Input id="pr-category" label={tr('Category','Kategori')} required value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/>
   <Textarea id="pr-summary" label={tr('Summary','Ringkasan')} rows={2} required value={form.summary} onChange={e=>setForm({...form,summary:e.target.value})}/>
   <label className="bo-ops-check"><input type="checkbox" checked={form.wireless} onChange={e=>setForm({...form,wireless:e.target.checked})}/>{tr('Wireless (Wi-Fi/Bluetooth/cellular)','Nirkabel (Wi-Fi/Bluetooth/seluler)')}</label>
   <Button type="submit" size="sm">{tr('Add product','Tambah produk')}</Button>
  </form>:<p className="bo-muted">{tr('Add a vendor organization first.','Tambahkan organisasi vendor terlebih dahulu.')}</p>)}
  {!data.products.length?<p className="bo-muted">{tr('No products yet.','Belum ada produk.')}</p>:
  <ul className="bo-ops-cards">{data.products.map(p=>{const ev=evidence[p.id]??{label:'',url:'',summary:p.testSummary};return <li key={p.id} className="bo-ops-card">
   <div className="bo-ops-card-head"><div><b>{p.name}</b><small>{vendorName(p.vendorId)} · {p.category} · /{p.slug}{p.wireless?' · wireless':''}</small></div><div className="bo-ops-inline">{p.published?<Tag tone="ok">{tr('Published','Tayang')}</Tag>:<Tag>{tr('Private','Privat')}</Tag>}<Tag tone={tone(p.status)}>{p.status}</Tag></div></div>
   {canWrite&&<div className="bo-ops-inline">
    <Select id={`pr-st-${p.id}`} label="Status" value={p.status} onChange={e=>patch(p,{status:e.target.value as Product['status']})}>{PRODUCT_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</Select>
    <label className="bo-ops-check"><input type="checkbox" checked={p.published} onChange={e=>patch(p,{published:e.target.checked})}/>{tr('Show in public catalog','Tampilkan di katalog publik')}</label>
   </div>}
   <div className="bo-ops-checklist">{LOCALIZATION_ITEMS.map(k=>canWrite?<Select key={k} id={`pr-${k}-${p.id}`} label={itemLabel[k]} value={p.localization[k]} onChange={e=>patch(p,{localization:{...p.localization,[k]:e.target.value}})}>{CHECK_STATES.map(c=><option key={c} value={c}>{c}</option>)}</Select>:<span key={k}><Tag tone={tone(p.localization[k])}>{itemLabel[k]}: {p.localization[k]}</Tag></span>)}</div>
   {p.evidence.length>0&&<ul className="bo-ops-evidence">{p.evidence.map(e=><li key={e.url}><a href={e.url} target="_blank" rel="noopener">{e.label}</a></li>)}</ul>}
   {p.testSummary&&<p className="bo-muted">{p.testSummary}</p>}
   {canWrite&&<form className="bo-ops-inline bo-ops-evidence-form" onSubmit={e=>{e.preventDefault();if(ev.label&&ev.url)void run(()=>opsAdmin.updateProduct(p.id,{evidence:[...p.evidence,{label:ev.label,url:ev.url}],testSummary:ev.summary||p.testSummary}),tr('Evidence linked','Bukti ditautkan')).then(ok=>ok&&setEvidence(x=>({...x,[p.id]:{label:'',url:'',summary:ev.summary}})));}}>
    <Input id={`ev-l-${p.id}`} label={tr('Evidence label','Label bukti')} value={ev.label} onChange={e=>setEvidence(x=>({...x,[p.id]:{...ev,label:e.target.value}}))}/>
    <Input id={`ev-u-${p.id}`} label="URL (https)" type="url" value={ev.url} onChange={e=>setEvidence(x=>({...x,[p.id]:{...ev,url:e.target.value}}))}/>
    <Input id={`ev-s-${p.id}`} label={tr('Test summary','Ringkasan uji')} value={ev.summary} onChange={e=>setEvidence(x=>({...x,[p.id]:{...ev,summary:e.target.value}}))}/>
    <Button size="sm" type="submit" variant="secondary">{tr('Link evidence','Tautkan bukti')}</Button>
   </form>}
  </li>;})}</ul>}
 </Section>;
}

function Tasks({data,canWrite,run}:{data:Data;canWrite:boolean;run:Run}){
 const{tr}=useLang();const labs=useMemo(()=>data.orgs.filter(o=>o.type==='school'&&o.status==='active'),[data.orgs]);const labName=(id?:string)=>data.orgs.find(o=>o.id===id)?.name??'—';
 const [form,setForm]=useState({title:'',feeIdr:'150000',labId:''});const [refs,setRefs]=useState<Record<string,string>>({});const [assign,setAssign]=useState<Record<string,string>>({});
 const submit=(e:FormEvent)=>{e.preventDefault();void run(()=>opsAdmin.createTask({title:form.title,feeIdr:Number(form.feeIdr),...(form.labId?{labId:form.labId}:{})}),tr('Task created','Tugas dibuat')).then(ok=>ok&&setForm(f=>({...f,title:''})));};
 const act=(t:TaskRow,action:string,extra:Record<string,string>={})=>void run(()=>opsAdmin.taskAction(t.id,{action,...extra}),tr(`Task: ${action}`,`Tugas: ${action}`));
 const {payouts,totals}=data.payouts;
 return <Section id="bo-tasks" eyebrow="Lab Mitra" title={tr('Lab tasks & payouts','Tugas lab & payout')}>
  <p className="bo-muted">{tr('Flow: open → assigned → submitted (with evidence) → verified → paid. Payout split per task: 60% student operators, 25% school TEFA fund, 15% supervising teacher, paid to the school account.','Alur: open → assigned → submitted (dengan bukti) → verified → paid. Pembagian per tugas: 60% siswa operator, 25% kas TEFA sekolah, 15% guru pembimbing, dibayar ke rekening sekolah.')}</p>
  {canWrite&&<form className="bo-ops-form" onSubmit={submit} aria-label={tr('Create task','Buat tugas')}>
   <Input id="tk-title" label={tr('Task','Tugas')} required placeholder={tr('e.g. Humidity soak 24 h, sensor X','mis. Uji lembap 24 jam, sensor X')} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
   <Input id="tk-fee" label={tr('Fee (IDR)','Honor (Rp)')} type="number" min={10000} step={1000} required value={form.feeIdr} onChange={e=>setForm({...form,feeIdr:e.target.value})}/>
   <Select id="tk-lab" label="Lab Mitra" value={form.labId} onChange={e=>setForm({...form,labId:e.target.value})}><option value="">{tr('Unassigned','Belum ditugaskan')}</option>{labs.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</Select>
   <Button type="submit" size="sm">{tr('Create task','Buat tugas')}</Button>
  </form>}
  {!labs.length&&<p className="bo-muted">{tr('No active Lab Mitra schools yet: set a school organization to active to assign tasks.','Belum ada sekolah Lab Mitra aktif: ubah status organisasi sekolah menjadi active untuk menugaskan.')}</p>}
  {data.tasks.length>0&&<div className="bo-ops-table"><table><thead><tr><th scope="col">{tr('Task','Tugas')}</th><th scope="col">Lab</th><th scope="col">{tr('Fee','Honor')}</th><th scope="col">60 / 25 / 15</th><th scope="col">Status</th><th scope="col">{tr('Action','Aksi')}</th></tr></thead><tbody>{data.tasks.map(t=><tr key={t.id}>
   <th scope="row">{t.title}{t.evidenceRef&&<small> · {t.evidenceRef}</small>}</th><td>{labName(t.labId)}</td><td>{idr(t.feeIdr)}</td><td><small>{idr(t.payout.students)} / {idr(t.payout.tefa)} / {idr(t.payout.teacher)}</small></td><td><Tag tone={tone(t.status)}>{t.status}</Tag></td>
   <td>{canWrite&&<div className="bo-ops-inline">
    {(t.status==='open'||t.status==='rejected')&&<><Select id={`as-${t.id}`} hideLabel label="Lab" value={assign[t.id]??''} onChange={e=>setAssign(a=>({...a,[t.id]:e.target.value}))}><option value="">{tr('Choose lab','Pilih lab')}</option>{labs.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</Select><Button size="sm" variant="secondary" disabled={!assign[t.id]} onClick={()=>act(t,'assign',{labId:assign[t.id]})}>{tr('Assign','Tugaskan')}</Button></>}
    {t.status==='assigned'&&<><Input id={`ref-${t.id}`} hideLabel label={tr('Evidence reference','Referensi bukti')} placeholder={tr('Job id or link','Job id atau link')} value={refs[t.id]??''} onChange={e=>setRefs(r=>({...r,[t.id]:e.target.value}))}/><Button size="sm" variant="secondary" disabled={!refs[t.id]} onClick={()=>act(t,'submit',{evidenceRef:refs[t.id]})}>{tr('Mark submitted','Tandai terkirim')}</Button></>}
    {t.status==='submitted'&&<><Button size="sm" onClick={()=>act(t,'verify')}>{tr('Verify','Verifikasi')}</Button><Button size="sm" variant="secondary" onClick={()=>act(t,'reject')}>{tr('Reject','Tolak')}</Button></>}
    {t.status==='verified'&&<Button size="sm" onClick={()=>act(t,'pay')}>{tr('Mark paid','Tandai dibayar')}</Button>}
   </div>}</td>
  </tr>)}</tbody></table></div>}
  <div className="bo-ops-payouts"><StatGrid><Stat label={tr('Payout due (verified)','Payout tertunda (terverifikasi)')} value={idr(totals.dueIdr)}/><Stat label={tr('Paid to schools','Sudah dibayar ke sekolah')} value={idr(totals.paidIdr)}/><Stat label={tr('Verified tasks','Tugas terverifikasi')} value={payouts.length}/></StatGrid></div>
 </Section>;
}
