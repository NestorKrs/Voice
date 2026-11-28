import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'src', 'App.jsx'), 'utf8');

test('App wires the pauses step: names present', () => {
  for (const name of ['deriveChunkAudio', 'handlePauseReport', 'pauseNotes', 'applyPauses', 'mapPausesToSpoken']) {
    assert.ok(source.includes(name), 'missing ' + name);
  }
});

test('App uses the real findSilences option and the snap radius', () => {
  assert.ok(source.includes('minSilence: 0.03'), 'missing minSilence: 0.03');
  assert.ok(source.includes('snapRadiusSec: 0.3'), 'missing snapRadiusSec: 0.3');
});

test('App never logs document or chunk text', () => {
  assert.ok(!source.includes('logEvent(st.text'), 'logs st.text');
  assert.ok(!source.includes('logEvent(chunk'), 'logs chunk text');
  assert.ok(!source.includes('logEvent(text'), 'logs text');
});