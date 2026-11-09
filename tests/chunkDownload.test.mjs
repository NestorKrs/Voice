import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkFileName, audioKind, toWavBytes, encodeWav } from '../src/chunkDownload.js';

test('chunkFileName pads to at least 3 digits', () => {
  assert.equal(chunkFileName(0, 9, 'mp3'), 'voice-chunk-001-of-009.mp3');
  assert.equal(chunkFileName(8, 9, 'mp3'), 'voice-chunk-009-of-009.mp3');
  assert.equal(chunkFileName(11, 75, 'mp3'), 'voice-chunk-012-of-075.mp3');
  assert.equal(chunkFileName(74, 75, 'wav'), 'voice-chunk-075-of-075.wav');
  assert.equal(chunkFileName(0, 1200, 'mp3'), 'voice-chunk-0001-of-1200.mp3');
  assert.equal(chunkFileName(1199, 1200, 'mp3'), 'voice-chunk-1200-of-1200.mp3');
});

test('encodeWav writes a correct 44-byte header and length', () => {
  const mono = new Float32Array([0, 0.5, -0.5, 1]);
  const out = encodeWav([mono], 44100);
  assert.equal(out.byteLength, 44 + 4 * 2);
  const v = new DataView(out.buffer);
  const tag = (o) => String.fromCharCode(out[o], out[o + 1], out[o + 2], out[o + 3]);
  assert.equal(tag(0), 'RIFF');
  assert.equal(v.getUint32(4, true), 36 + 8);
  assert.equal(tag(8), 'WAVE');
  assert.equal(tag(12), 'fmt ');
  assert.equal(v.getUint32(16, true), 16);
  assert.equal(v.getUint16(20, true), 1);
  assert.equal(v.getUint16(22, true), 1);
  assert.equal(v.getUint32(24, true), 44100);
  assert.equal(v.getUint32(28, true), 44100 * 1 * 2);
  assert.equal(v.getUint16(32, true), 2);
  assert.equal(v.getUint16(34, true), 16);
  assert.equal(tag(36), 'data');
  assert.equal(v.getUint32(40, true), 8);
});

test('encodeWav interleaves stereo channels', () => {
  const left = new Float32Array([1, 0]);
  const right = new Float32Array([0, 1]);
  const out = encodeWav([left, right], 22050);
  assert.equal(out.byteLength, 44 + 2 * 2 * 2);
  const v = new DataView(out.buffer);
  assert.equal(v.getUint16(22, true), 2);
  assert.equal(v.getUint32(24, true), 22050);
  assert.equal(v.getUint32(28, true), 22050 * 2 * 2);
  assert.equal(v.getUint16(32, true), 4);
  assert.equal(v.getUint32(40, true), 8);
  assert.equal(v.getInt16(44, true), 0x7fff);
  assert.equal(v.getInt16(46, true), 0);
  assert.equal(v.getInt16(48, true), 0);
  assert.equal(v.getInt16(50, true), 0x7fff);
});

test('encodeWav clamps values above 1 and below -1', () => {
  const data = new Float32Array([2, -2]);
  const out = encodeWav([data], 8000);
  const v = new DataView(out.buffer);
  assert.equal(v.getInt16(44, true), 0x7fff);
  assert.equal(v.getInt16(46, true), -0x8000);
});

test('toWavBytes returns wav bytes unchanged', () => {
  const wav = encodeWav([new Float32Array([0, 1])], 8000);
  assert.equal(toWavBytes(wav, 'wav'), wav);
});

test('toWavBytes wraps pcm in a valid wav', () => {
  const pcm = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
  const out = toWavBytes(pcm, 'pcm');
  assert.equal(out.byteLength, 44 + 8);
  assert.equal(String.fromCharCode(out[0], out[1], out[2], out[3]), 'RIFF');
  assert.equal(String.fromCharCode(out[8], out[9], out[10], out[11]), 'WAVE');
});

test('toWavBytes returns null for mp3', () => {
  assert.equal(toWavBytes(new Uint8Array([0xff, 0xfb, 0, 0]), 'mp3'), null);
});

test('audioKind on small fake mp3/wav/pcm byte arrays', () => {
  const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
  const mp3id3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0]);
  const mp3sync = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0, 0, 0, 0]);
  const pcm = new Uint8Array([0, 0, 1, 0, 0xff, 0x7f, 0, 0]);
  assert.equal(audioKind(wav), 'wav');
  assert.equal(audioKind(mp3id3), 'mp3');
  assert.equal(audioKind(mp3sync), 'mp3');
  assert.equal(audioKind(pcm), 'pcm');
});

import { convertChunk } from '../src/chunkDownload.js';

const fakeMp3Bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
const fakePcmBytes = new Uint8Array([0, 0, 1, 0]);
const fakeWavBytes = encodeWav([new Float32Array([0, 1])], 8000);

test('convertChunk mp3 to mp3 is unchanged', async () => {
  const deps = {
    decode: async () => { throw new Error('should not decode'); },
    encodeMp3: async () => { throw new Error('should not encode'); },
  };
  const out = await convertChunk(fakeMp3Bytes, 'mp3', deps);
  assert.equal(out.ext, 'mp3');
  assert.equal(out.bytes, fakeMp3Bytes);
});

test('convertChunk pcm to mp3 calls the encoder once', async () => {
  let calls = 0;
  let rate = 0;
  const deps = {
    decode: async () => { throw new Error('should not decode'); },
    encodeMp3: async (channels, sampleRate) => { calls += 1; rate = sampleRate; return new Uint8Array([1, 2, 3]); },
  };
  const out = await convertChunk(fakePcmBytes, 'mp3', deps);
  assert.equal(out.ext, 'mp3');
  assert.equal(calls, 1);
  assert.equal(rate, 44100);
  assert.deepEqual([...out.bytes], [1, 2, 3]);
});

test('convertChunk mp3 to wav calls decode', async () => {
  let decoded = 0;
  const deps = {
    decode: async () => { decoded += 1; return { channels: [new Float32Array([0, 1])], sampleRate: 8000 }; },
    encodeMp3: async () => { throw new Error('should not encode'); },
  };
  const out = await convertChunk(fakeMp3Bytes, 'wav', deps);
  assert.equal(out.ext, 'wav');
  assert.equal(decoded, 1);
  assert.equal(out.bytes.byteLength, 44 + 4);
});

test('convertChunk wav to wav is unchanged', async () => {
  const deps = {
    decode: async () => { throw new Error('should not decode'); },
    encodeMp3: async () => { throw new Error('should not encode'); },
  };
  const out = await convertChunk(fakeWavBytes, 'wav', deps);
  assert.equal(out.ext, 'wav');
  assert.equal(out.bytes, fakeWavBytes);
});

test('convertChunk surfaces a throwing decode message', async () => {
  const deps = {
    decode: async () => { throw new Error('decode boom'); },
    encodeMp3: async () => { throw new Error('should not encode'); },
  };
  await assert.rejects(() => convertChunk(fakeMp3Bytes, 'wav', deps), /decode boom/);
});
