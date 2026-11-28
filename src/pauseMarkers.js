// Pure pause-marker extraction: pull <break ...> tags out of the text and report
// where each pause sits in the cleaned text. The app turns these into added
// silence; nothing here touches the network, storage or the DOM.
import { findBreaks } from './directives.js';

const MAX_PAUSE_SECONDS = 60;

function isSpace(ch) {
  return ch === ' ' || ch === '\t';
}

export function extractPauses(text) {
  const src = typeof text === 'string' ? text : '';
  const breaks = findBreaks(src);
  if (breaks.length === 0) {
    return { clean: src, pauses: [], count: 0, clamped: false };
  }

  let clean = '';
  const pauses = [];
  let clamped = false;
  let cursor = 0;

  for (const b of breaks) {
    clean += src.slice(cursor, b.start);
    cursor = b.end;

    const before = b.start > 0 ? src[b.start - 1] : '';
    const after = b.end < src.length ? src[b.end] : '';
    const atTextStart = b.start === 0;
    const atLineStart = before === '\n';

    if (isSpace(before) && (isSpace(after) || after === '')) {
      // A space on both sides (or the tag ends the text): drop exactly one space.
      if (isSpace(after)) cursor = b.end + 1;
      else if (clean.length > 0 && isSpace(clean[clean.length - 1])) clean = clean.slice(0, -1);
    } else if (atTextStart || atLineStart) {
      // A tag at the start of the text or a line drops the spaces directly after it.
      let k = b.end;
      while (k < src.length && isSpace(src[k])) k += 1;
      cursor = k;
    }

    const index = clean.length;
    let seconds = b.seconds;
    if (!Number.isFinite(seconds) || seconds <= 0) {
      seconds = 0;
    } else if (seconds > MAX_PAUSE_SECONDS) {
      seconds = MAX_PAUSE_SECONDS;
      clamped = true;
    }

    if (seconds > 0) {
      const last = pauses[pauses.length - 1];
      if (last && last.index === index) {
        const sum = last.seconds + seconds;
        last.seconds = sum > MAX_PAUSE_SECONDS ? MAX_PAUSE_SECONDS : sum;
        if (sum > MAX_PAUSE_SECONDS) clamped = true;
      } else {
        pauses.push({ index, seconds });
      }
    }
  }

  clean += src.slice(cursor);
  return { clean, pauses, count: pauses.length, clamped };
}

export function hasPauses(text) {
  return extractPauses(text).count > 0;
}

export function stripForRequest(text, breakMode) {
  if (breakMode === 'local') return extractPauses(text).clean;
  return text;
}