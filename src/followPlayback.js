export function readyFlags(chunks) {
  return (Array.isArray(chunks) ? chunks : []).map((c) => Boolean(c && c.status === 'ready'));
}

export function newlyReady(prev, chunks) {
  const before = Array.isArray(prev) ? prev : [];
  const out = [];
  (Array.isArray(chunks) ? chunks : []).forEach((c, i) => {
    if (c && c.status === 'ready' && !before[i]) out.push(i);
  });
  return out;
}

const FOLLOW_STATES = ['idle', 'generating'];

export function playheadToSend(playerIndex, lastSent, schedulerState) {
  if (!Number.isInteger(playerIndex) || playerIndex < 0) return null;
  if (!FOLLOW_STATES.includes(schedulerState)) return null;
  if (playerIndex === lastSent) return null;
  return playerIndex;
}
