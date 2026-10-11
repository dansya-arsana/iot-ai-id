import test from 'node:test';
import assert from 'node:assert/strict';
import {Ops,OpsStore,RateLimit} from '../services/ops/ops.js';
import {equalShares,allocationErrors,payoutSplit,portalCan} from '../packages/ops-contract/index.js';

type R={status:number;data:any;setCookie?:string;text?:{type:string;body:string}};
function harness(){
 const clock={t:Date.parse('2026-10-11T00:00:00Z')};
 const ops=new Ops(new OpsStore(':memory:'),new Map(),new RateLimit(),()=>new Date(clock.t));
 const admin=async(method:string,path:string,body?:unknown):Promise<R>=>(await ops.handle({method,path:'/ops/v1/admin/'+path,body,ip:'9.9.9.9',admin:{user:'owner'}}))as R;
 const portal=async(method:string,path:string,body?:unknown,o:{cookie?:string;csrf?:boolean;ip?:string;loopback?:boolean}={}):Promise<R>=>(await ops.handle({method,path:'/ops/v1/portal/'+path,body,ip:o.ip??'5.5.5.5',headers:{cookie:o.cookie?`aiot_portal=${o.cookie}`:undefined,'x-aiot-portal':o.csrf===false?'':'1'},plainLoopback:o.loopback}))as R;
 const tokenOf=(r:R)=>/aiot_portal=([^;]*)/.exec(r.setCookie??'')?.[1]??'';
 /** Creates a school, its activated school admin session and an activated teacher session. */
 async function school(name='SMK Negeri Contoh'){
  const org=(await admin('POST','organizations',{type:'school',name,status:'active'})).data;
  const made=(await admin('POST','people',{orgId:org.id,name:'Siti Admin'})).data;
  const act=await portal('POST','activate',{code:made.inviteCode,password:'correct horse battery'});
  const sa=tokenOf(act);
  const t=(await portal('POST','people',{role:'teacher',name:'Budi Guru'},{cookie:sa})).data;
  const teacher=tokenOf(await portal('POST','activate',{code:t.inviteCode,password:'another long password'}));
  const students:any[]=[];
  for(const n of ['Ani','Bayu','Cici'])students.push((await portal('POST','people',{role:'student',name:`${n} Siswa`,className:'XI TKJ',guardianConsent:true},{cookie:sa})).data.person);
  return{org,sa,teacher,teacherId:t.person.id,students,adminPerson:made.person,saUser:act.data.username};
 }
 async function verifiedTask(s:Awaited<ReturnType<typeof school>>,fee=150001){
  const task=(await admin('POST','tasks',{title:'Humidity soak 24h',feeIdr:fee,labId:s.org.id,leadId:s.teacherId})).data;
  assert.equal((await portal('POST',`tasks/${task.id}/evidence`,{evidenceRef:'job 1'},{cookie:s.teacher})).status,200);
  assert.equal((await admin('PATCH',`tasks/${task.id}`,{action:'verify'})).data.status,'verified');
  return task;
 }
 const shares=(s:Awaited<ReturnType<typeof school>>,fee=150001)=>equalShares(payoutSplit(fee).students,s.students.length).map((amountIdr,i)=>({studentId:s.students[i].id,amountIdr}));
 return{ops,clock,admin,portal,tokenOf,school,verifiedTask,shares};
}

test('equalShares gives the remainder to the first students and the pool is exact',()=>{
 assert.deepEqual(equalShares(90000,3),[30000,30000,30000]);
 assert.deepEqual(equalShares(10,3),[4,3,3]);
 assert.equal(equalShares(90001,4).reduce((a,b)=>a+b,0),90001);
 assert.deepEqual(equalShares(100,0),[]);
 assert.equal(allocationErrors(100,[{studentId:'a',amountIdr:60},{studentId:'b',amountIdr:30}])[0],'Shares must add up to the student pool of 100 (got 90)');
 assert.deepEqual(allocationErrors(100,[{studentId:'a',amountIdr:100}]),[]);
 assert.equal(portalCan('teacher','allocations.decide'),false);assert.equal(portalCan('school_admin','allocations.decide'),true);assert.equal(portalCan('student','tasks.read'),false);
});

test('ledger is append-only: UPDATE and DELETE abort, and there is no single-row reversal route',async()=>{
 const h=harness();const s=await h.school();await h.verifiedTask(s);
 const db=h.ops.store.db;
 assert.throws(()=>db.exec('UPDATE ledger SET amount_idr=1'),/append-only/);
 assert.throws(()=>db.exec('DELETE FROM ledger'),/append-only/);
 const first=h.ops.store.ledger.entries()[0];
 assert.equal((await h.admin('POST',`ledger/${first.id}/reverse`,{reason:'typo'})).status,404,'generic per-row reverse is gone');
 assert.equal(h.ops.store.ledger.entries().length,4);
});

