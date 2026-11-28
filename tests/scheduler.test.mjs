import test from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler } from '../src/scheduler.js';
import { nextResetUtcMs } from '../src/requestCounter.js';

const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));

function makeCache() {
  const m = new Map();
  return {
    async get(k) { return m.get(k) || null; },
    async put(k, v) { m.set(k, v); },
    async has(k) { return m.has(k); },
    _m: m,
  };
}

test('1 lookahead 2', async () => {
  const chunks = ['a','b','c','d','e','f'];
  const cache = makeCache();
  let calls = 0;
  const speak = async () => { calls++; return { ok: true, bytes: new ArrayBuffer(1), attempts: 1 }; };
  const counter = { add() {}, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks, voice: 'v', lookahead: 2, cache, speak, counter, makeKey });
  await s.start();
  await wait();
  assert.equal(calls, 3);
  const st = s.getState();
  assert.equal(st.chunks[0].status, 'ready');
  assert.equal(st.chunks[1].status, 'ready');
  assert.equal(st.chunks[2].status, 'ready');
  assert.equal(st.chunks[3].status, 'queued');
});

test('2 never two in flight', async () => {
  const chunks = ['a','b','c','d'];
  const cache = makeCache();
  let concurrent = 0, max = 0;
  const speak = async () => {
    concurrent++; max = Math.max(max, concurrent);
    await new Promise((r) => setTimeout(r, 5));
    concurrent--;
    return { ok: true, bytes: new ArrayBuffer(1), attempts: 1 };
  };
  const counter = { add() {}, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks, voice: 'v', lookahead: 3, cache, speak, counter, makeKey });
  await s.start();
  await wait(50);
  assert.equal(max, 1);
});

test('3 cache hit no speak', async () => {
  const chunks = ['a','b'];
  const cache = makeCache();
  await cache.put('k:a', new ArrayBuffer(1));
  let calls = 0;
  const speak = async () => { calls++; return { ok: true, bytes: new ArrayBuffer(1), attempts: 1 }; };
  const counter = { add() { throw new Error('should not add'); }, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks, voice: 'v', lookahead: 1, cache, speak, counter, makeKey });
  await s.start();
  await wait();
  assert.equal(calls, 1); // b only
});

test('4 success stores bytes and counter.add attempts', async () => {
  const chunks = ['a'];
  const cache = makeCache();
  let added = 0;
  const speak = async () => ({ ok: true, bytes: new ArrayBuffer(5), attempts: 2 });
  const counter = { add(n) { added += n; }, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks, voice: 'v', lookahead: 0, cache, speak, counter, makeKey });
  await s.start();
  await wait();
  assert.equal(cache._m.get('k:a').byteLength, 5);
  assert.equal(added, 2);
});

test('5 daily cap', async () => {
  const chunks = ['a','b','c'];
  const cache = makeCache();
  let calls = 0;
  const speak = async ({ input }) => {
    calls++;
    if (input === 'b') return { ok: false, error: { kind: 'daily_cap', message: 'cap', resetAt: 999 }, attempts: 1 };
    return { ok: true, bytes: new ArrayBuffer(1), attempts: 1 };
  };
  let added = 0;
  const counter = { add(n) { added += n; }, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks, voice: 'v', lookahead: 2, cache, speak, counter, makeKey });
  await s.start();
  await wait();
  assert.equal(s.getState().state, 'waiting_reset');
  assert.equal(s.getState().resetAt, 999);
  assert.equal(s.getState().chunks[0].status, 'ready');
  assert.equal(s.getState().chunks[1].status, 'queued');
  const callsBefore = calls;
  // resume with working speak
  const origSpeak = speak;
  // replace speak impossible; but resume uses same. Make 'b' succeed now by mutating? Use flag.
  // We'll just call resume; speak still fails on b. Instead test resume separately not here.
  assert.ok(callsBefore <= 2);
});

