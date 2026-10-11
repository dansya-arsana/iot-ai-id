/** Lab Mitra school portal (/mitra, ADR 010): school admins and teachers. Commissions go to the school; the school distributes and confirms. */
import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import {useLang} from '../i18n';
import {PageShell} from '../site-shell';
import {Button,Card,Eyebrow,Input,Notice,Segmented,Spinner,Stat,StatGrid,Tag} from '../ui';
import {idr,OpsError,portal,type AllocationView,type BatchView,type PortalMe,type PortalPerson,type PortalTask,type Totals} from '../ops-client';
import {equalShares} from '../../../../packages/ops-contract/index';
import './mitra-page.css';

const tone=(s:string):'ok'|'warn'|'error'|'neutral'=>['verified','paid','approved','active'].includes(s)?'ok':['submitted','pending','assigned'].includes(s)?'warn':['rejected','disabled'].includes(s)?'error':'neutral';
const message=(e:unknown)=>e instanceof Error?e.message:String(e);
type Run=(action:()=>Promise<unknown>,ok:string)=>Promise<boolean>;
type Flash={tone:'ok'|'error';text:string};
type DashData={tasks:PortalTask[];allocations:AllocationView[];people:PortalPerson[];totals?:Totals;batches:BatchView[]};

export function Mitra(){
 const{tr}=useLang();
 useEffect(()=>{const meta=document.createElement('meta');meta.name='robots';meta.content='noindex,nofollow';document.head.append(meta);return()=>meta.remove();},[]);const [me,setMe]=useState<PortalMe|null|undefined>(undefined);const [welcome,setWelcome]=useState('');
 useEffect(()=>{let live=true;portal.me().then(m=>live&&setMe(m)).catch(()=>live&&setMe(null));return()=>{live=false;};},[]);
 const enter=async(username:string,fresh=false)=>{setMe(await portal.me());setWelcome(fresh?username:'');};
 return <PageShell width="wide" eyebrow={tr('Lab Mitra portal','Portal Lab Mitra')} title={me?me.school.name:tr('School portal','Portal sekolah')} lead={me?tr('Commissions are paid to your school account. Your school decides and records who receives what.','Komisi dibayarkan ke rekening sekolah Anda. Sekolah yang menentukan dan mencatat siapa menerima berapa.'):tr('For school admins and teachers of Lab Mitra schools.','Untuk admin sekolah dan guru di sekolah Lab Mitra.')}>
  {me===undefined?<div className="mt-loading"><Spinner label={tr('Loading','Memuat')}/></div>:me===null?<Auth onDone={enter}/>:<Dashboard me={me} welcome={welcome} onLogout={()=>{void portal.logout().finally(()=>{setMe(null);setWelcome('');});}}/>}
 </PageShell>;
}

