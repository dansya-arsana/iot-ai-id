import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {displayRefs} from '../../../../../packages/pro-contract/refs';
import {blocks,hasHidden,stripHidden,revealHidden,codeSummary,fileBadge,gateBadge,groupFiles,highlight,pinInfos,splitSymbols,toolchainShort} from './model';

const spec=JSON.parse(readFileSync(new URL('../../../../../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json',import.meta.url),'utf8'));

test('badges: compiled is toolchain-labelled, gate verified only when stamped',()=>{
 assert.equal(toolchainShort('arduino-cli esp32:esp32@3.0.7'),'esp32 3.0.7');
 assert.equal(fileBadge(spec.code[0]).label,'✓ compiled · esp32 3.0.7');
 assert.equal(gateBadge(spec,0).tone,'ok');
 const s={...spec,verification:{}};
 assert.match(gateBadge(s,0).label,/^unverified/);
 const f={...spec.code[0],verify:{...spec.code[0].verify,status:'failed',diagnostics:[{line:2,message:'x',severity:'error'}]}};
 assert.equal(fileBadge(f).label,'✕ failed · 1 error');
 assert.match(gateBadge({...spec,code:[f]},0).label,/^unverified · compile failed/);
});
test('groups by node with display refs',()=>{
 const g=groupFiles(spec,displayRefs(spec));
 assert.equal(g.length,4);assert.match(g[0].ref,/^N\d$/);
});
test('pin symbols resolve to the part and W-number',()=>{
 const p=pinInfos(spec,spec.code[0]);
 assert.equal(p[0].symbol,'PIN_SOIL_1');assert.equal(p[0].wireId,'W1');assert.match(p[0].partLabel,/AOUT/);
});
test('highlight and symbol split',()=>{
 const l=highlight('#include <Wire.h>\nint x=0x10; // hi\n/* a\nb */ pinMode(PIN_A,OUTPUT);','arduino-cpp');
 assert.equal(l[0][0].kind,'pre');assert.ok(l[1].some(t=>t.kind==='num')&&l[1].some(t=>t.kind==='comment'));assert.equal(l[2][0].kind,'comment');
 assert.deepEqual(splitSymbols('pinMode(PIN_A, 1)',new Set(['PIN_A'])).map(s=>s.symbol),[undefined,'PIN_A',undefined]);
});
test('blocks and summary',()=>{
 assert.deepEqual(blocks('a\nb\n\nc\n').map(b=>[b.from,b.to]),[[1,2],[4,4]]);
 assert.equal(codeSummary(spec).compiled,4);
});

test('hidden characters are detected, stripped and revealed',()=>{
 const t='a‮b​c\td\n';
 assert.equal(hasHidden(t),true);assert.equal(stripHidden(t),'abc\td\n');
 assert.equal(revealHidden('x‮y'),'x<U+202E>y');assert.equal(hasHidden('plain\n\tok'),false);
});
