import test from 'node:test';
import assert from 'node:assert/strict';
import { toMono, buildPeaks, peaksForRange } from '../src/waveformPeaks.js';

function bruteRange(samples, start, end, width) {
  const total = samples.length;
  const from = Math.max(0, Math.min(total, Math.floor(start)));
  const to = Math.max(0, Math.min(total, Math.floor(end)));
  const span = to - from;
  const min = new Float32Array(width);
  const max = new Float32Array(width);
  if (span <= 0) return { min, max };
  for (let c = 0; c < width; c += 1) {
    let s = from + Math.floor((c * span) / width);
    let e = from + Math.floor(((c + 1) * span) / width);
    if (e <= s) e = s + 1;
    let low = samples[s];
    let high = samples[s];
    for (let i = s + 1; i < e; i += 1) {
      const v = samples[i];
      if (v < low) low = v;
      if (v > high) high = v;
    }
    min[c] = low;
    max[c] = high;
  }
  return { min, max };
}

function lcgSamples(count) {
  let seed = 1234567;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    out[i] = (seed / 4294967296) * 2 - 1;
  }
  return out;
}

test('toMono averages two channels', () => {
  const mono = toMono([
    new Float32Array([1, 2, 3]),
    new Float32Array([3, 4, 5]),
  ]);
  assert.ok(mono instanceof Float32Array);
  assert.deepEqual(Array.from(mono), [2, 3, 4]);
});

test('toMono returns a single channel unchanged', () => {
  const channel = new Float32Array([1, -2, 3]);
  assert.strictEqual(toMono([channel]), channel);
});

test('toMono on empty input returns an empty Float32Array', () => {
  const mono = toMono([]);
  assert.ok(mono instanceof Float32Array);
  assert.equal(mono.length, 0);
});

test('buildPeaks level 0 length and values, baseBlock 4', () => {
  const samples = new Float32Array([0, 2, -1, 5, 3, -4, 7, 1, 9]);
  const peaks = buildPeaks(samples, 4);
  assert.equal(peaks.total, 9);
  assert.equal(peaks.baseBlock, 4);
  assert.equal(peaks.levels[0].mins.length, 3);
  assert.deepEqual(Array.from(peaks.levels[0].mins), [-1, -4, 9]);
  assert.deepEqual(Array.from(peaks.levels[0].maxes), [5, 7, 9]);
});

test('buildPeaks level count halves down to one block', () => {
  const samples = new Float32Array([0, 2, -1, 5, 3, -4, 7, 1, 9]);
  const peaks = buildPeaks(samples, 4);
  assert.deepEqual(peaks.levels.map((level) => level.mins.length), [3, 2, 1]);
  assert.deepEqual(Array.from(peaks.levels[1].mins), [-4, 9]);
  assert.deepEqual(Array.from(peaks.levels[1].maxes), [7, 9]);
  assert.deepEqual(Array.from(peaks.levels[2].mins), [-4]);
  assert.deepEqual(Array.from(peaks.levels[2].maxes), [9]);
});

test('buildPeaks empty input has no levels', () => {
  const peaks = buildPeaks(new Float32Array(0), 4);
  assert.equal(peaks.total, 0);
  assert.deepEqual(peaks.levels, []);
});

test('buildPeaks last short block', () => {
  const peaks = buildPeaks(new Float32Array([1, -2, 3, -4, 5]), 4);
  assert.equal(peaks.levels[0].mins.length, 2);
  assert.deepEqual(Array.from(peaks.levels[0].mins), [-4, 5]);
  assert.deepEqual(Array.from(peaks.levels[0].maxes), [3, 5]);
});

test('peaksForRange exact raw path, hand computed', () => {
  const samples = new Float32Array([0, 2, -1, 5, 3]);
  const peaks = buildPeaks(samples, 4);
  const two = peaksForRange(peaks, samples, 0, 5, 2);
  assert.deepEqual(Array.from(two.min), [0, -1]);
  assert.deepEqual(Array.from(two.max), [2, 5]);
  const five = peaksForRange(peaks, samples, 0, 5, 5);
  assert.deepEqual(Array.from(five.min), [0, 2, -1, 5, 3]);
  assert.deepEqual(Array.from(five.max), [0, 2, -1, 5, 3]);
});

