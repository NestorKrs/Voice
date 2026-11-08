# Voice handoff

Date: 2026-11-08 (end of day). Owner: @Eleven. Plan: docs/plan.md. Rules: AGENTS.md.

## Version and git
- package.json: 0.1.51-alpha. CHANGELOG has entries for 0.1.50-alpha and 0.1.51-alpha (both 2026-11-08); 52 entries from 0.1.0, no gaps, `# Changelog` at line 1.
- Commit status NOT confirmed: the sandbox has no .git, so run `git -C ~/Work/Voice log --oneline -5` and `git status --short`. 0.1.50 may still be uncommitted; if so, committing 0.1.51 skips it in the git log (the CHANGELOG keeps both).
- Backup counter in docs/backup-log.md is 2 (not BACKUP DUE).
- docs/codebase-map.md and docs/lessons.md do not exist yet.

## What exists (all unit tested with mocks)
- textPipeline (clean, chunk; packs paragraphs up to 2000 chars), speechClient (one retry on 429-other or 5xx, never 4xx, daily-cap detection), audioCache (IndexedDB + memory store, bytes in and out), requestCounter (UTC day), settingsStore (settings incl. fontWeight, key, text in localStorage), textStats, providers (Fish + HeyGen built in, owner-added free models from localStorage, no UI to add them yet), audioFormat (PCM to WAV, audio type from bytes).
- scheduler (window = playhead + lookahead, cap pause, resume, retryChunk, cancel), followPlayback (ready flags, newly ready, playhead to send), playerCore (reducer, RATES 0.75/1/1.25/1.5/2, activeRowIndex, estimateTimes), playerEngine (two HTMLAudio slots, preloads the next chunk, preservesPitch), panelLayout, panelWidths, wiring (the only file that imports readKey).
- App.jsx (811 lines): top bar with provider select and Requests today; Text / Reader / Job panels (drag to reorder, drag handles to resize, order and widths saved); bottom player bar (prev/play/stop/next, seek, volume, speed); Settings drawer (key, voice, chunk size, lookahead, daily limit 50/1000, font weight slider 100-800 step 100, reset layout, cache size and clear); status bar with a 20-line event log (click to expand); window error handlers.
- Font: one variable @font-face (`font/variable/JetBrainsMono[wght].ttf`, weight 100-800) in src/theme.css; the weight is a `--font-weight` CSS variable on document.body set by an effect, stored in settings (integer 100-800, default 400). The slider is a module-level `FontWeightControl` (local state) so the chunk list does not re-render per move; pointer up / key up saves it and logs `Font weight <n>`.
- Playback is HTMLAudioElement slots, NOT Web Audio. Start Reading fills the lookahead window; the player plays from cache; the scheduler follows the playhead (0.1.48).
- File loading: drop or the Load button reads .txt/.md/.doc as plain text (readAsText). No .docx/.pdf parsing, no Download, no playback shortcuts, no Diagnostics overlay (the status bar log replaces it).

## Verified
- npm test in the sandbox: 143 tests pass, 0 fail (2026-11-08), including 3 new fontWeight tests (100/450/800 accepted; 99/801/450.5/'bold'/undefined fall back to 400; an invalid weight does not reset the other settings).
- Build and lint: NOT RUN here (no node_modules or network). The owner's vship run is the real check.
- Live: 0.1.50 was run by the owner (slider style and step reported, fixed in 0.1.51); 0.1.51 is untested live; no live results for 0.1.44 to 0.1.49 were pasted to Hermes.

## Owner must test live
1. Settings: drag the font weight slider: lands on 100/200/.../800, track/thumb and number are the player-slider teal, the number does not shift the layout, a reload keeps the value, a stored 400 still loads.
2. Paste a long text, Start Reading, press play: chunks play in order, the Reader row highlights, generation follows the playhead.
3. Switch provider (Fish to HeyGen): audio resets, the voice list changes, Start Reading works.
4. Drop a .txt file: cache clears, text loads, Start Reading works.
5. Reload: text and settings come back; Start Reading again uses cached chunks with no new requests.
6. Hit the daily cap: Waiting for daily reset, audio kept, Resume works after the reset.
7. Listen at 1.5x and 2x for pitch and gaps.

## Known bugs
- None confirmed in code (no TODO/FIXME markers). Known gaps, not bugs: .docx/.pdf not parsed; a .doc read as text is likely garbage; no Download; no shortcuts; no request log or time heard/remaining in the Job panel.

## Open decisions
- Final app name; voice list UI for Fish (no voice list yet, HeyGen has 10); whether short texts need a special mode; paid fallback model; download format (joined mp3 vs ZIP).

## Next steps in order
1. Owner: run build and lint (vship) and commit 0.1.51.
2. Live test list above.
3. Backup: the counter is 2; make a source backup, then tell Hermes "voice task: backup done, counter 0, label <x>, <date>".
4. Phase 5 leftovers: request log and time heard/remaining in the Job panel; decide whether reload needs Start Reading again or a real resume.
5. Phase 6: .docx/.pdf (mammoth, pdfjs-dist), Download (joined mp3 vs ZIP), playback shortcuts, README and app rename.

## Files not yet committed
From the sandbox (no .git): src/theme.css, src/settingsStore.js, src/App.jsx, src/App.css, tests/settingsStore.test.mjs, package.json, CHANGELOG.md, docs/backup-log.md, README.md, docs/handoff.md (this file). Owner checks `git status --short`.
