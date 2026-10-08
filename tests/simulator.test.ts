import test from 'node:test';
import assert from 'node:assert/strict';
import {TemplateSimulationAdapter, WokwiCliAdapter, type SimulationAdapter} from '../packages/simulator-client/index.js';
import {createGoldenContract} from '../packages/component-catalog/index.js';
import {generateFirmware} from '../packages/hardware-contract/firmware.js';
import {judgeSerial} from '../packages/simulator-client/index.js';
import {Engine} from '../services/api/engine.js';
import {Store} from '../services/api/store.js';

test('template model explicitly reports no firmware execution and simulated failure', async () => {
  const adapter = new TemplateSimulationAdapter();
  assert.equal((await adapter.capabilities()).executesFirmware, false);
  const result = await adapter.run(createGoldenContract(), 'sda');
  assert.equal(result.source, 'simulation');
  assert.equal(result.backend, 'template-model');
  assert.equal(result.checks.find(c => c.check === 'sensor_readings')?.passed, false);
});

test('unavailable Wokwi never runs or silently falls back', async () => {
  const adapter = new WokwiCliAdapter();
  assert.equal((await adapter.capabilities()).available, false);
  assert.equal((await adapter.capabilities()).supported, false);
  await assert.rejects(adapter.run(createGoldenContract(), 'none'), /refused/);
  const store = new Store(':memory:');
  const engine = new Engine(store);
  const p = engine.create('ESP32 BME280 OLED');
  const contract = createGoldenContract(p.id);
  store.insert('contracts', p.id, {id: 'fixture-contract', contract});
  engine.change(p.id, {status: 'ready', contractId: 'fixture-contract'});
  await assert.rejects(engine.run(p.id, 'simulation', 'none', undefined, undefined, 'wokwi-cli'), /Simulator unavailable/);
  assert.equal(store.list('experiments', p.id).length, 0);
  assert.equal(store.list('verifications', p.id).length, 0);
  assert.equal(engine.busy.size, 0);
  store.close();
});

test('injected adapter execution failure produces ERROR without verified evidence', async () => {
  const failing: SimulationAdapter = {
    capabilities: async () => ({backend: 'template-model', available: true, supported: true, executesFirmware: false, reason: 'fixture'}),
    run: async () => {throw new Error('Fixture execution failed');},
  };
  const store = new Store(':memory:');
  const engine = new Engine(store, undefined, undefined, undefined, failing);
  const p = engine.create('ESP32 BME280 OLED');
  const contract = createGoldenContract(p.id);
  store.insert('contracts', p.id, {id: 'fixture-contract', contract});
  engine.change(p.id, {status: 'ready', contractId: 'fixture-contract'});
  await assert.rejects(engine.run(p.id, 'simulation'), /Fixture execution failed/);
  assert.equal(store.list('experiments', p.id)[0].status, 'ERROR');
  assert.equal(store.list('verifications', p.id).length, 0);
  assert.equal(engine.busy.size, 0);
  store.close();
});

test('capability awaits cannot start two experiments on the same project', async () => {
  let releaseCapabilities!: () => void;
  let releaseRun!: () => void;
  const capabilityGate = new Promise<void>(resolve => {releaseCapabilities = resolve;});
  const runGate = new Promise<void>(resolve => {releaseRun = resolve;});
  const template = new TemplateSimulationAdapter();
  const adapter: SimulationAdapter = {
    capabilities: async () => {await capabilityGate; return template.capabilities();},
    run: async (contract, fault) => {await runGate; return template.run(contract, fault);},
  };
  const knowledge = {retrieve: async () => ({status: 'unavailable' as const, backend: 'fixture', query: 'fixture', hits: [], error: 'fixture'}),
    remember: async () => ({status: 'unavailable' as const, backend: 'fixture', error: 'fixture'}), request: async () => ({}), url: 'fixture'};
  const store = new Store(':memory:');
  const engine = new Engine(store, undefined, knowledge, undefined, adapter);
  const p = engine.create('ESP32 BME280 OLED');
  store.insert('contracts', p.id, {id: 'fixture-contract', contract: createGoldenContract(p.id)});
  engine.change(p.id, {status: 'ready', contractId: 'fixture-contract'});
  const first = engine.run(p.id, 'simulation');
  const second = engine.run(p.id, 'simulation');
  const rejected = assert.rejects(second, /already running/);
  releaseCapabilities();
  await rejected;
  assert.equal(store.list('experiments', p.id).length, 1);
  releaseRun();
  await first;
  assert.equal(engine.busy.size, 0);
  store.close();
});

