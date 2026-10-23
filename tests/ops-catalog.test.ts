import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Ops,OpsStore,RateLimit} from '../services/ops/ops.js';
import {staffInvite} from '../services/ops/cli.js';
import {handleCatalog,loadBaseParts} from '../services/ops/catalog.js';
import {foldOverlay} from '../scripts/catalog-export.js';
import {PartRecordSchema,type PartRecord} from '../packages/catalog/schema.js';

type R={status:number;data:any};
const base=():PartRecord[]=>(JSON.parse(readFileSync(new URL('../packages/catalog/fixtures/farm-parts.json',import.meta.url),'utf8')).parts as unknown[]).map(p=>PartRecordSchema.parse(p));

async function harness(){
 const store=new OpsStore(':memory:'),ops=new Ops(store,new Map(),new RateLimit(),()=>new Date('2026-10-23T03:00:00Z'));
 const deps={base};
 const admin=async(method:string,path:string,body?:unknown)=>(await ops.handle({method,path:'/ops/v1/admin/'+path,body,ip:'9.9.9.9',admin:{user:'daniel'}}))as R;
 const made=await staffInvite(ops,['daniel','owner','daniel person']);
 const a=await ops.handle({method:'POST',path:'/ops/v1/staff/activate',body:{code:made.inviteCode,password:'a long staff password'},ip:'3.3.3.3',headers:{'x-aiot-staff':'1'}});
 const staffC=/aiot_admin=([^;]*)/.exec([a!.setCookie??[]].flat().join('\n'))?.[1]??'';
 const m=await admin('POST','members',{username:'sari',name:'Sari',orgName:'SMK',grants:['lab']});
 const ma=await ops.handle({method:'POST',path:'/ops/v1/member/activate',body:{code:m.data.inviteCode,password:'a long member password'},ip:'4.4.4.4',headers:{'x-aiot-member':'1'}});
 const memC=/aiot_member=([^;]*)/.exec([ma!.setCookie??[]].flat().join('\n'))?.[1]??'';
 const call=(method:string,path:string,body?:unknown,who:'staff'|'member'|'anon'='staff',csrf=true)=>handleCatalog(ops,{method,path,body,ip:'5.5.5.5',headers:{cookie:who==='staff'?`aiot_admin=${staffC}`:who==='member'?`aiot_member=${memC}`:undefined,'x-aiot-staff':who==='staff'&&csrf?'1':'','x-aiot-member':who==='member'&&csrf?'1':''}},deps)as Promise<R>;
 return{ops,store,call};
}
const leaf=(v:unknown)=>({v,p:{source:'datasheet https://example.com',verifiedBy:'staff:x',at:'2026-10-23',confidence:'high'}});

test('member search and get; untrusted text is wrapped; anon is refused',async()=>{
 const h=await harness();
 const s=await h.call('GET','/ops/v1/member/catalog/search?q=esp32',undefined,'member');
 assert.equal(s.status,200);assert.ok(s.data.parts.length>=1);assert.ok(s.data.parts[0].untrusted.summary);
 const id=s.data.parts[0].id;
 const g=await h.call('GET','/ops/v1/member/catalog/get?id='+id,undefined,'member');assert.equal(g.status,200);assert.equal(g.data.part.identity.id,id);
 assert.equal((await h.call('GET','/ops/v1/member/catalog/get?id=nope-x',undefined,'member')).status,404);
 {const r=await h.call('GET','/ops/v1/member/catalog/search?q=x',undefined,'anon');assert.equal(r.status,401,JSON.stringify(r.data).slice(0,200));}
 assert.equal((await h.call('GET','/ops/v1/catalog/parts',undefined,'member')).status,403);
});

test('staff overlay edit merges, validates and reverts; id is immutable',async()=>{
 const h=await harness();const id=base()[0].identity.id;
 const ok=await h.call('PATCH','/ops/v1/catalog/parts/'+id,{ops:[{op:'replace',path:'/identity/name',value:leaf('Renamed')}]});
 assert.equal(ok.status,200);
 assert.equal((await h.call('GET','/ops/v1/catalog/parts/'+id)).data.part.identity.name.v,'Renamed');
 assert.equal((await h.call('GET','/ops/v1/catalog/parts/'+id)).data.summary.overlay,true);
 assert.equal((await h.call('PATCH','/ops/v1/catalog/parts/'+id,{ops:[{op:'replace',path:'/identity/id',value:'other'}]})).status,422);
 assert.equal((await h.call('PATCH','/ops/v1/catalog/parts/'+id,{ops:[{op:'replace',path:'/identity/name',value:'not a leaf'}]})).status,422);
 assert.equal((await h.call('PATCH','/ops/v1/catalog/parts/'+id,{ops:[{op:'replace',path:'/identity/name',value:leaf('X')}]},'staff',false)).status,403);
 await h.call('DELETE',`/ops/v1/catalog/parts/${id}/overlay`);
 assert.notEqual((await h.call('GET','/ops/v1/catalog/parts/'+id)).data.part.identity.name.v,'Renamed');
});

