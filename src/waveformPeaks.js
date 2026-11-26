// Pure waveform peak pyramid for a later clip editor. No imports, no DOM.

export function toMono(channels) {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];
  const length = channels[0].length;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (const channel of channels) sum += channel[i];
    out[i] = sum / channels.length;
  }
  return out;
}

export function buildPeaks(samples, baseBlock = 64) {
  const total = samples.length;
  const levels = [];
  if (total === 0) return { total, baseBlock, levels };

  const blockCount = Math.ceil(total / baseBlock);
  let mins = new Float32Array(blockCount);
  let maxes = new Float32Array(blockCount);
  for (let b = 0; b < blockCount; b += 1) {
    const from = b * baseBlock;
    const to = Math.min(from + baseBlock, total);
    let min = samples[from];
    let max = samples[from];
    for (let i = from + 1; i < to; i += 1) {
      const value = samples[i];
      if (value < min) min = value;
      if (value > max) max = value;
    }
    mins[b] = min;
    maxes[b] = max;
  }
  levels.push({ mins, maxes });

  while (mins.length > 1) {
    const nextCount = Math.ceil(mins.length / 2);
    const nextMins = new Float32Array(nextCount);
    const nextMaxes = new Float32Array(nextCount);
    for (let b = 0; b < nextCount; b += 1) {
      const first = b * 2;
      const second = first + 1;
      nextMins[b] = second < mins.length ? Math.min(mins[first], mins[second]) : mins[first];
      nextMaxes[b] = second < maxes.length ? Math.max(maxes[first], maxes[second]) : maxes[first];
    }
    mins = nextMins;
    maxes = nextMaxes;
    levels.push({ mins, maxes });
  }
  return { total, baseBlock, levels };
}

function columnBounds(from, span, width, column) {
  let start = from + Math.floor((column * span) / width);
  let end = from + Math.floor(((column + 1) * span) / width);
  if (end <= start) end = start + 1;
  return [start, end];
}

export function peaksForRange(peaks, samples, start, end, width) {
  const w = Math.max(0, Math.floor(width));
  const min = new Float32Array(w);
  const max = new Float32Array(w);
  const total = peaks.total;
  const from = Math.max(0, Math.min(total, Math.floor(start)));
  const to = Math.max(0, Math.min(total, Math.floor(end)));
  const span = to - from;
  if (span <= 0 || w === 0) return { min, max };

  const samplesPerPixel = span / w;
  if (samplesPerPixel < peaks.baseBlock) {
    for (let c = 0; c < w; c += 1) {
      const [columnStart, columnEnd] = columnBounds(from, span, w, c);
      let low = samples[columnStart];
      let high = samples[columnStart];
      for (let i = columnStart + 1; i < columnEnd; i += 1) {
        const value = samples[i];
        if (value < low) low = value;
        if (value > high) high = value;
      }
      min[c] = low;
      max[c] = high;
    }
    return { min, max };
  }

  let level = 0;
  for (let l = 1; l < peaks.levels.length; l += 1) {
    if (peaks.baseBlock * 2 ** l > samplesPerPixel) break;
    level = l;
  }
  const { mins, maxes } = peaks.levels[level];
  const blockSize = peaks.baseBlock * 2 ** level;

  for (let c = 0; c < w; c += 1) {
    const [columnStart, columnEnd] = columnBounds(from, span, w, c);
    let low = Infinity;
    let high = -Infinity;
    const leftEnd = columnStart % blockSize === 0
      ? columnStart
      : Math.min(Math.floor(columnStart / blockSize) * blockSize + blockSize, columnEnd);
    for (let i = columnStart; i < leftEnd; i += 1) {
      const value = samples[i];
      if (value < low) low = value;
      if (value > high) high = value;
    }
    const firstBlock = Math.ceil(columnStart / blockSize);
    const lastBlock = Math.floor(columnEnd / blockSize);
    for (let b = firstBlock; b < lastBlock && b < mins.length; b += 1) {
      if (mins[b] < low) low = mins[b];
      if (maxes[b] > high) high = maxes[b];
    }
    const rightStart = lastBlock * blockSize;
    for (let i = Math.max(rightStart, columnStart); i < columnEnd; i += 1) {
      const value = samples[i];
      if (value < low) low = value;
      if (value > high) high = value;
    }
    min[c] = low;
    max[c] = high;
  }
  return { min, max };
}
