import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_PROVIDERS, isFreeModel } from '../src/providers.js';
import { requestSpeech } from '../src/speechClient.js';

test('every built-in provider model ends in :free', () => {
  assert.ok(BUILTIN_PROVIDERS.length > 0);
  for (const p of BUILTIN_PROVIDERS) {
    assert.match(p.model, /:free$/);
    assert.equal(isFreeModel(p.model), true);
  }
});

test('isFreeModel rejects a model id without :free', () => {
  assert.equal(isFreeModel('fish-audio/s2.1-pro'), false);
  assert.equal(isFreeModel('heygen/heygen-voice-1-turbo'), false);
  assert.equal(isFreeModel('fish-audio/s2.1-pro-free'), false);
  assert.equal(isFreeModel(''), false);
  assert.equal(isFreeModel(null), false);
});

test('speechClient rejects a non-free model without sending a request', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new Error('network must not be used');
  };
  const r = await requestSpeech({
    apiKey: 'test-key',
    input: 'hello there',
    provider: { model: 'fish-audio/s2.1-pro', format: 'mp3' },
    fetchImpl,
  });
  assert.equal(calls, 0);
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'bad_provider');
  assert.match(r.error.message, /free/i);
});
