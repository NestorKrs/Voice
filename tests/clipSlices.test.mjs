import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fadeSamples,
  sliceClip,
  sliceAll,
  defaultClipName,
  safeBaseName,
  uniqueNames,
} from '../src/clipSlices.js';

test('fadeSamples rounds and never goes negative', () => {
  assert.equal(fadeSamples(10, 44100), 441);
  assert.equal(fadeSamples(0.5, 1000), 1);
  assert.equal(fadeSamples(-5, 1000), 0);
  assert.equal(fadeSamples(0, 1000), 0);
});

test('sliceClip applies a hand-computed two-sample fade to a constant signal', () => {
  const result = sliceClip(new Float32Array([1, 1, 1, 1, 1, 1]), 0, 6, 2);
  assert.deepEqual(Array.from(result), [0, 0.5, 1, 1, 0.5, 0]);
});

test('sliceClip caps the fade at half the clip length', () => {
  const result = sliceClip(new Float32Array([1, 1, 1, 1]), 0, 4, 10);
  assert.deepEqual(Array.from(result), [0, 0.5, 0.5, 0]);
});

test('sliceClip with fadeN 0 is a plain copy', () => {
  const result = sliceClip(new Float32Array([1, 2, 3]), 0, 3, 0);
  assert.deepEqual(Array.from(result), [1, 2, 3]);
});

test('sliceClip returns a copy, not a view of the source', () => {
  const source = new Float32Array([1, 2, 3]);
  const result = sliceClip(source, 0, 3, 0);
  assert.notEqual(result, source);
  result[0] = 99;
  assert.equal(source[0], 1);
});

test('sliceClip returns an empty array when end is not after start', () => {
  assert.equal(sliceClip(new Float32Array([1, 2, 3]), 2, 2, 2).length, 0);
  assert.equal(sliceClip(new Float32Array([1, 2, 3]), 3, 1, 2).length, 0);
});

test('sliceClip clamps out-of-range start and end', () => {
  const samples = new Float32Array([1, 2, 3]);
  assert.deepEqual(Array.from(sliceClip(samples, -5, 100, 0)), [1, 2, 3]);
  assert.deepEqual(Array.from(sliceClip(samples, -5, 2, 0)), [1, 2]);
  assert.deepEqual(Array.from(sliceClip(samples, 2, 100, 0)), [3]);
});

test('sliceAll slices three segments in order with the given fade', () => {
  const samples = new Float32Array([
    1, 1, 1, 1,
    2, 2, 2, 2,
    3, 3, 3, 3,
  ]);
  const segments = [
    { index: 2, start: 8, end: 12 },
    { index: 0, start: 0, end: 4 },
    { index: 1, start: 4, end: 8 },
  ];
  const result = sliceAll(samples, segments, 2);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map((clip) => Array.from(clip)), [
    [0, 1.5, 1.5, 0],
    [0, 0.5, 0.5, 0],
    [0, 1, 1, 0],
  ]);
});

test('defaultClipName pads to three digits', () => {
  assert.equal(defaultClipName(0), 'clip-001');
  assert.equal(defaultClipName(9), 'clip-010');
  assert.equal(defaultClipName(999), 'clip-1000');
});

test('safeBaseName removes illegal characters, controls, trailing dots and repeated spaces', () => {
  assert.equal(safeBaseName('a/b:c*d?e"f<g>h|i', 'fallback'), 'abcdefghi');
  assert.equal(safeBaseName('x\u0001y\u007fz', 'fallback'), 'xyz');
  assert.equal(safeBaseName('  hello...  ', 'fallback'), 'hello');
  assert.equal(safeBaseName('a   b', 'fallback'), 'a b');
});

test('safeBaseName uses the fallback for empty names and cuts long names to 60', () => {
  assert.equal(safeBaseName('', 'clip-001'), 'clip-001');
  assert.equal(safeBaseName('   ...   ', 'clip-002'), 'clip-002');
  assert.equal(safeBaseName('x'.repeat(100), 'fallback'), 'x'.repeat(60));
});

test('uniqueNames adds suffixes to names differing only by case', () => {
  assert.deepEqual(uniqueNames(['Take', 'take', 'TAKE']), ['Take', 'take-2', 'TAKE-3']);
});

test('uniqueNames gives empty names their indexed fallback', () => {
  assert.deepEqual(uniqueNames(['', ':', 'clip-001']), ['clip-001', 'clip-002', 'clip-001-2']);
});

test('uniqueNames skips a suffix that an existing name already uses', () => {
  assert.deepEqual(uniqueNames(['a-2', 'a', 'A']), ['a-2', 'a', 'A-3']);
});

test('sliceAll and uniqueNames do not modify their inputs', () => {
  const samples = new Float32Array([1, 2, 3, 4]);
  const segments = [{ index: 1, start: 0, end: 2 }, { index: 0, start: 2, end: 4 }];
  const names = ['A', 'a', 'b'];
  const sourceCopy = Array.from(samples);
  const segmentsCopy = JSON.parse(JSON.stringify(segments));
  const namesCopy = [...names];
  sliceAll(samples, segments, 2);
  uniqueNames(names);
  assert.deepEqual(Array.from(samples), sourceCopy);
  assert.deepEqual(segments, segmentsCopy);
  assert.deepEqual(names, namesCopy);
});