test('verify accrues 60/25/15 plus the amount owed; a whole-accrual reversal is atomic and returns the task to submitted',async()=>{
 const h=harness();const s=await h.school();const task=await h.verifiedTask(s);const l=h.ops.store.ledger;
 const split=payoutSplit(150001);
 assert.equal(l.total({account:'student_pool',taskId:task.id}),split.students);assert.equal(l.total({account:'tefa',taskId:task.id}),split.tefa);assert.equal(l.total({account:'teacher',taskId:task.id}),split.teacher);
 assert.equal(l.total({account:`payable:${s.org.id}`}),150001);
 assert.equal(l.total({account:'student_pool'})+l.total({account:'tefa'})+l.total({account:'teacher'}),l.total({account:`payable:${s.org.id}`}),'pools add up to the fee');
 assert.equal((await h.admin('POST',`tasks/${task.id}/reverse-accrual`,{})).status,400,'reason required');
 assert.equal((await h.admin('POST','tasks/not-a-uuid/reverse-accrual',{reason:'oops'})).status,404,'unknown ids are 404 (task lookup precedes)');
 const r=await h.admin('POST',`tasks/${task.id}/reverse-accrual`,{reason:'verified by mistake'});assert.equal(r.status,200);assert.equal(r.data.status,'submitted');assert.ok(r.data.history.at(-1).action.includes('verified by mistake'));
 for(const a of ['student_pool','tefa','teacher',`payable:${s.org.id}`])assert.equal(l.total({account:a}),0,a);
 assert.equal(h.ops.commissions.totals(s.org.id).accruedIdr,0);assert.equal(l.entries().length,8,'nothing edited or removed');
 assert.equal((await h.admin('POST',`tasks/${task.id}/reverse-accrual`,{reason:'again'})).status,409,'only verified tasks');
 assert.equal((await h.admin('PATCH',`tasks/${task.id}`,{action:'verify'})).data.status,'verified');assert.equal(l.total({account:`payable:${s.org.id}`}),150001,'re-verify accrues once more');
});

test('allocation reversal: whole and atomic, only before a batch, balances stay consistent and never negative',async()=>{
 const h=harness();const s=await h.school();const task=await h.verifiedTask(s);const l=h.ops.store.ledger;
 const alloc=(await h.portal('POST','allocations',{taskId:task.id,shares:h.shares(s)},{cookie:s.teacher})).data;
 assert.equal((await h.admin('POST',`allocations/${alloc.id}/reverse`,{reason:'x y z'})).status,409,'pending cannot be reversed');
 await h.portal('POST',`allocations/${alloc.id}/approve`,{},{cookie:s.sa});
 assert.equal((await h.admin('POST',`tasks/${task.id}/reverse-accrual`,{reason:'nope'})).status,409,'approved allocation blocks accrual reversal');
 assert.equal((await h.admin('POST',`allocations/${alloc.id}/reverse`,{})).status,400);
 const r=await h.admin('POST',`allocations/${alloc.id}/reverse`,{reason:'wrong students'});assert.equal(r.status,200);assert.equal(r.data.status,'reversed');
 assert.equal(l.total({account:'student_pool'}),payoutSplit(150001).students,'pool restored');
 for(const st of s.students)assert.equal(l.total({account:`student:${st.id}`}),0);
 for(const a of ['student_pool','tefa','teacher'])assert.ok(l.total({account:a})>=0);
 assert.equal(h.ops.commissions.totals(s.org.id).approvedIdr,0);
 assert.equal((await h.admin('POST',`allocations/${alloc.id}/reverse`,{reason:'twice'})).status,409);
 assert.equal((await h.admin('POST','batches',{orgId:s.org.id})).status,409,'a reversed allocation cannot be batched');
 // New proposal, approve, batch: reversal is then refused and the accrual reversal too.
 const again=(await h.portal('POST','allocations',{taskId:task.id,shares:h.shares(s)},{cookie:s.teacher})).data;await h.portal('POST',`allocations/${again.id}/approve`,{},{cookie:s.sa});
 await h.admin('POST','batches',{orgId:s.org.id});
 assert.equal((await h.admin('POST',`allocations/${again.id}/reverse`,{reason:'too late'})).status,409,'batched');
 assert.equal((await h.admin('POST',`tasks/${task.id}/reverse-accrual`,{reason:'too late'})).status,409);
 assert.equal(l.entries().some(e=>e.kind==='reversal:payout'),false);
});

test('allocation: must sum to the pool, only the lead teacher proposes, a proposer or teacher cannot approve',async()=>{
 const h=harness();const s=await h.school();const task=await h.verifiedTask(s);
 const good=h.shares(s);
 assert.equal((await h.portal('POST','allocations',{taskId:task.id,shares:good.map((x,i)=>i?x:{...x,amountIdr:x.amountIdr+1})},{cookie:s.teacher})).status,400,'sum must equal the pool');
 assert.equal((await h.portal('POST','allocations',{taskId:task.id,shares:[good[0],good[0]]},{cookie:s.teacher})).status,400,'duplicate student');
 assert.equal((await h.portal('POST','allocations',{taskId:task.id,shares:good},{cookie:s.sa})).status,403,'task has a lead teacher');
 const other=await h.school('SMK Lain');assert.equal((await h.portal('POST','allocations',{taskId:task.id,shares:good},{cookie:other.teacher})).status,404,'other school cannot see the task');
 const made=await h.portal('POST','allocations',{taskId:task.id,shares:good},{cookie:s.teacher});assert.equal(made.status,201);assert.equal(made.data.shares[0].name,'Ani Siswa');
 assert.equal((await h.portal('POST','allocations',{taskId:task.id,shares:good},{cookie:s.teacher})).status,409,'one live allocation per task');
 assert.equal((await h.portal('POST',`allocations/${made.data.id}/approve`,{},{cookie:s.teacher})).status,403,'teacher cannot approve');
 const approve=await h.portal('POST',`allocations/${made.data.id}/approve`,{},{cookie:s.sa});assert.equal(approve.status,200);assert.equal(approve.data.status,'approved');
 assert.equal((await h.portal('POST',`allocations/${made.data.id}/approve`,{},{cookie:s.sa})).status,409);
 const l=h.ops.store.ledger;assert.equal(l.total({account:'student_pool'}),0,'pool moved to students');
 assert.equal(l.total({account:`student:${s.students[0].id}`}),good[0].amountIdr);
 // Two-person rule when a school admin proposes for a task without a lead.
 const t2=(await h.admin('POST','tasks',{title:'No-lead soak test',feeIdr:100000,labId:s.org.id})).data;
 const own=await h.portal('POST','allocations',{taskId:t2.id,shares:equalShares(60000,3).map((a,i)=>({studentId:s.students[i].id,amountIdr:a}))},{cookie:s.sa});assert.equal(own.status,201);
 await h.admin('PATCH',`tasks/${t2.id}`,{action:'submit',evidenceRef:'job 2'});await h.admin('PATCH',`tasks/${t2.id}`,{action:'verify'});
 assert.equal((await h.portal('POST',`allocations/${own.data.id}/approve`,{},{cookie:s.sa})).status,403,'proposer cannot approve own allocation');
});

