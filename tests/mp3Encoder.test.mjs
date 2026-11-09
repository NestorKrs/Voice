import test from 'node:test';
import assert from 'node:assert/strict';
import { createMp3Encoder, encodeMp3, floatToInt16, pcmToInt16Channels, wavToInt16 } from '../src/mp3Encoder.js';
import { encodeWav } from '../src/chunkDownload.js';

const calls = [];

class FakeMp3Encoder {
  constructor(channels, sampleRate, kbps) {
    this.channels = channels;
    this.sampleRate = sampleRate;
    this.kbps = kbps;
  }
  encodeBuffer(...blocks) {
    calls.push(blocks.map((b) => b.length));
    return new Uint8Array(blocks[0].length).fill(1);
  }
  flush() {
    return new Uint8Array([7, 7]);
  }
}

function fakeLoadLib() {
  return Promise.resolve({ Mp3Encoder: FakeMp3Encoder });
}

test('createMp3Encoder feeds 1152-sample blocks', async () => {
  calls.length = 0;
  const samples = new Int16Array(3000).fill(1);
  const enc = await createMp3Encoder(1, 44100, 128, fakeLoadLib);
  const out = enc.encode([samples]);
  assert.deepEqual(calls, [[1152], [1152], [696]]);
  assert.equal(out.length, 3000);
});

test('encodeMp3 appends the flush bytes', async () => {
  calls.length = 0;
  const samples = new Int16Array(3000).fill(1);
  const out = await encodeMp3([samples], 44100, 128, fakeLoadLib);
  assert.deepEqual(calls, [[1152], [1152], [696]]);
  assert.equal(out.length, 3002);
  assert.deepEqual([...out.slice(-2)], [7, 7]);
});

test('floatToInt16 clamps above 1 and below -1', () => {
  const out = floatToInt16(new Float32Array([1.5, -1.5, 0.5, -0.5, 0]));
  assert.equal(out[0], 0x7fff);
  assert.equal(out[1], -0x8000);
  assert.equal(out[2], Math.round(0.5 * 0x7fff));
  assert.equal(out[3], Math.round(-0.5 * 0x8000));
  assert.equal(out[4], 0);
});

test('pcmToInt16Channels reads little-endian 16-bit PCM', () => {
  const mono = pcmToInt16Channels(new Uint8Array([0x01, 0x00, 0xff, 0xff]));
  assert.equal(mono.length, 1);
  assert.equal(mono[0][0], 1);
  assert.equal(mono[0][1], -1);
  const stereo = pcmToInt16Channels(new Uint8Array([0x01, 0x00, 0xff, 0xff]), 2);
  assert.equal(stereo.length, 2);
  assert.equal(stereo[0][0], 1);
  assert.equal(stereo[1][0], -1);
});

test('wavToInt16 round-trips with encodeWav', () => {
  const left = new Float32Array([0, 0.5, -0.5, 1]);
  const right = new Float32Array([1, -1, 0.5, -0.5]);
  const wav = encodeWav([left, right], 22050);
  const { channels, sampleRate } = wavToInt16(wav);
  assert.equal(sampleRate, 22050);
  assert.equal(channels.length, 2);
  assert.equal(channels[0].length, 4);
  assert.equal(channels[1].length, 4);
  assert.equal(channels[0][0], 0);
  assert.equal(channels[0][1], Math.trunc(0.5 * 0x7fff));
  assert.equal(channels[1][0], 0x7fff);
});

test('wavToInt16 throws on a non-WAV input', () => {
  assert.throws(() => wavToInt16(new Uint8Array([1, 2, 3, 4])), /Not a WAV file/);
});
