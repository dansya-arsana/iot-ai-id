import test from 'node:test';
import assert from 'node:assert/strict';
import {withProviderRetry} from '../services/orchestrator/provider.js';

test('transient provider failures retry with backoff and then succeed', async () => {
  let calls = 0;
  const result = await withProviderRetry(async () => {
    calls++;
    if (calls < 3) throw new Error('Frontier provider HTTP 429');
    return 'ok';
  }, 3, 1);
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
});

test('deterministic failures are not retried and the last message is preserved', async () => {
  let calls = 0;
  await assert.rejects(withProviderRetry(async () => {
    calls++;
    throw new Error('Unexpected token < in JSON');
  }, 3, 1), /Provider unavailable after 1 attempt.*Unexpected token/s);
  assert.equal(calls, 1);
});

test('exhausted retries produce an explicit provider-unavailable error', async () => {
  let calls = 0;
  await assert.rejects(withProviderRetry(async () => {
    calls++;
    throw new Error('Frontier provider HTTP 500');
  }, 2, 1), /Provider unavailable after 2 attempts.*HTTP 500/s);
  assert.equal(calls, 2);
});
