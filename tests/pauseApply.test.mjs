import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPauses, mapPausesToSpoken } from '../src/pauseApply.js';
import { findSilences } from '../src/silenceMap.js';
import { alignTimeMap } from '../src/alignMap.js';
import { charWeights } from '../src/highlight.js';

const RATE = 1000;

function baseSamples() {
  const s = new Float32Array(2400);
  for (let i = 0; i < 1000; i += 1) s[i] = 0.5;
  for (let i = 1000; i < 1400; i += 1) s[i] = 0;
  for (let i = 1400; i < 2400; i += 1) s[i] = 0.5;
  return s;
}

const BASE_ALIGN = { ok: true, pairs: [{ offset: 4, start: 1.0, end: 1.4 }], indexToTime: (i) => (i / 9) * 2.4 };

function longestZeroRun(arr) {
  let best = 0;
  let run = 0;
  for (let i = 0; i < arr.length; i += 1) {
    if (arr[i] === 0) { run += 1; if (run > best) best = run; } else run = 0;
  }
  return best;
}

test('aligned pause inserts its seconds at the pair midpoint', () => {
  const src = baseSamples();
  const res = applyPauses({ samples: src, rate: RATE, text: 'One. Two.', pauses: [{ index: 5, seconds: 1.2 }], align: BASE_ALIGN, fineSilences: null });
  assert.equal(res.samples.length, 3600);
  assert.deepEqual(res.samples.slice(0, 1200), src.slice(0, 1200));
  for (let i = 1200; i < 2400; i += 1) assert.equal(res.samples[i], 0);
  assert.deepEqual(res.samples.slice(2400), src.slice(1200));
  assert.equal(res.report[0].status, 'aligned');
  assert.equal(res.report[0].atSec, 1.2);
  assert.equal(res.report[0].number, 1);
  assert.equal(res.addedSec, 1.2);
});

test('a pause at the end appends zeros', () => {
  const src = baseSamples();
  const res = applyPauses({ samples: src, rate: RATE, text: 'One. Two.', pauses: [{ index: 9, seconds: 0.5 }], align: BASE_ALIGN });
  assert.equal(res.samples.length, 2900);
  assert.equal(res.report[0].status, 'end');
  assert.equal(res.report[0].atSec, 2.4);
  for (let i = 2400; i < 2900; i += 1) assert.equal(res.samples[i], 0);
});

test('a pause at the start prepends zeros', () => {
  const src = baseSamples();
  const res = applyPauses({ samples: src, rate: RATE, text: 'One. Two.', pauses: [{ index: 0, seconds: 0.5 }], align: BASE_ALIGN });
  assert.equal(res.samples.length, 2900);
  assert.equal(res.report[0].status, 'start');
  assert.equal(res.report[0].atSec, 0);
  for (let i = 0; i < 500; i += 1) assert.equal(res.samples[i], 0);
  assert.deepEqual(res.samples.slice(500), src);
});

test('two pauses on the same pair add together', () => {
  const src = baseSamples();
  const res = applyPauses({ samples: src, rate: RATE, text: 'One. Two.', pauses: [{ index: 4, seconds: 0.5 }, { index: 5, seconds: 0.5 }], align: BASE_ALIGN });
  assert.equal(res.samples.length, 3400);
  assert.equal(res.report[0].status, 'aligned');
  assert.equal(res.report[1].status, 'aligned');
  for (let i = 1200; i < 2200; i += 1) assert.equal(res.samples[i], 0);
});

test('a mid-sentence pause snaps to a near quiet gap', () => {
  const src = baseSamples();
  const align = { ok: true, pairs: [], indexToTime: (i) => (i / 19) * 2.4 };
  const res = applyPauses({ samples: src, rate: RATE, text: 'One two three four.', pauses: [{ index: 10, seconds: 0.5 }], align, fineSilences: { silences: [{ start: 1.2, end: 1.4 }] } });
  assert.equal(res.report[0].status, 'snapped');
  assert.equal(res.report[0].atSec, 1.3);
  assert.equal(res.report[0].distSec, 0);
  assert.equal(res.samples.length, 2900);
});

test('a gap farther than 0.3 s is skipped with the exact reason', () => {
  const src = baseSamples();
  const align = { ok: true, pairs: [], indexToTime: (i) => (i / 19) * 2.4 };
  const res = applyPauses({ samples: src, rate: RATE, text: 'One two three four.', pauses: [{ index: 10, seconds: 0.5 }], align, fineSilences: { silences: [{ start: 2.0, end: 2.2 }] } });
  assert.equal(res.report[0].status, 'skipped');
  assert.equal(res.report[0].reason, 'No quiet spot within 0.3 s of the marker.');
  assert.equal(res.samples.length, 2400);
  assert.deepEqual(res.samples, src);
});

