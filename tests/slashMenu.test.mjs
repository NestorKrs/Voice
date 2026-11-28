import test from 'node:test';
import assert from 'node:assert/strict';
import { BREAK_PRESETS, parseSlashInput, moveHighlight } from '../src/slashMenu.js';
import { TAG_CATEGORIES, RETEST_TAGS } from '../src/deliveryTags.js';

const CONFIRMED = { tags: 'confirmed', breaks: 'confirmed', breakMode: 'decimal', reasonTags: '', reasonBreaks: '' };

test('BREAK_PRESETS are the agreed numbers', () => {
  assert.deepEqual(BREAK_PRESETS, [0.3, 0.5, 0.8, 1, 1.5, 2]);
});

test('"/" alone gives all tag items and no breaks', () => {
  const r = parseSlashInput('/', CONFIRMED);
  const sum = TAG_CATEGORIES.reduce((n, c) => n + c.tags.length, 0);
  assert.equal(r.active, true);
  assert.equal(r.items.length, sum);
  assert.equal(r.items.length, 56);
  assert.ok(r.items.every((i) => i.kind === 'tag'));
});

test('"/slow" matches slowly and very slowly only', () => {
  const r = parseSlashInput('/slow', CONFIRMED);
  const expected = [];
  for (const c of TAG_CATEGORIES) {
    for (const name of c.tags) {
      if (name.toLowerCase().includes('slow')) expected.push(name);
    }
  }
  assert.deepEqual(r.items.map((i) => i.label), expected);
  assert.deepEqual(expected, ['slowly', 'very slowly']);
});

test('"/whisp" by category label gives the whole Whisper category', () => {
  const r = parseSlashInput('/whisp', CONFIRMED);
  const whisper = TAG_CATEGORIES.find((c) => c.label.toLowerCase().includes('whisp'));
  assert.equal(r.items.length, whisper.tags.length);
  assert.deepEqual(r.items.map((i) => i.label), whisper.tags);
});

test('"/break" gives the six preset items', () => {
  const r = parseSlashInput('/break', CONFIRMED);
  assert.equal(r.items.length, 6);
  assert.ok(r.items.every((i) => i.kind === 'break'));
  assert.deepEqual(r.items.map((i) => i.snippet), BREAK_PRESETS.map((s) => '<break time="' + s + 's"/>'));
});

test('"/break 1.2" gives one break item', () => {
  const r = parseSlashInput('/break 1.2', CONFIRMED);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].snippet, '<break time="1.2s"/>');
  assert.equal(r.items[0].label, 'Pause 1.2 s');
});

test('"/pause1.2" and "/pause 1,2" match "/break 1.2"', () => {
  const a = parseSlashInput('/pause1.2', CONFIRMED);
  const b = parseSlashInput('/pause 1,2', CONFIRMED);
  assert.equal(a.items[0].snippet, '<break time="1.2s"/>');
  assert.equal(b.items[0].snippet, '<break time="1.2s"/>');
});

test('"/break 0", "/break 61" give the seconds hint; "/break abc" gives no-match', () => {
  const zero = parseSlashInput('/break 0', CONFIRMED);
  assert.deepEqual(zero.items[0], {
    id: 'hint', kind: 'hint', label: 'Type seconds, for example /break 1.2', group: '', snippet: '', disabled: true, reason: 'Seconds must be above 0 and at most 60.', note: '',
  });
  const over = parseSlashInput('/break 61', CONFIRMED);
  assert.equal(over.items[0].reason, 'Seconds must be above 0 and at most 60.');
  const abc = parseSlashInput('/break abc', CONFIRMED);
  assert.equal(abc.items[0].label, 'No tag or pause matches "break abc"');
});

test('breakMode whole rounds 1.2 to 1 and 0.4 to 1', () => {
  const whole = { ...CONFIRMED, breakMode: 'whole' };
  const a = parseSlashInput('/break 1.2', whole);
  assert.equal(a.items[0].snippet, '<break time="1s"/>');
  assert.equal(a.items[0].label, 'Pause 1 s (whole seconds)');
  const b = parseSlashInput('/break 0.4', whole);
  assert.equal(b.items[0].snippet, '<break time="1s"/>');
});

test('"/br" puts presets first then tag matches', () => {
  const r = parseSlashInput('/br', CONFIRMED);
  assert.equal(r.items.slice(0, 6).every((i) => i.kind === 'break'), true);
});

test('support unsupported disables with the given reason and a default when empty', () => {
  const withReason = parseSlashInput('/slow', { tags: 'unsupported', breaks: 'unknown', breakMode: 'unknown', reasonTags: 'No tags here.', reasonBreaks: '' });
  assert.equal(withReason.items[0].disabled, true);
  assert.equal(withReason.items[0].reason, 'No tags here.');
  const noReason = parseSlashInput('/slow', { tags: 'unsupported', breaks: 'unknown', breakMode: 'unknown', reasonTags: '', reasonBreaks: '' });
  assert.equal(noReason.items[0].reason, 'Not supported by this model.');
});

test('support unknown adds the untested note; confirmed adds none', () => {
  const unknown = parseSlashInput('/slow', { tags: 'unknown', breaks: 'unknown', breakMode: 'unknown', reasonTags: '', reasonBreaks: '' });
  assert.equal(unknown.items[0].note, 'untested on this model');
  const confirmed = parseSlashInput('/slow', CONFIRMED);
  assert.equal(confirmed.items[0].note, '');
});

test('"/emph" shows emphatically in Needs a retest with its note', () => {
  const r = parseSlashInput('/emph', CONFIRMED);
  const item = r.items.find((i) => i.label === 'emphatically');
  assert.ok(item);
  assert.equal(item.group, 'Needs a retest');
  assert.equal(item.note, 'needs a retest');
  assert.ok(RETEST_TAGS.includes('emphatically'));
});

test('no match gives the hint item', () => {
  const r = parseSlashInput('/zzzz', CONFIRMED);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].kind, 'hint');
  assert.equal(r.items[0].label, 'No tag or pause matches "zzzz"');
});

test('non-slash, empty and non-string inputs are inactive', () => {
  for (const input of ['hello', '', 42, null, undefined]) {
    assert.deepEqual(parseSlashInput(input, CONFIRMED), { active: false, items: [], hint: '' });
  }
});

test('ids are unique and stable', () => {
  const r = parseSlashInput('/', CONFIRMED);
  const ids = r.items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('tag:slowly'));
});

test('moveHighlight wraps, skips disabled and hints, and returns -1 when none enabled', () => {
  const items = [
    { id: 'a', kind: 'tag', disabled: false },
    { id: 'b', kind: 'tag', disabled: true },
    { id: 'c', kind: 'tag', disabled: false },
    { id: 'h', kind: 'hint', disabled: true },
  ];
  assert.equal(moveHighlight(-1, 1, items), 0);
  assert.equal(moveHighlight(0, 1, items), 2);
  assert.equal(moveHighlight(2, 1, items), 0);
  assert.equal(moveHighlight(0, -1, items), 2);
  assert.equal(moveHighlight(99, 1, items), 0);
  const allOff = [{ id: 'a', kind: 'tag', disabled: true }, { id: 'h', kind: 'hint', disabled: true }];
  assert.equal(moveHighlight(-1, 1, allOff), -1);
});

test('inputs are not modified', () => {
  const support = { tags: 'unknown', breaks: 'unknown', breakMode: 'unknown', reasonTags: '', reasonBreaks: '' };
  const snapshot = JSON.stringify(support);
  parseSlashInput('/slow', support);
  assert.equal(JSON.stringify(support), snapshot);
});