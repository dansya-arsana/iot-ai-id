import test from 'node:test';
import assert from 'node:assert/strict';
import {fakeBoard,modelOf,frame} from './lab-input-fake.js';

const NET={VRx:'A0',VRy:'A1',SW:'D2','+5V':'5V',GND:'GND'} as const;

test('joystick: X axis is a divider on A0, Y axis goes to A1, centre is half supply',()=>{
 const b=fakeBoard();
 const m=modelOf(b,'joystick-ky023',NET);
 assert.ok(Math.abs(m.analog!()!.adc-512)<=1,'centre reads about 512 counts');
 assert.deepEqual(b.adc.filter(a=>a.ch===1).at(-1),{ch:1,volts:512/1023*5},'Y pushed on channel 1');
 m.props.x=1023;m.props.y=0;m.update(frame(0));
 assert.equal(m.analog!()!.pin,'A0');assert.equal(m.analog!()!.adc,1023);
 assert.deepEqual(b.adc.filter(a=>a.ch===1).at(-1),{ch:1,volts:0});
 const s=m.state();assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.equal(s.v.x,1023);assert.equal(s.v.y,0);assert.equal(s.v.vx,5);}
});

test('joystick: out-of-range input clamps to the 10-bit span',()=>{
 const b=fakeBoard();
 const m=modelOf(b,'joystick-ky023',NET);
 m.props.x=5000;m.update(frame(0));
 assert.equal(m.analog!()!.adc,1023);
});

test('joystick: SW is LOW while the stick is pressed (popover toggle or click), HIGH again on release',()=>{
 const b=fakeBoard();
 const m=modelOf(b,'joystick-ky023',NET);
 assert.deepEqual(b.edges('D2'),[[0,1]],'released at start (module pull-up)');
 m.setInput({kind:'button',pressed:true});
 assert.deepEqual(b.log.at(-1),{pin:'D2',level:false,at:0});
 m.setInput({kind:'button',pressed:false});
 assert.equal(b.level.D2,true);
 m.props.pressed=true;m.update(frame(0));
 assert.equal(b.level.D2,false);
 const n=b.log.length;m.update(frame(0));assert.equal(b.log.length,n,'no redrive without a change');
});

test('joystick: a Nano A6 wiper still reads (analogPin)',()=>{
 const b=fakeBoard();
 const m=modelOf(b,'joystick-ky023',{...NET,VRx:'A6'});
 assert.equal(m.analog!()!.pin,'A6');
});
