import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIDE_MIN_PX, SIDE_MAX_PCT, MID_MIN_PX, MID_MAX_PCT, DEFAULT_WIDTHS, WIDTHS_KEY,
  middlePct, usableWidth, limitsFor, clampWidths, resizeFromHandle, columnsTemplate,
  loadWidths, saveWidths, resetWidths,
} from '../src/panelWidths.js';

const EPS = 1e-9;
const near = (a, b) => Math.abs(a - b) < 1e-6;

test('defaults: 25 / 50 / 25', () => {
  assert.deepEqual(DEFAULT_WIDTHS, { left: 25, right: 25 });
  assert.equal(middlePct(DEFAULT_WIDTHS), 50);
});

test('usableWidth subtracts padding and both handles and never goes negative', () => {
  assert.equal(usableWidth(1200), 1152);
  assert.equal(usableWidth(1200, 0, 0), 1200);
  assert.equal(usableWidth(10), 0);
});

test('limitsFor: null for bad or too narrow widths', () => {
  assert.equal(limitsFor(0), null);
  assert.equal(limitsFor(-5), null);
  assert.equal(limitsFor(NaN), null);
  assert.equal(limitsFor(Infinity), null);
  assert.equal(limitsFor(600), null);
  assert.equal(limitsFor(720), null);
});

test('limitsFor: values at 1200 px', () => {
  const lim = limitsFor(1200);
  assert.ok(near(lim.sideMin, (SIDE_MIN_PX / 1200) * 100));
  assert.ok(near(lim.midMin, (MID_MIN_PX / 1200) * 100));
  assert.equal(lim.sideMax, SIDE_MAX_PCT);
  assert.equal(lim.midMax, MID_MAX_PCT);
});

test('clampWidths: valid input stays, too narrow gives a fresh default', () => {
  assert.deepEqual(clampWidths({ left: 25, right: 25 }, 1200), { left: 25, right: 25 });
  const r = clampWidths({ left: 25, right: 25 }, 500);
  assert.deepEqual(r, { left: 25, right: 25 });
  assert.notEqual(r, DEFAULT_WIDTHS);
});

test('clampWidths: side maximum', () => {
  assert.deepEqual(clampWidths({ left: 50, right: 25 }, 1200), { left: 30, right: 25 });
});

test('clampWidths: small sides grow to their pixel minimum', () => {
  const r = clampWidths({ left: 5, right: 5 }, 1200);
  assert.ok(near(r.left, (SIDE_MIN_PX / 1200) * 100));
  assert.ok(near(r.right, (SIDE_MIN_PX / 1200) * 100));
});

test('clampWidths: on a wide window the middle may reach 80 percent but not more', () => {
  const r = clampWidths({ left: 5, right: 5 }, 3000);
  assert.ok(near(r.left, 10));
  assert.ok(near(r.right, 10));
  assert.ok(near(middlePct(r), 80));
});

test('clampWidths: missing or invalid values use the defaults', () => {
  assert.deepEqual(clampWidths({ left: NaN, right: undefined }, 1200), { left: 25, right: 25 });
  assert.deepEqual(clampWidths(null, 1200), { left: 25, right: 25 });
});

test('clampWidths: every rule holds across many inputs and widths, and the result is stable', () => {
  for (const usable of [740, 800, 1000, 1200, 2000, 3000]) {
    const lim = limitsFor(usable);
    assert.ok(lim, 'limits exist at ' + usable);
    for (let left = 0; left <= 100; left += 5) {
      for (let right = 0; right <= 100; right += 5) {
        const out = clampWidths({ left, right }, usable);
        const mid = middlePct(out);
        assert.ok(out.left >= lim.sideMin - EPS && out.left <= lim.sideMax + EPS, 'left ' + out.left + ' at ' + usable);
        assert.ok(out.right >= lim.sideMin - EPS && out.right <= lim.sideMax + EPS, 'right ' + out.right + ' at ' + usable);
        assert.ok(mid >= lim.midMin - EPS && mid <= lim.midMax + EPS, 'middle ' + mid + ' at ' + usable);
        const again = clampWidths(out, usable);
        assert.ok(near(again.left, out.left) && near(again.right, out.right), 'stable at ' + usable);
      }
    }
  }
});

