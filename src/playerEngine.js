import { reduce, createInitialState, RATES } from './playerCore.js';

export function createPlayerEngine({ getBytes, createAudio, makeUrl, revokeUrl, onChange = () => {}, onEvent = () => {} } = {}) {
  if (!createAudio) createAudio = () => new Audio();
  if (!makeUrl) makeUrl = (bytes) => {
    const BlobCtor = globalThis.Blob;
    const urlCtor = globalThis.URL;
    return urlCtor.createObjectURL(new BlobCtor([bytes], { type: 'audio/mpeg' }));
  };
  if (!revokeUrl) revokeUrl = (u) => { globalThis.URL.revokeObjectURL(u); };

  let state = createInitialState({ total: 0 });
  let volume = 1;
  let destroyed = false;
  let loadToken = 0;

  const slots = {
    A: { audio: createAudio(), url: null, index: null, loaded: false },
    B: { audio: createAudio(), url: null, index: null, loaded: false },
  };
  let activeKey = 'A';
  let idleKey = 'B';

  function active() { return slots[activeKey]; }
  function idle() { return slots[idleKey]; }

  function swapSlots() { const t = activeKey; activeKey = idleKey; idleKey = t; }

  function applyRateAndVolume(audio) {
    if (!audio) return;
    audio.playbackRate = state.rate;
    audio.volume = volume;
    audio.preservesPitch = true;
    audio.mozPreservesPitch = true;
  }

  function getState() {
    const a = active();
    const audio = a && a.audio;
    return {
      total: state.total,
      index: state.index,
      status: state.status,
      rate: state.rate,
      volume,
      buffering: /* tracked */ (state.status === 'playing' && !(a && a.loaded && a.index === state.index)),
      position: audio ? (audio.currentTime || 0) : 0,
      duration: audio ? (audio.duration || 0) : 0,
    };
  }

  // We'll track buffering explicitly
  let bufferingFlag = false;

  function getState2() {
    const a = active();
    const audio = a && a.audio;
    return {
      total: state.total,
      index: state.index,
      status: state.status,
      rate: state.rate,
      volume,
      buffering: bufferingFlag,
      position: audio ? (audio.currentTime || 0) : 0,
      duration: audio ? (audio.duration || 0) : 0,
    };
  }

  function emitChange() {
    if (destroyed) return;
    onChange(getState2());
  }

  function emitEvent(msg) { if (!destroyed) onEvent(msg); }

  // listeners
  const listeners = new Map();
  function attach(audio) {
    const handlers = {
      ended: () => onEnded(audio),
      error: () => onError(audio),
      timeupdate: () => onTimeUpdate(audio),
    };
    listeners.set(audio, handlers);
    for (const [ev, h] of Object.entries(handlers)) audio.addEventListener(ev, h);
  }
  function detach(audio) {
    const handlers = listeners.get(audio);
    if (handlers) {
      for (const [ev, h] of Object.entries(handlers)) audio.removeEventListener(ev, h);
      listeners.delete(audio);
    }
  }

  let lastTimeEmit = 0;
  function onTimeUpdate(audio) {
    if (destroyed) return;
    if (audio !== active().audio) return;
    const now = Date.now();
    if (now - lastTimeEmit >= 250) {
      lastTimeEmit = now;
      emitChange();
    }
  }

  async function loadAndPlay(index, token) {
    if (destroyed) return;
    const slot = active();
    // get bytes
    let bytes;
    try { bytes = await getBytes(index); } catch { bytes = null; }
    if (destroyed || token !== loadToken) {
      if (bytes) { const u = makeUrl(bytes); revokeUrl(u); }
      return;
    }
    if (bytes == null) {
      bufferingFlag = true;
      emitEvent(`Player: buffering chunk ${index}`);
      emitChange();
      return;
    }
    const url = makeUrl(bytes);
    // set src
    slot.url = url;
    slot.index = index;
    slot.loaded = true;
    slot.audio.src = url;
    slot.audio.playbackRate = state.rate;
    slot.audio.volume = volume;
    slot.audio.preservesPitch = true;
    slot.audio.mozPreservesPitch = true;
    bufferingFlag = false;
    emitEvent(`Player: chunk ${index} playing`);
    try {
      await slot.audio.play();
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      state = reduce(state, { type: 'PAUSE' }); // not exactly but status paused
      // force status paused
      state = { ...state, status: 'paused' };
      bufferingFlag = false;
      emitEvent('Click Play to start audio.');
      emitChange();
      return;
    }
    // preload next
    preload(index + 1, token);
    emitChange();
  }

  async function preload(index, token) {
    if (destroyed) return;
    if (index >= state.total) return;
    const sl = idle();
    // if already loaded same index, skip
    if (sl.loaded && sl.index === index) return;
    let bytes;
    try { bytes = await getBytes(index); } catch { bytes = null; }
    if (destroyed || token !== loadToken) {
      if (bytes) { const u = makeUrl(bytes); revokeUrl(u); }
      return;
    }
    if (bytes == null) return;
    // revoke previous url of idle slot
    if (sl.url) { revokeUrl(sl.url); sl.url = null; sl.loaded = false; }
    const url = makeUrl(bytes);
    sl.url = url;
    sl.index = index;
    sl.loaded = true;
    sl.audio.src = url;
    sl.audio.playbackRate = state.rate;
    sl.audio.volume = volume;
    sl.audio.preservesPitch = true;
    sl.audio.mozPreservesPitch = true;
  }

  function onEnded(audio) {
    if (destroyed) return;
    if (audio !== active().audio) return;
    // reduce ENDED
    const prevIndex = state.index;
    state = reduce(state, { type: 'ENDED' });
    const oldSlot = active();
    // revoke url of ended slot
    if (oldSlot.url) { revokeUrl(oldSlot.url); oldSlot.url = null; oldSlot.loaded = false; }
    if (state.status === 'finished') {
      emitEvent('Player: finished');
      bufferingFlag = false;
      emitChange();
      return;
    }
    // try swap if idle loaded with next chunk
    const idl = idle();
    if (idl.loaded && idl.index === state.index) {
      swapSlots();
      const newActive = active();
      bufferingFlag = false;
      try {
        newActive.audio.playbackRate = state.rate;
        newActive.audio.volume = volume;
        newActive.audio.preservesPitch = true;
        newActive.audio.mozPreservesPitch = true;
        newActive.audio.play().catch(() => {});
      } catch {}
      emitEvent(`Player: chunk ${state.index} playing`);
      // preload next
      loadToken++;
      const token = loadToken;
      preload(state.index + 1, token);
      emitChange();
    } else {
      bufferingFlag = true;
      emitEvent(`Player: buffering chunk ${state.index}`);
      emitChange();
    }
  }

  function onError(audio) {
    if (destroyed) return;
    if (audio !== active().audio) return;
    const code = (audio.error && typeof audio.error.code === 'number') ? audio.error.code : 0;
    state = { ...state, status: 'paused' };
    bufferingFlag = false;
    emitEvent(`Playback failed (code ${code})`);
    emitChange();
  }

  // attach listeners
  attach(slots.A.audio);
  attach(slots.B.audio);

  const engine = {
    setTotal(n) {
      if (destroyed) return;
      state = reduce(state, { type: 'SET_TOTAL', total: n });
      emitChange();
    },
    play() {
      if (destroyed) return;
      if (state.total === 0) return;
      if (state.status === 'playing') return;
      if (state.status === 'finished') {
        state = reduce(state, { type: 'PLAY' });
      } else {
        state = reduce(state, { type: 'PLAY' });
      }
      const slot = active();
      // resume if same chunk loaded and paused
      if (slot.loaded && slot.index === state.index && slot.audio.paused) {
        slot.audio.play().catch((e) => {
          if (e && e.name === 'AbortError') return;
          state = { ...state, status: 'paused' };
          emitEvent('Click Play to start audio.');
          emitChange();
        });
        bufferingFlag = false;
        emitChange();
        return;
      }
      loadToken++;
      const token = loadToken;
      loadAndPlay(state.index, token);
    },
    pause() {
      if (destroyed) return;
      const slot = active();
      if (slot.audio) slot.audio.pause();
      state = reduce(state, { type: 'PAUSE' });
      bufferingFlag = false;
      emitChange();
    },
    toggle() {
      if (destroyed) return;
      if (state.status === 'playing') { this.pause(); }
      else { this.play(); }
    },
    stop() {
      if (destroyed) return;
      loadToken++;
      const slot = active();
      if (slot.audio) { slot.audio.pause(); slot.audio.currentTime = 0; }
      state = reduce(state, { type: 'STOP' });
      bufferingFlag = false;
      emitChange();
    },
    next() {
      if (destroyed) return;
      const before = state.index;
      state = reduce(state, { type: 'NEXT' });
      if (state.index === before) { emitChange(); return; }
      state = reduce(state, { type: 'JUMP', index: state.index });
      // load new
      loadToken++;
      const token = loadToken;
      const oldSlot = active();
      if (oldSlot.audio) { oldSlot.audio.pause(); }
      if (oldSlot.url) { revokeUrl(oldSlot.url); oldSlot.url = null; oldSlot.loaded = false; }
      loadAndPlay(state.index, token);
    },
    prev() {
      if (destroyed) return;
      const before = state.index;
      state = reduce(state, { type: 'PREV' });
      if (state.index === before) { emitChange(); return; }
      state = reduce(state, { type: 'JUMP', index: state.index });
      loadToken++;
      const token = loadToken;
      const oldSlot = active();
      if (oldSlot.audio) { oldSlot.audio.pause(); }
      if (oldSlot.url) { revokeUrl(oldSlot.url); oldSlot.url = null; oldSlot.loaded = false; }
      loadAndPlay(state.index, token);
    },
    jump(i) {
      if (destroyed) return;
      const before = state.index;
      state = reduce(state, { type: 'JUMP', index: i });
      if (state.index === before && state.status !== 'playing') { /* still maybe */ }
      loadToken++;
      const token = loadToken;
      const oldSlot = active();
      if (oldSlot.audio) { oldSlot.audio.pause(); }
      if (oldSlot.url) { revokeUrl(oldSlot.url); oldSlot.url = null; oldSlot.loaded = false; }
      loadAndPlay(state.index, token);
    },
    seek(position) {
      if (destroyed) return;
      const audio = active().audio;
      if (!audio || !Number.isFinite(position)) return;
      const duration = Number.isFinite(audio.duration) ? audio.duration : position;
      audio.currentTime = Math.max(0, Math.min(position, duration));
      emitChange();
    },
    setRate(r) {
      if (destroyed) return;
      if (!RATES.includes(r)) return;
      state = reduce(state, { type: 'SET_RATE', rate: r });
      // apply to both
      slots.A.audio.playbackRate = r;
      slots.B.audio.playbackRate = r;
      emitChange();
    },
    setVolume(v) {
      if (destroyed) return;
      volume = Math.max(0, Math.min(1, v));
      slots.A.audio.volume = volume;
      slots.B.audio.volume = volume;
      emitChange();
    },
    notifyReady(index) {
      if (destroyed) return;
      // if buffering for that index, load
      const slot = active();
      if (bufferingFlag && state.index === index) {
        loadToken++;
        const token = loadToken;
        loadAndPlay(index, token);
        return;
      }
      // preload idle if index matches index+1
      const idl = idle();
      if (index === state.index + 1 && !idl.loaded) {
        loadToken++; // use same token? use current
        // use a token but don't bump? bump to be safe
        const token = loadToken;
        preload(index, token);
      }
    },
    getState() { return getState2(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      // pause both
      slots.A.audio.pause();
      slots.B.audio.pause();
      // revoke urls
      if (slots.A.url) { revokeUrl(slots.A.url); slots.A.url = null; }
      if (slots.B.url) { revokeUrl(slots.B.url); slots.B.url = null; }
      detach(slots.A.audio);
      detach(slots.B.audio);
    },
  };

  // fix play's reduce duplicate (already okay)
  return engine;
}
