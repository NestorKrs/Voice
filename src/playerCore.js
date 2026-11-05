export const RATES = [0.75, 1, 1.25, 1.5, 2];

export function createInitialState({ total = 0 } = {}) {
  return { total, index: 0, status: 'stopped', rate: 1 };
}

export function reduce(state, action) {
  if (!action || typeof action !== 'object') return state;
  const type = action.type;
  switch (type) {
    case 'SET_TOTAL': {
      let t = action.total;
      if (!Number.isInteger(t) || t < 0) t = state.total;
      const newState = { ...state, total: t };
      if (t === 0) { newState.index = 0; newState.status = 'stopped'; return newState; }
      if (newState.index > t - 1) newState.index = Math.max(0, t - 1);
      return newState;
    }
    case 'PLAY': {
      if (state.total === 0) return state;
      const newState = { ...state };
      if (state.status === 'finished') { newState.index = 0; }
      newState.status = 'playing';
      return newState;
    }
    case 'PAUSE': {
      if (state.status !== 'playing') return state;
      return { ...state, status: 'paused' };
    }
    case 'TOGGLE': {
      if (state.status === 'playing') return { ...state, status: 'paused' };
      // behave like PLAY
      if (state.total === 0) return state;
      const newState = { ...state };
      if (state.status === 'finished') newState.index = 0;
      newState.status = 'playing';
      return newState;
    }
    case 'STOP': {
      return { ...state, status: 'stopped' };
    }
    case 'NEXT': {
      if (state.index < state.total - 1) return { ...state, index: state.index + 1 };
      return state;
    }
    case 'PREV': {
      return { ...state, index: Math.max(0, state.index - 1) };
    }
    case 'JUMP': {
      if (typeof action.index !== 'number' || Number.isNaN(action.index)) return state;
      if (state.total <= 0) return state;
      const idx = Math.max(0, Math.min(state.total - 1, Math.floor(action.index)));
      const newState = { ...state, index: idx };
      newState.status = 'playing';
      return newState;
    }
    case 'ENDED': {
      if (state.index < state.total - 1) return { ...state, index: state.index + 1, status: 'playing' };
      return { ...state, status: 'finished' };
    }
    case 'SET_RATE': {
      if (!RATES.includes(action.rate)) return state;
      return { ...state, rate: action.rate };
    }
    default:
      return state;
  }
}

export function getView(state, ready) {
  const { total, index, status, rate } = state;
  const buffering = status === 'playing' && !(ready && ready[index] === true);
  const preloadIndex = (index + 1 < total) ? index + 1 : null;
  const canNext = index < total - 1;
  const canPrev = index > 0;
  const isLast = total > 0 && index === total - 1;
  return { index, status, rate, buffering, preloadIndex, canNext, canPrev, isLast };
}

export function wantedWindow(state, lookahead) {
  const { total, index } = state;
  if (total === 0) return { from: 0, to: -1 };
  return { from: index, to: Math.min(total - 1, index + lookahead) };
}

export function estimateTimes({ chars = [], durations = [], index = 0, positionSeconds = 0, rate = 1 } = {}) {
  if (!chars || chars.length === 0) {
    return { elapsed: 0, remaining: 0, total: 0, estimated: false };
  }
  // known sums
  let knownDurSum = 0;
  let knownCharSum = 0;
  for (let i = 0; i < chars.length; i++) {
    if (durations[i] != null) {
      knownDurSum += durations[i];
      knownCharSum += chars[i];
    }
  }
  const spc = knownCharSum > 0 ? knownDurSum / knownCharSum : 0.07;
  // build full duration array
  const full = chars.map((c, i) => {
    if (durations[i] != null) return durations[i];
    return c * spc;
  });
  const estimated = durations.some((d, i) => d == null);
  const total = full.reduce((a, b) => a + b, 0);
  // elapsed
  let elapsed = 0;
  for (let i = 0; i < index; i++) elapsed += full[i];
  const chunkDur = full[index] || 0;
  const pos = Math.min(positionSeconds, chunkDur);
  elapsed += pos;
  const remaining = Math.max(0, total - elapsed) / rate;
  return { elapsed, remaining, total, estimated };
}
