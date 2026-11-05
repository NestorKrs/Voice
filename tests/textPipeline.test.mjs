import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, chunkText } from '../src/textPipeline.js';

test('cleanText handles CRLF, tabs, spaces, newlines, control chars, non-string', () => {
  assert.equal(cleanText('a\r\nb'), 'a\nb');
  assert.equal(cleanText('a\tb  c'), 'a b c');
  assert.equal(cleanText('a\n\n\n\nb'), 'a\n\nb');
  assert.equal(cleanText('a\x01b'), 'ab');
  assert.equal(cleanText(42), '');
  assert.equal(cleanText(''), '');
});

test('chunkText empty/whitespace returns []', () => {
  assert.deepEqual(chunkText(''), []);
  assert.deepEqual(chunkText('   \n\n  '), []);
});

test('short text one chunk', () => {
  assert.deepEqual(chunkText('hello world'), ['hello world']);
});

test('short paragraphs pack', () => {
  const r = chunkText('p1\n\np2\n\np3', 100);
  assert.equal(r.length, 1);
});

test('non-fitting paragraphs separate in order', () => {
  const r = chunkText('aaaaaaaaaa\n\nbbbbbbbbbb', 12);
  assert.equal(r.length, 2);
});

test('long paragraph splits at sentence ends', () => {
  const text = 'First sentence. Second sentence. Third sentence. '.repeat(20);
  const r = chunkText(text, 80);
  for (const c of r) assert.ok(c.length <= 80);
  for (const c of r) assert.ok(!c.endsWith('Second'));
});

test('long sentence splits at spaces, no word cut', () => {
  const words = 'word '.repeat(50).trim();
  const r = chunkText(words, 40);
  const before = words.split(/\s+/);
  const after = r.join(' ').split(/\s+/);
  assert.deepEqual(before, after);
});

test('single long word hard-cut', () => {
  const w = 'a'.repeat(5000);
  const r = chunkText(w, 100);
  for (const c of r) assert.ok(c.length <= 100);
});

test('generated 100000 chars', () => {
  const words = Array.from({ length: 20000 }, (_, i) => 'w' + i).join(' ');
  const text = words.slice(0, 100000);
  const r = chunkText(text, 2000);
  assert.ok(text.length >= 100000, 'generated text too short');
  assert.ok(r.every((c) => c.length > 0 && c.length <= 2000));
  const before = text.split(/\s+/);
  const after = r.join(' ').split(/\s+/);
  assert.deepEqual(before, after);
  assert.ok(r.length >= Math.ceil(text.length / 2000) && r.length <= Math.ceil(text.length / 1500));
});

test('custom maxChars respected', () => {
  const r = chunkText('hello world this is a test', 10);
  for (const c of r) assert.ok(c.length <= 10);
});