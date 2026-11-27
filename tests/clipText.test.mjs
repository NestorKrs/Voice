import test from 'node:test';
import assert from 'node:assert/strict';
import { createClipTextMapper, SNAP_CHARS, MAX_TEXT_CHARS } from '../src/clipText.js';
import { findSilences } from '../src/silenceMap.js';
import { alignTimeMap } from '../src/alignMap.js';
import { charWeights, sentenceRanges } from '../src/highlight.js';

// 20 characters, so the fake sentence ranges [0, 10) and [10, 20) are the two
// halves: 'First one.' and 'Second one'.
const TEXT = 'First one.Second one';
const RATE = 1000;

function makeAudio(offsets, indexes, length) {
  return { samples: new Float32Array(length), sampleRate: RATE, offsets, indexes };
}

// One shared fake set: `calls` records what the mapper asked the deps for.
function makeDeps(overrides = {}) {
  const calls = { align: 0, silenceLengths: [] };
  const deps = {
    findSilences: (samples) => {
      calls.silenceLengths.push(samples.length);
      return { silences: [], leadIn: 0, tail: 0, duration: 1 };
    },
    alignTimeMap: () => {
      calls.align += 1;
      return { ok: true, timeToIndex: (t) => Math.round(t * 10) };
    },
    charWeights: (text) => new Array(text.length).fill(1),
    sentenceRanges: () => [{ start: 0, end: 10 }, { start: 10, end: 20 }],
    ...overrides,
  };
  return { deps, calls };
}

function makeMapper(audio, chunkTexts, overrides) {
  const { deps, calls } = makeDeps(overrides);
  return { mapper: createClipTextMapper({ audio, chunkTexts, deps }), calls };
}

test('a range covering the whole position gives the whole text', () => {
  assert.equal(SNAP_CHARS, 24);
  const { mapper } = makeMapper(makeAudio([0, 2000], [0], 2000), [TEXT]);
  assert.deepEqual(mapper.textForRange(0, 2000), { text: TEXT, estimated: false });
});

test('the first half gives the first sentence and the second half the second', () => {
  const { mapper } = makeMapper(makeAudio([0, 2000], [0], 2000), [TEXT]);
  assert.deepEqual(mapper.textForRange(0, 1000), { text: 'First one.', estimated: false });
  assert.deepEqual(mapper.textForRange(1000, 2000), { text: 'Second one', estimated: false });
});

test('a boundary 3 characters from a sentence boundary snaps to it', () => {
  const { mapper } = makeMapper(makeAudio([0, 2000], [0], 2000), [TEXT]);
  // Without snapping this would read 'First one. S'; index 13 is 3 from 10.
  assert.deepEqual(mapper.textForRange(0, 1300), { text: 'First one.', estimated: false });
});

test('a boundary 15 characters from every sentence boundary snaps to a word boundary', () => {
  const long = 'First one. Second one is a longer sentence used for the word snap test.';
  const audio = makeAudio([0, 8000], [0], 8000);
  const { mapper } = makeMapper(audio, [long], {
    sentenceRanges: () => [{ start: 0, end: 10 }, { start: 10, end: long.length }],
  });
  // Index 37 is 27 from the boundary at 10 and 34 from the one at 71, so the
  // word search runs and lands on the start of 'sentence' at 34.
  assert.deepEqual(mapper.textForRange(3700, 8000), {
    text: 'sentence used for the word snap test.',
    estimated: false,
  });
});

test('a range spanning two positions joins both parts with one space', () => {
  const audio = makeAudio([0, 2000, 4000], [0, 1], 4000);
  const { mapper } = makeMapper(audio, ['First one.', 'Second one'], {
    sentenceRanges: (text) => [{ start: 0, end: text.length }],
  });
  assert.deepEqual(mapper.textForRange(0, 4000), {
    text: 'First one. Second one',
    estimated: false,
  });
});

