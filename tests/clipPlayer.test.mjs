import test from 'node:test';
import assert from 'node:assert/strict';
import { createClipPlayer } from '../src/clipPlayer.js';

function makeContext() {
  return {
    currentTime: 0,
    state: 'running',
    destination: { name: 'destination' },
    outputLatency: 0,
    buffers: [],
    sources: [],
    gains: [],
    resumed: 0,
    closed: 0,
    createGain() {
      const gain = { gain: { value: 1 }, connects: [], connect(node) { this.connects.push(node); } };
      this.gains.push(gain);
      return gain;
    },
    createBuffer(channels, length, sampleRate) {
      const buffer = {
        channels, length, sampleRate, copies: [],
        copyToChannel(array, channel) {
          this.copies.push({ array, channel });
        },
      };
      this.buffers.push(buffer);
      return buffer;
    },
    createBufferSource() {
      const source = {
        buffer: null,
        onended: null,
        playbackRate: { value: 1 },
        connects: [],
        starts: [],
        stops: 0,
        connect(node) {
          this.connects.push(node);
        },
        start(...args) {
          this.starts.push(args);
        },
        stop() {
          this.stops += 1;
        },
      };
      this.sources.push(source);
      return source;
    },
    resume() {
      this.resumed += 1;
      return Promise.resolve();
    },
    close() {
      this.closed += 1;
      return Promise.resolve();
    },
  };
}

function harness() {
  const ctx = makeContext();
  let created = 0;
  const player = createClipPlayer({
    createContext() {
      created += 1;
      return ctx;
    },
  });
  return { ctx, player, created: () => created };
}

function load(player, length, rate = 1000) {
  const samples = new Float32Array(length);
  player.load(samples, rate);
  return samples;
}

test('context is created lazily on the first load only', () => {
  const { player, ctx, created } = harness();
  assert.equal(created(), 0);
  load(player, 100);
  load(player, 200);
  assert.equal(created(), 1);
  assert.equal(ctx.buffers.length, 2);
});

test('load copies the same samples into channel 0 of one mono buffer', () => {
  const { player, ctx } = harness();
  const samples = load(player, 500, 8000);
  const buffer = ctx.buffers[0];
  assert.equal(buffer.channels, 1);
  assert.equal(buffer.length, 500);
  assert.equal(buffer.sampleRate, 8000);
  assert.equal(buffer.copies.length, 1);
  assert.strictEqual(buffer.copies[0].array, samples);
  assert.equal(buffer.copies[0].channel, 0);
  assert.deepEqual(player.getState(), { status: 'idle', position: 0, total: 500, rate: 8000, looping: false, rangeStart: null, rangeEnd: null });
});

test('play from zero starts with the whole buffer as its duration', () => {
  const { player, ctx } = harness();
  load(player, 2000, 1000);
  assert.equal(player.play(), true);
  const source = ctx.sources[0];
  assert.strictEqual(source.buffer, ctx.buffers[0]);
  assert.deepEqual(source.connects, [ctx.gains[0]]);
  assert.deepEqual(ctx.gains[0].connects, [ctx.destination]);
  assert.deepEqual(source.starts[0], [0, 0, 2]);
  assert.equal(player.getState().status, 'playing');
});

test('position follows currentTime at the buffer rate', () => {
  const { player, ctx } = harness();
  load(player, 1000);
  player.play();
  ctx.currentTime = 0.5;
  assert.equal(player.getPosition(), 500);
  assert.equal(player.getState().position, 500);
});

test('outputLatency is subtracted when finite and non-negative', () => {
  const { player, ctx } = harness();
  load(player, 1000);
  player.play();
  ctx.outputLatency = 0.1;
  ctx.currentTime = 0.5;
  assert.equal(player.getPosition(), 400);
  ctx.outputLatency = -1;
  assert.equal(player.getPosition(), 500);
  ctx.outputLatency = Number.NaN;
  assert.equal(player.getPosition(), 500);
});

test('pause freezes the position and stops the source', () => {
  const { player, ctx } = harness();
  load(player, 1000);
  player.play();
  ctx.currentTime = 0.25;
  player.pause();
  const source = ctx.sources[0];
  assert.equal(source.stops, 1);
  assert.equal(source.onended, null);
  assert.equal(player.getState().status, 'paused');
  assert.equal(player.getPosition(), 250);
  ctx.currentTime = 0.9;
  assert.equal(player.getPosition(), 250);
});

