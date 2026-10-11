import test from 'node:test';
import assert from 'node:assert/strict';
import {Ops,OpsStore,RateLimit} from '../services/ops/ops.js';
import {parseRoles,payoutSplit,resolveRole,taskTransition,InquiryInputSchema} from '../packages/ops-contract/index.js';

const fresh=(roles='')=>new Ops(new OpsStore(':memory:'),parseRoles(roles));
const inquiry={kind:'vendor',name:'Li Wei',organization:'Example Robotics',email:'li@example.com',country:'China',message:'We want to test our dexterous hand in Indonesia.',consent:true,source:'/partner'};
async function call(ops:Ops,method:string,path:string,body?:unknown,user='owner'){const r=await ops.handle({method,path,body,ip:'1.2.3.4',admin:path.includes('/admin/')?{user}:undefined});assert.ok(r);return r as {status:number;data:any};}

test('public inquiry: validated, consent required, honeypot drops silently, rate limited per IP',async()=>{
 const ops=fresh();
 assert.equal((await call(ops,'POST','/ops/v1/inquiries',{...inquiry,consent:false})).status,400);
 assert.equal((await call(ops,'POST','/ops/v1/inquiries',{...inquiry,email:'',phone:''})).status,400,'needs email or WhatsApp');
 assert.equal((await call(ops,'POST','/ops/v1/inquiries',{...inquiry,role:'owner'})).status,400,'unknown fields are refused');
 assert.equal((await call(ops,'POST','/ops/v1/inquiries',{...inquiry,website:'http://spam'})).status,202);
 const ok=await call(ops,'POST','/ops/v1/inquiries',inquiry);
 assert.equal(ok.status,201);assert.match(ok.data.reference,/^[0-9A-F]{8}$/);
 const list=await call(ops,'GET','/ops/v1/admin/inquiries');
 assert.equal(list.data.inquiries.length,1,'honeypot submission was not stored');
 assert.equal(list.data.inquiries[0].status,'new');assert.equal('consent' in list.data.inquiries[0],false);
 const limit=new RateLimit(2,60_000,100);assert.ok(limit.take('a',0));assert.ok(limit.take('a',1));assert.equal(limit.take('a',2),false);assert.ok(limit.take('b',3));assert.ok(limit.take('a',60_002));
 assert.equal(InquiryInputSchema.safeParse({...inquiry,phone:'+62 812-114-040',email:''}).success,true);
});

test('admin routes need a gateway user with a role; roles limit writes',async()=>{
 const ops=fresh('daniel:owner,rina:sales,budi:viewer');
 assert.equal((await ops.handle({method:'GET',path:'/ops/v1/admin/inquiries',ip:'x'}))?.status,401);
 assert.equal((await call(ops,'GET','/ops/v1/admin/inquiries',undefined,'stranger')).status,403);
 assert.equal((await call(ops,'GET','/ops/v1/admin/me',undefined,'rina')).data.role,'sales');
 assert.equal((await call(ops,'POST','/ops/v1/admin/organizations',{type:'vendor',name:'Acme'},'budi')).status,403);
 assert.equal((await call(ops,'POST','/ops/v1/admin/organizations',{type:'vendor',name:'Acme'},'rina')).status,201);
 assert.equal((await call(ops,'POST','/ops/v1/admin/tasks',{title:'Humidity soak',feeIdr:150000},'rina')).status,403,'sales cannot create lab tasks');
 assert.equal(resolveRole('anyone',new Map()),'owner','no roles configured means single owner');
 assert.throws(()=>parseRoles('daniel:admin'),/Invalid OPS_ROLES/);
});

test('inquiry pipeline: status history, notes and conversion into an organization',async()=>{
 const ops=fresh();await call(ops,'POST','/ops/v1/inquiries',{...inquiry,kind:'school',organization:'SMK Negeri 1 Contoh'});
 const [item]=(await call(ops,'GET','/ops/v1/admin/inquiries')).data.inquiries;
 const updated=await call(ops,'PATCH',`/ops/v1/admin/inquiries/${item.id}`,{status:'contacted',note:'Called the principal'});
 assert.deepEqual(updated.data.history.slice(1).map((h:any)=>h.action),['status new → contacted','note: Called the principal']);
 const org=await call(ops,'POST',`/ops/v1/admin/inquiries/${item.id}/convert`);
 assert.equal(org.status,201);assert.equal(org.data.type,'school');assert.equal(org.data.name,'SMK Negeri 1 Contoh');assert.equal(org.data.inquiryId,item.id);
 assert.equal((await call(ops,'POST',`/ops/v1/admin/inquiries/${item.id}/convert`)).status,409,'convert once');
 const after=(await call(ops,'GET','/ops/v1/admin/inquiries')).data.inquiries[0];
 assert.equal(after.status,'qualified');assert.equal(after.organizationId,org.data.id);
});

