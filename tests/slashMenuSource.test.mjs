import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('App imports the slash menu, directives and directiveSupport', () => {
  assert.match(src, /from '\.\/slashMenu\.js'/);
  assert.match(src, /from '\.\/directives\.js'/);
  assert.match(src, /directiveSupport/);
});

test('App uses parseSlashInput, insertAt( and lastSelRef', () => {
  assert.match(src, /parseSlashInput/);
  assert.match(src, /insertAt\(/);
  assert.match(src, /lastSelRef/);
});

test('App shows the stop-playback reason and the new placeholder', () => {
  assert.match(src, /Stop playback to edit the text\./);
  assert.match(src, /Find in text, or type \/ to insert a tag or pause/);
});

test('App renders the slash-menu', () => {
  assert.match(src, /slash-menu/);
});

test('App never logs the document text', () => {
  assert.equal(/logEvent\(text\)/.test(src), false);
});