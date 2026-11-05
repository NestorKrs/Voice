import test from 'node:test';
import assert from 'node:assert/strict';
import { RATES, createInitialState, reduce, getView, wantedWindow, estimateTimes } from '../src/playerCore.js';

test('initial state and immutability', () => {
  const s = createInitialState({ total: 3 });
  assert.deepEqual(s, { total: 3, index: 0, status: 'stopped', rate: 1 });
  const frozen = Object.freeze({ ...s });
  const next = reduce(s, { type: 'PLAY' });
  assert.notEqual(next, s);
  assert.deepEqual(s, frozen);
});

test('PLAY/PAUSE/TOGGLE/STOP', () => {
  let s = createInitialState({ total: 2 });
  s = reduce(s, { type: 'PLAY' });
  assert.equal(s.status, 'playing');
  // PAUSE from playing
  let p = reduce(s, { type: 'PAUSE' });
  assert.equal(p.status, 'paused');
  // PAUSE from paused unchanged
  assert.equal(reduce(p, { type: 'PAUSE' }), p);
  // TOGGLE
  assert.equal(reduce(s, { type: 'TOGGLE' }).status, 'paused');
  assert.equal(reduce(p, { type: 'TOGGLE' }).status, 'playing');
  // STOP
  assert.equal(reduce(s, { type: 'STOP' }).status, 'stopped');
  // PLAY total 0 does nothing
  const z = createInitialState({ total: 0 });
  assert.equal(reduce(z, { type: 'PLAY' }), z);
  // PLAY from finished restarts
  let f = createInitialState({ total: 2 });
  f = reduce(f, { type: 'PLAY' });
  f = reduce(f, { type: 'ENDED' });
  f = reduce(f, { type: 'ENDED' });
  assert.equal(f.status, 'finished');
  const r = reduce(f, { type: 'PLAY' });
  assert.equal(r.index, 0);
  assert.equal(r.status, 'playing');
});

test('NEXT/PREV range and status unchanged', () => {
  let s = createInitialState({ total: 3 });
  s = reduce(s, { type: 'PLAY' });
  s = reduce(s, { type: 'NEXT' });
  assert.equal(s.index, 1);
  s = reduce(s, { type: 'PREV' });
  assert.equal(s.index, 0);
  // NEXT at end unchanged
  let e = createInitialState({ total: 3 });
  e = { ...e, index: 2 };
  assert.equal(reduce(e, { type: 'NEXT' }).index, 2);
  // PREV min 0
  let z = createInitialState({ total: 3 });
  z = { ...z, index: 0 };
  assert.equal(reduce(z, { type: 'PREV' }).index, 0);
});

test('JUMP clamp floor ignore', () => {
  let s = createInitialState({ total: 5 });
  s = reduce(s, { type: 'JUMP', index: 2.7 });
  assert.equal(s.index, 2);
  assert.equal(s.status, 'playing');
  s = reduce(s, { type: 'JUMP', index: 100 });
  assert.equal(s.index, 4);
  const before = createInitialState({ total: 5 });
  assert.equal(reduce(before, { type: 'JUMP', index: 'x' }), before);
  assert.equal(reduce(before, { type: 'JUMP', index: NaN }), before);
});

test('ENDED', () => {
  let s = createInitialState({ total: 3 });
  s = reduce(s, { type: 'PLAY' });
  s = reduce(s, { type: 'ENDED' });
  assert.equal(s.index, 1);
  assert.equal(s.status, 'playing');
  // finish
  let s2 = createInitialState({ total: 2 });
  s2 = reduce(s2, { type: 'PLAY' });
  s2 = reduce(s2, { type: 'ENDED' }); // index 1
  s2 = reduce(s2, { type: 'ENDED' }); // finished
  assert.equal(s2.status, 'finished');
  assert.equal(s2.index, 1);
});

