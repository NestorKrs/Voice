import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCuts, msToSamples, samplesToMs, formatTime,
  addMarker, moveMarker, nudgeMarker, deleteMarker, nearestMarkerIndex,
  undo, redo, segments,
} from '../src/clipCuts.js';

const RATE = 44100;

function cuts(total, markers = []) {
  let state = createCuts(total, RATE);
  for (const m of markers) state = addMarker(state, m);
  return state;
}

test('addMarker clamps at both ends', () => {
  const state = createCuts(1000, RATE);
  assert.deepEqual(addMarker(state, -500).markers, [1]);
  assert.deepEqual(addMarker(state, 999999).markers, [999]);
});

test('duplicate add is ignored', () => {
  const first = addMarker(createCuts(1000, RATE), 500.4);
  const again = addMarker(first, 500);
  assert.strictEqual(again, first);
  assert.deepEqual(again.markers, [500]);
  assert.equal(again.past.length, 1);
});

test('markers are inserted sorted', () => {
  assert.deepEqual(cuts(1000, [500, 200, 800, 100]).markers, [100, 200, 500, 800]);
});

test('moveMarker cannot cross a neighbour', () => {
  const state = cuts(1000, [100, 200, 300]);
  assert.deepEqual(moveMarker(state, 1, 500).markers, [100, 299, 300]);
  assert.deepEqual(moveMarker(state, 1, 10).markers, [100, 101, 300]);
  assert.strictEqual(moveMarker(state, 1, 200), state);
});

test('msToSamples and samplesToMs at 44100 Hz', () => {
  assert.equal(msToSamples(1, RATE), 44);
  assert.equal(samplesToMs(44100, RATE), 1000);
});

test('nudge of 1 ms at 44100 Hz moves 44 samples', () => {
  const state = cuts(1000, [500]);
  assert.deepEqual(nudgeMarker(state, 0, 1).markers, [544]);
  assert.deepEqual(nudgeMarker(state, 0, -1).markers, [456]);
});

test('bad index in move, nudge and delete returns the same state', () => {
  const state = cuts(1000, [200]);
  assert.strictEqual(moveMarker(state, 1, 500), state);
  assert.strictEqual(nudgeMarker(state, 5, 10), state);
  assert.strictEqual(deleteMarker(state, -1), state);
});

test('delete then undo restores the markers', () => {
  const state = cuts(1000, [200, 500, 800]);
  const deleted = deleteMarker(state, 1);
  assert.deepEqual(deleted.markers, [200, 800]);
  assert.deepEqual(undo(deleted).markers, [200, 500, 800]);
  const empty = createCuts(1000, RATE);
  assert.strictEqual(undo(empty), empty);
});

test('nearestMarkerIndex picks the closest marker inside the tolerance', () => {
  assert.equal(nearestMarkerIndex([100, 400, 900], 430, 50), 1);
  assert.equal(nearestMarkerIndex([100, 400, 900], 120, 50), 0);
  assert.equal(nearestMarkerIndex([100, 400, 900], 120, 10), -1);
  assert.equal(nearestMarkerIndex([], 100, 50), -1);
});

test('nearestMarkerIndex takes the later marker on an exact tie', () => {
  assert.equal(nearestMarkerIndex([100, 300], 200, 100), 1);
});

test('redo after undo', () => {
  const state = cuts(1000, [200, 500]);
  const deleted = deleteMarker(state, 0);
  const redone = redo(undo(deleted));
  assert.deepEqual(redone.markers, deleted.markers);
  assert.deepEqual(redone.future, []);
  const fresh = createCuts(1000, RATE);
  assert.strictEqual(redo(fresh), fresh);
});

test('a new edit clears redo', () => {
  const deleted = deleteMarker(cuts(1000, [200]), 0);
  const undone = undo(deleted);
  assert.equal(undone.future.length, 1);
  const edited = addMarker(undone, 700);
  assert.deepEqual(edited.markers, [200, 700]);
  assert.deepEqual(edited.future, []);
  assert.strictEqual(redo(edited), edited);
});

test('past keeps at most 100 entries', () => {
  let state = createCuts(10000, RATE);
  for (let i = 1; i <= 150; i += 1) state = addMarker(state, i);
  assert.equal(state.past.length, 100);
  assert.deepEqual(state.markers, Array.from({ length: 150 }, (_, i) => i + 1));
  for (let i = 0; i < 100; i += 1) state = undo(state);
  assert.equal(state.markers.length, 50);
  assert.equal(state.past.length, 0);
});

test('segments cover 0..total exactly with no gaps', () => {
  const state = cuts(1000, [200, 500]);
  const parts = segments(state);
  assert.deepEqual(parts, [
    { index: 0, start: 0, end: 200 },
    { index: 1, start: 200, end: 500 },
    { index: 2, start: 500, end: 1000 },
  ]);
  assert.equal(parts[0].start, 0);
  assert.equal(parts[parts.length - 1].end, state.total);
  for (let i = 1; i < parts.length; i += 1) assert.equal(parts[i].start, parts[i - 1].end);
});

test('formatTime shows m:ss.mmm', () => {
  assert.equal(formatTime(65250, 1000), '1:05.250');
  assert.equal(formatTime(2877525, RATE), '1:05.250');
});

test('total 0 gives no segments and no markers', () => {
  const state = createCuts(0, RATE);
  assert.deepEqual(segments(state), []);
  assert.deepEqual(addMarker(state, 5).markers, []);
});

test('state is not mutated', () => {
  const state = cuts(1000, [200, 500]);
  const before = structuredClone(state);
  addMarker(state, 700);
  moveMarker(state, 0, 250);
  nudgeMarker(state, 1, 10);
  deleteMarker(state, 0);
  undo(state);
  const withFuture = undo(deleteMarker(state, 0));
  redo(withFuture);
  assert.deepEqual(state, before);
});
