import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_SPAN, fullView, clampView, zoomAt, wheelFactor,
  panBy, panByPixels, sampleAtX, xAtSample, ensureVisible, isFullView,
} from '../src/clipView.js';

const TOTAL = 10000;

test('MIN_SPAN and fullView', () => {
  assert.equal(MIN_SPAN, 256);
  assert.deepEqual(fullView(TOTAL), { start: 0, span: TOTAL });
});

test('clampView clamps start and span at both ends', () => {
  assert.deepEqual(clampView({ start: -100, span: 1000 }, TOTAL), { start: 0, span: 1000 });
  assert.deepEqual(clampView({ start: 99999, span: 1000 }, TOTAL), { start: 9000, span: 1000 });
  assert.deepEqual(clampView({ start: 10.6, span: 256.4 }, TOTAL), { start: 11, span: 256 });
});

test('clampView uses MIN_SPAN and handles total 0', () => {
  assert.deepEqual(clampView({ start: 10, span: 5 }, TOTAL), { start: 10, span: MIN_SPAN });
  assert.deepEqual(clampView({ start: 10, span: 5 }, 100), { start: 0, span: 100 });
  assert.deepEqual(clampView({ start: 10, span: 500 }, 0), { start: 0, span: 0 });
});

test('zoomAt keeps an anchor at the left edge at the left edge', () => {
  const view = { start: 1000, span: 1000 };
  assert.deepEqual(zoomAt(view, TOTAL, 2, 1000), { start: 1000, span: 500 });
});

test('zoomAt keeps a middle anchor in the middle', () => {
  const view = { start: 1000, span: 1000 };
  const zoomed = zoomAt(view, TOTAL, 2, 1500);
  assert.deepEqual(zoomed, { start: 1250, span: 500 });
  assert.equal(Math.round(zoomed.start + zoomed.span / 2) - 1500, 0);
});

test('zoom in then out returns to the full view', () => {
  const zoomedIn = zoomAt(fullView(TOTAL), TOTAL, 2, 5000);
  assert.deepEqual(zoomedIn, { start: 2500, span: 5000 });
  assert.deepEqual(zoomAt(zoomedIn, TOTAL, 0.5, 5000), fullView(TOTAL));
});

test('zoomAt clamps the span to MIN_SPAN and to total', () => {
  const zoomedIn = zoomAt(fullView(100000), 100000, 1000, 50000);
  assert.equal(zoomedIn.span, MIN_SPAN);
  assert.equal(zoomedIn.start, 49872);
  const zoomedOut = zoomAt({ start: 2500, span: 5000 }, TOTAL, 0.1, 5000);
  assert.deepEqual(zoomedOut, fullView(TOTAL));
});

test('zoomAt clamps an anchor outside the window', () => {
  const view = { start: 1000, span: 1000 };
  assert.deepEqual(zoomAt(view, TOTAL, 2, 99999), { start: 1500, span: 500 });
  assert.deepEqual(zoomAt(view, TOTAL, 2, -99999), { start: 1000, span: 500 });
});

test('wheelFactor sign, clamp and zero', () => {
  assert.equal(wheelFactor(0), 1);
  assert.ok(wheelFactor(-100) > 1);
  assert.ok(wheelFactor(100) < 1);
  assert.equal(wheelFactor(-5000), wheelFactor(-400));
  assert.equal(wheelFactor(5000), wheelFactor(400));
  assert.equal(wheelFactor(-400), Math.exp(0.6));
});

test('panBy clamps at both ends', () => {
  const view = { start: 1000, span: 1000 };
  assert.deepEqual(panBy(view, TOTAL, -5000), { start: 0, span: 1000 });
  assert.deepEqual(panBy(view, TOTAL, 50000), { start: 9000, span: 1000 });
  assert.deepEqual(panBy(view, TOTAL, 250.6), { start: 1251, span: 1000 });
});

test('panByPixels with half the width pans half the span', () => {
  const view = { start: 1000, span: 2000 };
  assert.deepEqual(panByPixels(view, TOTAL, -500, 1000), { start: 0, span: 2000 });
  assert.deepEqual(panByPixels(view, TOTAL, 500, 1000), { start: 2000, span: 2000 });
  assert.strictEqual(panByPixels(view, TOTAL, 500, 0), view);
  assert.strictEqual(panByPixels(view, TOTAL, 500, -10), view);
});

test('sampleAtX at the edges, middle and zero width', () => {
  const view = { start: 1000, span: 1000 };
  assert.equal(sampleAtX(view, 0, 1000), 1000);
  assert.equal(sampleAtX(view, 1000, 1000), 2000);
  assert.equal(sampleAtX(view, 500, 1000), 1500);
  assert.equal(sampleAtX(view, 2000, 1000), 2000);
  assert.equal(sampleAtX(view, 500, 0), 1000);
});

test('xAtSample is the inverse of sampleAtX within 1 pixel', () => {
  const view = { start: 1000, span: 1000 };
  for (let x = 0; x <= 1000; x += 137) {
    const sample = sampleAtX(view, x, 1000);
    assert.ok(Math.abs(xAtSample(view, sample, 1000) - x) <= 1);
  }
  assert.equal(xAtSample({ start: 0, span: 0 }, 500, 1000), 0);
  assert.equal(xAtSample(view, 500, 1000), -500);
});

test('ensureVisible keeps the same object when the sample is visible', () => {
  const view = { start: 1000, span: 1000 };
  assert.equal(ensureVisible(view, TOTAL, 1500), view);
  assert.equal(ensureVisible(view, TOTAL, 1000), view);
  assert.equal(ensureVisible(view, TOTAL, 2000), view);
});

test('ensureVisible jumps past either edge and clamps at the end', () => {
  const view = { start: 1000, span: 1000 };
  assert.deepEqual(ensureVisible(view, TOTAL, 5000), { start: 4900, span: 1000 });
  assert.deepEqual(ensureVisible(view, TOTAL, 500), { start: 400, span: 1000 });
  assert.deepEqual(ensureVisible({ start: 0, span: 1000 }, TOTAL, 9999), { start: 9000, span: 1000 });
});

test('isFullView', () => {
  assert.equal(isFullView(fullView(TOTAL), TOTAL), true);
  assert.equal(isFullView({ start: 1, span: TOTAL }, TOTAL), true);
  assert.equal(isFullView({ start: 0, span: TOTAL - 1 }, TOTAL), false);
});

test('no function mutates its input view', () => {
  const view = { start: 1000, span: 1000 };
  const before = structuredClone(view);
  clampView(view, TOTAL);
  zoomAt(view, TOTAL, 2, 1500);
  panBy(view, TOTAL, 500);
  panByPixels(view, TOTAL, 500, 1000);
  sampleAtX(view, 500, 1000);
  xAtSample(view, 1500, 1000);
  ensureVisible(view, TOTAL, 5000);
  ensureVisible(view, TOTAL, 1500);
  assert.deepEqual(view, before);
});
