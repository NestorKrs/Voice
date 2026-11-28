import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const scheduler = readFileSync(new URL('../src/scheduler.js', import.meta.url), 'utf8');

test('App.jsx prefixes a known HTTP status on a chunk error', () => {
  assert.ok(app.includes("'HTTP '"), "App.jsx should build the 'HTTP ' prefix");
});

test('the scheduler note text is present', () => {
  assert.ok(
    scheduler.includes('have not changed. Edit the text or change the voice'),
    'scheduler.js should carry the rejected-chunk note',
  );
});