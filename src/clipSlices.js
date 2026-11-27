// Pure slicing and clip-naming helpers for a later clip editor. No imports, no DOM.

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}

export function fadeSamples(ms, rate) {
  return Math.max(0, Math.round(ms * rate / 1000));
}

function fadeAmount(fade, end, half) {
  if (typeof fade === 'number') return fade > 0 ? Math.min(fade, half) : 0;
  if (fade && typeof fade === 'object') {
    const value = fade[end];
    return Number.isInteger(value) && value >= 0 ? Math.min(value, half) : 0;
  }
  return 0;
}

export function sliceClip(samples, start, end, fade) {
  const lo = clamp(start, 0, samples.length);
  const hi = clamp(end, 0, samples.length);
  if (hi <= lo) return new Float32Array(0);

  const out = new Float32Array(hi - lo);
  for (let i = 0; i < out.length; i += 1) out[i] = samples[lo + i];

  const half = Math.floor(out.length / 2);
  const inN = fadeAmount(fade, 'inN', half);
  const outN = fadeAmount(fade, 'outN', half);
  if (inN > 0) {
    for (let i = 0; i < inN; i += 1) out[i] *= i / inN;
  }
  if (outN > 0) {
    for (let j = 0; j < outN; j += 1) out[out.length - 1 - j] *= j / outN;
  }
  return out;
}

export function sliceAll(samples, segments, fade) {
  const fadeFor = typeof fade === 'function' ? fade : () => fade;
  return segments.map((segment, index) => sliceClip(
    samples, segment.start, segment.end, fadeFor(index),
  ));
}

export function defaultClipName(i) {
  return 'clip-' + String(i + 1).padStart(3, '0');
}

export function safeBaseName(name, fallback) {
  const text = String(name)
    .replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, '')
    .trim()
    .replace(/\.+$/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 60);
  return text === '' ? fallback : text;
}

export function uniqueNames(names) {
  const used = new Set();
  return names.map((name, index) => {
    const base = safeBaseName(name, defaultClipName(index));
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate.toLowerCase())) {
      candidate = base + '-' + suffix;
      suffix += 1;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

export function nameFromText(text, maxWords = 6, maxChars = 50) {
  if (typeof text !== 'string') return '';
  const words = text
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}-]+/gu, ''))
    .filter((word) => word !== '');
  let result = words.slice(0, maxWords).join('-');
  if (result.length > maxChars) {
    const cut = result.lastIndexOf('-', maxChars);
    result = cut === -1 ? result.slice(0, maxChars) : result.slice(0, cut);
  }
  return result.replace(/^-+|-+$/g, '');
}
