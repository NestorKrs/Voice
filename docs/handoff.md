# Voice handoff

Date: 2026-11-09 (end of day). Owner: @Eleven. Plan: docs/plan.md. Rules: AGENTS.md.

## Version and git
- package.json: 0.1.78-alpha. CHANGELOG has entries 0.1.0 to 0.1.78, no gaps (0.1.65-0.1.78 added today), `# Changelog` at line 1. First entry matches package.json.
- Commit status NOT confirmed: the sandbox has no .git, so run `git -C ~/Work/Voice log --oneline -5` and `git status --short` on the P75. The owner ran vship/live checks during the day; which of 0.1.65-0.1.78 are committed is not known here.
- Backup counter in docs/backup-log.md is 29 (BACKUP DUE, long overdue).
- docs/codebase-map.md and docs/lessons.md do not exist.

## What was done today (Settings drawer redesign, in small steps)
- 0.1.65: drawer controls grouped into cards (Connection, Voice, Reading, Display, Downloads, Storage & layout), sticky header with X close, sticky Save settings footer, 400px wide, --danger for destructive buttons.
- 0.1.66-0.1.74: removed helper/status texts card by card; API key field full-width; Save/Clear key half and half with no divider; Display controls aligned at 144px; label renamed to Download format; storage buttons equal width.
- 0.1.75: all drawer buttons share the Save/Clear key hover; clicking outside the drawer (e.g. into the text) closes it and runs the existing Save settings handler (X and gear toggle close without saving).
- 0.1.76: drawer slides in from the right on the cogwheel (0.3s) and out to the right on close.
- 0.1.77: Storage title shows the live cache size in parentheses; Save settings also closes the drawer; slide-out 0.5s, slide-in 0.3s.
- 0.1.78: size in the title back to two decimals (e.g. STORAGE (123.04 MB) & LAYOUT); the duplicate size under Audio cache removed.
- Unchanged throughout: every handler, state and control behaviour; handleSaveSettings at App.jsx:409 still the only save path.

## Verified
- npm test in the sandbox after every step: 201 tests pass, 0 fail (last run 2026-11-09, 0.1.78).
- Build and lint: NOT RUN here (no node_modules or network). The owner's vship run is the real check.
- Live: the owner saw and approved each visual step on the P75 as it went (0.1.65-0.1.77 behaviour confirmed by their replies); 0.1.78 title/size not yet reported live.

## Owner must test live
1. Slide: cogwheel slides the drawer in (0.3s); X, gear, click-away and Save settings slide it out (0.5s); Save settings saves and survives a reload.
2. Click into the text with the drawer open: it closes and saves; clicking inside the drawer does not close it.
3. Storage title: size updates when the drawer opens and after Clear audio cache.
4. Earlier unreported live items: per-chunk downloads (Fish MP3/WAV, HeyGen WAV), ZIP opens and plays, joined MP3/WAV play start to end, cancel in the save dialog, reload keeps download format.

## Known bugs
- None confirmed in code. Known gaps, not bugs: .docx/.pdf not parsed; a .doc read as text is likely garbage; no shortcuts; no request log or time heard/remaining in the Job panel.

## Open decisions
- Final app name; voice list UI for Fish (HeyGen has 10); whether short texts need a special mode; paid fallback model; whether the weighted timing needs tuning after a live listen.
- Whether the X close and gear toggle should also auto-save (currently only click-away and the Save button save).

## Next steps in order
1. Owner: run build and lint (vship) and commit whatever of 0.1.65-0.1.78 is not yet committed; check `git status --short`.
2. Backup first: the counter is 29; make a source backup, then tell Hermes "voice task: backup done, counter 0, label <x>, <date>".
3. Live test list above.
4. Phase 5 leftovers: request log and time heard/remaining in the Job panel.
5. Phase 6: .docx/.pdf (mammoth, pdfjs-dist), playback shortcuts, README and app rename.

## Files changed this session (commit status to check on the P75)
src/App.jsx, src/App.css, package.json, CHANGELOG.md, docs/backup-log.md, docs/handoff.md (this file). Older pending files from the previous handoff may still be uncommitted; owner checks `git status --short`.
