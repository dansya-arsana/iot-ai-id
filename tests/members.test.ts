import test from 'node:test';
import assert from 'node:assert/strict';
import {Ops,OpsStore,RateLimit} from '../services/ops/ops.js';
import {staffInvite} from '../services/ops/cli.js';

type R={status:number;data:any;setCookie?:string|string[];redirect?:string};
const jar=(r:{setCookie?:string|string[]})=>[r.setCookie??[]].flat();
const INSTALLER='https://downloads.example.com/aiot-installer.zip';
function harness(){
 const clock={t:Date.parse('2026-10-12T00:00:00Z')};
 const ops=new Ops(new OpsStore(':memory:'),new Map(),new RateLimit(),()=>new Date(clock.t));
 const member=async(method:string,path:string,body?:unknown,o:{cookie?:string;csrf?:boolean;ip?:string}={}):Promise<R>=>(await ops.handle({method,path:'/ops/v1/member/'+path,body,ip:o.ip??'7.7.7.7',headers:{cookie:o.cookie?`aiot_member=${o.cookie}`:undefined,'x-aiot-member':o.csrf===false?'':'1'}}))as R;
 const admin=async(user:string,method:string,path:string,body?:unknown):Promise<R>=>(await ops.handle({method,path:'/ops/v1/admin/'+path,body,ip:'9.9.9.9',admin:{user}}))as R;
 const tokenOf=(r:R)=>/aiot_member=([^;]*)/.exec(jar(r).join('\n'))?.[1]??'';
 /** Staff with a role (owner via the CLI path, others through the admin route), then a member created and activated. */
 async function staff(username:string,role:string){const made=await staffInvite(ops,[username,role,`${username} person`]);const r=await ops.handle({method:'POST',path:'/ops/v1/staff/activate',body:{code:made.inviteCode,password:'a long staff password'},ip:'3.3.3.3',headers:{'x-aiot-staff':'1'}});return/aiot_admin=([^;]*)/.exec(String(r!.setCookie??''))?.[1]??'';}
 async function make(username='budi',grants:string[]=['products'],by='daniel'){const r=await admin(by,'POST','members',{username,name:`${username} member`,orgName:'SMK Maju',grants});return r;}
 async function join(username='budi',grants:string[]=['products']){const r=await make(username,grants);const a=await member('POST','activate',{code:r.data.inviteCode,password:'a long member password'});return{id:r.data.member.id as string,code:r.data.inviteCode as string,session:tokenOf(a),a};}
 return{ops,clock,member,admin,tokenOf,staff,make,join};
}

test('member activate: single-use code, hashed storage, cookie flags, `me` shows name, org and grants only',async()=>{
 const h=harness();await h.staff('daniel','owner');
 const made=await h.make('budi',['installer','products']);
 assert.equal(made.status,201);assert.match(made.data.inviteCode,/^[A-Z2-9]{4}-[A-Z2-9]{10}$/);
 assert.deepEqual(made.data.member.grants,['products','installer'],'grants are stored in the fixed order');
 assert.equal(JSON.stringify(h.ops.store.db.prepare('SELECT * FROM logins').all()).includes(made.data.inviteCode.slice(5)),false,'invite stored as a hash');
 assert.equal((await h.member('POST','activate',{code:made.data.inviteCode,password:'short'})).status,400);
 const a=await h.member('POST','activate',{code:made.data.inviteCode,password:'a long member password'});
 assert.equal(a.status,200);assert.deepEqual(a.data,{name:'budi member',org:'SMK Maju',grants:['products','installer']});
 assert.match(jar(a)[0],/^aiot_member=[^;]+; Path=\/ops\/v1\/member; HttpOnly; SameSite=Strict; Max-Age=43200; Secure$/);
 assert.equal(jar(a)[1],'aiot_member_hint=1; Path=/; SameSite=Strict; Max-Age=43200; Secure','hint: readable, not HttpOnly');
 assert.equal(jar(a).length,2);
 assert.equal((await h.member('POST','login',{username:'budi',password:'wrong wrong wrong'})).setCookie,undefined,'failed login sets nothing');
 assert.equal((await h.member('POST','activate',{code:made.data.inviteCode,password:'another long password'})).status,400,'single use');
 const me=await h.member('GET','me',undefined,{cookie:h.tokenOf(a)});assert.deepEqual(me.data,{name:'budi member',org:'SMK Maju',grants:['products','installer']});
 const anon=await h.member('GET','me');assert.equal(anon.status,401);assert.match(jar(anon)[0],/^aiot_member_hint=; .*Max-Age=0/,'a 401 clears a stale hint');
 const plain=await h.ops.handle({method:'POST',path:'/ops/v1/member/login',body:{username:'budi',password:'a long member password'},ip:'1.1.1.1',headers:{'x-aiot-member':'1'},plainLoopback:true});
 assert.equal(plain!.status,200);assert.doesNotMatch(jar(plain!).join(),/Secure/);
 const out=await h.member('POST','logout',{},{cookie:h.tokenOf(a)});assert.match(jar(out)[0],/Max-Age=0/);assert.equal(jar(out)[1],'aiot_member_hint=; Path=/; SameSite=Strict; Max-Age=0; Secure','logout clears the hint');
 assert.equal((await h.member('GET','me',undefined,{cookie:h.tokenOf(a)})).status,401,'logout ends the session');
});