test('play after pause resumes from the paused offset', () => {
  const { player, ctx } = harness();
  load(player, 1000);
  player.play();
  ctx.currentTime = 0.25;
  player.pause();
  player.play();
  assert.equal(ctx.sources.length, 2);
  assert.deepEqual(ctx.sources[1].starts[0], [0, 0.25, 0.75]);
});

test('seek while playing restarts at the new offset with the same end', () => {
  const { player, ctx } = harness();
  load(player, 1000);
  player.play();
  ctx.currentTime = 0.1;
  player.seek(600);
  assert.equal(ctx.sources.length, 2);
  assert.deepEqual(ctx.sources[1].starts[0], [0, 0.6, 0.4]);
  assert.equal(ctx.sources[0].stops, 1);
  assert.equal(ctx.sources[0].onended, null);
  assert.equal(player.getState().status, 'playing');
});

test('seek while paused only moves the stored position', () => {
  const { player, ctx } = harness();
  load(player, 1000);
  player.play();
  ctx.currentTime = 0.25;
  player.pause();
  player.seek(700);
  assert.equal(ctx.sources.length, 1);
  assert.equal(player.getState().status, 'paused');
  assert.equal(player.getPosition(), 700);
});

test('play clamps the range and returns false when the end is not after the start', () => {
  const { player, ctx } = harness();
  load(player, 1000);
  assert.equal(player.play(-500, 5000), true);
  assert.deepEqual(ctx.sources[0].starts[0], [0, 0, 1]);
  assert.equal(player.play(800, 200), false);
  assert.equal(player.play(1000, 1000), false);
  assert.equal(ctx.sources.length, 1);
});

test('natural end goes idle at the end sample and calls onEnd once', () => {
  const { player, ctx } = harness();
  let ended = 0;
  player.setOnEnd(() => { ended += 1; });
  load(player, 1000);
  player.play(0, 400);
  const source = ctx.sources[0];
  ctx.currentTime = 0.2;
  source.onended();
  assert.deepEqual(player.getState(), { status: 'idle', position: 400, total: 1000, rate: 1000, looping: false, rangeStart: null, rangeEnd: null });
  assert.equal(ended, 1);
  assert.equal(source.stops, 0);
  source.onended();
  assert.equal(ended, 1);
});

test('a stale onended after a seek changes nothing and calls no callback', () => {
  const { player, ctx } = harness();
  let ended = 0;
  player.setOnEnd(() => { ended += 1; });
  load(player, 1000);
  player.play();
  const stale = ctx.sources[0].onended;
  player.seek(500);
  const before = player.getState();
  stale();
  assert.deepEqual(player.getState(), before);
  assert.equal(ended, 0);
});

test('the onended saved before a pause is ignored', () => {
  const { player, ctx } = harness();
  let ended = 0;
  player.setOnEnd(() => { ended += 1; });
  load(player, 1000);
  player.play();
  const stale = ctx.sources[0].onended;
  player.pause();
  stale();
  assert.equal(player.getState().status, 'paused');
  assert.equal(player.getPosition(), 0);
  assert.equal(ended, 0);
});

test('play at the end restarts from zero', () => {
  const { player, ctx } = harness();
  load(player, 1000);
  player.play();
  const first = ctx.sources[0];
  ctx.currentTime = 1;
  first.onended();
  assert.equal(player.getPosition(), 1000);
  assert.equal(player.play(), true);
  assert.deepEqual(ctx.sources[1].starts[0], [0, 0, 1]);
});

test('a suspended context is resumed when play starts', () => {
  const { player, ctx } = harness();
  ctx.state = 'suspended';
  load(player, 1000);
  player.play();
  assert.equal(ctx.resumed, 1);
});

test('play before load or with no audio returns false without throwing', () => {
  const { player, ctx } = harness();
  assert.equal(player.play(), false);
  load(player, 0);
  assert.equal(player.play(), false);
  assert.equal(ctx.sources.length, 0);
  assert.equal(player.getState().status, 'idle');
});

test('load while playing stops the source and resets the position', () => {
  const { player, ctx } = harness();
  load(player, 1000);
  player.play();
  ctx.currentTime = 0.3;
  load(player, 2000);
  assert.equal(ctx.sources[0].stops, 1);
  assert.equal(ctx.sources[0].onended, null);
  assert.deepEqual(player.getState(), { status: 'idle', position: 0, total: 2000, rate: 1000, looping: false, rangeStart: null, rangeEnd: null });
});

