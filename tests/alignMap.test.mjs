import test from 'node:test';
import assert from 'node:assert/strict';
import { alignTimeMap } from '../src/alignMap.js';

const NONE = { silences: [], leadIn: 0, tail: 0, duration: 0 };

test('two clean pauses give two anchors and hold at the end of "One."', () => {
  const text = 'One. Two. Three.';
  const result = alignTimeMap(text, {
    silences: [{ start: 0.575, end: 0.975 }, { start: 1.63125, end: 2.03125 }],
    leadIn: 0.05, tail: 0.05, duration: 2.9,
  });
  assert.equal(result.ok, true);
  assert.equal(result.anchors, 2);
  assert.equal(result.breaks, 2);
  assert.equal(result.silences, 2);
  assert.equal(result.timeToIndex(0.7), 4);
  assert.equal(text.slice(0, 4), 'One.');
  assert.equal(result.timeToIndex(1.8), 9);
  assert.equal(text.slice(0, 9), 'One. Two.');
});

test('an extra short mid-phrase silence is ignored', () => {
  const result = alignTimeMap('One. Two. Three.', {
    silences: [
      { start: 0.575, end: 0.975 },
      { start: 1.2, end: 1.3 },
      { start: 1.63125, end: 2.03125 },
    ],
    leadIn: 0.05, tail: 0.05, duration: 2.9,
  });
  assert.equal(result.ok, true);
  assert.equal(result.silences, 3);
  assert.equal(result.anchors, 2);
});

test('commas: only the paused ones are matched, the rest are skipped', () => {
  const result = alignTimeMap('One, two, three. Four, five.', {
    silences: [{ start: 0.4, end: 0.7 }, { start: 1.642857, end: 2.042857 }],
    leadIn: 0.05, tail: 0.05, duration: 3.0,
  });
  assert.equal(result.ok, true);
  assert.equal(result.breaks, 4);
  assert.equal(result.anchors, 2);
});

test('fewer silences than sentence breaks: ok, fewer anchors, no crash', () => {
  const result = alignTimeMap('One. Two. Three.', {
    silences: [{ start: 0.575, end: 0.975 }],
    leadIn: 0.05, tail: 0.05, duration: 2.9,
  });
  assert.equal(result.ok, true);
  assert.equal(result.breaks, 2);
  assert.equal(result.anchors, 1);
  assert.ok(result.anchors < result.breaks);
  assert.equal(typeof result.timeToIndex, 'function');
});

test('no silences at all: anchors 0 and a plain linear map', () => {
  const result = alignTimeMap('One. Two. Three.', { silences: [], leadIn: 0.1, tail: 0.1, duration: 2.0 });
  assert.equal(result.ok, true);
  assert.equal(result.anchors, 0);
  assert.equal(result.timeToIndex(0.1), 0);
  assert.equal(result.timeToIndex(1.0), 8);
  assert.equal(result.timeToIndex(1.9), 15);
  assert.equal(result.timeToIndex(2.5), 15);
});

test('"Version 3.5 is out. Done." does not break inside "3.5"', () => {
  const result = alignTimeMap('Version 3.5 is out. Done.', { ...NONE, leadIn: 0.05, tail: 0.05, duration: 2.0 });
  assert.equal(result.ok, true);
  assert.equal(result.breaks, 1);
});

test('monotonic for 300 increasing t values and clamped at both ends', () => {
  const text = 'One. Two. Three. Four.';
  const result = alignTimeMap(text, {
    silences: [
      { start: 0.55, end: 0.95 },
      { start: 1.65, end: 2.05 },
      { start: 2.75, end: 3.15 },
    ],
    leadIn: 0.05, tail: 0.05, duration: 4.0,
  });
  assert.equal(result.ok, true);
  let previous = -Infinity;
  for (let i = 0; i < 300; i += 1) {
    const t = -0.5 + (i / 299) * 5;
    const index = result.timeToIndex(t);
    assert.ok(index >= previous, `went backward at t=${t}: ${previous} -> ${index}`);
    assert.ok(index >= 0 && index <= text.length - 1, `index ${index} out of range at t=${t}`);
    previous = index;
  }
});

test('empty text gives ok false "No speech span"', () => {
  const result = alignTimeMap('', NONE);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'No speech span');
  assert.equal(result.timeToIndex, undefined);
});

