import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ClipEditor.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('ClipEditor source has the required declaration, imports and visible strings', () => {
  assert.ok(source.includes('export default function ClipEditor'));
  assert.ok(source.includes("from './waveformPeaks.js'"));
  assert.ok(source.includes("from './clipCuts.js'"));
  assert.ok(source.includes('Decoding audio...'));
  assert.ok(source.includes('No ready chunks to edit yet.'));
});

test('ClipEditor source uses no storage or network calls', () => {
  assert.ok(!source.includes('getItem('));
  assert.ok(!source.includes('setItem('));
  assert.ok(!source.includes('fetch('));
});

test('ClipEditor source wires zoom and scroll from clipView', () => {
  assert.ok(source.includes("from './clipView.js'"));
  assert.ok(source.includes('passive: false'));
  assert.ok(source.includes('Math.round(rate * 0.4)'));
});

test('the reader panel head owns the editor close button', () => {
  assert.ok(appSource.includes('aria-label="Close editor"'));
  assert.ok(appSource.includes('title="Close editor"'));
  assert.ok(!/>Close editor<\/button>/.test(appSource));
  assert.ok(!source.includes('Close editor'));
});

test('zoom tools sit between elapsed and remaining time', () => {
  const times = source.slice(source.indexOf('<div className="clip-times">'));
  assert.ok(times.includes('className="clip-tools"'));
  assert.ok(times.includes('formatTime(current.start, rate)'));
  assert.ok(times.includes('formatTime(total - (current.start + current.span), rate)'));
  assert.ok(source.indexOf('className="clip-tools"') > source.indexOf('<div className="clip-times">'));
});

test('ClipEditor wires playback, Space and the playhead without storage', () => {
  assert.ok(source.includes("from './clipPlayer.js'"));
  assert.ok(source.includes('requestAnimationFrame'));
  assert.ok(source.includes('Space'));
  assert.ok(source.includes('Audio playback is not available: '));
  assert.ok(!source.includes('getItem('));
  assert.ok(!source.includes('setItem('));
});

test('ClipEditor imports cut and snap modules and exposes marker controls', () => {
  assert.ok(source.includes("from './clipCuts.js'"));
  assert.ok(source.includes("from './clipSnap.js'"));
  assert.ok(source.includes('KeyM'));
  assert.ok(source.includes('aria-pressed'));
  assert.ok(source.includes('Nothing to undo'));
  assert.ok(source.includes('#f5a524'));
});

test('ClipEditor and App wire saved cut markers', () => {
  assert.ok(source.includes("from './clipMarkerStore.js'"));
  assert.ok(source.includes('Cannot save cut markers: browser storage is not available.'));
  assert.ok(source.includes('Cannot save cut markers: browser storage is full or blocked.'));
  assert.ok(appSource.includes('audioKeyFrom'));
  assert.ok(appSource.includes('audioKey={editorAudioKey}'));
});