test('tenant isolation: school A cannot read or touch school B',async()=>{
 const h=harness();const a=await h.school('SMK A');const b=await h.school('SMK B');const task=await h.verifiedTask(b);
 const alloc=(await h.portal('POST','allocations',{taskId:task.id,shares:h.shares(b)},{cookie:b.teacher})).data;
 assert.equal((await h.portal('GET','tasks',undefined,{cookie:a.sa})).data.tasks.length,0);
 const people=(await h.portal('GET','people',undefined,{cookie:a.sa})).data.people;assert.ok(people.every((p:any)=>![...b.students.map((s:any)=>s.id),b.teacherId].includes(p.id)));
 assert.equal((await h.portal('PATCH',`people/${b.students[0].id}`,{status:'disabled'},{cookie:a.sa})).status,404);
 assert.equal((await h.portal('POST',`allocations/${alloc.id}/approve`,{},{cookie:a.sa})).status,404);
 assert.equal((await h.portal('POST','allocations',{taskId:task.id,shares:h.shares(b)},{cookie:a.teacher})).status,404);
 assert.deepEqual((await h.portal('GET','allocations',undefined,{cookie:a.sa})).data.allocations,[]);
 assert.equal((await h.portal('GET','summary',undefined,{cookie:a.sa})).data.accruedIdr,0);
 // A student of school B cannot be allocated by school A.
 const taskA=await h.verifiedTask(a);
 assert.equal((await h.portal('POST','allocations',{taskId:taskA.id,shares:[{studentId:b.students[0].id,amountIdr:payoutSplit(150001).students}]},{cookie:a.teacher})).status,400);
});

test('invite codes: single use, expire after 7 days, shown once, stored hashed; passwords need 10 characters',async()=>{
 const h=harness();const org=(await h.admin('POST','organizations',{type:'school',name:'SMK Kode',status:'active'})).data;
 const made=(await h.admin('POST','people',{orgId:org.id,name:'Rina Kepala'})).data;
 assert.match(made.inviteCode,/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{10}$/);assert.match(made.person.username,/^rina\.smk-kode$/);
 assert.equal(JSON.stringify(h.ops.store.list('people')).includes(made.inviteCode),false);
 assert.equal(JSON.stringify(h.ops.store.db.prepare('SELECT * FROM logins').all()).includes(made.inviteCode),false,'stored as a hash');
 assert.equal((await h.admin('GET','people')).data.people[0].inviteCode,undefined);
 assert.equal((await h.portal('POST','activate',{code:made.inviteCode,password:'short'})).status,400);
 assert.equal((await h.portal('POST','activate',{code:made.inviteCode,password:'a long enough password'})).status,200);
 assert.equal((await h.portal('POST','activate',{code:made.inviteCode,password:'a long enough password'})).status,400,'single use');
 const again=(await h.admin('POST',`people/${made.person.id}/invite`)).data;assert.notEqual(again.inviteCode,made.inviteCode);
 h.clock.t+=7*86_400_000+1000;
 assert.equal((await h.portal('POST','activate',{code:again.inviteCode,password:'a long enough password'})).status,400,'expired');
 h.clock.t-=3*86_400_000;
 const fresh=(await h.admin('POST',`people/${made.person.id}/invite`)).data;h.clock.t+=6*86_400_000;
 assert.equal((await h.portal('POST','activate',{code:fresh.inviteCode.toLowerCase(),password:'a long enough password'})).status,200,'valid within 7 days, case-insensitive');
});