test('distributor products: SDPPI for wireless, no sale without settled localization and evidence, public view hides internals',async()=>{
 const ops=fresh();
 const vendor=(await call(ops,'POST','/ops/v1/admin/organizations',{type:'vendor',name:'Example Robotics',country:'China',notes:'internal margin 30%'})).data;
 const school=(await call(ops,'POST','/ops/v1/admin/organizations',{type:'school',name:'SMK 1',status:'active'})).data;
 const base={slug:'example-hand',vendorId:vendor.id,name:'Example Hand',category:'Dexterous hand',summary:'Six-DoF dexterous hand with tactile fingertips.',wireless:true};
 assert.equal((await call(ops,'POST','/ops/v1/admin/products',{...base,vendorId:school.id})).status,400,'vendor must be a vendor');
 assert.equal((await call(ops,'POST','/ops/v1/admin/products',{...base,localization:{sdppi:'not_applicable'}})).status,400,'wireless needs SDPPI');
 assert.equal((await call(ops,'POST','/ops/v1/admin/products',{...base,status:'available'})).status,400,'cannot sell before localization');
 const product=(await call(ops,'POST','/ops/v1/admin/products',base)).data;assert.equal(product.localization.sdppi,'todo');
 assert.equal((await call(ops,'POST','/ops/v1/admin/products',base)).status,409,'slug is unique');
 assert.equal((await call(ops,'PATCH',`/ops/v1/admin/products/${product.id}`,{published:true})).status,400,'evaluating products stay private');
 const done={sdppi:'done',manual_id:'done',warranty:'done',service_center:'not_applicable',stock:'done',pricing:'done'};
 assert.equal((await call(ops,'PATCH',`/ops/v1/admin/products/${product.id}`,{status:'available',localization:done})).status,400,'needs evidence');
 const ready=await call(ops,'PATCH',`/ops/v1/admin/products/${product.id}`,{status:'available',published:true,localization:done,evidence:[{label:'Humidity soak report',url:'https://iot.ai.id/evidence/1'}],testSummary:'72 h at 85% RH, no faults.',priceNote:'Quote on request'});
 assert.equal(ready.status,200,JSON.stringify(ready.data));
 const catalog=(await call(ops,'GET','/ops/v1/catalog')).data.products;
 assert.equal(catalog.length,1);assert.equal(catalog[0].vendor,'Example Robotics');assert.equal(catalog[0].testedInIndonesia,true);
 assert.equal(JSON.stringify(catalog).includes('internal margin'),false);assert.equal('history' in catalog[0],false);assert.equal('vendorId' in catalog[0],false);
});

test('Lab Mitra tasks: assign to active schools, evidence before verification, pay only verified, 60/25/15 split and public board',async()=>{
 const ops=fresh();
 const prospect=(await call(ops,'POST','/ops/v1/admin/organizations',{type:'school',name:'SMK Prospect'})).data;
 const lab=(await call(ops,'POST','/ops/v1/admin/organizations',{type:'school',name:'SMK Negeri 2 Contoh',city:'Bekasi',status:'active',package:'lab',publicListing:true})).data;
 const task=(await call(ops,'POST','/ops/v1/admin/tasks',{title:'Humidity soak, 24 h',feeIdr:150001})).data;assert.equal(task.status,'open');
 assert.equal((await call(ops,'PATCH',`/ops/v1/admin/tasks/${task.id}`,{action:'pay'})).status,409,'cannot pay an open task');
 assert.equal((await call(ops,'PATCH',`/ops/v1/admin/tasks/${task.id}`,{action:'assign',labId:prospect.id})).status,400,'lab must be active');
 assert.equal((await call(ops,'PATCH',`/ops/v1/admin/tasks/${task.id}`,{action:'assign',labId:lab.id})).data.status,'assigned');
 assert.equal((await call(ops,'PATCH',`/ops/v1/admin/tasks/${task.id}`,{action:'submit'})).status,409,'needs evidence');
 assert.equal((await call(ops,'PATCH',`/ops/v1/admin/tasks/${task.id}`,{action:'submit',evidenceRef:'job 4f2a'})).data.status,'submitted');
 assert.equal((await call(ops,'PATCH',`/ops/v1/admin/tasks/${task.id}`,{action:'verify'})).data.status,'verified');
 assert.deepEqual(payoutSplit(150001),{students:90000,tefa:37501,teacher:22500});
 const due=(await call(ops,'GET','/ops/v1/admin/payouts')).data;assert.equal(due.totals.dueIdr,150001);assert.equal(due.payouts[0].students,90000);
 assert.equal((await call(ops,'PATCH',`/ops/v1/admin/tasks/${task.id}`,{action:'pay'})).data.status,'paid');
 assert.deepEqual((await call(ops,'GET','/ops/v1/labs')).data.labs,[{name:'SMK Negeri 2 Contoh',city:'Bekasi',passed:1,paidIdr:150001}]);
 assert.equal((await call(ops,'GET','/ops/v1/admin/summary')).data.tasks.paid,1);
 assert.deepEqual(taskTransition({status:'rejected',labId:lab.id,evidenceRef:'x'},{action:'assign',labId:lab.id}),{status:'assigned'});
 assert.equal((await call(ops,'POST','/ops/v1/admin/organizations',{type:'vendor',name:'V',publicListing:true})).status,400,'only schools are listed');
});
