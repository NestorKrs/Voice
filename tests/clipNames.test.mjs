import test from 'node:test';
import assert from 'node:assert/strict';
import { realignNames, firstSentence } from '../src/clipNames.js';

test('a cut added before a named clip leaves the name on the right clip', () => {
  const names = ['A', 'B', 'C'];
  const result = realignNames(names, [1000, 2000], [500, 1000, 2000]);
  assert.deepEqual(result, ['A', '', 'B', 'C']);
  assert.deepEqual(names, ['A', 'B', 'C']);
});

test('deleting a cut drops the name of the clip that started there', () => {
  assert.deepEqual(realignNames(['A', 'B', 'C'], [1000, 2000], [2000]), ['A', 'C']);
});

test('undoing an insertion restores the original names', () => {
  assert.deepEqual(realignNames(['A', '', 'B', 'C'], [500, 1000, 2000], [1000, 2000]), ['A', 'B', 'C']);
});

test('moving a cut keeps names by index', () => {
  assert.deepEqual(realignNames(['A', 'B', 'C'], [1000, 2000], [1200, 2000]), ['A', 'B', 'C']);
});

test('restored markers start with empty names and short name lists are padded', () => {
  assert.deepEqual(realignNames([], [1000, 2000], [1000, 2000]), ['', '', '']);
  assert.deepEqual(realignNames(['A'], [], [1000]), ['A', '']);
});

test('firstSentence returns only the first sentence', () => {
  assert.equal(firstSentence('One. Two three.'), 'One.');
  assert.equal(firstSentence('  Hello there, world! And more.'), 'Hello there, world!');
});

test('firstSentence keeps short text and truncates long sentences', () => {
  assert.equal(firstSentence('no full stop here'), 'no full stop here');
  assert.equal(firstSentence('x '.repeat(80), 20), 'x x x x x x x x x x…');
});

test('firstSentence is safe on empty and non-string input', () => {
  assert.equal(firstSentence(''), '');
  assert.equal(firstSentence('   '), '');
  assert.equal(firstSentence(null), '');
});
