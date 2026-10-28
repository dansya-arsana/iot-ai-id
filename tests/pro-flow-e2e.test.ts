/** End-to-end Pro flow over the remote MCP, as Claude would drive it: token -> create_project -> get_spec_schema -> save_revision -> export_kicad, for a site and a device. Also guards the spec examples: an unknown part or pin would leave the save unverified. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {handleMcp} from '../services/ops/mcp-remote.js';
import {patHarness} from './ops-pat-harness.js';

test('MCP flow: a site and a device both save a revision and export a KiCad carrier board',async()=>{
 const h=await patHarness();
 const srv=createServer((q,s)=>{void handleMcp(h.ops,q,s,{audit:()=>{}});});
 await new Promise<void>(r=>srv.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${(srv.address() as AddressInfo).port}/mcp`;let n=0;
 const call=async(t:string,name:string,args:unknown)=>{
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:'Bearer '+t},body:JSON.stringify({jsonrpc:'2.0',id:++n,method:'tools/call',params:{name,arguments:args}})});
  const c=(await r.json() as {result:{isError?:boolean;content:{text:string}[]}}).result;return{err:!!c.isError,d:JSON.parse(c.content[0]!.text)};
 };
 try{
  const m=await h.join('flow',['pro']);const tok=(await h.member(m.session,'POST','pro/tokens',{name:'claude'})).data.value as string;
  for(const key of ['example','deviceExample'] as const){
   const pid=(await call(tok,'create_project',{name:key})).d.result.projectId as string;
   const sch=(await call(tok,'get_spec_schema',{})).d;const ex=(sch.result??sch)[key] as {nodes:{id:string}[]};
   const saved=await call(tok,'save_revision',{projectId:pid,baseRevision:0,ops:Object.entries(ex).map(([k,v])=>({op:'add',path:'/'+k,value:v})),reason:'flow'});
   assert.equal(saved.err,false,JSON.stringify(saved.d).slice(0,300));
   const unverified=(saved.d.result.verification.unverified as {path:string;reason:string}[]).filter(u=>!/compiler/.test(u.reason));
   assert.deepEqual(unverified,[],key+': only the compiler may be missing in tests');
   const k=await call(tok,'export_kicad',{projectId:pid,nodeId:ex.nodes[0]!.id});
   assert.equal(k.err,false,key+': '+JSON.stringify(k.d).slice(0,300));
   const out=k.d.result as {ok:boolean;files:{name:string}[];issues:{code:string;ref?:string}[]};
   assert.equal(out.ok,true);assert.ok(out.files.some(f=>f.name.endsWith('.kicad_pcb')));
   assert.ok(!out.issues.some(i=>i.ref==='board'),key+': the board has a real two-row footprint');
   assert.ok(!out.issues.some(i=>i.code==='kicad.pin-not-in-footprint'),key);
   const http=await h.member(m.session,'POST',`pro/projects/${pid}/export-kicad`,{nodeId:ex.nodes[0]!.id});
   assert.equal(http.status,200,key+' member endpoint');
  }
 }finally{srv.close();}
});
