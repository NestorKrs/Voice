import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIDE_MIN_PX, SIDE_MAX_PCT, DEFAULT_WIDTHS, WIDTHS_KEY,
  middlePct, usableWidth, limitsFor, clampWidths, resizeFromHandle, columnsTemplate,
  loadWidths, saveWidths, resetWidths,
} from '../src/panelWidths.js';
import { DEFAULT_ORDER, normalizeOrder, movePanel, stepPanel, loadOrder } from '../src/panelLayout.js';

const EPS = 1e-9;
const near = (a, b) => Math.abs(a - b) < 1e-6;

test('panelLayout: default order', () => {
  assert.deepEqual(DEFAULT_ORDER, ['text', 'reader']);
});

test('panelLayout: normalizeOrder saved with extra id', () => {
  assert.deepEqual(normalizeOrder(['text', 'reader', 'job']), ['text', 'reader']);
  assert.deepEqual(normalizeOrder(['reader', 'text', 'job']), ['reader', 'text']);
  assert.deepEqual(normalizeOrder(['text']), ['text', 'reader']);
  assert.deepEqual(normalizeOrder('garbage'), ['text', 'reader']);
});

test('panelWidths: defaults sum to 100', () => {
  assert.deepEqual(DEFAULT_WIDTHS, { left: 33.33, right: 66.67 });
  assert.ok(near(DEFAULT_WIDTHS.left + DEFAULT_WIDTHS.right, 100));
});

test('usableWidth subtracts padding and one handle', () => {
  assert.equal(usableWidth(1200), 1200 - 24 - 12);
});

test('limitsFor null when too narrow', () => {
  assert.equal(limitsFor(0), null);
  assert.equal(limitsFor(500), null);
});

test('clampWidths fallback for old three-panel value', () => {
  assert.deepEqual(clampWidths({ left: 25, right: 25 }, 1200), DEFAULT_WIDTHS);
  assert.deepEqual(clampWidths({ left: 22, right: 27 }, 1200), DEFAULT_WIDTHS);
});

test('clampWidths keeps valid two-panel value', () => {
  assert.deepEqual(clampWidths({ left: 40, right: 60 }, 1200), { left: 40, right: 60 });
});

test('clampWidths clamps left at 1200px', () => {
  const r = clampWidths({ left: 10, right: 90 }, 1200);
  assert.ok(near(r.left, (280 / 1200) * 100));
  assert.ok(near(r.right, 100 - (280 / 1200) * 100));
});

test('clampWidths left never above 80', () => {
  const r = clampWidths({ left: 95, right: 5 }, 1200);
  assert.ok(r.left <= 80 + EPS);
});

test('resizeFromHandle moves left by 10 for +120px', () => {
  const r = resizeFromHandle({ left: 40, right: 60 }, 0, 120, 1200);
  assert.ok(near(r.left, 50));
  assert.ok(near(r.right, 50));
});

test('resizeFromHandle index 1 unchanged', () => {
  const start = { left: 40, right: 60 };
  assert.deepEqual(resizeFromHandle(start, 1, 120, 1200), start);
});

test('columnsTemplate two tracks one handle', () => {
  assert.equal(columnsTemplate({ left: 40, right: 60 }), 'minmax(0, 40fr) 12px minmax(0, 60fr)');
});

test('saveWidths/loadWidths round trip', () => {
  const calls = [];
  const storage = { setItem: (k, v) => calls.push([k, v]), getItem: (k) => calls[0][1] };
  assert.equal(saveWidths(storage, { left: 40, right: 60 }), true);
  assert.deepEqual(loadWidths(storage), { left: 40, right: 60 });
});

test('three-entry object falls back', () => {
  assert.deepEqual(clampWidths({ left: 20, mid: 30, right: 50 }, 1200), DEFAULT_WIDTHS);
});
