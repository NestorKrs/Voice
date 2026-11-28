import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('App aligns the highlight on the spoken text', () => {
  assert.ok(source.includes('stripWithMap'), 'missing stripWithMap');
  assert.ok(source.includes('spoken.map['), 'missing spoken.map[');
  assert.ok(source.includes('alignTimeMap(spoken.text'), 'missing alignTimeMap(spoken.text');
});