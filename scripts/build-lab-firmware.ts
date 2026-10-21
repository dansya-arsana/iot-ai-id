/**
 * Builds the lab firmware: compiles every lesson sketch with arduino-cli (AVR core) and writes
 * apps/web/src/lab/firmware/generated.ts (flash image, patch offsets, line tables, sha256).
 *
 * Usage: npm run lab:firmware   (or: npx tsx scripts/build-lab-firmware.ts)
 *
 * Toolchain selection:
 *  1. Native: if env LAB_AVR_BIN is set (dir with avr-gcc, avr-objdump...) it is passed as
 *     compiler.path; otherwise, if arduino-cli's own avr-gcc runs on this machine (Linux, Intel
 *     Mac, Rosetta) it is used as is.
 *  2. Docker fallback (e.g. Apple Silicon without Rosetta): builds/uses the image aiot-avr:1.8.8
 *     from scripts/lab-firmware/Dockerfile and runs arduino-cli + avr-objdump inside it.
 *     Force with LAB_DOCKER=1. Override the image with LAB_DOCKER_IMAGE.
 * Everything is compiled with -fno-lto so numeric params stay plain data bytes in flash; each
 * param's patch offset is found by differential compilation and verified (patched bytes ==
 * freshly compiled bytes). Never hand-edit generated.ts.
 */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FIRMWARE_SPEC, LESSON_IDS} from '../apps/web/src/lab/contract.js';
import type {FirmwareBundle, FirmwareParam, FirmwareRegistry, FirmwareVariant, LessonId, ParamCType, ParamSpec} from '../apps/web/src/lab/contract.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FW_DIR = join(ROOT, 'apps/web/src/lab/firmware');
const WORK = join(ROOT, '.runtime/lab-fw');
const CACHE = join(WORK, 'cache');
const IMAGE = process.env.LAB_DOCKER_IMAGE || 'aiot-avr:1.8.8';
const AVR_BIN = process.env.LAB_AVR_BIN?.replace(/\/+$/, '');
const FLAGS = ['--build-property', 'build.extra_flags=-fno-lto', '--build-property', 'compiler.c.elf.extra_flags=-fno-lto'];
const IN_CONTAINER_TOOLS = 'ls -d /root/.arduino15/packages/arduino/tools/avr-gcc/*/bin | head -1';

type Mode = 'native' | 'docker';
let mode: Mode = 'native';
let compiles = 0;

