import test from 'node:test';
import assert from 'node:assert/strict';
import {createButtonLedContract} from '../packages/component-catalog/index.js';
import {buttonLedRecipe,resolveRecipe,recipeContractErrors} from '../packages/recipe-registry/index.js';
import {generateFirmware} from '../packages/hardware-contract/firmware.js';
import {validateContract} from '../packages/validator/index.js';
import {contractHash,verifyEvidence,type Evidence,type RunIdentity} from '../packages/evidence/index.js';
import {Engine} from '../services/api/engine.js';
import {Store} from '../services/api/store.js';
import {WokwiCliAdapter} from '../packages/simulator-client/index.js';

const plan={supported:true,recipe:'esp32-button-led' as const,title:'Tombol & LED',summary:'Tombol GPIO27, LED GPIO26.',sda:21,scl:22,sensorAddress:118,displayAddress:60,buttonPin:27,ledPin:26,steps:['Rakit assembly'],clarification:''};
const knowledge={retrieve:async()=>({status:'unavailable' as const,backend:'test',query:'',hits:[],error:'fixture'}),remember:async()=>({status:'unavailable' as const,backend:'test',error:'fixture'}),url:'test',request:async()=>({})};
function setup(){const store=new Store(':memory:');const agent={plan:async()=>({plan:structuredClone(plan),route:{fixture:true},provider:'fixture'}),revise:async()=>({plan:structuredClone(plan),route:{fixture:true},provider:'fixture'}),diagnose:async()=>({diagnosis:{category:'communication' as const,summary:'Periksa rangkaian.',checks:['Periksa kabel dengan daya mati.'],repair:'Rapikan sambungan lalu uji ulang.',retryAllowed:true},route:{fixture:true},provider:'fixture'})};return{store,engine:new Engine(store,agent,knowledge)};}

test('button-led contract validates, resolves its recipe and generates firmware', () => {
  const contract = createButtonLedContract('bl', 1);
  assert.equal(validateContract(contract).valid, true);
  assert.deepEqual(recipeContractErrors(contract), []);
  assert.equal(resolveRecipe(contract), buttonLedRecipe);
  const artifact = generateFirmware(contract, {experimentId: 'bl-run', nonce: 'bl-nonce'});
  assert.match(artifact.source, /pinMode\(inputPin, INPUT\)/);
  assert.match(artifact.source, /debounceMs = 30/);
  assert.match(artifact.source, /behavior_sequence/);
  assert.equal(artifact.filename, 'button_led.ino');
  assert.equal(validateContract(createButtonLedContract('bl2', 1), {execution: true}).valid, true);
});

test('button-led tampering: resistor, pull-up net, pin swap and missing sequence fail closed', () => {
  const base = createButtonLedContract('bl', 1);
  const mutate = (fn: (c: ReturnType<typeof createButtonLedContract>) => void) => {
    const contract = structuredClone(base); fn(contract);
    const validation = validateContract(contract, {execution: true});
    return {contract, validation};
  };
  const wrongLed = mutate(c => {c.components.find(x => x.manifest.id === 'led-series-330')!.manifest.assembly!.parts[1]!.value = '220Ω';});
  assert.equal(wrongLed.validation.valid, false);
  const droppedResistor = mutate(c => {delete (c.components.find(x => x.manifest.id === 'button-pullup-10k')!.manifest as {assembly?: unknown}).assembly;});
  assert.equal(droppedResistor.validation.valid, false);
  const swapped = mutate(c => {const input = c.connections.find(w => w.componentId === 'button-pullup-10k' && w.role === 'output')!; input.boardPin = '26';});
  assert.equal(swapped.validation.valid, false, 'validator rejects GPIO conflict between input and output');
  const missingChecks = mutate(c => {c.verification.checks = c.verification.checks.filter(check => check !== 'behavior_sequence');});
  assert.equal(missingChecks.validation.valid, false);
  const identity: RunIdentity = {experimentId: 'bl-run', nonce: 'bl-nonce', contractHash: contractHash(base), firmwareHash: 'a'.repeat(64)};
  const rows: Evidence[] = base.verification.checks.map(check => ({...identity, id: check, source: 'simulation', timestamp: new Date().toISOString(), check, passed: check !== 'behavior_sequence', artifactHash: 'b'.repeat(64), artifactId: check, data: check === 'behavior_sequence' ? {presses: 0, releases: 0, complete: false} : {simulated: true}}));
  const result = verifyEvidence(base, identity, rows);
  assert.equal(result.passed, false, 'incomplete press/release sequence cannot verify');
});

