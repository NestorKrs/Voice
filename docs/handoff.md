# Voice handoff

Date: 2026-11-09 (end of day). Owner: @Eleven. Plan: docs/plan.md. Rules: AGENTS.md.

## Version and git
- package.json: 0.1.89-alpha. CHANGELOG has entries 0.1.0 to 0.1.89, no gaps, `# Changelog` at line 1. First entry matches package.json.
- Commit status NOT confirmed: the sandbox has no .git, so run `git -C ~/Work/Voice log --oneline -5` and `git status --short` on the P75. Which of 0.1.79-0.1.89 are committed is not known here.
- Backup counter in docs/backup-log.md is 40 (BACKUP DUE, long overdue).
- docs/codebase-map.md and docs/lessons.md do not exist.

## What was done today
- 0.1.79: Job panel Pause and Cancel each take half the panel width.
- 0.1.80-0.1.81: Text panel find row (case-insensitive search, match count, Previous/Next, Enter/Shift+Enter/Esc, clear; the match is selected and scrolled to the middle, accent selection colour).
- 0.1.82-0.1.83: Settings Display card Font leading slider (1.0-2.5) for the text panel; it also drives the reading view line spacing.
- 0.1.84-0.1.85: Reader panel Downloads card with separator, labels "All chunks" / "All joined", tighter padding.
- 0.1.86-0.1.89: selection speaker icon. Select text (textarea or reading view) and an icon appears at the top-right corner of the selection; click reads it aloud with the current voice/provider, a second click stops; it hides on outside mousedown, Esc, scroll, text/provider/voice changes and after a press; main playback handlers stop it; a cache hit makes no request; "Requests today" refreshes at once (success, failure or cap error).
- Earlier today 0.1.65-0.1.78: Settings drawer redesign (cards, sticky header/footer, click-away save, slide animation, storage size), as recorded in the previous handoff.
- Unchanged throughout: the existing handlers, state and control behaviour; handleSaveSettings is still the only save path.

## Verified
- npm test in the sandbox after every step: 220 tests pass, 0 fail (last run 2026-11-09, 0.1.89).
- Build and lint: NOT RUN here (no node_modules or network). The owner's vship run is the real check.
- Live: the owner confirmed the speaker icon read-aloud and the counter symptom; the 0.1.88 position and 0.1.89 counter refresh are not yet reported live.

## Owner must test live
1. Select text in the textarea and in the reading view while playing: the icon appears at the top-right corner of the selection.
2. Click it: the selection reads aloud with the chosen voice and provider; a second press stops it; the main reading pauses and stays paused.
3. Press the same selection again: the status bar log shows a cache hit and "Requests today" does not go up.
4. A failed request still counts and shows.
5. The icon hides on outside mousedown, Esc, scrolling the Text panel, and after a press.
6. Earlier unreported live items: find row (typing, Previous/Next, Enter/Shift+Enter/Esc), Font leading slider while reading, Downloads card labels and padding, per-chunk downloads (Fish MP3/WAV, HeyGen WAV), ZIP opens and plays, joined MP3/WAV play start to end, cancel in the save dialog, reload keeps download format.

## Known bugs
- None confirmed in code. Known gaps, not bugs: .docx/.pdf not parsed; a .doc read as text is likely garbage; no shortcuts; no request log or time heard/remaining in the Job panel.

## Open decisions
- Final app name; voice list UI for Fish (HeyGen has 10); whether short texts need a special mode; paid fallback model; whether the weighted timing needs tuning after a live listen.
- Whether the X close and gear toggle should also auto-save (currently only click-away and the Save button save).

## Next steps in order
1. Owner: run build and lint (vship) and commit whatever of 0.1.79-0.1.89 is not yet committed; check `git status --short`.
2. Backup first: the counter is 40; make a source backup, then tell Hermes "voice task: backup done, counter 0, label <x>, <date>".
3. Live test list above.
4. Phase 5 leftovers: request log and time heard/remaining in the Job panel.
5. Phase 6: .docx/.pdf (mammoth, pdfjs-dist), playback shortcuts, README and app rename.

## Files changed this session (commit status to check on the P75)
src/App.jsx, src/App.css, src/selectionSpeech.js, tests/selectionSpeech.test.mjs, package.json, CHANGELOG.md, docs/backup-log.md, docs/handoff.md (this file), README.md. Older pending files from the previous handoff may still be uncommitted; owner checks `git status --short`.
