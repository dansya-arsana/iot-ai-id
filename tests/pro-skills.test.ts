import test from 'node:test';
import assert from 'node:assert/strict';
import {listSkills,skillIndex,loadSkill,SKILL_NAMES} from '../packages/pro-skills/index.js';

test('three skills load with name, version, summary and sha256',()=>{
 const all=listSkills();
 assert.deepEqual(all.map(s=>s.name),[...SKILL_NAMES]);
 for(const s of all){assert.match(s.sha256,/^[0-9a-f]{64}$/);assert.ok(s.version&&s.summary.length>20&&s.body.length>300&&s.body.length<60_000);}
 assert.equal(skillIndex().length,3);
 assert.equal(loadSkill('nope'),undefined);
});
test('lora skill keeps the founder decisions',()=>{
 const b=loadSkill('lora-as923-id')!.body;
 assert.match(b,/920 to 923/);assert.match(b,/RFM95W/);assert.match(b,/information only/);
 assert.doesNotMatch(b,/RA-?02/i);
});
