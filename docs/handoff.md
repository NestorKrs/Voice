# Voice handoff

Date: 2026-11-22 (end of day). Owner: @Eleven. Plan: docs/plan.md. Rules: AGENTS.md.

## Version and git
- package.json: 0.2.17-beta. First CHANGELOG entry is 0.2.17-beta (matches).
- Sandbox has no .git; run `git -C ~/Work/Voice log --oneline -5` and `git status --short` on the P75.
- Backup counter in docs/backup-log.md is 0 (backup made 2026-11-22 at v0.2.17-beta).
- CHANGELOG.md has `# Changelog` heading at line 1, versions in descending order, alpha suffixes fixed, duplicates removed.
- docs/codebase-map.md and docs/lessons.md do not exist.

## What was done this session (0.2.13 → 0.2.17)
- 0.2.13-beta: Phone errors visible — status bar shows while a failure reason is set, room reserved only then.
- 0.2.14-beta: Fix undeclared setStatus in handleReadSelection — four failure/info calls replaced with setNotice + logEvent so selection read errors show in player-bar notice and status bar log instead of throwing ReferenceError.
- 0.2.15-beta: Mobile — player seek 2/3 width, speed slider 1/3 width on same row; speed label (0.75x/1x/1.25x) hidden; text panel horizontal padding reduced from 14px to 8px.
- 0.2.16-beta: Mobile — player seek and speed both full width on two rows (reverted in next step).
- 0.2.17-beta: Mobile — player seek 2/3 width, speed slider 1/3 width on same row (corrected).
- Docs repair: CHANGELOG.md restructured (heading to line 1, version order fixed, 0.1.86–0.1.94 gained -alpha, duplicate 0.1.101 renamed to 0.1.95, 0.1.102 moved between 0.1.103/0.1.101); AGENTS.md versioning line changed to MAJOR.MINOR.PATCH-beta with note "The project moved from alpha to beta at 0.2.0"; README.md five feature lines added (find in text, font leading + spell check, highlight mode, provider switch, phone layout highlight/selection speaker off).
- Backup done: counter reset to 0, row for v0.2.17-beta added.

## Verified
- npm test: 259 pass, 0 fail (2026-11-22, 0.2.17-beta).
- All App.jsx changes: setStatus → setNotice + logEvent at four call sites; wiring proof: setNotice declared at line 278, used at 1228, 1241, 1249, 1253; grep for setStatus now returns nothing.
- Duplicate check: const chunks, const commit (pre-existing, expected).
- CHANGELOG: grep -c "^# Changelog" = 1; grep -n "^## " shows descending order 0.2.17 → 0.1.0 with no gaps or duplicates.
- App.jsx node --check: not run (.jsx); owner's vship build is the real check.
- Build and lint: NOT RUN here. Owner's vship is the real check.
- Live: nothing from 0.2.13–0.2.17 tested live yet.

## Owner must test live
1. Select some text, press speaker icon — read works; with deliberately wrong API key the failure appears in player-bar notice and status bar log instead of nothing.
2. Mobile viewport ≤768px: player seek bar ~66%, speed slider ~33% on same row; no speed label text (0.75x/1x/1.25x).
3. Mobile: text panel frames slimmer (horizontal padding 8px vs 14px).
4. Desktop: normal reading, highlight, downloads, selection speaker, fullscreen all still work.
5. CHANGELOG formatting: open file and verify heading at line 1, versions descending, -alpha suffixes on 0.1.86–0.1.94, no duplicate 0.1.101, 0.1.102 between 0.1.103/0.1.101.

## Known bugs
- None confirmed in code.
- Touch gaps: panel reorder uses HTML5 drag-and-drop (no touch path); selection speaker depends on mouseup (touch selection unreliable).
- Single breakpoint (768px); widths between 769px and desktop unchanged.
- Non-bugs/gaps: .docx/.pdf not parsed; no shortcuts beyond fullscreen.

## Open decisions
- Whether to add touch equivalents for the grip drag and the selection speaker.
- Whether 768px stays the only breakpoint.
- Whether to delete src/timeMap.js and its test once the owner is happy with alignMap.
- Final app name; voice list UI for Fish; paid fallback model; short-text mode.

## Next steps in order
1. Owner: vship (lint, build, tests), commit, check `git status --short` on the P75.
2. Work through the live test list above (items 1–5).
3. Decide on touch equivalents (grip drag, selection speaker).
4. Phase 5 leftovers: request log and time heard/remaining.
5. Phase 6: .docx/.pdf parsing, playback shortcuts, README/app rename.

## Files changed this session (commit status to check on the P75)
src/App.jsx, src/App.css, package.json, CHANGELOG.md, docs/backup-log.md, docs/handoff.md (this file), AGENTS.md, README.md. Older pending files from earlier sessions may still be uncommitted: src/audioCache.js, src/fileTypes.js, src/scheduler.js, tests/audioCache.test.mjs, tests/fileTypes.test.mjs, tests/scheduler.test.mjs, tests/viteBase.test.mjs, tests/favicon.test.mjs, index.html, public/, vite.config.js. Owner checks `git status --short`.