// Pure mix plan shared by the live preview graph and the offline export graph. No imports, no audio.

export const MAX_MIX_VOICE_SECONDS = 600;

export const DEFAULT_PARAMS = {
  voiceGain: 1,
  musicGain: 0.5,
  musicStartSec: 0,
  loop: false,
  fadeInSec: 0,
  fadeOutSec: 0,
  duck: false,
};

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

export function normalizeParams(p) {
  const src = p || {};
  const voiceGain = clamp(finiteOr(src.voiceGain, DEFAULT_PARAMS.voiceGain), 0, 2);
  const musicGain = clamp(finiteOr(src.musicGain, DEFAULT_PARAMS.musicGain), 0, 2);
  const roundedStart = Math.round(finiteOr(src.musicStartSec, DEFAULT_PARAMS.musicStartSec) * 1000) / 1000;
  const musicStartSec = roundedStart === 0 ? 0 : roundedStart;
  const fadeInSec = clamp(finiteOr(src.fadeInSec, DEFAULT_PARAMS.fadeInSec), 0, 30);
  const fadeOutSec = clamp(finiteOr(src.fadeOutSec, DEFAULT_PARAMS.fadeOutSec), 0, 30);
  const loop = Boolean(src.loop);
  const duck = Boolean(src.duck);
  return { voiceGain, musicGain, musicStartSec, loop, fadeInSec, fadeOutSec, duck };
}

export function clampStartSec(startSec, durationSec, musicSec) {
  return Math.min(durationSec, Math.max(-musicSec, startSec));
}

const OFFSET_FORM = /^([+-])?(\d+)(?::(\d{2})(?::(\d{2}))?)?(?:[.,](\d+))?$/;
const OFFSET_NOT_UNDERSTOOD = 'Time format not understood. Use 65.25, -2.5, 1:05 or 1:05.250.';

export function parseOffsetTime(text) {
  if (typeof text !== 'string') return { ok: false, reason: OFFSET_NOT_UNDERSTOOD };

  const trimmed = text.trim();
  if (trimmed === '') {
    return { ok: false, reason: 'Type a time such as 1:05.250, 65.25 or -2.5.' };
  }

  const match = OFFSET_FORM.exec(trimmed.replace(',', '.'));
  if (!match) return { ok: false, reason: OFFSET_NOT_UNDERSTOOD };

  const [, sign, first, second, third, digits] = match;
  let hours = 0;
  let minutes = 0;
  let seconds = Number(first);
  if (second !== undefined) {
    minutes = seconds;
    seconds = Number(second);
  }
  if (third !== undefined) {
    hours = minutes;
    minutes = seconds;
    seconds = Number(third);
  }
  if (second !== undefined && (minutes >= 60 || seconds >= 60)) {
    return { ok: false, reason: 'Minutes and seconds must be below 60.' };
  }

  const fraction = digits === undefined ? 0 : Number(`0.${digits}`);
  const magnitude = hours * 3600 + minutes * 60 + seconds + fraction;
  if (magnitude > 3600) {
    return { ok: false, reason: 'Offset must be within one hour (+-1:00:00).' };
  }

  const signed = sign === '-' ? -magnitude : magnitude;
  const rounded = Math.round(signed * 1000) / 1000;
  return { ok: true, seconds: rounded === 0 ? 0 : rounded };
}

export function buildMixPlan({ voiceLength, musicLength, rate, params, duck } = {}) {
  const p = normalizeParams(params);
  const durationSec = voiceLength / rate;
  const musicSec = (musicLength || 0) / rate;
  const startSec = clampStartSec(p.musicStartSec, durationSec, musicSec);
  const audibleStartSec = Math.max(0, startSec);
  const offsetIntoMusicSec = startSec < 0 ? -startSec : 0;

  let musicMode = 'play';
  if (!musicSec || audibleStartSec >= durationSec || (!p.loop && offsetIntoMusicSec >= musicSec)) {
    musicMode = 'none';
  }

  const fadeIn = {
    startSec: audibleStartSec,
    endSec: Math.min(durationSec, audibleStartSec + p.fadeInSec),
  };
  const fadeOut = {
    startSec: Math.max(fadeIn.endSec, durationSec - p.fadeOutSec),
    endSec: durationSec,
  };

  return {
    rate,
    durationSec,
    musicSec,
    voiceGain: p.voiceGain,
    musicGain: p.musicGain,
    loop: p.loop,
    musicMode,
    audibleStartSec,
    offsetIntoMusicSec,
    fadeIn,
    fadeOut,
    duck: p.duck && musicMode === 'play' ? duck : null,
  };
}

export function fadeValueAt(plan, t) {
  const { audibleStartSec, durationSec, fadeIn, fadeOut } = plan;
  if (t < audibleStartSec) return 1;

  const fadeInLength = fadeIn.endSec - fadeIn.startSec;
  const fadeOutLength = fadeOut.endSec - fadeOut.startSec;

  if (t >= durationSec) return fadeOutLength > 0 ? 0 : 1;
  if (fadeInLength > 0 && t < fadeIn.endSec) {
    return (t - fadeIn.startSec) / fadeInLength;
  }
  if (fadeOutLength > 0 && t >= fadeOut.startSec) {
    return (fadeOut.endSec - t) / fadeOutLength;
  }
  return 1;
}

function musicSchedule(plan, position) {
  if (plan.musicMode === 'none') return null;

  if (position < plan.audibleStartSec) {
    return {
      whenSec: plan.audibleStartSec - position,
      offsetSec: plan.offsetIntoMusicSec,
      loop: plan.loop,
    };
  }

  let m = position - plan.audibleStartSec + plan.offsetIntoMusicSec;
  if (plan.loop) {
    m %= plan.musicSec;
  } else if (m >= plan.musicSec) {
    return null;
  }
  return { whenSec: 0, offsetSec: m, loop: plan.loop };
}

function fadeSchedule(plan, position) {
  const points = [{ t: 0, v: fadeValueAt(plan, position) }];
  const fadeInLength = plan.fadeIn.endSec - plan.fadeIn.startSec;
  const fadeOutLength = plan.fadeOut.endSec - plan.fadeOut.startSec;

  const boundaries = [];
  if (fadeInLength > 0) boundaries.push({ at: plan.fadeIn.endSec, v: 1 });
  if (fadeOutLength > 0) {
    boundaries.push({ at: plan.fadeOut.startSec, v: 1 });
    boundaries.push({ at: plan.fadeOut.endSec, v: 0 });
  }

  let previousT = 0;
  for (const boundary of boundaries) {
    if (boundary.at <= position) continue;
    const t = boundary.at - position;
    if (t === previousT) continue;
    points.push({ t, v: boundary.v });
    previousT = t;
  }
  return points;
}

function duckSchedule(plan, position) {
  if (!plan.duck) return null;

  const { frames, frameSize } = plan.duck;
  const k = Math.floor(position / (frameSize / plan.rate));
  const curve = frames.subarray(k);
  if (curve.length < 2) return null;

  return { curve, durationSec: ((curve.length - 1) * frameSize) / plan.rate };
}

export function scheduleAt(plan, positionSec) {
  const position = clamp(positionSec, 0, plan.durationSec);
  return {
    voiceOffsetSec: position,
    music: musicSchedule(plan, position),
    fade: fadeSchedule(plan, position),
    duck: duckSchedule(plan, position),
  };
}

export function peakBound(plan, voicePeak, musicPeak) {
  const music = plan.musicMode === 'play' ? musicPeak * plan.musicGain : 0;
  return voicePeak * plan.voiceGain + music;
}