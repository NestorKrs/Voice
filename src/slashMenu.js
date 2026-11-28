// Pure logic for the '/' command menu that inserts delivery tags and break tags.
import { formatBreak, formatTag } from './directives.js';
import { TAG_CATEGORIES, RETEST_TAGS } from './deliveryTags.js';

export const BREAK_PRESETS = [0.3, 0.5, 0.8, 1, 1.5, 2];

const HINT = 'Enter inserts, arrows move, Esc closes.';
const BREAK_WORD_RE = /^(break|pause)(\s*[0-9][0-9.,]*)?$/;

function normalizeSupport(support) {
  const s = support && typeof support === 'object' ? support : {};
  return {
    tags: s.tags || 'unknown',
    breaks: s.breaks || 'unknown',
    breakMode: s.breakMode || 'unknown',
    reasonTags: typeof s.reasonTags === 'string' ? s.reasonTags : '',
    reasonBreaks: typeof s.reasonBreaks === 'string' ? s.reasonBreaks : '',
  };
}

function applySupport(item, support) {
  if (item.kind === 'tag') {
    if (support.tags === 'unsupported') {
      item.disabled = true;
      item.reason = support.reasonTags || 'Not supported by this model.';
    } else if (support.tags === 'unknown' && !item.note) {
      item.note = 'untested on this model';
    }
  } else if (item.kind === 'break') {
    if (support.breaks === 'unsupported') {
      item.disabled = true;
      item.reason = support.reasonBreaks || 'Not supported by this model.';
    } else if (support.breaks === 'unknown' && !item.note) {
      item.note = 'untested on this model';
    }
  }
  return item;
}

function breakPresetItem(seconds, support) {
  return applySupport({
    id: 'break:' + seconds,
    kind: 'break',
    label: 'Pause ' + seconds + ' s',
    group: 'Pause',
    snippet: formatBreak(seconds),
    disabled: false,
    reason: '',
    note: '',
  }, support);
}

function breakNumberItem(n, support) {
  let seconds = n;
  let label = 'Pause ' + n + ' s';
  if (support.breakMode === 'whole') {
    seconds = Math.max(1, Math.round(n));
    label = 'Pause ' + seconds + ' s (whole seconds)';
  }
  return applySupport({
    id: 'break:' + seconds,
    kind: 'break',
    label,
    group: 'Pause',
    snippet: formatBreak(seconds),
    disabled: false,
    reason: '',
    note: '',
  }, support);
}

function secondsHint() {
  return {
    id: 'hint',
    kind: 'hint',
    label: 'Type seconds, for example /break 1.2',
    group: '',
    snippet: '',
    disabled: true,
    reason: 'Seconds must be above 0 and at most 60.',
    note: '',
  };
}

function tagItem(name, group, support) {
  return applySupport({
    id: 'tag:' + name,
    kind: 'tag',
    label: name,
    group,
    snippet: formatTag(name),
    disabled: false,
    reason: '',
    note: '',
  }, support);
}

function retestItem(name, support) {
  return applySupport({
    id: 'tag:' + name,
    kind: 'tag',
    label: name,
    group: 'Needs a retest',
    snippet: formatTag(name),
    disabled: false,
    reason: '',
    note: 'needs a retest',
  }, support);
}

function noMatchHint(q) {
  return {
    id: 'hint',
    kind: 'hint',
    label: 'No tag or pause matches "' + q + '"',
    group: '',
    snippet: '',
    disabled: true,
    reason: 'Try /slow, /soft, /break 1.2 or /pause 0.8.',
    note: '',
  };
}

export function parseSlashInput(input, support) {
  if (typeof input !== 'string' || input[0] !== '/') {
    return { active: false, items: [], hint: '' };
  }
  const s = normalizeSupport(support);
  const q = input.slice(1).trim();
  const lower = q.toLowerCase();
  const items = [];

  const breakMatch = BREAK_WORD_RE.exec(q);
  if (breakMatch) {
    const numStr = breakMatch[2];
    if (numStr === undefined) {
      for (const secs of BREAK_PRESETS) items.push(breakPresetItem(secs, s));
    } else {
      const n = parseFloat(numStr.replace(',', '.'));
      if (Number.isFinite(n) && n > 0 && n <= 60) {
        items.push(breakNumberItem(n, s));
      } else {
        items.push(secondsHint());
      }
    }
    return { active: true, items, hint: HINT };
  }

  const prefix = q.length > 0 && ('break'.startsWith(lower) || 'pause'.startsWith(lower));
  if (prefix) {
    for (const secs of BREAK_PRESETS) items.push(breakPresetItem(secs, s));
  }

  for (const cat of TAG_CATEGORIES) {
    const catLabelMatch = cat.label.toLowerCase().includes(lower);
    for (const name of cat.tags) {
      if (lower === '' || catLabelMatch || name.toLowerCase().includes(lower)) {
        items.push(tagItem(name, cat.label, s));
      }
    }
  }

  if (lower !== '') {
    for (const name of RETEST_TAGS) {
      if (name.toLowerCase().includes(lower)) items.push(retestItem(name, s));
    }
  }

  if (items.length === 0) items.push(noMatchHint(q));

  return { active: true, items, hint: HINT };
}

export function moveHighlight(index, delta, items) {
  const list = Array.isArray(items) ? items : [];
  const enabled = [];
  list.forEach((it, i) => {
    if (it && !it.disabled && it.kind !== 'hint') enabled.push(i);
  });
  const n = enabled.length;
  if (n === 0) return -1;
  const pos = enabled.indexOf(index);
  if (pos === -1) {
    if (delta > 0) {
      const after = enabled.find((i) => i > index);
      return after !== undefined ? after : enabled[0];
    }
    const before = [...enabled].reverse().find((i) => i < index);
    return before !== undefined ? before : enabled[n - 1];
  }
  const next = (((pos + delta) % n) + n) % n;
  return enabled[next];
}

export function slashGroupNames(items) {
  const names = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (item && item.group && !names.includes(item.group)) names.push(item.group);
  }
  return names;
}

export function slashEntries(items, query, category) {
  const list = Array.isArray(items) ? items : [];
  if (typeof query === 'string' && query.trim() !== '') return list;
  const groups = slashGroupNames(list).map((group) => ({
    id: 'group:' + group,
    kind: 'group',
    group,
    label: group,
    disabled: false,
    reason: '',
  }));
  return category ? groups.concat(list.filter((item) => item.group === category)) : groups;
}

export function slashContext(text, caret) {
  if (typeof text !== 'string') return { active: false };
  const pos = Math.max(0, Math.min(Math.trunc(caret) || 0, text.length));
  let start = -1;
  for (let i = pos - 1; i >= 0 && pos - i <= 40; i -= 1) {
    if (text[i] === '/') { start = i; break; }
  }
  if (start < 0) return { active: false };
  const query = text.slice(start, pos);
  if (query.length > 1 && (query[1] === ' ' || query[1] === '\t')) return { active: false };
  if (query.length > 40) return { active: false };
  return { active: true, start, end: pos, query };
}