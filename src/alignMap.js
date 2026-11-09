// Aligns the punctuation breaks of a chunk text with the real pauses in its
// audio, then maps playback time to a character index. Pure: no DOM, no network.
// This replaces the "n-1 longest pauses" idea of timeMap.js: here a break may
// be skipped, so one wrong pause cannot shift every later break with it.

export const SKIP_SENTENCE = 1.5;
export const SKIP_CLAUSE = 0.4;
export const LONG_BONUS_SENTENCE = 2;
export const LONG_BONUS_CLAUSE = 0.5;
export const LONG_CAP = 0.8;
export const MAX_SKIP_BREAKS = 8;
export const MAX_SKIP_SILENCES = 8;
export const EPS = 0.2;

const SENTENCE_CHARS = new Set(['.', '!', '?']);
const CLAUSE_CHARS = new Set([',', ';', ':']);

function breakKind(ch) {
  return SENTENCE_CHARS.has(ch) ? 'sentence' : 'clause';
}

function skipCostOf(kind) {
  return kind === 'sentence' ? SKIP_SENTENCE : SKIP_CLAUSE;
}

function bonusOf(kind, silenceLength) {
  const perSecond = kind === 'sentence' ? LONG_BONUS_SENTENCE : LONG_BONUS_CLAUSE;
  return Math.min(silenceLength, LONG_CAP) * perSecond;
}

function segCost(observed, expected) {
  const ratio = (observed + EPS) / (expected + EPS);
  const log = Math.log(ratio);
  return log * log;
}

// A break sits just after a punctuation character that is followed by
// whitespace, so "3.5" and a trailing full stop are not breaks.
function findBreaks(text) {
  const breaks = [];
  for (let k = 0; k < text.length; k += 1) {
    const ch = text[k];
    if (!SENTENCE_CHARS.has(ch) && !CLAUSE_CHARS.has(ch)) continue;
    if (k + 1 >= text.length || !/\s/.test(text[k + 1])) continue;
    const b = k + 1;
    if (b >= text.length - 1) continue;
    breaks.push({ b, kind: breakKind(ch) });
  }
  return breaks;
}

// P[i] is the total weight of the first i characters; P[text.length] is Wt.
function prefixWeights(text, weightAt) {
  const P = new Array(text.length + 1);
  P[0] = 0;
  let total = 0;
  for (let i = 0; i < text.length; i += 1) {
    total += Math.max(0, Number(weightAt(i)) || 0);
    P[i + 1] = total;
  }
  if (!(total > 0)) for (let i = 0; i <= text.length; i += 1) P[i] = i;
  return P;
}

export function alignTimeMap(text, silenceResult, options = {}) {
  const value = typeof text === 'string' ? text : '';
  const audio = silenceResult || {};
  const silences = (Array.isArray(audio.silences) ? audio.silences : []).map((s) => ({
    start: Number(s && s.start) || 0,
    end: Number(s && s.end) || 0,
  }));
  const leadIn = Math.max(0, Number(audio.leadIn) || 0);
  const tail = Math.max(0, Number(audio.tail) || 0);
  const duration = Number(audio.duration);
  const S0 = leadIn;
  const S1 = Number.isFinite(duration) ? duration - tail : 0;

  if (value === '' || !(S1 > S0)) return { ok: false, reason: 'No speech span' };

  const weightAt = options && typeof options.weightAt === 'function' ? options.weightAt : () => 1;
  const P = prefixWeights(value, weightAt);
  const Wt = P[value.length];
  const breaks = findBreaks(value);
  const n = breaks.length;
  const m = silences.length;

  // Average seconds per unit of weight, taken from the audio itself.
  const sumL = silences.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
  let r = (S1 - S0 - sumL) / Wt;
  if (!(r > 0)) r = (S1 - S0) / Wt;

  // skipPrefix[i] is the cost of skipping breaks 0..i-1.
  const skipPrefix = new Array(n + 1);
  skipPrefix[0] = 0;
  for (let i = 0; i < n; i += 1) skipPrefix[i + 1] = skipPrefix[i] + skipCostOf(breaks[i].kind);

  // dp[i][j]: break i matched to silence j, with the cheapest way to get there.
  const dp = [];
  for (let i = 0; i < n; i += 1) dp.push(new Array(m).fill(null));

  for (let i = 0; i < n; i += 1) {
    const Wb = P[breaks[i].b];
    for (let j = 0; j < m; j += 1) {
      const s = silences[j];
      const bonus = bonusOf(breaks[i].kind, Math.max(0, s.end - s.start));
      let best = null;
      const fromStart = s.start - S0;
      if (fromStart >= 0) {
        best = { cost: segCost(fromStart, r * Wb) + skipPrefix[i] - bonus, pi: -1, pj: -1 };
      }
      for (let ip = Math.max(0, i - MAX_SKIP_BREAKS); ip < i; ip += 1) {
        for (let jp = Math.max(0, j - MAX_SKIP_SILENCES); jp < j; jp += 1) {
          const prev = dp[ip][jp];
          if (!prev) continue;
          const observed = s.start - silences[jp].end;
          if (observed < 0) continue;
          const expected = r * (Wb - P[breaks[ip].b]);
          const cost = prev.cost + segCost(observed, expected)
            + (skipPrefix[i] - skipPrefix[ip + 1]) - bonus;
          if (!best || cost < best.cost) best = { cost, pi: ip, pj: jp };
        }
      }
      dp[i][j] = best;
    }
  }

  // Close the last segment, or skip every break and use no anchor at all.
  let finish = { cost: skipPrefix[n], pi: -1, pj: -1 };
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < m; j += 1) {
      const state = dp[i][j];
      if (!state) continue;
      const observed = S1 - silences[j].end;
      if (observed + EPS <= 0) continue;
      const expected = r * (Wt - P[breaks[i].b]);
      const cost = state.cost + segCost(observed, expected)
        + (skipPrefix[n] - skipPrefix[i + 1]);
      if (cost < finish.cost) finish = { cost, pi: i, pj: j };
    }
  }

  const pairs = [];
  let cursor = finish;
  while (cursor && cursor.pi >= 0) {
    pairs.push({ i: cursor.pi, j: cursor.pj });
    cursor = dp[cursor.pi][cursor.pj];
  }
  pairs.reverse();

  // Anchors hold the position through a pause and move linearly between pauses.
  const anchors = [[S0, 0]];
  for (const { i, j } of pairs) {
    const w = P[breaks[i].b];
    anchors.push([silences[j].start, w]);
    anchors.push([silences[j].end, w]);
  }
  anchors.push([S1, Wt]);

  function timeToIndex(t) {
    const time = Number(t);
    if (!Number.isFinite(time)) return 0;
    if (time <= S0) return 0;
    if (time >= S1) return Math.max(0, value.length - 1);

    let lo = 0;
    let hi = anchors.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (anchors[mid][0] <= time) lo = mid; else hi = mid - 1;
    }
    const a = anchors[lo];
    const b = anchors[lo + 1] || a;
    const w = b[0] > a[0]
      ? a[1] + (b[1] - a[1]) * ((time - a[0]) / (b[0] - a[0]))
      : a[1];

    let low = 0;
    let high = P.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (P[mid] <= w) low = mid; else high = mid - 1;
    }
    return Math.min(low, value.length - 1);
  }

  return {
    ok: true,
    reason: '',
    anchors: pairs.length,
    breaks: n,
    silences: m,
    timeToIndex,
  };
}
