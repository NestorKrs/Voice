import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeMap } from '../src/timeMap.js';

test('one sentence: ok, one segment from leadIn to duration - tail', () => {
  const map = buildTimeMap([{ start: 0, end: 10 }], { silences: [], leadIn: 0.1, tail: 0.1, duration: 2 });
  assert.equal(map.ok, true);
  assert.equal(typeof map.timeToIndex, 'function');
  assert.equal(map.timeToIndex(0.05), 0);
  assert.equal(map.timeToIndex(1.05), 5);
  assert.equal(map.timeToIndex(1.95), 10);
});

test('one sentence ignores silences it cannot use', () => {
  const map = buildTimeMap(
    [{ start: 0, end: 10 }],
    { silences: [{ start: 1, end: 1.4 }], leadIn: 0, tail: 0, duration: 2 },
  );
  assert.equal(map.ok, true);
  assert.equal(map.timeToIndex(1.2), 6);
});

test('three sentences with two exact pauses', () => {
  const map = buildTimeMap(
    [{ start: 0, end: 5 }, { start: 5, end: 10 }, { start: 10, end: 15 }],
    { silences: [{ start: 1, end: 1.4 }, { start: 2, end: 2.5 }], leadIn: 0, tail: 0, duration: 3 },
  );
  assert.equal(map.ok, true);
  assert.equal(map.timeToIndex(0.5), 2);
  assert.equal(map.timeToIndex(1.2), 5);
  assert.equal(map.timeToIndex(1.7), 7);
  assert.equal(map.timeToIndex(2.2), 10);
  assert.equal(map.timeToIndex(2.7), 12);
});

test('more silences than needed: keep the longest, back in time order', () => {
  const map = buildTimeMap(
    [{ start: 0, end: 5 }, { start: 5, end: 10 }, { start: 10, end: 15 }],
    {
      silences: [
        { start: 1, end: 1.6 },   // 0.6 s, kept
        { start: 2, end: 2.2 },   // 0.2 s, comma pause, dropped
        { start: 2.5, end: 3.3 }, // 0.8 s, kept
      ],
      leadIn: 0, tail: 0, duration: 4,
    },
  );
  assert.equal(map.ok, true);
  assert.equal(map.timeToIndex(1.2), 5);  // inside the kept 1-1.6 pause
  assert.equal(map.timeToIndex(2.1), 7);  // the short pause is not a boundary
  assert.equal(map.timeToIndex(3.0), 10); // inside the kept 2.5-3.3 pause
});

test('too few pauses: ok false with the exact reason and no timeToIndex', () => {
  const map = buildTimeMap(
    [{ start: 0, end: 5 }, { start: 5, end: 10 }, { start: 10, end: 15 }],
    { silences: [{ start: 1, end: 1.4 }], leadIn: 0, tail: 0, duration: 3 },
  );
  assert.equal(map.ok, false);
  assert.equal(map.reason, 'Found 1 pauses, need 2');
  assert.equal(map.timeToIndex, undefined);
});

test('the index holds at the end of the sentence before a pause', () => {
  const map = buildTimeMap(
    [{ start: 0, end: 5 }, { start: 5, end: 10 }],
    { silences: [{ start: 1, end: 1.4 }], leadIn: 0, tail: 0, duration: 2 },
  );
  assert.equal(map.timeToIndex(1), 5);
  assert.equal(map.timeToIndex(1.2), 5);
  assert.equal(map.timeToIndex(1.39), 5);
  assert.equal(map.timeToIndex(1.4), 5);
  assert.equal(map.timeToIndex(1.7), 7);
});

test('monotonic for 200 increasing t values', () => {
  const map = buildTimeMap(
    [{ start: 0, end: 5 }, { start: 5, end: 10 }, { start: 10, end: 15 }],
    { silences: [{ start: 1, end: 1.4 }, { start: 2, end: 2.5 }], leadIn: 0, tail: 0, duration: 3 },
  );
  let previous = -Infinity;
  for (let i = 0; i < 200; i += 1) {
    const t = -0.5 + (i / 199) * 4;
    const index = map.timeToIndex(t);
    assert.ok(index >= previous, `went backward at t=${t}: ${previous} -> ${index}`);
    previous = index;
  }
});

test('clamps before the start and after the end', () => {
  const map = buildTimeMap([{ start: 2, end: 8 }], { silences: [], leadIn: 0.5, tail: 0.5, duration: 2 });
  assert.equal(map.timeToIndex(-5), 2);
  assert.equal(map.timeToIndex(0), 2);
  assert.equal(map.timeToIndex(3), 8);
});

test('weights change the position inside a segment: a heavy character takes more time', () => {
  const sentences = [{ start: 0, end: 7 }];
  const silence = { silences: [], leadIn: 0, tail: 0, duration: 2 };
  const plain = buildTimeMap(sentences, silence);
  const weighted = buildTimeMap(sentences, silence, { weightAt: (i) => (i === 2 ? 8 : 1) });
  const t = 1;
  assert.equal(plain.timeToIndex(t), 3);
  assert.equal(weighted.timeToIndex(t), 2);
  assert.ok(weighted.timeToIndex(t) < plain.timeToIndex(t));
});
