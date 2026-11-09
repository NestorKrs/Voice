# Voice handoff

Date: 2026-11-09 (end of day). Owner: @Eleven. Plan: docs/plan.md. Rules: AGENTS.md.

## Version and git
- package.json: 0.1.95-alpha. CHANGELOG has entries 0.1.0 to 0.1.95, no gaps, `# Changelog` at line 1, first entry matches package.json.
- Commit status NOT confirmed: the sandbox has no .git, so run `git -C ~/Work/Voice log --oneline -5` and `git status --short` on the P75. Which of 0.1.90-0.1.95 are committed is not known here.
- Backup counter in docs/backup-log.md is 2 (a backup was made at 0.1.93, label highlight-map; 0.1.94 and 0.1.95 are the two changes since).
- docs/codebase-map.md and docs/lessons.md do not exist.

## What was done today
- 0.1.90: src/silenceMap.js, findSilences. Decodes nothing itself: it takes mono samples, splits them into 10 ms frames, and returns the runs of frames below a threshold relative to the 90th percentile of frame RMS (`{ silences, leadIn, tail, duration }`). Silence at the very start and end is reported as leadIn/tail, not as a pause.
- 0.1.91: src/timeMap.js, buildTimeMap. Maps playback time to a character index by pairing the n-1 longest silences with the n-1 sentence ranges. Superseded by alignMap; still exported and tested, no longer used by App.jsx.
- 0.1.92: the highlight map is wired into src/App.jsx. buildChunkMap(index) reads the chunk's bytes from the audio cache (never a request), decodes them, mixes the channels to mono, finds the silences, builds the map and stores it in mapRef keyed by chunk index. The reading view polls the player and uses the map when it is ready, else the old position/duration estimate. Added sentenceRanges(text) to src/highlight.js (shared splitter with highlightRange, whose results are unchanged).
- 0.1.93: the trigger moved from the scheduler playhead effect (gated by playheadToSend, which is null during normal cached playback) to a player effect on reading + chunk index + status; the cache-miss path now logs.
- 0.1.93 fix: that effect put `reading` (a const declared later in the component body) in its dependency array, so the array was evaluated in the temporal dead zone and the whole App crashed with a black screen. The effect now computes the condition inline from playerState. Found by the owner, fixed the same day, not yet confirmed live.
- 0.1.94: src/alignMap.js, alignTimeMap. Dynamic programming over (break, silence) pairs: a break may be skipped (cost SKIP_SENTENCE/SKIP_CLAUSE) and a matched long pause earns a bonus, so one wrong pause no longer shifts every later break. Returns `{ ok, reason, anchors, breaks, silences, timeToIndex }`.
- 0.1.95: src/App.jsx uses alignTimeMap instead of buildTimeMap. The map entry now also stores mapDuration (the decoded audio length) and the loop scales s.position by mapDuration / s.duration before the lookup, which corrects the small length difference between the decoded audio and the player. Log lines read "aligned X of Y breaks, Z pauses", all with index + 1.
- Unchanged throughout: the existing handlers, state and control behaviour; handleSaveSettings is still the only save path; the estimate branch of the highlight loop is byte for byte what it was.

## Verified
- npm test in the sandbox after every step: 252 tests pass, 0 fail (last run 2026-11-09, 0.1.95).
- node --check on the changed .js files (src/highlight.js, src/silenceMap.js, src/timeMap.js, src/alignMap.js): all OK. App.jsx cannot be checked here (JSX, no node_modules).
- Build and lint: NOT RUN here (no node_modules or network). The owner's vship run is the real check.
- Live: nothing from 0.1.90-0.1.95 has been reported live yet. The owner did report the 0.1.92 log symptom (no "Highlight map" line at all) and the 0.1.93 black screen; both were diagnosed and fixed in code.

## Owner must test live
1. The app opens with no black screen, and the browser console has no red error.
2. Play HeyGen in Words mode and in Sentences mode; then Fish in both modes.
3. For each chunk the status bar log says "Highlight map chunk N: aligned X of Y breaks, Z pauses" or "estimated (reason)". Note the number is index + 1, while "Player: chunk N playing" prints the raw zero-based index, so the two differ by one for the same chunk.
4. The highlight no longer lags 4 to 12 words and no longer rushes ahead of the voice; it waits through the pauses.
5. Jump to another chunk and back: the highlight stays right.
6. A chunk that is not cached yet still highlights with the old estimate and logs "no cached audio yet (estimated)".
7. Selecting text while playing still works and the speaker icon still reads the selection.
8. Changing provider or voice mid-read drops the old maps (no stale highlight).

## Known bugs
- None confirmed in code. The 0.1.93 black screen was real and is fixed in code but not yet confirmed live.
- Known gaps, not bugs: .docx/.pdf not parsed; a .doc read as text is likely garbage; no shortcuts; no request log or time heard/remaining in the Job panel.
- src/timeMap.js is now dead code in the app (only its tests use it). Not deleted, to keep the change additive.

## Open decisions
- Whether to delete src/timeMap.js and its test once the owner is happy with alignMap.
- Whether the highlight needs tuning after a live listen (MAP_WORD_LEAD is 0 and there is no sentence delay in the map branch).
- Final app name; voice list UI for Fish (HeyGen has 10); whether short texts need a special mode; paid fallback model.
- Whether the X close and gear toggle should also auto-save (currently only click-away and the Save button save).

## Next steps in order
1. Owner: run vship (lint, build, tests) and commit 0.1.90-0.1.95; check `git status --short`.
2. Work through the live test list above.
3. Backup when the counter reaches 3 (it is 2): make the source backup, then tell Hermes "voice task: backup done, counter 0, label <x>, <date>".
4. Phase 5 leftovers: request log and time heard/remaining in the Job panel.
5. Phase 6: .docx/.pdf (mammoth, pdfjs-dist), playback shortcuts, README and app rename.

## Files changed this session (commit status to check on the P75)
src/App.jsx, src/highlight.js, src/silenceMap.js, src/timeMap.js, src/alignMap.js, tests/highlight.test.mjs, tests/silenceMap.test.mjs, tests/timeMap.test.mjs, tests/alignMap.test.mjs, package.json, CHANGELOG.md, docs/backup-log.md, docs/handoff.md (this file), README.md. Older pending files from the previous handoff may still be uncommitted; owner checks `git status --short`.