test('login: five failures lock the person for 15 minutes; disabled people cannot sign in; logout ends the session',async()=>{
 const h=harness();const s=await h.school();
 for(let i=0;i<5;i++)assert.equal((await h.portal('POST','login',{username:s.saUser,password:'wrong password!'})).status,401);
 assert.equal((await h.portal('POST','login',{username:s.saUser,password:'correct horse battery'})).status,401,'locked even with the right password');
 h.clock.t+=15*60_000+1;
 const ok=await h.portal('POST','login',{username:s.saUser,password:'correct horse battery'});assert.equal(ok.status,200);
 const token=h.tokenOf(ok);assert.equal((await h.portal('GET','me',undefined,{cookie:token})).status,200);
 assert.equal((await h.portal('POST','logout',{},{cookie:token})).status,200);
 assert.equal((await h.portal('GET','me',undefined,{cookie:token})).status,401);
 assert.equal((await h.portal('POST','login',{username:'nobody.nowhere',password:'whatever whatever'})).status,401);
 const t=h.tokenOf(await h.portal('POST','login',{username:s.saUser,password:'correct horse battery'}));
 await h.admin('PATCH',`people/${s.adminPerson.id}`,{status:'disabled'});
 assert.equal((await h.portal('GET','me',undefined,{cookie:t})).status,401,'disabling ends sessions');
 assert.equal((await h.portal('POST','login',{username:s.saUser,password:'correct horse battery'})).status,401);
 assert.equal((await h.admin('PATCH',`people/${s.adminPerson.id}`,{name:'Other Name'})).status,400,'admins only toggle status');
 const limited=new Ops(new OpsStore(':memory:'));for(let i=0;i<21;i++)await limited.handle({method:'POST',path:'/ops/v1/portal/login',body:{username:'abc',password:'x'},ip:'7.7.7.7',headers:{'x-aiot-portal':'1'}});
 assert.equal((await limited.handle({method:'POST',path:'/ops/v1/portal/login',body:{username:'abc',password:'x'},ip:'7.7.7.7',headers:{'x-aiot-portal':'1'}}))?.status,429,'per-IP limit');
});

test('session cookie: HttpOnly, SameSite=Strict, scoped path, 12 h, Secure except plain http on loopback; token stored hashed',async()=>{
 const h=harness();const s=await h.school();
 const prod=await h.portal('POST','login',{username:s.saUser,password:'correct horse battery'});
 for(const part of ['HttpOnly','SameSite=Strict','Path=/ops/v1/portal','Max-Age=43200','Secure'])assert.ok(prod.setCookie!.includes(part),part);
 const local=await h.portal('POST','login',{username:s.saUser,password:'correct horse battery'},{loopback:true});
 assert.equal(local.setCookie!.includes('Secure'),false);assert.ok(local.setCookie!.includes('HttpOnly'));
 const token=h.tokenOf(prod);assert.ok(Buffer.from(token,'base64url').length===32);
 assert.equal(JSON.stringify(h.ops.store.db.prepare('SELECT * FROM sessions').all()).includes(token),false);
 const out=await h.portal('POST','logout',{},{cookie:token});assert.ok(out.setCookie!.includes('Max-Age=0'));
});

test('CSRF: portal writes need X-AIoT-Portal: 1; reads do not',async()=>{
 const h=harness();const s=await h.school();
 assert.equal((await h.portal('POST','people',{role:'teacher',name:'Eko Guru'},{cookie:s.sa,csrf:false})).status,403);
 assert.equal((await h.portal('POST','login',{username:s.saUser,password:'correct horse battery'},{csrf:false})).status,403);
 assert.equal((await h.portal('GET','people',undefined,{cookie:s.sa,csrf:false})).status,200);
 assert.equal((await h.portal('GET','people')).status,401,'no cookie, no data');
});

test('people: students need guardian consent (recorded server-side), minimal data, never deleted',async()=>{
 const h=harness();const s=await h.school();
 const base={role:'student',name:'Dewi Siswa',className:'XI TKJ'};
 assert.equal((await h.portal('POST','people',base,{cookie:s.sa})).status,400);
 assert.equal((await h.portal('POST','people',{...base,guardianConsent:false},{cookie:s.sa})).status,400);
 assert.equal((await h.portal('POST','people',{...base,guardianConsent:true,nik:'3171000000000001'},{cookie:s.sa})).status,400,'no national ID or bank fields');
 const made=(await h.portal('POST','people',{...base,guardianConsent:true,nisn:'0012345678'},{cookie:s.sa})).data;
 assert.equal(made.inviteCode,undefined);assert.equal(made.person.guardianConsent.recordedBy,'Siti Admin');assert.ok(made.person.guardianConsent.at);
 assert.equal((await h.portal('POST','people',{role:'student',name:'Eka',className:'X',guardianConsent:true},{cookie:s.teacher})).status,403,'teachers cannot manage people');
 assert.equal((await h.portal('DELETE',`people/${made.person.id}`,undefined,{cookie:s.sa})).status,404,'no delete route');
 const off=await h.portal('PATCH',`people/${made.person.id}`,{status:'disabled'},{cookie:s.sa});assert.equal(off.data.status,'disabled');assert.ok(off.data.history.length>=2);
 assert.ok(h.ops.store.get('people',made.person.id));
 const view=(await h.portal('GET','people',undefined,{cookie:s.teacher})).data.people;assert.ok(view.every((p:any)=>p.role==='student'&&p.status==='active'&&!('nisn' in p)),'teachers see active students only');
});

