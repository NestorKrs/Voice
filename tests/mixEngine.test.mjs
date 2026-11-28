import test from 'node:test';
import assert from 'node:assert/strict';
import { createMixEngine } from '../src/mixEngine.js';
import { buildMixPlan } from '../src/mixPlan.js';

const RATE = 1000;
const VOICE_LEN = 10000; // 10 s
const MUSIC_LEN = 8000; // 8 s

function makeParam() {
  return {
    value: 0,
    events: [],
    setValueAtTime(v, t) {
      this.value = v;
      this.events.push({ type: 'set', v, t });
    },
    linearRampToValueAtTime(v, t) {
      this.value = v;
      this.events.push({ type: 'ramp', v, t });
    },
    setValueCurveAtTime(curve, t, d) {
      this.events.push({ type: 'curve', curve, t, d });
    },
    cancelScheduledValues(t) {
      this.events.push({ type: 'cancel', t });
    },
  };
}

function makeFakeContext() {
  const calls = { gains: [], buffers: [], sources: [], resumed: 0, closed: 0 };
  let currentTime = 0;
  const ctx = {
    state: 'running',
    destination: { id: 'destination' },
    outputLatency: 0,
    get currentTime() {
      return currentTime;
    },
    set currentTime(v) {
      currentTime = v;
    },
    resume() {
      calls.resumed += 1;
    },
    close() {
      calls.closed += 1;
    },
    createGain() {
      const node = { kind: 'gain', gain: makeParam(), connectedTo: null, connect(target) { node.connectedTo = target; } };
      calls.gains.push(node);
      return node;
    },
    createBuffer(channels, length, sampleRate) {
      const buf = {
        channels,
        length,
        sampleRate,
        copies: [],
        copyToChannel(array, index) {
          buf.copies.push({ index, length: array.length });
        },
      };
      calls.buffers.push(buf);
      return buf;
    },
    createBufferSource() {
      const src = {
        kind: 'source',
        buffer: null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        onended: null,
        connects: [],
        starts: [],
        stops: 0,
        connect(target) {
          src.connects.push(target);
        },
        start(...args) {
          src.starts.push(args);
        },
        stop() {
          src.stops += 1;
        },
      };
      calls.sources.push(src);
      return src;
    },
  };
  return { ctx, calls, setTime(v) { currentTime = v; } };
}

function planFor(params, extra = {}) {
  return buildMixPlan({
    voiceLength: VOICE_LEN,
    musicLength: MUSIC_LEN,
    rate: RATE,
    params,
    ...extra,
  });
}

function eventsOfType(node, type) {
  return node.gain.events.filter((e) => e.type === type);
}

test('load builds a mono voice buffer and a two-channel music buffer', () => {
  const { ctx, calls } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({
    voice: new Float32Array(VOICE_LEN),
    music: { channels: [new Float32Array(MUSIC_LEN), new Float32Array(MUSIC_LEN)] },
    rate: RATE,
  });
  assert.equal(calls.buffers.length, 2);
  assert.equal(calls.buffers[0].channels, 1);
  assert.equal(calls.buffers[0].length, VOICE_LEN);
  assert.equal(calls.buffers[1].channels, 2);
  assert.equal(calls.buffers[1].length, MUSIC_LEN);
  assert.equal(calls.buffers[1].copies.length, 2);
  assert.equal(engine.getState().hasMusic, true);
});

test('play starts the voice at 0 and the music with a delayed whenSec and offset 0', () => {
  const { ctx, calls } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({ voice: new Float32Array(VOICE_LEN), music: { channels: [new Float32Array(MUSIC_LEN)] }, rate: RATE });
  engine.setPlan(planFor({ musicStartSec: 3 }));
  engine.play();
  const voice = calls.sources[0];
  const music = calls.sources[1];
  assert.deepEqual(voice.starts[0], [0, 0]);
  assert.deepEqual(music.starts[0], [3, 0]);
});

test('play with a negative start offsets into the music', () => {
  const { ctx, calls } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({ voice: new Float32Array(VOICE_LEN), music: { channels: [new Float32Array(MUSIC_LEN)] }, rate: RATE });
  engine.setPlan(planFor({ musicStartSec: -2 }));
  engine.play();
  assert.deepEqual(calls.sources[1].starts[0], [0, 2]);
});

