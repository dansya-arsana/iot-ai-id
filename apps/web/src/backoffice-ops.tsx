/** Backoffice business panels: inquiry inbox, organizations (vendors, schools, buyers), distributor products, Lab Mitra tasks and payouts. */
import {useCallback,useEffect,useMemo,useState,type FormEvent,type ReactNode} from 'react';
import {useLang} from './i18n';
import {Button,Eyebrow,Input,Notice,Select,Stat,StatGrid,Tag,Textarea} from './ui';
import {idr,opsAdmin,type Commissions as CommissionData,type Me,type PayoutRow,type MemberView,type PersonView,type StaffView,type Summary,type TaskRow} from './ops-client';
import {CHECK_STATES,MEMBER_GRANTS,INQUIRY_STATUSES,ROLES,LOCALIZATION_ITEMS,ORG_STATUSES,ORG_TYPES,PRODUCT_STATUSES,SCHOOL_PACKAGES,type Inquiry,type MemberGrant,type Organization,type Product} from '../../../packages/ops-contract/index';

export const opsSections=[
 {hash:'#bo-inquiries',en:'Inquiries',id:'Inquiry'},
 {hash:'#bo-orgs',en:'Organizations',id:'Organisasi'},
 {hash:'#bo-products',en:'Products',id:'Produk'},
 {hash:'#bo-tasks',en:'Lab tasks',id:'Tugas lab'},
 {hash:'#bo-commissions',en:'Commissions & payouts',id:'Komisi & payout'},
 {hash:'#bo-members',en:'Members',id:'Anggota'},
 {hash:'#bo-team',en:'Team',id:'Tim'},
];
async function fetchAll():Promise<Data>{const [me,summary,inquiries,orgs,products,tasks,payouts,commissions,people,team,members]=await Promise.all([opsAdmin.me(),opsAdmin.summary(),opsAdmin.inquiries(),opsAdmin.organizations(),opsAdmin.products(),opsAdmin.tasks(),opsAdmin.payouts(),opsAdmin.commissions(),opsAdmin.people(),opsAdmin.staff().catch(()=>undefined),opsAdmin.members().catch(()=>undefined)]);return{me,summary,inquiries,orgs,products,tasks,payouts,commissions,people,team:me.role==='owner'?team:undefined,members};}
type Data={me:Me;summary:Summary;inquiries:Inquiry[];orgs:Organization[];products:Product[];tasks:TaskRow[];payouts:{payouts:PayoutRow[];totals:{dueIdr:number;paidIdr:number}};commissions:CommissionData;people:PersonView[];team?:StaffView[];members?:MemberView[]};
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
  <Commissions data={data} canPay={write('tasks')} canPeople={write('organizations')} run={run} locale={locale}/>
  {data.members&&<Members data={data} members={data.members} run={run} locale={locale}/>}
  {data.team&&<Team data={data} team={data.team} run={run} locale={locale}/>}
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
    <dl className="bo-ops-facts"><div><dt>Email</dt><dd>{i.email?<a href={`mailto:${i.email}`}>{i.email}</a>:'—'}</dd></div><div><dt>WhatsApp</dt><dd>{i.phone?<a href={`https://wa.me/${i.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener">{i.phone}</a>:'—'}</dd></div><div><dt>{tr('Interest','Minat')}</dt><dd>{i.interest||'—'}</dd></div><div><dt>{tr('Source','Sumber')}</dt><dd>{i.source||'—'}</dd></div>{(i.region||i.build||i.month||i.stressor||i.site)&&<div data-testid="inquiry-context"><dt>{tr('Test context','Konteks uji')}</dt><dd>{[['region',i.region],['build',i.build],['month',i.month],['stressor',i.stressor],['site',i.site]].filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join(' · ')}</dd></div>}<div><dt>{tr('Assignee','Penanggung jawab')}</dt><dd>{i.assignee||'—'}</dd></div></dl>
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
 const [form,setForm]=useState({title:'',feeIdr:'150000',labId:'',leadId:''});const [refs,setRefs]=useState<Record<string,string>>({});const [assign,setAssign]=useState<Record<string,string>>({});const [leads,setLeads]=useState<Record<string,string>>({});
 const teachers=(labId:string)=>data.people.filter(p=>p.role==='teacher'&&p.status==='active'&&p.orgId===labId);const personName=(id?:string)=>data.people.find(p=>p.id===id)?.name;
 const submit=(e:FormEvent)=>{e.preventDefault();void run(()=>opsAdmin.createTask({title:form.title,feeIdr:Number(form.feeIdr),...(form.labId?{labId:form.labId}:{})}),tr('Task created','Tugas dibuat')).then(ok=>ok&&setForm(f=>({...f,title:''})));};
 const act=(t:TaskRow,action:string,extra:Record<string,string>={})=>void run(()=>opsAdmin.taskAction(t.id,{action,...extra}),tr(`Task: ${action}`,`Tugas: ${action}`));
 const {payouts,totals}=data.payouts;
 return <Section id="bo-tasks" eyebrow="Lab Mitra" title={tr('Lab tasks & payouts','Tugas lab & payout')}>
  <p className="bo-muted">{tr('Flow: open → assigned → submitted (with evidence) → verified → paid. A task is paid when its payout batch is marked paid (see Commissions & payouts). Split per task: 60% student operators, 25% school TEFA fund, 15% supervising teacher, always paid to the school account.','Alur: open → assigned → submitted (dengan bukti) → verified → paid. Tugas berstatus paid saat batch payout-nya ditandai dibayar (lihat Komisi & payout). Pembagian per tugas: 60% siswa operator, 25% kas TEFA sekolah, 15% guru pembimbing, selalu dibayar ke rekening sekolah.')}</p>
  {canWrite&&<form className="bo-ops-form" onSubmit={submit} aria-label={tr('Create task','Buat tugas')}>
   <Input id="tk-title" label={tr('Task','Tugas')} required placeholder={tr('e.g. Humidity soak 24 h, sensor X','mis. Uji lembap 24 jam, sensor X')} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
   <Input id="tk-fee" label={tr('Fee (IDR)','Honor (Rp)')} type="number" min={10000} step={1000} required value={form.feeIdr} onChange={e=>setForm({...form,feeIdr:e.target.value})}/>
   <Select id="tk-lab" label="Lab Mitra" value={form.labId} onChange={e=>setForm({...form,labId:e.target.value,leadId:''})}><option value="">{tr('Unassigned','Belum ditugaskan')}</option>{labs.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</Select>
   {form.labId&&<Select id="tk-lead" label={tr('Lead teacher','Guru pembimbing')} value={form.leadId} onChange={e=>setForm({...form,leadId:e.target.value})}><option value="">{tr('No lead yet','Belum ada')}</option>{teachers(form.labId).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</Select>}
   <Button type="submit" size="sm">{tr('Create task','Buat tugas')}</Button>
  </form>}
  {!labs.length&&<p className="bo-muted">{tr('No active Lab Mitra schools yet: set a school organization to active to assign tasks.','Belum ada sekolah Lab Mitra aktif: ubah status organisasi sekolah menjadi active untuk menugaskan.')}</p>}
  {data.tasks.length>0&&<div className="bo-ops-table"><table><thead><tr><th scope="col">{tr('Task','Tugas')}</th><th scope="col">Lab</th><th scope="col">{tr('Fee','Honor')}</th><th scope="col">60 / 25 / 15</th><th scope="col">Status</th><th scope="col">{tr('Action','Aksi')}</th></tr></thead><tbody>{data.tasks.map(t=><tr key={t.id}>
   <th scope="row">{t.title}{t.evidenceRef&&<small> · {t.evidenceRef}</small>}</th><td>{labName(t.labId)}{t.leadId&&<small> · {personName(t.leadId)}</small>}</td><td>{idr(t.feeIdr)}</td><td><small>{idr(t.payout.students)} / {idr(t.payout.tefa)} / {idr(t.payout.teacher)}</small></td><td><Tag tone={tone(t.status)}>{t.status}</Tag></td>
   <td>{canWrite&&<div className="bo-ops-inline">
    {(t.status==='open'||t.status==='rejected')&&<><Select id={`as-${t.id}`} hideLabel label="Lab" value={assign[t.id]??''} onChange={e=>{setAssign(a=>({...a,[t.id]:e.target.value}));setLeads(l=>({...l,[t.id]:''}));}}><option value="">{tr('Choose lab','Pilih lab')}</option>{labs.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</Select>{assign[t.id]&&<Select id={`ld-${t.id}`} hideLabel label={tr('Lead teacher','Guru pembimbing')} value={leads[t.id]??''} onChange={e=>setLeads(l=>({...l,[t.id]:e.target.value}))}><option value="">{tr('No lead yet','Belum ada guru')}</option>{teachers(assign[t.id]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Select>}<Button size="sm" variant="secondary" disabled={!assign[t.id]} onClick={()=>act(t,'assign',{labId:assign[t.id],...(leads[t.id]?{leadId:leads[t.id]}:{})})}>{tr('Assign','Tugaskan')}</Button></>}
    {t.status==='assigned'&&t.labId&&teachers(t.labId).length>0&&<><Select id={`lead-${t.id}`} hideLabel label={tr('Lead teacher','Guru pembimbing')} value={leads[t.id]??t.leadId??''} onChange={e=>setLeads(l=>({...l,[t.id]:e.target.value}))}><option value="">{tr('No lead yet','Belum ada guru')}</option>{teachers(t.labId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Select><Button size="sm" variant="secondary" disabled={!leads[t.id]||leads[t.id]===t.leadId} onClick={()=>act(t,'assign',{labId:t.labId!,leadId:leads[t.id]})}>{tr('Set lead','Atur guru')}</Button></>}
    {t.status==='assigned'&&<><Input id={`ref-${t.id}`} hideLabel label={tr('Evidence reference','Referensi bukti')} placeholder={tr('Job id or link','Job id atau link')} value={refs[t.id]??''} onChange={e=>setRefs(r=>({...r,[t.id]:e.target.value}))}/><Button size="sm" variant="secondary" disabled={!refs[t.id]} onClick={()=>act(t,'submit',{evidenceRef:refs[t.id]})}>{tr('Mark submitted','Tandai terkirim')}</Button></>}
    {t.status==='submitted'&&<><Button size="sm" onClick={()=>act(t,'verify')}>{tr('Verify','Verifikasi')}</Button><Button size="sm" variant="secondary" onClick={()=>act(t,'reject')}>{tr('Reject','Tolak')}</Button></>}
    {t.status==='verified'&&<a className="bo-ops-link" href="#bo-commissions">{t.batchId?tr('In a payout batch','Ada di batch payout'):tr('Pay via a payout batch','Bayar lewat batch payout')}</a>}
   </div>}</td>
  </tr>)}</tbody></table></div>}
  <div className="bo-ops-payouts"><StatGrid><Stat label={tr('Payout due (verified)','Payout tertunda (terverifikasi)')} value={idr(totals.dueIdr)}/><Stat label={tr('Paid to schools (batches)','Sudah dibayar ke sekolah (batch)')} value={idr(totals.paidIdr)}/><Stat label={tr('Verified tasks','Tugas terverifikasi')} value={payouts.length}/></StatGrid></div>
 </Section>;
}

const today=()=>new Date().toISOString().slice(0,10);
function Commissions({data,canPay,canPeople,run,locale}:{data:Data;canPay:boolean;canPeople:boolean;run:Run;locale:string}){
 const{tr}=useLang();const {schools,batches}=data.commissions;const activeSchools=data.orgs.filter(o=>o.type==='school'&&o.status==='active');
 const [form,setForm]=useState({orgId:'',name:''});const [invite,setInvite]=useState<{name:string;username?:string;code:string}>();const [copied,setCopied]=useState(false);
 const [paid,setPaid]=useState<Record<string,{ref:string;date:string}>>({});const [fileError,setFileError]=useState('');
 const staff=data.people.filter(p=>p.role!=='student');const schoolName=(id:string)=>data.orgs.find(o=>o.id===id)?.name??'—';
 const reveal=(name:string,r:{person:PersonView;inviteCode:string})=>{setInvite({name,username:r.person.username,code:r.inviteCode});setCopied(false);};
 const createAdmin=(e:FormEvent)=>{e.preventDefault();void run(async()=>{const r=await opsAdmin.createSchoolAdmin({orgId:form.orgId,name:form.name.trim()});reveal(form.name.trim(),r);setForm(f=>({...f,name:''}));},tr('School admin created','Admin sekolah dibuat'));};
 const copy=()=>{if(invite)void navigator.clipboard?.writeText(invite.code).then(()=>setCopied(true));};
 const status=(p:PersonView)=>p.status==='disabled'?<Tag tone="error">{tr('disabled','nonaktif')}</Tag>:p.activated?<Tag tone="ok">{tr('active','aktif')}</Tag>:p.inviteExpires?<Tag tone="warn">{tr('invite until','undangan s/d')} {new Date(p.inviteExpires).toLocaleDateString(locale,{day:'numeric',month:'short'})}</Tag>:<Tag>{tr('invite expired','undangan kedaluwarsa')}</Tag>;
 return <Section id="bo-commissions" eyebrow="Lab Mitra" title={tr('Commissions & payouts','Komisi & payout')}>
  <p className="bo-muted">{tr('Commissions are always transferred to the school bank account, never to students. The school admin approves the per-student split proposed by the teacher, then confirms it distributed the money. Every posting is appended to an immutable ledger.','Komisi selalu ditransfer ke rekening sekolah, tidak pernah ke siswa. Admin sekolah menyetujui pembagian per siswa yang diusulkan guru, lalu mengonfirmasi bahwa dana sudah dibagikan. Setiap posting masuk ke ledger yang tidak bisa diubah.')}</p>
  {fileError&&<Notice tone="error">{fileError}</Notice>}
  <div className="bo-ops-table"><table><caption className="bo-muted">{tr('Balances per school','Saldo per sekolah')}</caption><thead><tr><th scope="col">{tr('School','Sekolah')}</th><th scope="col">{tr('Accrued','Terakru')}</th><th scope="col">{tr('Student share awaiting school approval','Porsi siswa menunggu persetujuan sekolah')}</th><th scope="col">{tr('Approved to students','Disetujui ke siswa')}</th><th scope="col">{tr('Paid to school','Dibayar ke sekolah')}</th><th scope="col">{tr('Awaiting distribution','Menunggu dibagikan')}</th><th scope="col">{tr('Still owed','Masih terutang')}</th><th scope="col">{tr('Action','Aksi')}</th></tr></thead><tbody>{schools.filter(s=>s.status==='active'||s.totals.accruedIdr>0).map(s=><tr key={s.orgId}>
   <th scope="row">{s.name}<small> · {s.people.teachers} {tr('teachers','guru')}, {s.people.students} {tr('students','siswa')}</small></th><td>{idr(s.totals.accruedIdr)}</td><td>{idr(s.totals.pendingApprovalIdr)}</td><td>{idr(s.totals.approvedIdr)}</td><td>{idr(s.totals.paidIdr)}</td><td>{idr(s.totals.waitingIdr)}</td><td>{idr(s.totals.owedIdr)}</td>
   <td>{canPay&&s.readyForBatch>0?<Button size="sm" onClick={()=>void run(()=>opsAdmin.createBatch(s.orgId),tr('Payout batch created','Batch payout dibuat'))}>{tr(`Create batch (${s.readyForBatch})`,`Buat batch (${s.readyForBatch})`)}</Button>:'—'}</td>
  </tr>)}</tbody></table></div>
  {schools.every(s=>s.status!=='active'&&!s.totals.accruedIdr)&&<p className="bo-muted">{tr('No active Lab Mitra schools yet.','Belum ada sekolah Lab Mitra aktif.')}</p>}

  <h3>{tr('Allocations waiting for school approval','Alokasi menunggu persetujuan sekolah')}</h3>
  {schools.every(s=>!s.pending.length)?<p className="bo-muted">{tr('Nothing is waiting. AIoT cannot approve allocations: the school admin does.','Tidak ada yang menunggu. AIoT tidak dapat menyetujui alokasi: itu tugas admin sekolah.')}</p>:
  <ul className="bo-ops-list">{schools.flatMap(s=>s.pending.map(a=><li key={a.id}><div className="bo-ops-row"><Tag tone="warn">{tr('pending','menunggu')}</Tag><span className="bo-ops-main"><b>{a.taskTitle}</b><small>{s.name} · {tr('proposed by','diusulkan')} {a.proposedByName} · {a.shares.map(x=>`${x.name} ${idr(x.amountIdr)}`).join(', ')}</small></span><small className="bo-ops-meta">{idr(a.studentPoolIdr)}</small></div></li>))}</ul>}

  <h3>{tr('Payout batches','Batch payout')}</h3>
  {!batches.length?<p className="bo-muted">{tr('No batches yet. A batch collects the approved, unpaid allocations of one school.','Belum ada batch. Batch berisi alokasi yang sudah disetujui dan belum dibayar dari satu sekolah.')}</p>:
  <div className="bo-ops-table"><table><thead><tr><th scope="col">{tr('School','Sekolah')}</th><th scope="col">{tr('Tasks','Tugas')}</th><th scope="col">{tr('Amount','Jumlah')}</th><th scope="col">Status</th><th scope="col">{tr('Transfer','Transfer')}</th><th scope="col">{tr('Action','Aksi')}</th></tr></thead><tbody>{batches.map(b=>{const f=paid[b.id]??{ref:'',date:today()};return <tr key={b.id}>
   <th scope="row">{b.orgName}<small> · {b.id.slice(0,8)}</small></th><td><small>{b.tasks.map(t=>t.title).join(', ')}</small></td><td>{idr(b.amountIdr)}</td><td><Tag tone={b.status==='paid'?'ok':'warn'}>{b.status}</Tag>{b.distributedAt&&<> <Tag tone="ok">{tr('distributed','dibagikan')}</Tag></>}</td><td>{b.status==='paid'?<small>{b.transferRef} · {b.paidAt?.slice(0,10)}</small>:canPay?<div className="bo-ops-inline"><Input id={`tr-${b.id}`} hideLabel label={tr('Transfer reference','Referensi transfer')} placeholder={tr('Transfer reference','Referensi transfer')} value={f.ref} onChange={e=>setPaid(x=>({...x,[b.id]:{...f,ref:e.target.value}}))}/><Input id={`td-${b.id}`} hideLabel label={tr('Paid on','Dibayar pada')} type="date" value={f.date} onChange={e=>setPaid(x=>({...x,[b.id]:{...f,date:e.target.value}}))}/></div>:'—'}</td>
   <td><div className="bo-ops-inline">{canPay&&b.status==='created'&&<Button size="sm" disabled={f.ref.trim().length<3} onClick={()=>void run(()=>opsAdmin.markBatchPaid(b.id,{transferRef:f.ref.trim(),paidAt:f.date}),tr('Batch marked paid; tasks are now paid','Batch ditandai dibayar; tugas kini paid'))}>{tr('Mark paid','Tandai dibayar')}</Button>}<Button size="sm" variant="secondary" onClick={()=>void opsAdmin.downloadBatch(b.id).catch(e=>setFileError(e instanceof Error?e.message:String(e)))}>CSV</Button></div></td>
  </tr>;})}</tbody></table></div>}

  <h3>{tr('School people','Orang di sekolah')}</h3>
  <p className="bo-muted">{tr('AIoT creates the first school admin for an active school; the school admin then adds teachers and students in the portal at /mitra. Codes are shown once and expire in 7 days.','AIoT membuat admin sekolah pertama untuk sekolah aktif; admin sekolah lalu menambah guru dan siswa di portal /mitra. Kode hanya tampil sekali dan kedaluwarsa dalam 7 hari.')}</p>
  {invite&&<Notice tone="warn" title={tr(`Invite code for ${invite.name}`,`Kode undangan untuk ${invite.name}`)} action={<Button size="sm" variant="secondary" onClick={copy}>{copied?tr('Copied','Tersalin'):tr('Copy code','Salin kode')}</Button>}>
   <span className="bo-ops-code" data-testid="invite-code">{invite.code}</span>{invite.username&&<> · {tr('username','nama pengguna')} <code>{invite.username}</code></>} <span>{tr('Shown once. Copy it now and hand it to the person; it cannot be displayed again, only replaced with a new code. Valid for 7 days.','Tampil sekali. Salin sekarang dan serahkan ke orangnya; kode tidak dapat ditampilkan lagi, hanya diganti kode baru. Berlaku 7 hari.')}</span> <Button size="sm" variant="secondary" onClick={()=>setInvite(undefined)}>{tr('I have copied it','Sudah saya salin')}</Button>
  </Notice>}
  {canPeople&&(activeSchools.length?<form className="bo-ops-form" onSubmit={createAdmin} aria-label={tr('Create school admin','Buat admin sekolah')}>
   <Select id="sa-org" label={tr('School','Sekolah')} required value={form.orgId} onChange={e=>setForm({...form,orgId:e.target.value})}><option value="">{tr('Choose school','Pilih sekolah')}</option>{activeSchools.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</Select>
   <Input id="sa-name" label={tr('School admin name','Nama admin sekolah')} required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
   <Button type="submit" size="sm" disabled={!form.orgId||form.name.trim().length<2}>{tr('Create school admin','Buat admin sekolah')}</Button>
  </form>:<p className="bo-muted">{tr('Set a school organization to active first.','Ubah status organisasi sekolah menjadi active terlebih dahulu.')}</p>)}
  {staff.length>0&&<div className="bo-ops-table"><table><thead><tr><th scope="col">{tr('Name','Nama')}</th><th scope="col">{tr('Role','Peran')}</th><th scope="col">{tr('School','Sekolah')}</th><th scope="col">{tr('Username','Nama pengguna')}</th><th scope="col">Status</th><th scope="col">{tr('Action','Aksi')}</th></tr></thead><tbody>{staff.map(p=><tr key={p.id}>
   <th scope="row">{p.name}</th><td>{p.role}</td><td>{schoolName(p.orgId)}</td><td><code>{p.username}</code></td><td>{status(p)}</td>
   <td>{canPeople&&<div className="bo-ops-inline">{p.status==='active'&&<Button size="sm" variant="secondary" onClick={()=>void run(async()=>reveal(p.name,await opsAdmin.resetInvite(p.id)),tr('New invite code created','Kode undangan baru dibuat'))}>{tr('Reset invite','Reset undangan')}</Button>}<Button size="sm" variant="secondary" onClick={()=>void run(()=>opsAdmin.setPersonStatus(p.id,p.status==='active'?'disabled':'active'),p.status==='active'?tr('Person disabled','Orang dinonaktifkan'):tr('Person enabled','Orang diaktifkan'))}>{p.status==='active'?tr('Disable','Nonaktifkan'):tr('Enable','Aktifkan')}</Button></div>}</td>
  </tr>)}</tbody></table></div>}
 </Section>;
}

/** Owner only: staff accounts for the admin host. Codes are shown once; accounts are disabled, never deleted. */
function Team({data,team,run,locale}:{data:Data;team:StaffView[];run:Run;locale:string}){
 const{tr}=useLang();const [form,setForm]=useState<{username:string;name:string;role:StaffView['role']}>({username:'',name:'',role:'sales'});const [invite,setInvite]=useState<{name:string;username:string;code:string}>();const [copied,setCopied]=useState(false);
 const reveal=(s:StaffView,code:string)=>{setInvite({name:s.name,username:s.username,code});setCopied(false);};
 const add=(e:FormEvent)=>{e.preventDefault();void run(async()=>{const r=await opsAdmin.createStaff({username:form.username.trim().toLowerCase(),name:form.name.trim(),role:form.role});reveal(r.staff,r.inviteCode);setForm(f=>({...f,username:'',name:''}));},tr('Person added','Orang ditambahkan'));};
 const copy=()=>{if(invite)void navigator.clipboard?.writeText(invite.code).then(()=>setCopied(true));};
 const status=(s:StaffView)=>s.status==='disabled'?<Tag tone="error">{tr('disabled','nonaktif')}</Tag>:s.activated?<Tag tone="ok">{tr('active','aktif')}</Tag>:s.inviteExpires?<Tag tone="warn">{tr('invite until','undangan s/d')} {new Date(s.inviteExpires).toLocaleDateString(locale,{day:'numeric',month:'short'})}</Tag>:<Tag>{tr('invite expired','undangan kedaluwarsa')}</Tag>;
 return <Section id="bo-team" eyebrow={tr('Access','Akses')} title={tr('Team','Tim')}>
  <p className="bo-muted">{tr('Staff sign in at this address with their own username and password. Roles decide what each person can change. Accounts are disabled, never deleted, and the last active owner cannot be removed. Codes are shown once and expire in 7 days.','Staf masuk di alamat ini dengan nama pengguna dan kata sandi masing-masing. Peran menentukan apa yang dapat diubah. Akun dinonaktifkan, tidak dihapus, dan owner aktif terakhir tidak dapat dihapus. Kode hanya tampil sekali dan kedaluwarsa dalam 7 hari.')}</p>
  {invite&&<Notice tone="warn" title={tr(`Invite code for ${invite.name}`,`Kode undangan untuk ${invite.name}`)} action={<Button size="sm" variant="secondary" onClick={copy}>{copied?tr('Copied','Tersalin'):tr('Copy code','Salin kode')}</Button>}>
   <span className="bo-ops-code" data-testid="staff-invite-code">{invite.code}</span> · {tr('username','nama pengguna')} <code>{invite.username}</code> <span>{tr('Shown once. Copy it now and hand it to the person; it cannot be displayed again, only replaced with a new code.','Tampil sekali. Salin sekarang dan serahkan ke orangnya; kode tidak dapat ditampilkan lagi, hanya diganti kode baru.')}</span> <Button size="sm" variant="secondary" onClick={()=>setInvite(undefined)}>{tr('I have copied it','Sudah saya salin')}</Button>
  </Notice>}
  <form className="bo-ops-form" onSubmit={add} aria-label={tr('Add a person','Tambah orang')}>
   <Input id="tm-username" label={tr('Username','Nama pengguna')} hint="a-z 0-9 . _ -" required minLength={3} maxLength={40} autoCapitalize="none" value={form.username} onChange={e=>setForm({...form,username:e.target.value.toLowerCase()})}/>
   <Input id="tm-name" label={tr('Name','Nama')} required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
   <Select id="tm-role" label={tr('Role','Peran')} value={form.role} onChange={e=>setForm({...form,role:e.target.value as StaffView['role']})}>{ROLES.map(r=><option key={r} value={r}>{r}</option>)}</Select>
   <Button type="submit" size="sm" disabled={!/^[a-z0-9._-]{3,40}$/.test(form.username)||form.name.trim().length<2}>{tr('Add person','Tambah orang')}</Button>
  </form>
  <div className="bo-ops-table"><table><thead><tr><th scope="col">{tr('Name','Nama')}</th><th scope="col">{tr('Username','Nama pengguna')}</th><th scope="col">{tr('Role','Peran')}</th><th scope="col">{tr('Account','Akun')}</th><th scope="col">{tr('Action','Aksi')}</th></tr></thead><tbody>{team.map(s=>{const self=s.username===data.me.user;return <tr key={s.id}>
   <th scope="row">{s.name}{self&&<small> · {tr('you','Anda')}</small>}</th><td><code>{s.username}</code></td>
   <td><Select id={`tm-r-${s.id}`} hideLabel label={tr(`Role of ${s.name}`,`Peran ${s.name}`)} value={s.role} disabled={s.status==='disabled'} onChange={e=>void run(()=>opsAdmin.updateStaff(s.id,{role:e.target.value as StaffView['role']}),tr('Role changed','Peran diubah'))}>{ROLES.map(r=><option key={r} value={r}>{r}</option>)}</Select></td>
   <td>{status(s)}</td>
   <td><div className="bo-ops-inline">{s.status==='active'&&!self&&<Button size="sm" variant="secondary" onClick={()=>void run(async()=>{const r=await opsAdmin.resetStaffInvite(s.id);reveal(r.staff,r.inviteCode);},tr('New invite code created','Kode undangan baru dibuat'))}>{tr('Reset invite','Reset undangan')}</Button>}<Button size="sm" variant="secondary" onClick={()=>void run(()=>opsAdmin.updateStaff(s.id,{status:s.status==='active'?'disabled':'active'}),s.status==='active'?tr('Person disabled and signed out','Orang dinonaktifkan dan dikeluarkan'):tr('Person enabled','Orang diaktifkan'))}>{s.status==='active'?tr('Disable','Nonaktifkan'):tr('Enable','Aktifkan')}</Button></div></td>
  </tr>;})}</tbody></table></div>
 </Section>;
}

const GRANT_LABELS:Record<MemberGrant,[string,string]>={products:['Products','Produk'],bench:['PhysicalBench','PhysicalBench'],arena:['Arena','Arena'],builders:['Builders','Builders'],installer:['Installer download','Unduh installer'],lab:['Arduino lab','Lab Arduino'],'lab-ai':['Lab AI builder','Pembuat AI Lab']};
/** Owner and sales: member accounts that unlock areas of iot.ai.id. Codes are shown once; accounts are disabled, never deleted. */
function Members({data,members,run,locale}:{data:Data;members:MemberView[];run:Run;locale:string}){
 const{tr}=useLang();const [form,setForm]=useState<{username:string;name:string;orgName:string;orgId:string;grants:MemberGrant[]}>({username:'',name:'',orgName:'',orgId:'',grants:[]});
 const [invite,setInvite]=useState<{name:string;username:string;code:string}>();const [copied,setCopied]=useState(false);const [openId,setOpenId]=useState('');
 const reveal=(m:MemberView,code:string)=>{setInvite({name:m.name,username:m.username,code});setCopied(false);};
 const toggle=(grants:MemberGrant[],g:MemberGrant)=>grants.includes(g)?grants.filter(x=>x!==g):[...grants,g];
 const add=(e:FormEvent)=>{e.preventDefault();void run(async()=>{const r=await opsAdmin.createMember({username:form.username.trim().toLowerCase(),name:form.name.trim(),...(form.orgName.trim()?{orgName:form.orgName.trim()}:{}),...(form.orgId?{orgId:form.orgId}:{}),grants:form.grants});reveal(r.member,r.inviteCode);setForm(f=>({...f,username:'',name:'',orgName:'',orgId:'',grants:[]}));},tr('Member added','Anggota ditambahkan'));};
 const copy=()=>{if(invite)void navigator.clipboard?.writeText(invite.code).then(()=>setCopied(true));};
 const status=(m:MemberView)=>m.status==='disabled'?<Tag tone="error">{tr('disabled','nonaktif')}</Tag>:m.activated?<Tag tone="ok">{tr('active','aktif')}</Tag>:m.inviteExpires?<Tag tone="warn">{tr('invite until','undangan s/d')} {new Date(m.inviteExpires).toLocaleDateString(locale,{day:'numeric',month:'short'})}</Tag>:<Tag>{tr('invite expired','undangan kedaluwarsa')}</Tag>;
 const checks=(id:string,grants:MemberGrant[],onChange:(g:MemberGrant)=>void,disabled?:boolean)=><div className="bo-ops-grants" role="group" aria-label={tr('Grants','Hak akses')}>{MEMBER_GRANTS.map(g=><label key={g} htmlFor={`${id}-${g}`}><input id={`${id}-${g}`} type="checkbox" checked={grants.includes(g)} disabled={disabled} onChange={()=>onChange(g)}/>{tr(...GRANT_LABELS[g])}</label>)}</div>;
 return <Section id="bo-members" eyebrow={tr('Access','Akses')} title={tr('Members','Anggota')}>
  <p className="bo-muted">{tr('Invited clients, partners and schools sign in on iot.ai.id with their own username and password. Grants decide which areas they unlock; the installer grant adds the desktop download to their profile. Accounts are disabled, never deleted. Codes are shown once and expire in 7 days.','Klien, mitra, dan sekolah undangan masuk di iot.ai.id dengan nama pengguna dan kata sandi masing-masing. Hak akses menentukan area yang terbuka; hak installer menambahkan unduhan desktop di profil mereka. Akun dinonaktifkan, tidak dihapus. Kode hanya tampil sekali dan kedaluwarsa dalam 7 hari.')}</p>
  {invite&&<Notice tone="warn" title={tr(`Invite code for ${invite.name}`,`Kode undangan untuk ${invite.name}`)} action={<Button size="sm" variant="secondary" onClick={copy}>{copied?tr('Copied','Tersalin'):tr('Copy code','Salin kode')}</Button>}>
   <span className="bo-ops-code" data-testid="member-invite-code">{invite.code}</span> · {tr('username','nama pengguna')} <code>{invite.username}</code> <span>{tr('Shown once. Copy it now and hand it to the person; it cannot be displayed again, only replaced with a new code.','Tampil sekali. Salin sekarang dan serahkan ke orangnya; kode tidak dapat ditampilkan lagi, hanya diganti kode baru.')}</span> <Button size="sm" variant="secondary" onClick={()=>setInvite(undefined)}>{tr('I have copied it','Sudah saya salin')}</Button>
  </Notice>}
  <form className="bo-ops-form" onSubmit={add} aria-label={tr('Add a member','Tambah anggota')}>
   <Input id="mb-username" label={tr('Username','Nama pengguna')} hint="a-z 0-9 . _ -" required minLength={3} maxLength={40} autoCapitalize="none" value={form.username} onChange={e=>setForm({...form,username:e.target.value.toLowerCase()})}/>
   <Input id="mb-name" label={tr('Name','Nama')} required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
   <Input id="mb-org" label={tr('Organization name','Nama organisasi')} value={form.orgName} onChange={e=>setForm({...form,orgName:e.target.value})}/>
   <Select id="mb-orgid" label={tr('Linked organization','Organisasi terhubung')} value={form.orgId} onChange={e=>setForm({...form,orgId:e.target.value})}><option value="">{tr('None','Tidak ada')}</option>{data.orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</Select>
   {checks('mb-g',form.grants,g=>setForm({...form,grants:toggle(form.grants,g)}))}
   <Button type="submit" size="sm" disabled={!/^[a-z0-9._-]{3,40}$/.test(form.username)||form.name.trim().length<2}>{tr('Add member','Tambah anggota')}</Button>
  </form>
  {!members.length&&<p className="bo-muted">{tr('No members yet.','Belum ada anggota.')}</p>}
  {members.length>0&&<div className="bo-ops-table"><table><thead><tr><th scope="col">{tr('Name','Nama')}</th><th scope="col">{tr('Username','Nama pengguna')}</th><th scope="col">{tr('Organization','Organisasi')}</th><th scope="col">{tr('Grants','Hak akses')}</th><th scope="col">{tr('Account','Akun')}</th><th scope="col">{tr('Action','Aksi')}</th></tr></thead><tbody>{members.map(m=><tr key={m.id} data-testid={`member-${m.username}`}>
   <th scope="row">{m.name}</th><td><code>{m.username}</code></td><td>{m.orgName||'—'}</td>
   <td>{checks(`mb-${m.id}`,m.grants,g=>void run(()=>opsAdmin.updateMember(m.id,{grants:MEMBER_GRANTS.filter(x=>(x===g)!==m.grants.includes(x))}),tr('Grants updated','Hak akses diperbarui')),m.status==='disabled')}</td>
   <td>{status(m)}</td>
   <td><div className="bo-ops-inline">{m.status==='active'&&<Button size="sm" variant="secondary" onClick={()=>void run(async()=>{const r=await opsAdmin.resetMemberInvite(m.id);reveal(r.member,r.inviteCode);},tr('New invite code created','Kode undangan baru dibuat'))}>{tr('Reset invite','Reset undangan')}</Button>}<Button size="sm" variant="secondary" onClick={()=>void run(async()=>{const r=await opsAdmin.updateMember(m.id,{status:m.status==='active'?'disabled':'active'});if(r.inviteCode)reveal(r,r.inviteCode);},m.status==='active'?tr('Member disabled and signed out','Anggota dinonaktifkan dan dikeluarkan'):tr('Member enabled','Anggota diaktifkan'))}>{m.status==='active'?tr('Disable','Nonaktifkan'):tr('Enable','Aktifkan')}</Button><Button size="sm" variant="secondary" aria-expanded={openId===m.id} onClick={()=>setOpenId(openId===m.id?'':m.id)}>{tr('History','Riwayat')}</Button></div>
    {openId===m.id&&<ol className="bo-ops-history">{[...m.history].reverse().map((h,n)=><li key={n}><small>{when(h.at,locale)} · {h.by}</small> {h.action}</li>)}</ol>}</td>
  </tr>)}</tbody></table></div>}
 </Section>;
}
