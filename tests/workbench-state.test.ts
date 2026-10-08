import {test} from 'node:test';
import assert from 'node:assert/strict';
import {currentRun} from '../apps/web/src/workbench-state.js';

test('new unfinished run does not inherit verification, readings or repair from a completed run', () => {
  const project = {experiments:[{id:'old'},{id:'new'}], verifications:[{experimentId:'old',passed:true}], observations:[{evidence:{experimentId:'old',data:{temperature:25}}}], repairs:[{experimentId:'old'}]};
  assert.deepEqual(currentRun(project), {experiment:{id:'new'},verification:undefined,observations:[],repair:undefined});
});
test('results follow newest experiment even when storage order differs', () => {
  const observation = {evidence:{experimentId:'new'}};
  const verification = {experimentId:'new',passed:false};
  const repair = {experimentId:'new'};
  const result = currentRun({experiments:[{id:'new'}],verifications:[verification,{experimentId:'old',passed:true}],observations:[observation,{evidence:{experimentId:'old'}}],repairs:[repair,{experimentId:'old'}]});
  assert.equal(result.verification, verification);
  assert.deepEqual(result.observations, [observation]);
  assert.equal(result.repair, repair);
});