test('position advances with currentTime and stops at durationSec', () => {
  const { ctx, setTime } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({ voice: new Float32Array(VOICE_LEN), music: null, rate: RATE });
  engine.setPlan(planFor({}));
  engine.play();
  setTime(5);
  assert.equal(engine.getPosition(), 5);
  setTime(50);
  assert.equal(engine.getPosition(), 10);
});

test('pause freezes the position and stops both sources', () => {
  const { ctx, calls, setTime } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({ voice: new Float32Array(VOICE_LEN), music: { channels: [new Float32Array(MUSIC_LEN)] }, rate: RATE });
  engine.setPlan(planFor({}));
  engine.play();
  setTime(5);
  engine.pause();
  assert.equal(engine.getState().status, 'paused');
  assert.equal(engine.getPosition(), 5);
  assert.equal(calls.sources[0].stops, 1);
  assert.equal(calls.sources[1].stops, 1);
  setTime(8);
  assert.equal(engine.getPosition(), 5);
});

test('resuming starts both sources again at the paused position', () => {
  const { ctx, calls, setTime } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({ voice: new Float32Array(VOICE_LEN), music: { channels: [new Float32Array(MUSIC_LEN)] }, rate: RATE });
  engine.setPlan(planFor({}));
  engine.play();
  setTime(5);
  engine.pause();
  const before = calls.sources.length;
  engine.play();
  assert.equal(calls.sources.length, before + 2);
  assert.equal(engine.getState().status, 'playing');
  assert.deepEqual(calls.sources[before].starts[0], [5, 5]);
});

test('seek while playing restarts both sources at the new position', () => {
  const { ctx, calls } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({ voice: new Float32Array(VOICE_LEN), music: { channels: [new Float32Array(MUSIC_LEN)] }, rate: RATE });
  engine.setPlan(planFor({}));
  engine.play();
  const before = calls.sources.length;
  engine.seek(4);
  assert.equal(calls.sources.length, before + 2);
  assert.deepEqual(calls.sources[before].starts[0], [0, 4]);
  assert.equal(engine.getState().status, 'playing');
});

test('a looping music source has loop true and loopEnd equal to the music seconds', () => {
  const { ctx, calls } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({ voice: new Float32Array(VOICE_LEN), music: { channels: [new Float32Array(MUSIC_LEN)] }, rate: RATE });
  engine.setPlan(planFor({ loop: true }));
  engine.play();
  const music = calls.sources[1];
  assert.equal(music.loop, true);
  assert.equal(music.loopEnd, 8);
  assert.equal(music.loopStart, 0);
});

test('the fade list is applied with setValueAtTime then linearRampToValueAtTime in order', () => {
  const { ctx, calls } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({ voice: new Float32Array(VOICE_LEN), music: { channels: [new Float32Array(MUSIC_LEN)] }, rate: RATE });
  engine.setPlan(planFor({ fadeInSec: 2, fadeOutSec: 2 }));
  engine.play();
  const fadeNode = calls.gains[2];
  const events = fadeNode.gain.events.filter((e) => e.type !== 'cancel');
  assert.deepEqual(events.map((e) => e.type), ['set', 'ramp', 'ramp', 'ramp']);
  assert.deepEqual(events.map((e) => e.v), [0, 1, 1, 0]);
  assert.deepEqual(events.map((e) => e.t), [0, 2, 8, 10]);
});

test('the duck curve is applied with setValueCurveAtTime and the right duration', () => {
  const { ctx, calls } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({ voice: new Float32Array(VOICE_LEN), music: { channels: [new Float32Array(MUSIC_LEN)] }, rate: RATE });
  const duck = { frames: new Float32Array(1000).fill(0.5), frameSize: 10 };
  engine.setPlan(planFor({ duck: true }, { duck }));
  engine.play();
  const duckNode = calls.gains[3];
  const curves = eventsOfType(duckNode, 'curve');
  assert.equal(curves.length, 1);
  assert.equal(curves[0].curve.length, 1000);
  assert.equal(curves[0].d, 9.99);
});

test('a plan without duck sets the duck gain to 1', () => {
  const { ctx, calls } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({ voice: new Float32Array(VOICE_LEN), music: { channels: [new Float32Array(MUSIC_LEN)] }, rate: RATE });
  engine.setPlan(planFor({}));
  engine.play();
  const duckNode = calls.gains[3];
  const sets = eventsOfType(duckNode, 'set');
  assert.equal(sets[sets.length - 1].v, 1);
});

