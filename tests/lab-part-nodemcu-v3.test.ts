import test from 'node:test';
import assert from 'node:assert/strict';
import {deviceRegistry} from '../apps/web/src/lab/sim/devices/index.js';
import {NODE_PINS} from '../apps/web/src/lab/sim/devices/nodemcu-v3.js';

test('nodemcu-v3: model only, honest flag and 30 unique pins',()=>{
 const d=deviceRegistry.get('nodemcu-v3');
 assert.ok(d);assert.equal(d!.runtime,'not-emulated');
 assert.equal(NODE_PINS.length,30);assert.equal(new Set(d!.pins).size,30);
 assert.equal(NODE_PINS.find(p=>p.key==='D1')!.gpio,5);assert.equal(NODE_PINS.find(p=>p.key==='D2')!.gpio,4);
});
