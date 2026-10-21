import test from 'node:test';
import assert from 'node:assert/strict';
import {PART_PINS} from '../apps/web/src/lab/contract.js';
import {PIN_COLS} from '../apps/web/src/lab/scene/layout.js';
import {parseCircuitSpec,validateCircuitSpec,sketchPins,specToCircuit,stepsOf,CircuitSpecSchema,type CircuitSpec} from '../apps/web/src/lab/circuit-spec.js';
import {EXAMPLE_CLOSE_ALARM} from '../apps/web/src/lab/circuit-examples.js';
import {registry,partModule} from '../apps/web/src/lab/scene/parts/index.js';

const clone=():CircuitSpec=>structuredClone(EXAMPLE_CLOSE_ALARM);
const codes=(s:CircuitSpec):string[]=>validateCircuitSpec(CircuitSpecSchema.parse(s)).issues.filter(i=>i.severity==='error').map(i=>i.code);

test('registry is consistent with PART_PINS and PIN_COLS',()=>{
 assert.deepEqual([...registry.kinds()].sort(),Object.keys(PART_PINS).sort());
 for(const k of registry.kinds()){
  const m=partModule(k);
  if(k==='motor'){assert.deepEqual(Object.keys(m.pins),[...PART_PINS[k]]);continue;}
  assert.deepEqual(Object.keys(m.pins),[...PART_PINS[k]],`${k} pins`);
  assert.deepEqual([...m.footprint.holes],PIN_COLS[k]??[],`${k} holes`);
  assert.equal(m.footprint.onBoard,k in PIN_COLS);
  for(const c of m.callouts){assert.ok(c.text.en&&c.text.id);}
 }
});
test('example spec is valid and every part and wire appears once in the steps',()=>{
 const r=parseCircuitSpec(EXAMPLE_CLOSE_ALARM);
 assert.ok(r.ok,JSON.stringify(r.issues));
 assert.equal(stepsOf(EXAMPLE_CLOSE_ALARM).length,8);
});
test('unknown kind, unknown pin, shared hole',()=>{
 let s=clone();s.parts[2]!.kind='laser';assert.ok(codes(s).includes('unknown-kind'));
 s=clone();s.wires[0]!.from='us1.NOPE';assert.ok(codes(s).includes('unknown-pin'));
 s=clone();s.parts[4]!.place={breadboard:{col:8,row:2}};assert.ok(codes(s).includes('hole-conflict'));
});
test('LED without series resistor, and rail short',()=>{
 let s=clone();s.wires=s.wires.filter(w=>w.id!=='w-rgnd');
 assert.ok(codes(s).includes('led-no-resistor'));
 s=clone();s.wires.push({from:'5V',to:'GND',color:'red'});
 assert.ok(codes(s).includes('rail-short'));
 s=clone();s.wires.push({from:'D8',to:'GND',color:'red'});
 assert.ok(codes(s).includes('output-short'));
});
test('sketch pins must match the wiring',()=>{
 const s=clone();s.sketch.source=s.sketch.source.replace('const int LED = 8;','const int LED = 10;');
 const v=validateCircuitSpec(CircuitSpecSchema.parse(s));
 assert.ok(v.issues.some(i=>i.code==='sketch-pin-unwired'&&i.ref==='D10'));
 assert.ok(v.issues.some(i=>i.code==='wire-pin-unused'&&i.ref==='D8'));
 for(const i of v.issues){assert.ok(i.en&&i.id);}
});
test('sketchPins resolves constants, defines, numbers and analogRead',()=>{
 const p=sketchPins('#define LEDP 5\nvoid f(){pinMode(LEDP,OUTPUT);analogRead(A2);digitalRead(3);analogRead(1);/*digitalWrite(12,1)*/}');
 assert.deepEqual([...p.used].sort(),['A1','A2','D3','D5']);
 assert.deepEqual([...p.outputs],['D5']);
});
test('malformed input gives friendly schema issues',()=>{
 const r=parseCircuitSpec({board:'mega'});
 assert.equal(r.ok,false);assert.ok(r.issues[0]!.en&&r.issues[0]!.id);
});
test('specToCircuit ties pins through series resistors',()=>{
 const c=specToCircuit(CircuitSpecSchema.parse(EXAMPLE_CLOSE_ALARM));
 const led=c.parts.find(p=>p.id==='led1')!,r=c.parts.find(p=>p.id==='r1')!,us=c.parts.find(p=>p.id==='us1')!;
 assert.equal(led.net.A,'D8');assert.equal(led.net.C,'GND');
 assert.equal(r.props.seriesWith,'led1');assert.equal(us.net.ECHO,'D6');
});
