import test from 'node:test';
import assert from 'node:assert/strict';
import {registerProTools,proMcpToolList,runProTool,opsCaller} from '../services/api/mcp-pro-tools.js';
import {getTool} from '../packages/pro-tools/registry.js';

const fake=()=>{const reg:Record<string,any>={};return {reg,server:{registerTool:(n:string,c:any,cb:any)=>{reg[n]={c,cb};}}};};
test('registers 21 tools, never device_flash or client tools',()=>{
 const {reg,server}=fake();
 const names=registerProTools(server,{ops:async()=>({})});
 assert.equal(names.length,21);assert.equal(proMcpToolList().length,21);
 for(const n of ['device_flash','device_detect','serial_read','telemetry_read'])assert.equal(reg[n],undefined,n);
 assert.ok(reg.load_skill&&reg.save_revision);
});
test('pure tool runs in-process, load_skill is built in, service tool goes to ops',async()=>{
 const calls:any[]=[];
 const deps={pure:{estimate_link:(i:any)=>({got:i.medium})},ops:async(n:string,i:any)=>{calls.push([n,i]);return {ok:true};}};
 assert.deepEqual(await runProTool(getTool('estimate_link')!,{medium:'lora',distanceM:500,terrain:'open'},deps),{got:'lora'});
 const sk:any=await runProTool(getTool('load_skill')!,{name:'agri-id'},deps);
 assert.equal(sk.name,'agri-id');assert.match(sk.sha256,/^[0-9a-f]{64}$/);
 assert.deepEqual(await runProTool(getTool('get_revision')!,{projectId:'p1'},deps),{ok:true});
 assert.equal(calls[0][0],'get_revision');
 // a pure tool with no local implementation runs in ops, where the catalog lives
 assert.deepEqual(await runProTool(getTool('solve_power')!,{loads:[{partId:'x'}],source:'solar'},deps),{ok:true});
 assert.equal(calls[1][0],'solve_power');
});
test('invalid input is rejected and surfaced as isError',async()=>{
 const {reg,server}=fake();registerProTools(server,{ops:async()=>({})});
 const r=await reg.load_skill.cb({name:'Bad Name'});
 assert.equal(r.isError,true);
});
test('opsCaller only accepts loopback and posts to the tool route',async()=>{
 assert.throws(()=>opsCaller('http://example.com',undefined));
 let seen:any;
 const f=(async(u:any,init:any)=>{seen={u:String(u),init};return new Response('{"x":1}',{status:200});}) as typeof fetch;
 assert.deepEqual(await opsCaller('http://127.0.0.1:9',"tok",f)('get_revision',{a:1}),{x:1});
 assert.match(seen.u,/\/ops\/v1\/admin\/pro\/tools\/get_revision$/);assert.equal(seen.init.headers.Authorization,'Bearer tok');
});