test('invite expiry, trailing slash, odd paths and the CSRF header on writes',async()=>{
 const h=harness();await h.staff('daniel','owner');
 const made=await h.make();h.clock.t+=7*86_400_000+1000;
 assert.equal((await h.member('POST','activate',{code:made.data.inviteCode,password:'a long enough password'})).status,400,'7 days');
 const j=await h.join('rina');
 for(const p of ['me/','','me/x','nope'])assert.equal((await h.member('GET',p,undefined,{cookie:j.session})).status,404,p||'(empty)');
 assert.equal((await h.member('POST','login',{username:'rina',password:'a long member password'},{csrf:false})).status,403);
 assert.equal((await h.member('POST','logout',{},{csrf:false,cookie:j.session})).status,403);
 assert.equal((await h.member('POST','activate',{code:j.code,password:'a long member password'},{csrf:false})).status,403);
 assert.equal((await h.member('GET','me',undefined,{cookie:j.session,csrf:false})).status,200,'reads need no header');
});

test('lockout: 5 wrong passwords lock a person and IP for 15 minutes, even for the right password',async()=>{
 const h=harness();await h.staff('daniel','owner');await h.join('budi');
 for(let i=0;i<5;i++)assert.equal((await h.member('POST','login',{username:'budi',password:'wrong password '+i})).status,401);
 assert.equal((await h.member('POST','login',{username:'budi',password:'a long member password'})).status,401,'locked');
 assert.equal((await h.member('POST','login',{username:'budi',password:'a long member password'},{ip:'8.8.8.8'})).status,200,'other IP is separate');
 h.clock.t+=15*60_000+1000;
 assert.equal((await h.member('POST','login',{username:'budi',password:'a long member password'})).status,200,'lock expires');
});

test('grants are enforced on `me` and follow admin changes; disabling ends sessions and blocks login',async()=>{
 const h=harness();await h.staff('daniel','owner');const j=await h.join('budi',['products']);
 assert.deepEqual((await h.member('GET','me',undefined,{cookie:j.session})).data.grants,['products']);
 const up=await h.admin('daniel','PATCH',`members/${j.id}`,{grants:['bench','arena'],name:'Budi S',orgName:'SMK Baru'});
 assert.equal(up.status,200);assert.deepEqual((await h.member('GET','me',undefined,{cookie:j.session})).data,{name:'Budi S',org:'SMK Baru',grants:['bench','arena']});
 assert.equal((await h.admin('daniel','PATCH',`members/${j.id}`,{grants:['everything']})).status,400,'fixed grant set');
 assert.equal((await h.admin('daniel','PATCH',`members/${j.id}`,{})).status,400,'nothing to change');
 assert.ok(up.data.history.some((e:any)=>/grants products → arena,bench|grants products → bench,arena/.test(e.action)));
 await h.admin('daniel','PATCH',`members/${j.id}`,{status:'disabled'});
 assert.equal((await h.member('GET','me',undefined,{cookie:j.session})).status,401);
 assert.equal((await h.member('POST','login',{username:'budi',password:'a long member password'})).status,401);
 await h.admin('daniel','PATCH',`members/${j.id}`,{status:'active'});
 assert.equal((await h.member('POST','login',{username:'budi',password:'a long member password'})).status,200,'enabled again');
});

