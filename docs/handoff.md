# Voice handoff

Date: 2026-11-09 (end of day). Owner: @Eleven. Plan: docs/plan.md. Rules: AGENTS.md.

## Version and git
- package.json: 0.2.0-beta. First CHANGELOG entry is 0.2.0-beta (matches). Project moved from alpha to beta.
- Sandbox has no .git; run `git -C ~/Work/Voice log --oneline -5` and `git status --short` on the P75.
- Backup counter in docs/backup-log.md is 12 (backup made at 0.1.93; 0.1.94-0.2.0 since).
- CHANGELOG.md is malformed: `# Changelog` sits at line 28, not line 1; 0.1.95 has no entry; 0.1.101 appears twice with different text; 0.1.90-0.1.94 lack `-alpha`. Reported, not fixed (good-night rule).
- docs/codebase-map.md and docs/lessons.md do not exist.

## What was done (0.1.96-0.2.0)
- 0.2.0-beta: project moves from alpha to beta testing; version and README status updated, version test now asserts -beta.
- 0.1.96: highlight map retries failed maps and logs the real reason.
- 0.1.97-0.1.98: top bar "Requests today" teal pill, "(estimate)" removed; selected-char count moved to status bar.
- 0.1.99: reader chunk rows get per-chunk progress bar and Pause/Resume/Cancel icons on the active row.
- 0.1.100-0.1.101: Reader pane .job-note strip for errors/paused/cap state; Job panel removed, those live in the Reader note.
- 0.1.102-0.1.105: Text panel fullscreen (Ctrl+Shift+Space): toggle next to Clear, capture-phase handler accepting event.code Space, only textarea visible, floating exit button top-right; status bar logs 'Text fullscreen on/off'. Reader/player/status/settings hidden while on.

## Verified
- npm test: 243 pass, 0 fail (2026-11-09, 0.2.0-beta).
- node --check on changed .js files: OK. App.jsx not checkable here (JSX, no node_modules).
- Build and lint: NOT RUN here. Owner's vship is the real check.
- Live: nothing from 0.1.96-0.1.105 reported live yet.

## Owner must test live
1. App opens with no black screen, no red console errors.
2. Text fullscreen: Ctrl+Shift+Space toggles; only textarea stays visible; exit button closes it; status bar logs on/off; Reader/player/status/settings hidden while on.
3. Reader chunk rows: progress bar and Pause/Resume/Cancel icons on the active row.
4. Job note shows errors/paused/cap state; no Job panel.
5. Highlight map retry + real reason log line.

## Known bugs
- None confirmed in code.
- Known gaps, not bugs: .docx/.pdf not parsed; .doc read as text is likely garbage; no shortcuts beyond fullscreen; no request log or time heard/remaining in Job note.
- CHANGELOG.md malformed as above (docs bug, not code).

## Open decisions
- Whether to delete src/timeMap.js and its test once the owner is happy with alignMap.
- Whether the highlight needs tuning after a live listen.
- Final app name; voice list UI for Fish; whether short texts need a special mode; paid fallback model.

## Next steps in order
1. Owner: vship (lint, build, tests), commit, check git status.
2. Work through the live test list above.
3. Update the AGENTS.md versioning rule from `-alpha` to `-beta` (it still says `-alpha`).
4. Fix CHANGELOG.md (move `# Changelog` to line 1, insert missing 0.1.95, drop the duplicate 0.1.101, add `-alpha` to 0.1.90-0.1.94) as a docs-only task.
5. Backup when the counter reaches 3 (it is 12): make source backup, then tell Hermes "voice task: backup done, counter 0, label <x>, <date>".
6. Phase 5 leftovers: request log and time heard/remaining.
7. Phase 6: .docx/.pdf (mammoth, pdfjs-dist), playback shortcuts, README/app rename.

## Files changed this session (commit status to check on the P75)
src/App.jsx, src/App.css, src/panelWidths.js, src/panelLayout.js, tests/panelLayout.test.mjs, tests/panelWidths.test.mjs, tests/version.test.mjs, package.json, README.md, CHANGELOG.md, docs/backup-log.md, docs/handoff.md (this file). Older pending files from the previous handoff may still be uncommitted; owner checks `git status --short`.