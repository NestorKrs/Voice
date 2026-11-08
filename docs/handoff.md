# Voice handoff

Date: 2026-11-08 (end of day). Owner: @Eleven. Plan: docs/plan.md. Rules: AGENTS.md.

## Version and git
- package.json: 0.1.48-alpha. CHANGELOG has an entry for it dated 2026-11-08. Commit status NOT confirmed: the sandbox has no .git, so run `git -C ~/Work/Voice log --oneline -5` and `git status --short`.
- CHANGELOG issues (not fixed): 0.1.41 is missing (0.1.40 then 0.1.42) and the `# Changelog` heading sits mid-file between 0.1.30 and 0.1.29.
- Backup counter in docs/backup-log.md is 31 (BACKUP DUE).
- docs/codebase-map.md and docs/lessons.md do not exist yet.

## What exists (all unit tested with mocks)
- textPipeline (clean, chunk; packs paragraphs up to 2000 chars), speechClient (one retry on 429-other or 5xx, never 4xx, daily-cap detection), audioCache (IndexedDB + memory store, bytes in and out), requestCounter (UTC day), settingsStore (settings, key, text in localStorage), textStats, providers (Fish + HeyGen built in, owner-added free models from localStorage, no UI to add them yet), audioFormat (PCM to WAV, audio type from bytes).
- scheduler (window = playhead + lookahead, cap pause, resume, retryChunk, cancel), followPlayback (ready flags, newly ready, playhead to send), playerCore (reducer, RATES 0.75/1/1.25/1.5/2, activeRowIndex, estimateTimes), playerEngine (two HTMLAudio slots, preloads the next chunk, preservesPitch), panelLayout, panelWidths, wiring (the only file that imports readKey).
- App.jsx (761 lines, one component): top bar with provider select and Requests today; Text / Reader / Job panels (drag to reorder, drag handles to resize, order and widths saved); bottom player bar (prev/play/stop/next, seek, volume, speed); Settings drawer (key, voice, chunk size, lookahead, daily limit 50/1000, font weight, reset layout, cache size and clear); status bar with a 20-line event log (click to expand); window error handlers.
- Playback is HTMLAudioElement slots, NOT Web Audio. Start Reading fills the lookahead window; the player plays from cache; the scheduler follows the playhead (0.1.48).
- File loading: drop or the Load button reads .txt/.md/.doc as plain text (readAsText). No .docx/.pdf parsing, no Download, no playback shortcuts, no Diagnostics overlay (the status bar log replaces it).

## Verified
- npm test in the sandbox: 136 tests pass, 0 fail (2026-11-08).
- Build and lint: NOT RUN here (no node_modules or network). The owner's vship run is the real check.
- Live: no live results for 0.1.44 to 0.1.48 were pasted to Hermes. Treat live behavior as unverified.

## Owner must test live
1. Paste a long text, Start Reading, press play in the player bar: chunks play in order, the Reader row highlights, generation follows the playhead.
2. Switch provider (Fish to HeyGen): audio resets, the voice list changes, Start Reading works with the new provider.
3. Drop a .txt file: cache clears, text loads, Start Reading works.
4. Reload the page: text and settings come back; press Start Reading again and confirm cached chunks are ready with no new requests.
5. Hit the daily cap: state shows Waiting for daily reset, audio is kept, Resume works after the reset.
6. Listen at 1.5x and 2x for pitch and for gaps between chunks.

## Known bugs
- None confirmed in code (no TODO/FIXME markers). Known gaps, not bugs: .docx/.pdf not parsed; a .doc read as text is likely garbage; no Download; no shortcuts; no request log or time heard/remaining in the Job panel.

## Open decisions
- Final app name; voice list UI for Fish (no voice list yet, HeyGen has 10); whether short texts need a special mode; paid fallback model; download format (joined mp3 vs ZIP).

## Next steps in order
1. Owner: run build and lint on 0.1.48 and paste the output; commit if not committed.
2. Live test list above.
3. Backup: the counter is 31, make a source backup, then tell Hermes "voice task: backup done, counter 0, label <x>, <date>".
4. Phase 5 leftovers: request log and time heard/remaining in the Job panel; decide whether reload needs Start Reading again or a real resume.
5. Phase 6: .docx/.pdf (mammoth, pdfjs-dist), Download (joined mp3 vs ZIP), playback shortcuts, README and app rename.

## Files not yet committed
Unknown from the sandbox (no .git). Expected: src/*, tests/*, package.json, package-lock.json, CHANGELOG.md, README.md, AGENTS.md, docs/*.md. Owner checks `git status --short`.
