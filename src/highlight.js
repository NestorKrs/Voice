// Picks the word or sentence range that contains charOffset in text.
// The speech endpoint returns raw audio with no timestamps, so the caller
// estimates charOffset from the audio position; this only chooses the range.
export function highlightRange(text, mode, charOffset) {
  if (typeof text !== 'string' || text === '') return { start: 0, end: 0 };
  const offset = Math.max(0, Math.min(text.length, Math.floor(charOffset) || 0));
  if (mode === 'sentences') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
    let current = null;
    for (const { segment, index } of segmenter.segment(text)) {
      if (index > offset) break;
      current = { start: index, end: index + segment.length };
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
