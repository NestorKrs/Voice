import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TAG_RE,
  BREAK_RE,
  formatBreak,
  formatTag,
  normalizeBreaks,
  findBreaks,
  directiveRanges,
  safeSplitIndex,
  stripDirectives,
  stripWithMap,
  hasSpeakableText,
  insertAt,
} from '../src/directives.js';

test('TAG_RE accepts letter tags and rejects digit/empty/newline', () => {
  assert.ok(TAG_RE.test('[slowly]'));
  assert.ok(TAG_RE.test("[under one's breath]"));
  assert.ok(TAG_RE.test('[soft-spoken]'));
  assert.equal(TAG_RE.test('[1]'), false);
  assert.equal(TAG_RE.test('[]'), false);
  assert.equal(TAG_RE.test('[a\nb]'), false);
});

test('BREAK_RE matches loose break forms case-insensitively', () => {
  assert.ok(BREAK_RE.test('<break time="1.2s" />'));
  assert.ok(BREAK_RE.test('<break time="1,2s">'));
  assert.ok(BREAK_RE.test('<BREAK time="2s"/>'));
});

test('normalizeBreaks tightens a loose tag', () => {
  const r = normalizeBreaks('<break time="1.2s" />');
  assert.equal(r.text, '<break time="1.2s"/>');
  assert.equal(r.count, 1);
  assert.equal(r.changed, 1);
});

test('normalizeBreaks leaves an already tight tag unchanged', () => {
  const r = normalizeBreaks('<break time="1.2s"/>');
  assert.equal(r.text, '<break time="1.2s"/>');
  assert.equal(r.count, 1);
  assert.equal(r.changed, 0);
});

test('normalizeBreaks converts a comma decimal to a dot', () => {
  const r = normalizeBreaks('<break time="1,2s"/>');
  assert.equal(r.text, '<break time="1.2s"/>');
  assert.equal(r.changed, 1);
});

test('normalizeBreaks lowercases an uppercase BREAK', () => {
  const r = normalizeBreaks('<BREAK time="2s"/>');
  assert.equal(r.text, '<break time="2s"/>');
  assert.equal(r.changed, 1);
});

test('normalizeBreaks counts two breaks', () => {
  const r = normalizeBreaks('<break time="1s" /> a <break time="2s" />');
  assert.equal(r.count, 2);
});

test('normalizeBreaks wholeSeconds rounds with a minimum of 1', () => {
  assert.equal(normalizeBreaks('<break time="1.2s"/>', { wholeSeconds: true }).text, '<break time="1s"/>');
  assert.equal(normalizeBreaks('<break time="0.4s"/>', { wholeSeconds: true }).text, '<break time="1s"/>');
});

test('normalizeBreaks with no break returns the same string', () => {
  const r = normalizeBreaks('just words');
  assert.equal(r.text, 'just words');
  assert.equal(r.count, 0);
  assert.equal(r.changed, 0);
});

test('formatBreak trims to at most 3 decimals without trailing zeros', () => {
  assert.equal(formatBreak(1.2), '<break time="1.2s"/>');
  assert.equal(formatBreak(2), '<break time="2s"/>');
  assert.equal(formatBreak(0.35), '<break time="0.35s"/>');
  assert.equal(formatBreak(1.23456), '<break time="1.235s"/>');
});

test('formatBreak rejects non-positive and non-finite seconds', () => {
  const msg = 'Break must be a positive number of seconds.';
  assert.throws(() => formatBreak(0), { message: msg });
  assert.throws(() => formatBreak(-1), { message: msg });
  assert.throws(() => formatBreak(NaN), { message: msg });
});

test('formatTag builds a tag and rejects bad names', () => {
  assert.equal(formatTag('slowly'), '[slowly]');
  assert.throws(() => formatTag(''), { message: 'Tag name is empty.' });
  assert.throws(() => formatTag('1abc'), { message: 'Tag name must start with a letter and cannot contain [ ] < >.' });
  assert.throws(() => formatTag('a[b'), { message: 'Tag name must start with a letter and cannot contain [ ] < >.' });
});

test('findBreaks reports positions and seconds in order', () => {
  const text = 'a <break time="1.2s" /> b <break time="2s"/>';
  const found = findBreaks(text);
  assert.equal(found.length, 2);
  assert.equal(found[0].start, 2);
  assert.equal(found[0].end, 2 + '<break time="1.2s" />'.length);
  assert.equal(found[0].seconds, 1.2);
  assert.equal(found[1].seconds, 2);
});

test('directiveRanges keeps tags and breaks and drops plain brackets', () => {
  const text = '[slowly] <break time="1s"/> [1]';
  const ranges = directiveRanges(text);
  assert.deepEqual(ranges, [
    { start: 0, end: 8, kind: 'tag' },
    { start: 9, end: 9 + '<break time="1s"/>'.length, kind: 'break' },
  ]);
});

test('safeSplitIndex moves an interior index to the range start', () => {
  const text = '[slowly] <break time="1s"/>';
  const breakStart = 9;
  assert.equal(safeSplitIndex(text, breakStart + 5), breakStart);
  assert.equal(safeSplitIndex(text, breakStart), breakStart);
  assert.equal(safeSplitIndex(text, breakStart + '<break time="1s"/>'.length), breakStart + '<break time="1s"/>'.length);
  assert.equal(safeSplitIndex(text, 100), 100);
});

test('stripDirectives and stripWithMap agree and map back to the original', () => {
  const text = '[slowly] Hello  there. <break time="1s"/> Bye.';
  const stripped = stripDirectives(text);
  assert.equal(stripped, 'Hello there. Bye.');
  const { text: mapped, map } = stripWithMap(text);
  assert.equal(mapped, stripped);
  assert.equal(map[0], 9);
  assert.equal(map[mapped.length], text.length);
});

test('hasSpeakableText ignores tags, breaks and punctuation', () => {
  assert.equal(hasSpeakableText('[slowly] <break time="1s"/> '), false);
  assert.equal(hasSpeakableText('...'), false);
  assert.equal(hasSpeakableText('[slowly] Hi'), true);
});

test('insertAt inserts mid-text with spacing and a caret', () => {
  const r = insertAt('ab cd', 2, 2, 'X');
  assert.equal(r.text, 'ab X cd');
  assert.equal(r.caret, 4);
});

test('insertAt at the start adds a trailing space', () => {
  const r = insertAt('hello', 0, 0, 'X');
  assert.equal(r.text, 'X hello');
  assert.equal(r.caret, 2);
});

test('insertAt at the end adds a leading space', () => {
  const r = insertAt('hello', 5, 5, 'X');
  assert.equal(r.text, 'hello X');
  assert.equal(r.caret, 7);
});

test('insertAt replaces a selection with spaces both sides', () => {
  const r = insertAt('aXc', 1, 2, 'Y');
  assert.equal(r.text, 'a Y c');
  assert.equal(r.caret, 4);
});

test('insertAt puts one space after a tag at a line start', () => {
  const r = insertAt('line1\nline2', 6, 6, '[slowly]');
  assert.equal(r.text, 'line1\n[slowly] line2');
  assert.equal(r.caret, 15);
});