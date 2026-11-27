import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clipFileNames,
  buildClipFiles,
  buildCutListFile,
  buildZipEntries,
} from '../src/clipExport.js';

function countingEncode(calls) {
  return async (mono, rate, format) => {
    calls.push({ length: mono.length, rate, format });
    const bytes = new Uint8Array(1);
    bytes[0] = mono.length % 256;
    return bytes;
  };
}

function makeArgs(overrides = {}) {
  return {
    samples: new Float32Array([
      1, 1, 1, 1,
      2, 2, 2, 2,
      3, 3, 3, 3,
    ]),
    rate: 1000,
    segments: [
      { start: 8, end: 12 },
      { start: 0, end: 4 },
      { start: 4, end: 8 },
    ],
    names: [],
    format: 'wav',
    fadeMs: 0,
    encode: countingEncode([]),
    ...overrides,
  };
}

test('clipFileNames pads and truncates names to the clip count', () => {
  assert.deepEqual(clipFileNames(['A'], 3, 'wav'), ['A.wav', 'clip-002.wav', 'clip-003.wav']);
  assert.deepEqual(clipFileNames(['A', 'B', 'C', 'D'], 2, 'mp3'), ['A.mp3', 'B.mp3']);
  assert.deepEqual(clipFileNames(['Intro', 'intro', ''], 3, 'wav'), [
    'Intro.wav', 'intro-2.wav', 'clip-003.wav',
  ]);
});

test('three segments produce three files named clip-001.wav in order', async () => {
  const calls = [];
  const { files, skipped } = await buildClipFiles(makeArgs({ encode: countingEncode(calls) }));
  assert.deepEqual(files.map((file) => file.name), [
    'clip-001.wav', 'clip-002.wav', 'clip-003.wav',
  ]);
  assert.deepEqual(files.map((file) => file.bytes[0]), [4, 4, 4]);
  assert.deepEqual(files.map((file) => [file.start, file.end]), [
    [8, 12], [0, 4], [4, 8],
  ]);
  assert.deepEqual(calls.map((call) => call.length), [4, 4, 4]);
  assert.deepEqual(calls.map((call) => call.rate), [1000, 1000, 1000]);
  assert.deepEqual(calls.map((call) => call.format), ['wav', 'wav', 'wav']);
  assert.deepEqual(skipped, []);
});

test('custom and duplicate names give unique file names', async () => {
  const names = ['Intro', 'intro', ''];
  const { files } = await buildClipFiles(makeArgs({ names, encode: countingEncode([]) }));
  assert.deepEqual(files.map((file) => file.name), [
    'Intro.wav', 'intro-2.wav', 'clip-003.wav',
  ]);
});

test('format is passed through to encode', async () => {
  const calls = [];
  const { files } = await buildClipFiles(makeArgs({ format: 'mp3', encode: countingEncode(calls) }));
  assert.deepEqual(calls.map((call) => call.format), ['mp3', 'mp3', 'mp3']);
  assert.deepEqual(files.map((file) => file.name), [
    'clip-001.mp3', 'clip-002.mp3', 'clip-003.mp3',
  ]);
});

test('fadeMs fades the first sample and zero or missing fadeMs does not', async () => {
  const firstSamples = [];
  const recordFirst = async (mono) => {
    firstSamples.push(mono[0]);
    return new Uint8Array([mono.length % 256]);
  };
  const args = makeArgs({
    samples: new Float32Array(8).fill(1),
    segments: [{ start: 0, end: 8 }],
    names: ['A'],
    encode: recordFirst,
  });
  await buildClipFiles({ ...args, fadeMs: 10 });
  await buildClipFiles({ ...args, fadeMs: 0 });
  await buildClipFiles({ ...args });
  assert.deepEqual(firstSamples, [0, 1, 1]);
});

test('zero-length segments are skipped with their 1-based number', async () => {
  const calls = [];
  const segments = [
    { start: 0, end: 4 },
    { start: 4, end: 4 },
    { start: 4, end: 8 },
  ];
  const { files, skipped } = await buildClipFiles(
    makeArgs({ segments, names: ['A', 'B', 'C'], encode: countingEncode(calls) }),
  );
  assert.deepEqual(skipped, [2]);
  assert.deepEqual(files.map((file) => file.name), ['A.wav', 'C.wav']);
  assert.equal(calls.length, 2);
});

