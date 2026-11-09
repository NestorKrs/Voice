// Plain-text find helpers. No regex, so characters like ( or . are searched
// literally. Matches are case-insensitive and non-overlapping.

export function findMatches(text, query) {
  if (!query) return [];
  const hay = text.toLowerCase();
  const needle = query.toLowerCase();
  const found = [];
  let from = 0;
  while (from + needle.length <= hay.length) {
    const at = hay.indexOf(needle, from);
    if (at === -1) break;
    found.push(at);
    from = at + needle.length;
  }
  return found;
}

export function nextIndex(current, count, direction) {
  if (count === 0) return -1;
  if (current === -1) return direction === 1 ? 0 : count - 1;
  return (current + direction + count) % count;
}