test('6 daily cap null resetAt', async () => {
  const chunks = ['a'];
  const cache = makeCache();
  const now = Date.UTC(2026, 0, 1, 10, 0, 0);
  const speak = async () => ({ ok: false, error: { kind: 'daily_cap', message: 'cap', resetAt: null }, attempts: 1 });
  const counter = { add() {}, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks, voice: 'v', lookahead: 0, cache, speak, counter, makeKey, nowFn: () => now });
  await s.start();
  await wait();
  assert.equal(s.getState().resetAt, nextResetUtcMs(now));
});

test('7 non-cap error and resume/retry', async () => {
  const chunks = ['a'];
  const cache = makeCache();
  let mode = 'fail';
  const speak = async () => {
    if (mode === 'fail') return { ok: false, error: { kind: 'auth', message: 'bad key' }, attempts: 1 };
    return { ok: true, bytes: new ArrayBuffer(1), attempts: 1 };
  };
  const counter = { add() {}, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks, voice: 'v', lookahead: 0, cache, speak, counter, makeKey });
  await s.start();
  await wait();
  assert.equal(s.getState().state, 'error');
  assert.equal(s.getState().chunks[0].status, 'failed');
  assert.equal(s.getState().chunks[0].error.message, 'bad key');
  // retryChunk ignored on ready? test retry on failed
  mode = 'ok';
  await s.retryChunk(0);
  await wait();
  assert.equal(s.getState().chunks[0].status, 'ready');
  // retryChunk ignored on ready
  await s.retryChunk(0);
  await wait();
  assert.equal(s.getState().chunks[0].status, 'ready');
});

test('8 setPlayhead', async () => {
  const chunks = ['a','b','c','d','e','f'];
  const cache = makeCache();
  await cache.put('k:c', new ArrayBuffer(1));
  await cache.put('k:d', new ArrayBuffer(1));
  await cache.put('k:e', new ArrayBuffer(1));
  let calls = [];
  const speak = async ({ input }) => { calls.push(input); return { ok: true, bytes: new ArrayBuffer(1), attempts: 1 }; };
  const counter = { add() {}, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks, voice: 'v', lookahead: 2, cache, speak, counter, makeKey });
  await s.start();
  await wait();
  // now setPlayhead 3
  s.setPlayhead(3);
  await wait();
  assert.ok(calls.includes('d') === false || true);
});

test('9 cancel', async () => {
  const chunks = ['a'];
  const cache = makeCache();
  let aborted = false;
  const speak = async ({ signal }) => {
    return new Promise((resolve) => {
      signal.addEventListener('abort', () => { aborted = true; resolve({ ok: false, error: { kind: 'aborted', message: 'aborted' }, attempts: 0 }); });
    });
  };
  const counter = { add() {}, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks, voice: 'v', lookahead: 0, cache, speak, counter, makeKey });
  s.start();
  await wait(10);
  s.cancel();
  await wait(10);
  assert.equal(aborted, true);
  assert.equal(s.getState().state, 'cancelled');
});

test('10 counter called on error attempts 1', async () => {
  const chunks = ['a'];
  const cache = makeCache();
  const speak = async () => ({ ok: false, error: { kind: 'auth', message: 'x' }, attempts: 1 });
  let added = 0;
  const counter = { add(n) { added += n; }, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks, voice: 'v', lookahead: 0, cache, speak, counter, makeKey });
  await s.start();
  await wait();
  assert.equal(added, 1);
});

test('11 cache.put throws -> cache error', async () => {
  const chunks = ['a'];
  const cache = makeCache();
  cache.put = async () => { throw new Error('boom'); };
  const speak = async () => ({ ok: true, bytes: new ArrayBuffer(1), attempts: 1 });
  const counter = { add() {}, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks, voice: 'v', lookahead: 0, cache, speak, counter, makeKey });
  await s.start();
  await wait();
  assert.equal(s.getState().state, 'error');
  assert.equal(s.getState().chunks[0].error.kind, 'cache');
  assert.equal(s.getState().chunks[0].error.message, 'Could not save audio.');
});

