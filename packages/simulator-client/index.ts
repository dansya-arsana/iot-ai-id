import type {HardwareContract, CheckName} from '../hardware-contract/index.js';
import type {FirmwareArtifact} from '../hardware-contract/firmware.js';
import {generateFirmware} from '../hardware-contract/firmware.js';
import {resolveRecipe} from '../recipe-registry/index.js';
import {canonicalJson, contractHash, hashText} from '../evidence/index.js';
import {mkdtemp, mkdir, writeFile, readdir, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';

export type SimulationBackend = 'template-model' | 'wokwi-cli';
export interface SimulatorCapabilities {
  backend: SimulationBackend;
  available: boolean;
  supported: boolean;
  executesFirmware: boolean;
  reason: string;
}
export interface SimulationOutput {
  source: 'simulation';
  backend: SimulationBackend;
  checks: {check: CheckName; passed: boolean; data: Record<string, unknown>}[];
  simulated: true;
}
export interface SimulationAdapter {
  capabilities(contract?: HardwareContract): Promise<SimulatorCapabilities>;
  run(contract: HardwareContract, fault: 'none' | 'sda', firmware?: FirmwareArtifact): Promise<SimulationOutput>;
}

/** Deterministic teaching model. It never compiles or executes firmware. */
export class TemplateSimulationAdapter implements SimulationAdapter {
  async capabilities(): Promise<SimulatorCapabilities> {
    return {backend: 'template-model', available: true, supported: true, executesFirmware: false,
      reason: 'Controlled golden-recipe software model; no compiler, simulator engine or board executed.'};
  }

  async run(contract: HardwareContract, fault: 'none' | 'sda'): Promise<SimulationOutput> {
    if (contract.recipe?.id === 'esp32-button-led') {
      if (fault !== 'none') throw new Error('No fault scenario is defined for the button-led recipe; faults are a manual physical action.');
      const inputPin = contract.connections.find(w => w.componentId === 'button-pullup-10k' && w.pin === 'SIGNAL')?.boardPin;
      const outputPin = contract.connections.find(w => w.componentId === 'led-series-330' && w.pin === 'SIGNAL')?.boardPin;
      return {source: 'simulation', backend: 'template-model', simulated: true, checks: [
        {check: 'board_detected', passed: true, data: {boardId: contract.board.id, simulated: true}},
        {check: 'compiled', passed: true, data: {success: true, simulated: true, message: 'Template compilation model; no compiler executed'}},
        {check: 'flashed', passed: true, data: {success: true, simulated: true, message: 'Template upload model; no board touched'}},
        {check: 'button_input', passed: true, data: {pin: inputPin, raw: 'released', stable: 'pressed', presses: 1, releases: 1, simulated: true, message: 'Scripted press/release; a real button press is a physical action'}},
        {check: 'output_commanded', passed: true, data: {pin: outputPin, level: 'HIGH', matchesInput: true, simulated: true}},
        {check: 'behavior_sequence', passed: true, data: {presses: 1, releases: 1, complete: true, simulated: true}},
      ]};
    }
    const healthy = fault === 'none';
    return {source: 'simulation', backend: 'template-model', simulated: true, checks: [
      {check: 'board_detected', passed: true, data: {boardId: contract.board.id, simulated: true}},
      {check: 'compiled', passed: true, data: {success: true, simulated: true, message: 'Template compilation model; no compiler executed'}},
      {check: 'flashed', passed: true, data: {success: true, simulated: true, message: 'Template upload model; no board touched'}},
      {check: 'device_addresses', passed: healthy, data: {addresses: healthy ? contract.expected.devices.map(d => d.address) : [], simulated: true}},
      {check: 'sensor_readings', passed: healthy, data: {temperature: healthy ? 27.4 : null, humidity: healthy ? 64.2 : null, simulated: true}},
      {check: 'oled_initialized', passed: healthy, data: {initialized: healthy, addressAck: healthy, simulated: true}},
    ]};
  }
}

interface SpawnResult {code: number; stdout: string; stderr: string}
/** Fixed-argv runner that reports non-zero exit codes instead of throwing, so scenario failures stay inspectable. */
function spawnResult(command: string, args: string[], timeoutMs: number, cwd?: string): Promise<SpawnResult> {
  return new Promise(resolve => {
    let out = '', err = '', settled = false;
    const child = spawn(command, args, {cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: false, detached: process.platform !== 'win32'});
    const stop = () => {try {if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL');} catch {/* already gone */}};
    const timer = setTimeout(() => {err += '\nWokwi CLI timed out'; stop();}, timeoutMs);
    child.stdout.on('data', chunk => {out += chunk; if (out.length > 1000000) stop();});
    child.stderr.on('data', chunk => {err = (err + chunk).slice(-8000);});
    child.on('error', error => {if (settled) return; settled = true; clearTimeout(timer); resolve({code: 127, stdout: out, stderr: String(error)});});
    child.on('close', code => {if (settled) return; settled = true; clearTimeout(timer); resolve({code: code ?? 1, stdout: out, stderr: err});});
  });
}

export interface WokwiCliDeps {
  /** Explicit injected test scenario; never enables a live unsupported chip. */
  testScenario?: boolean;
  bin?: string;
  token?: string;
  arduinoCli?: string;
  spawn?: (command: string, args: string[], timeoutMs: number, cwd?: string) => Promise<SpawnResult>;
}

function isSupportedRecipe(contract: HardwareContract) {
  const recipe = resolveRecipe(contract);
  return contract.board.id === 'esp32-devkit' && recipe !== undefined && contract.components.length === 2
    && recipe.componentIds.every(id => contract.components.some(c => c.manifest.id === id));
}

function buttonLedDiagram(contract: HardwareContract) {
  const pin = (componentId: string, name: string) => contract.connections.find(w => w.componentId === componentId && w.pin === name)?.boardPin ?? '?';
  return {version: 1, author: 'iot-ai-id', editor: 'wokwi',
    parts: [
      {type: 'board-esp32-devkit-c-v4', id: 'esp', top: 60, left: 20, attrs: {}},
      {type: 'wokwi-pushbutton', id: 'btn1', top: -140, left: 300, attrs: {}},
      {type: 'wokwi-resistor', id: 'r1', top: -140, left: 420, attrs: {value: '10000'}},
      {type: 'wokwi-led', id: 'led1', top: 180, left: 330, attrs: {color: 'red'}},
      {type: 'wokwi-resistor', id: 'r2', top: 180, left: 420, attrs: {value: '330'}},
    ],
    connections: [
      ['btn1:1.l', `esp:${pin('button-pullup-10k', 'SIGNAL')}`, '#1b7fd4', []],
      ['r1:1', 'esp:3V3', '#c37b23', []],
      ['r1:2', 'btn1:1.l', '#1b7fd4', []],
      ['btn1:2.l', 'esp:GND.1', '#000000', []],
      ['esp:' + pin('led-series-330', 'SIGNAL'), 'r2:1', '#25a35a', []],
      ['r2:2', 'led1:A', '#25a35a', []],
      ['led1:C', 'esp:GND.1', '#000000', []],
    ]};
}

const buttonScenarioYaml = `name: iot-ai-id button-led release-press-release
version: 1
author: iot-ai-id
steps:
  - delay: 2s
  - set-control:
      part-id: btn1
      control: pressed
      value: 1
  - delay: 800ms
  - set-control:
      part-id: btn1
      control: pressed
      value: 0
  - delay: 800ms
  - wait-serial: '"check":"behavior_sequence"'
  - wait-serial: '"complete":true'
`;

function diagramFor(contract: HardwareContract, fault: 'none' | 'sda') {
  if (contract.recipe?.id === 'esp32-button-led') return buttonLedDiagram(contract);
  const boardPin = (role: string) => String(contract.connections.find(w => w.role === role)?.boardPin ?? '?');
  const sda = boardPin('sda'), scl = boardPin('scl');
  const i2c = fault !== 'sda'
    ? [['bme1:SDA', `esp:${sda}`, '#1b7fd4', []], ['bme1:SCL', `esp:${scl}`, '#25a35a', []],
       ['oled1:DATA', `esp:${sda}`, '#1b7fd4', []], ['oled1:CLK', `esp:${scl}`, '#25a35a', []]]
    : [['bme1:SCL', `esp:${scl}`, '#25a35a', []], ['oled1:CLK', `esp:${scl}`, '#25a35a', []]];
  const displayAddress = contract.components.find(c => c.manifest.id === 'ssd1306')?.address ?? 0x3c;
  return {version: 1, author: 'iot-ai-id', editor: 'wokwi',
    parts: [
      {type: 'board-esp32-devkit-c-v4', id: 'esp', top: 60, left: 20, attrs: {}},
      {type: 'wokwi-bme280', id: 'bme1', top: -90, left: 340, attrs: {}},
      {type: 'wokwi-ssd1306', id: 'oled1', top: 170, left: 340, attrs: {i2cAddress: '0x' + displayAddress.toString(16)}},
    ],
    connections: [
      ['bme1:VIN', 'esp:3V3', '#c37b23', []],
      ['bme1:GND', 'esp:GND.1', '#000000', []],
      ['bme1:SDO', 'esp:GND.1', '#000000', []],
      ['oled1:VIN', 'esp:3V3', '#c37b23', []],
      ['oled1:GND', 'esp:GND.1', '#000000', []],
      ...i2c,
    ]};
}

const scenarioYaml = `name: iot-ai-id golden room monitor protocol
version: 1
author: iot-ai-id
steps:
  - delay: 3s
  - wait-serial: '"marker":"iot_observation"'
  - wait-serial: '"check":"oled_initialized"'
`;

/** Parses identity-bound serial telemetry; missing checks in the newest observed cycle fail. */
export function judgeSerial(serialLog: string, artifact: FirmwareArtifact) {
  const lines = new Map<number, {check: string; passed: boolean; data: Record<string, unknown>; conflict: boolean}[]>();
  for (const line of serialLog.split('\n')) {
    const start = line.indexOf('{'); if (start < 0) continue;
    try {
      const entry = JSON.parse(line.slice(start)) as {marker?: string; cycle?: number; check?: string; passed?: boolean; data?: Record<string, unknown>; experimentId?: string; nonce?: string; contractHash?: string};
      if (entry.marker !== 'iot_observation' || typeof entry.cycle !== 'number' || typeof entry.check !== 'string' || !Number.isSafeInteger(entry.cycle) || entry.cycle < 0) continue;
      if (entry.experimentId !== artifact.experimentId || entry.nonce !== artifact.nonce || entry.contractHash !== artifact.contractHash) continue;
      const bucket = lines.get(entry.cycle) ?? [];
      const prior = bucket.find(row => row.check === entry.check);
      if (prior) {if (prior.passed !== entry.passed || canonicalJson(prior.data) !== canonicalJson(entry.data ?? {})) prior.conflict = true;}
      else bucket.push({check: String(entry.check), passed: entry.passed === true, data: entry.data ?? {}, conflict: false});
      lines.set(entry.cycle, bucket);
    } catch {/* non-JSON serial noise is ignored */}
  }
  if (!lines.size) return undefined;
  const [cycle, rows] = [...lines.entries()].sort((a, b) => b[0] - a[0])[0];
  return {cycle, rows};
}

/** Real Wokwi CLI execution: compiles the identity-bound firmware with arduino-cli, generates diagram.json and an automation scenario from the Hardware Contract, runs the simulator, and judges serial telemetry. Unavailable pieces stay explicit; no fallback to model success. */
export class WokwiCliAdapter implements SimulationAdapter {
  private probe?: Promise<{cli: boolean; toolchain: boolean}>;
  constructor(private readonly deps: WokwiCliDeps = {}) {}
  private bin() {return this.deps.bin ?? process.env.WOKWI_CLI_BIN ?? 'wokwi-cli';}
  private arduinoCli() {return this.deps.arduinoCli ?? process.env.arduinoCli ?? 'arduino-cli';}
  private token() {return this.deps.token ?? process.env.WOKWI_CLI_TOKEN ?? '';}
  private runner() {return this.deps.spawn ?? spawnResult;}
  private environment() {
    this.probe ??= Promise.all([
      this.runner()(this.bin(), ['--version'], 10000).then(r => r.code === 0).catch(() => false),
      this.runner()(this.arduinoCli(), ['version'], 10000).then(r => r.code === 0).catch(() => false),
    ]).then(([cli, toolchain]) => ({cli, toolchain}));
    return this.probe;
  }

  async capabilities(contract?: HardwareContract): Promise<SimulatorCapabilities> {
    const token = this.token();
    const tokenOk = /^wok_[A-Za-z0-9]{40}$/.test(token);
    const {cli, toolchain} = await this.environment();
    const missing = [tokenOk ? undefined : 'WOKWI_CLI_TOKEN absent or malformed (expected wok_ + 40 chars)', cli ? undefined : 'wokwi-cli binary not found (or override WOKWI_CLI_BIN)', toolchain ? undefined : 'arduino-cli not found (compile stage)'].filter(Boolean) as string[];
    const available = tokenOk && cli && toolchain;
    const testScenario = this.deps.testScenario === true && this.deps.spawn !== undefined;
    const supported = available && testScenario && (!contract || isSupportedRecipe(contract));
    const reason = missing.length ? `Wokwi CLI execution unavailable: ${missing.join('; ')}. ` : 'Wokwi CLI tooling detected; live recipe execution requires a tested scenario per recipe. ';
    return {backend: 'wokwi-cli', available, supported, executesFirmware: !testScenario,
      reason: reason + (testScenario ? 'Injected test scenario only; not live firmware execution proof.' : 'No tested scenario is installed for this recipe; execution is refused instead of guessed.')};
  }

  async run(contract: HardwareContract, fault: 'none' | 'sda', firmware?: FirmwareArtifact): Promise<SimulationOutput> {
    const caps = await this.capabilities(contract);
    if (!caps.available || !caps.supported) throw new Error(caps.reason);
    const run = this.runner();
    const artifact = firmware ?? generateFirmware(contract, {experimentId: 'wokwi-simulation', nonce: 'wokwi-simulation'});
    if (artifact.contractHash !== contractHash(contract) || artifact.hash !== hashText(artifact.source) || artifact.sourceHash !== artifact.hash) throw new Error('Firmware artifact identity mismatch');
    const source = artifact.source;
    const dir = await mkdtemp(join(tmpdir(), 'wokwi-sim-'));
    try {
      const isButton = contract.recipe?.id === 'esp32-button-led';
      const sketchName = isButton ? 'button_led' : 'room_monitor';
      const sketchDir = join(dir, sketchName), buildDir = join(dir, 'build');
      await mkdir(sketchDir, {recursive: true}); await mkdir(buildDir, {recursive: true});
      await writeFile(join(sketchDir, sketchName + '.ino'), source);
      const compile = await run(this.arduinoCli(), ['compile', '--fqbn', contract.firmware.fqbn, '--output-dir', buildDir, sketchDir], 600000);
      if (compile.code !== 0) throw new Error(`Wokwi simulation compile failed: ${compile.stderr.slice(-400)}`);
      const elf = (await readdir(buildDir)).find(file => file.endsWith('.elf'));
      if (!elf) throw new Error('Wokwi simulation build produced no ELF');
      const serialLogPath = join(dir, 'serial.log'), scenarioPath = join(dir, isButton ? 'button.yml' : 'golden.yml');
      await writeFile(join(dir, 'wokwi.toml'), `[wokwi]\nversion = 1\nfirmware = '${join(buildDir, elf)}'\n`);
      await writeFile(join(dir, 'diagram.json'), JSON.stringify(diagramFor(contract, fault), null, 2));
      await writeFile(scenarioPath, isButton ? buttonScenarioYaml : scenarioYaml);
      const simulation = await run(this.bin(), [dir, '--scenario', isButton ? 'button.yml' : 'golden.yml', '--serial-log-file', serialLogPath, '--timeout', '60000'], 180000);
      const serialLog = await readFile(serialLogPath, 'utf-8').catch(() => '');
      const judged = judgeSerial(serialLog, artifact);
      const sawProtocol = simulation.code === 0 && judged !== undefined;
      const row = (name: string) => judged?.rows.find(r => r.check === name);
      const check = (name: CheckName, fallbackData: Record<string, unknown>) => {
        const found = row(name);
        if (!found) return {check: name, passed: false, data: {...fallbackData, simulated: true, backend: 'wokwi-cli' as const, reason: sawProtocol ? 'Check missing in newest observed cycle' : 'Serial evidence protocol never observed'}};
        return {check: name, passed: simulation.code === 0 && found.passed && !found.conflict, data: {...found.data, simulated: true, backend: 'wokwi-cli' as const, ...(found.conflict ? {conflict: 'Duplicate check with conflicting outcome in cycle ' + judged!.cycle} : {}), cycle: judged!.cycle}};
      };
      const synthesized = [
        {check: 'board_detected' as CheckName, passed: true, data: {boardId: contract.board.id, simulated: true, backend: 'wokwi-cli', exitCode: simulation.code}},
        {check: 'compiled' as CheckName, passed: true, data: {success: true, simulated: true, backend: 'wokwi-cli', compiler: 'arduino-cli', elf}},
        {check: 'flashed' as CheckName, passed: sawProtocol, data: {success: sawProtocol, simulated: true, backend: 'wokwi-cli', message: sawProtocol ? 'Simulator executed the firmware build' : 'Simulator exited ' + simulation.code + ' without evidence'}},
      ];
      const telemetry = resolveRecipe(contract)!.checks.filter(name => !['board_detected', 'compiled', 'flashed'].includes(name)).map(name => check(name, {}));
      return {source: 'simulation', backend: 'wokwi-cli', simulated: true, checks: [...synthesized, ...telemetry]};
    } finally {
      await rm(dir, {recursive: true, force: true}).catch(() => {});
    }
  }
}
