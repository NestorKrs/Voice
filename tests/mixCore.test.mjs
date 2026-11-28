import test from 'node:test';
import assert from 'node:assert/strict';
import { mixDown } from '../src/mixCore.js';

const RATE = 10;
const EPS = 1e-6;

function run(voice, music, options) {
  return mixDown({ voice: new Float32Array(voice), music, rate: RATE, options });
}

function music(channels) {
  return { channels: channels.map((c) => new Float32Array(c)) };
}

function maxAbs(channels) {
  let m = 0;
  for (const ch of channels) for (const v of ch) m = Math.max(m, Math.abs(v));
  return m;
}

function assertArray(actual, expected, eps = EPS) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < expected.length; i += 1) {
    assert.ok(Math.abs(actual[i] - expected[i]) < eps, `index ${i}: ${actual[i]} vs ${expected[i]}`);
  }
}

test('voice only with gain 0.5 gives both channels equal to voice * 0.5', () => {
  const out = run([0.4, 0.2, 0.6], null, { voiceGain: 0.5 });
  assertArray(out.channels[0], [0.2, 0.1, 0.3]);
  assertArray(out.channels[1], [0.2, 0.1, 0.3]);
  assert.equal(out.scaled, false);
});

test('mono music added at gain 1 with no offset', () => {
  const out = run([0, 0, 0, 0], music([[0.5, 0.5, 0.5, 0.5]]), {});
  assertArray(out.channels[0], [0.5, 0.5, 0.5, 0.5]);
  assertArray(out.channels[1], [0.5, 0.5, 0.5, 0.5]);
});

test('stereo music keeps its sides', () => {
  const out = run([0, 0], music([[0.1, 0.2], [0.3, 0.4]]), {});
  assertArray(out.channels[0], [0.1, 0.2]);
  assertArray(out.channels[1], [0.3, 0.4]);
});

test('positive offset 3 delays the music by 3 samples', () => {
  const out = run([0, 0, 0, 0, 0, 0], music([[0.5, 0.5, 0.5]]), { musicStartSamples: 3 });
  assertArray(out.channels[0], [0, 0, 0, 0.5, 0.5, 0.5]);
});

test('negative offset -2 skips the first 2 music samples', () => {
  const out = run([0, 0, 0, 0], music([[0.1, 0.2, 0.3, 0.4]]), { musicStartSamples: -2 });
  assertArray(out.channels[0], [0.3, 0.4, 0, 0]);
});

test('music shorter than voice without loop is silent after its end', () => {
  const out = run([0, 0, 0, 0, 0, 0], music([[0.5, 0.5]]), {});
  assertArray(out.channels[0], [0.5, 0.5, 0, 0, 0, 0]);
});

test('with loop the music wraps (two wraps)', () => {
  const out = run([0, 0, 0, 0, 0, 0], music([[0.5, 0.25]]), { loop: true });
  assertArray(out.channels[0], [0.5, 0.25, 0.5, 0.25, 0.5, 0.25]);
});

test('fadeIn of 4 samples ramps (i - audibleStart + 1) / 4', () => {
  const out = run([0, 0, 0, 0, 0], music([[1, 1, 1, 1, 1]]), { fadeInSamples: 4, limit: false });
  assertArray(out.channels[0], [0.25, 0.5, 0.75, 1, 1]);
});

test('fadeOut of 4 ramps (n - i) / 4 at the last samples', () => {
  const out = run([0, 0, 0, 0], music([[1, 1, 1, 1]]), { fadeOutSamples: 4, limit: false });
  assertArray(out.channels[0], [1, 0.75, 0.5, 0.25]);
});

test('fadeIn starts at the audible start when offset is positive', () => {
  const out = run([0, 0, 0, 0, 0, 0], music([[0.5, 0.5, 0.5, 0.5, 0.5, 0.5]]), {
    musicStartSamples: 2,
    fadeInSamples: 4,
  });
  assertArray(out.channels[0], [0, 0, 0.125, 0.25, 0.375, 0.5]);
});

