import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from '../src/textStats.js';

test('empty text', () => {
  const s = computeStats({ text: '', chunkSize: 2000, usedToday: 0 });
  assert.equal(s.characters, 0);
  assert.equal(s.pages, 0);
  assert.equal(s.chunks, 0);
  assert.equal(s.daysNeeded, 0);
});

test('short text', () => {
  const s = computeStats({ text: 'hello', chunkSize: 2000, usedToday: 0 });
  assert.equal(s.chunks, 1);
  assert.equal(s.fitsToday, true);
  assert.equal(s.daysNeeded, 1);
});

test('100000 chars fits today', () => {
  const text = 'a'.repeat(100000);
  const s = computeStats({ text, chunkSize: 2000, usedToday: 0 });
  assert.equal(s.fitsToday, true);
  assert.equal(s.daysNeeded, 1);
});

test('100000 chars usedToday 20 does not fit', () => {
  const text = 'a'.repeat(100000);
  const s = computeStats({ text, chunkSize: 2000, usedToday: 20 });
  assert.equal(s.fitsToday, false);
  assert.equal(s.daysNeeded, 2);
});

test('more than 100 requests needs 3+ days', () => {
  const text = 'a'.repeat(300000);
  const s = computeStats({ text, chunkSize: 2000, usedToday: 0 });
  assert.ok(s.requestsNeeded > 100);
  assert.ok(s.daysNeeded >= 3);
});