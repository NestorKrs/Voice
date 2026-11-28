// Live mix engine over an AudioContext-like object. One shared plan (src/mixPlan.js) drives the graph. No imports beyond the plan.

import { scheduleAt } from './mixPlan.js';

function stopSource(source) {
  if (!source) return;
  source.onended = null;
  source.stop();
}

function sameStructure(a, b) {
  return a.musicMode === b.musicMode
    && a.audibleStartSec === b.audibleStartSec
    && a.offsetIntoMusicSec === b.offsetIntoMusicSec
    && a.loop === b.loop
    && a.fadeIn.startSec === b.fadeIn.startSec
    && a.fadeIn.endSec === b.fadeIn.endSec
    && a.fadeOut.startSec === b.fadeOut.startSec
    && a.fadeOut.endSec === b.fadeOut.endSec
    && a.duck === b.duck;
}

export function createMixEngine({ createContext }) {
  let ctx = null;
  let voiceGain = null;
  let musicGain = null;
  let fadeNode = null;
  let duckNode = null;
  let master = null;

  let voiceBuffer = null;
  let musicBuffer = null;
  let rate = 0;
  let durationSec = 0;
  let musicSec = 0;

  let status = 'idle';
  let position = 0;
  let plan = null;

  let voiceSource = null;
  let musicSource = null;
  let startedAt = 0;
  let startPos = 0;
  let onEnd = null;

  function buildGraph() {
    voiceGain = ctx.createGain();
    musicGain = ctx.createGain();
    fadeNode = ctx.createGain();
    duckNode = ctx.createGain();
    master = ctx.createGain();
    master.gain.value = 1;
    voiceGain.connect(master);
    musicGain.connect(fadeNode);
    fadeNode.connect(duckNode);
    duckNode.connect(master);
    master.connect(ctx.destination);
  }

  function load({ voice, music, rate: sampleRate } = {}) {
    stopSource(voiceSource);
    voiceSource = null;
    stopSource(musicSource);
    musicSource = null;

    if (!ctx) ctx = createContext();
    buildGraph();

    const voiceArray = voice || new Float32Array(0);
    const voiceLength = voiceArray.length;
    voiceBuffer = ctx.createBuffer(1, voiceLength, sampleRate);
    if (voiceLength > 0) voiceBuffer.copyToChannel(voiceArray, 0);

    musicBuffer = null;
    musicSec = 0;
    if (music && music.channels && music.channels.length > 0) {
      const channels = music.channels.slice(0, 2);
      const musicLength = channels[0].length;
      musicBuffer = ctx.createBuffer(channels.length, musicLength, sampleRate);
      for (let index = 0; index < channels.length; index += 1) {
        musicBuffer.copyToChannel(channels[index], index);
      }
      musicSec = musicLength / sampleRate;
    }

    rate = sampleRate;
    durationSec = voiceLength / sampleRate;
    position = 0;
    status = 'idle';
    plan = null;
  }

  function setPlan(next) {
    const previous = plan;
    plan = next;
    if (!ctx || !voiceGain) return;

    const now = ctx.currentTime;
    voiceGain.gain.setValueAtTime(next.voiceGain, now);
    musicGain.gain.setValueAtTime(next.musicGain, now);

    if (status !== 'playing') return;
    if (previous && sameStructure(previous, next)) return;
    scheduleMusic(getPosition());
  }

  function startVoice(p) {
    stopSource(voiceSource);
    const source = ctx.createBufferSource();
    source.buffer = voiceBuffer;
    source.connect(voiceGain);
    const now = ctx.currentTime;
    startedAt = now;
    startPos = p;
    source.start(now, p);
    voiceSource = source;
    source.onended = () => {
      if (voiceSource !== source) return;
      stopSource(musicSource);
      musicSource = null;
      voiceSource = null;
      status = 'idle';
      position = durationSec;
      if (typeof onEnd === 'function') onEnd();
    };
  }

  function scheduleMusic(p) {
    stopSource(musicSource);
    musicSource = null;
    if (!ctx) return;

    const now = ctx.currentTime;
    fadeNode.gain.cancelScheduledValues(now);
    duckNode.gain.cancelScheduledValues(now);
    if (!plan) return;

    const sched = scheduleAt(plan, p);
    const fade = sched.fade;
    fadeNode.gain.setValueAtTime(fade[0].v, now + fade[0].t);
    for (let i = 1; i < fade.length; i += 1) {
      fadeNode.gain.linearRampToValueAtTime(fade[i].v, now + fade[i].t);
    }

    if (sched.duck) {
      duckNode.gain.setValueCurveAtTime(sched.duck.curve, now, sched.duck.durationSec);
    } else {
      duckNode.gain.setValueAtTime(1, now);
    }

    if (sched.music && musicBuffer) {
      const source = ctx.createBufferSource();
      source.buffer = musicBuffer;
      source.loop = sched.music.loop;
      source.loopStart = 0;
      source.loopEnd = musicSec;
      source.connect(musicGain);
      source.start(now + sched.music.whenSec, sched.music.offsetSec);
      musicSource = source;
    }
  }

  function play() {
    if (!voiceBuffer || durationSec <= 0) return false;
    if (ctx.state === 'suspended') ctx.resume();

    let p = position;
    if (p >= durationSec) p = 0;
    startVoice(p);
    status = 'playing';
    scheduleMusic(p);
    return true;
  }

  function pause() {
    if (status !== 'playing') return;
    position = getPosition();
    stopSource(voiceSource);
    voiceSource = null;
    stopSource(musicSource);
    musicSource = null;
    const now = ctx.currentTime;
    fadeNode.gain.cancelScheduledValues(now);
    duckNode.gain.cancelScheduledValues(now);
    status = 'paused';
  }

  function seek(sec) {
    const at = Math.min(durationSec, Math.max(0, sec));
    if (status === 'playing') {
      startVoice(at);
      scheduleMusic(at);
      return;
    }
    position = at;
  }

  function getPosition() {
    if (status !== 'playing') return position;
    const latency = Number.isFinite(ctx.outputLatency) && ctx.outputLatency >= 0
      ? ctx.outputLatency
      : 0;
    return Math.min(durationSec, Math.max(startPos, startPos + (ctx.currentTime - startedAt - latency)));
  }

  function getState() {
    return { status, position: getPosition(), durationSec, hasMusic: Boolean(musicBuffer) };
  }

  function setOnEnd(fn) {
    onEnd = fn;
  }

  function close() {
    stopSource(voiceSource);
    voiceSource = null;
    stopSource(musicSource);
    musicSource = null;
    if (ctx) ctx.close();
    ctx = null;
    voiceGain = null;
    musicGain = null;
    fadeNode = null;
    duckNode = null;
    master = null;
    voiceBuffer = null;
    musicBuffer = null;
    rate = 0;
    durationSec = 0;
    musicSec = 0;
    status = 'idle';
    position = 0;
    plan = null;
    startedAt = 0;
    startPos = 0;
    onEnd = null;
  }

  return { load, setPlan, play, pause, seek, getPosition, getState, setOnEnd, close };
}