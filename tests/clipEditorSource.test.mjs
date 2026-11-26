import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ClipEditor.jsx', import.meta.url), 'utf8');

test('ClipEditor source has the required declaration, imports and visible strings', () => {
  assert.ok(source.includes('export default function ClipEditor'));
  assert.ok(source.includes("from './waveformPeaks.js'"));
  assert.ok(source.includes("from './clipCuts.js'"));
  assert.ok(source.includes('Close editor'));
  assert.ok(source.includes('Decoding audio...'));
  assert.ok(source.includes('No ready chunks to edit yet.'));
});

test('ClipEditor source uses no storage or network calls', () => {
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
});
