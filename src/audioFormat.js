export const PCM_DEFAULT_RATE = 44100;
export const PCM_DEFAULT_CHANNELS = 1;

export function pcmToWav(pcm, sampleRate = PCM_DEFAULT_RATE, channels = PCM_DEFAULT_CHANNELS) {
  const len = pcm.byteLength - (pcm.byteLength % (2 * channels));
  const out = new Uint8Array(44 + len);
  const v = new DataView(out.buffer);
  const tag = (o, s) => { for (let i = 0; i < 4; i += 1) out[o + i] = s.charCodeAt(i); };
  tag(0, 'RIFF');
  v.setUint32(4, 36 + len, true);
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
  v.setUint32(40, len, true);
  out.set(pcm.subarray(0, len), 44);
  return out;
}

export function parsePcmFormat(contentType) {
  const ct = String(contentType || '');
  const rate = Number((/rate=(\d+)/i.exec(ct) || [])[1]);
  const ch = Number((/channels=(\d+)/i.exec(ct) || [])[1]);
  return { sampleRate: rate > 0 ? rate : PCM_DEFAULT_RATE, channels: ch > 0 ? ch : PCM_DEFAULT_CHANNELS };
}

export function audioMime(bytes) {
  const b = bytes instanceof ArrayBuffer ? new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength)) : (bytes || []);
  const riff = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46;
  return riff ? 'audio/wav' : 'audio/mpeg';
}
