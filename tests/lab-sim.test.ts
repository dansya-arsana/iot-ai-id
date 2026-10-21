import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble} from 'avr8js/dist/cjs/utils/assembler.js';
import {CIRCUITS,FLASH_WORDS,UNO_PINS} from '../apps/web/src/lab/contract.js';
import type {FirmwareParam,FirmwareVariant,PartSpec,PinSample,UnoPin} from '../apps/web/src/lab/contract.js';
import {buildLineIndex,createLabRunner,decodeFlash,patchFlash,toProgramWords} from '../apps/web/src/lab/sim/index.js';
import {PinMonitor} from '../apps/web/src/lab/sim/pins.js';
import {EMPTY,createModels} from '../apps/web/src/lab/sim/peripherals.js';
import type {Env,PartModel} from '../apps/web/src/lab/sim/peripherals.js';

function variantFromAsm(src:string,lines:[number,number,number][]=[]):FirmwareVariant{
 const r=assemble(src);
 assert.deepEqual(r.errors,[]);
 return {id:'t',sketch:'t-t',source:'',template:'',flashBase64:Buffer.from(r.bytes).toString('base64'),bytes:r.bytes.length,sha256:'',lines,params:[]};
}
const p=(name:string,ctype:FirmwareParam['ctype'],offset:number,min:number,max:number,d:number):FirmwareParam=>({name,ctype,offset,min,max,defaultValue:d,step:1});

test('patchFlash writes little-endian widths and rejects bad values',()=>{
 const flash=new Uint8Array(32);
 const params=[p('a','uint8',0,0,255,1),p('b','uint16',2,0,65535,500),p('c','uint32',4,0,2**32-1,0),p('d','int16',8,-100,100,0)];
 const {bytes,patched}=patchFlash(flash,params,{a:7,b:0x1234,c:0x01020304,d:-2});
 assert.deepEqual([...bytes.slice(0,10)],[7,0,0x34,0x12,4,3,2,1,0xfe,0xff]);
 assert.equal(flash[0],0);
 assert.equal(patched.length,4);
 const def=patchFlash(flash,params,{});
 assert.deepEqual([...def.bytes.slice(2,4)],[0xf4,0x01]);
 assert.throws(()=>patchFlash(flash,params,{zz:1}),RangeError);
 assert.throws(()=>patchFlash(flash,params,{a:1.5}),RangeError);
 assert.throws(()=>patchFlash(flash,params,{a:256}),RangeError);
 assert.throws(()=>patchFlash(flash,params,{d:-101}),RangeError);
 assert.deepEqual([...decodeFlash(Buffer.from([1,2,3]).toString('base64'))],[1,2,3]);
});

test('toProgramWords and buildLineIndex',()=>{
 const w=toProgramWords(new Uint8Array([0x34,0x12,0x78,0x56]));
 assert.equal(w.length,FLASH_WORDS);
 assert.equal(w[0],0x1234);assert.equal(w[1],0x5678);assert.equal(w[2],0);
 const idx=buildLineIndex([[2,4,10],[5,5,11]]);
 assert.equal(idx.length,FLASH_WORDS);
 assert.deepEqual([...idx.slice(0,7)],[0,0,10,10,10,11,0]);
});

const BLINK_ASM=`
 sbi 0x04, 0
loop:
 sbi 0x05, 0
 rcall wait
 cbi 0x05, 0
 rcall wait
 rjmp loop
wait:
 ldi r18, 100
w1:
 ldi r19, 255
w2:
 dec r19
 brne w2
 dec r18
 brne w1
 ret
`;