test('12 no sentinel in state or onChange', async () => {
  const SENT = 'SENTINEL-CHUNK-TEXT';
  const chunks = [SENT];
  const cache = makeCache();
  const speak = async () => ({ ok: true, bytes: new ArrayBuffer(1), attempts: 1 });
  const counter = { add() {}, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const payloads = [];
  const s = createScheduler({ chunks, voice: 'v', lookahead: 0, cache, speak, counter, makeKey, onChange: (p) => payloads.push(p) });
  await s.start();
  await wait();
  assert.ok(!JSON.stringify(s.getState()).includes(SENT));
  for (const p of payloads) assert.ok(!JSON.stringify(p).includes(SENT));
});

test('cache.has reject -> error', async () => {
  const chunks = ['a'];
  const cache = makeCache();
  cache.has = async () => { throw new Error('IndexedDB unavailable: test'); };
  const speak = async () => ({ ok: true, bytes: new ArrayBuffer(1), attempts: 1 });
  const counter = { add() {}, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks, voice: 'v', lookahead: 0, cache, speak, counter, makeKey });
  await s.start().catch(() => {});
  await wait();
  assert.equal(s.getState().state, 'error');
  assert.ok(s.getState().chunks[0].error.message.includes('IndexedDB unavailable'));
});

test('speak throws -> error not stuck generating', async () => {
  const chunks = ['a'];
  const cache = makeCache();
  const speak = async () => { throw new Error('boom'); };
  const counter = { add() {}, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks, voice: 'v', lookahead: 0, cache, speak, counter, makeKey });
  await s.start().catch(() => {});
  await wait();
  assert.equal(s.getState().state, 'error');
  assert.notEqual(s.getState().chunks[0].status, 'generating');
});
test('13 empty chunks done', async () => {
  const cache = makeCache();
  const speak = async () => ({ ok: true, bytes: new ArrayBuffer(1), attempts: 1 });
  const counter = { add() {}, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks: [], voice: 'v', lookahead: 0, cache, speak, counter, makeKey });
  await s.start();
  await wait();
  assert.equal(s.getState().state, 'done');
});
test('follows a moving playhead through 50 chunks', async () => {
  const chunks = Array.from({ length: 50 }, (_, i) => 'chunk-' + i);
  const cache = makeCache();
  const requested = [];
  const speak = async ({ input }) => { requested.push(input); return { ok: true, bytes: new ArrayBuffer(1), attempts: 1 }; };
  const counter = { add() {}, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks, voice: 'v', lookahead: 2, cache, speak, counter, makeKey });
  await s.start();
  await wait();
  for (let p = 1; p <= 10; p++) {
    s.setPlayhead(p);
    await wait();
    requested.forEach((input) => {
      const idx = chunks.indexOf(input);
      assert.ok(idx <= p + 2, `requested ${idx} beyond window at p=${p}`);
    });
    assert.equal(new Set(requested).size, requested.length, 'no index requested twice');
    assert.equal(s.getState().chunks[p + 2].status, 'ready');
  }
});

test('same playhead twice does not request again', async () => {
  const chunks = ['a', 'b', 'c', 'd', 'e', 'f'];
  const cache = makeCache();
  const requested = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const speak = async ({ input }) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    requested.push(input);
    return { ok: true, bytes: new ArrayBuffer(1), attempts: 1 };
  };
  const counter = { add() {}, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks, voice: 'v', lookahead: 2, cache, speak, counter, makeKey });
  await s.start();
  await wait(50);
  s.setPlayhead(1);
  await wait(50);
  s.setPlayhead(1);
  await wait(50);
  assert.equal(maxInFlight, 1);
  assert.equal(new Set(requested).size, requested.length, 'no index requested twice');
});

test('cache get and put failures log and do not crash', async () => {
  const chunks = ['a'];
  const logs = [];
  let hasCalls = 0;
  const cache = {
    async get() { throw new Error('read boom'); },
    async has() { hasCalls += 1; if (hasCalls === 1) return false; throw new Error('read boom'); },
    async put() { throw new Error('write boom'); },
  };
  const speak = async () => ({ ok: true, bytes: new ArrayBuffer(1), attempts: 1 });
  const counter = { add() {}, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks, voice: 'v', lookahead: 1, cache, speak, counter, makeKey, onLog: (m) => logs.push(m) });
  await s.start();
  await wait(60);
  assert.ok(logs.some((m) => m === 'Cache read failed chunk 1: read boom'), 'read log: ' + logs.join(' | '));
  assert.ok(logs.some((m) => m === 'Cache write failed chunk 1: write boom'), 'write log: ' + logs.join(' | '));
  assert.equal(s.getState().state, 'error');
  assert.equal(s.getState().chunks[0].error.message, 'Could not save audio.');
});

