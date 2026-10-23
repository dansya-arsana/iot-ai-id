import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {SystemSpec} from '../packages/pro-contract/system-spec.js';
import {bomCsv,csvCell,idrRange,nodeLines,procureId,inChecklist} from '../apps/web/src/pro/bom/bom-model.js';
import {rails,farmDailyWh} from '../apps/web/src/pro/power/power-model.js';
import {sortChecks,checkTarget,checkPointer,stampToProvenance} from '../apps/web/src/pro/checks/checks-model.js';

const spec=JSON.parse(readFileSync(new URL('../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json',import.meta.url),'utf8')) as SystemSpec;

test('idr range formatting',()=>{assert.equal(idrRange({min:70000,max:120000}),'Rp 70.000–120.000');assert.equal(idrRange({min:5,max:5}),'Rp 5');});
test('csv neutralises formulas and quotes',()=>{assert.equal(csvCell('=SUM(A1)'),"'=SUM(A1)");assert.equal(csvCell('a,"b"'),'"a,""b"""');assert.equal(csvCell(5),'5');});
test('bom csv has header, one row per line and a total',()=>{
 const rows=bomCsv(spec).trim().split('\r\n');assert.equal(rows.length,spec.bom.lines.length+2);assert.match(rows[0],/^key,name/);assert.match(rows.at(-1)!,/TOTAL/);assert.ok(rows.at(-1)!.includes(String(spec.bom.totalIdr.min)));
});
test('per node lines only include that node',()=>{for(const l of nodeLines(spec,'gateway'))assert.ok(l.line.perNode.some(p=>p.nodeId==='gateway'));});
test('procure id matches the contract ckId',()=>{assert.equal(procureId({kind:'esp32-devkitc'}),'procure:esp32-devkitc');assert.ok(inChecklist(spec,{kind:'esp32-devkitc'}));assert.ok(!inChecklist(spec,{kind:'lora-rfm95w'}));});
test('rails group by source and voltage and sum stored budgets',()=>{
 const r=rails(spec);assert.equal(r.reduce((a,g)=>a+g.nodeIds.length,0),spec.nodes.length);
 assert.equal(Math.round(r.reduce((a,g)=>a+g.dailyWh,0)*100)/100,farmDailyWh(spec));
});
test('checks sort errors first and resolve targets',()=>{
 const cs=sortChecks([{...spec.checks[0],severity:'info'},{...spec.checks[0],severity:'error'}]);assert.equal(cs[0].severity,'error');
 const t=checkTarget(spec,spec.checks[0]);assert.equal(t.select?.kind,'link');assert.equal(checkPointer(spec,spec.checks[0]),`/links/${spec.links.findIndex(l=>l.id===spec.checks[0].scope.linkId)}`);
});
test('unverified stamps never map to high confidence',()=>{
 const v=spec.verification['/links/0'];assert.equal(stampToProvenance(v).confidence,'low');
 assert.equal(stampToProvenance({...v,status:'verified'}).confidence,'high');
});
