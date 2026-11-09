import test from 'node:test';
import assert from 'node:assert/strict';
import { stripId3, wavHeader, wavParts, joinMode, sameAs } from '../src/joinAudio.js';

test('stripId3 removes a tag of 257 bytes', () => {
  const bytes = new Uint8Array(10 + 257 + 3);
  bytes[0] = 0x49; bytes[1] = 0x44; bytes[2] = 0x33;
  bytes[5] = 0;
  bytes[6] = 0; bytes[7] = 0; bytes[8] = 2; bytes[9] = 1;
  bytes[bytes.length - 3] = 1;
  bytes[bytes.length - 2] = 2;
  bytes[bytes.length - 1] = 3;
  const out = stripId3(bytes);
  assert.equal(out.length, 3);
  assert.deepEqual([...out], [1, 2, 3]);
});

test('stripId3 keeps 10 more bytes when the footer flag is set', () => {
  const bytes = new Uint8Array(10 + 257 + 10 + 3);
  bytes[0] = 0x49; bytes[1] = 0x44; bytes[2] = 0x33;
  bytes[5] = 0x10;
  bytes[6] = 0; bytes[7] = 0; bytes[8] = 2; bytes[9] = 1;
  bytes[bytes.length - 3] = 1;
  bytes[bytes.length - 2] = 2;
  bytes[bytes.length - 1] = 3;
  const out = stripId3(bytes);
  assert.equal(out.length, 3);
  assert.deepEqual([...out], [1, 2, 3]);
});

test('stripId3 returns bytes without a tag unchanged', () => {
  const bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
  assert.equal(stripId3(bytes), bytes);
});

test('stripId3 returns bytes shorter than 10 unchanged', () => {
  const bytes = new Uint8Array([0x49, 0x44, 0x33]);
  assert.equal(stripId3(bytes), bytes);
});

test('wavHeader writes the canonical 44-byte header', () => {
  const out = wavHeader(8, 2, 22050);
  assert.equal(out.length, 44);
  const v = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const tag = (o) => String.fromCharCode(out[o], out[o + 1], out[o + 2], out[o + 3]);
  assert.equal(tag(0), 'RIFF');
  assert.equal(v.getUint32(4, true), 36 + 8);
  assert.equal(tag(8), 'WAVE');
  assert.equal(tag(12), 'fmt ');
  assert.equal(v.getUint32(16, true), 16);
  assert.equal(v.getUint16(20, true), 1);
  assert.equal(v.getUint16(22, true), 2);
  assert.equal(v.getUint32(24, true), 22050);
  assert.equal(v.getUint32(28, true), 22050 * 2 * 2);
  assert.equal(v.getUint16(32, true), 4);
  assert.equal(v.getUint16(34, true), 16);
  assert.equal(tag(36), 'data');
  assert.equal(v.getUint32(40, true), 8);
});

test('wavParts round-trips with wavHeader', () => {
  const data = new Uint8Array([1, 2, 3, 4]);
  const wav = new Uint8Array([...wavHeader(data.length, 1, 8000), ...data]);
  const parts = wavParts(wav);
  assert.equal(parts.sampleRate, 8000);
  assert.equal(parts.channels, 1);
  assert.deepEqual([...parts.data], [1, 2, 3, 4]);
});

test('wavParts throws on a non-WAV input', () => {
  assert.throws(() => wavParts(new Uint8Array([1, 2, 3, 4])), /Not a WAV file/);
});

test('joinMode picks the right mode', () => {
  assert.equal(joinMode('mp3', 'mp3'), 'mp3-concat');
  assert.equal(joinMode('wav', 'mp3'), 'mp3-encode');
  assert.equal(joinMode('pcm', 'mp3'), 'mp3-encode');
  assert.equal(joinMode('mp3', 'wav'), 'wav-stream');
  assert.equal(joinMode('wav', 'wav'), 'wav-stream');
});

test('sameAs passes for equal infos', () => {
  sameAs({ kind: 'wav', sampleRate: 44100, channels: 1 }, { kind: 'wav', sampleRate: 44100, channels: 1 }, 2);
  sameAs({ kind: 'mp3', sampleRate: null, channels: null }, { kind: 'mp3', sampleRate: null, channels: null }, 2);
});

test('sameAs throws naming Chunk 3 for a different sample rate', () => {
  const first = { kind: 'wav', sampleRate: 44100, channels: 1 };
  assert.throws(() => sameAs(first, { kind: 'wav', sampleRate: 22050, channels: 1 }, 3), /Chunk 3 differs from chunk 1/);
});

test('sameAs throws for a different kind', () => {
  const first = { kind: 'wav', sampleRate: 44100, channels: 1 };
  assert.throws(() => sameAs(first, { kind: 'pcm', sampleRate: 44100, channels: 1 }, 2), /Chunk 2 differs from chunk 1/);
});

test('sameAs throws for different channels', () => {
  const first = { kind: 'wav', sampleRate: 44100, channels: 1 };
  assert.throws(() => sameAs(first, { kind: 'wav', sampleRate: 44100, channels: 2 }, 4), /Chunk 4 differs from chunk 1/);
});