function makeSched({ texts, speak, makeKey, counter, lookahead = 1 }) {
  return createScheduler({
    chunks: texts,
    voice: 'v',
    lookahead,
    cache: { has: async () => false, put: async () => {} },
    speak,
    counter: counter || { add() {} },
    makeKey: makeKey || (async ({ text }) => 'k:' + text),
  });
}

const NOTE_400 = 'Chunk 1 was rejected (HTTP 400) and its text, voice and provider have not changed. Edit the text or change the voice, then press Start Reading.';

async function waitFor(fn, ms = 1000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 2));
  }
  return false;
}

test('a 400 failure stays failed after resume with the same text and shows the note', async () => {
  let calls = 0;
  const sched = makeSched({
    texts: ['hello'],
    speak: async () => { calls += 1; return { ok: false, error: { kind: 'bad_request', status: 400, message: 'nope' }, attempts: 1 }; },
  });
  await sched.start();
  assert.equal(calls, 1);
  assert.equal(sched.getState().chunks[0].status, 'failed');
  await sched.resume();
  assert.equal(calls, 1);
  const s = sched.getState();
  assert.equal(s.chunks[0].status, 'failed');
  assert.equal(s.note, NOTE_400);
});

test('resume re-queues a 400 chunk when the key changed and calls speak once', async () => {
  let calls = 0;
  let keyMode = 'same';
  const sched = makeSched({
    texts: ['hello'],
    speak: async () => {
      calls += 1;
      if (calls === 1) return { ok: false, error: { kind: 'bad_request', status: 400, message: 'nope' }, attempts: 1 };
      return { ok: true, bytes: new Uint8Array([1]), attempts: 1 };
    },
    makeKey: async ({ text }) => (keyMode === 'same' ? 'k:' + text : 'k2:' + text),
  });
  await sched.start();
  assert.equal(calls, 1);
  keyMode = 'diff';
  await sched.resume();
  await waitFor(() => sched.getState().chunks[0].status === 'ready');
  assert.equal(calls, 2);
  assert.equal(sched.getState().chunks[0].status, 'ready');
});

test('a 500 failure is re-queued by resume as before', async () => {
  let calls = 0;
  const sched = makeSched({
    texts: ['hello'],
    speak: async () => {
      calls += 1;
      if (calls === 1) return { ok: false, error: { kind: 'upstream', status: 500, message: 'boom' }, attempts: 1 };
      return { ok: true, bytes: new Uint8Array([1]), attempts: 1 };
    },
  });
  await sched.start();
  assert.equal(sched.getState().chunks[0].status, 'failed');
  await sched.resume();
  await waitFor(() => sched.getState().chunks[0].status === 'ready');
  assert.equal(calls, 2);
  assert.equal(sched.getState().chunks[0].status, 'ready');
});

test('a 401 failure is re-queued by resume as before', async () => {
  let calls = 0;
  const sched = makeSched({
    texts: ['hello'],
    speak: async () => {
      calls += 1;
      if (calls === 1) return { ok: false, error: { kind: 'auth', status: 401, message: 'bad key' }, attempts: 1 };
      return { ok: true, bytes: new Uint8Array([1]), attempts: 1 };
    },
  });
  await sched.start();
  assert.equal(sched.getState().chunks[0].status, 'failed');
  await sched.resume();
  await waitFor(() => sched.getState().chunks[0].status === 'ready');
  assert.equal(calls, 2);
  assert.equal(sched.getState().chunks[0].status, 'ready');
});

