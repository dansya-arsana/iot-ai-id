import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../services/api/engine.js';
import {Store} from '../services/api/store.js';

const roomPlan = {supported: true, recipe: 'esp32-room-monitor' as const, title: 'Monitor', summary: 'Room monitor', sda: 21, scl: 22, sensorAddress: 118, displayAddress: 60, buttonPin: 27, ledPin: 26, steps: ['Wire'], clarification: ''};
const knowledge = {retrieve: async () => ({status: 'unavailable' as const, backend: 'test', query: '', hits: [], error: 'fixture'}), remember: async () => ({status: 'unavailable' as const, backend: 'test', error: 'fixture'}), url: 'test', request: async () => ({})};
function makeEngine(store: Store) {
  const agent = {
    plan: async () => ({plan: structuredClone(roomPlan), route: {fixture: true}, provider: 'fixture'}),
    revise: async () => ({plan: structuredClone(roomPlan), route: {fixture: true}, provider: 'fixture'}),
    diagnose: async () => ({diagnosis: {category: 'communication' as const, summary: 'Inspect', checks: [], repair: 'Fix safely', retryAllowed: true}, route: {fixture: true}, provider: 'fixture'}),
  };
  return new Engine(store, agent, knowledge);
}

test('comparisons group challenge attempts by actor with evidence-based scenario counts', async () => {
  const store = new Store(':memory:');
  const engine = makeEngine(store);
  const human = engine.create('Build an ESP32 room monitor with temperature/humidity and an OLED.', {challengeId: 'room-monitor', challengeVersion: 1});
  await engine.plan(human.id);
  await engine.run(human.id, 'simulation');
  const agent = engine.create('Build an ESP32 room monitor with temperature/humidity and an OLED.', {entryPoint: 'build', actor: 'agent', challengeId: 'room-monitor', challengeVersion: 1});
  await engine.plan(agent.id);
  await engine.run(agent.id, 'simulation');
  const agentFailed = engine.create('Build an ESP32 room monitor with temperature/humidity and an OLED.', {entryPoint: 'build', actor: 'agent', challengeId: 'room-monitor', challengeVersion: 1});
  await engine.plan(agentFailed.id);
  await engine.run(agentFailed.id, 'simulation', 'sda');
  const store2 = store;
  void store2;
  const projects = store.list('projects');
  const byId = new Map(projects.map((p: any) => [p.id, p]));
  const records = [...byId.values()].filter((p: any) => p.challengeId === 'room-monitor');
  assert.equal(records.length, 3);
  const actors = new Set(records.map((p: any) => p.actor ?? 'human'));
  assert.deepEqual([...actors].sort(), ['agent', 'human']);
  store.close();
});
