export const DEFAULT_ORDER = ['text', 'reader', 'job'];
export const ORDER_KEY = 'voice.panelOrder';

export function normalizeOrder(saved) {
  if (!Array.isArray(saved)) return [...DEFAULT_ORDER];
  const seen = new Set();
  const result = [];
  for (const id of saved) {
    if (DEFAULT_ORDER.includes(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  for (const id of DEFAULT_ORDER) {
    if (!seen.has(id)) result.push(id);
  }
  return result;
}

export function movePanel(order, id, targetId, position) {
  const current = normalizeOrder(order);
  if (id === targetId) return current;
  if (!current.includes(id) || !current.includes(targetId)) return current;
  const without = current.filter((x) => x !== id);
  const at = without.indexOf(targetId);
  const insertAt = position === 'after' ? at + 1 : at;
  without.splice(insertAt, 0, id);
  return without;
}

export function stepPanel(order, id, delta) {
  const current = normalizeOrder(order);
  const from = current.indexOf(id);
  if (from === -1) return current;
  const to = Math.min(Math.max(from + delta, 0), current.length - 1);
  if (to === from) return current;
  const next = [...current];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

export function loadOrder(storage) {
  try {
    const raw = storage.getItem(ORDER_KEY);
    if (!raw) return [...DEFAULT_ORDER];
    return normalizeOrder(JSON.parse(raw));
  } catch {
    return [...DEFAULT_ORDER];
  }
}

export function saveOrder(storage, order) {
  try {
    storage.setItem(ORDER_KEY, JSON.stringify(normalizeOrder(order)));
    return true;
  } catch {
    return false;
  }
}

export function resetOrder(storage) {
  try {
    storage.removeItem(ORDER_KEY);
    return true;
  } catch {
    return false;
  }
}
