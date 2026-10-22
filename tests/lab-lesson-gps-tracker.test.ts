import test from 'node:test';
import assert from 'node:assert/strict';
import {CIRCUITS} from '../apps/web/src/lab/contract.js';
import type {SimSnapshot} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/index.js';
import {labFirmware} from '../apps/web/src/lab/firmware/index.js';
import {GOALS,READOUTS} from '../apps/web/src/lab/goals.js';
import type {GoalMemory} from '../apps/web/src/lab/goals.js';
import {readCoord,nokiaRow} from '../apps/web/src/lab/lessons/gps-tracker.js';

/** Lesson 26 runs the real compiled sketch against the NEO-6M and Nokia 5110 device models. */
function boot(params:Record<string,number>={}){
 const runner=createLabRunner();
 const v=labFirmware.lessons['gps-tracker'].variants[0]!;
 runner.load(v,params,structuredClone(CIRCUITS['gps-tracker']),labFirmware.toolchain);
 runner.start();
 const mem:GoalMemory={};
 let passed=false;
 const run=(ms:number,step=20)=>{for(let t=0;t<ms;t+=step){const s=runner.advance(step);if(GOALS['gps-tracker'](s,mem))passed=true;}return runner.snapshot();};
 return {runner,run,passed:()=>passed,serial:()=>runner.serialText()};
}
const ext=(s:SimSnapshot,id:string)=>{const p=s.parts[id];assert.ok(p&&p.kind==='ext',`part ${id}`);return p.v;};
// independent 5x7 table (columns, bit 0 on top), written out here on purpose so a typo in the sketch font fails the test
const REF:Record<string,number[]>={
 '0':[0x3E,0x51,0x49,0x45,0x3E],'1':[0x00,0x42,0x7F,0x40,0x00],'2':[0x42,0x61,0x51,0x49,0x46],'3':[0x21,0x41,0x45,0x4B,0x31],'4':[0x18,0x14,0x12,0x7F,0x10],
 '5':[0x27,0x45,0x45,0x45,0x39],'6':[0x3C,0x4A,0x49,0x49,0x30],'7':[0x01,0x71,0x09,0x05,0x03],'8':[0x36,0x49,0x49,0x49,0x36],'9':[0x06,0x49,0x49,0x29,0x1E],
 '.':[0x00,0x60,0x60,0x00,0x00],'-':[0x08,0x08,0x08,0x08,0x08],':':[0x00,0x36,0x36,0x00,0x00],' ':[0,0,0,0,0],
 N:[0x7F,0x04,0x08,0x10,0x7F],S:[0x46,0x49,0x49,0x49,0x31],E:[0x7F,0x49,0x49,0x49,0x41],W:[0x3F,0x40,0x38,0x40,0x3F],F:[0x7F,0x09,0x09,0x09,0x01],
 I:[0x00,0x41,0x7F,0x41,0x00],X:[0x63,0x14,0x08,0x14,0x63],O:[0x3E,0x41,0x41,0x41,0x3E],A:[0x7E,0x11,0x11,0x11,0x7E],T:[0x01,0x01,0x7F,0x01,0x01],
};
const row=(fb:string,bank:number):string=>{
 let out='';
 for(let k=0;k<14;k++){
  const cols=Array.from({length:5},(_,i)=>parseInt(fb.slice((bank*84+k*6+i)*2,(bank*84+k*6+i)*2+2),16));
  const sep=parseInt(fb.slice((bank*84+k*6+5)*2,(bank*84+k*6+5)*2+2),16);
  const hit=Object.entries(REF).find(([,g])=>g.every((v,i)=>v===cols[i]));
  out+=hit&&sep===0?hit[0]:'?';
 }
 return out.trimEnd();
};

test('26 gps-tracker: the sketch parses real NMEA and prints the fix, position and time on the Nokia screen',()=>{
 const b=boot();
 let s=b.run(2600);
 assert.match(b.serial(),/gps ready/);
 let fb=String(ext(s,'lcd1').fb);
 assert.equal(row(fb,0),'FIX 08 SAT');
 assert.equal(row(fb,1),'6.20880 S');
 assert.equal(row(fb,2),'106.84560 E');
 assert.match(row(fb,4),/^03:00:0\d$/);
 assert.equal(readCoord(nokiaRow(fb,1)),-6.2088);
 assert.match(b.serial(),/FIX 08 SAT 6\.20880 S 106\.84560 E/);
 assert.equal(b.passed(),false,'a fix at the default place is not yet the goal');
 b.runner.setPartProps('gps1',{lat:35.6762,lon:-139.6503});
 s=b.run(2600);
 fb=String(ext(s,'lcd1').fb);
 assert.equal(row(fb,1),'35.67620 N');
 assert.equal(row(fb,2),'139.65030 W');
 assert.equal(b.passed(),true,'goal met once the screen shows the moved position');
 assert.ok(READOUTS['gps-tracker'](s).some(r=>/sat/.test(r.text)));
});

test('26 gps-tracker: no fix prints NO FIX and blank coordinates; a high satsNeeded does the same',()=>{
 const b=boot();
 b.run(2600);
 b.runner.setPartProps('gps1',{fix:false});
 let s=b.run(2600);
 const fb=String(ext(s,'lcd1').fb);
 assert.equal(row(fb,0),'NO FIX');
 assert.equal(row(fb,1),'-');
 assert.equal(row(fb,2),'-');
 assert.equal(b.passed(),false);
 const c=boot({satsNeeded:10});
 s=c.run(2600);
 assert.equal(row(String(ext(s,'lcd1').fb),0),'NO FIX');
});

test('26 gps-tracker: the module sends the four sentences each second and reports a fix',()=>{
 const b=boot();
 b.run(1500);
 const g=b.runner.snapshot();
 assert.equal(ext(g,'gps1').fix,true);
 assert.ok(Number(ext(g,'gps1').sentences)>=4);
});
