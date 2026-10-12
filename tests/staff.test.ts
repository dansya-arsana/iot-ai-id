import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Ops,OpsStore,RateLimit} from '../services/ops/ops.js';
import {staffInvite} from '../services/ops/cli.js';

type R={status:number;data:any;setCookie?:string;headers?:Record<string,string>};
function harness(roles=new Map<string,any>()){
 const clock={t:Date.parse('2026-10-11T00:00:00Z')};
 const ops=new Ops(new OpsStore(':memory:'),roles,new RateLimit(),()=>new Date(clock.t));
 const staff=async(method:string,path:string,body?:unknown,o:{cookie?:string;csrf?:boolean;ip?:string}={}):Promise<R>=>(await ops.handle({method,path:'/ops/v1/staff/'+path,body,ip:o.ip??'7.7.7.7',headers:{cookie:o.cookie?`aiot_admin=${o.cookie}`:undefined,'x-aiot-staff':o.csrf===false?'':'1'}}))as R;
 const admin=async(user:string,method:string,path:string,body?:unknown):Promise<R>=>(await ops.handle({method,path:'/ops/v1/admin/'+path,body,ip:'9.9.9.9',admin:{user}}))as R;
 const tokenOf=(r:R)=>/aiot_admin=([^;]*)/.exec(r.setCookie??'')?.[1]??'';
 /** Bootstraps an owner through the CLI path, activates and returns the owner session. */
 async function owner(username='daniel'){const made=await staffInvite(ops,[username,'owner','Daniel Owner']);const r=await staff('POST','activate',{code:made.inviteCode,password:'a long owner password'});return{made,session:tokenOf(r),r};}
 async function person(by:string,username:string,role:string){const made=(await admin(by,'POST','staff',{username,name:`${username} person`,role})).data;const r=await staff('POST','activate',{code:made.inviteCode,password:'a long staff password'});return{made,session:tokenOf(r),r};}
 return{ops,clock,staff,admin,tokenOf,owner,person};
}

test('staff activate, me, logout and login: cookie flags, CSRF header, hashed storage, 404 on odd paths',async()=>{
 const h=harness();const o=await h.owner();
 assert.match(o.made.inviteCode,/^[A-Z2-9]{4}-[A-Z2-9]{10}$/);
 assert.equal(o.r.status,200);assert.deepEqual(o.r.data,{username:'daniel',name:'Daniel Owner',role:'owner'});
 assert.match(o.r.setCookie!,/^aiot_admin=[^;]+; Path=\/; HttpOnly; SameSite=Strict; Max-Age=43200; Secure$/);
 assert.equal(JSON.stringify(h.ops.store.db.prepare('SELECT * FROM logins').all()).includes(o.made.inviteCode.slice(5)),false,'invite stored as a hash');
 assert.deepEqual((await h.staff('GET','me',undefined,{cookie:o.session})).data,{username:'daniel',name:'Daniel Owner',role:'owner'});
 assert.equal((await h.staff('GET','me')).status,401);
 assert.equal((await h.staff('POST','login',{username:'daniel',password:'a long owner password'},{csrf:false})).status,403,'CSRF header required');
 const bad=await h.staff('POST','login',{username:'daniel',password:'nope nope nope'});assert.equal(bad.status,401);assert.equal(bad.setCookie,undefined);
 const login=await h.staff('POST','login',{username:' Daniel ',password:'a long owner password'});assert.equal(login.status,200);
 const out=await h.staff('POST','logout',{},{cookie:login.setCookie&&h.tokenOf(login)});assert.match(out.setCookie!,/Max-Age=0/);
 assert.equal((await h.staff('GET','me',undefined,{cookie:h.tokenOf(login)})).status,401,'logout ends the session');
 assert.equal((await h.staff('GET','me/')).status,404);assert.equal((await h.staff('GET','')).status,404);assert.equal((await h.staff('GET','me/x')).status,404);
 const reuse=await h.staff('POST','activate',{code:o.made.inviteCode,password:'another long password'});assert.equal(reuse.status,400,'single use');
 const plain=await h.ops.handle({method:'POST',path:'/ops/v1/staff/login',body:{username:'daniel',password:'a long owner password'},ip:'1.1.1.1',headers:{'x-aiot-staff':'1'},plainLoopback:true});
 assert.doesNotMatch(String(plain!.setCookie),/Secure/);
});

