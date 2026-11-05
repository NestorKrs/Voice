import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const versionSource = readFileSync(new URL('../src/version.js', import.meta.url), 'utf8');

test('package version has the MAJOR.MINOR.PATCH-alpha format', () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+-alpha$/);
});

test('src/version.js reads the version from package.json', () => {
  assert.match(versionSource, /package\.json/);
});