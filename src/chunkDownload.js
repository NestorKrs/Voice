import { audioMime, pcmToWav } from './audioFormat.js';

export function chunkFileName(index, total, ext) {
  const width = Math.max(3, String(total).length);
  const n = String(index + 1).padStart(width, '0');
  return `voice-chunk-${n}-of-${String(total).padStart(width, '0')}.${ext}`;
}

// Raw PCM has no header at all, so anything that is not a WAV container and does
// not start with an MP3 frame sync or ID3 tag is treated as raw sample bytes.
function hasMp3Header(bytes) {
  if (!bytes || bytes.byteLength < 2) return false;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
}

export function audioKind(bytes) {
  if (audioMime(bytes) === 'audio/wav') return 'wav';
  const b = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  return hasMp3Header(b) ? 'mp3' : 'pcm';
}

export function toWavBytes(bytes, kind) {
  if (kind === 'wav') return bytes;
  if (kind === 'pcm') return pcmToWav(bytes);
  return null;
}

export function encodeWav(float32Channels, sampleRate) {
  const channels = float32Channels.length;
  const frames = channels > 0 ? float32Channels[0].length : 0;
  const dataBytes = frames * channels * 2;
  const out = new Uint8Array(44 + dataBytes);
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
  let o = 44;
  for (let f = 0; f < frames; f += 1) {
    for (let c = 0; c < channels; c += 1) {
      const s = Math.max(-1, Math.min(1, float32Channels[c][f]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return out;
}
