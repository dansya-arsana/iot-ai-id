import test from 'node:test';
import assert from 'node:assert/strict';
import {CIRCUITS,MOTOR_MAX_RPM} from '../apps/web/src/lab/contract.js';
import type {SimSnapshot} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/index.js';
import {labFirmware} from '../apps/web/src/lab/firmware/index.js';
import {GOALS,READOUTS} from '../apps/web/src/lab/goals.js';
import type {GoalMemory} from '../apps/web/src/lab/goals.js';

function boot(){
 const runner=createLabRunner();
 const lid='motor-driver' as keyof typeof CIRCUITS;
 runner.load(labFirmware.lessons[lid].variants[0]!,{},structuredClone(CIRCUITS[lid]),labFirmware.toolchain);
 runner.start();
 const mem:GoalMemory={};let passed=false;
 const run=(ms:number)=>{for(let t=0;t<ms;t+=20){const s=runner.advance(20);if(GOALS[lid](s,mem))passed=true;}return runner.snapshot();};
 return {runner,run,passed:()=>passed};
}
const motor=(s:SimSnapshot,id:string)=>{const p=s.parts[id];assert.ok(p&&p.kind==='motor',id);return p;};

test('25 motor-driver: the knob sets both motor speeds, opposite directions, from the battery', ()=>{
 const b=boot();
 let s=b.run(2500);
 const m1=motor(s,'m1'),m2=motor(s,'m2');
 assert.ok(m1.rpm>0.4*MOTOR_MAX_RPM,`m1 ${m1.rpm}`);
 assert.ok(m2.rpm<-0.4*MOTOR_MAX_RPM,`m2 ${m2.rpm}`);
 assert.equal(b.passed(),false,'fast alone is not the goal');
 assert.equal(READOUTS['motor-driver'](s).length>0,true);
 b.runner.setInput('pot1',{kind:'potentiometer',value:1023});
 s=b.run(2000);
 assert.ok(motor(s,'m1').rpm>0.9*MOTOR_MAX_RPM,'full knob = full speed '+motor(s,'m1').rpm);
 b.runner.setInput('pot1',{kind:'potentiometer',value:10});
 s=b.run(2500);
 assert.ok(Math.abs(motor(s,'m1').rpm)<0.05*MOTOR_MAX_RPM&&Math.abs(motor(s,'m2').rpm)<0.05*MOTOR_MAX_RPM);
 assert.equal(b.passed(),true);
});

test('25 motor-driver: a flat battery slows the motors',()=>{
 const b=boot();
 b.runner.setInput('pot1',{kind:'potentiometer',value:1023});
 const full=motor(b.run(2500),'m1').rpm;
 b.runner.setPartProps('bat1',{charge:5});
 const low=motor(b.run(2500),'m1').rpm;
 assert.ok(low<full*0.95,`low ${low} full ${full}`);
});