test('a span with no room for speech gives ok false "No speech span"', () => {
  const result = alignTimeMap('Hello there.', { silences: [], leadIn: 0.5, tail: 0.5, duration: 1.0 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'No speech span');
});

test('a heavy character takes more time inside a segment', () => {
  const text = 'aa. bbbb';
  const audio = {
    silences: [{ start: 1.05, end: 1.45 }],
    leadIn: 0.05, tail: 0.05, duration: 2.0,
  };
  const plain = alignTimeMap(text, audio);
  const weighted = alignTimeMap(text, audio, { weightAt: (i) => (i === 1 ? 8 : 1) });
  assert.equal(plain.anchors, 1);
  assert.equal(weighted.anchors, 1);
  assert.equal(plain.timeToIndex(0.75), 2);
  assert.equal(weighted.timeToIndex(0.75), 1);
  assert.ok(weighted.timeToIndex(0.75) < plain.timeToIndex(0.75));
});

test('drift: a voice 30 percent faster still matches every break to its pause', () => {
  const text = 'One. Two. Three.';
  const result = alignTimeMap(text, {
    silences: [{ start: 0.33, end: 0.73 }, { start: 1.08, end: 1.48 }],
    leadIn: 0.05, tail: 0.05, duration: 2.02,
  });
  assert.equal(result.ok, true);
  assert.equal(result.breaks, 2);
  assert.equal(result.anchors, 2);
  assert.equal(result.timeToIndex(0.5), 4);
  assert.equal(result.timeToIndex(1.2), 9);
});

test('pairs reports the matched break offset and the silence seconds', () => {
  const result = alignTimeMap('One. Two.', {
    silences: [{ start: 0.5, end: 0.9 }],
    leadIn: 0.05, tail: 0.05, duration: 2.0,
  });
  assert.equal(result.ok, true);
  assert.equal(result.pairs.length, 1);
  assert.equal(result.pairs[0].offset, 4);
  assert.equal(result.pairs[0].start, 0.5);
  assert.equal(result.pairs[0].end, 0.9);
});

test('no silences: pairs [] and indexToTime(half the length) is half the duration', () => {
  const result = alignTimeMap('One. Two. Three.', { silences: [], leadIn: 0.1, tail: 0.1, duration: 2.0 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.pairs, []);
  assert.ok(Math.abs(result.indexToTime(8) - 1.0) < 1e-3);
});

test('indexToTime and timeToIndex round-trip both ways', () => {
  const text = 'One. Two. Three. Four.';
  const result = alignTimeMap(text, {
    silences: [
      { start: 0.55, end: 0.95 },
      { start: 1.65, end: 2.05 },
      { start: 2.75, end: 3.15 },
    ],
    leadIn: 0.05, tail: 0.05, duration: 4.0,
  });
  for (const i of [0, 2, 4, 8, 12, text.length - 1]) {
    assert.ok(result.timeToIndex(result.indexToTime(i)) >= i, `index ${i} did not round-trip`);
  }
  for (const t of [0.2, 0.5, 0.8, 1.2, 1.6]) {
    assert.ok(result.indexToTime(result.timeToIndex(t)) <= t + 1e-6, `time ${t} did not round-trip`);
  }
});

test('indexToTime is non-decreasing in the index', () => {
  const result = alignTimeMap('One. Two. Three.', {
    silences: [{ start: 0.5, end: 0.9 }],
    leadIn: 0.05, tail: 0.05, duration: 2.0,
  });
  let previous = -Infinity;
  for (let i = 0; i <= 16; i += 1) {
    const t = result.indexToTime(i);
    assert.ok(t >= previous, `went backward at index ${i}`);
    previous = t;
  }
});

test('indexToTime clamps below 0 and above the length', () => {
  const result = alignTimeMap('One. Two. Three.', { silences: [], leadIn: 0.1, tail: 0.1, duration: 2.0 });
  assert.equal(result.indexToTime(-5), 0.1);
  assert.equal(result.indexToTime(999), 1.9);
});

test('an ok false result carries pairs [] and indexToTime null', () => {
  const result = alignTimeMap('', NONE);
  assert.equal(result.ok, false);
  assert.deepEqual(result.pairs, []);
  assert.equal(result.indexToTime, null);
});

test('alignTimeMap does not mutate its inputs', () => {
  const text = 'One. Two. Three.';
  const audio = { silences: [{ start: 0.5, end: 0.9 }], leadIn: 0.05, tail: 0.05, duration: 2.0 };
  const before = JSON.stringify({ text, audio });
  alignTimeMap(text, audio);
  assert.equal(JSON.stringify({ text, audio }), before);
});
