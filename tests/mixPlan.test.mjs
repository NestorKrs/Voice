import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MIX_VOICE_SECONDS,
  DEFAULT_PARAMS,
  normalizeParams,
  clampStartSec,
  parseOffsetTime,
  buildMixPlan,
  fadeValueAt,
  scheduleAt,
  peakBound,
} from '../src/mixPlan.js';

const RATE = 1000;

function duckEnv(frameCount, frameSize = 10) {
  return { frames: new Float32Array(frameCount).fill(0.5), frameSize };
}

test('constants are the agreed numbers', () => {
  assert.equal(MAX_MIX_VOICE_SECONDS, 600);
  assert.deepEqual(DEFAULT_PARAMS, {
    voiceGain: 1,
    musicGain: 0.5,
    musicStartSec: 0,
    loop: false,
    fadeInSec: 0,
    fadeOutSec: 0,
    duck: false,
  });
});

test('normalizeParams fills defaults for an empty object', () => {
  assert.deepEqual(normalizeParams({}), DEFAULT_PARAMS);
  assert.deepEqual(normalizeParams(), DEFAULT_PARAMS);
});

test('normalizeParams clamps gains to 0..2 and fades to 0..30', () => {
  const p = normalizeParams({ voiceGain: 5, musicGain: -1, fadeInSec: 100, fadeOutSec: -4 });
  assert.equal(p.voiceGain, 2);
  assert.equal(p.musicGain, 0);
  assert.equal(p.fadeInSec, 30);
  assert.equal(p.fadeOutSec, 0);
});

test('normalizeParams rounds musicStartSec to whole milliseconds', () => {
  assert.equal(normalizeParams({ musicStartSec: 1.23456 }).musicStartSec, 1.235);
  assert.equal(normalizeParams({ musicStartSec: 1.2344 }).musicStartSec, 1.234);
});

test('normalizeParams falls back to defaults for non-finite numbers', () => {
  const p = normalizeParams({ voiceGain: NaN, musicGain: Infinity, musicStartSec: -Infinity, fadeInSec: NaN });
  assert.equal(p.voiceGain, DEFAULT_PARAMS.voiceGain);
  assert.equal(p.musicGain, DEFAULT_PARAMS.musicGain);
  assert.equal(p.musicStartSec, DEFAULT_PARAMS.musicStartSec);
  assert.equal(p.fadeInSec, DEFAULT_PARAMS.fadeInSec);
});

test('normalizeParams coerces loop and duck to booleans and drops unknown fields', () => {
  const p = normalizeParams({ loop: 1, duck: 0, foo: 'bar' });
  assert.equal(p.loop, true);
  assert.equal(p.duck, false);
  assert.equal('foo' in p, false);
});

test('normalizeParams does not mutate its input', () => {
  const input = { voiceGain: 5, musicStartSec: 1.23456, loop: 1 };
  const copy = { ...input };
  normalizeParams(input);
  assert.deepEqual(input, copy);
});

test('clampStartSec clamps to [-musicSec, durationSec]', () => {
  assert.equal(clampStartSec(5, 10, 8), 5);
  assert.equal(clampStartSec(-3, 10, 8), -3);
  assert.equal(clampStartSec(-20, 10, 8), -8);
  assert.equal(clampStartSec(20, 10, 8), 10);
});

test('parseOffsetTime accepts each form and sign', () => {
  assert.deepEqual(parseOffsetTime('+2.5'), { ok: true, seconds: 2.5 });
  assert.deepEqual(parseOffsetTime('-2.5'), { ok: true, seconds: -2.5 });
  assert.deepEqual(parseOffsetTime('-0'), { ok: true, seconds: 0 });
  assert.deepEqual(parseOffsetTime('0'), { ok: true, seconds: 0 });
  assert.deepEqual(parseOffsetTime('0:00.000'), { ok: true, seconds: 0 });
  assert.deepEqual(parseOffsetTime('1:05.250'), { ok: true, seconds: 65.25 });
  assert.deepEqual(parseOffsetTime('-1:05'), { ok: true, seconds: -65 });
  assert.deepEqual(parseOffsetTime('0:01:05.250'), { ok: true, seconds: 65.25 });
  assert.deepEqual(parseOffsetTime('2,5'), { ok: true, seconds: 2.5 });
  assert.deepEqual(parseOffsetTime(' 65.25 '), { ok: true, seconds: 65.25 });
});

test('parseOffsetTime rounds to whole milliseconds', () => {
  assert.deepEqual(parseOffsetTime('1.23456'), { ok: true, seconds: 1.235 });
});

