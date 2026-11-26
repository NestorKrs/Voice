// Buffer-backed playback over an AudioContext-like object. No imports, no DOM.

function clampSample(value, total) {
  return Math.min(Math.max(value, 0), total);
}

export function createClipPlayer({ createContext }) {
  let ctx = null;
  let buffer = null;
  let total = 0;
  let rate = 0;
  let status = 'idle';
  let position = 0;
  let currentSource = null;
  let startedAt = 0;
  let startSample = 0;
  let endSample = 0;
  let onEnd = null;

  function stopCurrent() {
    if (!currentSource) return;
    const source = currentSource;
    currentSource = null;
    source.onended = null;
    source.stop();
  }

  function getPosition() {
    if (status !== 'playing') return position;
    const latency = Number.isFinite(ctx.outputLatency) && ctx.outputLatency >= 0
      ? ctx.outputLatency
      : 0;
    const elapsed = Math.round((ctx.currentTime - startedAt - latency) * rate);
    return Math.min(endSample, Math.max(startSample, startSample + elapsed));
  }

  function play(from, to) {
    if (!buffer || total === 0) return false;
    const at = getPosition();
    const start = clampSample(from === undefined ? (at >= total ? 0 : at) : from, total);
    const end = clampSample(to === undefined ? total : to, total);
    if (end <= start) return false;

    if (ctx.state === 'suspended') ctx.resume();
    stopCurrent();

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0, start / rate, (end - start) / rate);
    currentSource = source;
    startedAt = ctx.currentTime;
    startSample = start;
    endSample = end;
    status = 'playing';
    source.onended = () => {
      if (currentSource !== source) return;
      currentSource = null;
      status = 'idle';
      position = endSample;
      if (typeof onEnd === 'function') onEnd();
    };
    return true;
  }

  function pause() {
    if (status !== 'playing') return;
    position = getPosition();
    stopCurrent();
    status = 'paused';
  }

  function seek(sample) {
    const at = clampSample(sample, total);
    if (status === 'playing') {
      play(at, endSample);
      return;
    }
    position = at;
  }

  function getState() {
    return { status, position: getPosition(), total, rate };
  }

  function setOnEnd(fn) {
    onEnd = fn;
  }

  function close() {
    stopCurrent();
    if (ctx) ctx.close();
    ctx = null;
    buffer = null;
    total = 0;
    rate = 0;
    status = 'idle';
    position = 0;
    startedAt = 0;
    startSample = 0;
    endSample = 0;
  }

  function load(samples, sampleRate) {
    stopCurrent();
    if (!ctx) ctx = createContext();
    buffer = ctx.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);
    total = samples.length;
    rate = sampleRate;
    position = 0;
    status = 'idle';
    startedAt = 0;
    startSample = 0;
    endSample = 0;
  }

  return { load, play, pause, seek, getPosition, getState, setOnEnd, close };
}