function Auth({onDone}:{onDone:(username:string,fresh?:boolean)=>Promise<void>}){
 const{tr}=useLang();const [mode,setMode]=useState<'login'|'activate'>('login');const [f,setF]=useState({username:'',password:'',code:''});const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');
  try{if(mode==='login'){await portal.login(f.username,f.password);await onDone(f.username);}else{const r=await portal.activate(f.code,f.password);await onDone(r.username,true);}}
  catch(err){setError(err instanceof OpsError&&err.status===429?tr('Too many attempts. Please wait a few minutes.','Terlalu banyak percobaan. Tunggu beberapa menit.'):message(err));}finally{setBusy(false);}}
 return <div className="mt-auth"><Card tone="raised" as="section">
  <Segmented<'login'|'activate'> label={tr('Portal access','Akses portal')} value={mode} onChange={m=>{setMode(m);setError('');}} options={[{value:'login',label:tr('Sign in','Masuk')},{value:'activate',label:tr('Activate account','Aktivasi akun')}]}/>
  <form className="mt-form" onSubmit={submit} aria-label={mode==='login'?tr('Sign in','Masuk'):tr('Activate account','Aktivasi akun')}>
   {mode==='login'?<Input id="mt-username" label={tr('Username','Nama pengguna')} autoComplete="username" required value={f.username} onChange={e=>setF({...f,username:e.target.value})}/>
   :<Input id="mt-code" label={tr('Invite code','Kode undangan')} hint={tr('Format ABCD-EFGHJKMNPQ, from AIoT or your school admin. Valid for 7 days, single use.','Format ABCD-EFGHJKMNPQ, dari AIoT atau admin sekolah. Berlaku 7 hari, sekali pakai.')} autoComplete="one-time-code" required maxLength={15} value={f.code} onChange={e=>setF({...f,code:e.target.value.toUpperCase()})}/>}
   <Input id="mt-password" type="password" label={mode==='login'?tr('Password','Kata sandi'):tr('New password','Kata sandi baru')} hint={mode==='activate'?tr('At least 10 characters.','Minimal 10 karakter.'):undefined} autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='activate'?10:undefined} value={f.password} onChange={e=>setF({...f,password:e.target.value})}/>
   {error&&<Notice tone="error">{error}</Notice>}
   <Button type="submit" disabled={busy}>{busy?tr('Please wait…','Mohon tunggu…'):mode==='login'?tr('Sign in','Masuk'):tr('Activate and sign in','Aktifkan dan masuk')}</Button>
  </form></Card>
  <Card as="section"><Eyebrow>{tr('How it works','Cara kerja')}</Eyebrow><ol className="mt-steps"><li>{tr('AIoT verifies a test task done by your lab.','AIoT memverifikasi tugas uji yang dikerjakan lab Anda.')}</li><li>{tr('The lead teacher proposes how the 60% student share is split.','Guru pembimbing mengusulkan pembagian porsi siswa 60%.')}</li><li>{tr('The school admin approves. AIoT pays the school account.','Admin sekolah menyetujui. AIoT membayar ke rekening sekolah.')}</li><li>{tr('The school passes the money on and confirms it here.','Sekolah membagikan dana dan mengonfirmasi di sini.')}</li></ol></Card></div>;
}

async function fetchDash(isAdmin:boolean):Promise<DashData>{const [tasks,allocations,people,totals,batches]=await Promise.all([portal.tasks(),portal.allocations(),portal.people(),isAdmin?portal.summary():undefined,isAdmin?portal.batches():[]]);return{tasks,allocations,people,totals,batches};}
function Dashboard({me,welcome,onLogout}:{me:PortalMe;welcome:string;onLogout:()=>void}){
 const{tr}=useLang();const isAdmin=me.person.role==='school_admin';
 const [data,setData]=useState<DashData>();const [notice,setNotice]=useState<Flash>();const [error,setError]=useState('');
 const load=useCallback(()=>fetchDash(isAdmin).then(d=>{setData(d);setError('');}).catch(e=>setError(message(e))),[isAdmin]);
 useEffect(()=>{let live=true;fetchDash(isAdmin).then(d=>{if(live){setData(d);setError('');}}).catch(e=>{if(live)setError(message(e));});return()=>{live=false;};},[isAdmin]);
 const run:Run=useCallback(async(action,ok)=>{setNotice(undefined);try{await action();setNotice({tone:'ok',text:ok});await load();return true;}catch(e){setNotice({tone:'error',text:message(e)});return false;}},[load]);
 return <div className="mt-dash">
  <div className="mt-bar"><span>{tr('Signed in as','Masuk sebagai')} <b>{me.person.name}</b> · <Tag>{isAdmin?tr('school admin','admin sekolah'):tr('teacher','guru')}</Tag> · <code>{me.person.username}</code></span><Button size="sm" variant="secondary" onClick={onLogout}>{tr('Sign out','Keluar')}</Button></div>
  {welcome&&<Notice tone="ok" title={tr('Account activated','Akun aktif')}>{tr('Your username is ','Nama pengguna Anda: ')}<b>{welcome}</b>{tr('. Write it down: you need it with your password to sign in.','. Catat: diperlukan bersama kata sandi untuk masuk.')}</Notice>}
  {notice&&<Notice tone={notice.tone}>{notice.text}</Notice>}
  {error&&!data?<Notice tone="warn" title={tr('Could not load','Gagal memuat')} action={<Button size="sm" onClick={()=>void load()}>{tr('Retry','Coba lagi')}</Button>}>{error}</Notice>:!data?<div className="mt-loading"><Spinner label={tr('Loading','Memuat')}/></div>:isAdmin?<AdminView data={data} run={run}/>:<TeacherView me={me} data={data} run={run}/>}
 </div>;
}

