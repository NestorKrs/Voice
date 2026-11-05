import { nextResetUtcMs } from './requestCounter.js';

export function createScheduler({ chunks, voice, lookahead, cache, speak, counter, makeKey, nowFn = Date.now, onChange = () => {} }) {
  const list = Array.isArray(chunks) ? chunks.slice() : [];
  const state = {
    state: 'idle',
    resetAt: null,
    playhead: 0,
    chunks: list.map(() => ({ status: 'queued', error: null, key: null })),
  };

  let currentController = null;
  let running = false;
  let paused = false;

  function emit() {
    const payload = {
      state: state.state,
      resetAt: state.resetAt,
      playhead: state.playhead,
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
        }
        if (hit) {
          state.chunks[idx].status = 'ready';
          state.chunks[idx].error = null;
          emit();
          continue;
        }
        // miss
        state.chunks[idx].status = 'generating';
        state.chunks[idx].error = null;
        emit();
        currentController = new AbortController();
        let result;
        try {
          result = await speak({ input: list[idx], voice, signal: currentController.signal });
        } catch (e) {
          result = { ok: false, error: { kind: 'network', message: 'Network error.' }, attempts: 0 };
        }
        currentController = null;

        if (result && result.ok === false && result.error && result.error.kind === 'aborted') {
          state.state = 'cancelled';
          emit();
          break;
        }

        if (result && result.attempts) {
          try { counter.add(result.attempts); } catch (e) {}
        }

        if (result && result.ok) {
          try {
            await cache.put(key, result.bytes);
          } catch (e) {
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
        state.chunks[idx].error = { kind: err.kind, message: err.message };
        state.state = 'error';
        emit();
        break;
      }
    } finally {
      running = false;
    }
  }

  return {
    async start() {
      paused = false;
      state.state = 'generating';
      state.resetAt = null;
      await computeKeys();
      // mark cached as ready
      for (let i = 0; i < list.length; i++) {
        try {
          if (await cache.has(state.chunks[i].key)) {
            state.chunks[i].status = 'ready';
          }
        } catch (e) {}
      }
      emit();
      runLoop();
    },
    setPlayhead(index) {
      state.playhead = index;
      if (state.state === 'idle') {
        state.state = 'generating';
        runLoop();
      }
    },
    pause() {
      paused = true;
    },
    async resume() {
      paused = false;
      if (state.state === 'waiting_reset' || state.state === 'error') {
        state.state = 'generating';
        state.resetAt = null;
      }
      // set failed chunks in window to queued
      for (let i = 0; i < list.length; i++) {
        if (state.chunks[i].status === 'failed') state.chunks[i].status = 'queued';
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
        try { currentController.abort(); } catch (e) {}
      }
      state.state = 'cancelled';
      emit();
    },
    getState() {
      return {
        state: state.state,
        resetAt: state.resetAt,
        playhead: state.playhead,
        chunks: state.chunks.map((c) => ({ status: c.status, error: c.error })),
      };
    },
  };
}