// Pure per-clip name alignment for the clip editor. No imports, no DOM.
// Names are keyed by the clip's start marker, so a cut added before a named
// clip leaves that name on the clip that moved right.

export function firstSentence(text, maxChars = 90) {
  if (typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed === '') return '';
  let sentence = trimmed;
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const first = [...new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(trimmed)][0];
    if (first) sentence = first.segment.trim();
  } else {
    const match = trimmed.match(/^[\s\S]*?[.!?](?=\s|$)/);
    if (match) sentence = match[0].trim();
  }
  return sentence.length > maxChars ? sentence.slice(0, maxChars - 1).trimEnd() + '…' : sentence;
}

export function realignNames(names, oldMarkers, newMarkers) {
  const nameAt = (index) => (typeof names[index] === 'string' ? names[index] : '');
  if (oldMarkers.length === newMarkers.length) {
    return Array.from({ length: newMarkers.length + 1 }, (_, index) => nameAt(index));
  }
  const oldStarts = [0, ...oldMarkers];
  return [0, ...newMarkers].map((start) => {
    const index = oldStarts.indexOf(start);
    return index === -1 ? '' : nameAt(index);
  });
}
