// Visual-only ordering of clip rows by their stable segment index. Reordering
// this list never touches cuts, audio or export order.

export function reorderIds(ids, from, to) {
  const fromPos = ids.indexOf(from);
  const toPos = ids.indexOf(to);
  if (fromPos < 0 || toPos < 0 || fromPos === toPos) return ids;
  const next = ids.slice();
  next.splice(fromPos, 1);
  const insertAt = next.indexOf(to) + (fromPos < toPos ? 1 : 0);
  next.splice(insertAt, 0, from);
  return next;
}
