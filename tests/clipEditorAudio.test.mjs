import test from 'node:test';
import assert from 'node:assert/strict';
import { concatMono } from '../src/clipEditorAudio.js';

function part(values, sampleRate = 44100) {
  return { samples: new Float32Array(values), sampleRate };
}

test('concatMono joins two parts with correct values and offsets', () => {
  const result = concatMono([part([1, 2, 3]), part([4, 5])]);
  assert.ok(result.samples instanceof Float32Array);
  assert.deepEqual(Array.from(result.samples), [1, 2, 3, 4, 5]);
  assert.deepEqual(result.offsets, [0, 3]);
  assert.equal(result.sampleRate, 44100);
});

test('concatMono single part', () => {
  const result = concatMono([part([7, -2], 48000)]);
  assert.deepEqual(Array.from(result.samples), [7, -2]);
  assert.deepEqual(result.offsets, [0]);
  assert.equal(result.sampleRate, 48000);
});

test('concatMono empty array', () => {
  const result = concatMono([]);
  assert.ok(result.samples instanceof Float32Array);
  assert.equal(result.samples.length, 0);
  assert.equal(result.sampleRate, 0);
  assert.deepEqual(result.offsets, []);
});

test('concatMono zero-length part in the middle keeps its offset', () => {
  const result = concatMono([part([1, 2]), part([]), part([3])]);
  assert.deepEqual(Array.from(result.samples), [1, 2, 3]);
  assert.deepEqual(result.offsets, [0, 2, 2]);
});

test('concatMono throws the exact message on a rate mismatch', () => {
  assert.throws(
    () => concatMono([part([1], 44100), part([2], 48000), part([3], 44100)]),
    { message: 'Sample rates differ: chunk 2 is 48000 Hz, expected 44100 Hz.' },
  );
  assert.throws(
    () => concatMono([part([1], 44100), part([2], 44100), part([3], 22050)]),
    { message: 'Sample rates differ: chunk 3 is 22050 Hz, expected 44100 Hz.' },
  );
});

test('concatMono does not modify inputs and does not alias them', () => {
  const first = part([1, 2, 3]);
  const second = part([4, 5]);
  const firstBefore = Array.from(first.samples);
  const secondBefore = Array.from(second.samples);
  const result = concatMono([first, second]);
  assert.deepEqual(Array.from(first.samples), firstBefore);
  assert.deepEqual(Array.from(second.samples), secondBefore);
  assert.notStrictEqual(result.samples, first.samples);
  assert.notStrictEqual(result.samples, second.samples);
  result.samples[0] = 99;
  assert.equal(first.samples[0], 1);
});