test('chat creates a button-led executable draft and simulated run verifies the scripted sequence', async () => {
  const {store, engine} = setup();
  const p = engine.create('Buat tombol LED: tekan tombol nyalakan indikator.');
  await engine.plan(p.id);
  const project = engine.project(p.id);
  const contract = project.contracts.find((c: any) => c.id === project.contractId)?.contract;
  assert.equal(contract.recipe.id, 'esp32-button-led');
  assert.equal(contract.components.map((c: any) => c.manifest.id).join(','), 'button-pullup-10k,led-series-330');
  assert.equal(project.status, 'ready');
  const verification = await engine.run(p.id, 'simulation');
  assert.equal(verification.status, 'SIMULATED_VERIFIED');
  const stored = engine.project(p.id);
  const observed = stored.observations.filter((o: any) => o.evidence.experimentId === verification.experimentId).map((o: any) => o.evidence.check);
  assert.deepEqual(observed.sort(), ['behavior_sequence', 'board_detected', 'button_input', 'compiled', 'flashed', 'output_commanded']);
  store.close();
});

test('injected wokwi runner executes the button-led pipeline with a faithful diagram and scenario', async () => {
  const {mkdir, writeFile, readFile} = await import('node:fs/promises');
  const {join} = await import('node:path');
  const seen: {diagram?: any; scenario?: string; toml?: string} = {};
  const healthy = (cycle: number) => [
    `{"marker":"iot_observation","experimentId":"wokwi-simulation","nonce":"wokwi-simulation","contractHash":"${contractHash(createButtonLedContract('bl-wokwi', 1))}","cycle":${cycle},"check":"button_input","passed":true,"data":{"pin":27,"raw":"released","stable":"pressed","presses":1,"releases":1}}`,
    `{"marker":"iot_observation","experimentId":"wokwi-simulation","nonce":"wokwi-simulation","contractHash":"${contractHash(createButtonLedContract('bl-wokwi', 1))}","cycle":${cycle},"check":"output_commanded","passed":true,"data":{"pin":26,"level":"HIGH","matchesInput":true}}`,
    `{"marker":"iot_observation","experimentId":"wokwi-simulation","nonce":"wokwi-simulation","contractHash":"${contractHash(createButtonLedContract('bl-wokwi', 1))}","cycle":${cycle},"check":"behavior_sequence","passed":true,"data":{"presses":1,"releases":1,"complete":true}}`,
  ].join('\n');
  const spawn = async (file: string, args: string[]) => {
    if (args[0] === '--version' || args[0] === 'version') return {code: 0, stdout: 'fixture', stderr: ''};
    if (file === 'arduino-cli') {
      const out = args[args.indexOf('--output-dir') + 1];
      await mkdir(out, {recursive: true});
      await writeFile(join(out, 'button_led.elf'), 'fake-elf');
      return {code: 0, stdout: '', stderr: ''};
    }
    const dir = args[0];
    seen.diagram = JSON.parse(await readFile(join(dir, 'diagram.json'), 'utf-8'));
    seen.scenario = await readFile(join(dir, 'button.yml'), 'utf-8');
    seen.toml = await readFile(join(dir, 'wokwi.toml'), 'utf-8');
    await writeFile(args[args.indexOf('--serial-log-file') + 1], healthy(1) + '\n' + healthy(2));
    return {code: 0, stdout: '', stderr: ''};
  };
  const adapter = new WokwiCliAdapter({token: 'wok_' + 'c'.repeat(40), testScenario: true, spawn});
  const contract = createButtonLedContract('bl-wokwi', 1);
  const artifact = generateFirmware(contract, {experimentId: 'wokwi-simulation', nonce: 'wokwi-simulation'});
  const caps = await adapter.capabilities(contract);
  assert.equal(caps.supported, true);
  const result = await adapter.run(contract, 'none', artifact);
  assert.equal(result.backend, 'wokwi-cli');
  for (const check of result.checks) assert.equal(check.passed, true, check.check);
  const partTypes = seen.diagram!.parts.map((part: any) => part.type);
  assert.deepEqual(partTypes.sort(), ['board-esp32-devkit-c-v4', 'wokwi-led', 'wokwi-pushbutton', 'wokwi-resistor', 'wokwi-resistor']);
  assert.ok(seen.diagram!.parts.some((part: any) => part.type === 'wokwi-resistor' && part.attrs.value === '10000'));
  assert.ok(seen.diagram!.parts.some((part: any) => part.type === 'wokwi-resistor' && part.attrs.value === '330'));
  assert.ok(seen.diagram!.connections.some((wire: any[]) => wire[0] === 'btn1:1.l' && wire[1] === 'esp:27'));
  assert.ok(seen.diagram!.connections.some((wire: any[]) => wire[0] === 'r2:2' && wire[1] === 'led1:A'));
  assert.ok(seen.scenario!.includes('set-control'));
  assert.ok(seen.scenario!.includes('wait-serial'));
  assert.ok(seen.toml!.includes('button_led.elf'));
});