test('batches: only from approved allocations; paid needs a transfer reference; tasks become paid; distribution and CSV',async()=>{
 const h=harness();const s=await h.school();const task=await h.verifiedTask(s);
 assert.equal((await h.admin('POST','batches',{orgId:s.org.id})).status,409,'nothing approved yet');
 const alloc=(await h.portal('POST','allocations',{taskId:task.id,shares:h.shares(s)},{cookie:s.teacher})).data;
 assert.equal((await h.admin('POST','batches',{orgId:s.org.id})).status,409,'pending is not enough');
 await h.portal('POST',`allocations/${alloc.id}/approve`,{},{cookie:s.sa});
 const batch=(await h.admin('POST','batches',{orgId:s.org.id})).data;assert.equal(batch.amountIdr,150001);
 assert.equal((await h.admin('POST','batches',{orgId:s.org.id})).status,409,'already batched');
 assert.equal((await h.portal('GET','batches',undefined,{cookie:s.sa})).data.batches.length,0,'school sees batches once paid');
 assert.equal((await h.admin('POST',`batches/${batch.id}/paid`,{paidAt:'2026-10-31'})).status,400);
 assert.equal((await h.admin('POST',`batches/${batch.id}/paid`,{transferRef:'',paidAt:'2026-10-31'})).status,400,'transfer reference is required');
 assert.equal((await h.portal('POST',`batches/${batch.id}/confirm`,{},{cookie:s.sa})).status,404,'unpaid batches are invisible to the school');
 const paid=await h.admin('POST',`batches/${batch.id}/paid`,{transferRef:'BCA-20261031-001',paidAt:'2026-10-31'});assert.equal(paid.data.status,'paid');
 assert.equal((await h.admin('POST',`batches/${batch.id}/paid`,{transferRef:'again',paidAt:'2026-10-31'})).status,409);
 const tasks=(await h.admin('GET','tasks')).data.tasks;assert.equal(tasks.find((t:any)=>t.id===task.id).status,'paid');
 const l=h.ops.store.ledger;assert.equal(l.total({account:`payable:${s.org.id}`}),0);assert.equal(l.entries({account:`payable:${s.org.id}`}).at(-1)!.ref,'BCA-20261031-001');
 let totals=(await h.portal('GET','summary',undefined,{cookie:s.sa})).data;assert.equal(totals.paidIdr,150001);assert.equal(totals.waitingIdr,150001);assert.equal(totals.distributedIdr,0);
 assert.equal((await h.portal('POST',`batches/${batch.id}/confirm`,{},{cookie:s.teacher})).status,403);
 assert.equal((await h.portal('POST',`batches/${batch.id}/confirm`,{},{cookie:s.sa})).status,200);
 assert.equal((await h.portal('POST',`batches/${batch.id}/confirm`,{},{cookie:s.sa})).status,409);
 totals=(await h.portal('GET','summary',undefined,{cookie:s.sa})).data;assert.equal(totals.waitingIdr,0);assert.equal(totals.distributedIdr,150001);
 const person=h.ops.commissions.personTotals(s.students[0].id);assert.deepEqual(person,{allocatedIdr:30000,distributedIdr:30000,balanceIdr:0});
 const csv=await h.portal('GET',`batches/${batch.id}/csv`,undefined,{cookie:s.sa});assert.equal(csv.status,200);assert.match(csv.text!.type,/text\/csv/);
 assert.match(csv.text!.body,/student,Ani Siswa,XI TKJ,30000/);assert.match(csv.text!.body,/teacher,Budi Guru,,22500/);assert.match(csv.text!.body,/tefa,School TEFA fund,,37501/);
 assert.equal((await h.admin('GET',`batches/${batch.id}/csv`)).status,200);
 const other=await h.school('SMK Z');assert.equal((await h.portal('GET',`batches/${batch.id}/csv`,undefined,{cookie:other.sa})).status,404);
 const overview=(await h.admin('GET','commissions')).data;assert.equal(overview.schools.find((x:any)=>x.orgId===s.org.id).totals.paidIdr,150001);assert.equal(overview.batches.length,1);
});

test('teacher can submit evidence only for tasks they lead, and rejection frees the allocation for a new proposal',async()=>{
 const h=harness();const s=await h.school();
 const task=(await h.admin('POST','tasks',{title:'Vibration test',feeIdr:100000,labId:s.org.id,leadId:s.teacherId})).data;
 const other=await h.school('SMK Q');
 assert.equal((await h.portal('POST',`tasks/${task.id}/evidence`,{evidenceRef:'x'},{cookie:other.teacher})).status,404);
 assert.equal((await h.portal('POST',`tasks/${task.id}/evidence`,{evidenceRef:'x'},{cookie:s.sa})).status,403);
 assert.equal((await h.portal('POST',`tasks/${task.id}/evidence`,{evidenceRef:'job 9'},{cookie:s.teacher})).data.status,'submitted');
 assert.equal((await h.admin('POST','tasks',{title:'Bad lead',feeIdr:100000,labId:s.org.id,leadId:s.students[0].id})).status,400,'lead must be a teacher');
 const a=(await h.portal('POST','allocations',{taskId:task.id,shares:h.shares(s,100000)},{cookie:s.teacher})).data;
 assert.equal((await h.portal('POST',`allocations/${a.id}/reject`,{note:'wrong split'},{cookie:s.sa})).data.status,'rejected');
 assert.equal((await h.portal('POST','allocations',{taskId:task.id,shares:h.shares(s,100000)},{cookie:s.teacher})).status,201);
 assert.ok((await h.admin('GET','tasks')).data.tasks.find((t:any)=>t.id===task.id).history.some((x:any)=>x.action.startsWith('submit')));
});

