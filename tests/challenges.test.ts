import test from 'node:test';
import assert from 'node:assert/strict';
import {challenges,getChallenge,challengeReference,publicChallenges,ChallengeSchema} from '../packages/challenge-catalog/index.js';
import {ProjectMetadataSchema} from '../packages/episodes/index.js';

test('challenge catalog is deterministic, unique and schema-valid', () => {
  assert.ok(challenges.length >= 4);
  const keys = new Set(challenges.map(c => `${c.id}@${c.version}`));
  assert.equal(keys.size, challenges.length);
  for (const challenge of challenges) {
    assert.deepEqual(ChallengeSchema.parse(challenge), challenge);
    assert.ok(challenge.scenario.length >= 1);
    assert.ok(challenge.verification.checks.length >= 1);
  }
  const golden = challenges.filter(c => c.support === 'golden');
  assert.equal(golden.length, 2);
  assert.ok(golden.some(c => c.verification.checks.includes('sensor_readings')));
  assert.ok(golden.some(c => c.verification.checks.includes('behavior_sequence')));
  const drafts = challenges.filter(c => c.support === 'draft');
  assert.ok(drafts.length >= 2, 'draft challenges are honest previews without executable recipes');
  assert.ok(drafts.every(d => d.componentIds.some(id => !['bme280', 'ssd1306'].every(g => g === id))));
});

test('challenge references validate pairs and reject unknown ids', () => {
  assert.equal(challengeReference({}), undefined);
  assert.equal(challengeReference({challengeId: 'room-monitor', challengeVersion: 1})?.id, 'room-monitor');
  assert.throws(() => challengeReference({challengeId: 'room-monitor'}), /together/);
  assert.throws(() => challengeReference({challengeId: 'does-not-exist', challengeVersion: 1}), /Unknown challenge/);
  assert.throws(() => challengeReference({challengeId: 'room-monitor', challengeVersion: 7}), /Unknown challenge/);
  assert.equal(getChallenge('threshold-alert', 1).support, 'draft');
  const publicList = publicChallenges();
  assert.equal(publicList.length, challenges.length);
  assert.ok(publicList.every(c => c.scenario && c.verification));
});

test('learn entry requires an explicit challenge; any catalog id is accepted by metadata', () => {
  assert.deepEqual(ProjectMetadataSchema.parse({entryPoint: 'learn', challengeId: 'threshold-alert', challengeVersion: 1}).challengeId, 'threshold-alert');
  assert.throws(() => ProjectMetadataSchema.parse({entryPoint: 'learn'}), /explicit challenge/);
  assert.throws(() => ProjectMetadataSchema.parse({challengeId: 'room-monitor'}), /together/);
  assert.deepEqual(ProjectMetadataSchema.parse({}).entryPoint, 'build');
});

test('challenge scenarios are judged from evidence, not claims', async () => {
  const {judgeChallenge} = await import('../packages/challenge-catalog/index.js');
  const golden = getChallenge('room-monitor', 1);
  const draft = getChallenge('threshold-alert', 1);
  const checks = ['board_detected','compiled','flashed','device_addresses','sensor_readings','oled_initialized'];
  const experiment=(id:string,at:string,failed=false)=>({id,contractId:'c1',status:failed?'FAILED':'SIMULATED_VERIFIED',createdAt:at,mode:'simulation',fault:failed?'sda':'none',parentId:id==='e3'?'e2':null,identity:{nonce:id}});
  const obs=(experimentId:string,pass:boolean)=>checks.map(check=>({evidence:{experimentId,check,passed:pass,data:{addresses:pass?[60,118]:[]}}}));
  const none=judgeChallenge(golden,{contractId:'c1',experiments:[],observations:[]});
  assert.ok(none.every(v=>v.status==='pending'));
  const healthy=judgeChallenge(golden,{contractId:'c1',experiments:[experiment('e1','2026-10-06T08:00:00Z')],observations:obs('e1',true)});
  assert.deepEqual(healthy.map(v=>v.status),['pass','pass','pass','pending','pending']);
  const broken=judgeChallenge(golden,{contractId:'c1',experiments:[experiment('e1','2026-10-06T08:00:00Z'),experiment('e2','2026-10-06T08:01:00Z',true)],observations:[...obs('e1',true),...obs('e2',false)],verifications:[{experimentId:'e2',status:'FAILED',passed:false}]});
  assert.equal(broken.find(v=>v.name==='sda failure detected')?.status,'pass');
  assert.equal(broken.find(v=>v.name==='recovery')?.status,'pending');
  assert.equal(broken.find(v=>v.name==='bus present')?.status,'fail');
  const recoveredProject={contractId:'c1',experiments:[experiment('e1','2026-10-06T08:00:00Z'),experiment('e2','2026-10-06T08:01:00Z',true),experiment('e3','2026-10-06T08:02:00Z')],observations:[...obs('e1',true),...obs('e2',false),...obs('e3',true)],verifications:[{experimentId:'e2',status:'FAILED',passed:false},{experimentId:'e3',status:'SIMULATED_VERIFIED',passed:true}],events:[{type:'repair.confirmed',payload:{parentId:'e2',mode:'simulation'}}]};
  const recovered=judgeChallenge(golden,recoveredProject);
  assert.ok(recovered.every(v=>v.status==='pass'));
  for(const patch of [{parentId:null},{mode:'physical'},{identity:{nonce:'e2'}},{status:'ERROR'}]){const forged={...recoveredProject,experiments:recoveredProject.experiments.map(e=>e.id==='e3'?{...e,...patch}:e)};assert.equal(judgeChallenge(golden,forged).at(-1)?.status,'pending');}
  const randomFailure={...recoveredProject,experiments:recoveredProject.experiments.map(e=>e.id==='e2'?{...e,fault:'none'}:e)};assert.equal(judgeChallenge(golden,randomFailure)[3].status,'pending');
  const drafts=judgeChallenge(draft,{contractId:'c1',experiments:[experiment('e1','2026-10-06T08:00:00Z')],observations:obs('e1',true)});
  assert.ok(drafts.every(v=>v.status==='pending'&&/Draft/.test(v.evidence)));
});

test('project actor distinguishes agent trajectories from human runs', () => {
  assert.equal(ProjectMetadataSchema.parse({entryPoint:'build',actor:'agent',challengeId:'room-monitor',challengeVersion:1}).actor,'agent');
  assert.equal(ProjectMetadataSchema.parse({entryPoint:'build'}).actor,undefined);
  assert.throws(() => ProjectMetadataSchema.parse({actor:'robot'}));
});
