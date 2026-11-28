import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8');

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

test('slash menu sits inside the find row it is positioned against', () => {
  const rowStart = src.indexOf('<div className="find-row">');
  const menuStart = src.indexOf('<div className="slash-menu"');
  const rowEnd = src.indexOf('</div>\n          <textarea', rowStart);
  assert.ok(rowStart !== -1 && menuStart !== -1 && rowEnd !== -1);
  assert.ok(menuStart > rowStart && menuStart < rowEnd);
});

test('slash menu shows category tabs and tag buttons in a grid', () => {
  assert.match(src, /className="slash-tabs"/);
  assert.match(src, /className="slash-grid"/);
  assert.match(src, /slashCategory/);
  assert.match(src, /handleSlashEntry/);
  assert.equal(src.includes('slash-group'), false);
  assert.match(css, /\.slash-menu \.slash-tabs \{/);
  assert.match(css, /\.slash-menu \.slash-grid \{/);
});

test('insertion scrolls to the caret and flashes the tag text in teal', () => {
  assert.match(src, /scrollTextareaToIndex\(ta, caret\)/);
  assert.match(src, /slashContext\(ta\.value, ta\.selectionStart\)/);
  assert.match(src, /onKeyDown=\{handleEditorKeyDown\}/);
  assert.match(src, /setFlashTag/);
  assert.match(src, /clearFlashTag/);
  assert.match(src, /tag-flash/);
  assert.match(css, /textarea\.tag-flash::selection/);
  assert.match(css, /background: transparent; color: var\(--accent\)/);
});