// Pure per-clip name alignment for the clip editor. No imports, no DOM.
// Names are keyed by the clip's start marker, so a cut added before a named
// clip leaves that name on the clip that moved right.

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
