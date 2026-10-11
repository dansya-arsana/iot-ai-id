/** Lab Mitra commissions (ADR 010): people and logins, ledger postings, allocations, payout batches. Commissions are paid to the school; the school distributes. */
import {randomBytes,randomInt,randomUUID,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {allocationErrors,payoutSplit,type Allocation,type Batch,type LabTask,type Organization,type Person,type Share,type PersonRole} from '../../packages/ops-contract/index.js';
import type {OpsStore} from './ops.js';
import {fail} from './http.js';

const ALPHABET='ABCDEFGHJKMNPQRSTUVWXYZ23456789';// No 0/O/1/I/L: invite codes are read aloud and typed by hand.
const INVITE_DAYS=7,LOCK_AFTER=5,PERSON_LOCK_AFTER=30,LOCK_MS=15*60_000,SESSION_MS=12*3_600_000,IDLE_MS=2*3_600_000,TOUCH_MS=60_000,MAX_SESSIONS=5;
const scryptAsync=promisify(scrypt) as (secret:string,salt:Buffer,keylen:number)=>Promise<Buffer>;
/** Async scrypt so password and invite checks never block the event loop. */
const hashSecret=async(secret:string)=>{const salt=randomBytes(16);return `${salt.toString('hex')}$${(await scryptAsync(secret,salt,32)).toString('hex')}`;};
const verifySecret=async(secret:string,stored:string)=>{const [salt,hash]=stored.split('$');if(!salt||!hash)return false;const a=await scryptAsync(secret,Buffer.from(salt,'hex'),32),b=Buffer.from(hash,'hex');return a.length===b.length&&timingSafeEqual(a,b);};
let dummy:Promise<string>|undefined;
/** Unknown, locked and not-yet-activated accounts still cost one scrypt, so timing does not reveal the account state. */
const burn=async(secret:string)=>{await verifySecret(secret,await(dummy??=hashSecret('timing-equalizer')));};
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const slugify=(s:string,max:number)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,max).replace(/-+$/,'');
const chars=(n:number)=>Array.from({length:n},()=>ALPHABET[randomInt(ALPHABET.length)]).join('');

type Login={person_id:string;username:string;pass_hash:string|null;invite_id:string|null;invite_hash:string|null;invite_expires:number;failed:number;locked_until:number};
export type PersonView=Person&{activated:boolean;inviteExpires?:string};

export class Commissions{
 constructor(readonly store:OpsStore,readonly clock:()=>Date){
  const db=store.db;
  db.exec(`CREATE TABLE IF NOT EXISTS logins(person_id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,pass_hash TEXT,invite_hash TEXT,invite_expires INTEGER NOT NULL DEFAULT 0,failed INTEGER NOT NULL DEFAULT 0,locked_until INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,person_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS login_fails(person_id TEXT NOT NULL,ip TEXT NOT NULL,failed INTEGER NOT NULL DEFAULT 0,locked_until INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(person_id,ip));`);
  const has=(table:string,col:string)=>(db.prepare(`PRAGMA table_info(${table})`).all() as {name:string}[]).some(r=>r.name===col);
  if(!has('logins','invite_id'))db.exec('ALTER TABLE logins ADD COLUMN invite_id TEXT');
  if(!has('sessions','last_seen'))db.exec('ALTER TABLE sessions ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0');
  db.exec('CREATE INDEX IF NOT EXISTS logins_invite ON logins(invite_id);CREATE INDEX IF NOT EXISTS sessions_person ON sessions(person_id)');
 }
 private get db(){return this.store.db;}
 private get ledger(){return this.store.ledger;}
 private now(){return this.clock().getTime();}
 private stamp(by:string,action:string){const at=this.clock().toISOString();return{at,entry:{at,by,action}};}
 private login(personId:string){return this.db.prepare('SELECT * FROM logins WHERE person_id=?').get(personId) as Login|undefined;}

