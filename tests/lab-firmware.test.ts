import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {FIRMWARE_SPEC, LESSON_IDS} from '../apps/web/src/lab/contract.js';
import {labFirmware} from '../apps/web/src/lab/firmware/index.js';

const WIDTH = {uint8: 1, int16: 2, uint16: 2, int32: 4, uint32: 4} as const;
const SIGNED = new Set(['int16', 'int32']);

function decode(flash: Buffer, off: number, ctype: keyof typeof WIDTH): number {
  const w = WIDTH[ctype];
  let v = 0;
  for (let i = w - 1; i >= 0; i--) v = v * 256 + flash[off + i];
  return SIGNED.has(ctype) && v >= 2 ** (w * 8 - 1) ? v - 2 ** (w * 8) : v;
}

test('toolchain string records -fno-lto', () => {
  assert.ok(labFirmware.toolchain.includes('-fno-lto'));
});

for (const lesson of LESSON_IDS) {
  for (const spec of FIRMWARE_SPEC[lesson].variants) {
    test(`firmware ${lesson}/${spec.id}`, () => {
      const v = labFirmware.lessons[lesson]?.variants.find((x) => x.id === spec.id);
      assert.ok(v, 'variant missing: run npm run lab:firmware');
      const disk = readFileSync(new URL(`../apps/web/src/lab/firmware/sketches/${v.sketch}/${v.sketch}.ino`, import.meta.url), 'utf8');
      assert.equal(v.sha256, createHash('sha256').update(disk).digest('hex'), 'sketch changed: run npm run lab:firmware');
      assert.equal(v.source, disk);
      let applied = v.template;
      for (const p of spec.params) applied = applied.replace(`{{${p.name}}}`, String(p.defaultValue));
      assert.equal(applied, v.source);
      const flash = Buffer.from(v.flashBase64, 'base64');
      assert.equal(flash.length, v.bytes);
      assert.ok(v.bytes > 0 && v.bytes <= 32256);
      assert.equal(v.params.length, spec.params.length);
      spec.params.forEach((p, i) => {
        const fp = v.params[i];
        assert.deepEqual({name: fp.name, ctype: fp.ctype, min: fp.min, max: fp.max, step: fp.step, defaultValue: fp.defaultValue}, {name: p.name, ctype: p.ctype, min: p.min, max: p.max, step: p.step, defaultValue: p.defaultValue});
        assert.equal(decode(flash, fp.offset, fp.ctype), p.defaultValue, `${p.name} offset bytes`);
      });
      const spans = v.params.map((p) => [p.offset, p.offset + WIDTH[p.ctype]]).sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < spans.length; i++) assert.ok(spans[i][0] >= spans[i - 1][1], 'params share bytes');
      assert.ok(v.lines.length > 0);
      for (let i = 0; i < v.lines.length; i++) {
        assert.ok(v.lines[i][0] <= v.lines[i][1]);
        if (i) assert.ok(v.lines[i][0] >= v.lines[i - 1][0], 'lines not sorted');
      }
    });
  }
}
