import test from 'node:test';
import assert from 'node:assert/strict';
import { duckEnvelope, gainAtSample, DUCK_FRAME_MS, DEFAULT_DUCK } from '../src/mixDuck.js';

const RATE = 1000;
const FRAME = 10; // round(1000 * 10 / 1000)
const DUCK = Math.pow(10, -12 / 20); // 0.251188...

function tone(seconds, value) {
  return new Float32Array(Math.round(seconds * RATE)).fill(value);
}

function silence(seconds) {
  return new Float32Array(Math.round(seconds * RATE));
}

test('constants are the agreed numbers', () => {
  assert.equal(DUCK_FRAME_MS, 10);
  assert.deepEqual(DEFAULT_DUCK, { amountDb: -12, thresholdDb: -45, attackMs: 30, releaseMs: 300, holdMs: 150 });
});

test('empty voice gives zero frames and gainAtSample returns 1', () => {
  const env = duckEnvelope(new Float32Array(0), RATE);
  assert.equal(env.frames.length, 0);
  assert.equal(gainAtSample(env, 0), 1);
  assert.equal(gainAtSample(env, 12345), 1);
});

test('a silent voice gives all frames exactly 1', () => {
  const env = duckEnvelope(silence(1), RATE);
  assert.equal(env.frames.length, 100);
  for (const g of env.frames) assert.equal(g, 1);
});

test('amountDb 0 gives all frames 1 even for a loud voice', () => {
  const env = duckEnvelope(tone(1, 0.5), RATE, { amountDb: 0 });
  for (const g of env.frames) assert.equal(g, 1);
});

test('a loud constant 0.5 signal ducks toward 10^(-12/20) with a soft attack', () => {
  const env = duckEnvelope(tone(1, 0.5), RATE);
  assert.equal(env.frames.length, 100);
  const last = env.frames[env.frames.length - 1];
  assert.ok(Math.abs(last - DUCK) < 0.02, `last ${last} not within 0.02 of ${DUCK}`);
  const first = env.frames[0];
  assert.ok(first > DUCK && first < 1, `first ${first} not between target and 1`);
});

test('after the voice stops the gain recovers above 0.95 after five release times', () => {
  const releaseFrames = Math.ceil((5 * DEFAULT_DUCK.releaseMs) / FRAME);
  const voice = new Float32Array(1000 + releaseFrames * FRAME + FRAME);
  voice.fill(0.5, 0, 1000);
  const env = duckEnvelope(voice, RATE);
  const check = 100 + releaseFrames; // first silent frame is 100
  assert.ok(env.frames[check] > 0.95, `frame ${check} = ${env.frames[check]} not above 0.95`);
});

test('a pause shorter than holdMs does not let the gain recover', () => {
  const voice = new Float32Array(90 * FRAME);
  voice.fill(0.5, 0, 40 * FRAME);
  voice.fill(0.5, 45 * FRAME, 90 * FRAME); // 5-frame pause (50 ms) < 150 ms hold
  const env = duckEnvelope(voice, RATE);
  const before = env.frames[39];
  const after = env.frames[45];
  assert.ok(after <= before + 1e-6, `gain moved up: before ${before} after ${after}`);
});

test('a pause longer than hold + release does recover', () => {
  const voice = new Float32Array(300 * FRAME);
  voice.fill(0.5, 0, 40 * FRAME);
  // 200-frame silence (2 s) far exceeds hold (15) + release (~30)
  voice.fill(0.5, 240 * FRAME, 300 * FRAME);
  const env = duckEnvelope(voice, RATE);
  assert.ok(env.frames[239] > 0.95, `frame 239 = ${env.frames[239]} not above 0.95`);
});

test('frame count equals ceil(length / frameSize)', () => {
  const env = duckEnvelope(new Float32Array(1005), RATE);
  assert.equal(env.frameSize, FRAME);
  assert.equal(env.frames.length, Math.ceil(1005 / FRAME));
});

test('option clamping does not throw for attackMs 0 and amountDb +5', () => {
  const env = duckEnvelope(tone(1, 0.5), RATE, { attackMs: 0, amountDb: 5, releaseMs: 0, holdMs: -10 });
  assert.equal(env.frames.length, 100);
  for (const g of env.frames) assert.ok(g > 0 && g <= 1);
});

test('gainAtSample is exact at a frame centre and the midpoint between two centres', () => {
  const env = duckEnvelope(tone(1, 0.5), RATE);
  const k = 10;
  const centre = (k + 0.5) * FRAME;
  assert.ok(Math.abs(gainAtSample(env, centre) - env.frames[k]) < 1e-6);
  const mid = (k + 1) * FRAME;
  const avg = (env.frames[k] + env.frames[k + 1]) / 2;
  assert.ok(Math.abs(gainAtSample(env, mid) - avg) < 1e-6);
});

test('no function mutates its input', () => {
  const voice = tone(1, 0.5);
  const copy = voice.slice();
  duckEnvelope(voice, RATE, { amountDb: -6 });
  assert.deepEqual(Array.from(voice), Array.from(copy));
});