test('parseOffsetTime rejects with the exact reasons', () => {
  assert.deepEqual(parseOffsetTime(''), {
    ok: false,
    reason: 'Type a time such as 1:05.250, 65.25 or -2.5.',
  });
  assert.deepEqual(parseOffsetTime('abc'), {
    ok: false,
    reason: 'Time format not understood. Use 65.25, -2.5, 1:05 or 1:05.250.',
  });
  assert.deepEqual(parseOffsetTime('1:75'), {
    ok: false,
    reason: 'Minutes and seconds must be below 60.',
  });
  assert.deepEqual(parseOffsetTime('3601'), {
    ok: false,
    reason: 'Offset must be within one hour (+-1:00:00).',
  });
  assert.deepEqual(parseOffsetTime('-3601'), {
    ok: false,
    reason: 'Offset must be within one hour (+-1:00:00).',
  });
});

test('buildMixPlan with no music gives musicMode none', () => {
  const plan = buildMixPlan({ voiceLength: 10000, musicLength: 0, rate: RATE, params: {} });
  assert.equal(plan.musicMode, 'none');
  assert.equal(plan.durationSec, 10);
  assert.equal(plan.musicSec, 0);
});

test('buildMixPlan with a positive start delays the music', () => {
  const plan = buildMixPlan({ voiceLength: 10000, musicLength: 8000, rate: RATE, params: { musicStartSec: 2 } });
  assert.equal(plan.musicMode, 'play');
  assert.equal(plan.audibleStartSec, 2);
  assert.equal(plan.offsetIntoMusicSec, 0);
});

test('buildMixPlan with a negative start offsets into the music', () => {
  const plan = buildMixPlan({ voiceLength: 10000, musicLength: 8000, rate: RATE, params: { musicStartSec: -2 } });
  assert.equal(plan.musicMode, 'play');
  assert.equal(plan.audibleStartSec, 0);
  assert.equal(plan.offsetIntoMusicSec, 2);
});

test('buildMixPlan negative start beyond the music length is none without loop and play with loop', () => {
  const base = { voiceLength: 10000, musicLength: 8000, rate: RATE, params: { musicStartSec: -10 } };
  assert.equal(buildMixPlan(base).musicMode, 'none');
  assert.equal(buildMixPlan({ ...base, params: { musicStartSec: -10, loop: true } }).musicMode, 'play');
});

test('buildMixPlan start at or after the end is none', () => {
  const atEnd = buildMixPlan({ voiceLength: 10000, musicLength: 8000, rate: RATE, params: { musicStartSec: 10 } });
  assert.equal(atEnd.musicMode, 'none');
  const pastEnd = buildMixPlan({ voiceLength: 10000, musicLength: 8000, rate: RATE, params: { musicStartSec: 12 } });
  assert.equal(pastEnd.musicMode, 'none');
  assert.equal(pastEnd.audibleStartSec, 10);
});

test('buildMixPlan fade overlap shortens the fade-out', () => {
  const plan = buildMixPlan({
    voiceLength: 10000,
    musicLength: 8000,
    rate: RATE,
    params: { fadeInSec: 8, fadeOutSec: 8 },
  });
  assert.deepEqual(plan.fadeIn, { startSec: 0, endSec: 8 });
  assert.deepEqual(plan.fadeOut, { startSec: 8, endSec: 10 });
});

test('buildMixPlan passes duck through only when params.duck and mode is play', () => {
  const duck = duckEnv(100);
  const on = buildMixPlan({ voiceLength: 10000, musicLength: 8000, rate: RATE, params: { duck: true }, duck });
  assert.equal(on.duck, duck);
  const off = buildMixPlan({ voiceLength: 10000, musicLength: 8000, rate: RATE, params: { duck: false }, duck });
  assert.equal(off.duck, null);
  const noMusic = buildMixPlan({ voiceLength: 10000, musicLength: 0, rate: RATE, params: { duck: true }, duck });
  assert.equal(noMusic.duck, null);
});

test('fadeValueAt is linear in the fade-in, 1 in the middle, linear in the fade-out and 0 at the end', () => {
  const plan = buildMixPlan({
    voiceLength: 10000,
    musicLength: 8000,
    rate: RATE,
    params: { fadeInSec: 2, fadeOutSec: 2 },
  });
  assert.equal(fadeValueAt(plan, 1), 0.5);
  assert.equal(fadeValueAt(plan, 5), 1);
  assert.equal(fadeValueAt(plan, 9), 0.5);
  assert.equal(fadeValueAt(plan, 10), 0);
  assert.equal(fadeValueAt(plan, -1), 1);
});

