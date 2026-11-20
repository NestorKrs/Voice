import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');

test('the build uses the /voice/app/ base', () => {
  assert.match(config, /\/voice\/app\//);
});

test('the base is chosen by the build command', () => {
  assert.match(config, /command === 'build'/);
});