test('invite codes expire after 7 days and short passwords are refused',async()=>{
 const h=harness();const made=await staffInvite(h.ops,['rina','sales']);
 assert.equal((await h.staff('POST','activate',{code:made.inviteCode,password:'short'})).status,400);
 h.clock.t+=7*86_400_000+1000;
 assert.equal((await h.staff('POST','activate',{code:made.inviteCode,password:'a long enough password'})).status,400);
});

test('check: 204 with user and role headers for a live session (refreshes idle time), 401 otherwise',async()=>{
 const h=harness();const o=await h.owner();
 const ok=await h.staff('GET','check',undefined,{cookie:o.session});
 assert.equal(ok.status,204);assert.deepEqual(ok.headers,{'X-Staff-User':'daniel','X-Staff-Role':'owner'});
 assert.equal((await h.staff('GET','check')).status,401);assert.equal((await h.staff('GET','check',undefined,{cookie:'forged'})).status,401);
 for(let i=0;i<3;i++){h.clock.t+=3_000_000;assert.equal((await h.staff('GET','check',undefined,{cookie:o.session})).status,204,'activity keeps it alive');}
 h.clock.t+=2*3_600_000+1000;assert.equal((await h.staff('GET','check',undefined,{cookie:o.session})).status,401,'2 h idle');
 const p=await h.ops.handle({method:'GET',path:'/ops/v1/portal/me',ip:'1.1.1.1',headers:{cookie:`aiot_portal=${o.session}`}});assert.equal(p!.status,401,'a staff token is not a portal token');
});

test('lockout: 5 wrong passwords lock a person and IP for 15 minutes, even for the right password',async()=>{
 const h=harness();await h.owner();
 for(let i=0;i<5;i++)assert.equal((await h.staff('POST','login',{username:'daniel',password:'wrong password '+i})).status,401);
 assert.equal((await h.staff('POST','login',{username:'daniel',password:'a long owner password'})).status,401,'locked');
 h.clock.t+=15*60_000+1;assert.equal((await h.staff('POST','login',{username:'daniel',password:'a long owner password'})).status,200);
});

test('role resolution prefers an active staff account, falls back to OPS_ROLES and single-owner, and a disabled account gets nothing',async()=>{
 const h=harness(new Map([['legacy','viewer']]));const o=await h.owner();
 await h.person('daniel','rina','sales');
 assert.equal((await h.admin('rina','GET','me')).data.role,'sales');
 assert.equal((await h.admin('legacy','GET','me')).data.role,'viewer','OPS_ROLES still works');
 assert.equal((await h.admin('stranger','GET','me')).status,403,'unknown user with roles configured');
 assert.equal(h.ops.roleFor('rina'),'sales');
 const solo=harness();assert.equal((await solo.admin('anyone','GET','me')).data.role,'owner','single-owner install is unchanged');
 const rina=(await h.admin('daniel','GET','staff')).data.staff.find((s:any)=>s.username==='rina');
 await h.admin('daniel','PATCH',`staff/${rina.id}`,{status:'disabled'});
 assert.equal((await h.admin('rina','GET','me')).status,403,'a disabled account does not fall back to the single-owner default');
 assert.ok(o.session);
});

