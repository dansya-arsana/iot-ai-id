import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../../../../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json' with {type:'json'};
import type {SystemSpec} from '../../../../../packages/pro-contract/system-spec';
import {displayRefs} from '../../../../../packages/pro-contract/refs';
import {chunkLines,codeGate,collectUnverified,designators,docNo,gateOf,idrK,idrM,nodePageCount,pinTable,planPages,titleStatus,verifySummary,wirePointer} from './model';
import {layoutWiring,ROW} from './wiring-layout';
import {stressSpec} from './dev/stress';

const spec=fixture as unknown as SystemSpec;
const clone=()=>JSON.parse(JSON.stringify(spec)) as SystemSpec;
const refs=displayRefs(spec);

test('a missing stamp is unverified with a reason; only a verified stamp says verified',()=>{
 const s=clone();delete s.verification[wirePointer(0,0)];
 assert.deepEqual(gateOf(s,wirePointer(0,0)),{state:'unverified',reason:'not checked by a verifier'});
 s.verification[wirePointer(0,0)]={status:'unverified',by:'validate_netlist',at:'2026-10-14T10:00:00.000Z',inputsSha:'0'.repeat(64),note:'pin 34 is input only'};
 assert.equal(gateOf(s,wirePointer(0,0)).reason,'pin 34 is input only');
 s.verification[wirePointer(0,0)]!.status='verified';
 assert.equal(gateOf(s,wirePointer(0,0)).state,'verified');
});
test('code: linted only is never verified, even with a verified stamp',()=>{
 const s=clone();s.code[0]!.verify.status='linted';s.verification['/code/0']={status:'verified',by:'compile_code',at:'2026-10-14T10:00:00.000Z',inputsSha:'0'.repeat(64)};
 const g=codeGate(s,0);assert.equal(g.state,'unverified');assert.match(g.reason!,/linted only/);
 s.code[0]!.verify.status='compiled';assert.equal(codeGate(s,0).state,'verified');
 s.code[0]!.verify.status='failed';assert.equal(codeGate(s,0).state,'failed');
});
test('unverified list: every non-verified gated item has a reason, verified ones are absent',()=>{
 const items=collectUnverified(spec,refs);
 assert.ok(items.length>0);for(const i of items){assert.ok(i.reason.length>0);assert.notEqual(i.state,'verified');}
 const keys=new Set(items.map(i=>i.key));
 spec.nodes.forEach((n,ni)=>n.wires.forEach((_w,wi)=>assert.equal(keys.has(wirePointer(ni,wi)),spec.verification[wirePointer(ni,wi)]?.status!=='verified')));
 const sum=verifySummary(spec,refs);assert.equal(sum.unverified,items.length);
 const all=clone();for(const k of Object.keys(all.verification))all.verification[k]!.status='verified';
 all.nodes.forEach((n,ni)=>{n.wires.forEach((_w,wi)=>{all.verification[wirePointer(ni,wi)]={status:'verified',by:'validate_netlist',at:'2026-10-14T10:00:00.000Z',inputsSha:'0'.repeat(64)};});n.power.ok=true;all.verification['/power/'+n.id]={status:'verified',by:'solve_power',at:'2026-10-14T10:00:00.000Z',inputsSha:'0'.repeat(64)};});
 all.fields.forEach(f=>{f.distanceSource='user';});
 assert.equal(collectUnverified(all,displayRefs(all)).filter(i=>i.kind==='Wire'||i.kind==='Power').length,0);
});
test('title block: DESIGN · NOT BUILT unless there is flash evidence',()=>{
 assert.equal(titleStatus(null),'DESIGN · NOT BUILT');assert.equal(titleStatus({flashed:0,total:0}),'DESIGN · NOT BUILT');
 assert.equal(titleStatus({flashed:2,total:5}),'FLASHED 2/5');
 assert.equal(docNo('dev-farm'),'BS-DEVFAR');assert.equal(docNo(''),'BS-0001');
});
test('IDR is an estimate range in thousands and millions',()=>{
 assert.equal(idrK({min:55000,max:85000}),'55–85');assert.equal(idrK({min:1_140_000,max:2_130_000}),'1,140–2,130');assert.equal(idrK({min:12500,max:12500}),'12.5');
 assert.equal(idrM({min:6_108_000,max:9_916_000}),'IDR 6.1–9.9 M');
});
test('chunkLines covers every line once and counts wrapped rows',()=>{
 const src=Array.from({length:150},(_,i)=>i%10===0?'x'.repeat(250):'y').join('\n');
 const ch=chunkLines(src,40,100);
 assert.equal(ch[0]![0],1);assert.equal(ch[ch.length-1]![1],150);
 ch.forEach((c,i)=>{if(i>0)assert.equal(c[0],ch[i-1]![1]+1);const rows=src.split('\n').slice(c[0]-1,c[1]).reduce((a,l)=>a+Math.ceil(l.length/100),0);assert.ok(rows<=40,`chunk ${i} has ${rows} rows`);});
 assert.deepEqual(chunkLines('a\n',10,10),[[1,1]]);
});
test('planPages: sheet list follows the spec and never drops a code line',()=>{
 const p=planPages(spec,refs);
 assert.equal(p[0]!.kind,'cover');
 assert.equal(p.filter(x=>x.kind==='node').length,spec.nodes.reduce((a,n)=>a+nodePageCount(n),0));
 assert.equal(p.filter(x=>x.kind==='code').length,spec.code.length);
 assert.ok(p.some(x=>x.kind==='unverified'));
 const big=stressSpec(spec);const q=planPages(big,displayRefs(big));
 assert.ok(q.filter(x=>x.kind==='code').length>spec.code.length,'long listing spans pages');
 assert.ok(q.filter(x=>x.kind==='bom').length>1);
});
test('wiring layout: one route per wire, no two pin rows share a y inside a box',()=>{
 for(const sp of [spec,stressSpec(spec)])for(const n of sp.nodes){
  const des=designators(n);const L=layoutWiring(n,des,id=>id);
  assert.equal(L.routes.length,n.wires.length);
  for(const box of [...L.parts.map(p=>p.pins),L.board.left,L.board.right]){const ys=box.map(p=>p.y);assert.equal(new Set(ys).size,ys.length);ys.slice(1).forEach((y,i)=>assert.ok(y-ys[i]!>=ROW-0.01));}
  for(const p of L.parts)assert.ok(p.y+p.h<=L.height);
 }
});
test('pin table links each pin to its W-number from the spec',()=>{
 const n=spec.nodes[0]!;const t=pinTable(n,designators(n));
 for(const row of t)if(row.wire!=='–')assert.ok(n.wires.some(w=>w.id===row.wire));
 assert.equal(t.length,n.pins.length);
});