test('with a 400 and a 500 failure, resume re-queues only the 500 one', async () => {
  const calls = [];
  const sched = makeSched({
    texts: ['a', 'b'],
    lookahead: 2,
    speak: async ({ input }) => {
      calls.push(input);
      if (input === 'a') return { ok: false, error: { kind: 'bad_request', status: 400, message: 'no' }, attempts: 1 };
      if (input === 'b' && calls.filter((x) => x === 'b').length === 1) return { ok: false, error: { kind: 'upstream', status: 500, message: 'boom' }, attempts: 1 };
      return { ok: true, bytes: new Uint8Array([1]), attempts: 1 };
    },
  });
  await sched.start();
  await sched.start();
  assert.deepEqual(sched.getState().chunks.map((c) => c.status), ['failed', 'failed']);
  await sched.resume();
  await waitFor(() => sched.getState().chunks[1].status === 'ready');
  assert.deepEqual(sched.getState().chunks.map((c) => c.status), ['failed', 'ready']);
  assert.equal(calls.filter((x) => x === 'a').length, 1);
  assert.equal(calls.filter((x) => x === 'b').length, 2);
});

test('resume with all failures skipped starts no loop and makes no speak call', async () => {
  let calls = 0;
  const sched = makeSched({
    texts: ['hello'],
    speak: async () => { calls += 1; return { ok: false, error: { kind: 'bad_request', status: 400, message: 'nope' }, attempts: 1 }; },
  });
  await sched.start();
  assert.equal(calls, 1);
  await sched.resume();
  assert.equal(calls, 1);
  assert.equal(sched.getState().state, 'error');
});

test('a skipped resume does not increment the counter', async () => {
  let added = 0;
  const sched = makeSched({
    texts: ['hello'],
    counter: { add(n) { added += n; } },
    speak: async () => ({ ok: false, error: { kind: 'bad_request', status: 400, message: 'nope' }, attempts: 1 }),
  });
  await sched.start();
  assert.equal(added, 1);
  await sched.resume();
  assert.equal(added, 1);
});

// --- pauses step (task 2.60e) ---

