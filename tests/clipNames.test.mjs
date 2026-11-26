import test from 'node:test';
import assert from 'node:assert/strict';
import { realignNames } from '../src/clipNames.js';

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
