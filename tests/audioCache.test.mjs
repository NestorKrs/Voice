import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCacheKey, createMemoryStore, createAudioCache, createIdbStore } from '../src/audioCache.js';

test('same input same key', async () => {
  const a = await makeCacheKey({ model: 'm', voice: 'v', text: 't' });
  const b = await makeCacheKey({ model: 'm', voice: 'v', text: 't' });
  assert.equal(a, b);
});

test('changing model/voice/text changes key', async () => {
  const base = await makeCacheKey({ model: 'm', voice: 'v', text: 't' });
  assert.notEqual(base, await makeCacheKey({ model: 'm2', voice: 'v', text: 't' }));
  assert.notEqual(base, await makeCacheKey({ model: 'm', voice: 'v2', text: 't' }));
  assert.notEqual(base, await makeCacheKey({ model: 'm', voice: 'v', text: 't2' }));
});

test('empty and undefined voice same key', async () => {
  const a = await makeCacheKey({ model: 'm', voice: '', text: 't' });
  const b = await makeCacheKey({ model: 'm', voice: undefined, text: 't' });
  assert.equal(a, b);
});

test('put then get equal bytes', async () => {
  const store = createMemoryStore();
  const cache = createAudioCache(store);
  const bytes = new Uint8Array([1, 2, 3]).buffer;
  const key = await makeCacheKey({ model: 'm', voice: '', text: 't' });
  await cache.put(key, bytes);
  const got = await cache.get(key);
  assert.ok(got instanceof ArrayBuffer);
  assert.equal(got.byteLength, 3);
});

test('miss returns null', async () => {
  const cache = createAudioCache(createMemoryStore());
  const r = await cache.get('nope');
  assert.equal(r, null);
});

test('has', async () => {
  const cache = createAudioCache(createMemoryStore());
  const key = await makeCacheKey({ model: 'm', voice: '', text: 't' });
  assert.equal(await cache.has(key), false);
  await cache.put(key, new Uint8Array([1]).buffer);
  assert.equal(await cache.has(key), true);
});

test('put empty rejects', async () => {
  const cache = createAudioCache(createMemoryStore());
  await assert.rejects(() => cache.put('k', new ArrayBuffer(0)));
});

test('clear empties', async () => {
  const cache = createAudioCache(createMemoryStore());
  await cache.put('k', new Uint8Array([1]).buffer);
  await cache.clear();
  assert.equal(await cache.get('k'), null);
});

test('get rejection propagates', async () => {
  const store = { get: async () => { throw new Error('IndexedDB unavailable: test'); }, put: async () => {}, has: async () => false, clear: async () => {}, totalBytes: async () => 0 };
  const cache = createAudioCache(store);
  await assert.rejects(() => cache.get('k'), /IndexedDB unavailable: test/);
  await assert.rejects(() => cache.has('k'), /IndexedDB unavailable: test/);
});

test('fake store returns Uint8Array', async () => {
  const arr = new Uint8Array([1, 2, 3]);
  const store = { get: async () => arr, put: async () => {}, has: async () => false, clear: async () => {}, totalBytes: async () => 0 };
  const cache = createAudioCache(store);
  const got = await cache.get('k');
  assert.ok(got instanceof Uint8Array);
  assert.equal(got.byteLength, 3);
  assert.equal(await cache.has('k'), true);
});

test('fake store returns ArrayBuffer', async () => {
  const buf = new ArrayBuffer(2);
  const store = { get: async () => buf, put: async () => {}, has: async () => false, clear: async () => {}, totalBytes: async () => 0 };
  const cache = createAudioCache(store);
  const got = await cache.get('k');
  assert.ok(got instanceof ArrayBuffer);
  assert.equal(await cache.has('k'), true);
});

test('missing key null/false', async () => {
  const store = { get: async () => null, put: async () => {}, has: async () => false, clear: async () => {}, totalBytes: async () => 0 };
  const cache = createAudioCache(store);
  assert.equal(await cache.get('k'), null);
  assert.equal(await cache.has('k'), false);
});

test('empty buffer counts as miss', async () => {
  const store = { get: async () => new Uint8Array([]), put: async () => {}, has: async () => false, clear: async () => {}, totalBytes: async () => 0 };
  const cache = createAudioCache(store);
  assert.equal(await cache.get('k'), null);
  assert.equal(await cache.has('k'), false);
});

test('totalBytes adds sizes', async () => {
  const cache = createAudioCache(createMemoryStore());
  await cache.put('a', new Uint8Array([1, 2]).buffer);
  await cache.put('b', new Uint8Array([1, 2, 3]).buffer);
  assert.equal(await cache.totalBytes(), 5);
});

test('idb open that never fires rejects after openTimeoutMs', async () => {
  const realIdb = globalThis.indexedDB;
  globalThis.indexedDB = { open: () => ({}) };
  try {
    const store = createIdbStore('voice-test', 10);
    await assert.rejects(() => store.get('k'), /IndexedDB did not open within 5 s/);
  } finally {
    globalThis.indexedDB = realIdb;
  }
});

test('idb open that fires onblocked rejects with the blocked message', async () => {
  const realIdb = globalThis.indexedDB;
  const req = {};
  globalThis.indexedDB = { open: () => req };
  try {
    const store = createIdbStore('voice-test', 1000);
    const pending = store.get('k');
    req.onblocked();
    await assert.rejects(() => pending, /IndexedDB blocked: close other Voice tabs/);
  } finally {
    globalThis.indexedDB = realIdb;
  }
});