test('asm blink toggles D8 with ~0.5 duty',()=>{
 const r=createLabRunner();
 r.load(variantFromAsm(BLINK_ASM,[[1,2,5]]),{},CIRCUITS.blink,'test');
 assert.equal(r.snapshot().status,'stopped');
 r.start();
 let high=0,low=0,last=-1,flips=0;
 for(let i=0;i<200;i++){
  const s=r.advance(5);
  const lv=s.pins.D8.level;
  if(lv===1)high++;else low++;
  if(last!==-1&&lv!==last)flips++;
  last=lv;
 }
 assert.ok(flips>=4,`flips ${flips}`);
 assert.ok(Math.abs(high/(high+low)-0.5)<0.15);
 const s=r.snapshot();
 assert.equal(s.pins.D8.mode,'output');
 assert.ok(s.pins.D8.duty>0.35&&s.pins.D8.duty<0.65||s.pins.D8.duty===0||s.pins.D8.duty===1);
 assert.equal(r.advance(1000).currentLine,5);
 const led=r.snapshot().parts.led1;
 assert.equal(led.kind,'led');
 r.dispose();
});

test('PinMonitor duty over a long window and frequency',()=>{
 const m=new PinMonitor();
 for(let c=0;c<1_600_000;c+=3200){m.record('D8',1,c);m.record('D8',0,c+1600);}
 const s=m.sample('D8',0,1_600_000);
 assert.ok(Math.abs(s.duty-0.5)<0.001);
 assert.ok(Math.abs(s.freqHz-5000)<1);
 assert.ok(Math.abs(s.highUs-100)<0.01);
 const idle=m.sample('D8',1_600_000,1_600_000);
 assert.equal(idle.duty,s.duty);
});

test('timer0 fast PWM gives D6 duty 0.25',()=>{
 const asm=`
 sbi 0x0a, 6
 ldi r16, 63
 sts 0x47, r16
 ldi r16, 0x83
 sts 0x44, r16
 ldi r16, 3
 sts 0x45, r16
spin:
 rjmp spin
 `;
 const r=createLabRunner();
 r.load(variantFromAsm(asm),{},{parts:[],wires:[]},'test');
 r.start();
 r.advance(5);
 const s=r.advance(20);
 assert.ok(Math.abs(s.pins.D6.duty-0.25)<0.02,`duty ${s.pins.D6.duty}`);
 assert.ok(s.pins.D6.freqHz>900&&s.pins.D6.freqHz<1100,`freq ${s.pins.D6.freqHz}`);
});

test('USART bytes reach serialText and onSerial',()=>{
 const asm=`
 ldi r16, 8
 sts 0xc1, r16
 ldi r16, 79
 sts 0xc6, r16
 rcall wait
 ldi r16, 75
 sts 0xc6, r16
 rcall wait
spin:
 rjmp spin
wait:
 ldi r18, 255
w1:
 ldi r19, 255
w2:
 dec r19
 brne w2
 dec r18
 brne w1
 ret
 `;
 const r=createLabRunner();
 const chunks:string[]=[];
 r.onSerial(c=>chunks.push(c));
 r.load(variantFromAsm(asm),{},{parts:[],wires:[]},'test');
 r.start();
 const s=r.advance(100);
 assert.equal(r.serialText(),'OK');
 assert.equal(chunks.join(''),'OK');
 assert.equal(s.txActive,false);
});

// ---- peripheral models with a fake pin feed ----
function fakeEnv(){
 const pins:Partial<Record<UnoPin,boolean>>={};
 const adc:number[]=[];
 const queue:{at:number;cb:()=>void}[]=[];
 let now=0;
 const events:{pin:UnoPin;level:boolean;at:number}[]=[];
 const env:Env={
  setPin:(pin,level)=>{pins[pin]=level;events.push({pin,level,at:now});},
  setAdc:(ch,v)=>{adc[ch]=v;},
  schedule:(c,cb)=>{queue.push({at:now+Math.max(1,c),cb});queue.sort((a,b)=>a.at-b.at);},
  now:()=>now,
 };
 const advanceTo=(t:number)=>{while(queue.length&&queue[0].at<=t){const e=queue.shift()!;now=e.at;e.cb();}now=t;};
 return {env,pins,adc,events,advanceTo,setNow:(n:number)=>{now=n;},getNow:()=>now};
}
function frame(over:Partial<Record<UnoPin,Partial<PinSample>>>,dtSec=0.01,cycles=0){
 const samples=EMPTY();
 for(const k of Object.keys(over) as UnoPin[])samples[k]={...samples[k],...over[k]};
 return {samples,dtSec,cycles};
}
const out=(duty:number,extra:Partial<PinSample>={}):Partial<PinSample>=>({mode:'output',duty,level:duty>0?1:0,...extra});
const model=(ms:Map<string,PartModel>,id:string)=>ms.get(id)!;

