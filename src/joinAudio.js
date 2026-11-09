export function stripId3(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (u8.length < 10) return bytes;
  if (u8[0] !== 0x49 || u8[1] !== 0x44 || u8[2] !== 0x33) return bytes;
  const size = ((u8[6] & 0x7f) << 21) | ((u8[7] & 0x7f) << 14) | ((u8[8] & 0x7f) << 7) | (u8[9] & 0x7f);
  const total = 10 + size + ((u8[5] & 0x10) !== 0 ? 10 : 0);
  return u8.slice(total);
}

export function wavHeader(dataBytes, channels, sampleRate) {
  const out = new Uint8Array(44);
  const v = new DataView(out.buffer);
  const tag = (o, s) => { for (let i = 0; i < 4; i += 1) out[o + i] = s.charCodeAt(i); };
  tag(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  tag(36, 'data');
  v.setUint32(40, dataBytes, true);
  return out;
}

export function wavParts(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (u8.length < 44) throw new Error('Not a WAV file: shorter than a 44-byte header.');
  const tag = (o) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Not a WAV file: missing RIFF/WAVE.');
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  return { sampleRate: v.getUint32(24, true), channels: v.getUint16(22, true), data: u8.subarray(44) };
}

export function joinMode(firstKind, format) {
  if (format === 'wav') return 'wav-stream';
  if (format === 'mp3') return firstKind === 'mp3' ? 'mp3-concat' : 'mp3-encode';
  throw new Error('Unsupported download format: ' + format);
}

export function sameAs(first, current, chunkNumber) {
  if (first.kind !== current.kind) throw new Error(`Chunk ${chunkNumber} differs from chunk 1: kind ${current.kind} vs ${first.kind}.`);
  if (first.kind === 'mp3') return;
  if (first.sampleRate !== current.sampleRate) throw new Error(`Chunk ${chunkNumber} differs from chunk 1: sample rate ${current.sampleRate} vs ${first.sampleRate}.`);
  if (first.channels !== current.channels) throw new Error(`Chunk ${chunkNumber} differs from chunk 1: channels ${current.channels} vs ${first.channels}.`);
}
