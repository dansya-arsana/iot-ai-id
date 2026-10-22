import test from 'node:test';
import assert from 'node:assert/strict';
import {CIRCUITS} from '../apps/web/src/lab/contract.js';
import type {SimSnapshot} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/index.js';
import {labFirmware} from '../apps/web/src/lab/firmware/index.js';
import {GOALS,READOUTS} from '../apps/web/src/lab/goals.js';
import type {GoalMemory} from '../apps/web/src/lab/goals.js';

/** Lesson 23: the real compiled sketch reads the HX711 model and drives the TM1637 model; the goal reads both. */
function boot(params:Record<string,number>={}){
 const runner=createLabRunner();
 const v=labFirmware.lessons.scale.variants[0]!;
 runner.load(v,params,structuredClone(CIRCUITS.scale),labFirmware.toolchain);
 runner.start();
 const mem:GoalMemory={};
 let passed=false;
 const run=(ms:number,step=20)=>{for(let t=0;t<ms;t+=step){const s=runner.advance(step);if(GOALS.scale(s,mem))passed=true;}return runner.snapshot();};
 return {runner,run,passed:()=>passed,serial:()=>runner.serialText()};
}
const ext=(s:SimSnapshot,id:string)=>{const p=s.parts[id];assert.ok(p&&p.kind==='ext',`part ${id}`);return p.v;};
const pressTare=(b:ReturnType<typeof boot>)=>{b.runner.setInput('btn1',{kind:'button',pressed:true});b.run(120);b.runner.setInput('btn1',{kind:'button',pressed:false});};

test('23 scale: boots, tares at zero, shows 0 on the TM1637',()=>{
 const b=boot();
 const s=b.run(2500);
 assert.match(b.serial(),/ready/);
 assert.match(b.serial(),/tare/);
 const d=ext(s,'disp1');
 assert.equal(d.on,true);
 assert.equal(d.text,'   0');
 assert.ok(Number(d.acks)>=7,'display acks every byte');
 assert.equal(b.passed(),false);
});

test('23 scale: grams on the display follow the bar, the tare button zeroes it, the goal needs both',()=>{
 const b=boot();
 b.run(1500);
 b.runner.setPartProps('hx1',{weight:480});
 let s=b.run(2500);
 assert.equal(ext(s,'hx1').weight,480);
 assert.equal(ext(s,'disp1').text,' 480');
 assert.match(b.serial(),/g=480/);
 assert.equal(b.passed(),false,'a reading alone is not the goal');
 pressTare(b);
 s=b.run(2500);
 assert.equal(ext(s,'disp1').text,'   0');
 assert.equal(b.passed(),true);
 assert.match(b.serial(),/g=0/);
 // more weight on top of the tared bowl, then lift everything: a negative reading with a minus sign
 b.runner.setPartProps('hx1',{weight:1230});
 s=b.run(2500);
 assert.equal(ext(s,'disp1').text,' 750');
 b.runner.setPartProps('hx1',{weight:100});
 s=b.run(2500);
 assert.equal(ext(s,'disp1').text,'-380');
 assert.ok(READOUTS.scale(s).some(r=>/100 g/.test(r.text)));
});

test('23 scale: the calibration factor scales every reading, a heavier bar needs another factor',()=>{
 const b=boot({countsPer10g:2148});
 b.run(1500);
 b.runner.setPartProps('hx1',{weight:300});
 const s=b.run(2500);
 assert.equal(ext(s,'disp1').text,' 600');   // half the counts per 10 g doubles the grams
 const k=boot();
 k.run(1500);
 k.runner.setPartProps('hx1',{weight:2000,capacity:'10'});   // 10 kg bar: half the counts per gram, so the sketch reads half
 assert.equal(ext(k.run(2500),'disp1').text,'1000');
});
