import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEditorAudio } from '../src/clipEditorLoad.js';

function bytes(values, sampleRate = 44100) {
  return { byteLength: 16, channels: [new Float32Array(values)], sampleRate };
}

function deps(store, overrides = {}) {
  return {
    getBytes: async (index) => store[index] ?? null,
    decode: async (b) => ({ channels: b.channels, sampleRate: b.sampleRate }),
    toMonoFn: (channels) => channels[0],
    ...overrides,
  };
}

test('loadEditorAudio joins all present chunks with samples, offsets and indexes', async () => {
  const result = await loadEditorAudio({
    indexes: [0, 1],
    ...deps({ 0: bytes([1, 2, 3]), 1: bytes([4, 5]) }),
  });
  assert.deepEqual(result.skipped, []);
  assert.equal(result.audio.sampleRate, 44100);
  assert.deepEqual(Array.from(result.audio.samples), [1, 2, 3, 4, 5]);
  assert.deepEqual(result.audio.offsets, [0, 3]);
  assert.deepEqual(result.audio.indexes, [0, 1]);
});

test('loadEditorAudio skips null and empty chunks and lists them', async () => {
  const result = await loadEditorAudio({
    indexes: [0, 1, 2, 3],
    ...deps({ 0: bytes([1, 2]), 1: null, 2: { byteLength: 0 }, 3: bytes([3]) }),
  });
  assert.deepEqual(result.skipped, [1, 2]);
  assert.deepEqual(Array.from(result.audio.samples), [1, 2, 3]);
  assert.deepEqual(result.audio.offsets, [0, 2]);
  assert.deepEqual(result.audio.indexes, [0, 3]);
});

test('loadEditorAudio returns null audio when every chunk is missing', async () => {
  const result = await loadEditorAudio({ indexes: [0, 1, 2], ...deps({}) });
  assert.equal(result.audio, null);
  assert.deepEqual(result.skipped, [0, 1, 2]);
});

test('loadEditorAudio reports a decode error with the chunk number and message', async () => {
  const target = bytes([9]);
  await assert.rejects(
    () => loadEditorAudio({
      indexes: [0, 1, 2],
      ...deps({ 0: bytes([1]), 1: bytes([2]), 2: target }, {
        decode: async (b) => {
          if (b === target) throw new Error('boom');
          return { channels: b.channels, sampleRate: b.sampleRate };
        },
      }),
    }),
    (err) => {
      assert.equal(err.message, 'Chunk 3: boom');
      return true;
    },
  );
});

test('loadEditorAudio uses could not decode when the error has no message', async () => {
  const target = bytes([2]);
  await assert.rejects(
    () => loadEditorAudio({
      indexes: [0, 1],
      ...deps({ 0: bytes([1]), 1: target }, {
        decode: async (b) => {
          if (b === target) throw {};
          return { channels: b.channels, sampleRate: b.sampleRate };
        },
      }),
    }),
    (err) => {
      assert.equal(err.message, 'Chunk 2: could not decode');
      return true;
    },
  );
});

test('loadEditorAudio propagates the concatMono sample-rate message unchanged', async () => {
  await assert.rejects(
    () => loadEditorAudio({
      indexes: [0, 1],
      ...deps({ 0: bytes([1], 44100), 1: bytes([2], 48000) }),
    }),
    (err) => {
      assert.equal(err.message, 'Sample rates differ: chunk 2 is 48000 Hz, expected 44100 Hz.');
      return true;
    },
  );
});

test('loadEditorAudio keeps the given index order', async () => {
  const result = await loadEditorAudio({
    indexes: [2, 0],
    ...deps({ 2: bytes([7, 8]), 0: bytes([1, 2, 3]) }),
  });
  assert.deepEqual(Array.from(result.audio.samples), [7, 8, 1, 2, 3]);
  assert.deepEqual(result.audio.offsets, [0, 2]);
  assert.deepEqual(result.audio.indexes, [2, 0]);
  assert.deepEqual(result.skipped, []);
});

test('loadEditorAudio calls getBytes once per index, in order', async () => {
  const calls = [];
  const store = { 1: bytes([1]), 2: bytes([2]), 3: bytes([3]) };
  await loadEditorAudio({
    indexes: [3, 1, 2],
    ...deps(store, {
      getBytes: async (index) => {
        calls.push(index);
        return store[index] ?? null;
      },
    }),
  });
  assert.deepEqual(calls, [3, 1, 2]);
});

test('loadEditorAudio joins chunks that stay under maxSeconds', async () => {
  const result = await loadEditorAudio({
    indexes: [0, 1],
    maxSeconds: 1,
    ...deps({
      0: bytes(new Array(400).fill(1), 1000),
      1: bytes(new Array(400).fill(1), 1000),
    }),
  });
  assert.equal(result.audio.sampleRate, 1000);
  assert.equal(result.audio.samples.length, 800);
  assert.deepEqual(result.audio.indexes, [0, 1]);
  assert.deepEqual(result.skipped, []);
});

test('loadEditorAudio stops after the chunk that exceeds maxSeconds', async () => {
  const calls = [];
  const store = {
    0: bytes(new Array(600).fill(1), 1000),
    1: bytes(new Array(600).fill(1), 1000),
    2: bytes(new Array(600).fill(1), 1000),
  };
  await assert.rejects(
    () => loadEditorAudio({
      indexes: [0, 1, 2],
      maxSeconds: 1,
      ...deps(store, {
        getBytes: async (index) => {
          calls.push(index);
          return store[index] ?? null;
        },
      }),
    }),
    /Too long to edit in one piece/,
  );
  assert.deepEqual(calls, [0, 1]);
});

test('loadEditorAudio reports the exact length-limit message', async () => {
  await assert.rejects(
    () => loadEditorAudio({
      indexes: [0, 1],
      maxSeconds: 1,
      ...deps({
        0: bytes(new Array(600).fill(1), 1000),
        1: bytes(new Array(600).fill(1), 1000),
      }),
    }),
    (err) => {
      assert.equal(
        err.message,
        'Too long to edit in one piece: about 1 min decoded (limit 0 min). Choose a single chunk in the list above.',
      );
      return true;
    },
  );
});

test('loadEditorAudio does not throw when the length exactly equals maxSeconds', async () => {
  const result = await loadEditorAudio({
    indexes: [0],
    maxSeconds: 1,
    ...deps({ 0: bytes(new Array(1000).fill(1), 1000) }),
  });
  assert.equal(result.audio.samples.length, 1000);
  assert.deepEqual(result.audio.indexes, [0]);
});
