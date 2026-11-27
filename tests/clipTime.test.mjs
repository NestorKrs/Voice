import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTime } from '../src/clipTime.js';
import { formatTime } from '../src/clipCuts.js';

const RATE = 1000;
const TOTAL = 100000;
const FAST = 44100;

function sampleOf(text, rate = RATE, total = TOTAL) {
  const result = parseTime(text, rate, total);
  assert.equal(result.ok, true, `expected ${text} to be accepted: ${result.reason}`);
  return result.sample;
}

function reasonOf(text, rate = RATE, total = TOTAL) {
  const result = parseTime(text, rate, total);
  assert.equal(result.ok, false, `expected ${text} to be rejected`);
  return result.reason;
}

test('plain seconds, comma decimals and colon forms at 1000 Hz', () => {
  assert.equal(sampleOf('65.25'), 65250);
  assert.equal(sampleOf('65,25'), 65250);
  assert.equal(sampleOf('1:05.250'), 65250);
  assert.equal(sampleOf('1:05'), 65000);
  assert.equal(sampleOf('0:01:05.250'), 65250);
});

test('fractions round to the nearest sample at 1000 Hz', () => {
  assert.equal(sampleOf('0.001'), 1);
  assert.equal(sampleOf('1.00049'), 1000);
});

test('fractions round to the nearest sample at 44100 Hz', () => {
  const total = 100 * FAST;
  assert.equal(sampleOf('1.5', FAST, total), 66150);
  assert.equal(sampleOf('0.001', FAST, total), 44);
});

test('surrounding spaces are trimmed', () => {
  assert.equal(sampleOf(' 2.5 '), 2500);
});

test('empty input has its own exact reason', () => {
  const reason = 'Type a time such as 1:05.250 or 65.25.';
  assert.equal(reasonOf(''), reason);
  assert.equal(reasonOf('   '), reason);
});

test('unrecognised forms share one exact reason', () => {
  const reason = 'Time format not understood. Use 65.25, 1:05 or 1:05.250.';
  for (const text of ['abc', '1:2:3:4', '-5', '1.2.3', '1:2', '1:05:2', '1.', '1 2', '1,2,3']) {
    assert.equal(reasonOf(text), reason, text);
  }
});

test('minutes and seconds of 60 or more are rejected', () => {
  const reason = 'Minutes and seconds must be below 60.';
  assert.equal(reasonOf('1:75'), reason);
  assert.equal(reasonOf('1:60:00'), reason);
  assert.equal(reasonOf('0:01:60'), reason);
});

test('a cut at zero is rejected', () => {
  const reason = 'A cut must be after the start (0:00.000).';
  assert.equal(reasonOf('0'), reason);
  assert.equal(reasonOf('0:00.000'), reason);
});

test('a cut at or past the end is rejected with the formatted end', () => {
  const reason = reasonOf('10', RATE, 10000);
  assert.equal(reason, `A cut must be before the end (${formatTime(10000, RATE)}).`);
  assert.ok(reason.includes(formatTime(10000, RATE)));
  assert.equal(reasonOf('11', RATE, 10000), reason);
  assert.equal(sampleOf('9.999', RATE, 10000), 9999);
});

test('no audio loaded with a zero total or rate', () => {
  const reason = 'No audio loaded.';
  assert.equal(reasonOf('1', RATE, 0), reason);
  assert.equal(reasonOf('1', 0, 10000), reason);
});

test('accepted samples are integers strictly inside the clip', () => {
  for (const [text, rate, total] of [
    ['0.001', RATE, TOTAL],
    ['65.25', RATE, TOTAL],
    ['0.001', FAST, 100 * FAST],
    ['9.999', RATE, 10000],
  ]) {
    const sample = sampleOf(text, rate, total);
    assert.equal(Number.isInteger(sample), true, text);
    assert.ok(sample >= 1 && sample < total, text);
  }
});