function sh(script: string, work?: string): string {
  if (mode === 'docker') {
    const args = ['run', '--rm', '-v', `${CACHE}:/cache`];
    if (work) args.push('-v', `${work}:/work`);
    args.push(IMAGE, 'sh', '-c', script);
    return execFileSync('docker', args, {encoding: 'utf8', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe']});
  }
  return execFileSync('sh', ['-c', script], {encoding: 'utf8', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'], cwd: work});
}

const compilerPath = (): string => (mode === 'native' && AVR_BIN ? `--build-property compiler.path=${AVR_BIN}/` : '');
const cacheDir = (): string => (mode === 'docker' ? '/cache' : CACHE);
const workDir = (d: string): string => (mode === 'docker' ? '/work' : d);
const toolBin = (): string =>
  mode === 'docker' ? `$(${IN_CONTAINER_TOOLS})`
  : AVR_BIN ? AVR_BIN
  : '$(ls -d "$HOME"/Library/Arduino15/packages/arduino/tools/avr-gcc/*/bin "$HOME"/.arduino15/packages/arduino/tools/avr-gcc/*/bin 2>/dev/null | head -1)';

function selectMode(): void {
  mkdirSync(CACHE, {recursive: true});
  const probeDir = join(WORK, 'probe');
  rmSync(probeDir, {recursive: true, force: true});
  mkdirSync(join(probeDir, 'probe'), {recursive: true});
  writeFileSync(join(probeDir, 'probe/probe.ino'), 'void setup(){}\nvoid loop(){}\n');
  if (process.env.LAB_DOCKER !== '1') {
    try {
      mode = 'native';
      sh(`arduino-cli compile -b arduino:avr:uno ${compilerPath()} --build-path "${probeDir}/b" "${probeDir}/probe"`);
      console.log('toolchain: native');
      return;
    } catch {
      console.log('native toolchain unavailable, falling back to docker');
    }
  }
  mode = 'docker';
  try {
    execFileSync('docker', ['image', 'inspect', IMAGE], {stdio: 'ignore'});
  } catch {
    console.log(`building docker image ${IMAGE}`);
    execFileSync('docker', ['build', '-t', IMAGE, join(ROOT, 'scripts/lab-firmware')], {stdio: 'inherit'});
  }
  console.log('toolchain: docker ' + IMAGE);
}

const WIDTH: Record<ParamCType, number> = {uint8: 1, int16: 2, uint16: 2, int32: 4, uint32: 4};
const CTYPES: Record<string, ParamCType> = {
  byte: 'uint8', uint8_t: 'uint8', 'unsigned int': 'uint16', uint16_t: 'uint16', int: 'int16', int16_t: 'int16',
  'unsigned long': 'uint32', uint32_t: 'uint32', long: 'int32', int32_t: 'int32',
};
const SIGNED = (t: ParamCType): boolean => t === 'int16' || t === 'int32';

function leBytes(v: number, width: number): number[] {
  const out: number[] = [];
  let x = BigInt.asUintN(width * 8, BigInt(v));
  for (let i = 0; i < width; i++) { out.push(Number(x & 0xffn)); x >>= 8n; }
  return out;
}

function parseHex(hex: string): Uint8Array {
  const mem = new Map<number, number>();
  let base = 0;
  let max = 0;
  for (const raw of hex.split(/\r?\n/)) {
    const l = raw.trim();
    if (!l.startsWith(':')) continue;
    const len = parseInt(l.slice(1, 3), 16);
    const addr = parseInt(l.slice(3, 7), 16);
    const type = parseInt(l.slice(7, 9), 16);
    if (type === 4) base = parseInt(l.slice(9, 13), 16) << 16;
    else if (type === 0) {
      for (let i = 0; i < len; i++) { mem.set(base + addr + i, parseInt(l.slice(9 + i * 2, 11 + i * 2), 16)); max = Math.max(max, base + addr + i + 1); }
    }
  }
  const out = new Uint8Array(max);
  for (const [a, b] of mem) out[a] = b;
  return out;
}

interface Built {flash: Uint8Array; objdump: string}
function compile(name: string, source: string, wantLines: boolean): Built {
  const dir = join(WORK, `c${compiles++}`);
  rmSync(dir, {recursive: true, force: true});
  mkdirSync(join(dir, name), {recursive: true});
  writeFileSync(join(dir, name, `${name}.ino`), source);
  const w = workDir(dir);
  const cmd = `arduino-cli compile -b arduino:avr:uno ${FLAGS.join(' ')} ${compilerPath()} --build-cache-path ${cacheDir()} --build-path ${w}/build ${w}/${name}`;
  try { sh(cmd, dir); } catch (e) {
    const err = e as {stderr?: string; stdout?: string};
    throw new Error(`compile failed for ${name}:\n${err.stdout ?? ''}${err.stderr ?? ''}`, {cause: e});
  }
  const flash = parseHex(readFileSync(join(dir, 'build', `${name}.ino.hex`), 'utf8'));
  let objdump = '';
  if (wantLines) {
    const elf = `${w}/build/${name}.ino.elf`;
    const od = `${toolBin()}/avr-objdump`;
    objdump = sh(`${od} --dwarf=decodedline ${elf} 2>/dev/null || ${od} -d -l ${elf}`, dir);
  }
  rmSync(dir, {recursive: true, force: true});
  return {flash, objdump};
}

function parseLines(objdump: string): [number, number, number][] {
  const rows: {addr: number; line: number; ino: boolean}[] = [];
  for (const l of objdump.split('\n')) {
    const m = /^(\S.*?)\s+(\d+)\s+(?:\d+\s+)?(0x[0-9a-fA-F]+)\b/.exec(l);
    if (m) rows.push({addr: parseInt(m[3], 16), line: Number(m[2]), ino: /\.ino$/.test(m[1])});
  }
  rows.sort((a, b) => a.addr - b.addr);
  const runs: [number, number, number][] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.ino || (i + 1 < rows.length && rows[i + 1].addr === r.addr)) continue; // last row at an address wins
    let j = i + 1;
    while (j < rows.length && rows[j].addr === r.addr) j++;
    const next = j < rows.length ? rows[j].addr : r.addr + 2;
    if (next <= r.addr) continue;
    const first = r.addr >> 1;
    const last = (next >> 1) - 1;
    const prev = runs[runs.length - 1];
    if (prev && prev[2] === r.line && prev[1] + 1 === first) prev[1] = last;
    else runs.push([first, last, r.line]);
  }
  return runs;
}

function findParam(source: string, p: ParamSpec) {
  const re = new RegExp(`^([ \\t]*(byte|unsigned int|int|unsigned long|long|uint8_t|uint16_t|int16_t|uint32_t|int32_t)\\s+${p.name}\\s*=\\s*)(-?\\d+)(\\s*;)`, 'gm');
  const ms = [...source.matchAll(re)];
  if (ms.length !== 1) throw new Error(`param ${p.name}: expected exactly one declaration, found ${ms.length}`);
  const m = ms[0];
  if (CTYPES[m[2]] !== p.ctype) throw new Error(`param ${p.name}: C type '${m[2]}' does not match ${p.ctype}`);
  if (Number(m[3]) !== p.defaultValue) throw new Error(`param ${p.name}: source value ${m[3]} != default ${p.defaultValue}`);
  if (p.defaultValue === 0) throw new Error(`param ${p.name}: default must be non-zero`);
  const start = m.index + m[1].length;
  return {start, end: start + m[3].length};
}

const withValue = (src: string, loc: {start: number; end: number}, v: number): string => src.slice(0, loc.start) + String(v) + src.slice(loc.end);

function buildVariant(lesson: LessonId, id: string, params: ParamSpec[]): FirmwareVariant {
  const sketch = `${lesson}-${id}`;
  const file = join(FW_DIR, 'sketches', sketch, `${sketch}.ino`);
  const source = readFileSync(file, 'utf8');
  const locs = params.map((p) => findParam(source, p));
  let template = source;
  for (let i = params.length - 1; i >= 0; i--) template = template.slice(0, locs[i].start) + `{{${params[i].name}}}` + template.slice(locs[i].end);

  const A = compile(sketch, source, true);
  const lines = parseLines(A.objdump);
  const loopIdx = source.split('\n').findIndex((l) => /^void\s+loop\s*\(\s*\)/.test(l));
  const body = source.split('\n').slice(loopIdx + 1).findIndex((l) => l.trim() !== '' && !l.trim().startsWith('//') && l.trim() !== '{');
  const firstStmt = loopIdx + 1 + body + 1;
  if (!lines.length || !lines.some((r) => r[2] === firstStmt)) throw new Error(`${sketch}: no line-table run on loop() first statement (line ${firstStmt})`);
  if (A.flash.length > 32256) throw new Error(`${sketch}: flash ${A.flash.length} > 32256`);

  const fparams: FirmwareParam[] = [];
  params.forEach((p, i) => {
    const w = WIDTH[p.ctype];
    const mask = 2 ** (w * 8);
    let b = (p.defaultValue ^ 0xa5a5a5a5) >>> 0;
    b %= mask;
    if (b === 0) b = ((p.defaultValue ^ 0x5a5a5a5a) >>> 0) % mask;
    if (SIGNED(p.ctype) && b >= mask / 2) b -= mask;
    const B = compile(sketch, withValue(source, locs[i], b), false);
    if (B.flash.length !== A.flash.length) throw new Error(`${sketch}.${p.name}: flash length differs (${A.flash.length} vs ${B.flash.length})`);
    const diff: number[] = [];
    A.flash.forEach((x, k) => { if (x !== B.flash[k]) diff.push(k); });
    // Bytes of A and B may coincide in some positions; accept when the window [o0, o0+w) covers all diffs.
    const lo = diff[0];
    const hi = diff[diff.length - 1];
    if (diff.length === 0 || hi - lo >= w) throw new Error(`${sketch}.${p.name}: differing bytes not within one ${w}-byte window (${diff.join(',')})`);
    const offset = findWindow(A.flash, B.flash, lo, hi, w, leBytes(p.defaultValue, w), leBytes(b, w));
    // A zero initialiser would move the variable to .bss (different layout), so probe a non-zero boundary.
    let c = p.max === p.defaultValue ? p.min : p.max;
    if (c === 0) c = p.step;
    const C = compile(sketch, withValue(source, locs[i], c), false);
    const patched = A.flash.slice();
    patched.set(leBytes(c, w), offset);
    if (patched.length !== C.flash.length || patched.some((x, k) => x !== C.flash[k])) throw new Error(`${sketch}.${p.name}: patched flash != compiled flash for ${c}; mark the variable volatile and retry`);
    fparams.push({...p, offset});
    console.log(`  ${sketch}.${p.name} offset ${offset} (${p.ctype})`);
  });
  const sorted = fparams.slice().sort((a, b) => a.offset - b.offset);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].offset < sorted[i - 1].offset + WIDTH[sorted[i - 1].ctype]) throw new Error(`${sketch}: params overlap`);
  }
  return {
    id, sketch, source, template, flashBase64: Buffer.from(A.flash).toString('base64'), bytes: A.flash.length,
    sha256: createHash('sha256').update(source).digest('hex'), lines, params: fparams,
  };
}