test('peaksForRange matches brute force over several ranges and widths', () => {
  const samples = lcgSamples(10000);
  const peaks = buildPeaks(samples, 64);
  const ranges = [
    [0, 10000, 100], [0, 10000, 17], [123, 9876, 100],
    [5000, 6000, 10], [17, 9999, 64], [0, 500, 20],
  ];
  for (const [start, end, width] of ranges) {
    const actual = peaksForRange(peaks, samples, start, end, width);
    const expected = bruteRange(samples, start, end, width);
    assert.deepEqual(Array.from(actual.min), Array.from(expected.min), `min for ${start},${end},${width}`);
    assert.deepEqual(Array.from(actual.max), Array.from(expected.max), `max for ${start},${end},${width}`);
  }
});

test('peaksForRange clamps start and end to the sample range', () => {
  const samples = new Float32Array([1, 2, 3, 4, 5]);
  const peaks = buildPeaks(samples, 2);
  const clamped = peaksForRange(peaks, samples, -100, 999, 2);
  const full = peaksForRange(peaks, samples, 0, 5, 2);
  assert.deepEqual(Array.from(clamped.min), Array.from(full.min));
  assert.deepEqual(Array.from(clamped.max), Array.from(full.max));
  const tail = peaksForRange(peaks, samples, 4, 100, 2);
  assert.deepEqual(Array.from(tail.min), [5, 5]);
  assert.deepEqual(Array.from(tail.max), [5, 5]);
});

test('peaksForRange with end <= start gives zeros', () => {
  const samples = new Float32Array([1, 2, 3]);
  const peaks = buildPeaks(samples, 1);
  for (const [start, end] of [[3, 3], [5, 2]]) {
    const result = peaksForRange(peaks, samples, start, end, 4);
    assert.deepEqual(Array.from(result.min), [0, 0, 0, 0]);
    assert.deepEqual(Array.from(result.max), [0, 0, 0, 0]);
  }
});

test('peaksForRange with width larger than samples fills every column', () => {
  const samples = new Float32Array([1, -1]);
  const peaks = buildPeaks(samples, 4);
  const result = peaksForRange(peaks, samples, 0, 2, 5);
  assert.deepEqual(Array.from(result.min), [1, 1, 1, -1, -1]);
  assert.deepEqual(Array.from(result.max), [1, 1, 1, -1, -1]);
  for (let c = 0; c < 5; c += 1) {
    assert.ok(Number.isFinite(result.min[c]) && Number.isFinite(result.max[c]));
    assert.ok(result.min[c] <= result.max[c]);
  }
});

test('peaksForRange constant signal gives min equal to max', () => {
  const samples = new Float32Array(1000).fill(0.5);
  const peaks = buildPeaks(samples, 64);
  const result = peaksForRange(peaks, samples, 0, 1000, 8);
  assert.equal(result.min.length, 8);
  for (let c = 0; c < 8; c += 1) {
    assert.equal(result.min[c], 0.5);
    assert.equal(result.max[c], 0.5);
  }
});

test('input arrays are not modified', () => {
  const samples = new Float32Array([3, -1, 4, -5, 2, 7, -8, 1]);
  const before = Array.from(samples);
  const left = new Float32Array([1, 2]);
  const right = new Float32Array([3, 4]);
  const leftBefore = Array.from(left);
  const rightBefore = Array.from(right);
  const peaks = buildPeaks(samples, 2);
  peaksForRange(peaks, samples, 0, samples.length, 5);
  toMono([left, right]);
  assert.deepEqual(Array.from(samples), before);
  assert.deepEqual(Array.from(left), leftBefore);
  assert.deepEqual(Array.from(right), rightBefore);
});