test('LED formulas',()=>{
 const f=fakeEnv();
 const ms=createModels(CIRCUITS.blink,f.env);
 model(ms,'led1').update(frame({D8:out(1)}));
 const s=model(ms,'led1').state();
 assert.equal(s.kind,'led');
 if(s.kind==='led'){assert.equal(s.currentMa,13.6);assert.equal(s.on,true);assert.equal(s.overCurrent,false);assert.ok(s.brightness>0.9);}
 model(ms,'r1').props.ohms=47;
 model(ms,'led1').update(frame({D8:out(1)}));
 const s2=model(ms,'led1').state();
 if(s2.kind==='led')assert.equal(s2.overCurrent,true);
 model(ms,'led1').update(frame({D8:out(0)}));
 const s3=model(ms,'led1').state();
 if(s3.kind==='led'){assert.equal(s3.on,false);assert.equal(s3.overCurrent,false);}
});

test('LDR adc at 40 cm on and off',()=>{
 const f=fakeEnv();
 const ms=createModels(CIRCUITS.light,f.env);
 const s=model(ms,'ldr1').state();
 assert.equal(s.kind,'ldr');
 if(s.kind==='ldr')assert.ok(Math.abs(s.adc-643)<=3,`on ${s.adc}`);
 assert.ok(Math.abs(f.adc[1]/5*1023-643)<=3);
 const a=model(ms,'ldr1').analog!();
 assert.equal(a?.pin,'A1');
 model(ms,'lamp1').setInput({kind:'lamp',on:false});
 model(ms,'ldr1').update(frame({}));
 const s2=model(ms,'ldr1').state();
 if(s2.kind==='ldr')assert.ok(Math.abs(s2.adc-83)<=3,`off ${s2.adc}`);
});

test('potentiometer and button drive the board',()=>{
 const f=fakeEnv();
 const ms=createModels(CIRCUITS.button,f.env);
 assert.equal(f.pins.D2,false);
 model(ms,'btn1').setInput({kind:'button',pressed:true});
 assert.equal(f.pins.D2,true);
 const f2=fakeEnv();
 const k=createModels(CIRCUITS.knob,f2.env);
 model(k,'pot1').setInput({kind:'potentiometer',value:5000});
 const s=model(k,'pot1').state();
 if(s.kind==='potentiometer')assert.equal(s.value,1023);
 assert.ok(Math.abs(f2.adc[0]-5)<1e-9);
});

test('hcsr04 echo width for 40 cm',()=>{
 const f=fakeEnv();
 const ms=createModels(CIRCUITS.distance,f.env);
 const us=model(ms,'us1');
 f.setNow(1000);us.onEdge!('D7',1,1000);
 f.setNow(1000+200);us.onEdge!('D7',0,1200);
 f.advanceTo(1200+4000);
 f.advanceTo(1200+4000+37120);
 const up=f.events.find(e=>e.pin==='D6'&&e.level);
 const down=f.events.find(e=>e.pin==='D6'&&!e.level);
 assert.ok(up&&down);
 assert.ok(Math.abs(down.at-up.at-37120)<=16);
 assert.equal(up.at,5200);
 const st=us.state();
 if(st.kind==='hcsr04')assert.equal(st.echoCm,40);
 // too short trigger is ignored
 const n=f.events.length;
 us.onEdge!('D7',1,60000);us.onEdge!('D7',0,60050);f.advanceTo(100000);
 assert.equal(f.events.length,n);
});

