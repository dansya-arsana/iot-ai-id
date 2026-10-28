import test from 'node:test';
import assert from 'node:assert/strict';
import {kicadCheck} from '../services/ops/kicad-check.js';
test('pending without URL',async()=>{const r=await kicadCheck(Buffer.from('x'),{env:{}});assert.equal(r.status,'pending');});
test('maps ERC/DRC, unrouted is info',async()=>{
 const f=(async(u:string,init:RequestInit)=>{assert.match(u,/^http:\/\/k:1\/check\?gerber=1$/);assert.equal((init.headers as Record<string,string>)['x-sidecar-token'],'t');
  return new Response(JSON.stringify({erc:{violations:[{type:'pin_not_connected',severity:'error',description:'pin'}]},drc:{violations:[],unconnected_items:[{},{}]}}));}) as unknown as typeof fetch;
 const r=await kicadCheck(Buffer.from('x'),{env:{KICAD_SIDECAR_URL:'http://k:1',KICAD_SIDECAR_TOKEN:'t'},fetchImpl:f,gerber:true});
 assert.equal(r.status,'done');if(r.status!=='done')return;
 assert.equal(r.issues.find(i=>i.code==='drc_unrouted')?.severity,'info');assert.equal(r.issues[0]!.severity,'error');
});
test('http error',async()=>{const r=await kicadCheck(Buffer.from('x'),{env:{KICAD_SIDECAR_URL:'http://k'},fetchImpl:(async()=>new Response('',{status:500})) as unknown as typeof fetch});assert.equal(r.status,'error');});
