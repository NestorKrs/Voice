// Pure slicing and clip-naming helpers for a later clip editor. No imports, no DOM.

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}

export function fadeSamples(ms, rate) {
  return Math.max(0, Math.round(ms * rate / 1000));
}

export function sliceClip(samples, start, end, fadeN) {
  const lo = clamp(start, 0, samples.length);
  const hi = clamp(end, 0, samples.length);
  if (hi <= lo) return new Float32Array(0);

  const out = new Float32Array(hi - lo);
  for (let i = 0; i < out.length; i += 1) out[i] = samples[lo + i];

  const n = fadeN > 0 ? Math.min(fadeN, Math.floor(out.length / 2)) : 0;
  if (n > 0) {
    for (let i = 0; i < n; i += 1) out[i] *= i / n;
    for (let j = 0; j < n; j += 1) out[out.length - 1 - j] *= j / n;
  }
  return out;
}

export function sliceAll(samples, segments, fadeN) {
  return segments.map((segment) => sliceClip(samples, segment.start, segment.end, fadeN));
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
