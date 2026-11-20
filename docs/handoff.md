# Voice handoff

Date: 2026-11-21 (end of day). Owner: @Eleven. Plan: docs/plan.md. Rules: AGENTS.md.

## Version and git
- package.json: 0.2.2-beta. First CHANGELOG entry is 0.2.2-beta (matches).
- Sandbox has no .git; run `git -C ~/Work/Voice log --oneline -5` and `git status --short` on the P75.
- Backup counter in docs/backup-log.md is 14 (backup made at 0.1.93; 0.1.94-0.2.2 since). BACKUP DUE.
- CHANGELOG.md is malformed: no `# Changelog` heading anywhere; 0.1.101 appears twice; 0.1.102 sits after 0.1.96; 0.1.95 has no entry; 0.1.90-0.1.94 lack `-alpha`. Reported, not fixed (good-night rule).
- docs/codebase-map.md and docs/lessons.md do not exist.
- The previous handoff was stale at 0.2.0-beta; rewritten now.

## What was done (0.2.1-0.2.2)
- 0.2.1-beta: vite build base /voice/app/; Load and drop accept only .txt and .md.
- 0.2.2-beta: src/fileTypes.js textFileRejection rejects any other name with an exact reason, wired into the drop and Load paths before any side effect; IndexedDB open has a 5 s timeout and a blocked reason; scheduler logs cache read/write failures with chunk number and reason.

## Verified
- npm test: 250 pass, 0 fail (2026-11-21, 0.2.2-beta).
- node --check on changed .js files: OK. App.jsx not checkable here (JSX, no node_modules).
- Build and lint: NOT RUN here. Owner's vship is the real check.
- Live: nothing from 0.2.1-0.2.2 reported live yet.

## Owner must test live
1. App opens with no black screen, no red console errors.
2. Drop a .docx/.pdf/other file: exact rejection reason in notice and status bar; current session (player, cache, scheduler) untouched.
3. Load button: accept list is .txt,.md; a rejected name does not clear the text.
4. Serve dist/ from /voice/app/ and open it.
5. IndexedDB blocked or slow: exact reason in the status bar, no hang.
6. Cache read/write failure: exact reason with chunk number in the status bar log.
7. Normal reading, highlight, downloads still work.

## Known bugs
- None confirmed in code.
- Known gaps, not bugs: .docx/.pdf not parsed; no shortcuts beyond fullscreen; no request log or time heard/remaining in the Reader note.
- CHANGELOG.md malformed as above (docs bug, not code).

## Open decisions
- Whether to delete src/timeMap.js and its test once the owner is happy with alignMap.
- Whether the highlight needs tuning after a live listen.
- Final app name; voice list UI for Fish; whether short texts need a special mode; paid fallback model.
- Whether to fix CHANGELOG.md as a docs-only task.

## Next steps in order
1. Owner: vship (lint, build, tests), commit, check git status.
2. Work through the live test list above.
3. Backup (counter 14): make source backup, then tell Hermes "voice task: backup done, counter 0, label <x>, <date>".
4. Docs-only: fix CHANGELOG.md (heading, duplicate 0.1.101, order, missing 0.1.95, `-alpha` suffixes) and update the AGENTS.md versioning rule from `-alpha` to `-beta`.
5. Phase 5 leftovers: request log and time heard/remaining.
6. Phase 6: .docx/.pdf (mammoth, pdfjs-dist), playback shortcuts, README/app rename.

## Files changed this session (commit status to check on the P75)
src/App.jsx, src/audioCache.js, src/fileTypes.js, src/scheduler.js, tests/audioCache.test.mjs, tests/fileTypes.test.mjs, tests/scheduler.test.mjs, tests/viteBase.test.mjs, vite.config.js, package.json, CHANGELOG.md, docs/backup-log.md, docs/handoff.md (this file). Older pending files from the previous handoff may still be uncommitted; owner checks `git status --short`.
