import test from 'node:test';
import assert from 'node:assert/strict';
import { reorderIds } from '../src/clipOrder.js';

test('dragging down places the row after the target', () => {
  assert.deepEqual(reorderIds([0, 1, 2, 3], 0, 2), [1, 2, 0, 3]);
});

test('dragging up places the row before the target', () => {
  assert.deepEqual(reorderIds([0, 1, 2, 3], 3, 1), [0, 3, 1, 2]);
});

test('one step in each direction', () => {
  assert.deepEqual(reorderIds([0, 1, 2], 0, 1), [1, 0, 2]);
  assert.deepEqual(reorderIds([0, 1, 2], 2, 1), [0, 2, 1]);
});

test('ids need not be contiguous or start at zero', () => {
  assert.deepEqual(reorderIds([4, 7, 9], 4, 9), [7, 9, 4]);
});

test('a same-position or missing id leaves the list untouched', () => {
  const ids = [0, 1, 2];
  assert.strictEqual(reorderIds(ids, 1, 1), ids);
  assert.strictEqual(reorderIds(ids, 9, 0), ids);
  assert.strictEqual(reorderIds(ids, 0, 9), ids);
});

test('the input array is not modified', () => {
  const ids = [0, 1, 2, 3];
  const next = reorderIds(ids, 0, 3);
  assert.deepEqual(ids, [0, 1, 2, 3]);
  assert.notStrictEqual(next, ids);
});