function findWindow(a: Uint8Array, b: Uint8Array, lo: number, hi: number, w: number, da: number[], db: number[]): number {
  for (let o = Math.max(0, hi - w + 1); o <= lo; o++) {
    if (da.every((x, k) => a[o + k] === x) && db.every((x, k) => b[o + k] === x)) return o;
  }
  throw new Error(`no ${w}-byte window with expected LE values around ${lo}..${hi}`);
}

function toolchainString(): string {
  const cli = /Version:\s*(\S+)/.exec(sh('arduino-cli version'))?.[1] ?? '?';
  const core = /arduino:avr\s+(\S+)/.exec(sh('arduino-cli core list'))?.[1] ?? '?';
  const gcc = sh(`${toolBin()}/avr-gcc -dumpversion`).trim();
  return `arduino-cli ${cli} · arduino:avr ${core} · avr-gcc ${gcc} · -fno-lto`;
}

const t0 = Date.now();
rmSync(WORK, {recursive: true, force: true});
selectMode();
const lessons = {} as Record<LessonId, FirmwareBundle>;
for (const lesson of LESSON_IDS) {
  console.log(lesson);
  lessons[lesson] = {lessonId: lesson, variants: FIRMWARE_SPEC[lesson].variants.map((v) => buildVariant(lesson, v.id, v.params))};
}
const registry: FirmwareRegistry = {toolchain: toolchainString(), lessons};
writeFileSync(
  join(FW_DIR, 'generated.ts'),
  `// Generated by scripts/build-lab-firmware.ts — do not edit.\nimport type {FirmwareRegistry} from '../contract';\nexport const labFirmware:FirmwareRegistry=${JSON.stringify(registry)};\n`,
);
rmSync(WORK, {recursive: true, force: true});
if (!existsSync(join(FW_DIR, 'generated.ts'))) throw new Error('generated.ts missing');
console.log(`done: ${registry.toolchain}; ${compiles} compiles in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