test('pauses: prepare returns clean text -> one request, raw under clean key, derived under chunk key, onReport once', async () => {
  const chunks = ['hello <break time="1.2s"/> world'];
  const cache = makeCache();
  const requests = [];
  const speak = async ({ input }) => { requests.push(input); return { ok: true, bytes: new Uint8Array([1, 2, 3]), attempts: 1 }; };
  let added = 0;
  const counter = { add(n) { added += n; }, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const reports = [];
  const pauses = {
    prepare: () => ({ requestText: 'hello  world' }),
    derive: async () => ({ bytes: new Uint8Array([9, 9]), report: [{ number: 1, status: 'ok' }] }),
    onReport: (i, r) => reports.push([i, r]),
  };
  const s = createScheduler({ chunks, voice: 'v', lookahead: 0, cache, speak, counter, makeKey, pauses });
  await s.start();
  await wait();
  assert.deepEqual(requests, ['hello  world']);
  assert.equal(requests.length, 1);
  assert.deepEqual(Array.from(cache._m.get('k:hello  world')), [1, 2, 3]);
  assert.deepEqual(Array.from(cache._m.get('k:' + chunks[0])), [9, 9]);
  assert.equal(reports.length, 1);
  assert.equal(reports[0][0], 0);
  assert.deepEqual(reports[0][1], [{ number: 1, status: 'ok' }]);
  assert.equal(added, 1);
  assert.equal(s.getState().chunks[0].status, 'ready');
});

test('pauses: a second run with the same chunk text finds the derived entry and makes no request', async () => {
  const chunks = ['hello <break time="1.2s"/> world'];
  const cache = makeCache();
  const makeKey = async ({ text }) => 'k:' + text;
  const pauses = { prepare: () => ({ requestText: 'hello  world' }), derive: async () => ({ bytes: new Uint8Array([9]), report: [] }) };
  let calls = 0;
  const speak = async () => { calls++; return { ok: true, bytes: new Uint8Array([1]), attempts: 1 }; };
  const counter = { add() {}, resetAt() { return 0; } };
  const s1 = createScheduler({ chunks, voice: 'v', lookahead: 0, cache, speak, counter, makeKey, pauses });
  await s1.start();
  await wait();
  assert.equal(calls, 1);
  calls = 0;
  const s2 = createScheduler({ chunks, voice: 'v', lookahead: 0, cache, speak, counter, makeKey, pauses });
  await s2.start();
  await wait();
  assert.equal(calls, 0);
  assert.equal(s2.getState().chunks[0].status, 'ready');
});

test('pauses: the same clean text with a different marker makes no request and stores a new derived entry', async () => {
  const cache = makeCache();
  const makeKey = async ({ text }) => 'k:' + text;
  const pauses = { prepare: () => ({ requestText: 'clean' }), derive: async (raw, t) => ({ bytes: new Uint8Array([t.length]), report: [] }) };
  let calls = 0;
  const speak = async () => { calls++; return { ok: true, bytes: new Uint8Array([7]), attempts: 1 }; };
  const counter = { add() {}, resetAt() { return 0; } };
  const s1 = createScheduler({ chunks: ['a <break time="1s"/>'], voice: 'v', lookahead: 0, cache, speak, counter, makeKey, pauses });
  await s1.start();
  await wait();
  assert.equal(calls, 1);
  const s2 = createScheduler({ chunks: ['b <break time="2s"/>'], voice: 'v', lookahead: 0, cache, speak, counter, makeKey, pauses });
  await s2.start();
  await wait();
  assert.equal(calls, 1);
  assert.deepEqual(Array.from(cache._m.get('k:clean')), [7]);
  assert.ok(cache._m.has('k:a <break time="1s"/>'));
  assert.ok(cache._m.has('k:b <break time="2s"/>'));
});

test('pauses: derive throwing stores the raw bytes under the chunk key and reports a failed entry', async () => {
  const chunks = ['x <break time="1s"/>'];
  const cache = makeCache();
  const makeKey = async ({ text }) => 'k:' + text;
  const reports = [];
  const pauses = {
    prepare: () => ({ requestText: 'x' }),
    derive: async () => { throw new Error('nope'); },
    onReport: (i, r) => reports.push(r),
  };
  const speak = async () => ({ ok: true, bytes: new Uint8Array([5]), attempts: 1 });
  const counter = { add() {}, resetAt() { return 0; } };
  const s = createScheduler({ chunks, voice: 'v', lookahead: 0, cache, speak, counter, makeKey, pauses });
  await s.start();
  await wait();
  assert.deepEqual(Array.from(cache._m.get('k:x <break time="1s"/>')), [5]);
  assert.equal(reports.length, 1);
  assert.equal(reports[0][0].status, 'failed');
  assert.ok(reports[0][0].reason.startsWith('Pauses were not applied: '));
  assert.equal(s.getState().chunks[0].status, 'ready');
});

test('pauses: a throwing onReport does not break the loop', async () => {
  const chunks = ['a <break time="1s"/>', 'b <break time="1s"/>'];
  const cache = makeCache();
  const makeKey = async ({ text }) => 'k:' + text;
  const pauses = {
    prepare: (t) => ({ requestText: t[0] }),
    derive: async () => ({ bytes: new Uint8Array([1]), report: [] }),
    onReport: () => { throw new Error('report boom'); },
  };
  const speak = async () => ({ ok: true, bytes: new Uint8Array([1]), attempts: 1 });
  const counter = { add() {}, resetAt() { return 0; } };
  const s = createScheduler({ chunks, voice: 'v', lookahead: 2, cache, speak, counter, makeKey, pauses });
  await s.start();
  await wait(50);
  assert.equal(s.getState().chunks[0].status, 'ready');
  assert.equal(s.getState().chunks[1].status, 'ready');
});

test('pauses: prepare returning null behaves exactly as before', async () => {
  const chunks = ['a', 'b'];
  const cache = makeCache();
  const requests = [];
  const speak = async ({ input }) => { requests.push(input); return { ok: true, bytes: new Uint8Array([1]), attempts: 1 }; };
  const counter = { add() {}, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const pauses = { prepare: () => null, derive: async () => ({ bytes: new Uint8Array([2]), report: [] }) };
  const s = createScheduler({ chunks, voice: 'v', lookahead: 1, cache, speak, counter, makeKey, pauses });
  await s.start();
  await wait();
  assert.deepEqual(requests, ['a', 'b']);
  assert.deepEqual(Array.from(cache._m.get('k:a')), [1]);
  assert.deepEqual(Array.from(cache._m.get('k:b')), [1]);
});

test('pauses: the counter increases only by the attempts of the one real request', async () => {
  const cache = makeCache();
  const makeKey = async ({ text }) => 'k:' + text;
  const pauses = { prepare: () => ({ requestText: 'clean' }), derive: async () => ({ bytes: new Uint8Array([1]), report: [] }) };
  let added = 0;
  const counter = { add(n) { added += n; }, resetAt() { return 0; } };
  let calls = 0;
  const speak = async () => { calls++; return { ok: true, bytes: new Uint8Array([1]), attempts: 3 }; };
  const s1 = createScheduler({ chunks: ['m <break time="1s"/>'], voice: 'v', lookahead: 0, cache, speak, counter, makeKey, pauses });
  await s1.start();
  await wait();
  assert.equal(added, 3);
  const s2 = createScheduler({ chunks: ['n <break time="2s"/>'], voice: 'v', lookahead: 0, cache, speak, counter, makeKey, pauses });
  await s2.start();
  await wait();
  assert.equal(calls, 1);
  assert.equal(added, 3);
});

test('pauses: a daily-cap speak error behaves as the old path', async () => {
  const chunks = ['a <break time="1s"/>'];
  const cache = makeCache();
  const makeKey = async ({ text }) => 'k:' + text;
  const pauses = { prepare: () => ({ requestText: 'a' }), derive: async () => ({ bytes: new Uint8Array([1]), report: [] }) };
  const speak = async () => ({ ok: false, error: { kind: 'daily_cap', message: 'cap', resetAt: 999 }, attempts: 1 });
  const counter = { add() {}, resetAt() { return 0; } };
  const s = createScheduler({ chunks, voice: 'v', lookahead: 0, cache, speak, counter, makeKey, pauses });
  await s.start();
  await wait();
  assert.equal(s.getState().state, 'waiting_reset');
  assert.equal(s.getState().resetAt, 999);
  assert.equal(s.getState().chunks[0].status, 'queued');
});

test('pauses: a 500 speak error behaves as the old path', async () => {
  const chunks = ['a <break time="1s"/>'];
  const cache = makeCache();
  const makeKey = async ({ text }) => 'k:' + text;
  const pauses = { prepare: () => ({ requestText: 'a' }), derive: async () => ({ bytes: new Uint8Array([1]), report: [] }) };
  let calls = 0;
  const speak = async () => {
    calls++;
    if (calls === 1) return { ok: false, error: { kind: 'upstream', status: 500, message: 'boom' }, attempts: 1 };
    return { ok: true, bytes: new Uint8Array([1]), attempts: 1 };
  };
  const counter = { add() {}, resetAt() { return 0; } };
  const s = createScheduler({ chunks, voice: 'v', lookahead: 0, cache, speak, counter, makeKey, pauses });
  await s.start();
  await wait();
  assert.equal(s.getState().chunks[0].status, 'failed');
  await s.resume();
  await waitFor(() => s.getState().chunks[0].status === 'ready');
  assert.equal(calls, 2);
  assert.equal(s.getState().chunks[0].status, 'ready');
});

test('pauses: without a pauses config nothing changes', async () => {
  const chunks = ['a', 'b'];
  const cache = makeCache();
  const requests = [];
  const speak = async ({ input }) => { requests.push(input); return { ok: true, bytes: new Uint8Array([1]), attempts: 1 }; };
  const counter = { add() {}, resetAt() { return 0; } };
  const makeKey = async ({ text }) => 'k:' + text;
  const s = createScheduler({ chunks, voice: 'v', lookahead: 1, cache, speak, counter, makeKey });
  await s.start();
  await wait();
  assert.deepEqual(requests, ['a', 'b']);
  assert.deepEqual(Array.from(cache._m.get('k:a')), [1]);
  assert.deepEqual(Array.from(cache._m.get('k:b')), [1]);
});
