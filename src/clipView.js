// Pure zoom and scroll window maths for the clip editor. No DOM, no app state, no logging.

export const MIN_SPAN = 256;

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

export function fullView(total) {
  return { start: 0, span: total };
}

export function clampView(view, total) {
  const span = clamp(Math.round(view.span), Math.min(MIN_SPAN, total), total);
  const start = clamp(Math.round(view.start), 0, total - span);
  return { start, span };
}

export function zoomAt(view, total, factor, anchorSample) {
  const base = clampView(view, total);
  if (base.span <= 0) return base;

  const newSpan = clamp(Math.round(base.span / factor), Math.min(MIN_SPAN, total), total);
  const anchor = clamp(anchorSample, base.start, base.start + base.span);
  const newStart = Math.round(anchor - (anchor - base.start) * (newSpan / base.span));
  return clampView({ start: newStart, span: newSpan }, total);
}

export function wheelFactor(deltaY) {
  return Math.exp(-clamp(deltaY, -400, 400) * 0.0015);
}

export function panBy(view, total, deltaSamples) {
  const base = clampView(view, total);
  return clampView({ start: base.start + Math.round(deltaSamples), span: base.span }, total);
}

export function panByPixels(view, total, dxPixels, widthPixels) {
  if (widthPixels <= 0) return view;
  return panBy(view, total, dxPixels / widthPixels * view.span);
}

export function sampleAtX(view, x, widthPixels) {
  if (widthPixels <= 0) return view.start;
  return clamp(Math.round(view.start + x / widthPixels * view.span), 0, view.start + view.span);
}

export function xAtSample(view, sample, widthPixels) {
  if (view.span === 0) return 0;
  return (sample - view.start) / view.span * widthPixels;
}

export function ensureVisible(view, total, sample) {
  const base = clampView(view, total);
  if (sample >= base.start && sample <= base.start + base.span) return view;
  return clampView({ start: Math.round(sample - base.span * 0.1), span: base.span }, total);
}

export function isFullView(view, total) {
  return view.span >= total;
}
