import test from 'node:test';
import assert from 'node:assert/strict';
import {CIRCUITS,FIRMWARE_SPEC,MOTOR_MAX_RPM} from '../apps/web/src/lab/contract.js';
import type {LessonId,ParamValues,PartState,SimSnapshot,UnoPin} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/index.js';
import {labFirmware} from '../apps/web/src/lab/firmware/index.js';

function boot(id:LessonId,params:ParamValues={},variant?:string){
 const runner=createLabRunner();
 const bundle=labFirmware.lessons[id];
 const v=bundle.variants.find(x=>x.id===(variant??FIRMWARE_SPEC[id].variants[0].id))!;
 assert.ok(v,'variant exists');
 runner.load(v,params,CIRCUITS[id],labFirmware.toolchain);
 runner.start();
 let serial='';
 runner.onSerial(c=>{serial+=c;});
 return {runner,v,serial:()=>serial};
}
type R=ReturnType<typeof boot>['runner'];
/** Advance until pred is true, in `step` ms increments, up to maxMs. Returns elapsed ms or -1. */
function until(r:R,maxMs:number,pred:(s:SimSnapshot)=>boolean,step=5){
 for(let t=0;t<=maxMs;t+=step){const s=r.advance(step);if(pred(s))return t;}
 return -1;
}
const part=<K extends PartState['kind']>(s:SimSnapshot,id:string,kind:K)=>{const p=s.parts[id];assert.equal(p.kind,kind);return p as Extract<PartState,{kind:K}>;};
const lvl=(s:SimSnapshot,p:UnoPin)=>s.pins[p].level;

test('every lesson default firmware loads and runs without error',()=>{
 for(const id of Object.keys(FIRMWARE_SPEC) as LessonId[]){
  const {runner}=boot(id);
  const s=runner.advance(50);
  assert.equal(s.status,'running',id);
  assert.equal(s.error,null,id);
 }
});

test('board: D13 toggles',()=>{
 const {runner}=boot('board');
 let changes=0,last=-1;
 for(let t=0;t<2500;t+=10){const l=lvl(runner.advance(10),'D13');if(last>=0&&l!==last)changes++;last=l;}
 assert.ok(changes>=2,`changes=${changes}`);
});

test('blink: patched onTime gives measured HIGH time, source line tracked',()=>{
 const {runner,v}=boot('blink',{onTime:100});
 let high=0,low=0,cur:number|null=null;const hs:number[]=[],ls:number[]=[];let prev=-1;
 const lineCount=v.source.split('\n').length;
 for(let t=0;t<4000;t++){
  const s=runner.advance(1);const l=lvl(s,'D8');
  if(s.currentLine!==null)cur=s.currentLine;
  if(prev===1&&l===0){hs.push(high);high=0;}
  else if(prev===0&&l===1){ls.push(low);low=0;}
  if(l===1)high++;else low++;
  prev=l;
 }
 assert.ok(hs.length>=2&&ls.length>=2);
 const h=hs[hs.length-1],lo=ls[ls.length-1];
 assert.ok(Math.abs(h-100)<=3,`high=${h}`);
 assert.ok(Math.abs(lo-500)<=3,`low=${lo}`);
 assert.ok(cur!==null&&cur>=1&&cur<=lineCount,`line=${cur}`);
});

test('button hold: press drives D8',()=>{
 const {runner}=boot('button');
 runner.advance(20);
 assert.equal(lvl(runner.snapshot(),'D8'),0);
 runner.setInput('btn1',{kind:'button',pressed:true});
 assert.ok(until(runner,50,s=>lvl(s,'D8')===1,1)>=0);
 runner.setInput('btn1',{kind:'button',pressed:false});
 assert.ok(until(runner,50,s=>lvl(s,'D8')===0,1)>=0);
});

test('knob: pot 1023 gives full brightness and prints 1023',()=>{
 const {runner,serial}=boot('knob');
 runner.setInput('pot1',{kind:'potentiometer',value:1023});
 runner.advance(1200);
 assert.ok(part(runner.snapshot(),'led1','led').brightness>=0.95);
 assert.match(serial(),/1023/);
});

test('rgb: default colour mix',()=>{
 const {runner}=boot('rgb');
 runner.advance(300);
 const c=part(runner.snapshot(),'rgb1','rgb-led');
 assert.ok(Math.abs(c.r-1)<=0.03,`r=${c.r}`);
 assert.ok(Math.abs(c.g-0.25)<=0.03,`g=${c.g}`);
 assert.ok(Math.abs(c.b-0.63)<=0.03,`b=${c.b}`);
});

test('light: lamp off turns the night light on',()=>{
 const {runner}=boot('light');
 runner.advance(400);
 assert.equal(part(runner.snapshot(),'led1','led').on,false);
 runner.setInput('lamp1',{kind:'lamp',on:false});
 assert.ok(until(runner,300,s=>part(s,'led1','led').on)>=0);
});

test('distance: obstacle 40 cm prints about 40 cm',()=>{
 const {runner,serial}=boot('distance');
 runner.setInput('obs1',{kind:'obstacle',distanceCm:40});
 runner.advance(1000);
 assert.match(serial(),/\b(39|40|41) cm/);
});

test('sound scale: buzzer plays a tone',()=>{
 const {runner}=boot('sound',{},'scale');
 assert.ok(until(runner,1000,s=>part(s,'bz1','buzzer').freqHz>200)>=0);
});

test('motor: spins up',()=>{
 const {runner}=boot('motor');
 assert.ok(until(runner,6000,s=>part(s,'m1','motor').rpm>0.5*MOTOR_MAX_RPM,10)>=0);
});

test('servo: sweeps past 160 degrees',()=>{
 const {runner}=boot('servo');
 assert.ok(until(runner,4000,s=>part(s,'sv1','servo').angleDeg>=160,10)>=0);
});

test('parking: near obstacle lights red, far lights green',()=>{
 const {runner}=boot('parking');
 runner.setInput('obs1',{kind:'obstacle',distanceCm:10});
 assert.ok(until(runner,500,s=>part(s,'ledR','led').on)>=0);
 runner.setInput('obs1',{kind:'obstacle',distanceCm:100});
 assert.ok(until(runner,1500,s=>part(s,'ledG','led').on)>=0);
});

test('out-of-range param throws RangeError',()=>{
 const runner=createLabRunner();
 const v=labFirmware.lessons.blink.variants[0];
 assert.throws(()=>runner.load(v,{onTime:1},CIRCUITS.blink,labFirmware.toolchain),RangeError);
 assert.throws(()=>runner.load(v,{onTime:99999},CIRCUITS.blink,labFirmware.toolchain),RangeError);
});
