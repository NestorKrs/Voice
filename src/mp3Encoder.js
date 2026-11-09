import { PCM_DEFAULT_RATE, PCM_DEFAULT_CHANNELS } from './audioFormat.js';

const MP3_BLOCK_SAMPLES = 1152;

function toU8(buf) {
  if (!buf || buf.length === 0) return new Uint8Array(0);
  return new Uint8Array(buf);
}

function concatBytes(parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export async function createMp3Encoder(channels, sampleRate = PCM_DEFAULT_RATE, kbps = 128, loadLib = () => import('@breezystack/lamejs')) {
  const lib = await loadLib();
  const Mp3Encoder = lib.Mp3Encoder || (lib.default && lib.default.Mp3Encoder);
  if (!Mp3Encoder) throw new Error('Mp3Encoder not found in the loaded library.');
  const encoder = new Mp3Encoder(channels, sampleRate, kbps);
  return {
    encode(int16Channels) {
      const frames = int16Channels.length > 0 ? int16Channels[0].length : 0;
      const parts = [];
      let offset = 0;
      while (offset < frames) {
        const end = Math.min(offset + MP3_BLOCK_SAMPLES, frames);
        const blocks = [];
        for (let c = 0; c < int16Channels.length; c += 1) blocks.push(int16Channels[c].subarray(offset, end));
        const buf = encoder.encodeBuffer(...blocks);
        if (buf && buf.length > 0) parts.push(toU8(buf));
        offset = end;
      }
      return concatBytes(parts);
    },
    flush() {
      return toU8(encoder.flush());
    },
  };
}

export async function encodeMp3(int16Channels, sampleRate = PCM_DEFAULT_RATE, kbps = 128, loadLib = () => import('@breezystack/lamejs')) {
  const enc = await createMp3Encoder(int16Channels.length, sampleRate, kbps, loadLib);
  return concatBytes([enc.encode(int16Channels), enc.flush()]);
}

export function floatToInt16(float32Array) {
  const out = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i += 1) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    out[i] = Math.round(s < 0 ? s * 0x8000 : s * 0x7fff);
  }
  return out;
}

export function pcmToInt16Channels(bytes, channels = PCM_DEFAULT_CHANNELS) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const frames = Math.floor(u8.byteLength / (2 * channels));
  const out = [];
  for (let c = 0; c < channels; c += 1) out.push(new Int16Array(frames));
  for (let f = 0; f < frames; f += 1) {
    for (let c = 0; c < channels; c += 1) {
      out[c][f] = v.getInt16((f * channels + c) * 2, true);
    }
  }
  return out;
}

export function wavToInt16(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (u8.byteLength < 44) throw new Error('Not a WAV file: shorter than a 44-byte header.');
  const tag = (o) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  if (tag(0) !== 'RIFF') throw new Error('Not a WAV file: missing RIFF.');
  if (tag(8) !== 'WAVE') throw new Error('Not a WAV file: missing WAVE.');
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let fmtOffset = -1;
  let dataOffset = -1;
  let dataSize = 0;
  let channels = 0;
  let sampleRate = 0;
  let bits = 0;
  let o = 12;
  while (o + 8 <= u8.byteLength) {
    const id = tag(o);
    const size = v.getUint32(o + 4, true);
    if (id === 'fmt ') {
      fmtOffset = o + 8;
      const audioFormat = v.getUint16(fmtOffset, true);
      channels = v.getUint16(fmtOffset + 2, true);
      sampleRate = v.getUint32(fmtOffset + 4, true);
      bits = v.getUint16(fmtOffset + 14, true);
      if (audioFormat !== 1) throw new Error('Unsupported WAV: format ' + audioFormat + ' is not PCM.');
    } else if (id === 'data') {
      dataOffset = o + 8;
      dataSize = size;
    }
    o += 8 + size + (size % 2);
  }
  if (fmtOffset < 0) throw new Error('Not a WAV file: missing fmt chunk.');
  if (dataOffset < 0) throw new Error('Not a WAV file: missing data chunk.');
  if (bits !== 16) throw new Error('Unsupported WAV: ' + bits + ' bits per sample, only 16-bit is supported.');
  if (channels < 1) throw new Error('Unsupported WAV: ' + channels + ' channels.');
  const avail = Math.min(dataSize, u8.byteLength - dataOffset);
  const frames = Math.floor(avail / (2 * channels));
  const out = [];
  for (let c = 0; c < channels; c += 1) out.push(new Int16Array(frames));
  for (let f = 0; f < frames; f += 1) {
    for (let c = 0; c < channels; c += 1) {
      out[c][f] = v.getInt16(dataOffset + (f * channels + c) * 2, true);
    }
  }
  return { channels: out, sampleRate };
}