 // People and logins
 people(orgId?:string){return this.store.list<Person>('people').filter(p=>!orgId||p.orgId===orgId);}
 person(id:string,orgId?:string){const p=this.store.get<Person>('people',id);return p&&(!orgId||p.orgId===orgId)?p:undefined;}
 view(p:Person):PersonView{const l=this.login(p.id);return{...p,activated:!!l?.pass_hash,...(l?.invite_hash&&l.invite_expires>this.now()?{inviteExpires:new Date(l.invite_expires).toISOString()}:{})};}
 private username(name:string,org:Organization){
  const first=slugify(name.split(/\s+/)[0]??'',20).replace(/-/g,'')||'user',school=slugify(org.name,24)||'school';
  for(let n=0;;n++){const candidate=`${first}${n?n+1:''}.${school}`;if(!this.db.prepare('SELECT 1 FROM logins WHERE username=?').get(candidate))return candidate;}
 }
 /** Creates a person. Login-capable roles get a one-time invite code that is returned here and never again. */
 async createPerson(org:Organization,input:{role:PersonRole;name:string;className?:string;nisn?:string;guardianConsent?:true},by:string){
  const {at,entry}=this.stamp(by,'created');const id=randomUUID();
  const person:Person={id,orgId:org.id,role:input.role,name:input.name.trim(),status:'active',createdBy:by,createdAt:at,updatedAt:at,history:[entry],
   ...(input.role==='student'?{className:input.className,...(input.nisn?{nisn:input.nisn}:{}),guardianConsent:{at,recordedBy:by}}:{})};
  let code:string|undefined;const invite=input.role!=='student'?await this.newInvite():undefined;
  this.store.tx(()=>{
   if(input.role!=='student'){person.username=this.username(person.name,org);this.db.prepare('INSERT INTO logins(person_id,username) VALUES(?,?)').run(id,person.username);code=this.storeInvite(id,invite!);}
   this.store.put('people',person);
  });
  return{person:this.view(person),inviteCode:code};
 }

 /** Invite code `<4-char lookup id>-<10-char secret>`: the id is stored plain and indexed, only the secret is scrypt-hashed, so activation costs one scrypt. */
 private async newInvite(){const secret=chars(10);return{secret,hash:await hashSecret(secret)};}
 private storeInvite(personId:string,inv:{secret:string;hash:string}){
  let id:string;do id=chars(4);while(this.db.prepare('SELECT 1 FROM logins WHERE invite_id=?').get(id));
  this.db.prepare('UPDATE logins SET invite_id=?,invite_hash=?,invite_expires=? WHERE person_id=?').run(id,inv.hash,this.now()+INVITE_DAYS*86_400_000,personId);return `${id}-${inv.secret}`;
 }
 /** Open work a teacher holds: unpaid tasks they lead, pending allocations, approved-but-unbatched allocations. */
 teacherBusy(p:Person){
  const tasks=this.store.list<LabTask>('tasks').some(t=>t.leadId===p.id&&t.status!=='paid');
  return tasks||this.store.list<Allocation>('allocations').some(a=>a.proposedBy===p.id&&(a.status==='pending'||(a.status==='approved'&&!a.batchId)));
 }
 /** Any reset replaces the code, clears the password and sessions, and voids the teacher's pending proposals. */
async resetInvite(p:Person,by:string,opts:{requireIdle?:boolean}={}){
  if(p.role==='student')fail(400,'Students do not log in yet');
  const inv=await this.newInvite();const {at,entry}=this.stamp(by,'invite reset');let code='';
  this.store.tx(()=>{
   const fresh=this.person(p.id);if(!fresh||fresh.status!=='active')return fail(409,'Person is disabled');
   if(opts.requireIdle&&this.teacherBusy(fresh))return fail(409,'This teacher leads an unpaid task or has open allocations. AIoT must reset this invite: contact AIoT.');
   code=this.storeInvite(p.id,inv);this.db.prepare('UPDATE logins SET pass_hash=NULL,failed=0,locked_until=0 WHERE person_id=?').run(p.id);this.db.prepare('DELETE FROM login_fails WHERE person_id=?').run(p.id);this.db.prepare('DELETE FROM sessions WHERE person_id=?').run(p.id);this.voidPending(a=>a.proposedBy===p.id,'invite reset',by);this.store.put('people',{...fresh,updatedAt:at,history:[...fresh.history,entry]});
  });
  return{person:this.view(this.person(p.id)!),inviteCode:code};
 }
 /** Marks matching pending allocations void with history. Call inside a transaction. */
 voidPending(match:(a:Allocation)=>boolean,why:string,by:string){
  const {at,entry}=this.stamp(by,`void: ${why}`);
  for(const a of this.store.list<Allocation>('allocations'))if(a.status==='pending'&&match(a))this.store.put('allocations',{...a,status:'void' as const,updatedAt:at,history:[...a.history,entry]});
 }
 updatePerson(p:Person,changes:{name?:string;className?:string;nisn?:string;status?:'active'|'disabled'},by:string){
  if(p.role!=='student'&&(changes.className!==undefined||changes.nisn!==undefined))fail(400,'Only students have a class and NISN');
  const {at,entry}=this.stamp(by,`updated ${Object.keys(changes).join(', ')||'nothing'}`);
  const next:Person={...p,...Object.fromEntries(Object.entries(changes).filter(([,v])=>v!==undefined)),updatedAt:at,history:[...p.history,entry]} as Person;
  this.store.tx(()=>{this.store.put('people',next);if(changes.status==='disabled'){this.voidPending(a=>a.proposedBy===p.id,'proposer disabled',by);this.db.prepare('DELETE FROM sessions WHERE person_id=?').run(p.id);this.db.prepare('UPDATE logins SET invite_hash=NULL WHERE person_id=?').run(p.id);}});
  return this.view(next);
 }

