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
  assert.ok(appSource.includes('className="close-btn reader-close-editor"'));
  assert.ok(!/>Close editor<\/button>/.test(appSource));
  assert.ok(!source.includes('Close editor'));
});

test('zoom tools sit above the waveform and the transport play button below it', () => {
  const tools = source.indexOf('className="clip-tools"');
  const wave = source.indexOf('className={`clip-wave');
  const transport = source.indexOf('className="clip-transport"');
  assert.ok(tools > -1 && wave > -1 && transport > -1);
  assert.ok(tools < wave, 'tools row is above the waveform');
  assert.ok(wave < transport, 'transport row is below the waveform');
  assert.ok(source.includes('formatTime(playPos, displayRate)'));
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
  assert.ok(source.includes('#ff6f6f'));
});

test('ClipEditor and App wire saved cut markers', () => {
  assert.ok(source.includes("from './clipMarkerStore.js'"));
  assert.ok(source.includes('Cannot save cut markers: browser storage is not available.'));
  assert.ok(source.includes('Cannot save cut markers: browser storage is full or blocked.'));
  assert.ok(appSource.includes('audioKeyFrom'));
  assert.ok(appSource.includes('audioKey={editorAudioKey}'));
});

test('ClipEditor snaps to quiet spots while Shift is held', () => {
  assert.ok(source.includes("from './clipSnap.js'"));
  assert.ok(source.includes('snapToQuiet'));
  assert.ok(source.includes('shiftKey'));
});

