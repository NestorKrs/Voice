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
test('a break tag with a space is never split from its closing (long sentence, maxChars 40)', () => {
  const text = 'one two three four five <break time="1.2s" /> six seven eight nine ten';
  const r = chunkText(text, 40);
  for (const c of r) {
    if (c.includes('<break')) assert.ok(c.includes('/>'), 'chunk has <break without />: ' + c);
  }
  assert.equal(r.join(' ').split('<break').length - 1, 1);
});

test('a multi-word tag is never split from its closing bracket', () => {
  const text = "one two three four five [under one's breath] six seven eight nine ten";
  const r = chunkText(text, 40);
  for (const c of r) {
    if (c.includes('[')) assert.ok(c.includes(']'), 'chunk has [ without ]: ' + c);
  }
});

test('a paragraph that is only a break tag merges into the previous chunk', () => {
  const r = chunkText('First para\n\n<break time="1s"/>', 12);
  assert.deepEqual(r, ['First para <break time="1s"/>']);
});

test('a leading paragraph that is only a break tag merges into the next chunk', () => {
  const r = chunkText('<break time="1s"/>\n\nSecond para', 12);
  assert.deepEqual(r, ['<break time="1s"/> Second para']);
});

test('a paragraph that is only [slowly] merges the same way', () => {
  const r = chunkText('First para\n\n[slowly]', 12);
  assert.deepEqual(r, ['First para [slowly]']);
});

test('a lone non-speakable text returns one chunk', () => {
  assert.deepEqual(chunkText('<break time="1s"/>'), ['<break time="1s"/>']);
});

test('directives round-trip exactly once and in order', () => {
  const d1 = '<break time="1.2s" />';
  const d2 = "[under one's breath]";
  const text = 'Start ' + d1 + ' middle ' + d2 + ' end.';
  const joined = chunkText(text, 2000).join(' ');
  assert.equal(joined.split(d1).length - 1, 1);
  assert.equal(joined.split(d2).length - 1, 1);
  assert.ok(joined.indexOf(d1) < joined.indexOf(d2));
});

test('text without directives gives the recorded chunks', () => {
  assert.deepEqual(chunkText('a\n\nb', 100), ['a\n\nb']);
});

test('a tag inside a long word run is never cut', () => {
  const tag = "[under one's breath]";
  const word = 'a'.repeat(10) + tag + 'b'.repeat(10);
  const r = chunkText(word, 10);
  assert.equal(r.join('').split(tag).length - 1, 1);
  for (const c of r) {
    if (c.includes('[')) assert.ok(c.includes(']'), 'chunk has [ without ]: ' + c);
  }
});

test('loose-form breaks are restored unchanged', () => {
  const loose1 = '<break time="1,5s" />';
  const loose2 = '<break time="2s" />';
  const joined = chunkText('A ' + loose1 + ' B ' + loose2 + ' C', 2000).join(' ');
  assert.ok(joined.includes(loose1));
  assert.ok(joined.includes(loose2));
});

test('chunkText does not leak regex state across two calls', () => {
  const input = 'one <break time="1s" /> two [slowly] three';
  assert.deepEqual(chunkText(input, 40), chunkText(input, 40));
});
