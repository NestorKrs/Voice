// Pure helpers for delivery tags like [slowly] and break tags like <break time="1.2s"/>.
// No imports: this module is a leaf the UI and the chunker will consume later.

export const TAG_RE = /\[[A-Za-z][^[\]<>\n]{0,39}\]/;

export const BREAK_RE = /<break\s+time\s*=\s*"(\d+(?:[.,]\d+)?)s"\s*\/?>/i;

const breakReGlobal = () => new RegExp(BREAK_RE.source, 'gi');
const tagReGlobal = () => new RegExp(TAG_RE.source, 'g');

function formatSeconds(seconds) {
  return String(Math.round(seconds * 1000) / 1000);
}

export function formatBreak(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    throw new Error('Break must be a positive number of seconds.');
  }
  return '<break time="' + formatSeconds(seconds) + 's"/>';
}

const tagReFull = new RegExp('^' + TAG_RE.source + '$');

export function formatTag(name) {
  const raw = typeof name === 'string' ? name : '';
  const trimmed = raw.trim();
  if (trimmed === '') throw new Error('Tag name is empty.');
  const tag = '[' + trimmed + ']';
  if (!tagReFull.test(tag)) {
    throw new Error('Tag name must start with a letter and cannot contain [ ] < >.');
  }
  return tag;
}

export function findBreaks(text) {
  const src = typeof text === 'string' ? text : '';
  const re = breakReGlobal();
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      seconds: parseFloat(m[1].replace(',', '.')),
    });
  }
  return out;
}

export function normalizeBreaks(text, options = {}) {
  const src = typeof text === 'string' ? text : '';
  const whole = options.wholeSeconds === true;
  let count = 0;
  let changed = 0;
  const out = src.replace(breakReGlobal(), (match, num) => {
    count += 1;
    let seconds = parseFloat(num.replace(',', '.'));
    if (whole) seconds = Math.max(1, Math.round(seconds));
    const tight = formatBreak(seconds);
    if (tight !== match) changed += 1;
    return tight;
  });
  return { text: out, count, changed };
}

export function directiveRanges(text) {
  const src = typeof text === 'string' ? text : '';
  const ranges = [];
  const tagRe = tagReGlobal();
  let m;
  while ((m = tagRe.exec(src)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length, kind: 'tag' });
  }
  for (const b of findBreaks(src)) {
    ranges.push({ start: b.start, end: b.end, kind: 'break' });
  }
  ranges.sort((a, b) => a.start - b.start || (a.kind === 'break' ? -1 : 1));
  const out = [];
  for (const r of ranges) {
    const last = out[out.length - 1];
    if (last && r.start < last.end) {
      if (r.kind === 'break' && last.kind === 'tag') {
        out.pop();
        out.push(r);
      }
      continue;
    }
    out.push(r);
  }
  return out;
}

export function safeSplitIndex(text, index) {
  for (const r of directiveRanges(text)) {
    if (r.start < index && index < r.end) return r.start;
  }
  return index;
}

export function stripWithMap(text) {
  const src = typeof text === 'string' ? text : '';
  const ranges = directiveRanges(src);
  const kept = [];
  let r = 0;
  for (let i = 0; i < src.length; i += 1) {
    if (r < ranges.length && i === ranges[r].start) {
      i = ranges[r].end - 1;
      r += 1;
      continue;
    }
    kept.push({ ch: src[i], idx: i });
  }
  const chars = [];
  const map = [];
  let k = 0;
  while (k < kept.length) {
    const cur = kept[k];
    if (cur.ch === ' ' || cur.ch === '\t') {
      let j = k;
      while (j < kept.length && (kept[j].ch === ' ' || kept[j].ch === '\t')) j += 1;
      const next = j < kept.length ? kept[j].ch : '';
      if (next !== '\n') {
        chars.push(' ');
        map.push(cur.idx);
      }
      k = j;
      continue;
    }
    chars.push(cur.ch);
    map.push(cur.idx);
    k += 1;
  }
  let start = 0;
  while (start < chars.length && chars[start] === ' ') start += 1;
  let end = chars.length;
  while (end > start && chars[end - 1] === ' ') end -= 1;
  const outChars = chars.slice(start, end);
  const outMap = map.slice(start, end);
  outMap.push(src.length);
  return { text: outChars.join(''), map: outMap };
}

export function stripDirectives(text) {
  return stripWithMap(text).text;
}

export function hasSpeakableText(text) {
  return /[\p{L}\p{N}]/u.test(stripDirectives(text));
}

export function insertAt(text, selectionStart, selectionEnd, snippet) {
  const src = typeof text === 'string' ? text : '';
  const ins = typeof snippet === 'string' ? snippet : String(snippet);
  let start = Math.max(0, Math.min(selectionStart, src.length));
  let end = Math.max(0, Math.min(selectionEnd, src.length));
  if (start > end) {
    const swap = start;
    start = end;
    end = swap;
  }
  const before = start > 0 ? src[start - 1] : '';
  const after = end < src.length ? src[end] : '';
  const isTag = ins.startsWith('[');
  const lead = before !== '' && !/\s/.test(before) ? ' ' : '';
  let trail = '';
  if (isTag) {
    if (after === '\n') trail = '';
    else if (after !== '' && /\s/.test(after)) trail = '';
    else trail = ' ';
  } else if (after !== '' && !/\s/.test(after)) {
    trail = ' ';
  }
  const inserted = lead + ins + trail;
  const out = src.slice(0, start) + inserted + src.slice(end);
  return { text: out, caret: start + inserted.length };
}