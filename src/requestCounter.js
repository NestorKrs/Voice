export function utcDayKey(nowMs) {
  const d = new Date(nowMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nextResetUtcMs(nowMs) {
  const d = new Date(nowMs);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
  return next;
}

export function createRequestCounter(storage, nowFn = Date.now, storageKey = 'voice.requests') {
  const read = () => {
    try {
      const raw = storage.getItem(storageKey);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      return obj;
    } catch (e) {
      return null;
    }
  };
  const write = (obj) => {
    storage.setItem(storageKey, JSON.stringify(obj));
  };
  return {
    count() {
      const obj = read();
      const today = utcDayKey(nowFn());
      if (!obj || obj.day !== today) return 0;
      const n = Number(obj.count);
      return Number.isFinite(n) ? n : 0;
    },
    add(n = 1) {
      const today = utcDayKey(nowFn());
      const obj = read();
      let c = 0;
      if (obj && obj.day === today) {
        const v = Number(obj.count);
        c = Number.isFinite(v) ? v : 0;
      }
      c += n;
      write({ day: today, count: c });
    },
    resetAt() {
      return nextResetUtcMs(nowFn());
    },
  };
}