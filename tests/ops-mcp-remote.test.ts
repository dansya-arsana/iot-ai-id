import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {handleMcp,type McpAudit} from '../services/ops/mcp-remote.js';
import {patHarness} from './ops-pat-harness.js';

async function setup(){
 const h=await patHarness();
 const audits:McpAudit[]=[];
 const srv=createServer((req,res)=>{void handleMcp(h.ops,req,res,{audit:a=>audits.push(a)});});
 await new Promise<void>(r=>srv.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${(srv.address() as AddressInfo).port}/mcp`;
 let n=0;
 const rpc=async(token:string|undefined,method:string,params:unknown={})=>{
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({jsonrpc:'2.0',id:++n,method,params})});
  return{status:r.status,body:await r.json().catch(()=>null) as any};
 };
 const call=async(token:string,name:string,args:unknown)=>{const r=await rpc(token,'tools/call',{name,arguments:args});const c=r.body.result;return{isError:!!c.isError,data:JSON.parse(c.content[0].text)};};
 const tokenFor=async(username:string)=>{const m=await h.join(username,['pro']);return{m,value:(await h.member(m.session,'POST','pro/tokens',{name:'claude'})).data.value as string};};
 return{h,srv,rpc,call,tokenFor,audits};
}

test('remote MCP: auth, tool list, create_project -> get_spec_schema -> save_revision, ownership',async()=>{
 const s=await setup();
 try{
  assert.equal((await s.rpc(undefined,'tools/list')).status,401);
  assert.equal((await s.rpc('aiot_pat_bogus','tools/list')).status,401);
  const a=await s.tokenFor('budi');
  const list=await s.rpc(a.value,'tools/list');
  assert.equal(list.status,200);
  const names=list.body.result.tools.map((t:any)=>t.name);
  assert.ok(names.includes('create_project')&&names.includes('save_revision'));
  for(const n of ['device_flash','device_detect','serial_read','telemetry_read'])assert.ok(!names.includes(n),n);
  const cp=await s.call(a.value,'create_project',{name:'Speedometer reader'});
  assert.equal(cp.isError,false);
  const pid=cp.data.result.projectId;assert.equal(cp.data.result.workspaceUrl,'/pro/'+pid);assert.equal(cp.data.links.workspace,'/pro/'+pid);
  const schema=await s.call(a.value,'get_spec_schema',{});
  assert.equal(schema.isError,false);assert.ok(schema.data.deviceExample,'deviceExample reaches the model');
  const ex=schema.data.example as Record<string,unknown>;
  const ops=Object.entries(ex).map(([k,v])=>({op:'add',path:'/'+k,value:v}));
  const saved=await s.call(a.value,'save_revision',{projectId:pid,baseRevision:0,ops,reason:'first design'});
  assert.equal(saved.isError,false,JSON.stringify(saved.data).slice(0,400));
  assert.equal(saved.data.result.revision,1);
  // another member cannot see or write this project
  const b=await s.tokenFor('sari');
  const peek=await s.call(b.value,'get_revision',{projectId:pid});
  assert.equal(peek.isError,true);assert.equal(peek.data.error,'not_found');
  // audit lines carry the token id, never the value
  assert.ok(s.audits.length>=4);assert.ok(!JSON.stringify(s.audits).includes(a.value));assert.ok(s.audits.every(x=>x.tokenId&&!x.tokenId.startsWith('aiot_pat_')));
  // revoked and expired tokens are refused
  const rows=s.h.ops.store.db.prepare("SELECT id FROM pro_pats WHERE subject LIKE 'member:%'").all() as {id:string}[];
  s.h.ops.store.db.prepare('UPDATE pro_pats SET revoked_at=? WHERE id=?').run('2026-10-28T00:00:00Z',rows[0]!.id);
  const statuses=[await s.rpc(a.value,'tools/list'),await s.rpc(b.value,'tools/list')].map(r=>r.status).sort();
  assert.deepEqual(statuses,[200,401]);
  s.h.clock.t+=91*86_400_000;
  assert.equal((await s.rpc(b.value,'tools/list')).status+(await s.rpc(a.value,'tools/list')).status,802);
 }finally{s.srv.close();}
});

test('remote MCP: a member without the pro grant is refused even with a stored token',async()=>{
 const s=await setup();
 try{
  const a=await s.tokenFor('budi');
  const id=(s.h.ops.store.db.prepare('SELECT subject FROM pro_pats').get() as {subject:string}).subject.slice(7);
  await s.h.admin('PATCH','members/'+id,{grants:['products']});
  assert.equal((await s.rpc(a.value,'tools/list')).status,401);
 }finally{s.srv.close();}
});
