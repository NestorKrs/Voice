import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORE_KEY,
  MAX_ENTRIES,
  audioKeyFrom,
  createMarkerStore,
} from '../src/clipMarkerStore.js';

function fakeStorage() {
  const values = new Map();
  const calls = [];
  return {
    values,
    calls,
    getItem(key) {
      calls.push(['get', key]);
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      calls.push(['set', key]);
      values.set(key, String(value));
    },
  };
}

function stored(storage) {
  return JSON.parse(storage.values.get(STORE_KEY));
}

test('audioKeyFrom is stable, lower-case hex and sensitive to order and length', () => {
  const key = audioKeyFrom(['chunk-a', 'chunk-b']);
  assert.match(key, /^a[0-9a-f]{8}$/);
  assert.equal(audioKeyFrom(['chunk-a', 'chunk-b']), key);
  assert.notEqual(audioKeyFrom(['chunk-b', 'chunk-a']), key);
  assert.notEqual(audioKeyFrom(['chunk-a', 'chunk-b', 'chunk-c']), key);
  assert.notEqual(audioKeyFrom(['chunk-a|chunk-b']), audioKeyFrom(['chunk-a', 'chunk-b']));
});

test('save and load round trip, and the stored shape is oldest-first with rate', () => {
  const storage = fakeStorage();
  const store = createMarkerStore(storage);
  assert.equal(store.save('key-1', 12, 1.25, [2, 5, 8], ['one', 'two']), true);
  assert.deepEqual(store.load('key-1', 12), { markers: [2, 5, 8], names: ['one', 'two'] });
  assert.deepEqual(stored(storage), {
    v: 1,
    items: [{ k: 'key-1', total: 12, rate: 1.25, markers: [2, 5, 8], names: ['one', 'two'] }],
  });
  assert.deepEqual(store.load('missing', 12), null);
});

test('load never writes and the fake storage only ever sees STORE_KEY', () => {
  const storage = fakeStorage();
  const store = createMarkerStore(storage);
  store.save('a', 10, 1, [3], []);
  const before = storage.calls.length;
  store.load('a', 10);
  store.load('a', 11);
  assert.equal(storage.calls.slice(before).every(([op]) => op === 'get'), true);
  store.remove('a');
  store.clear();
  assert.equal(storage.calls.every(([, key]) => key === STORE_KEY), true);
  assert.equal(storage.values.size, 1);
});

test('a different total returns null', () => {
  const storage = fakeStorage();
  const store = createMarkerStore(storage);
  store.save('a', 10, 1, [3], []);
  assert.deepEqual(store.load('a', 11), null);
});

test('invalid markers return null', () => {
  const storage = fakeStorage();
  const store = createMarkerStore(storage);
  for (const markers of [[1.5], [2, 2], [3, 2], [0], [10], [1, 11], ['2']]) {
    store.save('a', 10, 1, markers, []);
    assert.deepEqual(store.load('a', 10), null, `expected null for ${JSON.stringify(markers)}`);
  }
  storage.setItem(STORE_KEY, JSON.stringify({
    v: 1,
    items: [{ k: 'a', total: 10, rate: 1, markers: '3', names: [] }],
  }));
  assert.deepEqual(store.load('a', 10), null);
});

test('saving empty markers removes the entry', () => {
  const storage = fakeStorage();
  const store = createMarkerStore(storage);
  store.save('a', 10, 1, [3], ['name']);
  assert.equal(store.save('a', 10, 1, [], []), true);
  assert.deepEqual(store.load('a', 10), null);
  assert.deepEqual(stored(storage), { v: 1, items: [] });
});

test('the 51st entry drops the oldest', () => {
  const storage = fakeStorage();
  const store = createMarkerStore(storage);
  for (let i = 0; i <= MAX_ENTRIES; i += 1) store.save('k' + i, 10, 1, [1], []);
  const state = stored(storage);
  assert.equal(state.items.length, MAX_ENTRIES);
  assert.equal(state.items[0].k, 'k1');
  assert.equal(state.items[MAX_ENTRIES - 1].k, 'k50');
  assert.deepEqual(store.load('k0', 10), null);
  assert.notEqual(store.load('k50', 10), null);
});

test('re-saving an entry moves it to the newest', () => {
  const storage = fakeStorage();
  const store = createMarkerStore(storage);
  store.save('a', 10, 1, [1], []);
  store.save('b', 10, 1, [1], []);
  store.save('a', 10, 1, [4], []);
  assert.deepEqual(stored(storage).items.map((item) => item.k), ['b', 'a']);
  for (let i = 0; i < MAX_ENTRIES - 1; i += 1) store.save('n' + i, 10, 1, [1], []);
  assert.deepEqual(store.load('a', 10), { markers: [4], names: [] });
  assert.deepEqual(store.load('b', 10), null);
});

test('corrupt JSON is an empty store and a later save writes fresh', () => {
  const storage = fakeStorage();
  const store = createMarkerStore(storage);
  storage.setItem(STORE_KEY, '{not json');
  assert.deepEqual(store.load('a', 10), null);
  assert.equal(store.save('a', 10, 1, [2], ['x']), true);
  assert.deepEqual(stored(storage), {
    v: 1,
    items: [{ k: 'a', total: 10, rate: 1, markers: [2], names: ['x'] }],
  });
});

test('wrong version or non-array items are an empty store', () => {
  const storage = fakeStorage();
  const store = createMarkerStore(storage);
  storage.setItem(STORE_KEY, JSON.stringify({
    v: 2,
    items: [{ k: 'a', total: 10, rate: 1, markers: [2], names: [] }],
  }));
  assert.deepEqual(store.load('a', 10), null);
  storage.setItem(STORE_KEY, JSON.stringify({ v: 1, items: {} }));
  assert.deepEqual(store.load('a', 10), null);
  store.save('a', 10, 1, [2], []);
  assert.deepEqual(stored(storage).items.map((item) => item.k), ['a']);
});

test('names longer than 60 characters are cut', () => {
  const storage = fakeStorage();
  const store = createMarkerStore(storage);
  store.save('a', 10, 1, [2], ['x'.repeat(70), 5, null, 'ok']);
  assert.deepEqual(store.load('a', 10), {
    markers: [2],
    names: ['x'.repeat(60), 'ok'],
  });
});

test('setItem throwing makes save, remove and clear return false without throwing', () => {
  const storage = fakeStorage();
  const store = createMarkerStore(storage);
  storage.setItem = () => { throw new Error('quota'); };
  assert.equal(store.save('a', 10, 1, [2], []), false);
  assert.equal(store.remove('a'), false);
  assert.equal(store.clear(), false);
});
