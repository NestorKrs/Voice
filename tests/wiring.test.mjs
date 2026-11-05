import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSpeak } from '../src/wiring.js';

test('makeSpeak reads key at call time and passes through', async () => {
  const storage = { data: { 'voice.apiKey': 'k1' }, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; }, removeItem(k) { delete this.data[k]; } };
  const readKey = (s) => (s.getItem('voice.apiKey') || '');
  let captured;
  const requestSpeech = async (args) => { captured = args; return { ok: true, bytes: new ArrayBuffer(1), attempts: 1 }; };
  const speak = makeSpeak({ readKey, requestSpeech, storage });
  const r = await speak({ input: 'hi', voice: 'v', signal: undefined });
  assert.equal(captured.apiKey, 'k1');
  assert.equal(captured.input, 'hi');
  assert.equal(captured.voice, 'v');
  assert.equal(r.ok, true);
});

test('changed key between calls', async () => {
  const storage = { data: { 'voice.apiKey': 'k1' }, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; }, removeItem(k) { delete this.data[k]; } };
  const readKey = (s) => (s.getItem('voice.apiKey') || '');
  const captured = [];
  const requestSpeech = async (args) => { captured.push(args.apiKey); return { ok: true, bytes: new ArrayBuffer(1), attempts: 1 }; };
  const speak = makeSpeak({ readKey, requestSpeech, storage });
  await speak({ input: 'hi', voice: '' });
  storage.data['voice.apiKey'] = 'k2';
  await speak({ input: 'hi', voice: '' });
  assert.deepEqual(captured, ['k1', 'k2']);
});

test('secrecy sentinel', async () => {
  const storage = { data: { 'voice.apiKey': 'sk-test-SECRET-123' }, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; }, removeItem(k) { delete this.data[k]; } };
  const readKey = (s) => (s.getItem('voice.apiKey') || '');
  const requestSpeech = async () => ({ ok: false, error: { kind: 'auth', message: 'no' }, attempts: 1 });
  const speak = makeSpeak({ readKey, requestSpeech, storage });
  const r = await speak({ input: 'SENTINEL-INPUT-TEXT', voice: '' });
  assert.ok(!JSON.stringify(r).includes('sk-test-SECRET-123'));
});