export async function makeCacheKey({ model, voice, text }) {
  const v = voice == null ? '' : voice;
  const input = `${model}\n${v}\n${text}`;
  const buf = new TextEncoder().encode(input);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', buf);
  const arr = Array.from(new Uint8Array(hash));
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function createMemoryStore() {
  const map = new Map();
  return {
    async get(key) { return map.has(key) ? map.get(key) : null; },
    async put(key, bytes) { map.set(key, bytes); },
    async delete(key) { map.delete(key); },
    async clear() { map.clear(); },
    async totalBytes() {
      let n = 0;
      for (const v of map.values()) n += (v && v.byteLength) || (v && v.size) || 0;
      return n;
    },
  };
}

export function createIdbStore(dbName = 'voice-audio') {
  const openDb = () => new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
    const req = globalThis.indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('IndexedDB unavailable'));
  });
  const store = {
    async get(key) {
      try {
        const db = await openDb();
        return await new Promise((resolve, reject) => {
          const tx = db.transaction('chunks', 'readonly');
          const os = tx.objectStore('chunks');
          const r = os.get(key);
          r.onsuccess = () => resolve(r.result ? r.result.bytes || r.result : null);
          r.onerror = () => reject(new Error('IndexedDB unavailable'));
        });
      } catch { throw new Error('IndexedDB unavailable'); }
    },
    async put(key, bytes) {
      try {
        const db = await openDb();
        await new Promise((resolve, reject) => {
          const tx = db.transaction('chunks', 'readwrite');
          const os = tx.objectStore('chunks');
          const r = os.put({ bytes, size: bytes.byteLength, savedAt: Date.now() }, key);
          r.onsuccess = () => resolve();
          r.onerror = () => reject(new Error('IndexedDB unavailable'));
        });
      } catch { throw new Error('IndexedDB unavailable'); }
    },
    async delete(key) {
      try {
        const db = await openDb();
        await new Promise((resolve, reject) => {
          const tx = db.transaction('chunks', 'readwrite');
          const os = tx.objectStore('chunks');
          const r = os.delete(key);
          r.onsuccess = () => resolve();
          r.onerror = () => reject(new Error('IndexedDB unavailable'));
        });
      } catch { throw new Error('IndexedDB unavailable'); }
    },
    async clear() {
      try {
        const db = await openDb();
        await new Promise((resolve, reject) => {
          const tx = db.transaction('chunks', 'readwrite');
          const os = tx.objectStore('chunks');
          const r = os.clear();
          r.onsuccess = () => resolve();
          r.onerror = () => reject(new Error('IndexedDB unavailable'));
        });
      } catch { throw new Error('IndexedDB unavailable'); }
    },
    async totalBytes() {
      try {
        const db = await openDb();
        return await new Promise((resolve, reject) => {
          const tx = db.transaction('chunks', 'readonly');
          const os = tx.objectStore('chunks');
          const r = os.getAll();
          r.onsuccess = () => {
            const vals = r.result || [];
            resolve(vals.reduce((n, v) => n + (v.size || (v.bytes && v.bytes.byteLength) || 0), 0));
          };
          r.onerror = () => reject(new Error('IndexedDB unavailable'));
        });
      } catch { throw new Error('IndexedDB unavailable'); }
    },
  };
  return store;
}

export function createAudioCache(store) {
  return {
    async get(key) {
      try {
        const v = await store.get(key);
        if (!v) return null;
        return v instanceof ArrayBuffer ? v : (v.bytes || null);
      } catch {
        return null;
      }
    },
    async put(key, bytes) {
      if (!bytes || bytes.byteLength === 0) throw new Error('Empty audio');
      await store.put(key, bytes);
    },
    async has(key) {
      const v = await this.get(key);
      return v !== null;
    },
    async clear() { await store.clear(); },
    async totalBytes() { return await store.totalBytes(); },
  };
}