test('stale allocations: reassigning school or lead voids pending ones; approve and batch refuse out-of-date allocations',async()=>{
 const h=harness();const a=await h.school('SMK Asal');const b=await h.school('SMK Baru');
 const task=(await h.admin('POST','tasks',{title:'Reassign me',feeIdr:150000,labId:a.org.id,leadId:a.teacherId})).data;
 const alloc=(await h.portal('POST','allocations',{taskId:task.id,shares:h.shares(a,150000)},{cookie:a.teacher})).data;
 // Change the lead to a second teacher of the same school: pending proposal is voided.
 const t2=(await h.portal('POST','people',{role:'teacher',name:'Dodi Guru'},{cookie:a.sa})).data;
 assert.equal((await h.admin('PATCH',`tasks/${task.id}`,{action:'assign',labId:a.org.id,leadId:t2.person.id})).status,200);
 const v=(await h.portal('GET','allocations',undefined,{cookie:a.sa})).data.allocations.find((x:any)=>x.id===alloc.id);
 assert.equal(v.status,'void');assert.ok(v.history.at(-1).action.startsWith('void:'));
 assert.equal((await h.portal('POST',`allocations/${alloc.id}/approve`,{},{cookie:a.sa})).status,409,'void cannot be approved');
 // Reassign to another school: the new school's allocation is separate; the old one stays void.
 const act2=await h.portal('POST','activate',{code:t2.inviteCode,password:'yet another password'});assert.equal(act2.status,200);
 const p2=(await h.portal('POST','allocations',{taskId:task.id,shares:h.shares(a,150000)},{cookie:h.tokenOf(act2)})).data;assert.ok(p2.id,JSON.stringify(p2));
 assert.equal((await h.admin('PATCH',`tasks/${task.id}`,{action:'assign',labId:b.org.id,leadId:b.teacherId})).status,200);
 assert.equal(h.ops.store.get<any>('allocations',p2.id).status,'void');
 await h.admin('PATCH',`tasks/${task.id}`,{action:'submit',evidenceRef:'job 7'});await h.admin('PATCH',`tasks/${task.id}`,{action:'verify'});
 assert.equal((await h.portal('POST',`allocations/${p2.id}/approve`,{},{cookie:a.sa})).status,409,'void stays void for the old school');
 // Verified tasks cannot change school or lead.
 assert.equal((await h.admin('PATCH',`tasks/${task.id}`,{action:'assign',labId:a.org.id,leadId:a.teacherId})).status,409);
 assert.equal((await h.admin('PATCH',`tasks/${task.id}`,{action:'assign',labId:b.org.id})).status,409);
 // Defence in depth: a forged pending/approved allocation from the old school or old lead is refused.
 const forged:any={...h.ops.store.get<any>('allocations',p2.id),status:'pending',orgId:a.org.id};
 assert.equal(h.ops.commissions.valid(forged,h.ops.store.get<any>('tasks',task.id)),false,'org must equal task.labId');
 assert.equal(h.ops.commissions.valid({...forged,orgId:b.org.id,proposedBy:t2.person.id},h.ops.store.get<any>('tasks',task.id)),false,'proposer must be the current lead');
 const good=(await h.portal('POST','allocations',{taskId:task.id,shares:h.shares(b,150000)},{cookie:b.teacher})).data;
 await h.portal('POST',`allocations/${good.id}/approve`,{},{cookie:b.sa});
 // Force a stale approved allocation: batch creation must skip it.
 const row=h.ops.store.get<any>('allocations',good.id);h.ops.store.put('allocations',{...row,proposedBy:t2.person.id});
 assert.equal((await h.admin('POST','batches',{orgId:b.org.id})).status,409,'batch refuses allocation whose proposer is not the lead');
 h.ops.store.put('allocations',row);assert.equal((await h.admin('POST','batches',{orgId:b.org.id})).status,201);
});

test('two-person bypass: a school admin cannot reset a busy teacher; AIoT can, and any reset voids pending proposals',async()=>{
 const h=harness();const s=await h.school();const task=await h.verifiedTask(s);
 const alloc=(await h.portal('POST','allocations',{taskId:task.id,shares:h.shares(s)},{cookie:s.teacher})).data;
 const blocked=await h.portal('POST',`people/${s.teacherId}/invite`,{},{cookie:s.sa});
 assert.equal(blocked.status,409);assert.match(blocked.data.error,/AIoT must reset/);
 const reset=await h.admin('POST',`people/${s.teacherId}/invite`);assert.equal(reset.status,200);
 assert.equal(h.ops.store.get<any>('allocations',alloc.id).status,'void','AIoT reset voids pending proposals');
 assert.equal((await h.portal('GET','allocations',undefined,{cookie:s.teacher})).status,401,'sessions ended');
 // A teacher with no open work can be reset by the school admin; a new teacher leads nothing until AIoT assigns.
 const idle=(await h.portal('POST','people',{role:'teacher',name:'Eko Guru'},{cookie:s.sa})).data;
 assert.equal((await h.portal('POST',`people/${idle.person.id}/invite`,{},{cookie:s.sa})).status,200);
 const t=(await h.admin('POST','tasks',{title:'Lead check',feeIdr:100000,labId:s.org.id})).data;
 assert.equal((await h.portal('GET','tasks',undefined,{cookie:s.sa})).data.tasks.find((x:any)=>x.id===t.id).leadId,null,'only AIoT sets leads');
});

test('invite codes: lookup id plus secret, one scrypt per attempt, wrong secret leaves the invite usable',async()=>{
 const h=harness();const org=(await h.admin('POST','organizations',{type:'school',name:'SMK Indeks',status:'active'})).data;
 const made=(await h.admin('POST','people',{orgId:org.id,name:'Tia Kepala'})).data;
 const [id,secret]=made.inviteCode.split('-');
 const row=h.ops.store.db.prepare('SELECT invite_id,invite_hash FROM logins').get() as any;assert.equal(row.invite_id,id);assert.equal(JSON.stringify(row).includes(secret),false);
 assert.equal((await h.portal('POST','activate',{code:`${id}-${'A'.repeat(10)}`,password:'a long enough password'})).status,400,'wrong secret');
 assert.equal((await h.portal('POST','activate',{code:`ZZZZ-${secret}`,password:'a long enough password'})).status,400,'unknown id');
 assert.equal((await h.portal('POST','activate',{code:secret,password:'a long enough password'})).status,400,'bad format');
 assert.equal((await h.portal('POST','activate',{code:made.inviteCode,password:'a long enough password'})).status,200);
});

