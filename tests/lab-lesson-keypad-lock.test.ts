import test from 'node:test';
import assert from 'node:assert/strict';
import {CIRCUITS} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/index.js';
import {labFirmware} from '../apps/web/src/lab/firmware/index.js';
import {GOALS} from '../apps/web/src/lab/goals.js';
import type {GoalMemory} from '../apps/web/src/lab/goals.js';

const ID='keypad-lock' as never;
function boot(params:Record<string,number>={}){
 const runner=createLabRunner();
 runner.load(labFirmware.lessons[ID].variants[0]!,params,structuredClone(CIRCUITS[ID]),labFirmware.toolchain);
 runner.start();
 const mem:GoalMemory={};let passed=false;
 const run=(ms:number)=>{for(let t=0;t<ms;t+=10){const s=runner.advance(10);if(GOALS[ID](s,mem))passed=true;}return runner.snapshot();};
 const press=(k:string)=>{runner.setPartProps('pad1',{key:k});run(120);runner.setPartProps('pad1',{key:'none'});run(120);};
 const ext=(id:string)=>{const p=runner.snapshot().parts[id];assert.ok(p&&p.kind==='ext');return p.v;};
 return {runner,run,press,ext,passed:()=>passed,serial:()=>runner.serialText(),angle:()=>{const p=runner.snapshot().parts.sv1;return p&&p.kind==='servo'?p.angleDeg:-1;}};
}

test('keypad-lock: starts locked with dashes on the display',()=>{
 const b=boot();b.run(300);
 assert.match(b.serial(),/ready/);
 assert.equal(String(b.ext('tm1').text),'----');
 assert.ok(b.angle()<20);
});
test('keypad-lock: the right PIN shows OPEn, swings the servo open, then locks again',()=>{
 const b=boot({openMs:1000});b.run(300);
 for(const k of ['1','2']){b.press(k);}
 assert.equal(String(b.ext('tm1').text),'12--');
 for(const k of ['3','4'])b.press(k);
 assert.equal(String(b.ext('tm1').text),'1234');
 assert.equal(b.passed(),false);
 b.runner.setPartProps('pad1',{key:'#'});b.run(300);b.runner.setPartProps('pad1',{key:'none'});
 b.run(400);
 assert.equal(String(b.ext('tm1').text),'0PEn');
 assert.ok(b.angle()>=80,`angle ${b.angle()}`);
 assert.match(b.serial(),/unlocked/);
 assert.equal(b.passed(),true);
 b.run(2500);
 assert.ok(b.angle()<20);
 assert.match(b.serial(),/locked/);
 assert.equal(String(b.ext('tm1').text),'----');
});
test('keypad-lock: a wrong PIN shows Err and the latch stays shut; * clears',()=>{
 const b=boot();b.run(300);
 for(const k of ['9','9','9','9'])b.press(k);
 b.runner.setPartProps('pad1',{key:'#'});b.run(300);b.runner.setPartProps('pad1',{key:'none'});b.run(100);
 assert.equal(String(b.ext('tm1').text).trim(),'Err');
 assert.match(b.serial(),/denied 1/);
 assert.ok(b.angle()<20);assert.equal(b.passed(),false);
 b.run(1200);
 b.press('5');b.press('*');
 assert.equal(String(b.ext('tm1').text),'----');
 assert.match(b.serial(),/cleared/);
});
test('keypad-lock: the PIN is a tunable parameter',()=>{
 const b=boot({pinCode:4321,openMs:1000});b.run(300);
 for(const k of ['4','3','2','1'])b.press(k);
 b.runner.setPartProps('pad1',{key:'#'});b.run(300);b.runner.setPartProps('pad1',{key:'none'});b.run(400);
 assert.equal(String(b.ext('tm1').text),'0PEn');
});