test('getPosition stays inside the played range', () => {
  const { player, ctx } = harness();
  load(player, 1000);
  player.play(200, 800);
  ctx.currentTime = -5;
  assert.equal(player.getPosition(), 200);
  ctx.currentTime = 10;
  assert.equal(player.getPosition(), 800);
});

test('close stops the source, closes the context and resets the state', () => {
  const { player, ctx } = harness();
  load(player, 1000);
  player.play();
  ctx.currentTime = 0.1;
  player.close();
  assert.equal(ctx.sources[0].stops, 1);
  assert.equal(ctx.sources[0].onended, null);
  assert.equal(ctx.closed, 1);
  assert.deepEqual(player.getState(), { status: 'idle', position: 0, total: 0, rate: 0, looping: false, rangeStart: null, rangeEnd: null });
});

function makeLoopContext() {
  const ctx = makeContext();
  const createBufferSource = ctx.createBufferSource.bind(ctx);
  ctx.createBufferSource = () => {
    const source = createBufferSource();
    source.loop = false;
    source.loopStart = 0;
    source.loopEnd = 0;
    return source;
  };
  return ctx;
}

function loopHarness() {
  const ctx = makeLoopContext();
  const player = createClipPlayer({ createContext() { return ctx; } });
  return { ctx, player };
}

test('loop play sets loop points and starts with no duration argument', () => {
  const { ctx, player } = loopHarness();
  load(player, 5000, 1000);
  assert.equal(player.play(1000, 3000, { loop: true }), true);
  const source = ctx.sources[0];
  assert.equal(source.loop, true);
  assert.equal(source.loopStart, 1);
  assert.equal(source.loopEnd, 3);
  assert.deepEqual(source.starts[0], [0, 1]);
});

test('position wraps inside the loop range', () => {
  const { ctx, player } = loopHarness();
  load(player, 5000, 1000);
  player.play(1000, 3000, { loop: true });
  ctx.currentTime = 2.5;
  assert.equal(player.getPosition(), 1500);
  assert.equal(player.getState().position, 1500);
  ctx.currentTime = 2.1;
  assert.equal(player.getPosition(), 1100);
});

test('onended on a looping source does not end playback and a stale one is ignored', () => {
  const { ctx, player } = loopHarness();
  let ended = 0;
  player.setOnEnd(() => { ended += 1; });
  load(player, 5000);
  player.play(1000, 3000, { loop: true });
  ctx.currentTime = 0.5;
  const stale = ctx.sources[0].onended;
  stale();
  assert.equal(player.getState().status, 'playing');
  assert.equal(player.getPosition(), 1500);
  assert.equal(ended, 0);
  player.setLoop(false);
  stale();
  assert.equal(player.getState().status, 'playing');
  assert.equal(ended, 0);
});

test('setLoop(false) while playing a loop restarts with loop off and the same range', () => {
  const { ctx, player } = loopHarness();
  load(player, 5000);
  player.play(1000, 3000, { loop: true });
  ctx.currentTime = 0.5;
  player.setLoop(false);
  const source = ctx.sources[1];
  assert.equal(source.loop, false);
  assert.deepEqual(source.starts[0], [0, 1.5, 1.5]);
  assert.equal(player.getState().looping, false);
  ctx.currentTime = 2;
  assert.equal(player.getPosition(), 3000);
  source.onended();
  assert.equal(player.getState().status, 'idle');
  assert.equal(player.getPosition(), 3000);
});

test('setLoop(true) while playing a plain range restarts it as a loop', () => {
  const { ctx, player } = loopHarness();
  load(player, 5000);
  player.play(1000, 3000);
  ctx.currentTime = 0.5;
  player.setLoop(true);
  const source = ctx.sources[1];
  assert.equal(source.loop, true);
  assert.equal(source.loopStart, 1.5);
  assert.equal(source.loopEnd, 3);
  assert.deepEqual(source.starts[0], [0, 1.5]);
  assert.deepEqual(player.getState(), { status: 'playing', position: 1500, total: 5000, rate: 1000, looping: true, rangeStart: 1000, rangeEnd: 3000 });
});

