# Voice handoff

Date: 2026-11-26 (end of day). Owner: @Eleven. Plan: docs/plan.md. Rules: AGENTS.md. Feature detail: docs/clip-editor-handoff.md.

## Version and git
- package.json: 0.2.54-beta. First CHANGELOG entry is 0.2.54-beta (matches). No skipped version found.
- Sandbox has no .git; on the P75 run `git -C ~/Work/Voice log --oneline -5` and `git status --short`.
- Backup counter in docs/backup-log.md is 0 (backup made 2026-11-26 at 0.2.54-beta).
- CHANGELOG.md has one `# Changelog` heading; older 0.1.x duplicates/order/suffix issues remain (open decision).
- docs/codebase-map.md and docs/lessons.md do not exist.

## What was done this session (0.2.49 → 0.2.54)
- 0.2.49-beta: Shift-held snapping for slice click, M key, marker drag and hover line; coral markers later replaced the orange.
- 0.2.50-beta: clip list with per-clip play/pause and editable names; src/clipNames.js was created after a stale STOP anchor; names follow their clip when cuts change.
- 0.2.51-beta: list polish — button-only highlight, first-sentence placeholders, roomier rows, no timeline end numbers, playbar-style transport button.
- 0.2.52-beta: shortcut hint and restore note in one row above the bottom separator; taller list; wider name inputs.
- 0.2.53-beta: editor opening takes two thirds of the width via CSS, coral markers, blade tool, play/timer on the zoom row.
- 0.2.54-beta: zoom/blade/undo centred, helper text dim teal without a highlight, one more list row, close button identical to Settings.
- New pure modules this session: src/clipNames.js with tests/clipNames.test.mjs (realignNames, firstSentence).

## Verified
- npm test: 410 pass, 0 fail (2026-11-26, 0.2.54-beta). Full raw run was pasted in the last task report.
- node --check clean on src/clipNames.js, tests/clipNames.test.mjs, tests/clipEditorSource.test.mjs.
- App.jsx duplicate check: only the two known false positives (const chunks, const commit).
- Source scans prove the imports, handlers, CSS rules and absence of stray edit calls; .jsx and .css cannot be compiled here.
- NOT verified here: build, lint, browser rendering, audio, IndexedDB and live network. The owner's vship run is the real check.

## Owner must test live (desktop Brave)
1. Open Reader → Edit clips: Reader takes two thirds, Text one third; X restores the previous widths.
2. Shift+slice, Shift+M and Shift+drag land in a quiet gap; without Shift nothing snaps; hover line follows the snapped position.
3. Each row's play button plays only that clip, stops at its end, and pauses on a second press; the current row button highlights.
4. Type a name, add a cut before it: the name stays with the right clip; delete merge and undo keep names aligned; Space in a field types a space.
5. Placeholders show the cut's first sentence; zoom/blade/undo are centred; the × close matches Settings; helper text is dim teal; list shows one more row.
6. Marker drag, saved markers, per-clip playback and the two-thirds layout all still need a live pass; report the snap radius if 80 ms feels wrong.

## Known bugs and gaps
- No export yet; names are not saved or restored with markers; deleting a cut drops its name (no name history).
- Arrow-key nudge and delete are not wired; src/clipCsv.js and src/clipSlices.js are tested but not wired to export.
- Whole joined audio is capped at 900 s decoded (.txt/.md only); touch has no grip-drag or selection-speaker equivalent.
- Older 0.1.x CHANGELOG formatting issues remain; src/phoneView.js and its test are dead code.

## Open decisions
- Reaction-time compensation and playhead offset values (owner tunes live); snap radius if 80 ms feels wrong.
- Whether #ff6f6f should become the app-wide --accent (currently teal) or stay on editor markers only.
- Public access and request-cost warnings before announcing the editor.
- Touch equivalents, the single 768px breakpoint, CHANGELOG cleanup, deleting src/timeMap.js, final app name and voice-list UI.

## Next steps in order
1. Owner: vship (lint, build, tests), commit, check `git status --short` on the P75.
2. Work through the live list above in Brave; report anything that looks off.
3. Task E7/E8: per-clip download, ZIP export, fades toggle, cut-list CSV using the existing pure modules.
4. Decide the open items, then the remaining phase-5/6 leftovers.

## Files not yet committed (check on the P75)
This session (mtime 2026-11-26): src/App.css, src/App.jsx, src/ClipEditor.jsx, src/clipNames.js, tests/clipEditorSource.test.mjs, tests/clipNames.test.mjs, package.json, CHANGELOG.md, docs/backup-log.md, docs/clip-editor-handoff.md. docs/handoff.md (this file) is not staged by vship: git add it explicitly. Older pending files may still be uncommitted: src/audioCache.js, src/fileTypes.js, src/scheduler.js, their tests, tests/viteBase.test.mjs, tests/favicon.test.mjs, index.html, public/, vite.config.js, AGENTS.md.
