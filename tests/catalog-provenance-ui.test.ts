import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarize,isStale,leaves} from '../apps/web/src/catalog/provenance-core';
import {matchesFilter} from '../apps/web/src/catalog/provenance-core';
const parts = JSON.parse(readFileSync('packages/catalog/fixtures/farm-parts.json','utf8')).parts;
test('summarize counts leaves and flags import-only as unverified', () => {
  const s = summarize(parts[0], Date.parse('2026-10-20'));
  assert.equal(s.total, leaves(parts[0]).length);
  assert.equal(s.unverified, s.total);
  assert.equal(s.stale, 0);
});
test('stale over 12 months', () => {
  assert.equal(isStale('2025-01-01', Date.parse('2026-10-20')), true);
  assert.equal(isStale('2026-06-01', Date.parse('2026-10-20')), false);
  assert.equal(matchesFilter(parts[0], 'stale', Date.parse('2028-01-01')), true);
});
