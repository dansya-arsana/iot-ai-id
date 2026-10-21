import assert from 'node:assert/strict';
import test from 'node:test';
import {BOARD_FEATURES,CIRCUITS,FIRMWARE_SPEC,LESSON_IDS,MOTOR_MAX_RPM} from '../apps/web/src/lab/contract.js';
import type {PartState,PinSample,SimSnapshot,UnoPin} from '../apps/web/src/lab/contract.js';
import {GOALS,READOUTS} from '../apps/web/src/lab/goals.js';
import type {GoalMemory} from '../apps/web/src/lab/goals.js';
import {LESSONS} from '../apps/web/src/lab/lessons.js';
import {fillTemplate,tokenizeLine} from '../apps/web/src/lab/ui/highlight.js';
import {diffText} from '../apps/web/src/lab/ui/line-diff.js';

const pinS=(level:0|1):PinSample=>({mode:'output',level,duty:level,freqHz:0,highUs:0,analog:null});
function snap(parts:Record<string,PartState>,o:Partial<SimSnapshot>={}):SimSnapshot{
 const pins={} as Record<UnoPin,PinSample>;
 for(const k of ['D13'] as UnoPin[])pins[k]=pinS(0);
 return {status:'running',error:null,simTimeMs:0,speed:1,pins,parts,currentLine:null,txActive:false,...o};
}
const led=(on:boolean,brightness=on?1:0):PartState=>({kind:'led',on,brightness,currentMa:on?10:0,overCurrent:false});
const run=(id:typeof LESSON_IDS[number],frames:SimSnapshot[])=>{const m:GoalMemory={};let ok=false;for(const f of frames)ok=GOALS[id](f,m);return ok;};

test('12 lessons in order with en+id copy everywhere',()=>{
 assert.equal(LESSONS.length,12);
 assert.deepEqual(LESSONS.map(l=>l.id),[...LESSON_IDS]);
 const check=(v:unknown,path:string)=>{
  if(v&&typeof v==='object'){
   const o=v as Record<string,unknown>;
   if(typeof o.en==='string'&&typeof o.id==='string'){assert.ok(o.en.trim()&&o.id.trim(),path);return;}
   for(const [k,x] of Object.entries(o))check(x,`${path}.${k}`);
  }
 };
 LESSONS.forEach((l,i)=>{assert.equal(l.n,i+1);check(l,l.id);assert.ok(l.callouts.length>=3&&l.callouts.length<=5,l.id);assert.ok(l.walkthrough.length>=3&&l.walkthrough.length<=5,l.id);});
});

test('params, callout targets and variants match the contract',()=>{
 for(const l of LESSONS){
  const names=new Set(FIRMWARE_SPEC[l.id].variants.flatMap(v=>v.params.map(p=>p.name)));
  for(const n of names)assert.ok(l.params[n],`${l.id} missing param ${n}`);
  const ids=new Set<string>([...CIRCUITS[l.id].parts.map(p=>p.id),...BOARD_FEATURES]);
  for(const c of l.callouts)assert.ok(ids.has(c.target),`${l.id} callout target ${c.target}`);
  const vs=FIRMWARE_SPEC[l.id].variants;
  if(vs.length>1)for(const v of vs)assert.ok(l.variants?.[v.id],`${l.id} variant ${v.id}`);
 }
 assert.ok(LESSONS.find(l=>l.id==='button')?.variants?.hold&&LESSONS.find(l=>l.id==='sound')?.variants?.alarm);
});

test('seo description length',()=>{for(const l of LESSONS){const n=l.seo.description.length;assert.ok(n>=50&&n<=160,`${l.id} ${n}`);assert.ok(l.seo.title.length>0);}});

test('tokenizer',()=>{
 const t=tokenizeLine('  delay({{onTime}}); // c').tokens;
 assert.ok(t.some(x=>x.kind==='param'&&x.param==='onTime'));
 const k=(src:string,text:string)=>tokenizeLine(src).tokens.find(x=>x.text===text)?.kind;
 assert.equal(k('void setup(){','void'),'keyword');
 assert.equal(k('digitalWrite(8, HIGH);','digitalWrite'),'function');
 assert.equal(k('digitalWrite(8, HIGH);','HIGH'),'constant');
 assert.equal(k('delay(500);','500'),'number');
 assert.equal(k('x=1; // c','// c'),'comment');
 assert.equal(k('Serial.println("s");','"s"'),'string');
 assert.equal(tokenizeLine('a /* b',false).inBlock,true);
 assert.equal(fillTemplate('delay({{onTime}});',{onTime:100}),'delay(100);');
});

