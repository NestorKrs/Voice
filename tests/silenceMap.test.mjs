import test from 'node:test';
import assert from 'node:assert/strict';
import { findSilences } from '../src/silenceMap.js';

const RATE = 8000;

// A sine tone, a stretch of silence, or a whole clip built from segments.
function tone(seconds, { frequency = 440, amplitude = 0.5 } = {}) {
  const length = Math.round(seconds * RATE);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) out[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / RATE);
  return out;
}

function silence(seconds) {
  return new Float32Array(Math.round(seconds * RATE));
}

function concat(...parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Float32Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

test('one gap: a tone with a 0.4 s gap gives one silence of about 0.4 s', () => {
  const samples = concat(tone(0.5), silence(0.4), tone(0.5));
  const result = findSilences(samples, RATE);
  assert.equal(result.silences.length, 1);
  assert.ok(Math.abs(result.silences[0].start - 0.5) < 0.02, `start ${result.silences[0].start}`);
  assert.ok(Math.abs(result.silences[0].end - 0.9) < 0.02, `end ${result.silences[0].end}`);
  assert.ok(Math.abs(result.silences[0].end - result.silences[0].start - 0.4) < 0.02);
});

test('two gaps: two silences', () => {
  const samples = concat(tone(0.4), silence(0.3), tone(0.4), silence(0.3), tone(0.4));
  const result = findSilences(samples, RATE);
  assert.equal(result.silences.length, 2);
  assert.ok(Math.abs(result.silences[0].start - 0.4) < 0.02);
  assert.ok(Math.abs(result.silences[1].start - 1.1) < 0.02);
});

test('a gap shorter than minSilence is ignored', () => {
  const samples = concat(tone(0.5), silence(0.1), tone(0.5));
  const result = findSilences(samples, RATE);
  assert.deepEqual(result.silences, []);
});

test('minSilence is overridable', () => {
  const samples = concat(tone(0.5), silence(0.1), tone(0.5));
  const result = findSilences(samples, RATE, { minSilence: 0.05 });
  assert.equal(result.silences.length, 1);
});

test('leading and trailing silence go to leadIn and tail, not silences', () => {
  const samples = concat(silence(0.3), tone(0.5), silence(0.4), tone(0.5), silence(0.3));
  const result = findSilences(samples, RATE);
  assert.equal(result.silences.length, 1);
  assert.ok(Math.abs(result.leadIn - 0.3) < 0.02, `leadIn ${result.leadIn}`);
  assert.ok(Math.abs(result.tail - 0.3) < 0.02, `tail ${result.tail}`);
  assert.ok(Math.abs(result.silences[0].start - 0.8) < 0.02);
});

test('pure silence and pure tone do not crash', () => {
  const quiet = findSilences(silence(0.6), RATE);
  assert.deepEqual(quiet.silences, []);
  assert.equal(quiet.leadIn, 0);
  assert.equal(quiet.tail, 0);

  const loud = findSilences(tone(0.6), RATE);
  assert.deepEqual(loud.silences, []);
  assert.equal(loud.leadIn, 0);
  assert.equal(loud.tail, 0);
});

test('low-volume speech gives the same silences: the threshold is relative', () => {
  const loud = concat(tone(0.5, { amplitude: 0.5 }), silence(0.4), tone(0.5, { amplitude: 0.5 }));
  const quietSpeech = concat(tone(0.5, { amplitude: 0.02 }), silence(0.4), tone(0.5, { amplitude: 0.02 }));
  const a = findSilences(loud, RATE);
  const b = findSilences(quietSpeech, RATE);
  assert.equal(b.silences.length, 1);
  assert.ok(Math.abs(a.silences[0].start - b.silences[0].start) < 0.02);
  assert.ok(Math.abs(a.silences[0].end - b.silences[0].end) < 0.02);
});

test('duration is the sample count over the sample rate', () => {
  const result = findSilences(concat(tone(0.5), silence(0.4), tone(0.5)), RATE);
  assert.ok(Math.abs(result.duration - 1.4) < 0.02, `duration ${result.duration}`);
});

test('an empty clip is safe', () => {
  const result = findSilences(new Float32Array(0), RATE);
  assert.deepEqual(result, { silences: [], leadIn: 0, tail: 0, duration: 0 });
});