test('scheduleAt before a delayed music start gives whenSec and offset 0', () => {
  const plan = buildMixPlan({ voiceLength: 10000, musicLength: 8000, rate: RATE, params: { musicStartSec: 3 } });
  const s = scheduleAt(plan, 1);
  assert.equal(s.voiceOffsetSec, 1);
  assert.deepEqual(s.music, { whenSec: 2, offsetSec: 0, loop: false });
  assert.deepEqual(s.fade, [{ t: 0, v: 1 }]);
  assert.equal(s.duck, null);
});

test('scheduleAt inside the audible part with a negative start gives offset = position + offsetIntoMusic', () => {
  const plan = buildMixPlan({ voiceLength: 10000, musicLength: 8000, rate: RATE, params: { musicStartSec: -2 } });
  const s = scheduleAt(plan, 5);
  assert.deepEqual(s.music, { whenSec: 0, offsetSec: 7, loop: false });
});

test('scheduleAt looping wraps the offset', () => {
  const plan = buildMixPlan({ voiceLength: 10000, musicLength: 8000, rate: RATE, params: { loop: true } });
  const s = scheduleAt(plan, 10);
  assert.deepEqual(s.music, { whenSec: 0, offsetSec: 2, loop: true });
});

test('scheduleAt non-looping music already finished gives music null', () => {
  const plan = buildMixPlan({ voiceLength: 10000, musicLength: 8000, rate: RATE, params: {} });
  const s = scheduleAt(plan, 9);
  assert.equal(s.music, null);
});

test('scheduleAt fade list starts with the current value and lists only later boundaries', () => {
  const plan = buildMixPlan({
    voiceLength: 10000,
    musicLength: 8000,
    rate: RATE,
    params: { fadeInSec: 2, fadeOutSec: 2 },
  });
  const s = scheduleAt(plan, 0);
  assert.deepEqual(s.fade, [
    { t: 0, v: 0 },
    { t: 2, v: 1 },
    { t: 8, v: 1 },
    { t: 10, v: 0 },
  ]);
});

test('scheduleAt inside a fade-in starts at the right partial value', () => {
  const plan = buildMixPlan({
    voiceLength: 10000,
    musicLength: 8000,
    rate: RATE,
    params: { fadeInSec: 2, fadeOutSec: 2 },
  });
  const s = scheduleAt(plan, 1);
  assert.deepEqual(s.fade, [
    { t: 0, v: 0.5 },
    { t: 1, v: 1 },
    { t: 7, v: 1 },
    { t: 9, v: 0 },
  ]);
});

test('scheduleAt duck curve is the subarray from the right frame and its duration', () => {
  const duck = duckEnv(100);
  const plan = buildMixPlan({ voiceLength: 10000, musicLength: 8000, rate: RATE, params: { duck: true }, duck });
  const s = scheduleAt(plan, 0.25);
  assert.equal(s.duck.curve.length, 75);
  assert.equal(s.duck.durationSec, 0.74);
  assert.equal(s.duck.curve[0], 0.5);
});

test('scheduleAt duck is null when fewer than two frames remain', () => {
  const duck = duckEnv(100);
  const plan = buildMixPlan({ voiceLength: 10000, musicLength: 8000, rate: RATE, params: { duck: true }, duck });
  const s = scheduleAt(plan, 0.99);
  assert.equal(s.duck, null);
});

test('scheduleAt clamps the position into 0..durationSec', () => {
  const plan = buildMixPlan({ voiceLength: 10000, musicLength: 8000, rate: RATE, params: {} });
  assert.equal(scheduleAt(plan, -5).voiceOffsetSec, 0);
  assert.equal(scheduleAt(plan, 50).voiceOffsetSec, 10);
});

test('peakBound adds the scaled music peak only in play mode', () => {
  const play = buildMixPlan({ voiceLength: 10000, musicLength: 8000, rate: RATE, params: {} });
  assert.equal(peakBound(play, 0.5, 0.3), 0.65);
  const none = buildMixPlan({ voiceLength: 10000, musicLength: 0, rate: RATE, params: {} });
  assert.equal(peakBound(none, 0.5, 0.3), 0.5);
});

test('no function mutates its inputs', () => {
  const params = { voiceGain: 1.5, musicStartSec: 1.23456, loop: true, duck: true };
  const paramsCopy = { ...params };
  const duck = duckEnv(100);
  const duckCopy = duck.frames.slice();
  const plan = buildMixPlan({ voiceLength: 10000, musicLength: 8000, rate: RATE, params, duck });
  scheduleAt(plan, 0.25);
  assert.deepEqual(params, paramsCopy);
  assert.deepEqual(Array.from(duck.frames), Array.from(duckCopy));
  assert.equal(plan.duck, duck);
});