test('staff admin routes are owner only; owner can create, change role, reset invite and list',async()=>{
 const h=harness();await h.owner();const s=await h.person('daniel','rina','sales');
 for(const [m,p,b] of [['GET','staff',undefined],['POST','staff',{username:'x.y',name:'Xy Z',role:'viewer'}]] as const)assert.equal((await h.admin('rina',m,p,b)).status,403,`${m} ${p}`);
 const id=s.made.staff.id;
 assert.equal((await h.admin('rina','PATCH',`staff/${id}`,{role:'owner'})).status,403,'no self promotion');
 assert.equal((await h.admin('rina','POST',`staff/${id}/invite`)).status,403);
 const list=(await h.admin('daniel','GET','staff')).data.staff;assert.deepEqual(list.map((x:any)=>x.username).sort(),['daniel','rina']);assert.equal(list.find((x:any)=>x.username==='rina').activated,true);
 assert.equal((await h.admin('daniel','POST','staff',{username:'Bad Name',name:'Bad',role:'ops'})).status,400);
 assert.equal((await h.admin('daniel','POST','staff',{username:'rina',name:'Dup',role:'ops'})).status,409);
 const second=await h.admin('daniel','POST','staff',{username:'budi',name:'Budi Ops',role:'owner'});assert.equal(second.status,409,'a second owner is created via promotion, not creation');
 const changed=await h.admin('daniel','PATCH',`staff/${id}`,{role:'ops'});assert.equal(changed.data.role,'ops');assert.match(changed.data.history.at(-1).action,/role sales → ops/);
 assert.equal((await h.admin('rina','GET','me')).data.role,'ops');
 const reset=await h.admin('daniel','POST',`staff/${id}/invite`);assert.match(reset.data.inviteCode,/^[A-Z2-9]{4}-/);
 assert.equal((await h.staff('GET','me',undefined,{cookie:s.session})).status,401,'invite reset ends sessions');
 assert.equal((await h.staff('POST','login',{username:'rina',password:'a long staff password'})).status,401,'password cleared until re-activation');
 assert.equal((await h.admin('daniel','POST','staff/daniel-id/invite')).status,404);
});

test('the last active owner cannot be disabled or demoted, but can once a second owner exists',async()=>{
 const h=harness();const o=await h.owner();const me=(await h.admin('daniel','GET','staff')).data.staff[0];
 assert.equal((await h.admin('daniel','PATCH',`staff/${me.id}`,{status:'disabled'})).status,409);
 assert.equal((await h.admin('daniel','PATCH',`staff/${me.id}`,{role:'viewer'})).status,409);
 const b=await h.person('daniel','budi','sales');
 assert.equal((await h.admin('daniel','PATCH',`staff/${b.made.staff.id}`,{role:'owner'})).status,200);
 assert.equal((await h.admin('daniel','PATCH',`staff/${me.id}`,{role:'viewer'})).status,200,'a second active owner exists');
 assert.equal((await h.admin('budi','PATCH',`staff/${b.made.staff.id}`,{status:'disabled'})).status,409,'budi is now the last owner');
 assert.ok(o);
});