test('installer: 302 with the grant, 403 without, 401 signed out, 503 unconfigured; downloads are logged',async()=>{
 const h=harness();await h.staff('daniel','owner');const had=process.env.OPS_INSTALLER_URL;
 try{
  const yes=await h.join('budi',['products','installer']),no=await h.join('sari',['products']);
  process.env.OPS_INSTALLER_URL=INSTALLER;
  const ok=await h.member('GET','installer',undefined,{cookie:yes.session});assert.equal(ok.status,302);assert.equal(ok.redirect,INSTALLER);
  assert.equal((await h.member('GET','installer',undefined,{cookie:no.session})).status,403);
  assert.equal((await h.member('GET','installer')).status,401);
  const listed=(await h.admin('daniel','GET','members')).data.members.find((m:any)=>m.id===yes.id);
  assert.equal(listed.history.filter((e:any)=>e.action==='installer download').length,1);
  assert.equal((await h.admin('daniel','GET','members')).data.members.find((m:any)=>m.id===no.id).history.some((e:any)=>/download/.test(e.action)),false);
  process.env.OPS_INSTALLER_URL='';
  const off=await h.member('GET','installer',undefined,{cookie:yes.session});assert.equal(off.status,503);assert.match(off.data.error,/not configured/);
  process.env.OPS_INSTALLER_URL='http://insecure.example.com/a.zip';assert.equal((await h.member('GET','installer',undefined,{cookie:yes.session})).status,503,'https only');
 }finally{if(had===undefined)delete process.env.OPS_INSTALLER_URL;else process.env.OPS_INSTALLER_URL=had;}
});

test('isolation: member, staff and portal sessions never satisfy each other',async()=>{
 const h=harness();const staffToken=await h.staff('daniel','owner');const j=await h.join('budi',['products','installer']);
 const get=(path:string,cookie:string)=>h.ops.handle({method:'GET',path,ip:'1.1.1.1',headers:{cookie}}) as Promise<R>;
 // A member token is not a staff or portal session.
 for(const path of ['/ops/v1/staff/me','/ops/v1/staff/check','/ops/v1/staff/preview','/ops/v1/portal/me'])assert.equal((await get(path,`aiot_admin=${j.session}; aiot_portal=${j.session}`))!.status,401,path);
 // A staff token is not a member session, in any cookie.
 assert.equal((await h.member('GET','me',undefined,{cookie:staffToken})).status,401);
 assert.equal((await h.member('GET','installer',undefined,{cookie:staffToken})).status,401);
 // The member cookie name is the only one read by member routes.
 assert.equal((await get('/ops/v1/member/me',`aiot_admin=${j.session}`))!.status,401);
 // Disabled members and disabled staff are independent.
 assert.equal((await h.member('GET','me',undefined,{cookie:j.session})).status,200);
});

