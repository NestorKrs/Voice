// Pure mono chunk concatenation for a later clip editor. No imports, no DOM.

export function concatMono(parts) {
  if (parts.length === 0) return { samples: new Float32Array(0), sampleRate: 0, offsets: [] };

  const sampleRate = parts[0].sampleRate;
  let total = 0;
  for (const part of parts) total += part.samples.length;

  const samples = new Float32Array(total);
  const offsets = new Array(parts.length);
  let offset = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part.sampleRate !== sampleRate) {
      throw new Error(`Sample rates differ: chunk ${i + 1} is ${part.sampleRate} Hz, expected ${sampleRate} Hz.`);
    }
    offsets[i] = offset;
    samples.set(part.samples, offset);
    offset += part.samples.length;
  }
  return { samples, sampleRate, offsets };
}