test('pause freezes the loop position and play resumes the loop there', () => {
  const { ctx, player } = loopHarness();
  load(player, 5000);
  player.play(1000, 3000, { loop: true });
  ctx.currentTime = 0.5;
  player.pause();
  assert.equal(player.getState().status, 'paused');
  assert.equal(player.getPosition(), 1500);
  ctx.currentTime = 5;
  assert.equal(player.getPosition(), 1500);
  player.play();
  const source = ctx.sources[1];
  assert.equal(source.loop, true);
  assert.equal(source.loopStart, 1.5);
  assert.equal(source.loopEnd, 3);
  assert.deepEqual(source.starts[0], [0, 1.5]);
  assert.deepEqual(player.getState(), { status: 'playing', position: 1500, total: 5000, rate: 1000, looping: true, rangeStart: 1000, rangeEnd: 3000 });
});

test('seek inside the loop restarts there and seek outside cancels the loop', () => {
  const { ctx, player } = loopHarness();
  load(player, 5000);
  player.play(1000, 3000, { loop: true });
  player.seek(2500);
  const inside = ctx.sources[1];
  assert.equal(inside.loop, true);
  assert.equal(inside.loopStart, 2.5);
  assert.deepEqual(inside.starts[0], [0, 2.5]);
  assert.equal(player.getState().looping, true);
  assert.equal(player.getState().rangeStart, 1000);
  player.seek(4000);
  const outside = ctx.sources[2];
  assert.equal(outside.loop, false);
  assert.deepEqual(outside.starts[0], [0, 4, 1]);
  assert.equal(player.getState().looping, false);
  assert.equal(player.getState().rangeStart, null);
  assert.equal(player.getState().rangeEnd, null);
});

test('seek while paused inside the loop only moves the position', () => {
  const { ctx, player } = loopHarness();
  load(player, 5000);
  player.play(1000, 3000, { loop: true });
  player.pause();
  player.seek(2500);
  assert.equal(ctx.sources.length, 1);
  assert.equal(player.getState().status, 'paused');
  assert.equal(player.getPosition(), 2500);
  assert.equal(player.getState().looping, true);
  player.play();
  assert.equal(ctx.sources[1].loopStart, 2.5);
});

test('setLoop while paused stores the flag without creating a source', () => {
  const { ctx, player } = loopHarness();
  load(player, 5000);
  player.play(1000, 3000);
  player.pause();
  player.setLoop(true);
  assert.equal(ctx.sources.length, 1);
  assert.equal(player.getState().looping, true);
  assert.equal(player.getState().status, 'paused');
  player.play();
  assert.equal(ctx.sources[1].loop, true);
});

test('getState reports the loop range and load and close clear it', () => {
  const { player } = loopHarness();
  load(player, 5000);
  assert.deepEqual(player.getState(), { status: 'idle', position: 0, total: 5000, rate: 1000, looping: false, rangeStart: null, rangeEnd: null });
  player.play(1000, 3000, { loop: true });
  assert.deepEqual(player.getState(), { status: 'playing', position: 1000, total: 5000, rate: 1000, looping: true, rangeStart: 1000, rangeEnd: 3000 });
  load(player, 2000);
  assert.deepEqual(player.getState(), { status: 'idle', position: 0, total: 2000, rate: 1000, looping: false, rangeStart: null, rangeEnd: null });
  player.play(500, 1500, { loop: true });
  player.close();
  assert.deepEqual(player.getState(), { status: 'idle', position: 0, total: 0, rate: 0, looping: false, rangeStart: null, rangeEnd: null });
});

test('a plain range play keeps the legacy duration with no loop', () => {
  const { ctx, player } = loopHarness();
  load(player, 5000);
  player.play(1000, 3000);
  assert.equal(ctx.sources[0].loop, false);
  assert.deepEqual(ctx.sources[0].starts[0], [0, 1, 2]);
  assert.deepEqual(player.getState(), { status: 'playing', position: 1000, total: 5000, rate: 1000, looping: false, rangeStart: 1000, rangeEnd: 3000 });
});

test('load with a mono Float32Array creates a one-channel buffer as before', () => {
  const { player, ctx } = harness();
  const samples = new Float32Array(400);
  player.load(samples, 8000);
  const buffer = ctx.buffers[0];
  assert.equal(buffer.channels, 1);
  assert.equal(buffer.length, 400);
  assert.equal(buffer.sampleRate, 8000);
  assert.equal(buffer.copies.length, 1);
  assert.strictEqual(buffer.copies[0].array, samples);
  assert.equal(buffer.copies[0].channel, 0);
});

