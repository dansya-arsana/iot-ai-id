import test from 'node:test';
import assert from 'node:assert/strict';
import {angleToValue,cursorsFor,keyNudge,pointerAngle,relativeKnob,routeControl,snapCm,valueToAngle} from '../apps/web/src/lab/scene/drag.js';
import {registry} from '../apps/web/src/lab/scene/parts/index.js';

test('snapCm rounds to cm, 5 cm when coarse, and clamps to the range',()=>{
 assert.equal(snapCm(41.4,[3,250]),41);
 assert.equal(snapCm(41.4,[3,250],true),40);
 assert.equal(snapCm(-8,[3,250]),3);
 assert.equal(snapCm(999,[5,150]),150);
});
test('knob value and angle round-trip and clamp',()=>{
 assert.equal(angleToValue(-135),0);assert.equal(angleToValue(135),1023);assert.equal(angleToValue(0),512);
 assert.equal(angleToValue(500),1023);
 for(const v of [0,100,512,900,1023])assert.ok(Math.abs(angleToValue(valueToAngle(v))-v)<=1);
});
test('relativeKnob follows the pointer without jumping on pickup',()=>{
 assert.equal(relativeKnob(300,42,42),300);
 assert.ok(relativeKnob(300,42,60)>300);
 assert.ok(relativeKnob(300,42,20)<300);
 assert.equal(relativeKnob(1023,0,170),1023); // clamped at the stop
 assert.ok(Math.abs(pointerAngle(10,0,Math.PI/2)-90)<1e-9);
});
test('routeControl sends live values to sim inputs and the rest to props',()=>{
 assert.deepEqual(routeControl('obstacle','distanceCm',999).input,{kind:'obstacle',distanceCm:250});
 assert.deepEqual(routeControl('lamp','on',true).input,{kind:'lamp',on:true});
 assert.deepEqual(routeControl('obstacle','shape','car'),{props:{shape:'car'}});
 assert.deepEqual(routeControl('servo','load',40),{props:{load:40}});
});
test('keyNudge steps the drag prop within its range',()=>{
 const d=registry.get('obstacle')!.interact!.drag;
 assert.equal(keyNudge('ArrowRight',false,40,d),41);
 assert.equal(keyNudge('ArrowLeft',true,40,d),30);
 assert.equal(keyNudge('ArrowLeft',false,3,d),3);
 assert.equal(keyNudge('a',false,40,d),null);
 assert.equal(keyNudge('ArrowRight',false,0,registry.get('button')!.interact!.drag),null);
});
test('every declared drag handle has cursors; every control key routes',()=>{
 for(const k of registry.kinds()){
  const m=registry.get(k)!;
  if(m.interact?.drag)assert.ok(cursorsFor(m.interact.drag));
  for(const c of m.interact?.controls??[])if(c.type!=='action')assert.ok(routeControl(k,c.key,1));
 }
});
