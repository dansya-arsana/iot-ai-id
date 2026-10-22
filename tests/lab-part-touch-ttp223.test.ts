import test from 'node:test';
import assert from 'node:assert/strict';
import {fakeBoard,modelOf,frame} from './lab-input-fake.js';

const NET={OUT:'D2',VCC:'5V',GND:'GND'} as const;
const MS=16000;
const SETTLE=500*MS;

/** Advance simulated time, polling the model like the runner does. */
function step(b:ReturnType<typeof fakeBoard>,m:ReturnType<typeof modelOf>,to:number):void{
 for(let t=(b.env as {now():number}).now();t<to;t+=MS){const n=Math.min(to,t+MS);b.run(n);m.update(frame(n));}
}

test('ttp223: idle LOW (active HIGH), pad touched after calibration answers 60 ms later',()=>{
 const b=fakeBoard();const m=modelOf(b,'touch-ttp223',NET);
 assert.equal(b.level.D2,false);
 step(b,m,SETTLE+10*MS);
 m.props.touched=true;m.update(frame(SETTLE+10*MS));   // the runner polls props every slice; poll now so the touch has an exact time
 const t0=SETTLE+10*MS;
 step(b,m,t0+59*MS);assert.equal(b.level.D2,false,'not yet at 59 ms');
 step(b,m,t0+62*MS);assert.equal(b.level.D2,true);
 assert.equal(b.edges('D2').at(-1)![0],t0+60*MS,'edge exactly 60 ms after the touch');
 m.props.touched=false;
 step(b,m,t0+62*MS+70*MS);assert.equal(b.level.D2,false,'released after 60 ms');
});

test('ttp223: low-power mode answers in 220 ms',()=>{
 const b=fakeBoard();const m=modelOf(b,'touch-ttp223',NET,{lowPower:true});
 step(b,m,SETTLE+MS);
 const t0=(b.env as {now():number}).now();
 m.props.touched=true;m.update(frame(t0));step(b,m,t0+219*MS);assert.equal(b.level.D2,false);
 step(b,m,t0+222*MS);assert.equal(b.edges('D2').at(-1)![0],t0+220*MS);
});

test('ttp223: a touch during the 0.5 s calibration is ignored until the finger lifts',()=>{
 const b=fakeBoard();const m=modelOf(b,'touch-ttp223',NET);
 m.props.touched=true;
 step(b,m,SETTLE+200*MS);assert.equal(b.level.D2,false);
 m.props.touched=false;step(b,m,SETTLE+300*MS);
 m.props.touched=true;step(b,m,SETTLE+300*MS+100*MS);assert.equal(b.level.D2,true,'a fresh touch works');
});

test('ttp223: toggle mode flips the output on every touch and keeps it after release',()=>{
 const b=fakeBoard();const m=modelOf(b,'touch-ttp223',NET,{toggleMode:true});
 step(b,m,SETTLE+MS);
 let t=(b.env as {now():number}).now();
 m.props.touched=true;step(b,m,t+100*MS);assert.equal(b.level.D2,true);
 m.props.touched=false;t+=100*MS;step(b,m,t+100*MS);assert.equal(b.level.D2,true,'stays latched');
 t+=100*MS;m.props.touched=true;step(b,m,t+100*MS);assert.equal(b.level.D2,false,'second touch flips back');
 const s=m.state();if(s.kind==='ext')assert.equal(s.v.presses,2);
});

test('ttp223: active LOW option (jumper B) inverts idle and active',()=>{
 const b=fakeBoard();const m=modelOf(b,'touch-ttp223',NET,{activeLow:true});
 assert.equal(b.level.D2,true,'idle HIGH');
 step(b,m,SETTLE+MS);
 m.props.touched=true;step(b,m,SETTLE+MS+100*MS);assert.equal(b.level.D2,false);
});

test('ttp223: a click (button input) is a momentary touch, and the 100 s limit drops the output',()=>{
 const b=fakeBoard();const m=modelOf(b,'touch-ttp223',NET);
 step(b,m,SETTLE+MS);
 const t0=(b.env as {now():number}).now();
 m.setInput({kind:'button',pressed:true});step(b,m,t0+100*MS);assert.equal(b.level.D2,true);
 // jump ahead in one-second slices
 for(let s=1;s<=101;s++)step(b,m,t0+100*MS+s*1000*MS);
 assert.equal(b.level.D2,false,'held beyond the max on-time: back to idle');
 m.setInput({kind:'button',pressed:false});step(b,m,t0+100*MS+102000*MS+100*MS);
 m.setInput({kind:'button',pressed:true});step(b,m,(b.env as {now():number}).now()+100*MS);assert.equal(b.level.D2,true,'works again after release');
});