test('admin members: owner and sales only; create, update, invite reset, history; org link is validated',async()=>{
 const h=harness();await h.staff('daniel','owner');
 for(const [u,role] of [['rina','sales'],['oki','ops'],['vera','viewer']]){const r=await h.admin('daniel','POST','staff',{username:u,name:u,role});assert.equal(r.status,201);}
 assert.equal((await h.admin('rina','POST','members',{username:'sales.made',name:'Made By Sales',grants:['arena']})).status,201,'sales may create');
 for(const u of ['oki','vera']){for(const [m,p] of [['GET','members'],['POST','members']])assert.equal((await h.admin(u,m,p,{username:'x.y.z',name:'Xyz'})).status,403,`${u} ${m}`);}
 const org=(await h.admin('daniel','POST','organizations',{type:'school',name:'SMKN 1 Bekasi'})).data;
 const linked=await h.admin('daniel','POST','members',{username:'guru.satu',name:'Guru Satu',orgId:org.id,grants:[]});
 assert.equal(linked.status,201);assert.equal(linked.data.member.orgName,'SMKN 1 Bekasi');assert.equal(linked.data.member.orgId,org.id);
 assert.equal((await h.admin('daniel','POST','members',{username:'bad.org',name:'Bad Org',orgId:'7c9e6679-7425-40de-944b-e07fc1f90ae7'})).status,400);
 assert.equal((await h.admin('daniel','POST','members',{username:'Up',name:'x'})).status,400);
 const id=linked.data.member.id;
 assert.equal((await h.admin('oki','PATCH',`members/${id}`,{name:'Nope'})).status,403);
 assert.equal((await h.admin('daniel','PATCH',`members/${id}`,{orgId:null})).data.orgId,undefined,'unlink');
 assert.equal((await h.admin('daniel','PATCH',`members/${id}`,{name:'Guru Dua'})).data.name,'Guru Dua');
 assert.equal((await h.admin('daniel','PATCH','members/nope',{name:'Guru Dua'})).status,404);
 // Invite reset replaces the code, clears the password and ends sessions.
 const j=await h.join('budi',['products']);
 const reset=await h.admin('rina','POST',`members/${j.id}/invite`,{});assert.equal(reset.status,200);assert.notEqual(reset.data.inviteCode,j.code);
 assert.equal((await h.member('GET','me',undefined,{cookie:j.session})).status,401);
 assert.equal((await h.member('POST','login',{username:'budi',password:'a long member password'})).status,401,'password cleared');
 assert.equal((await h.member('POST','activate',{code:reset.data.inviteCode,password:'a brand new password'})).status,200);
 const row=(await h.admin('daniel','GET','members')).data.members.find((m:any)=>m.id===j.id);
 assert.deepEqual(row.history.map((e:any)=>e.action),['created','activated','invite reset','activated']);
 assert.equal(row.activated,true);
 await h.admin('daniel','PATCH',`members/${j.id}`,{status:'disabled'});
 assert.equal((await h.admin('daniel','POST',`members/${j.id}/invite`,{})).status,409,'a disabled member gets no new invite');
});

test('usernames are unique across staff, portal people and members',async()=>{
 const h=harness();await h.staff('daniel','owner');
 await h.admin('daniel','POST','staff',{username:'shared.name',name:'Staff Person',role:'sales'});
 assert.equal((await h.make('shared.name')).status,409,'staff name');
 await h.make('member.one');
 assert.equal((await h.admin('daniel','POST','staff',{username:'member.one',name:'Other',role:'viewer'})).status,409,'member name blocks staff');
 const org=(await h.admin('daniel','POST','organizations',{type:'school',name:'SMK X',status:'active'})).data;
 await h.admin('daniel','POST','people',{orgId:org.id,name:'School Admin'});
 const teacher=h.ops.store.list<any>('people')[0];assert.ok(teacher);
 // A portal person's username is its login row; members cannot take it.
 const taken=h.ops.store.db.prepare('SELECT username FROM logins').all().map((r:any)=>r.username as string);
 for(const u of taken)assert.equal((await h.make(u)).status,409,u);
});

test('re-enabling a member who never activated issues a fresh invite once; an activated member just signs in',async()=>{
 const h=harness();await h.staff('daniel','owner');
 const made=await h.make('late.joiner',['products']);
 await h.admin('daniel','PATCH',`members/${made.data.member.id}`,{status:'disabled'});
 assert.equal((await h.member('POST','activate',{code:made.data.inviteCode,password:'a long member password'})).status,400,'disabling voided the old invite');
 const on=await h.admin('daniel','PATCH',`members/${made.data.member.id}`,{status:'active'});
 assert.equal(on.status,200);assert.match(on.data.inviteCode,/^[A-Z2-9]{4}-[A-Z2-9]{10}$/);assert.notEqual(on.data.inviteCode,made.data.inviteCode);assert.ok(on.data.inviteExpires);
 assert.match(on.data.history.at(-1).action,/enabled, new invite issued/);
 assert.equal((await h.member('POST','activate',{code:on.data.inviteCode,password:'a long member password'})).status,200);
 const j=await h.join('active.one');await h.admin('daniel','PATCH',`members/${j.id}`,{status:'disabled'});
 const again=await h.admin('daniel','PATCH',`members/${j.id}`,{status:'active'});assert.equal(again.data.inviteCode,undefined);
 assert.equal((await h.member('POST','login',{username:'active.one',password:'a long member password'})).status,200);
});