test('adapter output backend cannot impersonate the requested simulator', async () => {
  const template = new TemplateSimulationAdapter();
  const adapter: SimulationAdapter = {
    capabilities: () => template.capabilities(),
    run: async (contract, fault) => ({...await template.run(contract, fault), backend: 'wokwi-cli'}),
  };
  const store = new Store(':memory:');
  const engine = new Engine(store, undefined, undefined, undefined, adapter);
  const p = engine.create('ESP32 BME280 OLED');
  store.insert('contracts', p.id, {id: 'fixture-contract', contract: createGoldenContract(p.id)});
  engine.change(p.id, {status: 'ready', contractId: 'fixture-contract'});
  await assert.rejects(engine.run(p.id, 'simulation'), /provenance mismatch/);
  assert.equal(store.list('observations', p.id).length, 0);
  assert.equal(store.list('verifications', p.id).length, 0);
  store.close();
});

test('injected Wokwi test scenario exercises pipeline and newest observed cycle', async () => {
  const {mkdir, writeFile, readFile} = await import('node:fs/promises');
  const {join} = await import('node:path');
  const seen: {sketch?: string; diagram?: any; scenario?: string; elf?: boolean} = {};
  const artifact=generateFirmware(createGoldenContract(),{experimentId:'exp-1',nonce:'n-1'});
  const bind=(log:string)=>log.split('\n').map(line=>JSON.stringify({...JSON.parse(line),experimentId:artifact.experimentId,nonce:artifact.nonce,contractHash:artifact.contractHash})).join('\n');
  const healthyLog = (cycle: number, id: string) => [
    `{"marker":"iot_observation","experimentId":"${id}","cycle":${cycle},"check":"device_addresses","passed":true,"data":{"addresses":[60,118]}}`,
    `{"marker":"iot_observation","experimentId":"${id}","cycle":${cycle},"check":"sensor_readings","passed":true,"data":{"temperature":24.5,"humidity":51.2}}`,
    `{"marker":"iot_observation","experimentId":"${id}","cycle":${cycle},"check":"oled_initialized","passed":true,"data":{"initialized":true,"addressAck":true}}`,
  ].join('\n');
  const brokenLog = (cycle: number) => [
    `{"marker":"iot_observation","cycle":${cycle},"check":"device_addresses","passed":false,"data":{"addresses":[]}}`,
    `{"marker":"iot_observation","cycle":${cycle},"check":"sensor_readings","passed":false,"data":{"temperature":null,"humidity":null}}`,
    `{"marker":"iot_observation","cycle":${cycle},"check":"oled_initialized","passed":false,"data":{"initialized":false,"addressAck":false}}`,
  ].join('\n');
  let mode: 'healthy' | 'broken' | 'nonzero' = 'healthy';
  const spawn = async (file: string, args: string[], _timeout: number) => {
    if (args[0] === '--version' || args[0] === 'version') return {code: 0, stdout: 'fixture', stderr: ''};
    if (file === 'arduino-cli') {
      const out = args[args.indexOf('--output-dir') + 1];
      await mkdir(out, {recursive: true});
      await writeFile(join(out, 'room_monitor.elf'), 'fake-elf');
      seen.sketch = await readFile(join(args.at(-1)!, 'room_monitor.ino'), 'utf-8');
      return {code: 0, stdout: '', stderr: ''};
    }
    const dir = args[0];
    seen.diagram = JSON.parse(await readFile(join(dir, 'diagram.json'), 'utf-8'));
    seen.scenario = await readFile(join(dir, 'golden.yml'), 'utf-8');
    seen.elf = (await readFile(join(dir, 'wokwi.toml'), 'utf-8')).includes('.elf');
    const logPath = args[args.indexOf('--serial-log-file') + 1];
    await writeFile(logPath, bind(mode !== 'broken' ? healthyLog(1, 'wokwi-simulation') + '\n' + healthyLog(2, 'wokwi-simulation') : brokenLog(1)));
    return {code: mode==='nonzero'?1:0, stdout: '', stderr: ''};
  };
  const adapter = new WokwiCliAdapter({testScenario:true, token: 'wok_' + 'a'.repeat(40), bin: 'wokwi-cli', arduinoCli: 'arduino-cli', spawn});
  const caps = await adapter.capabilities(createGoldenContract());
  assert.equal(caps.available, true);
  assert.equal(caps.supported, true);
  assert.equal(caps.executesFirmware, false);
  const result = await adapter.run(createGoldenContract(), 'none', artifact);
  assert.equal(result.backend, 'wokwi-cli');
  assert.equal(result.simulated, true);
  for (const check of result.checks) {assert.equal(check.passed, true, check.check); assert.equal(check.data.simulated, true, check.check); assert.equal((check.data as any).backend, 'wokwi-cli');}
  assert.equal((result.checks.find(c => c.check === 'sensor_readings')!.data as any).temperature, 24.5);
  assert.equal((result.checks.find(c => c.check === 'sensor_readings')!.data as any).cycle, 2);
  assert.deepEqual(seen.diagram.parts.map((p: any) => p.type), ['board-esp32-devkit-c-v4', 'wokwi-bme280', 'wokwi-ssd1306']);
  assert.ok(seen.diagram.connections.some((c: any[]) => c[0] === 'bme1:SDA' && c[1] === 'esp:21'));
  assert.ok(seen.scenario!.includes('wait-serial'));
  assert.ok(seen.elf);
  mode='nonzero';
  const nonzero=await adapter.run(createGoldenContract(),'none',artifact);
  assert.equal(nonzero.checks.find(c=>c.check==='flashed')?.passed,false);
  assert.equal(nonzero.checks.find(c=>c.check==='sensor_readings')?.passed,false);
  mode = 'broken';
  const failed = await adapter.run(createGoldenContract(), 'sda', artifact);
  const names = (name: string) => failed.checks.find(c => c.check === name)!.passed;
  assert.equal(names('device_addresses'), false);
  assert.equal(names('sensor_readings'), false);
  assert.equal(names('oled_initialized'), false);
  const withoutSda = await import('node:fs/promises').then(() => null, () => null);
  assert.equal(withoutSda, null);
});