test('login lockout: per (person, IP) after 5, per person after 30 across IPs; an attacker on one IP cannot lock out others',async()=>{
 const h=harness();const s=await h.school();const good={username:s.saUser,password:'correct horse battery'};
 for(let i=0;i<5;i++)await h.portal('POST','login',{...good,password:'wrong wrong wrong'},{ip:'1.1.1.1'});
 assert.equal((await h.portal('POST','login',good,{ip:'1.1.1.1'})).status,401,'attacker IP is locked');
 assert.equal((await h.portal('POST','login',good,{ip:'2.2.2.2'})).status,200,'the real user on another IP still signs in');
 const h2=harness();const s2=await h2.school();
 for(let i=0;i<30;i++)await h2.portal('POST','login',{username:s2.saUser,password:'wrong wrong wrong'},{ip:`10.0.0.${i}`});
 assert.equal((await h2.portal('POST','login',{username:s2.saUser,password:'correct horse battery'},{ip:'3.3.3.3'})).status,401,'30 failures lock the person on every IP');
 h2.clock.t+=15*60_000+1;
 assert.equal((await h2.portal('POST','login',{username:s2.saUser,password:'correct horse battery'},{ip:'3.3.3.3'})).status,200);
 // Unknown, unactivated and locked accounts all take the dummy-scrypt path (same status, no early return).
 const org=(await h.admin('POST','organizations',{type:'school',name:'SMK Belum',status:'active'})).data;const p=(await h.admin('POST','people',{orgId:org.id,name:'Wawan Admin'})).data.person;
 assert.equal((await h.portal('POST','login',{username:p.username,password:'whatever whatever'})).status,401);
});

test('pendingApprovalIdr is the student pool being allocated, not the full fee',async()=>{
 const h=harness();const s=await h.school();const task=await h.verifiedTask(s);
 await h.portal('POST','allocations',{taskId:task.id,shares:h.shares(s)},{cookie:s.teacher});
 assert.equal(h.ops.commissions.totals(s.org.id).pendingApprovalIdr,payoutSplit(150001).students);
 assert.equal((await h.portal('GET','summary',undefined,{cookie:s.sa})).data.pendingApprovalIdr,90000);
});