 /** Invite code plus a new password. One indexed lookup, one scrypt for the secret, one for the password. */
 async activate(code:string,password:string):Promise<Person|undefined>{
  const [id,secret]=code.split('-');
  const l=this.db.prepare('SELECT * FROM logins WHERE invite_id=? AND invite_hash IS NOT NULL AND invite_expires>?').get(id??'',this.now()) as Login|undefined;
  if(!l||!await verifySecret(secret??'',l.invite_hash!)){if(!l)await burn(secret??'');return undefined;}
  const p=this.person(l.person_id);if(!p||p.status!=='active')return undefined;
  const hash=await hashSecret(password);const {at}=this.stamp(p.name,'activated');
  // The awaits above may have let another request change the invite or the person: re-read and compare inside the transaction.
  return this.store.tx(()=>{
   const cur=this.db.prepare('SELECT * FROM logins WHERE person_id=?').get(l.person_id) as Login|undefined,fresh=this.person(l.person_id);
   if(!cur||cur.invite_id!==l.invite_id||cur.invite_hash!==l.invite_hash||cur.invite_expires<=this.now()||!fresh||fresh.status!=='active')return fail(409,'This invite code was just used or changed. Ask for a new one.');
   const r=this.db.prepare('UPDATE logins SET pass_hash=?,invite_id=NULL,invite_hash=NULL,failed=0,locked_until=0 WHERE person_id=? AND invite_id=? AND invite_hash=?').run(hash,l.person_id,l.invite_id,l.invite_hash);
   if(Number(r.changes)!==1)return fail(409,'This invite code was just used or changed. Ask for a new one.');
   this.store.put('people',{...fresh,updatedAt:at,history:[...fresh.history,{at,by:fresh.name,action:'activated'}]});return fresh;
  });
 }
 /** Five failures lock a (person, IP) pair for 15 minutes; 30 failures across all IPs lock the person. Locked, unknown and unactivated accounts all cost one scrypt. */
 async authenticate(username:string,password:string,ip:string):Promise<Person|undefined>{
  const l=this.db.prepare('SELECT * FROM logins WHERE username=?').get(username.trim().toLowerCase()) as Login|undefined;
  const now=this.now();const pair=l?this.db.prepare('SELECT * FROM login_fails WHERE person_id=? AND ip=?').get(l.person_id,ip) as {failed:number;locked_until:number}|undefined:undefined;
  if(!l||!l.pass_hash||l.locked_until>now||(pair?.locked_until??0)>now){await burn(password);return undefined;}
  if(!await verifySecret(password,l.pass_hash)){
   this.db.prepare('INSERT INTO login_fails(person_id,ip,failed,locked_until) VALUES(?,?,1,0) ON CONFLICT(person_id,ip) DO UPDATE SET failed=failed+1').run(l.person_id,ip);
   this.db.prepare('UPDATE logins SET failed=failed+1 WHERE person_id=?').run(l.person_id);
   const pf=this.db.prepare('SELECT failed FROM login_fails WHERE person_id=? AND ip=?').get(l.person_id,ip) as {failed:number},tf=this.db.prepare('SELECT failed FROM logins WHERE person_id=?').get(l.person_id) as {failed:number};
   if(pf.failed>=LOCK_AFTER)this.db.prepare('UPDATE login_fails SET failed=0,locked_until=? WHERE person_id=? AND ip=?').run(now+LOCK_MS,l.person_id,ip);
   if(tf.failed>=PERSON_LOCK_AFTER)this.db.prepare('UPDATE logins SET failed=0,locked_until=? WHERE person_id=?').run(now+LOCK_MS,l.person_id);
   return undefined;
  }
  const p=this.person(l.person_id);if(!p||p.status!=='active')return undefined;
  this.db.prepare('UPDATE logins SET failed=0,locked_until=0 WHERE person_id=?').run(l.person_id);this.db.prepare('DELETE FROM login_fails WHERE person_id=?').run(l.person_id);return p;
 }