test('wokwi adapter refuses missing token and non-golden recipes even when the CLI exists', async () => {
  const spawn = async () => ({code: 0, stdout: '', stderr: ''});
  const noToken = new WokwiCliAdapter({spawn});
  const caps = await noToken.capabilities(createGoldenContract());
  assert.equal(caps.available, false);
  assert.equal(caps.supported, false);
  assert.match(caps.reason, /WOKWI_CLI_TOKEN/);
  await assert.rejects(noToken.run(createGoldenContract(), 'none'), /WOKWI_CLI_TOKEN/);
  const ready = new WokwiCliAdapter({token: 'wok_' + 'b'.repeat(40), spawn});
  const golden = createGoldenContract('p', 1);
  golden.components.push({instanceId: 'led', manifest: {id: 'led', name: 'LED', voltage: [3.3, 3.3], logicVoltage: 3.3, currentMa: 4, protocol: 'digital', pins: [], addresses: [], libraries: [], quirks: [], sources: [], support: 'planning_only', reviewStatus: 'specification_only'} as any, address: 0});
  const nonGolden = await ready.capabilities(golden);
  assert.equal(nonGolden.available, true);
  assert.equal(nonGolden.supported, false);
  assert.match(nonGolden.reason, /tested scenario/);
  await assert.rejects(ready.run(golden as any, 'none'), /tested scenario|refused/);
});


test('serial judge rejects foreign identity, incomplete newest cycle and changed duplicate data',()=>{
 const artifact=generateFirmware(createGoldenContract(),{experimentId:'bound',nonce:'fresh'});
 const row=(cycle:number,check:string,data:Record<string,unknown>={},identity={experimentId:artifact.experimentId,nonce:artifact.nonce,contractHash:artifact.contractHash})=>JSON.stringify({marker:'iot_observation',cycle,check,passed:true,data,...identity});
 const complete=['device_addresses','sensor_readings','oled_initialized'].map(check=>row(1,check)).join('\n');
 assert.equal(judgeSerial(row(2,'device_addresses',{}, {experimentId:'foreign',nonce:artifact.nonce,contractHash:artifact.contractHash}),artifact),undefined);
 const incomplete=judgeSerial(complete+'\n'+row(2,'device_addresses'),artifact)!;
 assert.equal(incomplete.cycle,2);assert.equal(incomplete.rows.length,1);
 assert.equal(judgeSerial(complete+'\n'+row(1,'sensor_readings',{temperature:999}),artifact)!.rows.find(r=>r.check==='sensor_readings')!.conflict,true);
});

test('tooling and token do not enable unsupported live BME280 recipe',async()=>{
 const adapter=new WokwiCliAdapter({token:'wok_'+'a'.repeat(40),spawn:async()=>({code:0,stdout:'',stderr:''})});
 const caps=await adapter.capabilities(createGoldenContract());assert.equal(caps.available,true);assert.equal(caps.supported,false);assert.match(caps.reason,/refused|tested scenario/);
 await assert.rejects(adapter.run(createGoldenContract(),'none'),/refused|tested scenario/);
});
