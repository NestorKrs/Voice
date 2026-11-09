import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectionReadState } from '../src/selectionSpeech.js';

test('empty', () => {
  const r = selectionReadState('', 10);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'Nothing selected');
});

test('whitespace only', () => {
  const r = selectionReadState('   \n  ', 10);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'Nothing selected');
});

test('normal text', () => {
  const r = selectionReadState('hello world', 11);
  assert.equal(r.ok, true);
  assert.equal(r.text, 'hello world');
});

test('exactly at limit', () => {
  const r = selectionReadState('abcdefghij', 10);
  assert.equal(r.ok, true);
});

test('one over limit', () => {
  const r = selectionReadState('abcdefghijk', 10);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'Selection is 11 characters, the limit is 10 (chunk size)');
});

test('extra whitespace and control chars cleaned', () => {
  const r = selectionReadState('  hello\t\tworld\x00  ', 100);
  assert.equal(r.ok, true);
  assert.equal(r.text, 'hello world');
});
