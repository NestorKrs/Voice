import { nextResetUtcMs } from './requestCounter.js';

export function createScheduler({ chunks, voice, lookahead, cache, speak, counter, makeKey, nowFn = Date.now, onChange = () => {}, onLog = () => {} }) {
  const list = Array.isArray(chunks) ? chunks.slice() : [];
  const state = {
    state: 'idle',
    resetAt: null,
    playhead: 0,
    note: null,
    chunks: list.map(() => ({ status: 'queued', error: null, key: null, failedKey: null })),
  };

  let currentController = null;
  let running = false;
  let paused = false;

  function emit() {
    const payload = {
      state: state.state,
      resetAt: state.resetAt,
      playhead: state.playhead,
      note: state.note,
      chunks: state.chunks.map((c) => ({ status: c.status, error: c.error })),
    };
    onChange(payload);
  }

  async function computeKeys() {
    for (let i = 0; i < list.length; i++) {
      state.chunks[i].key = await makeKey({ text: list[i], voice });
    }
  }

  async function runLoop() {
    if (running) return;
    running = true;
    let currentIdx = null;
    try {
      while (!paused && state.state !== 'cancelled') {
        // check window
        const end = Math.min(list.length - 1, state.playhead + lookahead);
        // first queued in window
        let idx = -1;
        for (let i = state.playhead; i <= end; i++) {
          if (state.chunks[i].status === 'queued') { idx = i; break; }
        }
        if (idx === -1) {
          // done if all ready
          const allReady = state.chunks.every((c) => c.status === 'ready');
          state.state = allReady ? 'done' : 'idle';
          emit();
          break;
        }
        // cache check
        const key = state.chunks[idx].key;
        let hit = false;
        try {
          hit = await cache.has(key);
        } catch (e) {
          hit = false;
          onLog('Cache read failed chunk ' + (idx + 1) + ': ' + (e && e.message ? e.message : String(e)));
        }
        if (hit) {
          state.chunks[idx].status = 'ready';
          state.chunks[idx].error = null;
          emit();
          continue;
        }
        // miss
        currentIdx = idx;
        state.chunks[idx].status = 'generating';
        state.chunks[idx].error = null;
        emit();
        currentController = new AbortController();
        let result;
        try {
          result = await speak({ input: list[idx], voice, signal: currentController.signal });
        } catch {
          result = { ok: false, error: { kind: 'network', message: 'Network error.' }, attempts: 0 };
        }
        currentController = null;

        if (result && result.ok === false && result.error && result.error.kind === 'aborted') {
          state.state = 'cancelled';
          emit();
          break;
        }

        if (result && result.attempts) {
          try { counter.add(result.attempts); } catch {}
        }

        if (result && result.ok) {
          try {
            await cache.put(key, result.bytes);
          } catch (e) {
            onLog('Cache write failed chunk ' + (idx + 1) + ': ' + (e && e.message ? e.message : String(e)));
            state.chunks[idx].status = 'failed';
            state.chunks[idx].error = { kind: 'cache', message: 'Could not save audio.' };
            state.state = 'error';
            emit();
            break;
          }
          state.chunks[idx].status = 'ready';
          state.chunks[idx].error = null;
          emit();
          continue;
        }

        // error
        const err = (result && result.error) || { kind: 'unknown', message: 'Unknown error.' };
        if (err.kind === 'daily_cap') {
          state.chunks[idx].status = 'queued';
          state.chunks[idx].error = null;
          state.state = 'waiting_reset';
          state.resetAt = (typeof err.resetAt === 'number') ? err.resetAt : nextResetUtcMs(nowFn());
          emit();
          break;
        }
        state.chunks[idx].status = 'failed';
        state.chunks[idx].error = { kind: err.kind, status: err.status, message: err.message };
        state.chunks[idx].failedKey = err.kind === 'bad_request' ? state.chunks[idx].key : null;
        state.state = 'error';
        emit();
        break;
      }
    } catch (e) {
      const msg = (e && e.message ? e.message : String(e)).slice(0, 300);
      if (currentIdx !== null && state.chunks[currentIdx] && state.chunks[currentIdx].status === 'generating') {
        state.chunks[currentIdx].status = 'failed';
        state.chunks[currentIdx].error = { kind: 'internal', message: msg };
      }
      state.state = 'error';
      emit();
    } finally {
      running = false;
    }
  }

  return {
    async start() {
      paused = false;
      state.state = 'generating';
      state.resetAt = null;
      state.note = null;
      await computeKeys();
      // mark cached as ready
      for (let i = 0; i < list.length; i++) {
        try {
          if (await cache.has(state.chunks[i].key)) {
            state.chunks[i].status = 'ready';
          }
        } catch (e) {
          onLog('Cache read failed chunk ' + (i + 1) + ': ' + (e && e.message ? e.message : String(e)));
          state.state = 'error';
          state.chunks[i].status = 'failed';
          state.chunks[i].error = { kind: 'cache', message: (e && e.message ? e.message : String(e)).slice(0,300) };
          emit();
          return;
        }
      }
      emit();
      await runLoop();
    },
    setPlayhead(index) {
      state.playhead = index;
      if (state.state === 'idle') {
        state.state = 'generating';
        runLoop();
      }
    },
    pause() {
      if (['cancelled', 'done', 'error', 'waiting_reset'].includes(state.state)) return;
      paused = true;
      state.state = 'paused';
      emit();
    },
    async resume() {
      paused = false;
      state.note = null;
      if (['waiting_reset', 'error', 'paused', 'cancelled'].includes(state.state)) {
        state.state = 'generating';
        state.resetAt = null;
      }
      // A chunk rejected with HTTP 400 keeps its failedKey; re-queue it only when
      // the text, voice or provider changed the key. Every other failure re-queues.
      let failedCount = 0;
      let skippedCount = 0;
      let note = null;
      for (let i = 0; i < list.length; i++) {
        const c = state.chunks[i];
        if (c.status === 'failed') {
          failedCount += 1;
          if (c.failedKey) {
            const key = await makeKey({ text: list[i], voice });
            if (key === c.failedKey) {
              skippedCount += 1;
              if (!note) {
                note = 'Chunk ' + (i + 1) + ' was rejected (HTTP 400) and its text, voice and provider have not changed. Edit the text or change the voice, then press Start Reading.';
              }
              continue;
            }
          }
          c.status = 'queued';
          c.error = null;
          c.failedKey = null;
        }
        if (!currentController && c.status === 'generating') c.status = 'queued';
      }
      state.note = note;
      if (failedCount > 0 && skippedCount === failedCount) {
        state.state = 'error';
        emit();
        return;
      }
      emit();
      runLoop();
    },
    async retryChunk(index) {
      if (index < 0 || index >= list.length) return;
      if (state.chunks[index].status !== 'failed') return;
      state.chunks[index].status = 'queued';
      state.chunks[index].error = null;
      state.state = 'generating';
      emit();
      runLoop();
    },
    cancel() {
      paused = true;
      if (currentController) {
        try { currentController.abort(); } catch {}
      }
      state.state = 'cancelled';
      emit();
    },
    getState() {
      return {
        state: state.state,
        resetAt: state.resetAt,
        playhead: state.playhead,
        note: state.note,
        chunks: state.chunks.map((c) => ({ status: c.status, error: c.error })),
      };
    },
  };
}