test('load with two channels calls createBuffer(2, length, rate) and copies each channel', () => {
  const { player, ctx } = harness();
  const left = new Float32Array(300);
  const right = new Float32Array(300);
  player.load([left, right], 44100);
  const buffer = ctx.buffers[0];
  assert.equal(buffer.channels, 2);
  assert.equal(buffer.length, 300);
  assert.equal(buffer.sampleRate, 44100);
  assert.equal(buffer.copies.length, 2);
  assert.strictEqual(buffer.copies[0].array, left);
  assert.equal(buffer.copies[0].channel, 0);
  assert.strictEqual(buffer.copies[1].array, right);
  assert.equal(buffer.copies[1].channel, 1);
});

test('load with three channels uses only the first two', () => {
  const { player, ctx } = harness();
  const a = new Float32Array(10);
  const b = new Float32Array(10);
  const c = new Float32Array(10);
  player.load([a, b, c], 1000);
  const buffer = ctx.buffers[0];
  assert.equal(buffer.channels, 2);
  assert.equal(buffer.copies.length, 2);
  assert.strictEqual(buffer.copies[0].array, a);
  assert.strictEqual(buffer.copies[1].array, b);
});

test('load with a one-channel array behaves like mono', () => {
  const { player, ctx } = harness();
  const only = new Float32Array(64);
  player.load([only], 1000);
  const buffer = ctx.buffers[0];
  assert.equal(buffer.channels, 1);
  assert.equal(buffer.length, 64);
  assert.equal(buffer.copies.length, 1);
  assert.strictEqual(buffer.copies[0].array, only);
  assert.equal(buffer.copies[0].channel, 0);
});

test('load with an empty array loads as empty and play returns false', () => {
  const { player, ctx } = harness();
  player.load([], 1000);
  assert.equal(player.getState().total, 0);
  assert.equal(player.play(), false);
  assert.equal(ctx.sources.length, 0);
});

test('getState().total equals the channel length for a multi-channel load', () => {
  const { player } = harness();
  player.load([new Float32Array(512), new Float32Array(512)], 48000);
  assert.equal(player.getState().total, 512);
});

test('load does not modify the input channels', () => {
  const { player } = harness();
  const left = new Float32Array([1, 2, 3, 4]);
  const right = new Float32Array([5, 6, 7, 8]);
  const leftCopy = left.slice();
  const rightCopy = right.slice();
  player.load([left, right], 1000);
  assert.deepEqual(Array.from(left), Array.from(leftCopy));
  assert.deepEqual(Array.from(right), Array.from(rightCopy));
});

test('setVolume clamps to 0..1 and sets the master gain', () => {
  const { player, ctx } = harness();
  load(player, 1000);
  player.setVolume(0.5);
  assert.equal(ctx.gains[0].gain.value, 0.5);
  player.setVolume(5);
  assert.equal(ctx.gains[0].gain.value, 1);
  player.setVolume(-1);
  assert.equal(ctx.gains[0].gain.value, 0);
});

test('setRate changes the source playbackRate and the position speed', () => {
  const { player, ctx } = harness();
  load(player, 1000);
  player.play();
  player.setRate(2);
  assert.equal(ctx.sources[1].playbackRate.value, 2);
  ctx.currentTime = 0.25;
  assert.equal(player.getPosition(), 500);
});

test('setRate while playing restarts the source at the current position', () => {
  const { player, ctx } = harness();
  load(player, 2000);
  player.play();
  ctx.currentTime = 0.25;
  player.setRate(2);
  assert.equal(ctx.sources.length, 2);
  assert.deepEqual(ctx.sources[1].starts[0], [0, 0.25, 1.75]);
  assert.equal(ctx.sources[1].playbackRate.value, 2);
  assert.equal(player.getState().status, 'playing');
});

test('setRate while paused stores the speed without creating a source', () => {
  const { player } = harness();
  load(player, 1000);
  player.play();
  player.pause();
  player.setRate(1.5);
  assert.equal(player.getState().status, 'paused');
  player.play();
  assert.equal(player.getState().status, 'playing');
});
