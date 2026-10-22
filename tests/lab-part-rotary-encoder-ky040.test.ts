import test from 'node:test';
import assert from 'node:assert/strict';
import {fakeBoard,modelOf,frame} from './lab-input-fake.js';

const NET={CLK:'D2',DT:'D3',SW:'D4','+':'5V',GND:'GND'} as const;
const T=40000;   // 2.5 ms of transitions in cycles

test('encoder: idle CLK and DT HIGH, SW HIGH (module pull-ups)',()=>{
 const b=fakeBoard();modelOf(b,'rotary-encoder-ky040',NET);
 assert.deepEqual([b.level.D2,b.level.D3,b.level.D4],[true,true,true]);
});

test('encoder: one clockwise detent is the Gray cycle CLK fall, DT fall, CLK rise, DT rise, 2.5 ms apart',()=>{
 const b=fakeBoard();const m=modelOf(b,'rotary-encoder-ky040',NET);
 b.log.length=0;
 m.props.position=1;m.update(frame(0));b.run(10*T);
 assert.deepEqual(b.edges('D2'),[[0,0],[2*T,1]]);
 assert.deepEqual(b.edges('D3'),[[T,0],[3*T,1]]);
 const s=m.state();assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.equal(s.v.position,1);assert.equal(s.v.angle,18);assert.equal(s.v.steps,1);assert.equal(s.v.moving,false);}
});

test('encoder: counter-clockwise swaps the lead (DT falls first), a DT edge with CLK differing means CCW',()=>{
 const b=fakeBoard();const m=modelOf(b,'rotary-encoder-ky040',NET,{position:5});
 b.log.length=0;
 m.props.position=4;m.update(frame(0));b.run(10*T);
 assert.deepEqual(b.edges('D3'),[[0,0],[2*T,1]]);
 assert.deepEqual(b.edges('D2'),[[T,0],[3*T,1]]);
 const s=m.state();if(s.kind==='ext')assert.equal(s.v.position,4);
});

test('encoder: three detents play one after another with a 5 ms gap, no overlap',()=>{
 const b=fakeBoard();const m=modelOf(b,'rotary-encoder-ky040',NET);
 b.log.length=0;
 m.props.position=3;m.update(frame(0));
 for(let t=0;t<=40*T;t+=T/4){b.run(t);m.update(frame(t));}
 const clkFalls=b.edges('D2').filter(e=>e[1]===0).map(e=>e[0]);
 assert.equal(clkFalls.length,3);
 // step n starts 3 transitions + 5 ms after the previous one started (the gap timer begins at the last edge)
 assert.equal(clkFalls[1]!-clkFalls[0]!,3*T+80000);
 assert.equal(clkFalls[2]!-clkFalls[1]!,3*T+80000);
 const s=m.state();if(s.kind==='ext')assert.equal(s.v.steps,3);
});

test('encoder: contact bounce adds a glitch to each edge and lands on the right level',()=>{
 const b=fakeBoard();const m=modelOf(b,'rotary-encoder-ky040',NET,{bounce:true});
 b.log.length=0;
 m.props.position=1;m.update(frame(0));b.run(10*T);
 const clk=b.edges('D2');
 assert.deepEqual(clk.slice(0,3),[[0,0],[640,1],[1440,0]]);   // 40 us and 90 us in cycles
 assert.equal(b.level.D2,true);assert.equal(b.level.D3,true);
});

test('encoder: SW LOW while pushed (popover or click)',()=>{
 const b=fakeBoard();const m=modelOf(b,'rotary-encoder-ky040',NET);
 m.setInput({kind:'button',pressed:true});assert.equal(b.level.D4,false);
 m.setInput({kind:'button',pressed:false});assert.equal(b.level.D4,true);
 m.props.pressed=true;m.update(frame(0));assert.equal(b.level.D4,false);
});