test('ClipEditor wires clip names and per-clip play', () => {
  assert.ok(source.includes("from './clipNames.js'"));
  assert.ok(source.includes("from './clipSlices.js'"));
  assert.ok(source.includes('aria-label="Clip name"'));
  assert.ok(source.includes('applyCuts'));
  assert.equal(/setCuts\((addMarker|moveMarker|deleteMarker|nudgeMarker|undo|redo)\(/.test(source), false);
});

test('ClipEditor puts the shortcut hint and restore note in one footer row', () => {
  assert.ok(source.includes('className="clip-hints"'));
  assert.ok(source.includes('className="clip-hint clip-restore"'));
  assert.ok(!source.includes('{restoreNote ? <div className="clip-hint">'));
  assert.ok(source.indexOf('className="clip-hints"') > source.indexOf('className="clip-list"'));
});

const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8');

test('App.css has the editor width override, centred tools and a dimmed teal hint row', () => {
  assert.ok(css.includes('.columns:has(.reader-panel.editor-open)'));
  assert.ok(!css.includes('rgba(255, 111, 111, 0.10)'));
  assert.ok(css.includes('.clip-hint { font-size: 11px; color: var(--accent); opacity: 0.75; }'));
  assert.ok(css.includes('.clip-tools { display: flex; align-items: center; gap: 8px; justify-self: center; }'));
  assert.ok(css.includes('.drawer .close-btn, .reader-close-editor'));
  assert.ok(css.includes('.clip-list { display: flex; flex-direction: column; gap: 8px; flex: 1 1 auto; min-height: 72px; overflow-y: auto;'));
  assert.ok(!css.includes('max-height: 430px'));
});

test('ClipEditor wires the clip export controls', () => {
  assert.ok(source.includes("from './clipExport.js'"));
  assert.ok(source.includes('Download all clips (ZIP)'));
  assert.ok(source.includes('Download cut list (CSV)'));
  assert.ok(source.includes('Add at least one cut first'));
  assert.ok(source.includes('Export is not available'));
});

test('export click handlers call save before any await', () => {
  for (const name of ['downloadClip', 'exportZip', 'exportCsv']) {
    const start = source.indexOf('const ' + name + ' =');
    const save = source.indexOf('clipExportDeps.save(', start);
    assert.ok(save > start, name + ' calls save');
    assert.ok(!source.slice(start, save).includes('await'), name + ' has no await before save');
  }
});

test('editor body order is tools, waveform, transport, list, export, hint, now', () => {
  const list = source.indexOf('className="clip-list"');
  const exp = source.indexOf('className="clip-export"');
  const hint = source.indexOf('className="clip-hints"');
  const now = source.indexOf('className="clip-now"');
  assert.ok(list > -1 && exp > -1 && hint > -1 && now > -1);
  assert.ok(list < exp, 'clip-list is before clip-export');
  assert.ok(exp < hint, 'clip-export is before clip-hint');
  assert.ok(hint < now, 'clip-hint is before clip-now');
});

test('clip-now is the last clip-* className in the file', () => {
  const matches = [...source.matchAll(/className="clip-/g)];
  assert.ok(matches.length > 0);
  const last = matches[matches.length - 1];
  const tail = source.slice(last.index);
  assert.ok(tail.startsWith('className="clip-now"'), 'the last clip-* className is clip-now');
});

test('ClipEditor has a draggable ruler, playhead handle and Go to start', () => {
  assert.ok(source.includes('clip-ruler'));
  assert.ok(source.includes('Go to start (Home)'));
  assert.ok(source.includes('Home'));
  assert.ok(source.includes('stopPropagation'));
  assert.ok(source.includes('setPointerCapture'));
});

test('ClipEditor wires the loop toggle and looping rows', () => {
  assert.ok(source.includes('setLoop'));
  assert.ok(source.includes('Loop clips'));
  assert.ok(source.includes('aria-pressed={loopOn}'));
  assert.ok(source.includes('{ loop: loopOnRef.current }'));
  assert.ok(source.includes('looping'));
});

test('ClipEditor wires the fade toggles, scope picker and clip selection', () => {
  assert.ok(source.includes('Fade in'));
  assert.ok(source.includes('Fade out'));
  assert.ok(source.includes('aria-label="Apply fades to"'));
  assert.ok(source.includes('Select clips in the list first'));
  assert.ok(source.includes('fadeClips'));
  assert.ok(!source.includes('fadeOn'));
  assert.ok(!source.includes('type="checkbox"'));
});

test('ClipEditor maps each clip to its own spoken text', () => {
  assert.ok(source.includes("from './clipText.js'"));
  assert.ok(source.includes("from './silenceMap.js'"));
  assert.ok(source.includes("from './alignMap.js'"));
  assert.ok(source.includes("from './highlight.js'"));
  assert.ok(source.includes('createClipTextMapper'));
  assert.ok(source.includes('textForRange'));
  assert.ok(source.includes('estimated: no clear pause found at the cut'));
  // The editor passes window.localStorage to an injected store, so the text
  // feature must not add direct storage reads or writes of its own.
  assert.ok(!source.includes('setItem('));
  assert.ok(!source.includes('getItem('));
});

test('ClipEditor names exported files from the clip text', () => {
  assert.ok(source.includes('clipTextList'));
  assert.ok(source.includes('texts: clipTextList'));
  assert.ok(source.includes('Download clip'));
});

test('Start Reading is disabled while the clip editor is open', () => {
  assert.ok(appSource.includes('const canStart = !editorOpen &&'));
  assert.ok(appSource.includes('Close the clip editor before starting to read.'));
  assert.ok(appSource.includes('disabled={!canStart}'));
});

test('clip rows reorder visually by grip drag without changing cuts or exports', () => {
  assert.ok(source.includes("from './clipOrder.js'"));
  assert.ok(source.includes('reorderIds('));
  assert.ok(source.includes('className="clip-grip"'));
  assert.ok(source.includes('data-index={segment.index}'));
  assert.ok(source.includes('? shownSegments.map((segment) =>'));
  assert.ok(source.includes('segments: cutsRef.current ? segments(cutsRef.current) : []'));
});

test('the editor reports the playing clip text range to the Text panel', () => {
  assert.ok(source.includes('onClipView = null'));
  assert.ok(source.includes('onClipView(viewChunkText'));
  assert.ok(appSource.includes('onClipView={setClipView}'));
  assert.ok(appSource.includes('staticRange={editorOpen && clipView'));
  assert.ok(appSource.includes('setClipView(null)'));
});

test('the highlight is rounded across line breaks and the grip is styled', () => {
  assert.ok(css.includes('-webkit-box-decoration-break: clone; box-decoration-break: clone;'));
  assert.ok(css.includes('.clip-grip { cursor: grab; touch-action: none;'));
});
