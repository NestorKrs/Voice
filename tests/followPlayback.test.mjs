import test from 'node:test';
import assert from 'node:assert/strict';
import { readyFlags, newlyReady, playheadToSend } from '../src/followPlayback.js';

test('readyFlags maps statuses', () => {
  assert.deepEqual(readyFlags([{ status: 'ready' }, { status: 'queued' }, { status: 'ready' }]), [true, false, true]);
  assert.deepEqual(readyFlags(null), []);
});

test('newlyReady finds new ready chunks', () => {
  const chunks = [{ status: 'ready' }, { status: 'queued' }, { status: 'ready' }];
  assert.deepEqual(newlyReady(null, chunks), [0, 2]);
  assert.deepEqual(newlyReady([true, false, false], [{ status: 'ready' }, { status: 'ready' }, { status: 'queued' }]), [1]);
  assert.deepEqual(newlyReady([true, false, true], [{ status: 'ready' }, { status: 'queued' }, { status: 'ready' }]), []);
});

test('newlyReady handles a longer chunk list', () => {
  assert.deepEqual(newlyReady([true], [{ status: 'ready' }, { status: 'ready' }]), [1]);
});

test('newlyReady ignores null chunk entries', () => {
  assert.deepEqual(newlyReady([], [null, { status: 'ready' }, null]), [1]);
});

test('playheadToSend only sends a new index in follow states', () => {
  assert.equal(playheadToSend(3, 2, 'generating'), 3);
  assert.equal(playheadToSend(3, 2, 'idle'), 3);
  assert.equal(playheadToSend(3, null, 'idle'), 3);
  assert.equal(playheadToSend(3, 3, 'idle'), null);
  assert.equal(playheadToSend(3, 2, 'error'), null);
  assert.equal(playheadToSend(3, 2, 'waiting_reset'), null);
  assert.equal(playheadToSend(3, 2, 'done'), null);
  assert.equal(playheadToSend(3, 2, 'cancelled'), null);
  assert.equal(playheadToSend(-1, 0, 'idle'), null);
  assert.equal(playheadToSend(NaN, 0, 'idle'), null);
  assert.equal(playheadToSend(1.5, 0, 'idle'), null);
});