function Tasks({tasks}:{tasks:PortalTask[]}){
 const{tr}=useLang();
 return <section aria-labelledby="mt-tasks-h" className="mt-section"><h2 id="mt-tasks-h">{tr('Tasks for your school','Tugas untuk sekolah Anda')}</h2>
  {!tasks.length?<p className="mt-muted">{tr('No tasks assigned yet. AIoT assigns verified test tasks to your school.','Belum ada tugas. AIoT menugaskan tugas uji ke sekolah Anda.')}</p>:
  <div className="mt-table"><table><thead><tr><th scope="col">{tr('Task','Tugas')}</th><th scope="col">{tr('Lead teacher','Guru pembimbing')}</th><th scope="col">{tr('Fee','Honor')}</th><th scope="col">{tr('Students / TEFA / teacher','Siswa / TEFA / guru')}</th><th scope="col">Status</th></tr></thead><tbody>{tasks.map(t=><tr key={t.id}><th scope="row">{t.title}{t.evidenceRef&&<small> · {t.evidenceRef}</small>}</th><td>{t.leadName||'—'}</td><td>{idr(t.feeIdr)}</td><td><small>{idr(t.payout.students)} / {idr(t.payout.tefa)} / {idr(t.payout.teacher)}</small></td><td><Tag tone={tone(t.status)}>{t.status}</Tag></td></tr>)}</tbody></table></div>}
 </section>;
}

