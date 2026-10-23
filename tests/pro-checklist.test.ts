import {test} from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json';
import {buildChecklist} from '../packages/pro-tools/impl/checklist';
import {codes,groups,nextOpen,rollup,unverifiedReason,type TickMap} from '../apps/web/src/pro/checklist/model';
import {toMap} from '../apps/web/src/pro/checklist/ticks';

const spec=fixture as never as Parameters<typeof unverifiedReason>[0];
const items=buildChecklist(spec as never);
const at='2026-10-14T10:00:00Z';

test('rollup counts ticks per phase, node, field and site; open and suggested do not count',()=>{
 const ticks:TickMap=toMap([
  {itemId:items[0]!.id,state:'ticked',by:'human',at},
  {itemId:'flash:node-melon',state:'ticked',by:'evidence',evidenceRef:'x'},
  {itemId:'flash:node-mango',state:'suggested',by:'evidence'},
 ]);
 const r=rollup(items,ticks);
 assert.equal(r.overall.all.total,items.length);assert.equal(r.overall.all.done,2);
 assert.equal(r.overall.phase.procure.done,1);assert.equal(r.site.phase.procure.done,1);
 assert.equal(r.byNode['node-melon']!.phase.flash.done,1);assert.equal(r.byNode['node-mango']!.phase.flash.done,0);
 assert.equal(r.byField['melon']!.all.done,1);
 const sum=Object.values(r.byNode).reduce((a,p)=>a+p.all.total,0)+r.site.all.total;assert.equal(sum,items.length);
});
test('wire items keep the stored W# and other codes number per phase',()=>{
 const c=codes(items);
 const w=items.find(i=>i.ref?.wireId);assert.equal(c[w!.id],w!.ref!.wireId);
 assert.match(c[items.find(i=>i.phase==='power-up')!.id]!,/^P-1$/);
 assert.equal(new Set(Object.values(c)).size,items.length);
});
test('groups obey scope and filter; nextOpen skips ticked items',()=>{
 const ticks:TickMap=toMap([{itemId:'flash:node-melon',state:'ticked',by:'human',at}]);
 const g=groups(items,ticks,'node-melon','open');
 assert.ok(g.every(x=>x.items.every(i=>i.nodeId==='node-melon')));
 assert.equal(g.find(x=>x.phase==='flash')!.done,1);assert.ok(!g.find(x=>x.phase==='flash')!.items.some(i=>i.id==='flash:node-melon'));
 assert.equal(groups(items,ticks,'node-melon','done').length,1);
 assert.notEqual(nextOpen(items,ticks,'node-melon')!.id,'flash:node-melon');
 assert.equal(groups(items,{},'site','all').every(x=>x.items.every(i=>!i.nodeId)),true);
});
test('unverified label carries the reason and never says verified',()=>{
 const w=items.find(i=>i.nodeId==='node-melon'&&i.ref?.wireId==='W2')!;
 const s=JSON.parse(JSON.stringify(spec));
 s.verification['/nodes/0/wires/1']={status:'unverified',by:'validate_netlist',at:'2026-10-14T10:00:00.000Z',inputsSha:'0'.repeat(64),note:'pin voltage unchecked'};
 assert.equal(unverifiedReason(s,w),'unverified · pin voltage unchecked');
 s.verification['/nodes/0/wires/1'].status='verified';
 assert.equal(unverifiedReason(s,w),undefined);
 delete s.verification['/nodes/0/wires/1'];
 assert.match(unverifiedReason(s,w)!,/^unverified · /);
 assert.equal(unverifiedReason(s,items.find(i=>i.phase==='procure')!),undefined);
});
