import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ORDER, ORDER_KEY, normalizeOrder, movePanel, stepPanel, loadOrder, saveOrder, resetOrder } from '../src/panelLayout.js';

const D = ['text', 'reader', 'job'];

test('normalizeOrder: non-array gives the default', () => {
  assert.deepEqual(normalizeOrder(null), D);
  assert.deepEqual(normalizeOrder('x'), D);
});

test('normalizeOrder: drops unknown ids and duplicates, appends missing in default order', () => {
  assert.deepEqual(normalizeOrder(['job', 'x', 'job', 'text']), ['job', 'text', 'reader']);
});

test('movePanel: before and after', () => {
  assert.deepEqual(movePanel(D, 'job', 'text', 'before'), ['job', 'text', 'reader']);
  assert.deepEqual(movePanel(D, 'text', 'job', 'after'), ['reader', 'job', 'text']);
});

test('movePanel: same id or unknown id changes nothing', () => {
  assert.deepEqual(movePanel(D, 'reader', 'reader', 'before'), D);
  assert.deepEqual(movePanel(D, 'nope', 'text', 'before'), D);
  assert.deepEqual(movePanel(D, 'text', 'nope', 'before'), D);
});

test('movePanel: does not change its input', () => {
  const input = ['text', 'reader', 'job'];
  movePanel(input, 'job', 'text', 'before');
  assert.deepEqual(input, D);
});

test('stepPanel: moves by one and stops at the ends', () => {
  assert.deepEqual(stepPanel(D, 'text', 1), ['reader', 'text', 'job']);
  assert.deepEqual(stepPanel(D, 'job', -1), ['text', 'job', 'reader']);
  assert.deepEqual(stepPanel(D, 'text', -1), D);
  assert.deepEqual(stepPanel(D, 'job', 1), D);
  assert.deepEqual(stepPanel(D, 'zzz', 1), D);
});

test('loadOrder: empty, valid, corrupt, wrong shape and throwing storage', () => {
  assert.deepEqual(loadOrder({ getItem: () => null }), D);
  assert.deepEqual(loadOrder({ getItem: () => '["job","text","reader"]' }), ['job', 'text', 'reader']);
  assert.deepEqual(loadOrder({ getItem: () => 'not json' }), D);
  assert.deepEqual(loadOrder({ getItem: () => '{"a":1}' }), D);
  assert.deepEqual(loadOrder({ getItem: () => { throw new Error('blocked'); } }), D);
});

test('saveOrder: writes a normalized list and reports failure', () => {
  const calls = [];
  const ok = saveOrder({ setItem: (k, v) => calls.push([k, v]) }, ['job']);
  assert.equal(ok, true);
  assert.deepEqual(calls, [[ORDER_KEY, '["job","text","reader"]']]);
  assert.equal(saveOrder({ setItem: () => { throw new Error('full'); } }, D), false);
});

test('resetOrder: removes the key and reports failure', () => {
  const removed = [];
  assert.equal(resetOrder({ removeItem: (k) => removed.push(k) }), true);
  assert.deepEqual(removed, [ORDER_KEY]);
  assert.equal(resetOrder({ removeItem: () => { throw new Error('blocked'); } }), false);
});
