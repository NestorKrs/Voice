import test from 'node:test';
import assert from 'node:assert/strict';
import { highlightRange, charAtFraction } from '../src/highlight.js';

test('words: picks the word containing the offset', () => {
  const text = 'hello world again';
  assert.deepEqual(highlightRange(text, 'words', 0), { start: 0, end: 5 });
  assert.deepEqual(highlightRange(text, 'words', 4), { start: 0, end: 5 });
  assert.deepEqual(highlightRange(text, 'words', 6), { start: 6, end: 11 });
  assert.deepEqual(highlightRange(text, 'words', 12), { start: 12, end: 17 });
});

test('words: whitespace after a word keeps that word', () => {
  assert.deepEqual(highlightRange('hello world', 'words', 5), { start: 0, end: 5 });
});

test('words: clamps the offset to the text', () => {
  assert.deepEqual(highlightRange('hello world', 'words', 999), { start: 6, end: 11 });
  assert.deepEqual(highlightRange('hello world', 'words', -5), { start: 0, end: 5 });
});

test('words: unknown mode behaves like words', () => {
  assert.deepEqual(highlightRange('hello world', undefined, 7), { start: 6, end: 11 });
});

test('sentences: picks the sentence containing the offset', () => {
  const text = 'One. Two. Three.';
  const first = highlightRange(text, 'sentences', 0);
  assert.equal(text.slice(first.start, first.end), 'One. ');
  const second = highlightRange(text, 'sentences', 5);
  assert.equal(text.slice(second.start, second.end), 'Two. ');
  const last = highlightRange(text, 'sentences', 999);
  assert.equal(text.slice(last.start, last.end), 'Three.');
});

test('empty text', () => {
  assert.deepEqual(highlightRange('', 'words', 0), { start: 0, end: 0 });
  assert.deepEqual(highlightRange('', 'sentences', 0), { start: 0, end: 0 });
});

test('charAtFraction: fraction 0 returns 0', () => {
  assert.equal(charAtFraction('hello world', 0), 0);
});

test('charAtFraction: fraction 1 returns the last index', () => {
  const text = 'hello world';
  assert.equal(charAtFraction(text, 1), text.length - 1);
});

test('charAtFraction: a full stop moves the highlight slower than a linear estimate', () => {
  const chunk = 'Hello world. This sentence is much longer than the first one.';
  const fraction = 0.25;
  const weighted = charAtFraction(chunk, fraction);
  const linear = Math.floor(fraction * chunk.length);
  assert.equal(weighted, chunk.indexOf('.'));
  assert.ok(weighted < linear, `weighted ${weighted} should be before linear ${linear}`);
});

test('charAtFraction: empty text is safe', () => {
  assert.equal(charAtFraction('', 0), 0);
  assert.equal(charAtFraction('', 0.5), 0);
  assert.equal(charAtFraction('', 1), 0);
});

import { sentenceRanges } from '../src/highlight.js';

test('sentenceRanges: three sentences give three ranges that cover the text', () => {
  const text = 'One. Two. Three.';
  const ranges = sentenceRanges(text);
  assert.equal(ranges.length, 3);
  assert.equal(text.slice(ranges[0].start, ranges[ranges.length - 1].end), text);
  assert.deepEqual(ranges, [
    { start: 0, end: 5 },
    { start: 5, end: 10 },
    { start: 10, end: 16 },
  ]);
});

test('sentenceRanges: each range equals highlightRange at its own start', () => {
  const text = 'One. Two. Three.';
  for (const range of sentenceRanges(text)) {
    assert.deepEqual(highlightRange(text, 'sentences', range.start), range);
  }
});

test('sentenceRanges: empty text gives no ranges', () => {
  assert.deepEqual(sentenceRanges(''), []);
});
