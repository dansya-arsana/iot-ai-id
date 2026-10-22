import test from 'node:test';
import assert from 'node:assert/strict';
import {CIRCUITS} from '../apps/web/src/lab/contract.js';
import type {SimSnapshot} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/index.js';
import {labFirmware} from '../apps/web/src/lab/firmware/index.js';
import {GOALS} from '../apps/web/src/lab/goals.js';
import type {GoalMemory} from '../apps/web/src/lab/goals.js';

const ext=(s:SimSnapshot,id:string)=>{const p=s.parts[id];assert.ok(p&&p.kind==='ext',`part ${id}`);return p.v;};
const servo=(s:SimSnapshot)=>{const p=s.parts.sv1;assert.ok(p&&p.kind==='servo');return p.angleDeg;};

test('rfid-door: allow-list opens servo and relay, a refused fob changes nothing, goal needs both',()=>{
 const runner=createLabRunner();
 runner.load(labFirmware.lessons['rfid-door'].variants[0]!,{unlockMs:1500},structuredClone(CIRCUITS['rfid-door']),labFirmware.toolchain);
 runner.start();
 const mem:GoalMemory={};let passed=false;
 const run=(ms:number)=>{for(let t=0;t<ms;t+=20){const s=runner.advance(20);if(GOALS['rfid-door'](s,mem))passed=true;}return runner.snapshot();};
 let s=run(1500);
 assert.match(runner.serialText(),/reader ver=92/);
 assert.match(runner.serialText(),/ready: door locked/);
 assert.ok(servo(s)<10);assert.equal(ext(s,'rel1').energized,false);

 runner.setPartProps('rc1',{card:'card2'});               // blue fob: not on the list
 s=run(1500);
 assert.match(runner.serialText(),/uid=07C56E2D DENIED/);
 assert.ok(servo(s)<10);assert.equal(ext(s,'rel1').energized,false);assert.equal(passed,false);

 runner.setPartProps('rc1',{card:'none'});run(300);
 runner.setPartProps('rc1',{card:'card1'});               // white card: on the list
 s=run(1000);
 assert.match(runner.serialText(),/uid=4BA21F93 GRANTED/);
 assert.ok(servo(s)>=80);assert.equal(ext(s,'rel1').energized,true);assert.equal(ext(s,'bulb1').on,true);
 s=run(2500);
 assert.match(runner.serialText(),/door locked\r?\n/);
 assert.ok(servo(s)<10);assert.equal(ext(s,'rel1').energized,false);
 assert.equal(passed,true,'opened, relocked and the fob was refused');

 runner.setPartProps('rc1',{card:'none'});run(300);
 runner.setPartProps('rc1',{card:'card3'});               // 7-byte sticker tag: also on the list
 s=run(1200);
 assert.match(runner.serialText(),/uid=046AB12C5F7180 GRANTED/);
 assert.ok(servo(s)>=80);
});
