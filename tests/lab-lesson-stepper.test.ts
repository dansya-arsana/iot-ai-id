import test from 'node:test';
import assert from 'node:assert/strict';
import {CIRCUITS} from '../apps/web/src/lab/contract.js';
import type {SimSnapshot} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/index.js';
import {labFirmware} from '../apps/web/src/lab/firmware/index.js';
import {GOALS,READOUTS} from '../apps/web/src/lab/goals.js';
import type {GoalMemory} from '../apps/web/src/lab/goals.js';
import {oledPosition,readOledLine} from '../apps/web/src/lab/lessons/stepper.js';

/** Lesson 22 runs the real sketch: joystick ADC in, ULN2003 coil patterns out, stepper turning, OLED frame drawn over I2C. */
function boot(params:Record<string,number>={}){
 const runner=createLabRunner();
 runner.load(labFirmware.lessons.stepper.variants[0]!,params,structuredClone(CIRCUITS.stepper),labFirmware.toolchain);
 runner.start();
 const mem:GoalMemory={};
 let passed=false;
 const run=(ms:number,step=10)=>{for(let t=0;t<ms;t+=step){const s=runner.advance(step);if(GOALS.stepper(s,mem))passed=true;}return runner.snapshot();};
 return {runner,run,passed:()=>passed};
}
const ext=(s:SimSnapshot,id:string)=>{const p=s.parts[id];assert.ok(p&&p.kind==='ext',`part ${id}`);return p.v as Record<string,number|boolean|string>;};

test('22 stepper: the centred stick holds still and the screen reads POS 0',()=>{
 const b=boot();
 const s=b.run(600);
 assert.match(b.runner.serialText(),/ready/);
 assert.equal(ext(s,'stp1').halfSteps,0);
 assert.equal(ext(s,'stp1').powered,true);
 assert.equal(readOledLine(String(ext(s,'oled1').fb),1).trim(),'POS 0');
 assert.equal(readOledLine(String(ext(s,'oled1').fb),4).trim(),'DEG 0');
 assert.equal(b.passed(),false);
});

test('22 stepper: pushing the stick turns the motor forward, the screen follows, the goal is met',()=>{
 const b=boot();
 b.run(200);
 b.runner.setPartProps('joy1',{x:1023});
 let s=b.run(2500);
 const moved=ext(s,'stp1');
 assert.ok((moved.halfSteps as number)>600,`forward ${moved.halfSteps}`);
 assert.equal(moved.missed,0,'1.5 ms per half step is inside the pull-in rate');
 b.runner.setPartProps('joy1',{x:512});
 s=b.run(1900);
 const st=ext(s,'stp1');
 assert.ok((st.halfSteps as number)>=1000,`halfSteps ${st.halfSteps}`);
 assert.equal(oledPosition(String(ext(s,'oled1').fb)),st.halfSteps,'the OLED shows the position the motor is really at');
 assert.equal(st.coils,0,'the coils are released after 1.5 s idle');
 assert.equal(b.passed(),true);
 assert.ok(READOUTS.stepper(s).some(r=>/half steps/.test(r.text)));
});

test('22 stepper: the speed follows the stick, left turns back, SW sends the shaft home',()=>{
 const slow=boot();slow.run(200);slow.runner.setPartProps('joy1',{x:620});
 const sa=ext(slow.run(1000),'stp1').halfSteps as number;
 const fast=boot();fast.run(200);fast.runner.setPartProps('joy1',{x:1023});
 const fa=ext(fast.run(1000),'stp1').halfSteps as number;
 assert.ok(fa>sa*2,`full deflection ${fa} vs light push ${sa}`);
 assert.ok(sa>20,'a light push still moves');

 const b=boot();b.run(200);
 b.runner.setPartProps('joy1',{x:0});
 let s=b.run(1500);
 const back=ext(s,'stp1').halfSteps as number;
 assert.ok(back<-300,`reverse ${back}`);
 assert.equal(ext(s,'stp1').missed,0);
 b.runner.setPartProps('joy1',{x:512,pressed:true});
 s=b.run(4000);
 assert.equal(ext(s,'stp1').halfSteps,0,'homed');
 assert.equal(oledPosition(String(ext(s,'oled1').fb)),0);
});

test('22 stepper: fastUs at 1000 us is still inside the pull-in rate (no lost steps)',()=>{
 const b=boot({fastUs:1000});
 b.run(200);b.runner.setPartProps('joy1',{x:1023});
 const s=b.run(1500);
 assert.equal(ext(s,'stp1').missed,0,'1.0 ms per half step is still above the 0.9 ms limit');
});
