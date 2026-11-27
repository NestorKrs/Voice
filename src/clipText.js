// Maps a sample range of the editor audio back to the words spoken there, so a
// clip row can show the text it starts with. Pure: no DOM, no network, no
// imports. findSilences, alignTimeMap, charWeights and sentenceRanges are
// injected, so the mapper is testable without audio or a page.

export const SNAP_CHARS = 24;
export const MAX_TEXT_CHARS = 300;

const ELLIPSIS = '…';

function isSpace(ch) {
  return typeof ch === 'string' && /\s/.test(ch);
}

// A word boundary is the text edge, or an index with whitespace on one side.
function isWordBoundary(text, index) {
  if (index <= 0 || index >= text.length) return true;
  return isSpace(text[index - 1]) || isSpace(text[index]);
}

// Nearest of the given indices; on a tie the lower index wins.
function nearestIndex(boundaries, index) {
  let best = -1;
  let bestDistance = Infinity;
  for (const boundary of boundaries) {
    const distance = Math.abs(boundary - index);
    if (distance < bestDistance || (distance === bestDistance && boundary < best)) {
      best = boundary;
      bestDistance = distance;
    }
  }
  return best;
}

function sentenceBoundaries(text, ranges) {
  const boundaries = [];
  for (const range of ranges) {
    if (range.start >= 0 && range.start <= text.length) boundaries.push(range.start);
    if (range.end >= 0 && range.end <= text.length) boundaries.push(range.end);
  }
  return boundaries;
}

// A sentence boundary within SNAP_CHARS, otherwise the nearest word boundary.
function snapIndex(text, index, boundaries) {
  const sentence = nearestIndex(boundaries, index);
  if (sentence >= 0 && Math.abs(sentence - index) <= SNAP_CHARS) return sentence;
  for (let distance = 0; distance <= text.length; distance += 1) {
    const lower = index - distance;
    if (lower >= 0 && isWordBoundary(text, lower)) return lower;
    const upper = index + distance;
    if (upper <= text.length && isWordBoundary(text, upper)) return upper;
  }
  return index;
}

function clampIndex(value, length) {
  return Math.min(Math.max(Math.round(value), 0), length);
}

export function createClipTextMapper({ audio, chunkTexts, deps }) {
  const samples = (audio && audio.samples) || null;
  const rate = (audio && audio.sampleRate) || 0;
  const offsets = (audio && audio.offsets) || [];
  const indexes = (audio && audio.indexes) || [];
  const texts = chunkTexts || [];
  const maps = new Map();

  // The fallback when the pause map cannot be built: the position's own length
  // decides which character a second of audio stands for.
  function linearMap(chunkStart, chunkEnd, text) {
    const chunkSeconds = (chunkEnd - chunkStart) / rate;
    return {
      ok: false,
      toIndex: (seconds) => Math.round((seconds / chunkSeconds) * text.length),
    };
  }

  // Built the first time a range needs it, then kept for the mapper's lifetime.
  function mapFor(position, text, chunkStart, chunkEnd) {
    if (maps.has(position)) return maps.get(position);
    const sub = samples.subarray(chunkStart, chunkEnd);
    let map;
    try {
      const silence = deps.findSilences(sub, rate);
      const weights = deps.charWeights(text);
      const result = deps.alignTimeMap(text, silence, { weightAt: (i) => weights[i] });
      map = result && result.ok && typeof result.timeToIndex === 'function'
        ? { ok: true, toIndex: (seconds) => result.timeToIndex(seconds) }
        : linearMap(chunkStart, chunkEnd, text);
    } catch (e) {
      map = linearMap(chunkStart, chunkEnd, text);
    }
    maps.set(position, map);
    return map;
  }

  function textForRange(startSample, endSample) {
    const start = Number(startSample);
    const end = Number(endSample);
    if (!samples || !(end > start)) return { text: '', estimated: false };

    const parts = [];
    let estimated = false;
    for (let position = 0; position < offsets.length; position += 1) {
      const chunkStart = offsets[position];
      const next = offsets[position + 1];
      const chunkEnd = next == null ? samples.length : next;
      if (!(chunkEnd > start && chunkStart < end)) continue;
      const text = texts[indexes[position]];
      if (!text) continue;

      const fromEdge = start <= chunkStart;
      const toEdge = end >= chunkEnd;
      const map = fromEdge && toEdge ? null : mapFor(position, text, chunkStart, chunkEnd);
      let a = fromEdge ? 0 : clampIndex(map.toIndex((start - chunkStart) / rate), text.length);
      let b = toEdge ? text.length : clampIndex(map.toIndex((end - chunkStart) / rate), text.length);
      if (b <= a) continue;

      const boundaries = sentenceBoundaries(text, deps.sentenceRanges(text));
      a = snapIndex(text, a, boundaries);
      b = snapIndex(text, b, boundaries);
      const part = text.slice(a, b).trim();
      if (!part) continue;
      parts.push(part);
      if (map && !map.ok) estimated = true;
    }

    let joined = parts.join(' ').replace(/\s+/g, ' ');
    if (joined.length > MAX_TEXT_CHARS) joined = joined.slice(0, MAX_TEXT_CHARS) + ELLIPSIS;
    return { text: joined, estimated };
  }

  return { textForRange };
}