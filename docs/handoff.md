# Voice handoff

Date: 2026-11-08 (end of day). Owner: @Eleven. Plan: docs/plan.md. Rules: AGENTS.md.

## Version and git
- package.json: 0.1.59-alpha. CHANGELOG has 60 entries, 0.1.0 to 0.1.59, no gaps, `# Changelog` at line 1.
- Commit status NOT confirmed: the sandbox has no .git, so run `git -C ~/Work/Voice log --oneline -5` and `git status --short` on the P75.
- Backup counter in docs/backup-log.md is 10 (BACKUP DUE).
- docs/codebase-map.md and docs/lessons.md do not exist yet.

## What exists (all unit tested with mocks)
- textPipeline (clean, chunk; packs paragraphs up to 2000 chars), speechClient (one retry on 429-other or 5xx, never 4xx, daily-cap detection), audioCache (IndexedDB + memory store, bytes in and out), requestCounter (UTC day), settingsStore (settings incl. fontWeight, highlightMode, spellCheck, key, text in localStorage), textStats, providers (Fish + HeyGen built in, owner-added free models from localStorage), audioFormat (PCM to WAV, audio type from bytes).
- scheduler (window = playhead + lookahead, cap pause, resume, retryChunk, cancel), followPlayback (ready flags, newly ready, playhead to send), playerCore (reducer, RATES 0.75/1/1.25/1.5/2, activeRowIndex, estimateTimes), playerEngine (two HTMLAudio slots, preloads the next chunk, preservesPitch), panelLayout, panelWidths, wiring (the only file that imports readKey).
- App.jsx (939 lines): top bar with provider select and Requests today; Text / Reader / Job panels (drag to reorder, drag handles to resize); bottom player bar (prev/play/stop/next, seek, volume, speed); Settings drawer (key, voice, chunk size, lookahead, daily limit 50/1000, font weight slider 100-800, highlight mode words/sentences/none, spell check toggle, reset layout, cache size and clear); status bar with a 20-line event log.
- Text pane highlight: a read-only view polls playerEngine.getState() with requestAnimationFrame. src/highlight.js picks the range (highlightRange) and the character index by per-character weight (charAtFraction: letters/digits 1, whitespace 0.3, ,;: 4, .!? 8, \n 6). Sentences mode pulls back SENTENCE_DELAY = 0.15s; words mode leads WORD_LEAD_SECONDS = 0.12s. Highlight mode and font weight are view settings, applied and saved at once.
- Reader: click a chunk row to jump there and start reading; Job pane shows the selected character count, and the highlight pauses during a selection.
- Playback is HTMLAudioElement slots, NOT Web Audio. File loading: drop or Load reads .txt/.md/.doc as plain text (readAsText). No .docx/.pdf parsing, no Download.

## Verified
- npm test in the sandbox: 161 tests pass, 0 fail (2026-11-08), including 4 new charAtFraction tests (fraction 0 -> 0; fraction 1 -> last index; a full stop moves the highlight slower than a linear estimate; empty text is safe).
- Build and lint: NOT RUN here (no node_modules or network). The owner's vship run is the real check.
- Live: 0.1.59 is untested live; no live results for 0.1.44 to 0.1.58 were pasted to Hermes.

## Owner must test live
1. Paste a long text, Start Reading, play: chunks play in order, the Reader row highlights, generation follows the playhead.
2. Words mode: the highlight lingers on full stops and commas and catches up on plain text; the 0.12s lead keeps it on the voice.
3. Sentences mode: unchanged (still pulled back 0.15s).
4. None mode: the text shows with no highlight; Ctrl+wheel zoom works during playback.
5. Select text in the reading view while playing: the count shows and the highlight pauses.
6. Settings: spell check toggle and font weight slider, reload keeps them.
7. Drop a .txt file: cache clears, text loads, Start Reading works.
8. Hit the daily cap: Waiting for daily reset, audio kept, Resume works after the reset.

## Known bugs
- None confirmed in code. Known gaps, not bugs: .docx/.pdf not parsed; a .doc read as text is likely garbage; no Download; no shortcuts; no request log or time heard/remaining in the Job panel.

## Open decisions
- Final app name; voice list UI for Fish (HeyGen has 10); whether short texts need a special mode; paid fallback model; download format (joined mp3 vs ZIP); whether the weighted timing needs tuning after a live listen.

## Next steps in order
1. Owner: run build and lint (vship) and commit 0.1.59.
2. Live test list above.
3. Backup: the counter is 10; make a source backup, then tell Hermes "voice task: backup done, counter 0, label <x>, <date>".
4. Phase 5 leftovers: request log and time heard/remaining in the Job panel; decide whether reload needs Start Reading again or a real resume.
5. Phase 6: .docx/.pdf (mammoth, pdfjs-dist), Download (joined mp3 vs ZIP), playback shortcuts, README and app rename.

## Files not yet committed
From the sandbox (no .git): src/highlight.js, src/App.jsx, tests/highlight.test.mjs, package.json, CHANGELOG.md, docs/backup-log.md, README.md, docs/handoff.md (this file). Owner checks `git status --short`.