test('duck: loud first half pushes the music well down, quiet half lets it back', () => {
  const voice = new Float32Array(1000);
  voice.fill(0.5, 0, 500);
  const musicChannels = [new Float32Array(1000).fill(0.5)];
  const out = mixDown({
    voice,
    music: { channels: musicChannels },
    rate: 1000,
    options: { voiceGain: 0, duck: true, duckOptions: { attackMs: 1, releaseMs: 1 }, limit: false },
  });
  const loud = out.channels[0][250];
  const quiet = out.channels[0][750];
  assert.ok(loud < 0.25, `loud ${loud} not below 0.25`);
  assert.ok(quiet > 0.45, `quiet ${quiet} not above 0.45`);
});

test('duck false leaves the music untouched', () => {
  const out = run([0.5, 0.5], music([[0.5, 0.5]]), { duck: false, limit: false });
  assertArray(out.channels[0], [1, 1]);
});

test('limit: 0.8 + 0.8 peaks at 1.6, scaled to 0.99', () => {
  const out = run([0.8, 0.8, 0.8, 0.8], music([[0.8, 0.8, 0.8, 0.8]]), {});
  assert.ok(Math.abs(out.peak - 1.6) < EPS, `peak ${out.peak}`);
  assert.equal(out.scaled, true);
  assert.ok(Math.abs(maxAbs(out.channels) - 0.99) < EPS);
});

test('limit false leaves 1.6', () => {
  const out = run([0.8, 0.8], music([[0.8, 0.8]]), { limit: false });
  assert.ok(Math.abs(out.peak - 1.6) < EPS, `peak ${out.peak}`);
  assert.equal(out.scaled, false);
  assert.ok(Math.abs(maxAbs(out.channels) - 1.6) < EPS);
});

test('no music copies the voice to both channels', () => {
  const out = run([0.1, 0.2], null, { voiceGain: 1 });
  assertArray(out.channels[0], [0.1, 0.2]);
  assertArray(out.channels[1], [0.1, 0.2]);
});

test('empty voice returns two empty arrays, peak 0, scaled false', () => {
  const out = run([], music([[0.5]]), {});
  assert.equal(out.channels[0].length, 0);
  assert.equal(out.channels[1].length, 0);
  assert.equal(out.peak, 0);
  assert.equal(out.scaled, false);
});

test('musicLength 0 is treated as no music', () => {
  const out = run([0.1, 0.2], music([[]]), {});
  assertArray(out.channels[0], [0.1, 0.2]);
});

test('three-channel music uses only the first two', () => {
  const out = run([0, 0], music([[0.1, 0.2], [0.3, 0.4], [0.9, 0.9]]), {});
  assertArray(out.channels[0], [0.1, 0.2]);
  assertArray(out.channels[1], [0.3, 0.4]);
});

test('mismatching channel lengths do not throw', () => {
  const out = run([0, 0, 0], music([[0.5, 0.5, 0.5], [0.25]]), {});
  assertArray(out.channels[0], [0.5, 0.5, 0.5]);
  assertArray(out.channels[1], [0.25, 0, 0]);
});

test('inputs are not mutated', () => {
  const voice = new Float32Array([0.4, 0.2]);
  const left = new Float32Array([0.5, 0.5]);
  const right = new Float32Array([0.1, 0.1]);
  const voiceCopy = voice.slice();
  const leftCopy = left.slice();
  const rightCopy = right.slice();
  mixDown({ voice, music: { channels: [left, right] }, rate: RATE, options: { voiceGain: 0.5 } });
  assert.deepEqual(Array.from(voice), Array.from(voiceCopy));
  assert.deepEqual(Array.from(left), Array.from(leftCopy));
  assert.deepEqual(Array.from(right), Array.from(rightCopy));
});