function AdminView({data,run}:{data:DashData;run:Run}){
 const{tr}=useLang();const t=data.totals;const pending=data.allocations.filter(a=>a.status==='pending');const decided=data.allocations.filter(a=>a.status!=='pending');
 const [teacher,setTeacher]=useState('');const [student,setStudent]=useState({name:'',className:'',nisn:'',consent:false});const [invite,setInvite]=useState<{name:string;code:string}>();const [copied,setCopied]=useState(false);const [note,setNote]=useState<Record<string,string>>({});const [fileError,setFileError]=useState('');
 const teachers=data.people.filter(p=>p.role==='teacher'),students=data.people.filter(p=>p.role==='student');
 const addTeacher=(e:FormEvent)=>{e.preventDefault();void run(async()=>{const r=await portal.addTeacher(teacher.trim());setInvite({name:r.person.name,code:r.inviteCode});setCopied(false);setTeacher('');},tr('Teacher added','Guru ditambahkan'));};
 const addStudent=(e:FormEvent)=>{e.preventDefault();void run(()=>portal.addStudent({name:student.name.trim(),className:student.className.trim(),...(student.nisn.trim()?{nisn:student.nisn.trim()}:{}),guardianConsent:student.consent}),tr('Student added','Siswa ditambahkan')).then(ok=>ok&&setStudent({name:'',className:'',nisn:'',consent:false}));};
 return <>
  <StatGrid>
   <Stat label={tr('Commission accrued','Komisi terakru')} value={idr(t?.accruedIdr??0)}/>
   <Stat label={tr('Student share awaiting your approval','Porsi siswa menunggu persetujuan Anda')} value={idr(t?.pendingApprovalIdr??0)}/>
   <Stat label={tr('Paid to the school','Dibayar ke sekolah')} value={idr(t?.paidIdr??0)}/>
   <Stat label={tr('Waiting to be distributed','Menunggu dibagikan')} value={idr(t?.waitingIdr??0)}/>
  </StatGrid>

  <section aria-labelledby="mt-alloc-h" className="mt-section"><h2 id="mt-alloc-h">{tr('Allocations to approve','Alokasi untuk disetujui')}</h2>
   {!pending.length?<p className="mt-muted">{tr('Nothing to approve. Teachers propose a split once a task is assigned; you approve after AIoT verifies the task.','Tidak ada yang perlu disetujui. Guru mengusulkan pembagian setelah tugas ditugaskan; Anda menyetujui setelah AIoT memverifikasi tugas.')}</p>:
   <ul className="mt-list">{pending.map(a=><li key={a.id}><Card as="div"><div className="mt-card-head"><div><b>{a.taskTitle}</b><small>{tr('Proposed by','Diusulkan oleh')} {a.proposedByName} · {tr('student pool','porsi siswa')} {idr(a.studentPoolIdr)}</small></div><Tag tone={a.taskStatus==='verified'?'ok':'warn'}>{tr('task','tugas')} {a.taskStatus}</Tag></div>
    <ul className="mt-shares">{a.shares.map(s=><li key={s.studentId}><span>{s.name} <small>{s.className}</small></span><b>{idr(s.amountIdr)}</b></li>)}</ul>
    {a.taskStatus!=='verified'&&<p className="mt-muted">{tr('You can approve once AIoT has verified the task.','Anda dapat menyetujui setelah AIoT memverifikasi tugas.')}</p>}
    <div className="mt-actions"><Input id={`mt-note-${a.id}`} label={tr('Reason (if rejecting)','Alasan (jika menolak)')} value={note[a.id]??''} onChange={e=>setNote(n=>({...n,[a.id]:e.target.value}))}/><Button size="sm" disabled={a.taskStatus!=='verified'} aria-label={`${tr('Approve','Setujui')} ${a.taskTitle}`} onClick={()=>void run(()=>portal.decide(a.id,'approve'),tr('Allocation approved','Alokasi disetujui'))}>{tr('Approve','Setujui')}</Button><Button size="sm" variant="secondary" aria-label={`${tr('Reject','Tolak')} ${a.taskTitle}`} onClick={()=>void run(()=>portal.decide(a.id,'reject',note[a.id]),tr('Allocation rejected','Alokasi ditolak'))}>{tr('Reject','Tolak')}</Button></div>
   </Card></li>)}</ul>}
   {decided.length>0&&<details className="mt-decided"><summary>{tr(`Decided allocations (${decided.length})`,`Alokasi yang sudah diputuskan (${decided.length})`)}</summary><ul className="mt-shares">{decided.map(a=><li key={a.id}><span>{a.taskTitle} <small>{a.shares.map(s=>`${s.name} ${idr(s.amountIdr)}`).join(', ')}</small></span><Tag tone={tone(a.status)}>{a.status}</Tag></li>)}</ul></details>}
  </section>

  <section aria-labelledby="mt-batch-h" className="mt-section"><h2 id="mt-batch-h">{tr('Received batches','Batch yang diterima')}</h2>
   {fileError&&<Notice tone="error">{fileError}</Notice>}
   {!data.batches.length?<p className="mt-muted">{tr('No payments received yet. After AIoT transfers a batch to your school account it appears here.','Belum ada pembayaran. Setelah AIoT mentransfer batch ke rekening sekolah, batch muncul di sini.')}</p>:
   <ul className="mt-list">{data.batches.map(b=><li key={b.id}><Card as="div"><div className="mt-card-head"><div><b>{idr(b.amountIdr)}</b><small>{b.tasks.map(x=>x.title).join(', ')} · {tr('transfer','transfer')} {b.transferRef} · {b.paidAt?.slice(0,10)}</small></div><Tag tone={b.distributedAt?'ok':'warn'}>{b.distributedAt?tr('distributed','sudah dibagikan'):tr('to distribute','perlu dibagikan')}</Tag></div>
    <div className="mt-actions">{!b.distributedAt&&<Button size="sm" aria-label={`${tr('Confirm distributed','Konfirmasi sudah dibagikan')} ${b.id.slice(0,8)}`} onClick={()=>void run(()=>portal.confirmBatch(b.id),tr('Recorded as distributed','Tercatat sudah dibagikan'))}>{tr('Confirm distributed','Konfirmasi sudah dibagikan')}</Button>}<Button size="sm" variant="secondary" onClick={()=>void portal.downloadBatch(b.id).catch(e=>setFileError(message(e)))}>{tr('Download CSV','Unduh CSV')}</Button></div>
    {!b.distributedAt&&<p className="mt-muted">{tr('Confirm only after the money has gone to the students, the teacher and the TEFA fund as in the CSV.','Konfirmasi hanya setelah dana sampai ke siswa, guru, dan kas TEFA sesuai CSV.')}</p>}
   </Card></li>)}</ul>}
  </section>

  <Tasks tasks={data.tasks}/>

  <section aria-labelledby="mt-people-h" className="mt-section"><h2 id="mt-people-h">{tr('Teachers and students','Guru dan siswa')}</h2>
   {invite&&<Notice tone="warn" title={tr(`Invite code for ${invite.name}`,`Kode undangan untuk ${invite.name}`)} action={<Button size="sm" variant="secondary" onClick={()=>void navigator.clipboard?.writeText(invite.code).then(()=>setCopied(true))}>{copied?tr('Copied','Tersalin'):tr('Copy code','Salin kode')}</Button>}><span className="mt-code" data-testid="teacher-invite">{invite.code}</span> <span>{tr('Shown once. Give it to the teacher; it expires in 7 days.','Tampil sekali. Berikan ke guru; kedaluwarsa dalam 7 hari.')}</span> <Button size="sm" variant="secondary" onClick={()=>setInvite(undefined)}>{tr('I have copied it','Sudah saya salin')}</Button></Notice>}
   <div className="mt-forms">
    <form className="mt-form" onSubmit={addTeacher} aria-label={tr('Add teacher','Tambah guru')}><h3>{tr('Add teacher','Tambah guru')}</h3><Input id="mt-teacher-name" label={tr('Teacher name','Nama guru')} required value={teacher} onChange={e=>setTeacher(e.target.value)}/><Button type="submit" size="sm" disabled={teacher.trim().length<2}>{tr('Add teacher','Tambah guru')}</Button></form>
    <form className="mt-form" onSubmit={addStudent} aria-label={tr('Add student','Tambah siswa')}><h3>{tr('Add student','Tambah siswa')}</h3>
     <Input id="mt-student-name" label={tr('Student name','Nama siswa')} required value={student.name} onChange={e=>setStudent({...student,name:e.target.value})}/>
     <Input id="mt-student-class" label={tr('Class','Kelas')} required placeholder="XI TKJ 1" value={student.className} onChange={e=>setStudent({...student,className:e.target.value})}/>
     <Input id="mt-student-nisn" label={tr('NISN (optional)','NISN (opsional)')} inputMode="numeric" maxLength={10} value={student.nisn} onChange={e=>setStudent({...student,nisn:e.target.value.replace(/\D/g,'')})}/>
     <label className="mt-consent"><input type="checkbox" required checked={student.consent} onChange={e=>setStudent({...student,consent:e.target.checked})}/><span>{tr('The school has the written consent of this student’s parent or guardian to record the name and class for Lab Mitra work and for the split of commissions. We store only the name, class and optional NISN: no ID card, address or bank details.','Sekolah memiliki persetujuan tertulis orang tua/wali siswa ini untuk mencatat nama dan kelas untuk pekerjaan Lab Mitra dan pembagian komisi. Kami hanya menyimpan nama, kelas, dan NISN (opsional): tanpa KTP, alamat, atau data rekening.')}</span></label>
     <Button type="submit" size="sm" disabled={!student.consent||student.name.trim().length<2||!student.className.trim()}>{tr('Add student','Tambah siswa')}</Button></form>
   </div>
   <div className="mt-table"><table><caption>{tr('Teachers','Guru')}</caption><thead><tr><th scope="col">{tr('Name','Nama')}</th><th scope="col">{tr('Username','Nama pengguna')}</th><th scope="col">Status</th><th scope="col">{tr('Action','Aksi')}</th></tr></thead><tbody>{teachers.map(p=><tr key={p.id}><th scope="row">{p.name}</th><td><code>{p.username}</code></td><td><Tag tone={tone(p.status)}>{p.status==='disabled'?p.status:p.activated?'active':'invited'}</Tag></td><td><div className="mt-actions">{p.status==='active'&&<Button size="sm" variant="secondary" onClick={()=>void run(async()=>{const r=await portal.resetInvite(p.id);setInvite({name:p.name,code:r.inviteCode});setCopied(false);},tr('New invite code created','Kode undangan baru dibuat'))}>{tr('Reset invite','Reset undangan')}</Button>}<Button size="sm" variant="secondary" onClick={()=>void run(()=>portal.setStatus(p.id,p.status==='active'?'disabled':'active'),tr('Updated','Diperbarui'))}>{p.status==='active'?tr('Disable','Nonaktifkan'):tr('Enable','Aktifkan')}</Button></div></td></tr>)}{!teachers.length&&<tr><td colSpan={4}>{tr('No teachers yet.','Belum ada guru.')}</td></tr>}</tbody></table></div>
   <div className="mt-table"><table><caption>{tr('Students','Siswa')}</caption><thead><tr><th scope="col">{tr('Name','Nama')}</th><th scope="col">{tr('Class','Kelas')}</th><th scope="col">{tr('Allocated','Dialokasikan')}</th><th scope="col">{tr('Distributed','Dibagikan')}</th><th scope="col">Status</th><th scope="col">{tr('Action','Aksi')}</th></tr></thead><tbody>{students.map(p=><tr key={p.id}><th scope="row">{p.name}</th><td>{p.className}</td><td>{idr(p.allocatedIdr??0)}</td><td>{idr(p.distributedIdr??0)}</td><td><Tag tone={tone(p.status)}>{p.status}</Tag></td><td><Button size="sm" variant="secondary" aria-label={`${p.status==='active'?tr('Disable','Nonaktifkan'):tr('Enable','Aktifkan')} ${p.name}`} onClick={()=>void run(()=>portal.setStatus(p.id,p.status==='active'?'disabled':'active'),tr('Updated','Diperbarui'))}>{p.status==='active'?tr('Disable','Nonaktifkan'):tr('Enable','Aktifkan')}</Button></td></tr>)}{!students.length&&<tr><td colSpan={6}>{tr('No students yet.','Belum ada siswa.')}</td></tr>}</tbody></table></div>
  </section>
 </>;
}

