import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../services/api/store.js';
import {Engine} from '../services/api/engine.js';
import {canonicalJson, hashText} from '../packages/evidence/index.js';
import {ProjectMetadataSchema, RightsRecordSchema} from '../packages/episodes/index.js';
import {challengeReference} from '../packages/challenge-catalog/index.js';

const agent = {
  plan: async () => ({plan: {supported: true, recipe: 'esp32-room-monitor' as const, buttonPin: 27, ledPin: 26, title: 'Room monitor', summary: 'Golden recipe', sda: 21, scl: 22,
    sensorAddress: 118, displayAddress: 60, steps: ['Wire with power off'], clarification: ''}, route: {}, provider: 'fixture'}),
  diagnose: async () => ({diagnosis: {category: 'communication' as const, summary: 'No ACK', checks: ['Inspect SDA with power off'],
    repair: 'Inspect and reconnect safely', retryAllowed: true}, route: {}, provider: 'fixture'}),
};
const remembered: string[] = [];
const knowledge = {
  retrieve: async () => ({status: 'unavailable' as const, backend: 'fixture', query: 'fixture', error: 'fixture unavailable', hits: []}),
  remember: async (name: string) => {remembered.push(name); return {status: 'unavailable' as const, backend: 'fixture', error: 'fixture unavailable'};},
  request: async () => ({}), url: 'fixture',
};
const rightsFixture = {purpose: 'research' as const, participant: 'adult' as const, participantConsent: true,
  schoolConsent: false, guardianConsent: false, reviewed: true, authorizationReference: 'fixture-private-reference', withdrawn: false};

test('episode records persist, stay immutable and cannot become physical evidence', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'episodes-'));
  const file = join(dir, 'db.sqlite');
  let store = new Store(file);
  const engine = new Engine(store, agent, knowledge);
  const project = engine.create('ESP32 BME280 OLED', {entryPoint: 'learn', challengeId: 'room-monitor', challengeVersion: 1});
  await engine.plan(project.id);
  const failed = await engine.run(project.id, 'simulation', 'sda');
  const action = engine.recordAction(project.id, {actionType: 'performed_repair', description: 'Reconnected SDA', experimentId: failed.experimentId});
  const environment = engine.recordEnvironment(project.id, {quantity: 'temperature', value: 30.8, unit: 'C', method: 'Human report', experimentId: failed.experimentId});
  const rights = engine.recordRights(project.id, {...rightsFixture, participant: 'unknown', participantConsent: false, reviewed: false, authorizationReference: ''});
  const count = remembered.length;
  engine.recordAction(project.id, {actionType: 'note', description: 'Local only'});
  assert.equal(remembered.length, count);
  const recovery = await engine.run(project.id, 'simulation', 'none', undefined, failed.experimentId);
  assert.equal(recovery.physical, false);
  assert.equal(store.list('observations', project.id).length, 12);
  for (const [table, record] of [['human_actions', action], ['environment_records', environment], ['rights_records', rights]] as const) {
    assert.throws(() => store.update(table, record), /Immutable/);
  }
  const episode = engine.episode(project.id);
  assert.equal(episode.task.entryPoint, 'learn');
  assert.equal(episode.experiments[0].status, 'FAILED');
  assert.equal(episode.experiments[1].parentId, failed.experimentId);
  assert.equal(episode.environmentRecords[0].provenance, 'human_reported');
  assert.deepEqual(episode.trajectory.map((e: any) => e.seq), episode.trajectory.map((e: any) => e.seq).sort((a: number, b: number) => a - b));
  store.close();
  store = new Store(file);
  const restored = new Engine(store, agent, knowledge).project(project.id);
  assert.equal(restored.humanActions.length, 2);
  assert.equal(restored.environmentRecords.length, 1);
  assert.equal(restored.rightsRecords.length, 1);
  store.close();
  rmSync(dir, {recursive: true});
});

test('references, metadata and measurement inputs fail closed', async () => {
  const store = new Store(':memory:');
  const engine = new Engine(store, agent, knowledge);
  const first = engine.create('ESP32 BME280 OLED');
  const second = engine.create('ESP32 BME280 OLED');
  await engine.plan(first.id);
  const verification = await engine.run(first.id, 'simulation');
  assert.equal(engine.project(first.id).entryPoint, 'build');
  assert.throws(() => engine.recordAction(second.id, {actionType: 'note', description: 'Wrong project', experimentId: verification.experimentId}), /belong/);
  assert.throws(() => engine.recordEnvironment(second.id, {quantity: 'humidity', value: 80, unit: '%', method: 'Report', contractId: engine.project(first.id).contractId}), /belong/);
  assert.throws(() => engine.recordEnvironment(second.id, {quantity: 'humidity', value: Infinity, unit: '%', method: 'Report'}));
  assert.throws(() => ProjectMetadataSchema.parse({entryPoint: 'learn'}));
  assert.throws(() => ProjectMetadataSchema.parse({challengeId: 'room-monitor'}));
  assert.throws(() => challengeReference({challengeId: 'room-monitor', challengeVersion: 2}));
  assert.throws(() => RightsRecordSchema.parse({...rightsFixture, authorizationReference: ''}));
  assert.throws(() => engine.recordAction(first.id, {actionType: 'note', description: 'Report', name: 'Personal name'} as any));
  store.close();
});

