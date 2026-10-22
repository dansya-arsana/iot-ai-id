import test from 'node:test';
import assert from 'node:assert/strict';
import {CIRCUITS} from '../apps/web/src/lab/contract.js';
import type {SimSnapshot} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/index.js';
import {labFirmware} from '../apps/web/src/lab/firmware/index.js';
import {GOALS,READOUTS} from '../apps/web/src/lab/goals.js';
import type {GoalMemory} from '../apps/web/src/lab/goals.js';

/** Lesson 17 runs the real compiled sketch against the BMP280, DHT22 and LCD2004 models. */
function boot(){
 const runner=createLabRunner();
 runner.load(labFirmware.lessons['weather-station'].variants[0]!,{},structuredClone(CIRCUITS['weather-station']),labFirmware.toolchain);
 runner.start();
 const mem:GoalMemory={};let passed=false;
 const run=(ms:number,step=20)=>{for(let t=0;t<ms;t+=step){const s=runner.advance(step);if(GOALS['weather-station'](s,mem))passed=true;}return runner.snapshot();};
 return {runner,run,passed:()=>passed,serial:()=>runner.serialText()};
}
const ext=(s:SimSnapshot,id:string)=>{const p=s.parts[id];assert.ok(p&&p.kind==='ext',`part ${id}`);return p.v;};
const rows=(s:SimSnapshot)=>{const l=ext(s,'lcd1');return [l.line1,l.line2,l.line3,l.line4].map(v=>String(v).trimEnd());};

test('17 weather station: the LCD shows DHT22 and BMP280 values, and no power warning',()=>{
 const b=boot();
 const s=b.run(4500);
 assert.match(b.serial(),/ready/);
 const r=rows(s);
 assert.equal(r[0],'DHT 24.0C  60.0%');
 assert.match(r[1]!,/^BMP 24\.0C 1013 hPa$/);
 assert.equal(r[2],'Tmin 24.0 max 24.0');
 assert.equal(r[3],'Pmin 1013 max 1013');
 assert.equal(b.passed(),false,'a flat min/max is not the goal');
 assert.deepEqual(s.power??[],[]);
});

test('17 weather station: moving the BMP280 opens the min and max rows and meets the goal',()=>{
 const b=boot();
 b.run(3500);
 b.runner.setPartProps('bmp1',{temperature:30,pressure:1020});
 b.run(3500);
 b.runner.setPartProps('bmp1',{temperature:20,pressure:1008});
 b.runner.setPartProps('dht1',{tempC:19,humidity:44});
 const s=b.run(3500);
 const r=rows(s);
 assert.equal(r[0],'DHT 19.0C  44.0%');
 assert.match(r[1]!,/^BMP 20\.0C 1008 hPa$/);
 assert.equal(r[2],'Tmin 20.0 max 30.0');
 assert.equal(r[3],'Pmin 1008 max 1020');
 assert.equal(b.passed(),true);
 assert.ok(READOUTS['weather-station'](s).length>=2);
});

test('17 weather station: a missing DHT22 says so and the BMP280 rows keep working',()=>{
 const b=boot();
 const c=structuredClone(CIRCUITS['weather-station']);
 c.parts=c.parts.filter(p=>p.id!=='dht1');
 b.runner.load(labFirmware.lessons['weather-station'].variants[0]!,{},c,labFirmware.toolchain);b.runner.start();
 const s=b.runner.advance(4000);
 const r=rows(s);
 assert.equal(r[0],'DHT22 no answer');
 assert.match(r[1]!,/^BMP /);
});