test('line diff marks changed lines',()=>{
 const hold='void loop(){\n  digitalWrite(8,digitalRead(2));\n}';
 const toggle='void loop(){\n  if(digitalRead(2)==LOW){\n    flip();\n  }\n}';
 assert.deepEqual(diffText(hold,toggle),[1,2,3]);
 assert.deepEqual(diffText(hold,hold),[]);
});

test('blink goal needs 4 toggles',()=>{
 const f=(n:number)=>Array.from({length:n},(_,i)=>snap({led1:led(i%2===0)}));
 assert.equal(run('blink',f(4)),false);
 assert.equal(run('blink',f(6)),true);
});
test('board goal counts D13 changes',()=>{
 const f=(n:number)=>Array.from({length:n},(_,i)=>snap({},{pins:{D13:pinS(i%2===0?1:0)} as Record<UnoPin,PinSample>}));
 assert.equal(run('board',f(4)),false);
 assert.equal(run('board',f(6)),true);
});
test('button goal: lit while pressed, then off',()=>{
 const b=(p:boolean):PartState=>({kind:'button',pressed:p});
 assert.equal(run('button',[snap({btn1:b(true),led1:led(true)})]),false);
 assert.equal(run('button',[snap({btn1:b(true),led1:led(true)}),snap({btn1:b(false),led1:led(false)})]),true);
});
test('knob goal needs pot sweep and brightness range',()=>{
 const p=(v:number,br:number)=>snap({pot1:{kind:'potentiometer',value:v},led1:led(br>0,br)});
 assert.equal(run('knob',[p(0,0),p(200,0.2)]),false);
 assert.equal(run('knob',[p(0,0),p(1000,0.9)]),true);
});
test('rgb, light, motor, servo, parking, sound goals',()=>{
 assert.equal(run('rgb',[snap({rgb1:{kind:'rgb-led',r:1,g:.2,b:.6}},{simTimeMs:500})]),false);
 assert.equal(run('rgb',[snap({rgb1:{kind:'rgb-led',r:1,g:.2,b:.6}},{simTimeMs:1200})]),true);
 assert.equal(run('light',[snap({led1:led(false)}),snap({led1:led(true)})]),true);
 assert.equal(run('motor',[snap({m1:{kind:'motor',duty:.5,rpm:MOTOR_MAX_RPM*.3}})]),false);
 assert.equal(run('motor',[snap({m1:{kind:'motor',duty:.9,rpm:MOTOR_MAX_RPM*.6}})]),true);
 const sv=(a:number):SimSnapshot=>snap({sv1:{kind:'servo',pulseUs:1500,angleDeg:a}});
 assert.equal(run('servo',[sv(10),sv(60)]),false);
 assert.equal(run('servo',[sv(10),sv(120)]),true);
 assert.equal(run('parking',[snap({ledR:led(true),ledG:led(false)})]),false);
 assert.equal(run('parking',[snap({ledR:led(true)}),snap({ledG:led(true)})]),true);
 const bz=(f:number):SimSnapshot=>snap({bz1:{kind:'buzzer',on:true,freqHz:f}});
 assert.equal(run('sound',[bz(523),bz(524)]),false);
 assert.equal(run('sound',[bz(523),bz(659)]),true);
});
test('distance goal needs 3 readings with 2 distinct values',()=>{
 const h=(pinging:boolean,cm:number|null):SimSnapshot=>snap({us1:{kind:'hcsr04',pinging,echoCm:cm}});
 const cyc=(cm:number)=>[h(true,null),h(false,cm)];
 assert.equal(run('distance',[...cyc(40),...cyc(40),...cyc(40)]),false);
 assert.equal(run('distance',[...cyc(40),...cyc(40),...cyc(80)]),true);
});
test('readouts format',()=>{
 const r=READOUTS.distance(snap({us1:{kind:'hcsr04',pinging:false,echoCm:46}}));
 assert.deepEqual(r,[{target:'us1',text:'46 cm'}]);
 assert.equal(READOUTS.servo(snap({sv1:{kind:'servo',pulseUs:1500,angleDeg:69}}))[0].text,'69°');
 assert.equal(READOUTS.sound(snap({bz1:{kind:'buzzer',on:true,freqHz:523}}))[0].text,'♪ 523 Hz');
});
