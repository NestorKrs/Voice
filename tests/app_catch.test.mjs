import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('catch blocks that use e bind it', () => {
  const bad = [...src.matchAll(/catch\s*\{[^}]*\be\b/g)];
  assert.equal(bad.length, 0, 'catch without (e) uses e in ' + bad.length + ' place(s)');
});