test('research eligibility is purpose specific, reviewed and reversible by withdrawal', () => {
  const store = new Store(':memory:');
  const engine = new Engine(store, agent, knowledge);
  const p = engine.create('ESP32 BME280 OLED');
  assert.doesNotThrow(() => engine.episode(p.id));
  assert.throws(() => engine.episode(p.id, 'research'), /authorization/);
  engine.recordRights(p.id, {...rightsFixture, participant: 'unknown'});
  assert.throws(() => engine.episode(p.id, 'research'), /unknown/);
  engine.recordRights(p.id, {...rightsFixture, reviewed: false});
  assert.throws(() => engine.episode(p.id, 'research'), /review/);
  engine.recordRights(p.id, {...rightsFixture, participant: 'minor'});
  assert.throws(() => engine.episode(p.id, 'research'), /guardian/);
  engine.recordRights(p.id, {...rightsFixture, participant: 'minor', schoolConsent: true, guardianConsent: true});
  assert.equal(engine.episode(p.id, 'research').rights.eligibility.eligible, true);
  assert.throws(() => engine.episode(p.id, 'model_improvement'), /authorization/);
  engine.recordRights(p.id, {...rightsFixture, withdrawn: true});
  assert.throws(() => engine.episode(p.id, 'research'), /withdrawn/);
  assert.equal(engine.episode(p.id).rights.records.length, 5);
  store.close();
});

test('curated export excludes private envelopes and distinguishes original/export hashes', async () => {
  const store = new Store(':memory:');
  const engine = new Engine(store, agent, knowledge);
  const p = engine.create('ESP32 BME280 OLED token=private-goal-secret');
  await engine.plan(p.id);
  await engine.run(p.id, 'simulation');
  engine.recordAction(p.id, {actionType: 'note', description: 'Bearer sk-private-action-secret /dev/cu.private contact@example.com'});
  store.event(p.id, 'unexpected.raw', {token: 'private-event-secret', port: '/dev/cu.private'});
  store.insert('knowledge_receipts', p.id, {id: 'private-knowledge', context: 'private-knowledge-secret'});
  const experiment = store.list('experiments', p.id)[0];
  store.update('experiments', {...experiment, runtime: {rawSerial: ['private-serial-secret'], port: '/dev/cu.private'}, error: 'private-error-secret'});
  engine.recordRights(p.id, rightsFixture);
  const exported = engine.episode(p.id, 'research');
  const serialized = JSON.stringify(exported);
  for (const secret of ['private-goal-secret', 'private-action-secret', 'contact@example.com', '/dev/cu.private', 'fixture-private-reference', 'private-event-secret', 'private-knowledge-secret', 'private-serial-secret', 'private-error-secret']) assert.equal(serialized.includes(secret), false, secret);
  assert.equal(exported.contracts[0].contentRedacted, true);
  assert.notEqual(exported.contracts[0].originalHash, exported.contracts[0].exportedHash);
  assert.equal(exported.contracts[0].exportedHash, hashText(canonicalJson(exported.contracts[0].contract)));
  assert.equal(exported.firmwareArtifacts[0].originalHash, exported.firmwareArtifacts[0].exportedHash);
  assert.equal(exported.observations[0].artifactBodyOmitted, true);
  const {integrity, ...body} = exported;
  assert.equal(integrity.exportedPayloadHash, hashText(canonicalJson(body)));
  assert.match(exported.rights.eligibility.source, /not independently verified/);
  store.close();
});

test('demonstration records retain fixture provenance and refuse research reuse', () => {
  const store = new Store(':memory:');
  const engine = new Engine(store, agent, knowledge);
  const p = engine.create('ESP32 BME280 OLED');
  engine.recordAction(p.id, {actionType: 'note', description: 'UI demonstration', provenance: 'test_fixture'});
  engine.recordEnvironment(p.id, {quantity: 'temperature', value: 30.8, unit: 'C', method: 'UI test fixture, not a measurement', provenance: 'test_fixture'});
  engine.recordRights(p.id, rightsFixture);
  const local = engine.episode(p.id);
  assert.equal(local.humanActions[0].provenance, 'test_fixture');
  assert.equal(local.environmentRecords[0].provenance, 'test_fixture');
  assert.equal(local.trajectory.find((e: any) => e.type === 'human.action').actorType, 'test');
  assert.equal(local.rights.eligibilityByPurpose.research.eligible, false);
  assert.throws(() => engine.episode(p.id, 'research'), /fixture/);
  store.close();
});