function TeacherView({me,data,run}:{me:PortalMe;data:DashData;run:Run}){
 const{tr}=useLang();const students=useMemo(()=>data.people.filter(p=>p.role==='student'&&p.status==='active'),[data.people]);
 const mine=data.tasks.filter(t=>t.mine);
 return <>
  <section aria-labelledby="mt-mine-h" className="mt-section"><h2 id="mt-mine-h">{tr('Tasks you lead','Tugas yang Anda pimpin')}</h2>
   {!mine.length?<p className="mt-muted">{tr(`No tasks led by ${me.person.name} yet. AIoT sets the lead teacher when it assigns a task.`,`Belum ada tugas yang dipimpin ${me.person.name}. AIoT menetapkan guru pembimbing saat menugaskan.`)}</p>:
   <ul className="mt-list">{mine.map(t=><li key={t.id}><TaskCard task={t} students={students} allocation={data.allocations.find(a=>a.taskId===t.id&&(a.status==='pending'||a.status==='approved'))??data.allocations.find(a=>a.taskId===t.id)} run={run}/></li>)}</ul>}
  </section>
  <Tasks tasks={data.tasks}/>
 </>;
}

function TaskCard({task,students,allocation,run}:{task:PortalTask;students:PortalPerson[];allocation?:AllocationView;run:Run}){
 const{tr}=useLang();const pool=task.payout.students;const [picked,setPicked]=useState<Record<string,string>>({});const [evidence,setEvidence]=useState('');
 const ids=students.filter(s=>s.id in picked).map(s=>s.id);const sum=ids.reduce((n,id)=>n+(Number(picked[id])||0),0);
 const toggle=(id:string)=>{const next=new Set(ids);if(next.has(id))next.delete(id);else next.add(id);const order=students.filter(s=>next.has(s.id)).map(s=>s.id);const shares=equalShares(pool,order.length);setPicked(Object.fromEntries(order.map((sid,i)=>[sid,String(shares[i])])));};
 const canPropose=(!allocation||!['pending','approved'].includes(allocation.status))&&['assigned','submitted','verified'].includes(task.status);
 return <Card as="div"><div className="mt-card-head"><div><b>{task.title}</b><small>{idr(task.feeIdr)} · {tr('student pool','porsi siswa')} {idr(pool)}</small></div><div className="mt-tags"><Tag tone={tone(task.status)}>{task.status}</Tag>{allocation&&<Tag tone={tone(allocation.status)}>{tr('allocation','alokasi')} {allocation.status}</Tag>}</div></div>
  {task.instructions&&<p className="mt-muted">{task.instructions}</p>}
  {task.status==='assigned'&&<form className="mt-inline" onSubmit={e=>{e.preventDefault();void run(()=>portal.submitEvidence(task.id,evidence.trim()),tr('Evidence submitted','Bukti dikirim')).then(ok=>ok&&setEvidence(''));}}><Input id={`mt-ev-${task.id}`} label={tr('Evidence reference','Referensi bukti')} hint={tr('Job id or link to the test record.','Job id atau tautan catatan uji.')} value={evidence} onChange={e=>setEvidence(e.target.value)}/><Button size="sm" type="submit" disabled={!evidence.trim()}>{tr('Submit evidence','Kirim bukti')}</Button></form>}
  {task.evidenceRef&&task.status!=='assigned'&&<p className="mt-muted">{tr('Evidence','Bukti')}: {task.evidenceRef}</p>}
  {allocation&&['pending','approved'].includes(allocation.status)&&<ul className="mt-shares">{allocation.shares.map(s=><li key={s.studentId}><span>{s.name} <small>{s.className}</small></span><b>{idr(s.amountIdr)}</b></li>)}</ul>}
  {allocation?.status==='rejected'&&allocation.note&&<Notice tone="warn">{tr('Rejected by the school admin','Ditolak admin sekolah')}: {allocation.note}</Notice>}
  {canPropose&&<fieldset className="mt-alloc"><legend>{tr('Split the student share','Bagi porsi siswa')}</legend>
   {!students.length?<p className="mt-muted">{tr('Ask your school admin to add students first.','Minta admin sekolah menambah siswa terlebih dahulu.')}</p>:<>
    <p className="mt-muted">{tr('Pick the students who took part. Shares start equal; adjust if needed. They must add up to exactly the pool.','Pilih siswa yang ikut. Porsi awal sama rata; ubah bila perlu. Jumlahnya harus tepat sama dengan porsi siswa.')}</p>
    <ul className="mt-pick">{students.map(s=><li key={s.id}><label><input type="checkbox" checked={s.id in picked} onChange={()=>toggle(s.id)}/> {s.name} <small>{s.className}</small></label>{s.id in picked&&<Input id={`mt-amt-${task.id}-${s.id}`} hideLabel label={`${tr('Amount for','Jumlah untuk')} ${s.name}`} type="number" min={0} step={1} value={picked[s.id]} onChange={e=>setPicked(p=>({...p,[s.id]:e.target.value}))}/>}</li>)}</ul>
    <div className="mt-actions"><span className={sum===pool?'mt-sum is-ok':'mt-sum'}>{idr(sum)} / {idr(pool)}</span><Button size="sm" disabled={!ids.length||sum!==pool} onClick={()=>void run(()=>portal.propose(task.id,ids.map(studentId=>({studentId,amountIdr:Number(picked[studentId])||0}))),tr('Allocation proposed. The school admin will review it.','Alokasi diusulkan. Admin sekolah akan meninjau.')).then(ok=>ok&&setPicked({}))}>{tr('Propose allocation','Usulkan alokasi')}</Button></div></>}
  </fieldset>}
 </Card>;
}
