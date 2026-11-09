import test from 'node:test';
import assert from 'node:assert/strict';
import { findMatches, nextIndex } from '../src/textFind.js';

test('findMatches: empty query returns []', () => {
  assert.deepEqual(findMatches('hello world', ''), []);
  assert.deepEqual(findMatches('', ''), []);
});

test('findMatches: no match returns []', () => {
  assert.deepEqual(findMatches('hello world', 'zzz'), []);
  assert.deepEqual(findMatches('', 'a'), []);
});

test('findMatches: several matches in order', () => {
  assert.deepEqual(findMatches('one two one two one', 'one'), [0, 8, 16]);
});

test('findMatches: case-insensitive on both sides', () => {
  assert.deepEqual(findMatches('Hello HELLO hello', 'hello'), [0, 6, 12]);
  assert.deepEqual(findMatches('Hello HELLO hello', 'HELLO'), [0, 6, 12]);
});

test('findMatches: overlapping aa in aaaa gives 0 and 2', () => {
  assert.deepEqual(findMatches('aaaa', 'aa'), [0, 2]);
});

test('findMatches: literal special characters', () => {
  assert.deepEqual(findMatches('a.b (c) a.b', 'a.b'), [0, 8]);
  assert.deepEqual(findMatches('a.b (c) a.b', '(c)'), [4]);
  assert.deepEqual(findMatches('a+b*c', '+b*'), [1]);
});

test('nextIndex: count 0 returns -1', () => {
  assert.equal(nextIndex(-1, 0, 1), -1);
  assert.equal(nextIndex(2, 0, -1), -1);
});

test('nextIndex: current -1 starts at the first or last match', () => {
  assert.equal(nextIndex(-1, 3, 1), 0);
  assert.equal(nextIndex(-1, 3, -1), 2);
});

test('nextIndex: wraps forward and backward', () => {
  assert.equal(nextIndex(0, 3, 1), 1);
  assert.equal(nextIndex(2, 3, 1), 0);
  assert.equal(nextIndex(0, 3, -1), 2);
  assert.equal(nextIndex(2, 3, -1), 1);
});