test('content review binds its purpose to a snapshot and becomes stale after new content', async () => {
  const store = new Store(':memory:');
  const engine = new Engine(store, agent, knowledge);
  const p = engine.create('ESP32 BME280 OLED');
  const first = engine.recordRights(p.id, rightsFixture);
  assert.match(first.reviewedContentHash!, /^[a-f0-9]{64}$/);
  engine.recordRights(p.id, {...rightsFixture, purpose: 'model_improvement'});
  assert.equal(engine.episode(p.id, 'research').rights.eligibility.eligible, true);
  assert.equal(engine.episode(p.id, 'model_improvement').rights.eligibility.eligible, true);
  engine.change(p.id, {updatedAt: 'volatile change'});
  store.insert('knowledge_receipts', p.id, {id: 'excluded-knowledge', context: 'Not portable'});
  assert.doesNotThrow(() => engine.episode(p.id, 'research'));
  engine.recordAction(p.id, {actionType: 'note', description: 'New content after review'});
  assert.throws(() => engine.episode(p.id, 'research'), /Episode changed since content review/);
  assert.throws(() => engine.episode(p.id, 'model_improvement'), /Episode changed since content review/);
  engine.recordRights(p.id, rightsFixture);
  assert.doesNotThrow(() => engine.episode(p.id, 'research'));
  assert.throws(() => engine.episode(p.id, 'model_improvement'), /Episode changed since content review/);
  await engine.plan(p.id);
  engine.recordRights(p.id, rightsFixture);
  await engine.run(p.id, 'simulation');
  assert.throws(() => engine.episode(p.id, 'research'), /Episode changed since content review/);
  engine.recordRights(p.id, rightsFixture);
  engine.recordRights(p.id, {...rightsFixture, purpose: 'model_improvement'});
  const reviewed = engine.episode(p.id, 'research');
  assert.equal(reviewed.rights.records.at(-2).reviewedContentHash, reviewed.rights.currentContentHash);
  assert.doesNotThrow(() => engine.episode(p.id, 'model_improvement'));
  engine.recordRights(p.id, {...rightsFixture, withdrawn: true});
  assert.throws(() => engine.episode(p.id, 'research'), /withdrawn/);
  assert.doesNotThrow(() => engine.episode(p.id, 'model_improvement'));
  assert.throws(() => RightsRecordSchema.parse({...rightsFixture, reviewedContentHash: 'forged'}));
  store.close();
});

test('observation export permits typed scalars only and filters private malformed values', async () => {
  const store = new Store(':memory:');
  const engine = new Engine(store, agent, knowledge);
  const p = engine.create('ESP32 BME280 OLED');
  await engine.plan(p.id);
  await engine.run(p.id, 'simulation');
  const observations = store.list('observations', p.id);
  const sensor = observations.find(r => r.evidence.check === 'sensor_readings');
  const privateText = '/dev/cu.private contact@example.com token=private-token wok_private-credential';
  const malformed = {...sensor, evidence: {...sensor.evidence, data: {
    temperature: privateText, humidity: {nested: privateText}, success: privateText,
    initialized: 1, addressAck: privateText, simulated: true,
    addresses: [118, 60, -1, 128, 1.5, privateText, null],
    boardId: privateText, cycle: '7',
  }}};
  store.db.prepare('UPDATE observations SET payload=? WHERE id=?').run(JSON.stringify(malformed), sensor.id);
  const exported = engine.episode(p.id);
  const data = exported.observations.find((r: any) => r.id === sensor.id).evidence.data;
  assert.deepEqual(data.addresses, [118, 60]);
  assert.equal(data.simulated, true);
  for (const field of ['temperature', 'humidity', 'success', 'initialized', 'addressAck', 'cycle']) assert.equal(field in data, false);
  for (const secret of ['/dev/cu.private', 'contact@example.com', 'private-token', 'wok_private-credential']) assert.equal(JSON.stringify(exported).includes(secret), false);
  assert.equal(exported.observations.find((r: any) => r.id === sensor.id).originalArtifactHash, sensor.artifact.hash);
  store.db.prepare('UPDATE observations SET payload=? WHERE id=?').run(JSON.stringify({...sensor, evidence: {...sensor.evidence, data: {temperature: 27.4, humidity: null, cycle: 7}}}), sensor.id);
  const typed = engine.episode(p.id).observations.find((r: any) => r.id === sensor.id).evidence.data;
  assert.deepEqual(typed, {temperature: 27.4, humidity: null, cycle: 7});
  store.close();
});
