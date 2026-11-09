// The sentence splitting rule, shared by highlightRange and sentenceRanges.
function splitSentences(text) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
  const ranges = [];
  for (const { segment, index } of segmenter.segment(text)) ranges.push({ start: index, end: index + segment.length });
  return ranges;
}

export function sentenceRanges(text) {
  if (typeof text !== 'string' || text === '') return [];
  return splitSentences(text);
}

// Picks the word or sentence range that contains charOffset in text.
// The speech endpoint returns raw audio with no timestamps, so the caller
// estimates charOffset from the audio position; this only chooses the range.
export function highlightRange(text, mode, charOffset) {
  if (typeof text !== 'string' || text === '') return { start: 0, end: 0 };
  const offset = Math.max(0, Math.min(text.length, Math.floor(charOffset) || 0));
  if (mode === 'sentences') {
    let current = null;
    for (const range of splitSentences(text)) {
      if (range.start > offset) break;
      current = range;
    }
    return current || { start: 0, end: text.length };
  }
  const re = /\S+/g;
  let m;
  let current = null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > offset) break;
    current = { start: m.index, end: m.index + m[0].length };
  }
  if (current) return current;
  const first = text.match(/\S+/);
  return first ? { start: first.index, end: first.index + first[0].length } : { start: 0, end: text.length };
}

// Per-character weights: a full stop or newline costs more than a letter, so
// the highlight spends more time on pauses and less on plain text.
function charWeight(ch) {
  switch (ch) {
    case ',': case ';': case ':': return 4;
    case '.': case '!': case '?': return 8;
    case '\n': return 6;
    default: return /\s/.test(ch) ? 0.3 : 1;
  }
}

export function charWeights(text) {
  const weights = [];
  for (let i = 0; i < text.length; i++) weights.push(charWeight(text[i]));
  return weights;
}

// Index of the character at `fraction` of the weighted text. `text` is the
// chunk, or a precomputed weight array from charWeights (App.jsx memoizes it
// once per chunk so the per-frame lookup does not rebuild it).
export function charAtFraction(text, fraction) {
  const weights = typeof text === 'string' ? charWeights(text) : text;
  if (!weights || weights.length === 0) return 0;
  const f = Math.min(1, Math.max(0, fraction));
  let total = 0;
  for (const w of weights) total += w;
  const target = f * total;
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (sum >= target) return i;
  }
  return weights.length - 1;
}
