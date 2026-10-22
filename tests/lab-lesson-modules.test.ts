/** Lessons as modules: one file per lesson under lab/lessons, auto-discovered and ordered by `order`; one generated firmware file per sketch. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {CIRCUITS,FIRMWARE_SPEC,LESSON_IDS} from '../apps/web/src/lab/contract.js';
import {LESSONS,LESSON_BY_ID,LESSON_MODULES} from '../apps/web/src/lab/lessons/index.js';
import {GOALS,READOUTS} from '../apps/web/src/lab/goals.js';
import {labFirmware} from '../apps/web/src/lab/firmware/index.js';

const LAB=new URL('../apps/web/src/lab/',import.meta.url);
const KIT_FILES=['index.ts','kit.ts'];

test('lesson modules: every file under lessons/ is a lesson, ids match file names, orders are unique and ascending',()=>{
 const files=readdirSync(new URL('lessons/',LAB)).filter(f=>f.endsWith('.ts')&&!KIT_FILES.includes(f)).map(f=>f.replace(/\.ts$/,'')).sort();
 assert.deepEqual([...LESSON_IDS].sort(),files,'one registered lesson per file');
 for(const m of LESSON_MODULES)assert.ok(files.includes(m.id),m.id);
 const orders=LESSON_MODULES.map(m=>m.order);
 assert.deepEqual(orders,[...orders].sort((a,b)=>a-b));
 assert.equal(new Set(orders).size,orders.length);
 LESSONS.forEach((l,i)=>{assert.equal(l.n,i+1);assert.equal(l.id,LESSON_IDS[i]);});
});
test('lesson modules: the 16 migrated lessons keep their order and ids',()=>{
 assert.deepEqual(LESSON_IDS.slice(0,16),['board','blink','button','knob','rgb','light','distance','sound','motor','servo','parking','dht','oled','motion','plant','remote']);
});
test('lesson modules: tables derive from the modules (contract re-exports, goals and readouts exist for every lesson)',()=>{
 for(const m of LESSON_MODULES){
  assert.equal(CIRCUITS[m.id],m.circuit);assert.equal(FIRMWARE_SPEC[m.id],m.firmware);
  assert.equal(typeof GOALS[m.id],'function');assert.equal(typeof READOUTS[m.id],'function');
  assert.ok(m.concept.length>0,`${m.id} concept chip`);assert.ok(m.keyPins.length>0,`${m.id} key pins`);
  assert.equal(LESSON_BY_ID[m.id],m);
 }
});
test('firmware: each sketch has its own generated file, a source folder and the matching compiled variant',()=>{
 for(const m of LESSON_MODULES)for(const v of m.firmware.variants){
  const sketch=`${m.id}-${v.id}`;
  assert.ok(existsSync(new URL(`firmware/generated/${sketch}.ts`,LAB)),`generated/${sketch}.ts (npm run lab:firmware -- ${sketch})`);
  const ino=new URL(`firmware/sketches/${sketch}/${sketch}.ino`,LAB);
  assert.ok(existsSync(ino),`sketches/${sketch}/${sketch}.ino`);
  const built=labFirmware.lessons[m.id]!.variants.find(x=>x.id===v.id);
  assert.ok(built,`${sketch} is loaded by firmware/index.ts`);
  assert.equal(built!.source,readFileSync(ino,'utf8'),`${sketch}: the generated source is the sketch on disk (re-run lab:firmware)`);
 }
 assert.deepEqual(labFirmware.lessons.button!.variants.map(v=>v.id),['hold','toggle'],'variant order follows the lesson');
});
test('firmware: no stray generated file for a sketch that no lesson declares',()=>{
 const known=new Set(LESSON_MODULES.flatMap(m=>m.firmware.variants.map(v=>`${m.id}-${v.id}`)));
 for(const f of readdirSync(new URL('firmware/generated/',LAB)).filter(x=>x.endsWith('.ts')))assert.ok(known.has(f.replace(/\.ts$/,'')),`${f} belongs to no lesson`);
});