test('align null uses the linear estimate', () => {
  const src = baseSamples();
  const res = applyPauses({ samples: src, rate: RATE, text: 'One two three four.', pauses: [{ index: 10, seconds: 0.5 }], align: null, fineSilences: { silences: [{ start: 1.2, end: 1.4 }] } });
  assert.equal(res.report[0].status, 'snapped');
  assert.equal(res.report[0].atSec, 1.3);
});

test('fineSilences null skips with the reason', () => {
  const src = baseSamples();
  const res = applyPauses({ samples: src, rate: RATE, text: 'One two three four.', pauses: [{ index: 10, seconds: 0.5 }], align: { ok: true, pairs: [], indexToTime: (i) => (i / 19) * 2.4 }, fineSilences: null });
  assert.equal(res.report[0].status, 'skipped');
  assert.equal(res.report[0].reason, 'No quiet spot within 0.3 s of the marker.');
});

test('invalid seconds are skipped with the exact reason', () => {
  const src = baseSamples();
  for (const bad of [0, -1, NaN]) {
    const res = applyPauses({ samples: src, rate: RATE, text: 'One. Two.', pauses: [{ index: 5, seconds: bad }], align: BASE_ALIGN });
    assert.equal(res.report[0].status, 'skipped');
    assert.equal(res.report[0].reason, 'Invalid pause length.');
    assert.equal(res.samples.length, 2400);
  }
});

test('seconds 0.0004 rounds to 0 samples but is reported aligned', () => {
  const src = baseSamples();
  const res = applyPauses({ samples: src, rate: RATE, text: 'One. Two.', pauses: [{ index: 5, seconds: 0.0004 }], align: BASE_ALIGN });
  assert.equal(res.report[0].status, 'aligned');
  assert.equal(res.samples.length, 2400);
  assert.deepEqual(res.samples, src);
});

test('report order, numbers and addedSec', () => {
  const src = baseSamples();
  const res = applyPauses({ samples: src, rate: RATE, text: 'One. Two.', pauses: [{ index: 5, seconds: 0.5 }, { index: 9, seconds: 0.25 }], align: BASE_ALIGN });
  assert.deepEqual(res.report.map((r) => r.number), [1, 2]);
  assert.equal(res.report[0].status, 'aligned');
  assert.equal(res.report[1].status, 'end');
  assert.equal(res.addedSec, 0.75);
});

test('samples is a new array and the input is not modified', () => {
  const src = baseSamples();
  const copy = src.slice();
  const res = applyPauses({ samples: src, rate: RATE, text: 'One. Two.', pauses: [{ index: 5, seconds: 0.5 }], align: BASE_ALIGN });
  assert.notEqual(res.samples, src);
  assert.deepEqual(src, copy);
});

test('empty samples with a pause at the end returns only zeros', () => {
  const res = applyPauses({ samples: new Float32Array(0), rate: RATE, text: 'Hi', pauses: [{ index: 2, seconds: 0.5 }], align: null });
  assert.equal(res.samples.length, 500);
  assert.equal(longestZeroRun(res.samples), 500);
});

test('mapPausesToSpoken maps clean indexes to the spoken text', () => {
  const clean = '[slowly] Hello. [carefully] World.';
  const r = mapPausesToSpoken(clean, [{ index: 16, seconds: 1 }, { index: clean.length, seconds: 2 }, { index: 0, seconds: 3 }]);
  assert.equal(r.text, 'Hello. World.');
  assert.equal(r.pauses[0].index, 7);
  assert.equal(r.pauses[1].index, r.text.length);
  assert.equal(r.pauses[2].index, 0);
  assert.deepEqual(r.pauses.map((p) => p.seconds), [1, 2, 3]);
});

test('integration: real findSilences, alignTimeMap and charWeights align the pause', () => {
  const rate = 1000;
  const samples = new Float32Array(2500);
  for (let i = 0; i < 1000; i += 1) samples[i] = 0.5;
  for (let i = 1500; i < 2500; i += 1) samples[i] = 0.5;
  const text = 'One two three. Four five six.';
  const fine = findSilences(samples, rate, { minSilence: 0.03 });
  const weights = charWeights(text);
  const align = alignTimeMap(text, fine, { weightAt: (i) => weights[i] });
  const res = applyPauses({ samples, rate, text, pauses: [{ index: 14, seconds: 1 }], align, fineSilences: fine });
  assert.equal(res.report[0].status, 'aligned');
  assert.equal(res.samples.length, 3500);
  assert.ok(longestZeroRun(res.samples) >= 1400, 'silent run ' + longestZeroRun(res.samples));
});