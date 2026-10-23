import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProTelemetry,type MqttConnectOptions} from '../services/api/pro-telemetry.js';
async function setup(){
 const dir=await mkdtemp(join(tmpdir(),'tel-'));let opts!:MqttConnectOptions;const subs:string[]=[];let t=1000;
 const tel=createProTelemetry({settingsPath:join(dir,'s.json'),now:()=>t,connector:o=>{opts=o;return{subscribe:(topic,cb)=>{subs.push(topic);cb();},end(){}};}});
 const call=(m:string,p:string,body?:unknown,q='')=>tel.handle(m,p,new URLSearchParams(q),async()=>body);
 return{call,dir,subs,opts:()=>opts,tick:(n:number)=>{t+=n;}};
}
test('settings stored 0600, password never returned, bad url rejected',async()=>{
 const s=await setup();
 assert.equal((await s.call('PUT','/settings',{url:'http://x'})).status,400);
 assert.equal((await s.call('PUT','/settings',{url:'mqtt://192.168.1.5:1883',username:'u',password:'pw'})).status,200);
 const g:any=(await s.call('GET','/settings')).data;assert.equal(g.hasPassword,true);assert.ok(!JSON.stringify(g).includes('pw'));
 assert.equal((await stat(join(s.dir,'s.json'))).mode&0o777,0o600);
});
test('start needs config; subscribes read-only to project root; filters by project and node',async()=>{
 const s=await setup();
 assert.equal((await s.call('POST','/start',{projectId:'p1'})).status,409);
 await s.call('PUT','/settings',{url:'mqtt://h'});
 assert.equal((await s.call('POST','/start',{projectId:'../x'})).status,400);
 await s.call('POST','/start',{projectId:'p1'});
 s.opts().onState('connected');assert.deepEqual(s.subs,['aiot/p1/#']);
 s.opts().onMessage('aiot/p1/n1/temp',Buffer.from('21'));
 s.opts().onMessage('aiot/p1/n2/temp',Buffer.from('22'));
 s.opts().onMessage('aiot/other/n1/temp',Buffer.from('99'));
 const all:any=(await s.call('GET','/messages')).data;assert.equal(all.messages.length,2);assert.equal(all.untrusted,true);
 const n1:any=(await s.call('GET','/messages',undefined,'nodeId=n1')).data;assert.equal(n1.messages[0].payload,'21');
 s.tick(5000);s.opts().onMessage('aiot/p1/n1/temp',Buffer.from('23'));
 const rec:any=(await s.call('GET','/messages',undefined,'sinceMs=1000')).data;assert.equal(rec.messages.length,1);
});
test('payload truncated at 4KB and ring capped at 500',async()=>{
 const s=await setup();await s.call('PUT','/settings',{url:'ws://h'});await s.call('POST','/start',{projectId:'p'});
 s.opts().onMessage('aiot/p/n/x',Buffer.alloc(5000,65));
 for(let i=0;i<600;i++)s.opts().onMessage('aiot/p/n/y',Buffer.from(String(i)));
 const r:any=(await s.call('GET','/messages',undefined,'max=9999')).data;assert.equal(r.messages.length,500);
 const s2=await setup();await s2.call('PUT','/settings',{url:'ws://h'});await s2.call('POST','/start',{projectId:'p'});
 s2.opts().onMessage('aiot/p/n/x',Buffer.alloc(5000,65));
 const m:any=((await s2.call('GET','/messages')).data as any).messages[0];assert.equal(m.payload.length,4096);assert.equal(m.truncated,true);
});
test('no publish surface: unknown routes 404',async()=>{
 const s=await setup();assert.equal((await s.call('POST','/publish',{topic:'a',payload:'b'})).status,404);
});
