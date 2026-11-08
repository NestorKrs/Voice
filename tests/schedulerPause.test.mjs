import test from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler } from '../src/scheduler.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, ms = 1000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await sleep(2);
  }
  return false;
}

function setup(n, lookahead, delay = 5) {
  const stored = new Set();
  const calls = [];
  const sched = createScheduler({
    chunks: Array.from({ length: n }, (_, i) => 'text ' + i),
    voice: '',
    lookahead,
    cache: { has: async (k) => stored.has(k), put: async (k) => { stored.add(k); } },
    speak: async ({ input, signal }) => {
      calls.push(input);
      await new Promise((resolve) => {
        const t = setTimeout(resolve, delay);
        signal.addEventListener('abort', () => { clearTimeout(t); resolve(); });
      });
      if (signal.aborted) return { ok: false, error: { kind: 'aborted', message: 'Aborted.' }, attempts: 0 };
      return { ok: true, bytes: new Uint8Array([1]), attempts: 1 };
    },
    counter: { add() {} },
    makeKey: async ({ text }) => 'k:' + text,
  });
  return { sched, calls };
}

test('pause: no new requests, state paused, resume continues without repeats', async () => {
  const t = setup(10, 4);
  const started = t.sched.start();
  await waitFor(() => t.calls.length >= 1);
  t.sched.pause();
  assert.equal(t.sched.getState().state, 'paused');
  await started;
  const after = t.calls.length;
  assert.ok(after <= 2);
  await sleep(40);
  assert.equal(t.calls.length, after);
  assert.equal(t.sched.getState().state, 'paused');
  await t.sched.resume();
  assert.ok(await waitFor(() => t.sched.getState().state === 'idle'));
  assert.equal(t.calls.length, 5);
  assert.equal(new Set(t.calls).size, t.calls.length);
});

test('cancel then resume: the aborted chunk is requested again and generation continues', async () => {
  const t = setup(6, 2, 30);
  const started = t.sched.start();
  await waitFor(() => t.calls.length >= 1);
  t.sched.cancel();
  await started;
  assert.equal(t.sched.getState().state, 'cancelled');
  assert.equal(t.calls.length, 1);
  await t.sched.resume();
  assert.ok(await waitFor(() => t.sched.getState().state === 'idle'));
  assert.deepEqual(t.sched.getState().chunks.slice(0, 3).map((c) => c.status), ['ready', 'ready', 'ready']);
  assert.equal(t.calls.length, 4);
});

test('paused: moving the playhead requests nothing, resume uses the new playhead', async () => {
  const t = setup(10, 1);
  await t.sched.start();
  assert.equal(t.sched.getState().state, 'idle');
  t.sched.pause();
  t.sched.setPlayhead(5);
  await sleep(30);
  assert.equal(t.calls.length, 2);
  await t.sched.resume();
  assert.ok(await waitFor(() => t.sched.getState().state === 'idle'));
  assert.deepEqual(t.calls.slice(2), ['text 5', 'text 6']);
});

test('an unexpected exception in the loop ends in the error state, not a ReferenceError', async () => {
  let thrown = false;
  const sched = createScheduler({
    chunks: ['a', 'b'],
    voice: '',
    lookahead: 1,
    cache: { has: async () => false, put: async () => {} },
    speak: async () => ({ ok: true, bytes: new Uint8Array([1]), attempts: 1 }),
    counter: { add() {} },
    makeKey: async ({ text }) => 'k:' + text,
    onChange: (p) => {
      if (!thrown && p.chunks.some((c) => c.status === 'generating')) { thrown = true; throw new Error('boom'); }
    },
  });
  await sched.start();
  const s = sched.getState();
  assert.equal(s.state, 'error');
  assert.equal(s.chunks[0].status, 'failed');
  assert.equal(s.chunks[0].error.message, 'boom');
});
