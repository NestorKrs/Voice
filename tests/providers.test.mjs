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

import { directiveSupport } from '../src/providers.js';

const DEFAULTS = { tags: 'unknown', breaks: 'unknown', breakMode: 'unknown', reasonTags: '', reasonBreaks: '' };

function byId(id) {
  return BUILTIN_PROVIDERS.find((p) => p.id === id);
}

test('directiveSupport reads the HeyGen entry', () => {
  assert.deepEqual(directiveSupport(byId('heygen')), {
    tags: 'confirmed', breaks: 'unknown', breakMode: 'unknown', reasonTags: '', reasonBreaks: '',
  });
});

test('directiveSupport reads the Fish entry', () => {
  assert.deepEqual(directiveSupport(byId('fish')), DEFAULTS);
});

test('directiveSupport gives an owner-added provider the defaults', () => {
  const custom = { id: 'custom-x', model: 'x/y-free:free', format: 'mp3', builtin: false, directives: { ...DEFAULTS } };
  assert.deepEqual(directiveSupport(custom), DEFAULTS);
  assert.deepEqual(directiveSupport({ id: 'custom-y', model: 'x/y-free:free', format: 'mp3' }), DEFAULTS);
});

test('directiveSupport falls back on a malformed field and drops extra fields', () => {
  const bad = { directives: { tags: 'maybe', breaks: 'confirmed', breakMode: 'half', reasonTags: 7, reasonBreaks: 'why', extra: 1 } };
  assert.deepEqual(directiveSupport(bad), {
    tags: 'unknown', breaks: 'confirmed', breakMode: 'unknown', reasonTags: '', reasonBreaks: 'why',
  });
});

test('directiveSupport returns the defaults for null and undefined', () => {
  assert.deepEqual(directiveSupport(null), DEFAULTS);
  assert.deepEqual(directiveSupport(undefined), DEFAULTS);
});

test('directiveSupport returns a copy that does not change the provider', () => {
  const heygen = byId('heygen');
  const got = directiveSupport(heygen);
  got.tags = 'unsupported';
  got.reasonTags = 'mutated';
  assert.equal(heygen.directives.tags, 'confirmed');
  assert.equal(heygen.directives.reasonTags, '');
});
