# Voice handoff

Date: 2026-11-09 (end of day). Owner: @Eleven. Plan: docs/plan.md. Rules: AGENTS.md.

## Version and git
- package.json: 0.1.64-alpha. CHANGELOG has entries 0.1.0 to 0.1.64, no gaps, `# Changelog` at line 1.
- Commit status NOT confirmed: the sandbox has no .git, so run `git -C ~/Work/Voice log --oneline -5` and `git status --short` on the P75.
- Backup counter in docs/backup-log.md is 15 (BACKUP DUE).
- docs/codebase-map.md and docs/lessons.md do not exist.

## What exists (all unit tested with mocks)
- textPipeline, speechClient (one retry on 429-other or 5xx, never 4xx, daily-cap detection), audioCache (IndexedDB + memory store, bytes in and out), requestCounter, settingsStore (settings incl. fontWeight, highlightMode, spellCheck, downloadFormat, key, text in localStorage), textStats, providers (Fish + HeyGen built in, owner-added free models), audioFormat (PCM to WAV, audio type from bytes, PCM_DEFAULT_RATE/PCM_DEFAULT_CHANNELS).
- scheduler, followPlayback, playerCore, playerEngine, panelLayout, panelWidths, wiring (the only file that imports readKey).
- mp3Encoder.js: createMp3Encoder (1152-sample blocks, lazy lamejs import), encodeMp3, floatToInt16, pcmToInt16Channels, wavToInt16.
- chunkDownload.js: chunkFileName, audioKind, toWavBytes, encodeWav, convertChunk (one shared format converter).
- zipStore.js: crc32, createZip, zipChunks (async generator, stored ZIP, UTF-8 names).
- joinAudio.js: stripId3, wavHeader, wavParts, joinMode, sameAs.
- App.jsx (1190 lines): top bar with provider select and Requests today; Text / Reader / Job panels (drag to reorder, drag handles to resize); bottom player bar; Settings drawer (key, voice, chunk size, lookahead, daily limit 50/1000, font weight, highlight mode, spell check, chunk download format, reset layout, cache size and clear); status bar with a 20-line event log.
- Reader: each chunk row has a Download icon button (the old Play is gone); the panel bottom has "Download all chunks" (ZIP) and "Download all joined", always visible below the scrolling chunk list.
- Text pane highlight: a read-only view polls playerEngine.getState() with requestAnimationFrame; src/highlight.js picks the range and the weighted character index. Sentences mode pulls back 0.15s; words mode leads 0.12s.
- Playback is HTMLAudioElement slots, NOT Web Audio. File loading: drop or Load reads .txt/.md/.doc as plain text. No .docx/.pdf parsing.

## Verified
- npm test in the sandbox: 201 tests pass, 0 fail (2026-11-09). New modules covered: mp3Encoder (6), chunkDownload convertChunk (5), zipStore (5), joinAudio (12).
- Build and lint: NOT RUN here (no node_modules or network). The owner's vship run is the real check.
- Live: 0.1.60 to 0.1.64 are untested live.

## Owner must test live
1. Per-chunk download: Fish as MP3, Fish as WAV (decoded), HeyGen as WAV; the row shows the exact reason when a chunk is not ready.
2. ZIP: the file opens in the OS archive tool with all ready chunks; the files play.
3. Joined: Fish joined MP3 plays start to end and the duration looks right; HeyGen joined MP3; Fish joined WAV (large file); HeyGen joined WAV.
4. Cancel in the save dialog; the disabled titles on both buttons.
5. The Reader panel buttons stay visible while the chunk list scrolls.
6. Reload keeps the download format setting.

## Known bugs
- None confirmed in code. Known gaps, not bugs: .docx/.pdf not parsed; a .doc read as text is likely garbage; no shortcuts; no request log or time heard/remaining in the Job panel.

## Open decisions
- Final app name; voice list UI for Fish (HeyGen has 10); whether short texts need a special mode; paid fallback model; whether the weighted timing needs tuning after a live listen.

## Next steps in order
1. Owner: run build and lint (vship) and commit 0.1.64.
2. Live test list above.
3. Backup: the counter is 15; make a source backup, then tell Hermes "voice task: backup done, counter 0, label <x>, <date>".
4. Phase 5 leftovers: request log and time heard/remaining in the Job panel.
5. Phase 6: .docx/.pdf (mammoth, pdfjs-dist), playback shortcuts, README and app rename.

## Files not yet committed
From the sandbox (no .git): src/App.jsx, src/App.css, src/audioFormat.js, src/chunkDownload.js, src/mp3Encoder.js, src/zipStore.js, src/joinAudio.js, tests/chunkDownload.test.mjs, tests/mp3Encoder.test.mjs, tests/zipStore.test.mjs, tests/joinAudio.test.mjs, tests/settingsStore.test.mjs, package.json, CHANGELOG.md, docs/backup-log.md, README.md, docs/handoff.md (this file). Owner checks `git status --short`.
