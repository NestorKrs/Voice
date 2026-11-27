// Pure, immutable cut-marker state for a later clip editor. No imports, no DOM.

const MAX_PAST = 100;

function clampSample(value, total) {
  return Math.min(Math.max(Math.round(value), 1), total - 1);
}

function appendPast(past, markers) {
  return [...past, markers].slice(-MAX_PAST);
}

function withHistory(state, markers) {
  return { ...state, markers, past: appendPast(state.past, state.markers), future: [] };
}

function validIndex(state, index) {
  return Number.isInteger(index) && index >= 0 && index < state.markers.length;
}

export function createCuts(total, rate) {
  return { total, rate, markers: [], past: [], future: [] };
}

export function msToSamples(ms, rate) {
  return Math.round(ms * rate / 1000);
}

export function samplesToMs(samples, rate) {
  return samples * 1000 / rate;
}

export function formatTime(samples, rate) {
  const totalMs = Math.floor(samplesToMs(samples, rate));
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export function addMarker(state, sample) {
  if (state.total < 2) return state;
  const at = clampSample(sample, state.total);
  if (state.markers.includes(at)) return state;
  const markers = [...state.markers];
  const pos = markers.findIndex((m) => m > at);
  markers.splice(pos === -1 ? markers.length : pos, 0, at);
  return withHistory(state, markers);
}

export function moveMarker(state, index, sample) {
  if (!validIndex(state, index)) return state;
  const prev = state.markers[index - 1];
  const next = state.markers[index + 1];
  const low = prev === undefined ? 1 : prev + 1;
  const high = next === undefined ? state.total - 1 : next - 1;
  const at = Math.min(Math.max(Math.round(sample), low), high);
  if (at === state.markers[index]) return state;
  const markers = [...state.markers];
  markers[index] = at;
  return withHistory(state, markers);
}

export function nudgeMarker(state, index, deltaMs) {
  return moveMarker(state, index, state.markers[index] + msToSamples(deltaMs, state.rate));
}

export function deleteMarker(state, index) {
  if (!validIndex(state, index)) return state;
  return withHistory(state, state.markers.filter((_, i) => i !== index));
}

// Index of the nearest marker within tolerance samples, or -1. Ties go to the
// later marker so Delete always removes the one on the right of an exact tie.
export function nearestMarkerIndex(markers, sample, tolerance) {
  let best = -1;
  let distance = tolerance;
  for (let i = 0; i < markers.length; i += 1) {
    const delta = Math.abs(markers[i] - sample);
    if (delta <= distance) {
      distance = delta;
      best = i;
    }
  }
  return best;
}

export function undo(state) {
  if (state.past.length === 0) return state;
  return {
    ...state,
    markers: state.past[state.past.length - 1],
    past: state.past.slice(0, -1),
    future: [state.markers, ...state.future],
  };
}

export function redo(state) {
  if (state.future.length === 0) return state;
  return {
    ...state,
    markers: state.future[0],
    past: appendPast(state.past, state.markers),
    future: state.future.slice(1),
  };
}

export function segments(state) {
  if (state.total === 0) return [];
  const bounds = [0, ...state.markers, state.total];
  return bounds.slice(0, -1).map((start, index) => ({ index, start, end: bounds[index + 1] }));
}
