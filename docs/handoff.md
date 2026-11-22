# Voice handoff

Date: 2026-11-22 (end of day). Owner: @Eleven. Plan: docs/plan.md. Rules: AGENTS.md.

## Version and git
- package.json: 0.2.19-beta. First CHANGELOG entry is 0.2.19-beta (matches).
- Sandbox has no .git; run `git -C ~/Work/Voice log --oneline -5` and `git status --short` on the P75.
- Backup counter in docs/backup-log.md is 0 (backup made 2026-11-22 at 0.2.19-beta).
- CHANGELOG.md has `# Changelog` heading; older duplicate/order/suffix issues remain for 0.1.x versions. Reported, not fixed (open decision).
- docs/codebase-map.md and docs/lessons.md do not exist.

## What was done this session (0.2.12 → 0.2.19)
- 0.2.12-beta: lint cleanup only — three no-unused-expressions warnings in App.jsx rewritten.
- 0.2.13-beta: phone errors visible — status bar shows on phone when jobError, schedState.error or chunkNotes are non-empty; `.app:has(.statusbar.err)` reserves space only then.
- 0.2.14-beta: (skipped, setStatus bug fix was a separate task)
- 0.2.15-beta: (skipped, stale audio after Save Settings — existing effect already resets player/mapRef)
- 0.2.16-beta: (skipped, free-model guard test — tests/providers.test.mjs added)
- 0.2.17-beta: highlight back on phones — removed phone-only `isPhoneView()` override, uses saved `settings.highlightMode`.
- 0.2.18-beta: player buttons equal width on mobile (4 columns).
- 0.2.19-beta: settings drawer mobile layout — full-width inputs, wrapped rows, equal buttons, proper footer; player seek 75%, speed 25% (3:1 ratio via 4-column grid).

All CSS changes are inside the single `@media (max-width: 768px)` block at the end of src/App.css; desktop rules unchanged. The `.mobile-only { display: none; }` rule sits outside the block and is overridden inside it. src/phoneView.js and its test remain in the tree as dead code.

## Verified
- npm test: 259 pass, 0 fail (2026-11-22, 0.2.19-beta).
- All App.jsx changes passed the duplicate check (const chunks, const commit — known false positives).
- Build and lint: NOT RUN here. Owner's vship is the real check.
- Live: nothing from 0.2.12-0.2.19 tested live yet.

## Owner must test live
1. At 450px and 360px, portrait and landscape: nothing scrolls sideways.
2. Text panel fills above the player bar; the reader appears only after scrolling down.
3. No find row, no TEXT label, no speaker icon, no status bar line (unless error).
4. Player: two rows — four equal buttons on row 1; seek (75%) and speed (25%) on row 2, side by side, no overlap.
5. Start Reading is a circular talking icon at far left; Load/Clear/Fullscreen icons at far right.
5. Top bar: title+version / requests pill left and cogwheel right / provider dropdown / provider reason.
6. Settings drawer: full-width inputs, wrapped label+control rows, Save key/Clear key buttons equal width, Save settings full width at bottom.
7. Errors: type wrong API key, press Start — status bar appears with message; clears when fixed.
8. Highlight: on phone with Words/Sentences selected, highlight moves with voice; desktop unchanged.
9. Desktop looks exactly as before; normal reading, highlight, downloads still work.

## Known bugs
- None confirmed in code.
- Touch gaps: panel reorder uses HTML5 drag-and-drop (no touch path); the selection speaker depends on mouseup (touch selection unreliable).
- Single breakpoint (768px); widths between 769px and desktop are unchanged.
- Non-bugs/gaps: .docx/.pdf not parsed; no shortcuts beyond fullscreen; CHANGELOG formatting issues for 0.1.x versions.

## Open decisions
- Whether to add touch equivalents for the grip drag and the selection speaker.
- Whether 768px stays the only breakpoint.
- Whether to fix CHANGELOG.md (heading, duplicates, order, suffixes) as a docs-only task.
- Whether to delete src/timeMap.js and its test once the owner is happy with alignMap.
- Final app name; voice list UI for Fish; paid fallback model; short-text mode.

## Next steps in order
1. Owner: vship (lint, build, tests), commit, check `git status --short` on the P75.
2. Work through the live test list at 450px and 360px.
3. Decide on touch equivalents (grip drag, selection speaker).
4. Docs-only: fix CHANGELOG.md and review the AGENTS.md versioning wording.
5. Phase 5 leftovers: request log and time heard/remaining.
6. Phase 6: .docx/.pdf parsing, playback shortcuts, README/app rename.

## Files changed this session (commit status to check on the P75)
src/App.css, src/App.jsx, package.json, CHANGELOG.md, docs/backup-log.md, docs/handoff.md (this file), tests/providers.test.mjs. Older pending files from earlier sessions may still be uncommitted: src/audioCache.js, src/fileTypes.js, src/scheduler.js, tests/audioCache.test.mjs, tests/fileTypes.test.mjs, tests/scheduler.test.mjs, tests/viteBase.test.mjs, tests/favicon.test.mjs, index.html, public/, vite.config.js, AGENTS.md. Owner checks `git status --short`.