test('servo follows pulse width',()=>{
 const f=fakeEnv();
 const ms=createModels(CIRCUITS.servo,f.env);
 const sv=model(ms,'sv1');
 for(let i=0;i<100;i++)sv.update(frame({D9:{mode:'output',freqHz:50,highUs:1472,duty:0.07}},0.01));
 const s=sv.state();
 assert.equal(s.kind,'servo');
 if(s.kind==='servo'){assert.ok(Math.abs(s.angleDeg-90)<=1,`${s.angleDeg}`);assert.equal(s.pulseUs,1472);}
 sv.update(frame({D9:{mode:'output',freqHz:50,highUs:2400,duty:0.12}},0.01));
 const s2=sv.state();
 if(s2.kind==='servo')assert.ok(Math.abs(s2.angleDeg-94)<0.01); // rate limited: 400 deg/s * 10 ms = 4 deg
});

test('motor rpm rises and buzzer reads frequency',()=>{
 const f=fakeEnv();
 const ms=createModels({parts:[...CIRCUITS.motor.parts,...CIRCUITS.sound.parts],wires:[]} ,f.env);
 const m=model(ms,'m1');
 let prev=0;
 for(let i=0;i<20;i++){
  m.update(frame({D6:out(0.5)},0.05));
  const s=m.state();
  assert.equal(s.kind,'motor');
  if(s.kind==='motor'){assert.ok(s.rpm>prev);prev=s.rpm;}
 }
 assert.ok(prev>2500&&prev<=3000);
 model(ms,'bz1').update(frame({D5:out(0.5,{freqHz:440})}));
 const b=model(ms,'bz1').state();
 if(b.kind==='buzzer'){assert.equal(b.on,true);assert.equal(b.freqHz,440);}
});

test('passive parts and every PartSpec get state',()=>{
 const f=fakeEnv();
 const specs:PartSpec[]=CIRCUITS.parking.parts;
 const ms=createModels(CIRCUITS.parking,f.env);
 for(const s of specs)assert.ok(ms.get(s.id),s.id);
 assert.equal(model(ms,'rG').state().kind,'passive');
 assert.equal(UNO_PINS.length,20);
});

test('runner lifecycle and stored inputs',()=>{
 const r=createLabRunner();
 assert.equal(r.snapshot().status,'idle');
 r.start();
 assert.equal(r.snapshot().status,'idle');
 r.setInput('pot1',{kind:'potentiometer',value:900});
 const v=variantFromAsm(BLINK_ASM);
 r.load(v,{},CIRCUITS.knob,'tc');
 let snap=r.snapshot();
 assert.equal(snap.status,'stopped');
 const pot=snap.parts.pot1;
 assert.equal(pot.kind==='potentiometer'&&pot.value,900);
 assert.deepEqual(Object.keys(snap.parts).sort(),CIRCUITS.knob.parts.map(x=>x.id).sort());
 assert.equal(snap.pins.A0.analog,900);
 assert.equal(snap.currentLine,null);
 r.start();assert.equal(r.snapshot().status,'running');
 const t0=r.snapshot().simTimeMs;
 snap=r.tick(16);
 assert.ok(snap.simTimeMs>t0);
 r.stop();assert.equal(r.snapshot().status,'stopped');
 const t1=r.snapshot().simTimeMs;
 r.tick(16);assert.equal(r.snapshot().simTimeMs,t1);
 const bad={...v,params:[p('x','uint8',0,0,10,1)]};
 assert.throws(()=>r.load(bad,{x:99},CIRCUITS.knob,'tc'),RangeError);
 assert.equal(r.snapshot().status,'error');
 r.dispose();
 assert.equal(r.snapshot().status,'idle');
});
