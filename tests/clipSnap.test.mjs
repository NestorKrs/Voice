import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REACTION_COMP_MS,
  SNAP_RADIUS_MS,
  SNAP_FRAME_MS,
  FADE_MS,
  compensateKeyPress,
  snapToQuiet,
} from '../src/clipSnap.js';

function gapSignal() {
  const samples = new Float64Array(1000).fill(1);
  for (let i = 495; i <= 505; i += 1) samples[i] = 0;
  samples[495] = 10;
  return samples;
}

test('constants are the agreed numbers', () => {
  for (const value of [REACTION_COMP_MS, SNAP_RADIUS_MS, SNAP_FRAME_MS, FADE_MS]) {
    assert.equal(typeof value, 'number');
  }
  assert.equal(REACTION_COMP_MS, 180);
  assert.equal(SNAP_RADIUS_MS, 80);
  assert.equal(SNAP_FRAME_MS, 5);
  assert.equal(FADE_MS, 5);
});

test('compensateKeyPress subtracts 180 ms at 44100 Hz and never goes below zero', () => {
  assert.equal(compensateKeyPress(10000, 44100), 10000 - 7938);
  assert.equal(compensateKeyPress(7938, 44100), 0);
  assert.equal(compensateKeyPress(1000, 44100), 0);
  assert.equal(compensateKeyPress(100, 1000, 50), 50);
  assert.equal(compensateKeyPress(0, 44100), 0);
});

test('snapping to a quiet gap skips a click and lands near the gap centre', () => {
  const result = snapToQuiet(gapSignal(), 1000, 520);
  assert.ok(result >= 496 && result <= 505, `result ${result} is inside the gap`);
  assert.equal(result, 502);
});

test('a point already inside the gap stays inside it', () => {
  const result = snapToQuiet(gapSignal(), 1000, 500);
  assert.ok(result >= 496 && result <= 505, `result ${result} is inside the gap`);
  assert.equal(result, 500);
});

test('an all-equal signal returns the closest candidate to the original', () => {
  const samples = new Float64Array(500).fill(1);
  assert.equal(snapToQuiet(samples, 1000, 100), 100);
  assert.equal(snapToQuiet(samples, 1000, 101), 101);
});

test('an exact distance tie takes the lower candidate', () => {
  const samples = new Float64Array(500).fill(1);
  assert.equal(snapToQuiet(samples, 1000, 100, 81), 99);
});

test('a zero radius returns the original', () => {
  const samples = new Float64Array(500).fill(1);
  assert.equal(snapToQuiet(samples, 1000, 123, 0), 123);
});

test('candidates clamp at both ends of the signal', () => {
  const atStart = new Float64Array(200).fill(1);
  atStart.fill(0, 0, 10);
  const startResult = snapToQuiet(atStart, 1000, 0, 10);
  assert.equal(startResult, 0);

  const atEnd = new Float64Array(200).fill(1);
  atEnd.fill(0, 190, 200);
  const endResult = snapToQuiet(atEnd, 1000, 200, 10);
  assert.equal(endResult, 200);
  assert.ok(startResult >= 0 && startResult <= atStart.length);
  assert.ok(endResult >= 0 && endResult <= atEnd.length);
});

test('an empty signal returns the original sample', () => {
  assert.equal(snapToQuiet(new Float64Array(0), 1000, 42), 42);
});

test('the input array is not modified', () => {
  const samples = gapSignal();
  const before = samples.slice();
  snapToQuiet(samples, 1000, 520);
  assert.deepEqual(samples, before);
});

test('the prefix-sum search agrees with a direct RMS scan', () => {
  let seed = 12345;
  const samples = new Float64Array(600);
  for (let i = 0; i < samples.length; i += 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    samples[i] = seed / 0x7fffffff;
  }
  const sample = 300;
  const radius = 60;
  const frame = 9;
  const step = Math.max(1, Math.floor(frame / 2));
  const half = Math.floor(frame / 2);
  let expected = sample;
  let bestRms = Infinity;
  let bestDistance = Infinity;

  for (let candidate = sample - radius; candidate <= sample + radius; candidate += step) {
    const centre = Math.max(0, Math.min(samples.length, candidate));
    let start = Math.max(0, centre - half);
    let end = Math.min(samples.length, centre - half + frame);
    if (end <= start) {
      start = Math.max(0, samples.length - frame);
      end = samples.length;
    }
    let sum = 0;
    for (let i = start; i < end; i += 1) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / (end - start));
    const distance = Math.abs(centre - sample);
    if (
      rms < bestRms ||
      (rms === bestRms && (distance < bestDistance ||
        (distance === bestDistance && centre < expected)))
    ) {
      bestRms = rms;
      bestDistance = distance;
      expected = centre;
    }
  }

  assert.equal(snapToQuiet(samples, 1000, sample, radius, frame), expected);
});
