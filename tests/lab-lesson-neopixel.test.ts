import test from 'node:test';
import assert from 'node:assert/strict';
import {CIRCUITS} from '../apps/web/src/lab/contract.js';
import type {SimSnapshot} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/index.js';
import {labFirmware} from '../apps/web/src/lab/firmware/index.js';
import {GOALS} from '../apps/web/src/lab/goals.js';
import type {GoalMemory} from '../apps/web/src/lab/goals.js';

/** Lesson neopixel: the real sketch drives a 16 LED ring (800 kHz) and reads the encoder. */
function boot(){
 const runner=createLabRunner();
 runner.load(labFirmware.lessons.neopixel.variants[0]!,{},structuredClone(CIRCUITS.neopixel),labFirmware.toolchain);
 runner.start();
 const mem:GoalMemory={};let passed=false;
 const run=(ms:number)=>{for(let t=0;t<ms;t+=20){const s=runner.advance(20);if(GOALS.neopixel(s,mem))passed=true;}return runner.snapshot();};
 return {runner,run,passed:()=>passed,serial:()=>runner.serialText()};
}
const ext=(s:SimSnapshot,id:string)=>{const p=s.parts[id];assert.ok(p&&p.kind==='ext',`part ${id}`);return p.v;};
const px=(leds:string)=>leds.match(/.{6}/g)??[];

test('neopixel: the ring shows 16 distinct rainbow colours with zero timing errors',()=>{
 const b=boot();
 const s=b.run(600);
 assert.match(b.serial(),/ready/);
 const r=ext(s,'ring1');
 assert.ok(Number(r.frames)>5,'frames arrive');
 assert.equal(r.timingErrors,0);
 const p=px(String(r.leds));
 assert.equal(p.length,16);
 assert.ok(new Set(p).size>=14,'rainbow');
 assert.equal(b.passed(),false,'goal needs the knob');
});
test('neopixel: turning the knob changes brightness; pushing it changes the animation; the goal passes',()=>{
 const b=boot();
 const peak=(s:SimSnapshot)=>Math.max(...px(String(ext(s,'ring1').leds)).flatMap(p=>[0,2,4].map(i=>parseInt(p.slice(i,i+2),16))));
 let s=b.run(500);
 const before=peak(s);
 b.runner.setPartProps('enc1',{position:4});
 s=b.run(600);
 assert.equal(ext(s,'enc1').steps,4);
 assert.match(b.serial(),/level=80[\s\S]*level=96[\s\S]*level=112[\s\S]*level=128/);
 assert.ok(peak(s)>before+40,`brighter ${before} -> ${peak(s)}`);
 assert.equal(b.passed(),true);
 b.runner.setPartProps('enc1',{position:2});
 b.run(500);
 assert.match(b.serial(),/level=112\s+level=96/);   // counter-clockwise lowers it
 b.runner.setInput('enc1',{kind:'button',pressed:true});b.run(200);b.runner.setInput('enc1',{kind:'button',pressed:false});
 s=b.run(500);
 assert.match(b.serial(),/mode=1/);
 assert.equal(ext(s,'ring1').timingErrors,0);
});
test('neopixel: the circuit has no power notes',()=>{
 const runner=createLabRunner();
 runner.load(labFirmware.lessons.neopixel.variants[0]!,{},structuredClone(CIRCUITS.neopixel),labFirmware.toolchain);
 runner.start();runner.advance(400);
 assert.deepEqual(runner.snapshot().power??[],[]);
});
