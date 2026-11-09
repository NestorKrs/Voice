// Turns the pauses found by findSilences into a playback-time -> character-index
// map for one chunk, so the Text panel highlight can follow the real voice
// instead of assuming one steady speaking rate. Pure: no DOM, no network.
// Stage B2 wires this into the player; this module knows nothing about audio.

function finite(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Character index at `fraction` of a sentence range. Without weightAt the
// characters are counted plain; with it, a heavy character (a full stop costs
// more) takes more time, so the index at a given fraction sits earlier.
function indexAtFraction(range, fraction, weightAt) {
  const span = range.end - range.start;
  if (!(span > 0)) return range.end;
  const f = Math.min(1, Math.max(0, fraction));
  if (f >= 1) return range.end;
  if (typeof weightAt !== 'function') {
    return Math.min(range.end, range.start + Math.floor(f * span));
  }
  let total = 0;
  for (let i = range.start; i < range.end; i += 1) total += Math.max(0, Number(weightAt(i)) || 0);
  if (!(total > 0)) return Math.min(range.end, range.start + Math.floor(f * span));
  const target = f * total;
  let sum = 0;
  for (let i = range.start; i < range.end; i += 1) {
    sum += Math.max(0, Number(weightAt(i)) || 0);
    if (sum >= target) return i;
  }
  return range.end - 1;
}

// sentences: [{ start, end }] character ranges in order. silenceResult: the
// object from findSilences. options.weightAt: character index -> weight.
export function buildTimeMap(sentences, silenceResult, options = {}) {
  const ranges = (Array.isArray(sentences) ? sentences : [])
    .filter((s) => s && Number.isFinite(Number(s.start)) && Number.isFinite(Number(s.end)))
    .map((s) => ({ start: Number(s.start), end: Number(s.end) }));
  const count = ranges.length;
  if (count === 0) return { ok: false, reason: 'No sentences to map' };

  const audio = silenceResult || {};
  const duration = finite(audio.duration, 0);
  const leadIn = finite(audio.leadIn, 0);
  const tail = finite(audio.tail, 0);
  const found = Array.isArray(audio.silences) ? audio.silences.length : 0;
  const need = count - 1;
  if (found < need) return { ok: false, reason: `Found ${found} pauses, need ${need}` };

  // Commas pause less than sentence ends, so keep the longest pauses and put
  // them back in time order.
  const pauses = need === 0 ? [] : [...(audio.silences || [])]
    .sort((a, b) => (b.end - b.start) - (a.end - a.start))
    .slice(0, need)
    .sort((a, b) => a.start - b.start);

  const segments = ranges.map((range, i) => ({
    range,
    start: i === 0 ? leadIn : pauses[i - 1].end,
    end: i === count - 1 ? duration - tail : pauses[i].start,
  }));

  const first = ranges[0].start;
  const last = ranges[count - 1].end;
  const lastSegment = segments[count - 1];
  const weightAt = options && typeof options.weightAt === 'function' ? options.weightAt : null;

  function timeToIndex(t) {
    const time = Number(t);
    if (!Number.isFinite(time) || time <= segments[0].start) return first;
    if (time >= lastSegment.end) return last;
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i];
      if (time > seg.end) continue;
      if (time < seg.start) return ranges[i - 1].end; // inside the pause before this segment
      const fraction = seg.end > seg.start ? (time - seg.start) / (seg.end - seg.start) : 1;
      return indexAtFraction(seg.range, fraction, weightAt);
    }
    return last;
  }

  return { ok: true, reason: null, timeToIndex };
}