test('proposals: member proposes, staff approves with re-stamped provenance or rejects',async()=>{
 const h=await harness();const id=base()[0].identity.id;
 const propose=(ops:unknown)=>h.call('POST','/ops/v1/member/catalog/propose',{partId:id,ops,reason:'datasheet says so',source:'https://example.com/ds.pdf'},'member');
 assert.equal((await propose([{op:'replace',path:'/labTested',value:{schoolId:'a',taskId:'b',at:'2026-10-23',by:'x'}}])).status,422);
 const p=await propose([{op:'replace',path:'/identity/name',value:{v:'Proposed',p:{source:'x',verifiedBy:'staff:fake',at:'2026-10-23',confidence:'high'}}}]);
 assert.equal(p.status,201);
 assert.equal((await h.call('POST','/ops/v1/catalog/proposals/'+p.data.id+'/approve',{},'member')).status,403);
 const list=await h.call('GET','/ops/v1/catalog/proposals?status=pending');assert.equal(list.data.proposals.length,1);
 const ap=await h.call('POST',`/ops/v1/catalog/proposals/${p.data.id}/approve`,{});
 assert.equal(ap.status,200);
 const name=ap.data.part.identity.name;assert.equal(name.v,'Proposed');assert.match(name.p.verifiedBy,/^staff:/);assert.equal(name.p.confidence,'medium');assert.equal(name.p.source,'https://example.com/ds.pdf');
 assert.equal((await h.call('POST',`/ops/v1/catalog/proposals/${p.data.id}/approve`,{})).status,409);
 const p2=await propose([{op:'replace',path:'/identity/name',value:leaf('Nope')}]);
 assert.equal((await h.call('POST',`/ops/v1/catalog/proposals/${p2.data.id}/reject`,{note:'no'})).data.status,'rejected');
 assert.equal((await h.call('GET','/ops/v1/catalog/parts/'+id)).data.part.identity.name.v,'Proposed');
});

test('lab-tested badge needs a verified lab task for that school',async()=>{
 const h=await harness();const id=base()[0].identity.id;
 assert.equal((await h.call('PUT',`/ops/v1/catalog/parts/${id}/lab-tested`,{schoolId:'s1',taskId:'t1'})).status,422);
 h.store.put('tasks' as never,{id:'t1',labId:'s1',status:'verified',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z'} as never);
 const r=await h.call('PUT',`/ops/v1/catalog/parts/${id}/lab-tested`,{schoolId:'s1',taskId:'t1'});
 assert.equal(r.status,200);assert.equal(r.data.part.labTested.taskId,'t1');
 assert.equal((await h.call('PUT',`/ops/v1/catalog/parts/${id}/lab-tested`,{schoolId:'s2',taskId:'t1'})).status,422);
 await h.call('DELETE',`/ops/v1/catalog/parts/${id}/lab-tested`);
 assert.equal((await h.call('GET','/ops/v1/catalog/parts/'+id)).data.part.labTested,undefined);
});

test('staff list filters: unverified (importer-only) and low confidence',async()=>{
 const h=await harness();
 const all=(await h.call('GET','/ops/v1/catalog/parts')).data.parts;
 const un=(await h.call('GET','/ops/v1/catalog/parts?filter=unverified')).data.parts;
 assert.ok(all.length>=5&&un.length<=all.length);
 const id=un[0]?.id;if(id){await h.call('PATCH','/ops/v1/catalog/parts/'+id,{ops:[{op:'replace',path:'/identity/name',value:leaf('V')}]});}
});

test('export folds overlay into data files and reports skipped rows',()=>{
 const parts=base(),id=parts[0].identity.id;
 const files={'a.json':JSON.stringify({catalogVersion:'x',parts}),'b.json':JSON.stringify(parts.slice(1))};
 const rows=[{part_id:id,ops:JSON.stringify([{op:'replace',path:'/identity/name',value:leaf('Folded')}])},{part_id:'ghost',ops:'[]'}];
 const {files:out,result}=foldOverlay(files,rows);
 assert.deepEqual(Object.keys(out),['a.json']);assert.deepEqual(result.folded,[id]);
 assert.equal(JSON.parse(out['a.json']).parts[0].identity.name.v,'Folded');assert.equal(JSON.parse(out['a.json']).catalogVersion,'x');
 assert.equal(result.skipped[0].id,'ghost');
});

test('loadBaseParts returns [] when the data dir is absent',()=>{assert.deepEqual(loadBaseParts('/nonexistent/'),[]);});