test('setPlan with only a gain change while playing creates no new source and sets the gains', () => {
  const { ctx, calls } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({ voice: new Float32Array(VOICE_LEN), music: { channels: [new Float32Array(MUSIC_LEN)] }, rate: RATE });
  engine.setPlan(planFor({}));
  engine.play();
  const countAfterPlay = calls.sources.length;
  const voiceGainNode = calls.gains[0];
  const musicGainNode = calls.gains[1];
  engine.setPlan(planFor({ voiceGain: 1.5, musicGain: 0.25 }));
  assert.equal(calls.sources.length, countAfterPlay);
  const voiceSets = eventsOfType(voiceGainNode, 'set');
  const musicSets = eventsOfType(musicGainNode, 'set');
  assert.equal(voiceSets[voiceSets.length - 1].v, 1.5);
  assert.equal(musicSets[musicSets.length - 1].v, 0.25);
});

test('setPlan with a changed offset while playing restarts only the music', () => {
  const { ctx, calls } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({ voice: new Float32Array(VOICE_LEN), music: { channels: [new Float32Array(MUSIC_LEN)] }, rate: RATE });
  engine.setPlan(planFor({}));
  engine.play();
  const voiceSource = calls.sources[0];
  const before = calls.sources.length;
  engine.setPlan(planFor({ musicStartSec: 2 }));
  assert.equal(calls.sources.length, before + 1);
  assert.equal(calls.sources[0], voiceSource);
  assert.equal(voiceSource.starts.length, 1);
});

test('natural end of the voice calls onEnd once and sets status idle', () => {
  const { ctx, calls } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({ voice: new Float32Array(VOICE_LEN), music: { channels: [new Float32Array(MUSIC_LEN)] }, rate: RATE });
  engine.setPlan(planFor({}));
  let ended = 0;
  engine.setOnEnd(() => { ended += 1; });
  engine.play();
  calls.sources[0].onended();
  assert.equal(ended, 1);
  assert.equal(engine.getState().status, 'idle');
  assert.equal(engine.getState().position, 10);
});

test('a stale source onended after a seek does nothing', () => {
  const { ctx, calls } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({ voice: new Float32Array(VOICE_LEN), music: { channels: [new Float32Array(MUSIC_LEN)] }, rate: RATE });
  engine.setPlan(planFor({}));
  let ended = 0;
  engine.setOnEnd(() => { ended += 1; });
  engine.play();
  const staleEnd = calls.sources[0].onended;
  engine.seek(4);
  staleEnd();
  assert.equal(ended, 0);
  assert.equal(engine.getState().status, 'playing');
});

test('play before load returns false', () => {
  const { ctx } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  assert.equal(engine.play(), false);
});

test('no music plays the voice only', () => {
  const { ctx, calls } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({ voice: new Float32Array(VOICE_LEN), music: null, rate: RATE });
  engine.setPlan(planFor({}));
  engine.play();
  assert.equal(calls.sources.length, 1);
  assert.equal(engine.getState().hasMusic, false);
});

test('close calls ctx.close and resets the state', () => {
  const { ctx, calls } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({ voice: new Float32Array(VOICE_LEN), music: null, rate: RATE });
  engine.close();
  assert.equal(calls.closed, 1);
  assert.equal(engine.getState().status, 'idle');
  assert.equal(engine.getState().durationSec, 0);
});

test('latency is subtracted from the position', () => {
  const { ctx, setTime } = makeFakeContext();
  ctx.outputLatency = 0.5;
  const engine = createMixEngine({ createContext: () => ctx });
  engine.load({ voice: new Float32Array(VOICE_LEN), music: null, rate: RATE });
  engine.setPlan(planFor({}));
  engine.play();
  setTime(5);
  assert.equal(engine.getPosition(), 4.5);
});

test('inputs are not modified', () => {
  const { ctx } = makeFakeContext();
  const engine = createMixEngine({ createContext: () => ctx });
  const voice = new Float32Array(VOICE_LEN).fill(0.1);
  const channel = new Float32Array(MUSIC_LEN).fill(0.2);
  const voiceCopy = voice.slice();
  const channelCopy = channel.slice();
  engine.load({ voice, music: { channels: [channel] }, rate: RATE });
  assert.deepEqual(Array.from(voice), Array.from(voiceCopy));
  assert.deepEqual(Array.from(channel), Array.from(channelCopy));
});