export const SIDE_MIN_PX = 280;
export const SIDE_MAX_PCT = 80;
export const MID_MIN_PX = 0;
export const MID_MAX_PCT = 0;
export const DEFAULT_WIDTHS = { left: 33.33, right: 66.67 };
export const WIDTHS_KEY = 'voice.panelWidths';

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const SUM_EPS = 1e-6;

export function middlePct(w) {
  return 100 - w.left - w.right;
}

export function usableWidth(clientWidth, padding = 12, handle = 12) {
  return Math.max(0, clientWidth - 2 * padding - 1 * handle);
}

export function limitsFor(usablePx) {
  if (!Number.isFinite(usablePx) || usablePx <= 0) return null;
  const sideMin = (280 / usablePx) * 100;
  if (2 * sideMin > 100) return null;
  return { sideMin, sideMax: 80 };
}

export function clampWidths(w, usablePx) {
  if (!w || typeof w !== 'object' || Array.isArray(w)) return { ...DEFAULT_WIDTHS };
  if (!Number.isFinite(w.left) || !Number.isFinite(w.right)) return { ...DEFAULT_WIDTHS };
  if (Math.abs(w.left + w.right - 100) > 1e-6) return { ...DEFAULT_WIDTHS };
  const lim = limitsFor(usablePx);
  if (!lim) return { ...DEFAULT_WIDTHS };
  const left = clamp(w.left, lim.sideMin, lim.sideMax);
  const right = 100 - left;
  return { left, right };
}

export function resizeFromHandle(widths, index, deltaPx, usablePx) {
  if (index !== 0) return widths ? { ...widths } : { ...DEFAULT_WIDTHS };
  const base = clampWidths(widths, usablePx);
  const lim = limitsFor(usablePx);
  if (!lim) return { ...DEFAULT_WIDTHS };
  const d = (deltaPx / usablePx) * 100;
  const left = clamp(base.left + d, lim.sideMin, lim.sideMax);
  return { left, right: 100 - left };
}

const fmt = (n) => String(Number(n.toFixed(3)));

export function columnsTemplate(w) {
  return 'minmax(0, ' + fmt(w.left) + 'fr) 12px minmax(0, ' + fmt(w.right) + 'fr)';
}

export function loadWidths(storage) {
  try {
    const raw = storage.getItem(WIDTHS_KEY);
    if (!raw) return { ...DEFAULT_WIDTHS };
    return clampWidths(JSON.parse(raw), 1e9);
  } catch {
    return { ...DEFAULT_WIDTHS };
  }
}

export function saveWidths(storage, w) {
  try {
    if (!w || typeof w !== 'object' || Array.isArray(w)) return false;
    if (!Number.isFinite(w.left) || !Number.isFinite(w.right)) return false;
    if (Math.abs(w.left + w.right - 100) > 1e-6) return false;
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
