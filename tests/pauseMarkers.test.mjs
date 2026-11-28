import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPauses, hasPauses, stripForRequest } from '../src/pauseMarkers.js';

test('example: one pause between two sentences, one space kept', () => {
  const input = '[slowly] The first thing. <break time="1.2s" /> [carefully] The next.';
  const r = extractPauses(input);
  assert.equal(r.clean, '[slowly] The first thing. [carefully] The next.');
  assert.equal(r.count, 1);
  assert.equal(r.pauses[0].index, r.clean.indexOf('[carefully]'));
  assert.equal(r.pauses[0].seconds, 1.2);
  assert.equal(r.clamped, false);
});

test('a tag at the very end gives index clean.length', () => {
  const r = extractPauses('Hello <break time="1s"/>');
  assert.equal(r.clean, 'Hello');
  assert.equal(r.pauses.length, 1);
  assert.equal(r.pauses[0].index, r.clean.length);
  assert.equal(r.pauses[0].seconds, 1);
});

test('a tag at the start of the text drops the spaces after it', () => {
  const r = extractPauses('<break time="2s"/>   Hi');
  assert.equal(r.clean, 'Hi');
  assert.equal(r.pauses[0].index, 0);
  assert.equal(r.pauses[0].seconds, 2);
});

test('a tag at the start of a later line drops the following spaces, keeps the newline', () => {
  const r = extractPauses('One\n<break time="1.5s"/>   Two');
  assert.equal(r.clean, 'One\nTwo');
  assert.equal(r.pauses[0].index, 4);
  assert.equal(r.pauses[0].seconds, 1.5);
});

test('a tag followed by a newline keeps the newline', () => {
  const r = extractPauses('Hi <break time="1s"/>\nBye');
  assert.equal(r.clean, 'Hi \nBye');
  assert.ok(r.clean.includes('\n'));
  assert.equal(r.pauses[0].index, 3);
});

test('two adjacent tags merge to the sum at one index', () => {
  const r = extractPauses('A<break time="1s"/><break time="2s"/>B');
  assert.equal(r.clean, 'AB');
  assert.equal(r.count, 1);
  assert.equal(r.pauses[0].index, 1);
  assert.equal(r.pauses[0].seconds, 3);
});

test('a value above 60 clamps to 60 and sets clamped', () => {
  const r = extractPauses('A<break time="120s"/>B');
  assert.equal(r.clean, 'AB');
  assert.equal(r.pauses[0].seconds, 60);
  assert.equal(r.clamped, true);
});

test('merged seconds clamp to 60 in total and set clamped', () => {
  const r = extractPauses('A<break time="40s"/><break time="40s"/>B');
  assert.equal(r.pauses.length, 1);
  assert.equal(r.pauses[0].seconds, 60);
  assert.equal(r.clamped, true);
});

test('comma decimal is accepted', () => {
  const r = extractPauses('A<break time="1,5s"/>B');
  assert.equal(r.pauses[0].seconds, 1.5);
  assert.equal(r.clean, 'AB');
});

test('a zero-second tag is removed without a pause', () => {
  const r = extractPauses('A<break time="0s"/>B');
  assert.equal(r.clean, 'AB');
  assert.equal(r.count, 0);
  assert.equal(r.clamped, false);
});

test('a negative value is not matched by BREAK_RE and stays literal', () => {
  const r = extractPauses('A<break time="-3s"/>B');
  assert.equal(r.clean, 'A<break time="-3s"/>B');
  assert.equal(r.count, 0);
});

test('uppercase BREAK is matched', () => {
  const r = extractPauses('A<BREAK time="2s"/>B');
  assert.equal(r.clean, 'AB');
  assert.equal(r.pauses[0].seconds, 2);
});

test('two separate tags keep their own indexes against the clean text', () => {
  const r = extractPauses('One <break time="1s"/> Two <break time="2s"/> Three');
  assert.equal(r.clean, 'One Two Three');
  assert.equal(r.pauses.length, 2);
  assert.equal(r.pauses[0].index, r.clean.indexOf('Two'));
  assert.equal(r.pauses[0].seconds, 1);
  assert.equal(r.pauses[1].index, r.clean.indexOf('Three'));
  assert.equal(r.pauses[1].seconds, 2);
});

test('text without tags is unchanged', () => {
  const r = extractPauses('Just text, no tags.');
  assert.equal(r.clean, 'Just text, no tags.');
  assert.deepEqual(r.pauses, []);
  assert.equal(r.count, 0);
  assert.equal(r.clamped, false);
});

test('stripForRequest: local strips, native and undefined keep the text', () => {
  const input = 'A <break time="1s"/> B';
  assert.equal(stripForRequest(input, 'local'), 'A B');
  assert.equal(stripForRequest(input, 'native'), input);
  assert.equal(stripForRequest(input, undefined), input);
});

test('indexes stay within clean and are non-decreasing', () => {
  const r = extractPauses('Start <break time="1s"/> mid <break time="2s"/> end <break time="3s"/>');
  let last = -1;
  for (const p of r.pauses) {
    assert.ok(p.index >= 0 && p.index <= r.clean.length);
    assert.ok(p.index >= last);
    last = p.index;
  }
});

test('extractPauses does not mutate its input', () => {
  const input = 'A <break time="1s"/> B';
  const copy = String(input);
  extractPauses(input);
  assert.equal(input, copy);
});

test('hasPauses reflects the pause count', () => {
  assert.equal(hasPauses('A <break time="1s"/> B'), true);
  assert.equal(hasPauses('No tags here'), false);
});