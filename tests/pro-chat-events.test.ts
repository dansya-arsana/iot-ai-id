import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyTimeline,parseJsonl,parseSse,reduceEvent,startTurn,verifyOf} from '../apps/web/src/pro/chat/events';

const fixture=parseJsonl(readFileSync('packages/pro-contract/fixtures/agent/farm-turn.jsonl','utf8'));
const run=()=>fixture.reduce(reduceEvent,startTurn(emptyTimeline,'hi'));

test('fixture turn folds into a timeline and finishes',()=>{
 const s=run();
 assert.equal(s.running,false);assert.equal(s.stopReason,'end_turn');
 assert.equal(s.items[0]!.kind,'user');
 assert.ok(s.items.some(i=>i.kind==='thinking'));
 const tools=s.items.filter(i=>i.kind==='tool');
 assert.equal(tools.length,11);
 assert.ok(tools.every(t=>t.kind==='tool'&&t.status!=='running'));
 assert.equal(s.items.filter(i=>i.kind==='revision').length,1);
 assert.equal(s.items.filter(i=>i.kind==='usage').length,1);
});
test('replayed events are ignored',()=>{
 const s=run();assert.equal(fixture.reduce(reduceEvent,s).items.length,s.items.length);
});
test('verify labels',()=>{
 assert.equal(verifyOf('compile_code',true,{status:'compiled'})?.tone,'ok');
 assert.equal(verifyOf('compile_code',true,{status:'pending'})?.tone,'warn');
 assert.equal(verifyOf('compile_code',false,{})?.tone,'fail');
 assert.equal(verifyOf('save_revision',true,{verification:{verified:9,unverified:[{}]}})?.label,'9 verified · 1 unverified');
 assert.equal(verifyOf('site_climate',true,{}),undefined);
});
test('sse parser keeps the partial tail',()=>{
 const p=parseSse('event: text_delta\ndata: {"seq":1,"type":"text_delta","text":"a"}\n\nevent: x\ndata: {"seq"');
 assert.equal(p.events.length,1);assert.ok(p.rest.startsWith('event: x'));
});