test('resizeFromHandle: left handle', () => {
  const start = { left: 25, right: 25 };
  assert.deepEqual(resizeFromHandle(start, 0, 100, 1200), { left: 30, right: 25 });
  const small = resizeFromHandle(start, 0, 30, 1200);
  assert.ok(near(small.left, 27.5));
  assert.equal(small.right, 25);
  const shrunk = resizeFromHandle(start, 0, -1000, 1200);
  assert.ok(near(shrunk.left, (SIDE_MIN_PX / 1200) * 100));
  assert.equal(shrunk.right, 25);
});

test('resizeFromHandle: right handle moves the right panel the other way', () => {
  const start = { left: 25, right: 25 };
  const smaller = resizeFromHandle(start, 1, 100, 1200);
  assert.ok(near(smaller.right, (SIDE_MIN_PX / 1200) * 100));
  assert.equal(smaller.left, 25);
  assert.deepEqual(resizeFromHandle(start, 1, -100, 1200), { left: 25, right: 30 });
});

test('resizeFromHandle: the middle may not grow past its maximum', () => {
  const r = resizeFromHandle({ left: 10, right: 10 }, 0, -50, 3000);
  assert.ok(near(r.left, 10));
  assert.equal(r.right, 10);
});

test('resizeFromHandle: zero move keeps the widths, input is not changed, narrow gives the default', () => {
  const input = { left: 25, right: 25 };
  assert.deepEqual(resizeFromHandle(input, 0, 0, 1200), { left: 25, right: 25 });
  assert.deepEqual(input, { left: 25, right: 25 });
  assert.deepEqual(resizeFromHandle(input, 1, 50, 500), { left: 25, right: 25 });
});

test('columnsTemplate: fractions that add up, with 12px handles', () => {
  assert.equal(columnsTemplate({ left: 25, right: 25 }), 'minmax(0, 25fr) 12px minmax(0, 50fr) 12px minmax(0, 25fr)');
  assert.equal(columnsTemplate({ left: 22.3456, right: 27.1234 }), 'minmax(0, 22.346fr) 12px minmax(0, 50.531fr) 12px minmax(0, 27.123fr)');
});

test('loadWidths: empty, valid, corrupt, wrong shape and throwing storage', () => {
  assert.deepEqual(loadWidths({ getItem: () => null }), { left: 25, right: 25 });
  assert.deepEqual(loadWidths({ getItem: () => '{"left":22,"right":27}' }), { left: 22, right: 27 });
  assert.deepEqual(loadWidths({ getItem: () => 'not json' }), { left: 25, right: 25 });
  assert.deepEqual(loadWidths({ getItem: () => '{"left":"a","right":1}' }), { left: 25, right: 25 });
  assert.deepEqual(loadWidths({ getItem: () => '[1,2]' }), { left: 25, right: 25 });
  assert.deepEqual(loadWidths({ getItem: () => { throw new Error('blocked'); } }), { left: 25, right: 25 });
});

test('saveWidths: writes the two numbers, refuses bad input, reports failure', () => {
  const calls = [];
  assert.equal(saveWidths({ setItem: (k, v) => calls.push([k, v]) }, { left: 22, right: 27 }), true);
  assert.deepEqual(calls, [[WIDTHS_KEY, '{"left":22,"right":27}']]);
  assert.equal(saveWidths({ setItem: (k, v) => calls.push([k, v]) }, { left: NaN, right: 27 }), false);
  assert.equal(calls.length, 1);
  assert.equal(saveWidths({ setItem: () => { throw new Error('full'); } }, { left: 22, right: 27 }), false);
});

test('resetWidths: removes the key and reports failure', () => {
  const removed = [];
  assert.equal(resetWidths({ removeItem: (k) => removed.push(k) }), true);
  assert.deepEqual(removed, [WIDTHS_KEY]);
  assert.equal(resetWidths({ removeItem: () => { throw new Error('blocked'); } }), false);
});
