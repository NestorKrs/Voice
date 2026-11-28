// Applies extra pause markers to already-decoded audio: each pause adds its
// seconds on top of the natural pause, snapping a mid-sentence marker to the
// nearest quiet gap. Pure: no DOM, no network, no findSilences/alignTimeMap calls.
import { stripWithMap } from './directives.js';

// Map pause indexes from the request text (with delivery tags) to the spoken
// text the audio was aligned against. The smallest spoken index whose mapped
// original position reaches the clean index wins; past the end gives text.length.
export function mapPausesToSpoken(clean, pauses) {
  const src = typeof clean === 'string' ? clean : '';
  const { text, map } = stripWithMap(src);
  const list = Array.isArray(pauses) ? pauses : [];
  const mapped = list.map((p) => {
    const target = Number(p && p.index) || 0;
    let lo = 0;
    let hi = map.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (map[mid] >= target) hi = mid; else lo = mid + 1;
    }
    return { index: lo, seconds: p ? p.seconds : 0 };
  });
  return { text, pauses: mapped };
}

export function applyPauses({ samples, rate, text, pauses, align, fineSilences, options } = {}) {
  const src = samples instanceof Float32Array ? samples : new Float32Array(samples || []);
  const r = Number(rate) > 0 ? Number(rate) : 1;
  const spoken = typeof text === 'string' ? text : '';
  const list = Array.isArray(pauses) ? pauses : [];
  const snapRadiusSec = options && typeof options.snapRadiusSec === 'number' ? options.snapRadiusSec : 0.3;
  const duration = src.length / r;

  const fineGaps = fineSilences && Array.isArray(fineSilences.silences) ? fineSilences.silences : [];
  const alignedOk = !!(align && align.ok);
  const pairs = alignedOk && Array.isArray(align.pairs) ? align.pairs : [];
  const indexToTime = alignedOk && typeof align.indexToTime === 'function' ? align.indexToTime : null;

  const report = [];
  const inserts = [];
  let addedSec = 0;

  for (let n = 0; n < list.length; n += 1) {
    const p = list[n] || {};
    const seconds = Number(p.seconds);
    const index = Number(p.index) || 0;
    let status;
    let atSec = null;
    let distSec = null;
    let reason;

    if (!Number.isFinite(seconds) || seconds <= 0) {
      status = 'skipped';
      reason = 'Invalid pause length.';
    } else if (spoken.slice(index).trim() === '') {
      status = 'end';
      atSec = duration;
    } else if (spoken.slice(0, index).trim() === '') {
      status = 'start';
      atSec = 0;
    } else {
      let bestPair = null;
      for (const pair of pairs) {
        const off = Number(pair && pair.offset) || 0;
        if (off <= index && spoken.slice(off, index).trim() === '' && (!bestPair || off > bestPair.offset)) {
          bestPair = pair;
        }
      }
      if (bestPair) {
        status = 'aligned';
        atSec = (Number(bestPair.start) + Number(bestPair.end)) / 2;
      } else {
        const t0 = indexToTime ? indexToTime(index) : (index / Math.max(1, spoken.length)) * duration;
        let bestGap = null;
        let bestDist = Infinity;
        for (const gap of fineGaps) {
          const gs = Number(gap && gap.start);
          const ge = Number(gap && gap.end);
          const d = t0 >= gs && t0 <= ge ? 0 : Math.min(Math.abs(t0 - gs), Math.abs(t0 - ge));
          if (d < bestDist) { bestDist = d; bestGap = gap; }
        }
        if (bestGap && bestDist <= snapRadiusSec) {
          status = 'snapped';
          atSec = (Number(bestGap.start) + Number(bestGap.end)) / 2;
          distSec = Math.round(bestDist * 1000) / 1000;
        } else {
          status = 'skipped';
          reason = 'No quiet spot within ' + snapRadiusSec + ' s of the marker.';
        }
      }
    }

    if (status !== 'skipped') {
      const count = Math.round(seconds * r);
      const pos = Math.max(0, Math.min(Math.round(atSec * r), src.length));
      if (count > 0) inserts.push({ pos, count });
      addedSec += seconds;
    }

    report.push({
      number: n + 1,
      seconds,
      status,
      atSec: atSec === null ? null : Math.round(atSec * 1000) / 1000,
      distSec,
      reason,
    });
  }

  inserts.sort((a, b) => a.pos - b.pos);
  let total = 0;
  for (const ins of inserts) total += ins.count;
  const out = new Float32Array(src.length + total);
  let si = 0;
  let oi = 0;
  for (const ins of inserts) {
    while (si < ins.pos) { out[oi] = src[si]; oi += 1; si += 1; }
    for (let k = 0; k < ins.count; k += 1) { out[oi] = 0; oi += 1; }
  }
  while (si < src.length) { out[oi] = src[si]; oi += 1; si += 1; }

  return { samples: out, report, addedSec: Math.round(addedSec * 1000) / 1000 };
}