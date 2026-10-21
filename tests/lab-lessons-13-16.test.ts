import test from 'node:test';
import assert from 'node:assert/strict';
import {CIRCUITS} from '../apps/web/src/lab/contract.js';
import type {LessonId,SimSnapshot} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/index.js';
import {labFirmware} from '../apps/web/src/lab/firmware/index.js';
import {GOALS,READOUTS} from '../apps/web/src/lab/goals.js';
import type {GoalMemory} from '../apps/web/src/lab/goals.js';
import {readLine,litPixels} from './lab-oled-font.js';

/** Lessons 13-16 run the real compiled sketches against the real device models. */
function boot(id:LessonId,params:Record<string,number>={}){
 const runner=createLabRunner();
 const v=labFirmware.lessons[id].variants[0]!;
 runner.load(v,params,structuredClone(CIRCUITS[id]),labFirmware.toolchain);
 runner.start();
 const mem:GoalMemory={};
 let passed=false;
 const run=(ms:number,step=20)=>{for(let t=0;t<ms;t+=step){const s=runner.advance(step);if(GOALS[id](s,mem))passed=true;}return runner.snapshot();};
 return {runner,run,passed:()=>passed,serial:()=>runner.serialText()};
}
const ext=(s:SimSnapshot,id:string)=>{const p=s.parts[id];assert.ok(p&&p.kind==='ext',`part ${id}`);return p.v;};

test('13 oled: the sketch draws the DHT22 reading into the real 128x64 frame, and redraws it',()=>{
 const b=boot('oled');
 let s=b.run(3200);
 assert.match(b.serial(),/ready/);
 let fb=String(ext(s,'oled1').fb);
 assert.ok(litPixels(fb)>200,'frame has real pixels');
 assert.equal(readLine(fb,1),'T 24.0 C');
 assert.equal(readLine(fb,4),'H 60.0 %');
 assert.equal(ext(s,'oled1').on,true);
 assert.equal(b.passed(),false,'one reading is not enough');
 b.runner.setPartProps('dht1',{tempC:-3.5,humidity:81});
 s=b.run(3000);
 fb=String(ext(s,'oled1').fb);
 assert.equal(readLine(fb,1),'T -3.5 C');
 assert.equal(readLine(fb,4),'H 81.0 %');
 assert.equal(b.passed(),true,'goal met after a second, different reading');
 assert.ok(READOUTS.oled(s).some(r=>/px lit/.test(r.text)));
});

test('13 oled: a missing sensor shows ERR on the screen, not stale digits',()=>{
 const b=boot('oled');
 const c=structuredClone(CIRCUITS.oled);
 c.parts=c.parts.filter(p=>p.id!=='dht1');
 b.runner.load(labFirmware.lessons.oled.variants[0]!,{},c,labFirmware.toolchain);b.runner.start();
 const s=b.runner.advance(3000);
 assert.equal(readLine(String(ext(s,'oled1').fb),1),'T ERR');
 assert.equal(readLine(String(ext(s,'oled1').fb),4),'H ERR');
});

test('14 motion: PIR motion closes the relay, the lamp lights, and the hold time releases it',()=>{
 const b=boot('motion',{holdMs:2000});
 let s=b.run(3000);
 assert.equal(ext(s,'rel1').energized,false);
 assert.equal(ext(s,'bulb1').on,false);
 assert.equal(s.pins.D7.level,1,'relay input idles high (off)');
 b.runner.setPartProps('pir1',{motion:true});
 s=b.run(400);
 assert.equal(s.pins.D7.level,0,'sketch pulled the active-low input down');
 assert.equal(ext(s,'rel1').energized,true);
 assert.equal(ext(s,'rel1').comTo,'NO');
 assert.equal(ext(s,'bulb1').on,true);
 assert.match(b.serial(),/motion: lamp ON/);
 assert.equal(b.passed(),false);
 b.runner.setPartProps('pir1',{motion:false});
 s=b.run(1500);
 assert.equal(ext(s,'rel1').energized,true,'PIR hold (1 s) plus sketch hold (2 s): still on');
 s=b.run(4500);
 assert.equal(ext(s,'rel1').energized,false);
 assert.equal(ext(s,'rel1').comTo,'NC');
 assert.equal(ext(s,'bulb1').on,false);
 assert.match(b.serial(),/quiet: lamp OFF/);
 assert.equal(b.passed(),true);
});

test('15 plant: the LCD shows the real percentage and advice, and the LED follows the threshold',()=>{
 const b=boot('plant');
 let s=b.run(2500);
 let lcd=ext(s,'lcd1');
 assert.equal(lcd.display,true);
 assert.match(String(lcd.line1),/^Soil 5\d% +$/);   // 55 % wet -> reading 2.05 V -> about 55 %
 assert.equal(String(lcd.line2).trim(),'Soil is fine');
 assert.equal(s.parts.led1!.kind==='led'&&s.parts.led1!.on,false);
 b.runner.setPartProps('soil1',{wetness:10});
 s=b.run(2500);
 lcd=ext(s,'lcd1');
 assert.match(String(lcd.line1),/^Soil \d+%\s+$/);
 assert.equal(String(lcd.line2).trim(),'Needs water!');
 assert.equal(s.parts.led1!.kind==='led'&&s.parts.led1!.on,true);
 assert.equal(b.passed(),false,'still needs the wet half');
 b.runner.setPartProps('soil1',{wetness:80});
 s=b.run(2500);
 assert.equal(String(ext(s,'lcd1').line2).trim(),'Soil is fine');
 assert.equal(s.parts.led1!.kind==='led'&&s.parts.led1!.on,false);
 assert.equal(b.passed(),true);
});

test('15 plant: a lower dryBelow keeps the alert quiet at the same wetness',()=>{
 const b=boot('plant',{dryBelow:10});
 b.runner.setPartProps('soil1',{wetness:20});
 const s=b.run(2500);
 assert.equal(String(ext(s,'lcd1').line2).trim(),'Soil is fine');
});

test('16 remote: every digit key decodes through the NEC frame and lights the right segments',()=>{
 const keys=['0','1','2','3','4','5','6','7','8','9'];
 const b=boot('remote');
 b.run(300);
 for(const k of keys){
  b.runner.setPartProps('ir1',{button:k});
  const s=b.run(250,5);
  assert.equal(ext(s,'seg1').glyph,k,`key ${k}`);
  assert.equal(ext(s,'ir1').frames,keys.indexOf(k)+1);
  b.run(150);
 }
 assert.ok(/key 7/.test(b.serial())&&/key 0/.test(b.serial()));
 assert.equal(b.passed(),true);
});

test('16 remote: keys that are not digits leave the display alone, and a repeat code does not redraw',()=>{
 const b=boot('remote');
 b.run(200);
 b.runner.setPartProps('ir1',{button:'4'});
 let s=b.run(250,5);
 assert.equal(ext(s,'seg1').glyph,'4');
 b.run(150);
 b.runner.setPartProps('ir1',{button:'vol+'});
 s=b.run(250,5);
 assert.equal(ext(s,'seg1').glyph,'4','vol+ is not a digit');
 b.run(150);
 b.runner.setPartProps('ir1',{button:'9',hold:true});
 s=b.run(500,5);
 assert.equal(ext(s,'seg1').glyph,'9');
 assert.ok(Number(ext(s,'ir1').repeats)>=1);
 assert.match(b.serial(),/repeat/);
});