test('sessions: 2 h idle timeout, 12 h absolute, last_seen refreshed at most once a minute, cap of 5 per person, expired rows purged',async()=>{
 const h=harness();const s=await h.school();const login=async()=>h.tokenOf(await h.portal('POST','login',{username:s.saUser,password:'correct horse battery'}));
 const db=h.ops.store.db;const seen=()=>(db.prepare('SELECT last_seen FROM sessions ORDER BY rowid DESC').all() as any[]).map(r=>r.last_seen);
 let t=await login();const start=h.clock.t;
 h.clock.t+=30_000;assert.equal((await h.portal('GET','me',undefined,{cookie:t})).status,200);assert.ok(seen().includes(start),'not touched within a minute');
 h.clock.t+=60_000;await h.portal('GET','me',undefined,{cookie:t});assert.ok(seen().includes(h.clock.t),'touched after a minute');
 h.clock.t+=2*3_600_000+1000;assert.equal((await h.portal('GET','me',undefined,{cookie:t})).status,401,'idle for 2 h');
 t=await login();for(let i=0;i<4;i++){h.clock.t+=3_000_000;assert.equal((await h.portal('GET','me',undefined,{cookie:t})).status,200);}
 h.clock.t+=3_000_000;assert.equal((await h.portal('GET','me',undefined,{cookie:t})).status,200,'activity keeps it alive');
 const t2=await login();assert.equal((await h.portal('GET','me',undefined,{cookie:t2})).status,200);
 h.clock.t+=12*3_600_000;assert.equal((await h.portal('GET','me',undefined,{cookie:t2})).status,401,'absolute 12 h');
 const tokens:string[]=[];for(let i=0;i<7;i++)tokens.push(await login());
 assert.equal((db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE person_id=?').get(s.adminPerson.id) as any).n,5,'capped at 5');
 assert.equal((await h.portal('GET','me',undefined,{cookie:tokens[0]})).status,401,'oldest dropped');
 assert.equal((await h.portal('GET','me',undefined,{cookie:tokens[6]})).status,200);
 assert.equal((db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE expires_at<?').get(h.clock.t) as any).n,0,'expired sessions purged on login');
});

test('portal paths with a trailing slash or empty segments are 404, so nginx exact-match zones cannot be bypassed',async()=>{
 const h=harness();const s=await h.school();
 for(const p of ['login/','activate/','login//','/login','people/','me/'])assert.equal((await h.portal('POST',p,{username:s.saUser,password:'correct horse battery'})).status,404,p);
 assert.equal((await h.portal('POST','login',{username:s.saUser,password:'correct horse battery'})).status,200);
});

test('activation race: two concurrent activations with the same code give exactly one success and one session',async()=>{
 const h=harness();const org=(await h.admin('POST','organizations',{type:'school',name:'SMK Balapan',status:'active'})).data;
 const made=(await h.admin('POST','people',{orgId:org.id,name:'Lia Admin'})).data;
 const rs=await Promise.all([h.portal('POST','activate',{code:made.inviteCode,password:'first long password'},{ip:'1.1.1.1'}),h.portal('POST','activate',{code:made.inviteCode,password:'second long password'},{ip:'2.2.2.2'})]);
 assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);
 assert.equal(rs.filter(r=>r.setCookie).length,1,'only the winner gets a session');
 assert.equal((h.ops.store.db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as any).n,1);
 // A person disabled while the activation hashes cannot be activated.
 const made2=(await h.admin('POST','people',{orgId:org.id,name:'Mimi Admin'})).data;
 const pending=h.portal('POST','activate',{code:made2.inviteCode,password:'a long enough password'});
 await h.admin('PATCH',`people/${made2.person.id}`,{status:'disabled'});
 const r=await pending;assert.notEqual(r.status,200);assert.equal(r.setCookie,undefined);
});

test('reset races: a school-admin reset re-checks teacher workload after the await and never writes back a stale person',async()=>{
 const h=harness();const s=await h.school();
 const idle=(await h.portal('POST','people',{role:'teacher',name:'Fajar Guru'},{cookie:s.sa})).data;
 const reset=h.portal('POST',`people/${idle.person.id}/invite`,{},{cookie:s.sa});
 // While the reset hashes, AIoT makes the teacher a lead: the in-transaction check must refuse.
 await h.admin('POST','tasks',{title:'Busy now',feeIdr:100000,labId:s.org.id,leadId:idle.person.id});
 const r=await reset;assert.equal(r.status,409);assert.match(r.data.error,/AIoT must reset/);
 // Disabled while resetting: the stale person must not be re-enabled.
 const other=(await h.portal('POST','people',{role:'teacher',name:'Gita Guru'},{cookie:s.sa})).data;
 const r2=h.admin('POST',`people/${other.person.id}/invite`);
 await h.admin('PATCH',`people/${other.person.id}`,{status:'disabled'});
 assert.equal((await r2).status,409);assert.equal(h.ops.store.get<any>('people',other.person.id).status,'disabled');
});

test('failure counters are atomic SQL increments: parallel wrong guesses are all counted',async()=>{
 const h=harness();const s=await h.school();
 await Promise.all(Array.from({length:4},()=>h.portal('POST','login',{username:s.saUser,password:'wrong wrong wrong'},{ip:'8.8.8.8'})));
 const row=h.ops.store.db.prepare('SELECT failed FROM login_fails WHERE ip=?').get('8.8.8.8') as any;assert.equal(row.failed,4);
 assert.equal((h.ops.store.db.prepare('SELECT failed FROM logins WHERE username=?').get(s.saUser) as any).failed,4);
 await h.portal('POST','login',{username:s.saUser,password:'wrong wrong wrong'},{ip:'8.8.8.8'});
 assert.equal((await h.portal('POST','login',{username:s.saUser,password:'correct horse battery'},{ip:'8.8.8.8'})).status,401,'locked at 5');
});

test('disabled lead: disabling voids pending proposals; stale pending is hidden and uncounted; batch explains recovery for stale approved ones',async()=>{
 const h=harness();const s=await h.school();const task=await h.verifiedTask(s);
 const alloc=(await h.portal('POST','allocations',{taskId:task.id,shares:h.shares(s)},{cookie:s.teacher})).data;
 await h.portal('PATCH',`people/${s.teacherId}`,{status:'disabled'},{cookie:s.sa});
 assert.equal(h.ops.store.get<any>('allocations',alloc.id).status,'void');
 assert.equal(h.ops.commissions.totals(s.org.id).pendingApprovalIdr,0);
 // A stale-but-pending record (forged directly) neither counts nor shows.
 const row=h.ops.store.get<any>('allocations',alloc.id);h.ops.store.put('allocations',{...row,status:'pending'});
 assert.equal(h.ops.commissions.totals(s.org.id).pendingApprovalIdr,0);
 assert.deepEqual((await h.portal('GET','allocations',undefined,{cookie:s.sa})).data.allocations,[]);
 assert.deepEqual((await h.admin('GET','commissions')).data.schools.find((x:any)=>x.orgId===s.org.id).pending,[]);
 // An approved allocation whose lead was later disabled is skipped with a recovery message.
 h.ops.store.put('allocations',{...row,status:'approved'});
 const r=await h.admin('POST','batches',{orgId:s.org.id});assert.equal(r.status,409);
 assert.match(r.data.error,/Recovery: reverse the allocation, reverse the task accrual, reassign/);
 // With a valid second task the batch is created and reports what was skipped.
 const t2=(await h.admin('POST','tasks',{title:'Second task',feeIdr:100000,labId:s.org.id})).data;
 await h.admin('PATCH',`tasks/${t2.id}`,{action:'submit',evidenceRef:'job'});await h.admin('PATCH',`tasks/${t2.id}`,{action:'verify'});
 const ok=await h.portal('POST','allocations',{taskId:t2.id,shares:equalShares(60000,3).map((a,i)=>({studentId:s.students[i].id,amountIdr:a}))},{cookie:s.sa});assert.equal(ok.status,201);
 const sa2=(await h.admin('POST','people',{orgId:s.org.id,name:'Second Admin'})).data;
 const sess=h.tokenOf(await h.portal('POST','activate',{code:sa2.inviteCode,password:'second admin password'}));
 await h.portal('POST',`allocations/${ok.data.id}/approve`,{},{cookie:sess});
 const batch=await h.admin('POST','batches',{orgId:s.org.id});assert.equal(batch.status,201);assert.equal(batch.data.skipped.length,1);assert.equal(batch.data.taskIds.length,1);
});