test('disabling kills sessions and blocks login and check; the account is kept with history',async()=>{
 const h=harness();await h.owner();const s=await h.person('daniel','rina','sales');
 assert.equal((await h.staff('GET','check',undefined,{cookie:s.session})).status,204);
 const off=await h.admin('daniel','PATCH',`staff/${s.made.staff.id}`,{status:'disabled'});assert.equal(off.data.status,'disabled');
 assert.equal((await h.staff('GET','check',undefined,{cookie:s.session})).status,401);assert.equal((await h.staff('GET','me',undefined,{cookie:s.session})).status,401);
 assert.equal((await h.staff('POST','login',{username:'rina',password:'a long staff password'})).status,401);
 assert.equal((await h.admin('daniel','POST',`staff/${s.made.staff.id}/invite`)).status,409);
 assert.equal((h.ops.store.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE person_id=?').get(s.made.staff.id) as any).n,0);
 const row=(await h.admin('daniel','GET','staff')).data.staff.find((x:any)=>x.username==='rina');assert.deepEqual(row.history.map((e:any)=>e.action),['created','activated','disabled']);
 const on=await h.admin('daniel','PATCH',`staff/${s.made.staff.id}`,{status:'active'});assert.equal(on.data.status,'active');
 assert.equal((await h.staff('POST','login',{username:'rina',password:'a long staff password'})).status,200,'re-enabled keeps the password');
});

test('CLI staff-invite: creates an owner, resets an existing invite, refuses a second owner without --force, rejects bad input',async()=>{
 const h=harness();
 const first=await staffInvite(h.ops,['daniel','owner','Daniel Owner']);assert.match(first.inviteCode,/^[A-Z2-9]{4}-[A-Z2-9]{10}$/);assert.ok(first.staff.inviteExpires);
 await assert.rejects(staffInvite(h.ops,['rina','owner']),/active owner already exists/);
 assert.equal(h.ops.staff.byUsername('rina'),undefined);
 const forced=await staffInvite(h.ops,['rina','owner'],true);assert.equal(h.ops.staff.activeOwners().length,2);assert.ok(forced.inviteCode);
 const again=await staffInvite(h.ops,['daniel','owner']);assert.notEqual(again.inviteCode,first.inviteCode);
 assert.equal((await h.staff('POST','activate',{code:first.inviteCode,password:'a long owner password'})).status,400,'old invite is void');
 assert.equal((await h.staff('POST','activate',{code:again.inviteCode,password:'a long owner password'})).status,200);
 await assert.rejects(staffInvite(h.ops,['daniel','sales']),/already exists as owner/);
 await assert.rejects(staffInvite(h.ops,['AB','sales']),/Username/);
 await assert.rejects(staffInvite(h.ops,['kim','boss']),/Unknown role/);await assert.rejects(staffInvite(h.ops,[]),/Usage/);
});

test('CLI process: reads OPS_DB and prints only the invite code and expiry',async()=>{
 const {execFileSync}=await import('node:child_process');const db=join(mkdtempSync(join(tmpdir(),'staffcli-')),'ops.sqlite');
 const run=(...args:string[])=>{try{return{code:0,out:execFileSync('node',['--import','tsx','services/ops/cli.ts','staff-invite',...args],{env:{...process.env,OPS_DB:db},encoding:'utf8',stdio:['ignore','pipe','pipe']})};}catch(e:any){return{code:e.status as number,out:String(e.stdout)};}};
 const a=run('daniel','owner','Daniel Owner');assert.equal(a.code,0);assert.match(a.out,/^invite: [A-Z2-9]{4}-[A-Z2-9]{10}\nexpires: \d{4}-\d\d-\d\dT[\d:.]+Z\n$/);
 assert.equal(run('rina','owner').code,1);assert.equal(run('rina','owner','--force').code,0);
});

test('preview: name and role only; CORS headers solely for exact allowlisted origins; trailing slash 404',async()=>{
 const h=harness();const o=await h.owner();
 const call=(origin:string|undefined,cookie:string|undefined,loopback=false,path='/ops/v1/staff/preview')=>h.ops.handle({method:'GET',path,ip:'7.7.7.7',headers:{cookie:cookie?`aiot_admin=${cookie}`:undefined,origin},plainLoopback:loopback})as Promise<R>;
 const ok=await call('https://iot.ai.id',o.session);
 assert.equal(ok.status,200);assert.deepEqual(ok.data,{name:'Daniel Owner',role:'owner'},'no username, no session id');
 assert.equal(ok.headers!['Access-Control-Allow-Origin'],'https://iot.ai.id');assert.equal(ok.headers!['Access-Control-Allow-Credentials'],'true');
 assert.equal(ok.headers!.Vary,'Origin');assert.equal(ok.headers!['Cache-Control'],'no-store');assert.equal(ok.setCookie,undefined);
 assert.equal((await call('https://www.iot.ai.id',o.session)).headers!['Access-Control-Allow-Origin'],'https://www.iot.ai.id');
 const anon=await call('https://iot.ai.id',undefined);assert.equal(anon.status,401);assert.equal(anon.headers!['Access-Control-Allow-Origin'],'https://iot.ai.id');
 for(const evil of ['https://evil.example','https://iot.ai.id.evil.example','http://iot.ai.id','https://admin.iot.ai.id','null','http://iot.admin.localhost:8891',undefined]){
  const r=await call(evil,o.session);assert.equal(r.headers!['Access-Control-Allow-Origin'],undefined,String(evil));assert.equal(r.headers!['Access-Control-Allow-Credentials'],undefined);assert.equal(r.headers!.Vary,'Origin');
 }
 assert.equal((await call('http://iot.admin.localhost:8891',o.session,true)).headers!['Access-Control-Allow-Origin'],'http://iot.admin.localhost:8891','e2e alias only for plain loopback');
 assert.equal((await call('http://iot.admin.localhost.evil:8891',o.session,true)).headers!['Access-Control-Allow-Origin'],undefined);
 assert.equal((await call('https://iot.ai.id',o.session,false,'/ops/v1/staff/preview/')).status,404);
 assert.equal((await h.staff('POST','preview',{})).status,404,'GET only');
});
