# Voice handoff

Date: 2026-11-27 (end of day). Owner: @Eleven. Plan: docs/plan.md. Rules: AGENTS.md. Feature detail: docs/clip-editor-handoff.md.

## Version and git
- package.json: 0.2.66-beta. First CHANGELOG entry is 0.2.66-beta (matches). No skipped version found between 0.2.55 and 0.2.66.
- Sandbox has no .git; on the P75 run `git -C ~/Work/Voice log --oneline -5` and `git status --short`.
- Backup counter in docs/backup-log.md is 0 (backup made 2026-11-27 at 0.2.66-beta).
- CHANGELOG.md has exactly one `# Changelog` heading; the older 0.1.x duplicate/order/suffix issues are still there (open decision).
- docs/codebase-map.md and docs/lessons.md do not exist.

## What was done this session (0.2.55 → 0.2.66, all 2026-11-27)
- 0.2.55-beta: new pure src/clipExport.js (sequential encoding with fades, unique file names, skipped empty clips, cut-list CSV bytes, ZIP entries) with 11 tests; not imported by the app.
- 0.2.56-beta: export wired into the editor (ZIP, single clip, cut-list CSV, picker-first saving, injected encoders, fade toggle).
- 0.2.57-beta: separate fade-in/fade-out and per-clip fades (no UI).
- 0.2.58-beta: range looping in src/clipPlayer.js (no UI).
- 0.2.59-beta: editor fits the panel height; clip row reordered.
- 0.2.60-beta: draggable playhead (ruler scrub, handle, grab the line) and Go to start + Home.
- 0.2.61-beta: Loop clips toggle with per-clip loop playback and loop-follows-cuts.
- 0.2.62-beta: Fade in / Fade out toggles, All/Selected scope picker, row selection.
- 0.2.63-beta: new pure src/clipText.js maps a sample range back to the spoken text (not imported by the app).
- 0.2.64-beta: each clip's own text as its name placeholder, hover title and the strip under the waveform.
- 0.2.65-beta: unnamed clips are named from the first six words of their text (nameFromText).
- 0.2.66-beta: file names for ZIP, CSV, single download and the row title come from the clip text; App.jsx untouched.

## Verified
- npm test: 486 pass, 0 fail (2026-11-27, 0.2.66-beta), 4.29 s. Full raw run was pasted in the 0.2.66 task report.
- node --check clean on every .js/.mjs file touched today (src/clipExport.js, src/clipSlices.js, src/clipText.js, src/clipPlayer.js, tests/clipExport.test.mjs, tests/clipSlices.test.mjs, tests/clipText.test.mjs, tests/clipPlayer.test.mjs, tests/clipEditorSource.test.mjs).
- App.jsx duplicate check: only the two known false positives (const chunks, const commit).
- Source scans prove the imports, handlers and CSS rules and the absence of stray edit calls; .jsx and .css cannot be compiled here.
- NOT verified here: build, lint, browser rendering, audio, IndexedDB and live network. The owner's vship run is the real check.

## Owner must test live (desktop Brave)
1. Open Reader → Edit clips: editor fits the panel height, tools above the waveform, transport below, only the list scrolls, chunk strip last and fully visible.
2. Scrub the ruler strip, drag the playhead handle, grab the line in the waveform; Go to start and Home both jump to 0.
3. Loop clips: a clip's play repeats between its cuts, the looping row is highlighted, and a cut change restarts the loop on the new range.
4. Fade in / Fade out and the All/Selected scope: select rows (click, Ctrl+click, Shift+click) and check the fades in the saved files.
5. Export without typing names: files named from the first words, cut-list.csv carries the same names, a typed name overrides it, duplicates become -2.
6. Clip row text: placeholder, hover title and the strip ("Clip N of M - chunk K") match the clip under the playhead.

## Known bugs and gaps
- Nothing in the clip editor has been tested live in Brave yet: export, fades, looping, playhead, clip text, names, zoom, scroll, playback.
- Clip text is approximate unless a cut lands on a pause (src/clipText.js falls back to a linear estimate and marks it).
- src/clipText.js is not imported by the app yet; its test import is the wiring proof.
- Names are not saved or restored with markers; a name is dropped when its clip is deleted (no name history).
- Arrow-key nudge and delete are not wired; marker clear is not wired.
- Zero-length clips are skipped in audio but still listed in cut-list.csv.
- A skipped-clip note or export failure hides the editor body (the message gate replaces the controls).
- Whole joined audio is capped at 900 s decoded; longer text must be edited one chunk at a time.
- Coral #ff6f6f is editor-only; the app-wide --accent is still teal. Touch has no grip-drag or selection-speaker equivalent.
- Older 0.1.x CHANGELOG formatting issues remain; src/phoneView.js and its test are dead code.

## Open decisions
- Reaction-time compensation and playhead offset values (owner tunes live).
- Whether #ff6f6f should become the app-wide --accent.
- Public access (each visitor needs an OpenRouter key) and request-cost warnings before the editor is announced.
- Touch equivalents, the single 768px breakpoint, CHANGELOG cleanup, deleting src/timeMap.js and src/phoneView.js, final app name, voice-list UI.
- Parked editor features: mixer, auto-suggest from pauses, typed cut times, Space for the main player.

## Next steps in order
1. Owner: vship (lint, build, tests), commit, check `git status --short` on the P75.
2. Work through the live list above in Brave; report anything that looks off.
3. Wire src/clipText.js into the editor (it is the only new module nothing imports).
4. Decide the open items, then the remaining phase-5/6 leftovers.

## Files not yet committed (check on the P75)
This session (mtime 2026-11-27): src/App.css, src/App.jsx, src/ClipEditor.jsx, src/clipExport.js, src/clipSlices.js, src/clipText.js, src/clipPlayer.js, tests/clipEditorSource.test.mjs, tests/clipExport.test.mjs, tests/clipSlices.test.mjs, tests/clipText.test.mjs, tests/clipPlayer.test.mjs, package.json, CHANGELOG.md, docs/backup-log.md, docs/clip-editor-handoff.md. docs/handoff.md (this file) is not staged by vship: git add it explicitly. Older pending files may still be uncommitted: src/audioCache.js, src/fileTypes.js, src/scheduler.js, their tests, tests/viteBase.test.mjs, tests/favicon.test.mjs, index.html, public/, vite.config.js, AGENTS.md.