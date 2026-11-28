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
  let rangeStart = null;
  let rangeEnd = null;
  let looping = false;
  let volume = 1;
  let speed = 1;
  let master = null;

  function stopCurrent() {
    if (!currentSource) return;
    const source = currentSource;
    currentSource = null;
    source.onended = null;
    source.stop();
  }

  function begin(start, end, loop) {
    if (ctx.state === 'suspended') ctx.resume();
    stopCurrent();

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = speed;
    source.connect(master);
    source.loop = loop;
    if (loop) {
      source.loopStart = start / rate;
      source.loopEnd = end / rate;
      source.start(0, start / rate);
    } else {
      source.start(0, start / rate, (end - start) / rate);
    }
    currentSource = source;
    startedAt = ctx.currentTime;
    startSample = start;
    endSample = end;
    status = 'playing';
    source.onended = () => {
      if (currentSource !== source) return;
      if (looping) return;
      currentSource = null;
      status = 'idle';
      position = endSample;
      rangeStart = null;
      rangeEnd = null;
      if (typeof onEnd === 'function') onEnd();
    };
  }

  function getPosition() {
    if (status !== 'playing') return position;
    const latency = Number.isFinite(ctx.outputLatency) && ctx.outputLatency >= 0
      ? ctx.outputLatency
      : 0;
    const e = Math.max(0, Math.round((ctx.currentTime - startedAt - latency) * rate * speed));
    if (looping) {
      const offset = startSample - rangeStart;
      return rangeStart + ((offset + e) % (rangeEnd - rangeStart));
    }
    return Math.min(endSample, Math.max(startSample, startSample + e));
  }

  function play(from, to, opts = {}) {
    if (!buffer || total === 0) return false;
    const at = getPosition();
    const resumeLoop = from === undefined && to === undefined && status === 'paused' && looping && rangeStart !== null;
    const start = clampSample(from === undefined ? (resumeLoop ? at : (at >= total ? 0 : at)) : from, total);
    const end = clampSample(to === undefined ? (resumeLoop ? rangeEnd : total) : to, total);
    if (end <= start) return false;

    if (resumeLoop || (opts && opts.loop)) {
      if (!resumeLoop) {
        rangeStart = start;
        rangeEnd = end;
      }
      looping = true;
    } else {
      looping = false;
      if (from === undefined && to === undefined) {
        rangeStart = null;
        rangeEnd = null;
      } else {
        rangeStart = start;
        rangeEnd = end;
      }
    }
    begin(start, end, looping);
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
    const insideRange = looping && rangeStart !== null && at >= rangeStart && at < rangeEnd;
    if (status === 'playing') {
      if (insideRange) {
        begin(at, rangeEnd, true);
        return;
      }
      if (looping) {
        looping = false;
        rangeStart = null;
        rangeEnd = null;
        begin(at, total, false);
        return;
      }
      if (endSample > at) begin(at, endSample, false);
      return;
    }
    if (!insideRange && looping) {
      looping = false;
      rangeStart = null;
      rangeEnd = null;
    }
    position = at;
  }

  function setLoop(on) {
    if (rangeStart === null || rangeEnd === null) return;
    const next = Boolean(on);
    if (status !== 'playing') {
      looping = next;
      return;
    }
    const from = getPosition();
    looping = next;
    begin(from, rangeEnd, looping);
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.value = volume;
  }

  function setRate(r) {
    const next = r > 0 ? r : 1;
    if (next === speed) return;
    const wasPlaying = status === 'playing';
    const from = wasPlaying ? getPosition() : position;
    speed = next;
    if (!wasPlaying) return;
    if (rangeStart !== null && rangeEnd !== null) begin(from, rangeEnd, looping);
    else begin(from, total, false);
  }

  function getState() {
    return { status, position: getPosition(), total, rate, looping, rangeStart, rangeEnd };
  }

  function setOnEnd(fn) {
    onEnd = fn;
  }

  function close() {
    stopCurrent();
    if (ctx) ctx.close();
    ctx = null;
    buffer = null;
    master = null;
    total = 0;
    rate = 0;
    status = 'idle';
    position = 0;
    startedAt = 0;
    startSample = 0;
    endSample = 0;
    rangeStart = null;
    rangeEnd = null;
    looping = false;
  }

  function load(audio, sampleRate) {
    stopCurrent();
    if (!ctx) ctx = createContext();
    const channels = Array.isArray(audio) ? audio.slice(0, 2) : [audio];
    const length = channels.length > 0 ? channels[0].length : 0;
    buffer = ctx.createBuffer(Math.max(1, channels.length), length, sampleRate);
    for (let index = 0; index < channels.length; index += 1) {
      buffer.copyToChannel(channels[index], index);
    }
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    total = length;
    rate = sampleRate;
    position = 0;
    status = 'idle';
    startedAt = 0;
    startSample = 0;
    endSample = 0;
    rangeStart = null;
    rangeEnd = null;
    looping = false;
  }

  return { load, play, pause, seek, getPosition, getState, setOnEnd, setLoop, setVolume, setRate, close };
}
