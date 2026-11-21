import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('index.html links the favicon and touch icon', () => {
  assert.match(indexHtml, /<link rel="icon" href="\/favicon\.ico" sizes="48x48" \/>/);
  assert.match(indexHtml, /<link rel="icon" href="\/icon\.svg" type="image\/svg\+xml" \/>/);
  assert.match(indexHtml, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" \/>/);
});

test('the icon files exist in public', () => {
  assert.ok(existsSync(new URL('../public/icon.svg', import.meta.url)));
  assert.ok(existsSync(new URL('../public/favicon.ico', import.meta.url)));
  assert.ok(existsSync(new URL('../public/apple-touch-icon.png', import.meta.url)));
});