test('SET_RATE', () => {
  let s = createInitialState({ total: 1 });
  for (const r of RATES) {
    s = reduce(s, { type: 'SET_RATE', rate: r });
    assert.equal(s.rate, r);
  }
  const before = s;
  assert.equal(reduce(s, { type: 'SET_RATE', rate: 3 }), s);
  assert.equal(reduce(s, { type: 'SET_RATE', rate: 0 }), s);
  assert.equal(reduce(s, { type: 'SET_RATE', rate: '1.5' }), s);
  assert.equal(reduce(s, { type: 'SET_RATE', rate: undefined }), s);
});

test('SET_TOTAL', () => {
  let s = createInitialState({ total: 5 });
  s = { ...s, index: 4 };
  s = reduce(s, { type: 'SET_TOTAL', total: 2 });
  assert.equal(s.total, 2);
  assert.equal(s.index, 1);
  let z = createInitialState({ total: 3 });
  z = reduce(z, { type: 'SET_TOTAL', total: 0 });
  assert.equal(z.total, 0);
  assert.equal(z.index, 0);
  assert.equal(z.status, 'stopped');
});

test('getView', () => {
  let s = createInitialState({ total: 3 });
  s = reduce(s, { type: 'PLAY' });
  const v = getView(s, [true, false, true]);
  assert.equal(v.buffering, false);
  assert.equal(v.preloadIndex, 1);
  assert.equal(v.canNext, true);
  assert.equal(v.canPrev, false);
  assert.equal(v.isLast, false);
  // paused not buffering
  let p = reduce(s, { type: 'PAUSE' });
  assert.equal(getView(p, [false,false,false]).buffering, false);
  // playing not ready buffers
  assert.equal(getView(s, [false,false,false]).buffering, true);
  // last chunk preloadIndex null
  let last = { ...s, index: 2 };
  assert.equal(getView(last, [true,true,true]).preloadIndex, null);
  assert.equal(getView(last, [true,true,true]).isLast, true);
});

test('wantedWindow', () => {
  let s = createInitialState({ total: 5 });
  assert.deepEqual(wantedWindow(s, 2), { from: 0, to: 2 });
  s = { ...s, index: 3 };
  assert.deepEqual(wantedWindow(s, 2), { from: 3, to: 4 });
  let empty = createInitialState({ total: 0 });
  assert.deepEqual(wantedWindow(empty, 2), { from: 0, to: -1 });
});

test('estimateTimes', () => {
  // all known
  const r1 = estimateTimes({ chars: [10, 10], durations: [1, 2], index: 0, positionSeconds: 0, rate: 1 });
  assert.equal(r1.total, 3);
  assert.equal(r1.elapsed, 0);
  assert.equal(r1.remaining, 3);
  assert.equal(r1.estimated, false);
  // some unknown
  const r2 = estimateTimes({ chars: [10, 10], durations: [1, null], index: 0, positionSeconds: 0, rate: 1 });
  // spc = 1/10 = 0.1; unknown = 10*0.1=1; total=2
  assert.equal(r2.total, 2);
  assert.equal(r2.estimated, true);
  // none known -> 0.07
  const r3 = estimateTimes({ chars: [10], durations: [null], index: 0, positionSeconds: 0, rate: 1 });
  assert.ok(Math.abs(r3.total - 0.7) < 1e-9);
  assert.equal(r3.estimated, true);
  // positionSeconds capped
  const r4 = estimateTimes({ chars: [10, 10], durations: [1, 2], index: 0, positionSeconds: 5, rate: 1 });
  assert.equal(r4.elapsed, 1); // capped to chunk dur 1
  // rate 2 halves remaining
  const r5 = estimateTimes({ chars: [10, 10], durations: [1, 2], index: 0, positionSeconds: 0, rate: 2 });
  assert.equal(r5.remaining, 1.5);
  // empty
  const r6 = estimateTimes({ chars: [], durations: [], index: 0, positionSeconds: 0, rate: 1 });
  assert.deepEqual(r6, { elapsed: 0, remaining: 0, total: 0, estimated: false });
});

test('unknown action returns same object', () => {
  const s = createInitialState({ total: 2 });
  assert.equal(reduce(s, { type: 'NOPE' }), s);
});
