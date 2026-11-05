import test from 'node:test';
import assert from 'node:assert/strict';
import { utcDayKey, nextResetUtcMs, createRequestCounter } from '../src/requestCounter.js';

test('starts at 0', () => {
  const storage = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  const c = createRequestCounter(storage);
  assert.equal(c.count(), 0);
});

test('add and count', () => {
  const storage = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  const c = createRequestCounter(storage);
  c.add();
  c.add();
  assert.equal(c.count(), 2);
});

test('add(3)', () => {
  const storage = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  const c = createRequestCounter(storage);
  c.add(3);
  assert.equal(c.count(), 3);
});

test('new UTC day starts at 0', () => {
  let now = Date.UTC(2026, 0, 1, 23, 59, 59);
  const storage = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  const c = createRequestCounter(storage, () => now);
  c.add(5);
  assert.equal(c.count(), 5);
  now = Date.UTC(2026, 0, 2, 0, 0, 0);
  assert.equal(c.count(), 0);
});

test('nextResetUtcMs mid-day', () => {
  const now = Date.UTC(2026, 5, 15, 12, 30, 0);
  const r = nextResetUtcMs(now);
  assert.equal(r, Date.UTC(2026, 5, 16, 0, 0, 0));
});

test('nextResetUtcMs near midnight', () => {
  const now = Date.UTC(2026, 5, 15, 23, 59, 59, 999);
  const r = nextResetUtcMs(now);
  assert.equal(r, Date.UTC(2026, 5, 16, 0, 0, 0));
});

test('broken JSON gives 0', () => {
  const storage = { data: { 'voice.requests': '{bad' }, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  const c = createRequestCounter(storage);
  assert.equal(c.count(), 0);
});

test('resetAt returns next reset', () => {
  const now = Date.UTC(2026, 0, 1, 10, 0, 0);
  const storage = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  const c = createRequestCounter(storage, () => now);
  assert.equal(c.resetAt(), Date.UTC(2026, 0, 2, 0, 0, 0));
});