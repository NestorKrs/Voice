// Ducking envelope for mixing a voice track under music. Pure ESM, no imports.

export const DUCK_FRAME_MS = 10;

export const DEFAULT_DUCK = {
  amountDb: -12,
  thresholdDb: -45,
  attackMs: 30,
  releaseMs: 300,
  holdMs: 150,
};

function resolveOptions(options) {
  const o = options || {};
  const pick = (key) => (o[key] === undefined ? DEFAULT_DUCK[key] : o[key]);
  return {
    amountDb: Math.min(0, pick('amountDb')),
    thresholdDb: pick('thresholdDb'),
    attackMs: Math.max(1, pick('attackMs')),
    releaseMs: Math.max(1, pick('releaseMs')),
    holdMs: Math.max(0, pick('holdMs')),
  };
}

export function duckEnvelope(voice, rate, options) {
  const opts = resolveOptions(options);
  const frameSize = Math.max(1, Math.round((rate * DUCK_FRAME_MS) / 1000));
  const frameCount = Math.ceil(voice.length / frameSize);
  const frames = new Float32Array(frameCount);
  if (frameCount === 0) return { frames, frameSize };

  const frameMs = (frameSize / rate) * 1000;
  const holdFrames = Math.ceil(opts.holdMs / frameMs);
  const duckLinear = Math.pow(10, opts.amountDb / 20);
  const attackCoef = Math.exp(-frameMs / opts.attackMs);
  const releaseCoef = Math.exp(-frameMs / opts.releaseMs);

  let lastActive = -1;
  let prev = 1;
  for (let i = 0; i < frameCount; i += 1) {
    const start = i * frameSize;
    const end = Math.min(start + frameSize, voice.length);
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += voice[j] * voice[j];
    const rms = end > start ? Math.sqrt(sum / (end - start)) : 0;
    const loud = rms > 0 && 20 * Math.log10(rms) > opts.thresholdDb;
    if (loud) lastActive = i;
    const active = loud || (lastActive >= 0 && i - lastActive <= holdFrames);
    const target = active ? duckLinear : 1;
    const coef = target < prev ? attackCoef : releaseCoef;
    const gain = target + (prev - target) * coef;
    frames[i] = gain;
    prev = gain;
  }
  return { frames, frameSize };
}

export function gainAtSample(env, sampleIndex) {
  const { frames, frameSize } = env;
  const n = frames.length;
  if (n === 0) return 1;
  const pos = sampleIndex / frameSize - 0.5;
  if (pos <= 0) return frames[0];
  if (pos >= n - 1) return frames[n - 1];
  const k = Math.floor(pos);
  const frac = pos - k;
  return frames[k] * (1 - frac) + frames[k + 1] * frac;
}