test('an encode failure names the clip and stops later encodes', async () => {
  const attempts = [];
  const encode = async (mono) => {
    attempts.push(mono.length);
    if (attempts.length === 2) throw new Error('boom');
    return new Uint8Array([mono.length % 256]);
  };
  await assert.rejects(
    buildClipFiles(makeArgs({ encode })),
    /^Error: Clip 2: boom$/,
  );
  assert.equal(attempts.length, 2);

  await assert.rejects(
    buildClipFiles(makeArgs({ encode: async () => { throw new Error(''); } })),
    /^Error: Clip 1: could not encode$/,
  );
});

test('encode calls are awaited one at a time in segment order', async () => {
  const finished = [];
  const encode = async (mono) => {
    const value = mono[0];
    await new Promise((resolve) => setTimeout(resolve, value === 1 ? 8 : value === 2 ? 2 : 4));
    finished.push(value);
    return new Uint8Array([mono.length % 256]);
  };
  await buildClipFiles(makeArgs({ encode }));
  assert.deepEqual(finished, [3, 1, 2]);
});

test('cut list names match the file base names without the extension', async () => {
  const names = ['Intro', 'intro', ''];
  const { files } = await buildClipFiles(makeArgs({ names, encode: countingEncode([]) }));
  const cutList = buildCutListFile(makeArgs({ names }));
  assert.equal(cutList.name, 'cut-list.csv');
  assert.ok(cutList.bytes instanceof Uint8Array);
  const lines = new TextDecoder().decode(cutList.bytes).split('\r\n');
  assert.equal(lines[0], 'name,start_ms,end_ms,duration_ms,start_time,end_time');
  assert.deepEqual(lines.slice(1, 4).map((line) => line.split(',')[0]), [
    'Intro', 'intro-2', 'clip-003',
  ]);
  assert.deepEqual(files.map((file) => file.name.replace(/\.wav$/, '')), [
    'Intro', 'intro-2', 'clip-003',
  ]);
  assert.match(lines[1], /^Intro,8\.000,12\.000,4\.000/);
});

test('zip entries end with cut-list.csv and report skipped clips', async () => {
  const segments = [
    { start: 0, end: 4 },
    { start: 4, end: 4 },
    { start: 4, end: 8 },
  ];
  const { entries, skipped } = await buildZipEntries(
    makeArgs({ segments, names: ['A', 'B', 'C'] }),
  );
  assert.deepEqual(skipped, [2]);
  assert.deepEqual(entries.map((entry) => entry.name), ['A.wav', 'C.wav', 'cut-list.csv']);
  assert.deepEqual(Object.keys(entries[0]), ['name', 'bytes']);
  assert.ok(entries.every((entry) => entry.bytes instanceof Uint8Array));
});

test('buildZipEntries does not modify its inputs', async () => {
  const samples = new Float32Array([1, 2, 3, 4]);
  const segments = [{ start: 2, end: 4 }, { start: 0, end: 2 }];
  const names = ['A', 'a', 'b'];
  const sampleCopy = Array.from(samples);
  const segmentsCopy = JSON.parse(JSON.stringify(segments));
  const namesCopy = [...names];
  await buildZipEntries(makeArgs({ samples, segments, names }));
  assert.deepEqual(Array.from(samples), sampleCopy);
  assert.deepEqual(segments, segmentsCopy);
  assert.deepEqual(names, namesCopy);
});

function captureMono(captured) {
  return async (mono) => {
    captured.push(Array.from(mono));
    return new Uint8Array([mono.length % 256]);
  };
}

function threeClipArgs(overrides = {}) {
  return makeArgs({
    samples: new Float32Array(12).fill(1),
    segments: [
      { start: 0, end: 4 },
      { start: 4, end: 8 },
      { start: 8, end: 12 },
    ],
    names: ['A', 'B', 'C'],
    fadeMs: 2,
    ...overrides,
  });
}

