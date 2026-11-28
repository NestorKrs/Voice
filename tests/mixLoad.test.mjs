import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MUSIC_BYTES,
  MAX_MUSIC_SECONDS,
  MUSIC_EXTENSIONS,
  musicFileRejection,
  loadMusicFile,
} from '../src/mixLoad.js';

const RATE = 1000;

function fakeBytes() {
  return new Uint8Array([1, 2, 3, 4]);
}

function channels(length, count = 1, rate = RATE) {
  const list = [];
  for (let c = 0; c < count; c += 1) list.push(new Float32Array(length));
  return { channels: list, sampleRate: rate };
}

test('constants are the agreed numbers', () => {
  assert.equal(MAX_MUSIC_BYTES, 31457280);
  assert.equal(MAX_MUSIC_SECONDS, 300);
  assert.deepEqual(MUSIC_EXTENSIONS, ['.mp3', '.wav', '.m4a', '.ogg']);
});

test('each accepted extension passes in upper and lower case', () => {
  for (const ext of MUSIC_EXTENSIONS) {
    assert.equal(musicFileRejection('song' + ext, 1000), '');
    assert.equal(musicFileRejection('song' + ext.toUpperCase(), 1000), '');
  }
});

test('a .flac, a .mp4 and a name without an extension are rejected with the exact text', () => {
  const base = 'Cannot load song.flac: the mixer accepts .mp3, .wav, .m4a and .ogg audio files.';
  assert.equal(musicFileRejection('song.flac', 1000), base);
  assert.equal(
    musicFileRejection('song.mp4', 1000),
    'Cannot load song.mp4: the mixer accepts .mp3, .wav, .m4a and .ogg audio files.',
  );
  assert.equal(
    musicFileRejection('song', 1000),
    'Cannot load song: the mixer accepts .mp3, .wav, .m4a and .ogg audio files.',
  );
});

test('a 31 MB file is rejected with 31.0 MB', () => {
  assert.equal(
    musicFileRejection('big.wav', 32505856),
    'Cannot load big.wav: it is 31.0 MB and the limit is 30 MB.',
  );
});

test('size 0 is rejected as empty', () => {
  assert.equal(musicFileRejection('empty.wav', 0), 'Cannot load empty.wav: the file is empty.');
});

test('readBytes is not called on any rejection and decode is not called when readBytes rejects', async () => {
  let reads = 0;
  let decodes = 0;
  const readBytes = () => { reads += 1; return fakeBytes(); };
  const decode = () => { decodes += 1; return channels(10); };

  await assert.rejects(() => loadMusicFile({ name: 'x.flac', size: 10, readBytes, decode, rate: RATE }));
  await assert.rejects(() => loadMusicFile({ name: 'x.wav', size: 0, readBytes, decode, rate: RATE }));
  assert.equal(reads, 0);
  assert.equal(decodes, 0);

  const failingRead = () => { reads += 1; throw new Error('read boom'); };
  await assert.rejects(
    () => loadMusicFile({ name: 'x.wav', size: 10, readBytes: failingRead, decode, rate: RATE }),
    /read boom/,
  );
  assert.equal(decodes, 0);
});

test('a decode throw is wrapped with the original message', async () => {
  await assert.rejects(
    () => loadMusicFile({
      name: 'x.wav',
      size: 10,
      readBytes: fakeBytes,
      decode: () => { throw new Error('bad data'); },
      rate: RATE,
    }),
    /Could not decode x\.wav: bad data/,
  );
});

test('a decode throw without a message gives unknown error', async () => {
  await assert.rejects(
    () => loadMusicFile({
      name: 'x.wav',
      size: 10,
      readBytes: fakeBytes,
      decode: () => { throw {}; },
      rate: RATE,
    }),
    /Could not decode x\.wav: unknown error/,
  );
});

test('empty channels and a zero-length channel are rejected', async () => {
  await assert.rejects(
    () => loadMusicFile({ name: 'x.wav', size: 10, readBytes: fakeBytes, decode: () => ({ channels: [], sampleRate: RATE }), rate: RATE }),
    /Cannot load x\.wav: it contains no audio\./,
  );
  await assert.rejects(
    () => loadMusicFile({ name: 'x.wav', size: 10, readBytes: fakeBytes, decode: () => channels(0), rate: RATE }),
    /Cannot load x\.wav: it contains no audio\./,
  );
});

test('a rate mismatch gives the exact message', async () => {
  await assert.rejects(
    () => loadMusicFile({ name: 'x.wav', size: 10, readBytes: fakeBytes, decode: () => channels(10, 1, 44100), rate: RATE }),
    /Cannot load x\.wav: it was decoded at 44100 Hz but the voice is 1000 Hz\./,
  );
});

test('a 301 second fake is rejected with 5:01 and a 300 second one passes', async () => {
  await assert.rejects(
    () => loadMusicFile({ name: 'x.wav', size: 10, readBytes: fakeBytes, decode: () => channels(301 * RATE), rate: RATE }),
    /Cannot load x\.wav: it is 5:01 long and the limit is 5:00\./,
  );
  const ok = await loadMusicFile({ name: 'x.wav', size: 10, readBytes: fakeBytes, decode: () => channels(300 * RATE), rate: RATE });
  assert.equal(ok.seconds, 300);
});

test('three decoded channels return two', async () => {
  const out = await loadMusicFile({
    name: 'x.wav',
    size: 10,
    readBytes: fakeBytes,
    decode: () => channels(100, 3),
    rate: RATE,
  });
  assert.equal(out.channels.length, 2);
});

test('seconds is length / rate', async () => {
  const out = await loadMusicFile({
    name: 'x.wav',
    size: 10,
    readBytes: fakeBytes,
    decode: () => channels(2500),
    rate: RATE,
  });
  assert.equal(out.seconds, 2.5);
  assert.equal(out.sampleRate, RATE);
  assert.equal(out.name, 'x.wav');
});

test('inputs are not modified', async () => {
  const bytes = fakeBytes();
  const bytesCopy = bytes.slice();
  const decoded = channels(100, 2);
  const leftCopy = decoded.channels[0].slice();
  const rightCopy = decoded.channels[1].slice();
  await loadMusicFile({ name: 'x.wav', size: bytes.length, readBytes: () => bytes, decode: () => decoded, rate: RATE });
  assert.deepEqual(Array.from(bytes), Array.from(bytesCopy));
  assert.deepEqual(Array.from(decoded.channels[0]), Array.from(leftCopy));
  assert.deepEqual(Array.from(decoded.channels[1]), Array.from(rightCopy));
});