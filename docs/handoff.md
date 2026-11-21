# Voice handoff

Date: 2026-11-22 (end of day). Owner: @Eleven. Plan: docs/plan.md. Rules: AGENTS.md.

## Version and git
- package.json: 0.2.7-beta. First CHANGELOG entry is 0.2.7-beta (matches).
- Sandbox has no .git; run `git -C ~/Work/Voice log --oneline -5` and `git status --short` on the P75.
- Backup counter in docs/backup-log.md is 0 (backup made 2026-11-22 at 0.2.7-beta).
- CHANGELOG.md still has no `# Changelog` heading; older duplicate/order/suffix issues remain. Reported, not fixed (open decision).
- docs/codebase-map.md and docs/lessons.md do not exist.

## What was done (0.2.4-0.2.7)
- 0.2.4-beta: phone layout under 768px in one `@media (max-width: 768px)` block at the end of src/App.css: panels stack vertically, top bar/player bar/find row wrap, tap targets 44px, drawer full width, fullscreen text-panel overrides. The only App.jsx change was adding `className="start-btn"` to the Start Reading button.
- 0.2.5-beta: Text panel `flex: 0 0 100%` with `min-height: 260px`; Reader `min-height: 50dvh` below it (reached by scrolling inside `.columns`); find row on one line; stats line hidden; Start Reading and the three icons on one nowrap row at 40px; two-row top bar; volume and speed sliders equal width.
- 0.2.6-beta: hid the text-row spacer span; provider select forced onto the second top-bar row.
- 0.2.7-beta: top bar became a three-column grid with explicit rows (title/version, pill left + cogwheel right, provider dropdown, reason); player notice span hidden on mobile; both slider labels 40px.
- Each step kept lines 1-194 of src/App.css byte-for-byte and added no second `@media` block.

## Verified
- npm test: 252 pass, 0 fail (2026-11-22, 0.2.7-beta).
- All changes since 0.2.3 are CSS inside the media block; `diff <(head -194 before) <(head -194 src/App.css)` printed nothing each time, so no node --check or App.jsx duplicate check was needed.
- Build and lint: NOT RUN here. Owner's vship is the real check.
- Live: nothing from 0.2.4-0.2.7 tested live yet.

## Owner must test live
1. At 450px and 360px, portrait and landscape: nothing scrolls sideways.
2. Text panel fills above the player bar; the reader appears only after scrolling down.
3. Find input, count and up/down arrows on one line.
4. No stats line; the disabled reason under Start Reading still shows.
5. Start Reading and the three icon buttons on one row.
6. Top bar: title+version / requests pill left and cogwheel right / provider dropdown; the cogwheel is clearly visible.
7. Player bar: two rows, no gap beside the speed slider, volume and speed take equal space, no notice text.
8. Settings drawer fits and Save settings stays visible.
9. Fullscreen toggle and exit work.
10. Desktop looks exactly as before; normal reading, highlight and downloads still work.

## Known bugs
- None confirmed in code.
- Touch gaps: panel reorder uses HTML5 drag-and-drop (no touch path); the selection speaker depends on mouseup (touch selection is unreliable).
- Single breakpoint (768px); widths between 769px and desktop are unchanged.
- Non-bugs/gaps: .docx/.pdf not parsed; no shortcuts beyond fullscreen; CHANGELOG formatting issues above.

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
src/App.css, src/App.jsx, package.json, CHANGELOG.md, docs/backup-log.md, docs/handoff.md (this file), README.md. Older pending files from earlier sessions may still be uncommitted: src/audioCache.js, src/fileTypes.js, src/scheduler.js, tests/audioCache.test.mjs, tests/fileTypes.test.mjs, tests/scheduler.test.mjs, tests/viteBase.test.mjs, tests/favicon.test.mjs, index.html, public/, vite.config.js, AGENTS.md. Owner checks `git status --short`.
