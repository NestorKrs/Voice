import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ORDER, normalizeOrder, movePanel, stepPanel, loadOrder } from '../src/panelLayout.js';

test('normalizeOrder: default', () => {
  assert.deepEqual(DEFAULT_ORDER, ['text', 'reader']);
});

test('normalizeOrder: drops unknown and appends missing', () => {
  assert.deepEqual(normalizeOrder(['text', 'reader', 'job']), ['text', 'reader']);
  assert.deepEqual(normalizeOrder(['reader', 'text', 'job']), ['reader', 'text']);
  assert.deepEqual(normalizeOrder(['text']), ['text', 'reader']);
  assert.deepEqual(normalizeOrder('garbage'), ['text', 'reader']);
});

test('movePanel and stepPanel on two ids', () => {
  assert.deepEqual(movePanel(['text', 'reader'], 'text', 'reader', 'after'), ['reader', 'text']);
  assert.deepEqual(stepPanel(['text', 'reader'], 'text', 1), ['reader', 'text']);
});

test('loadOrder valid', () => {
  assert.deepEqual(loadOrder({ getItem: () => '["reader","text"]' }), ['reader', 'text']);
});
