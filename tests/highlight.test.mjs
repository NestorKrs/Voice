import test from 'node:test';
import assert from 'node:assert/strict';
import { highlightRange } from '../src/highlight.js';

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