 private lastPurge=0;
 private purge(now:number){this.lastPurge=now;this.db.prepare('DELETE FROM sessions WHERE expires_at<? OR last_seen<?').run(now,now-IDLE_MS);}
 /** Random 32-byte token; only its sha256 is stored. Expired sessions are purged, and a person keeps at most 5 active ones (oldest dropped). */
 startSession(p:Person){
  const token=randomBytes(32).toString('base64url');const now=this.now();this.purge(now);
  this.db.prepare('INSERT INTO sessions(token_hash,person_id,expires_at,last_seen) VALUES(?,?,?,?)').run(sha(token),p.id,now+SESSION_MS,now);
  this.db.prepare('DELETE FROM sessions WHERE person_id=? AND rowid NOT IN (SELECT rowid FROM sessions WHERE person_id=? ORDER BY rowid DESC LIMIT ?)').run(p.id,p.id,MAX_SESSIONS);
  return{token,maxAgeSeconds:SESSION_MS/1000};
 }
 /** Absolute 12 h plus a 2 h idle timeout; last_seen is refreshed at most once a minute. */
 session(token:string):Person|undefined{
  if(!token)return undefined;const now=this.now();if(now-this.lastPurge>5*60_000)this.purge(now);
  const hash=sha(token),row=this.db.prepare('SELECT person_id,expires_at,last_seen FROM sessions WHERE token_hash=?').get(hash) as {person_id:string;expires_at:number;last_seen:number}|undefined;
  if(!row||row.expires_at<now||row.last_seen<now-IDLE_MS){if(row)this.endSession(token);return undefined;}
  if(now-row.last_seen>TOUCH_MS)this.db.prepare('UPDATE sessions SET last_seen=? WHERE token_hash=?').run(now,hash);
  const p=this.person(row.person_id);return p&&p.status==='active'&&p.role!=='student'?p:undefined;
 }
 endSession(token:string){this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(token));}

 // Ledger postings
 /** Verified task: split the fee into pools and book what AIoT owes the school. */
 accrue(task:LabTask,by:string,at:string){
  const split=payoutSplit(task.feeIdr),orgId=task.labId!,e={orgId,taskId:task.id,kind:'accrual',actor:by};
  this.ledger.add({...e,account:'student_pool',amountIdr:split.students},at);this.ledger.add({...e,account:'tefa',amountIdr:split.tefa},at);
  this.ledger.add({...e,account:'teacher',amountIdr:split.teacher,ref:task.leadId??''},at);this.ledger.add({...e,account:`payable:${orgId}`,amountIdr:task.feeIdr},at);
 }
 totals(orgId:string){
  const payable=`payable:${orgId}`,paid=-this.ledger.total({account:payable,kinds:['payout','reversal:payout']}),distributed=this.ledger.total({account:`distributed:${orgId}`});
  const pending=this.store.list<Allocation>('allocations').filter(a=>a.orgId===orgId&&this.livePending(a)).reduce((n,a)=>n+a.shares.reduce((m,x)=>m+x.amountIdr,0),0);
  return{accruedIdr:this.ledger.total({account:payable,kinds:['accrual','reversal:accrual']}),pendingApprovalIdr:pending,approvedIdr:this.ledger.total({orgId,accountLike:'student:%',kinds:['allocation','reversal:allocation']}),paidIdr:paid,distributedIdr:distributed,waitingIdr:paid-distributed,owedIdr:this.ledger.total({account:payable})};
 }
 personTotals(personId:string){
  const account=`student:${personId}`;
  return{allocatedIdr:this.ledger.total({account,kinds:['allocation','reversal:allocation']}),distributedIdr:-this.ledger.total({account,kinds:['distribution','reversal:distribution']}),balanceIdr:this.ledger.total({account})};
 }

 // Allocations
 allocations(orgId:string){return this.store.list<Allocation>('allocations').filter(a=>a.orgId===orgId);}
 allocationView(a:Allocation){
  const task=this.store.get<LabTask>('tasks',a.taskId);
  return{...a,taskTitle:task?.title??'',taskStatus:task?.status??'',studentPoolIdr:task?payoutSplit(task.feeIdr).students:0,proposedByName:this.person(a.proposedBy)?.name??'',shares:a.shares.map(s=>{const st=this.person(s.studentId);return{...s,name:st?.name??'',className:st?.className??''};})};
 }
 private activeStudents(orgId:string,shares:Share[],status:number){for(const s of shares){const st=this.person(s.studentId,orgId);if(!st||st.role!=='student'||st.status!=='active')fail(status,'Every share needs an active student of this school');}}
 propose(by:Person,task:LabTask,shares:Share[]){
  if(by.role==='teacher'&&task.leadId!==by.id)fail(403,'Only the lead teacher of a task can propose its allocation');
  if(by.role==='school_admin'&&task.leadId)fail(403,'This task has a lead teacher who proposes the allocation');
  if(!['assigned','submitted','verified'].includes(task.status))fail(409,`Cannot allocate a task that is ${task.status}`);
  if(this.allocations(task.labId!).some(a=>a.taskId===task.id&&(a.status==='pending'||a.status==='approved')))fail(409,'This task already has an allocation');
  const pool=payoutSplit(task.feeIdr).students,errors=allocationErrors(pool,shares);if(errors.length)fail(400,errors[0]);
  this.activeStudents(task.labId!,shares,400);
  const {at,entry}=this.stamp(by.name,`proposed ${shares.length} shares`);
  return this.store.put('allocations',{id:randomUUID(),taskId:task.id,orgId:task.labId!,proposedBy:by.id,shares,status:'pending',note:'',createdAt:at,updatedAt:at,history:[entry]} satisfies Allocation);
 }
 /** Two-person rule: the proposer can never approve, and approval needs a verified task. */
 /** An allocation is only good while its school still owns the task and its proposer is the task's current lead (or a school admin when the task has no lead). */
 /** Pending and still valid: stale proposals neither count nor show. */
 livePending(a:Allocation){return a.status==='pending'&&this.valid(a,this.store.get<LabTask>('tasks',a.taskId));}
 valid(a:Allocation,task:LabTask|undefined){
  if(!task||a.orgId!==task.labId)return false;const proposer=this.person(a.proposedBy,a.orgId);if(!proposer||proposer.status!=='active')return false;
  return task.leadId?proposer.id===task.leadId&&proposer.role==='teacher':proposer.role==='school_admin';
 }
 approve(by:Person,a:Allocation){
  if(a.status!=='pending')fail(409,`Allocation is already ${a.status}`);
  if(a.proposedBy===by.id)fail(403,'You proposed this allocation, so someone else must approve it');
  const task=this.store.get<LabTask>('tasks',a.taskId);if(task?.status!=='verified')fail(409,'The task must be verified by AIoT before the allocation is approved');
  if(!this.valid(a,task))fail(409,'This allocation is out of date (task school or lead changed). Ask for a new proposal.');
  this.activeStudents(a.orgId,a.shares,409);
  const {at,entry}=this.stamp(by.name,'approved');let next!:Allocation;
  this.store.tx(()=>{
   const e={orgId:a.orgId,taskId:a.taskId,kind:'allocation',ref:a.id,actor:by.name};
   this.ledger.add({...e,account:'student_pool',amountIdr:-a.shares.reduce((n,s)=>n+s.amountIdr,0)},at);
   for(const s of a.shares)if(s.amountIdr>0)this.ledger.add({...e,account:`student:${s.studentId}`,amountIdr:s.amountIdr},at);
   next=this.store.put('allocations',{...a,status:'approved' as const,decidedBy:by.id,decidedAt:at,updatedAt:at,history:[...a.history,entry]});
  });
  return next;
 }
 reject(by:Person,a:Allocation,note=''){
  if(a.status!=='pending')fail(409,`Allocation is already ${a.status}`);
  const {at,entry}=this.stamp(by.name,`rejected${note?`: ${note}`:''}`);
  return this.store.put('allocations',{...a,status:'rejected' as const,decidedBy:by.id,decidedAt:at,note,updatedAt:at,history:[...a.history,entry]});
 }

 // Payout batches
 batches(orgId?:string){return this.store.list<Batch>('batches').filter(b=>!orgId||b.orgId===orgId);}
 /** One batch per school from approved allocations whose tasks are verified and not yet batched. */
 createBatch(orgId:string,by:string){
  const open=this.allocations(orgId).filter(a=>a.status==='approved'&&!a.batchId).map(a=>({a,task:this.store.get<LabTask>('tasks',a.taskId)!}));
  const ready=open.filter(x=>x.task?.status==='verified'&&this.valid(x.a,x.task));
  const skipped=open.filter(x=>!ready.includes(x)).map(x=>({allocationId:x.a.id,taskId:x.a.taskId,title:x.task?.title??'',reason:'The task school or lead changed, the proposer is disabled, or the task is no longer verified'}));
  const recovery=skipped.length?` Skipped (${skipped.map(s=>s.title||s.taskId).join(', ')}): the approved allocation is out of date. Recovery: reverse the allocation, reverse the task accrual, reassign the task, then verify it again.`:'';
  if(!ready.length)fail(409,'No approved, unpaid allocations ready for this school.'+recovery);
  const {at,entry}=this.stamp(by,'created');const batch:Batch={id:randomUUID(),orgId,taskIds:ready.map(x=>x.task.id),allocationIds:ready.map(x=>x.a.id),amountIdr:ready.reduce((n,x)=>n+x.task.feeIdr,0),status:'created',transferRef:'',createdAt:at,updatedAt:at,history:[entry]};
  this.store.tx(()=>{this.store.put('batches',batch);for(const {a,task} of ready){this.store.put('allocations',{...a,batchId:batch.id,updatedAt:at});this.store.put('tasks',{...task,batchId:batch.id,updatedAt:at,history:[...task.history,{at,by,action:'added to payout batch'}]});}});
  return{batch,skipped};
 }
 markPaid(b:Batch,input:{transferRef:string;paidAt:string},by:string){
  if(b.status!=='created')fail(409,'Batch is already paid');
  const {at,entry}=this.stamp(by,`paid, transfer ${input.transferRef}`);
  this.store.tx(()=>{
   for(const id of b.taskIds){const task=this.store.get<LabTask>('tasks',id)!;
    this.ledger.add({orgId:b.orgId,taskId:id,account:`payable:${b.orgId}`,amountIdr:-task.feeIdr,kind:'payout',ref:input.transferRef,actor:by,note:`batch ${b.id}`},at);
    this.store.put('tasks',{...task,status:'paid',updatedAt:at,history:[...task.history,{at,by,action:`paid via batch, transfer ${input.transferRef}`}]});}
   this.store.put('batches',{...b,status:'paid',transferRef:input.transferRef,paidAt:input.paidAt,updatedAt:at,history:[...b.history,entry]});
  });
  return this.store.get<Batch>('batches',b.id)!;
 }
 /** The school confirms it passed the money on: student balances clear and the batch counts as distributed. */
 confirmDistributed(b:Batch,by:Person){
  if(b.status!=='paid')fail(409,'The batch has not been paid yet');if(b.distributedAt)fail(409,'Batch is already confirmed as distributed');
  const {at,entry}=this.stamp(by.name,'confirmed distributed');
  this.store.tx(()=>{
   for(const id of b.taskIds){const task=this.store.get<LabTask>('tasks',id)!;const e={orgId:b.orgId,taskId:id,kind:'distribution',ref:b.id,actor:by.name};
    this.ledger.add({...e,account:`distributed:${b.orgId}`,amountIdr:task.feeIdr},at);
    for(const a of this.allocations(b.orgId).filter(x=>x.batchId===b.id&&x.taskId===id))for(const s of a.shares)if(s.amountIdr>0)this.ledger.add({...e,account:`student:${s.studentId}`,amountIdr:-s.amountIdr},at);}
   this.store.put('batches',{...b,distributedAt:at,distributedBy:by.id,updatedAt:at,history:[...b.history,entry]});
  });
  return this.store.get<Batch>('batches',b.id)!;
 }
 /** Undo a whole approved allocation that is not in a batch: student entries out, student_pool restored, status `reversed`. One transaction. */
 reverseAllocation(a:Allocation,by:string,reason:string){
  if(a.status!=='approved')fail(409,`Only an approved allocation can be reversed (this one is ${a.status})`);if(a.batchId)fail(409,'The allocation is in a payout batch; paid batches are final');
  const {at,entry}=this.stamp(by,`reversed: ${reason}`);
  this.store.tx(()=>{
   const rows=this.ledger.entriesBy('allocation',a.id);if(!rows.length)fail(409,'Allocation has no ledger entries');
   for(const r of rows)this.ledger.add({orgId:r.orgId,taskId:r.taskId,account:r.account,amountIdr:-r.amountIdr,kind:'reversal:allocation',ref:a.id,actor:by,note:reason},at);
   this.store.put('allocations',{...a,status:'reversed' as const,updatedAt:at,history:[...a.history,entry]});
  });
  return this.store.get<Allocation>('allocations',a.id)!;
 }
 /** Undo a task's whole accrual (all pools and the payable) and send the task back to `submitted`. Only while nothing is approved or batched. */
 reverseAccrual(task:LabTask,by:string,reason:string){
  if(task.status!=='verified')fail(409,`Only a verified task can be reversed (this one is ${task.status}); paid batches are final`);
  if(task.batchId||this.allocations(task.labId!).some(a=>a.taskId===task.id&&a.status==='approved'))fail(409,'The task has an approved or batched allocation; reverse that first');
  const {at,entry}=this.stamp(by,`accrual reversed: ${reason}`);
  this.store.tx(()=>{
   for(const n of this.ledger.netByAccount(task.id,['accrual','reversal:accrual']))this.ledger.add({orgId:n.orgId,taskId:task.id,account:n.account,amountIdr:-n.amountIdr,kind:'reversal:accrual',ref:task.id,actor:by,note:reason},at);
   this.store.put('tasks',{...task,status:'submitted',updatedAt:at,history:[...task.history,entry]});
  });
  return this.store.get<LabTask>('tasks',task.id)!;
 }
 batchView(b:Batch){return{...b,tasks:b.taskIds.map(id=>{const t=this.store.get<LabTask>('tasks',id);return{id,title:t?.title??'',feeIdr:t?.feeIdr??0};})};}
 /** CSV of who receives what: students from approved allocations, the lead teacher and the TEFA fund. */
 csv(b:Batch){
  const cell=(v:string|number)=>{let s=String(v);if(/^[=+\-@\t\r]/.test(s)&&typeof v==='string')s=`'${s}`;return /[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
  const rows:(string|number)[][]=[['batch','transfer_ref','paid_at','task','recipient_type','name','class','amount_idr']];
  for(const id of b.taskIds){const task=this.store.get<LabTask>('tasks',id)!,split=payoutSplit(task.feeIdr),head=[b.id,b.transferRef,b.paidAt??'',task.title];
   for(const a of this.allocations(b.orgId).filter(x=>x.batchId===b.id&&x.taskId===id))for(const s of a.shares){const st=this.person(s.studentId);rows.push([...head,'student',st?.name??'',st?.className??'',s.amountIdr]);}
   rows.push([...head,'teacher',(task.leadId&&this.person(task.leadId)?.name)||'(no lead teacher)','',split.teacher],[...head,'tefa','School TEFA fund','',split.tefa]);}
  return rows.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
 }
}
