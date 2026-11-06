export const SIDE_MIN_PX = 220;
export const SIDE_MAX_PCT = 30;
export const MID_MIN_PX = 280;
export const MID_MAX_PCT = 60;
export const DEFAULT_WIDTHS = { left: 25, right: 25 };
export const WIDTHS_KEY = 'voice.panelWidths';

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export function middlePct(w) {
  return 100 - w.left - w.right;
}

export function usableWidth(clientWidth, padding = 12, handle = 12) {
  return Math.max(0, clientWidth - 2 * padding - 2 * handle);
}

export function limitsFor(usablePx) {
  if (!Number.isFinite(usablePx) || usablePx <= 0) return null;
  const sideMin = (SIDE_MIN_PX / usablePx) * 100;
  const midMin = (MID_MIN_PX / usablePx) * 100;
  if (sideMin > SIDE_MAX_PCT) return null;
  if (2 * sideMin + midMin > 100) return null;
  return { sideMin, sideMax: SIDE_MAX_PCT, midMin, midMax: MID_MAX_PCT };
}

function distribute(need, roomA, roomB) {
  let a = Math.min(roomA, need / 2);
  const b = Math.min(roomB, need - a);
  a = Math.min(roomA, need - b);
  return [a, b];
}

export function clampWidths(w, usablePx) {
  const lim = limitsFor(usablePx);
  if (!lim) return { ...DEFAULT_WIDTHS };
  const rawLeft = Number.isFinite(w && w.left) ? w.left : DEFAULT_WIDTHS.left;
  const rawRight = Number.isFinite(w && w.right) ? w.right : DEFAULT_WIDTHS.right;
  let left = clamp(rawLeft, lim.sideMin, lim.sideMax);
  let right = clamp(rawRight, lim.sideMin, lim.sideMax);
  const sumMin = 100 - lim.midMax;
  const sumMax = 100 - lim.midMin;
  const sum = left + right;
  if (sum < sumMin) {
    const [a, b] = distribute(sumMin - sum, lim.sideMax - left, lim.sideMax - right);
    left += a;
    right += b;
  } else if (sum > sumMax) {
    const [a, b] = distribute(sum - sumMax, left - lim.sideMin, right - lim.sideMin);
    left -= a;
    right -= b;
  }
  return { left, right };
}

export function resizeFromHandle(widths, handle, deltaPx, usablePx) {
  const lim = limitsFor(usablePx);
  if (!lim) return { ...DEFAULT_WIDTHS };
  const base = clampWidths(widths, usablePx);
  const d = (deltaPx / usablePx) * 100;
  const sumMin = 100 - lim.midMax;
  const sumMax = 100 - lim.midMin;
  if (handle === 0) {
    const lo = Math.max(lim.sideMin, sumMin - base.right);
    const hi = Math.min(lim.sideMax, sumMax - base.right);
    return { left: clamp(base.left + d, lo, hi), right: base.right };
  }
  const lo = Math.max(lim.sideMin, sumMin - base.left);
  const hi = Math.min(lim.sideMax, sumMax - base.left);
  return { left: base.left, right: clamp(base.right - d, lo, hi) };
}

const fmt = (n) => String(Number(n.toFixed(3)));

export function columnsTemplate(w, handlePx = 12) {
  return 'minmax(0, ' + fmt(w.left) + 'fr) ' + handlePx + 'px minmax(0, ' + fmt(middlePct(w)) + 'fr) ' + handlePx + 'px minmax(0, ' + fmt(w.right) + 'fr)';
}

export function loadWidths(storage) {
  try {
    const raw = storage.getItem(WIDTHS_KEY);
    if (!raw) return { ...DEFAULT_WIDTHS };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Number.isFinite(parsed.left) && Number.isFinite(parsed.right)) {
      return { left: parsed.left, right: parsed.right };
    }
    return { ...DEFAULT_WIDTHS };
  } catch {
    return { ...DEFAULT_WIDTHS };
  }
}

export function saveWidths(storage, w) {
  try {
    if (!w || !Number.isFinite(w.left) || !Number.isFinite(w.right)) return false;
    storage.setItem(WIDTHS_KEY, JSON.stringify({ left: w.left, right: w.right }));
    return true;
  } catch {
    return false;
  }
}

export function resetWidths(storage) {
  try {
    storage.removeItem(WIDTHS_KEY);
    return true;
  } catch {
    return false;
  }
}