test('a failing alignTimeMap falls back to the linear map and is estimated', () => {
  const audio = makeAudio([0, 2000], [0], 2000);
  const { mapper } = makeMapper(audio, [TEXT], { alignTimeMap: () => ({ ok: false }) });
  assert.deepEqual(mapper.textForRange(0, 1000), { text: 'First one.', estimated: true });
  // A range that exactly covers the position infers nothing, so it stays exact.
  assert.deepEqual(mapper.textForRange(0, 2000), { text: TEXT, estimated: false });
});

test('a dependency that throws is handled and the range is estimated', () => {
  const audio = makeAudio([0, 2000], [0], 2000);
  const { mapper } = makeMapper(audio, [TEXT], {
    findSilences: () => {
      throw new Error('boom');
    },
  });
  assert.deepEqual(mapper.textForRange(0, 1000), { text: 'First one.', estimated: true });
});

test('the map is built once per position over three calls', () => {
  const audio = makeAudio([0, 2000], [0], 2000);
  const { mapper, calls } = makeMapper(audio, [TEXT]);
  mapper.textForRange(0, 1000);
  mapper.textForRange(0, 1000);
  mapper.textForRange(0, 1000);
  assert.equal(calls.align, 1);
  assert.equal(calls.silenceLengths.length, 1);
});

test('findSilences receives exactly the chunk samples', () => {
  const audio = makeAudio([0, 2000], [0], 2000);
  const { mapper, calls } = makeMapper(audio, [TEXT]);
  mapper.textForRange(0, 1000);
  assert.deepEqual(calls.silenceLengths, [2000]);
});

test('text over 300 characters is cut and gets an ellipsis', () => {
  const big = 'word '.repeat(80);
  const audio = makeAudio([0, big.length], [0], big.length);
  const { mapper } = makeMapper(audio, [big], {
    sentenceRanges: (text) => [{ start: 0, end: text.length }],
  });
  const result = mapper.textForRange(0, big.length);
  assert.equal(result.text.length, MAX_TEXT_CHARS + 1);
  assert.ok(result.text.endsWith('…'));
  assert.equal(result.text.slice(0, MAX_TEXT_CHARS), big.slice(0, MAX_TEXT_CHARS));
});

test('end <= start and a missing chunk text give an empty result', () => {
  const audio = makeAudio([0, 2000], [0], 2000);
  const { mapper } = makeMapper(audio, [TEXT]);
  assert.deepEqual(mapper.textForRange(1000, 1000), { text: '', estimated: false });
  assert.deepEqual(mapper.textForRange(2000, 1000), { text: '', estimated: false });
  const empty = makeMapper(audio, ['']);
  assert.deepEqual(empty.mapper.textForRange(500, 1500), { text: '', estimated: false });
  const missing = makeMapper(audio, []);
  assert.deepEqual(missing.mapper.textForRange(500, 1500), { text: '', estimated: false });
});

test('the audio and the chunk texts are not modified', () => {
  const audio = makeAudio([0, 2000], [0], 2000);
  const chunkTexts = [TEXT];
  const before = {
    samples: Array.from(audio.samples),
    offsets: [...audio.offsets],
    indexes: [...audio.indexes],
    chunkTexts: [...chunkTexts],
  };
  const { mapper } = makeMapper(audio, chunkTexts);
  mapper.textForRange(0, 1000);
  mapper.textForRange(0, 2000);
  assert.deepEqual({
    samples: Array.from(audio.samples),
    offsets: [...audio.offsets],
    indexes: [...audio.indexes],
    chunkTexts: [...chunkTexts],
  }, before);
});

test('the real modules map the first and the last second to their sentences', () => {
  const text = 'One two three. Four five six.';
  const samples = new Float32Array(2500);
  samples.fill(0.5, 0, 1000);
  samples.fill(0, 1000, 1500);
  samples.fill(0.5, 1500, 2500);
  const audio = { samples, sampleRate: RATE, offsets: [0], indexes: [0] };
  const mapper = createClipTextMapper({
    audio,
    chunkTexts: [text],
    deps: { findSilences, alignTimeMap, charWeights, sentenceRanges },
  });
  assert.deepEqual(mapper.textForRange(0, 1000), { text: 'One two three.', estimated: false });
  assert.deepEqual(mapper.textForRange(1500, 2500), { text: 'Four five six.', estimated: false });
});