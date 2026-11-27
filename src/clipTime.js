// Pure parser for typed cut times. No DOM, no audio, no imports beyond time formatting.

import { formatTime } from './clipCuts.js';

const TIME_FORM = /^(\d+)(?::(\d{2})(?::(\d{2}))?)?(?:\.(\d+))?$/;

export function parseTime(text, rate, total) {
  if (!(total > 0) || !(rate > 0)) return { ok: false, reason: 'No audio loaded.' };
  if (typeof text !== 'string') {
    return { ok: false, reason: 'Time format not understood. Use 65.25, 1:05 or 1:05.250.' };
  }

  const trimmed = text.trim();
  if (trimmed === '') {
    return { ok: false, reason: 'Type a time such as 1:05.250 or 65.25.' };
  }

  const match = TIME_FORM.exec(trimmed.replace(',', '.'));
  if (!match) {
    return { ok: false, reason: 'Time format not understood. Use 65.25, 1:05 or 1:05.250.' };
  }

  const [, first, second, third, digits] = match;
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
  const sample = Math.round((hours * 3600 + minutes * 60 + seconds + fraction) * rate);
  if (sample <= 0) return { ok: false, reason: 'A cut must be after the start (0:00.000).' };
  if (sample >= total) {
    return { ok: false, reason: `A cut must be before the end (${formatTime(total, rate)}).` };
  }
  return { ok: true, sample };
}
