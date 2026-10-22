import test from 'node:test';
import assert from 'node:assert/strict';
import {CIRCUITS} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/index.js';
import {labFirmware} from '../apps/web/src/lab/firmware/index.js';
import {GOALS} from '../apps/web/src/lab/goals.js';
import type {GoalMemory} from '../apps/web/src/lab/goals.js';
import type {SimSnapshot} from '../apps/web/src/lab/contract.js';
import {readClockFace} from '../apps/web/src/lab/lessons/clock.js';

function boot(params:Record<string,number>={},props:Record<string,unknown>={}){
 const runner=createLabRunner();
 const circuit=structuredClone(CIRCUITS.clock!);
 for(const p of circuit.parts)if(p.id==='rtc1')Object.assign(p.props,props);
 runner.load(labFirmware.lessons.clock!.variants[0]!,params,circuit,labFirmware.toolchain);
 runner.start();
 const mem:GoalMemory={};
 let passed=false;
 const run=(ms:number,each?:(s:SimSnapshot)=>void)=>{for(let t=0;t<ms;t+=20){const s=runner.advance(20);each?.(s);if(GOALS.clock!(s,mem))passed=true;}return runner.snapshot();};
 return {runner,run,passed:()=>passed,mem,serial:()=>runner.serialText()};
}
const ext=(s:SimSnapshot,id:string)=>{const p=s.parts[id];assert.ok(p&&p.kind==='ext',`part ${id}`);return p.v;};

test('clock: the sketch sets the stopped DS3231, draws HH:MM:SS from the real registers and the face matches the chip',()=>{
 const b=boot();
 const s=b.run(2500);
 assert.match(b.serial(),/clock was stopped: set 07:30:00/);
 assert.match(b.serial(),/alarm at 07:30:06/);
 const rtc=ext(s,'rtc1');
 assert.equal(rtc.osf,false,'sketch cleared OSF');
 const face=readClockFace(String(ext(s,'mx1').fb));
 assert.match(String(face),/^07:30:0[0-3]$/);
 assert.ok(String(rtc.time).endsWith(String(face)) || Math.abs(Number(String(face).slice(6))-Number(rtc.second))<=1);
 assert.equal(b.passed(),false,'no alarm yet');
 // the face advances with the chip
 const f1=readClockFace(String(ext(b.run(2000),'mx1').fb));
 assert.notEqual(f1,face);
});

test('clock: alarm 1 pulls SQW low, the buzzer rings while it is low, then the sketch clears the flag',()=>{
 const b=boot();
 let sawLow=false,ringDuringLow=false,bright=false;
 b.run(14000,s=>{
  const r=ext(s,'rtc1');
  if(r.intLow===true){sawLow=true;const z=s.parts.bz1;if(z&&z.kind==='buzzer'&&z.on&&z.freqHz>1500)ringDuringLow=true;if(String(ext(s,'mx1').lum).startsWith('f'))bright=true;}
 });
 assert.ok(sawLow,'INT went low');
 assert.ok(ringDuringLow,'buzzer rang at ~2 kHz while INT was low');
 assert.ok(bright,'display went to full brightness');
 assert.match(b.serial(),/ALARM 27\.00 C/);
 assert.match(b.serial(),/alarm cleared/);
 assert.equal(ext(b.runner.snapshot(),'rtc1').intLow,false,'flag cleared, INT released');
 assert.equal(b.passed(),true,'goal met');
});

test('clock: the alarm line reports the chip temperature from registers 0x11 and 0x12, including a negative one',()=>{
 for(const [t,txt] of [[31.25,'31.25'],[-3.25,'-3.25']] as const){
  const b=boot({alarmAfter:3},{temperature:t});
  b.run(6000);
  assert.ok(b.serial().includes(`ALARM ${txt} C`),b.serial());
 }
});

test('clock: with a healthy backup battery the sketch keeps the time the chip holds',()=>{
 const b=boot({alarmAfter:5},{lostPower:false});
 const s=b.run(1500);
 assert.doesNotMatch(b.serial(),/clock was stopped/);
 assert.match(String(ext(s,'rtc1').time),/10:00:0\d$/);
 assert.match(String(readClockFace(String(ext(s,'mx1').fb))),/^10:00:0\d$/);
 b.run(9000);
 assert.equal(b.passed(),true);
});