test('buildClipFiles with fadeIn only fades the start of every clip', async () => {
  const seen = [];
  await buildClipFiles(threeClipArgs({ fadeIn: true, encode: captureMono(seen) }));
  assert.deepEqual(seen, [
    [0, 0.5, 1, 1],
    [0, 0.5, 1, 1],
    [0, 0.5, 1, 1],
  ]);
});

test('buildClipFiles with fadeOut only fades the end of every clip', async () => {
  const seen = [];
  await buildClipFiles(threeClipArgs({ fadeOut: true, encode: captureMono(seen) }));
  assert.deepEqual(seen, [
    [1, 1, 0.5, 0],
    [1, 1, 0.5, 0],
    [1, 1, 0.5, 0],
  ]);
});

test('buildClipFiles with fadeClips [1] fades only the second clip', async () => {
  const seen = [];
  await buildClipFiles(threeClipArgs({
    fadeIn: true, fadeOut: false, fadeClips: [1], encode: captureMono(seen),
  }));
  assert.deepEqual(seen, [
    [1, 1, 1, 1],
    [0, 0.5, 1, 1],
    [1, 1, 1, 1],
  ]);
});

test('buildClipFiles with an empty fadeClips fades no clip', async () => {
  const seen = [];
  await buildClipFiles(threeClipArgs({
    fadeIn: true, fadeOut: true, fadeClips: [], encode: captureMono(seen),
  }));
  assert.deepEqual(seen, [
    [1, 1, 1, 1],
    [1, 1, 1, 1],
    [1, 1, 1, 1],
  ]);
});

test('buildClipFiles with fadeClips null or undefined fades all clips', async () => {
  const seen = [];
  await buildClipFiles(threeClipArgs({
    fadeIn: true, fadeClips: null, encode: captureMono(seen),
  }));
  await buildClipFiles(threeClipArgs({
    fadeIn: true, fadeClips: undefined, encode: captureMono(seen),
  }));
  assert.deepEqual(seen, [
    [0, 0.5, 1, 1], [0, 0.5, 1, 1], [0, 0.5, 1, 1],
    [0, 0.5, 1, 1], [0, 0.5, 1, 1], [0, 0.5, 1, 1],
  ]);
});

test('buildClipFiles legacy fadeMs alone still fades both ends of every clip', async () => {
  const seen = [];
  await buildClipFiles(threeClipArgs({ encode: captureMono(seen) }));
  assert.deepEqual(seen, [
    [0, 0.5, 0.5, 0],
    [0, 0.5, 0.5, 0],
    [0, 0.5, 0.5, 0],
  ]);
});

test('buildZipEntries forwards the new fade arguments', async () => {
  const encode = async (mono) => new Uint8Array([mono[0]]);
  const { entries, skipped } = await buildZipEntries(threeClipArgs({
    fadeIn: true, fadeOut: false, fadeClips: [1], encode,
  }));
  assert.deepEqual(entries.slice(0, 3).map((entry) => entry.bytes[0]), [1, 0, 1]);
  assert.equal(entries[3].name, 'cut-list.csv');
  assert.deepEqual(skipped, []);
});

test('buildClipFiles with new fade arguments does not modify its inputs', async () => {
  const samples = new Float32Array(12).fill(1);
  const segments = [
    { start: 0, end: 4 },
    { start: 4, end: 8 },
    { start: 8, end: 12 },
  ];
  const names = ['A', 'B', 'C'];
  const fadeClips = [1];
  const sourceCopy = Array.from(samples);
  const segmentsCopy = JSON.parse(JSON.stringify(segments));
  const namesCopy = [...names];
  const fadeClipsCopy = [...fadeClips];
  await buildClipFiles(threeClipArgs({
    samples, segments, names, fadeClips, fadeIn: true,
  }));
  assert.deepEqual(Array.from(samples), sourceCopy);
  assert.deepEqual(segments, segmentsCopy);
  assert.deepEqual(names, namesCopy);
  assert.deepEqual(fadeClips, fadeClipsCopy);
});
