// The first twelve lessons must lay out exactly as they did before the module platform (golden taken from the committed layout.ts).
// One deliberate change: in the knob lesson the LED moved one column right, because the potentiometer's 14 mm base used to overlap it (tests/e2e/29-lab-layout.spec.ts guards every lesson against that).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CIRCUITS} from '../apps/web/src/lab/contract';
import {layoutCircuit} from '../apps/web/src/lab/scene/layout';
import '../apps/web/src/lab/sim/devices';

const golden=JSON.parse(readFileSync(new URL('./fixtures/lab-layout-golden.json',import.meta.url),'utf8')) as Record<string,unknown>;

for(const [id,want] of Object.entries(golden)){
 test(`lab layout regression: ${id}`,()=>{
  const got=JSON.parse(JSON.stringify(layoutCircuit(CIRCUITS[id as keyof typeof CIRCUITS])));
  assert.deepEqual(got,want);
 });
}
