# Voice handoff

Date: 2026-11-05 (end of day). Owner: @Eleven. Plan: docs/plan.md. Rules: AGENTS.md.

## Version and git
- Last version confirmed committed: 0.1.5-alpha (scheduler). 73 tests pass on 0.1.6-alpha.
- 0.1.6-alpha (wiring.js, App.jsx three columns, tests/wiring.test.mjs) is written. Commit status NOT confirmed: run `git -C ~/Work/Voice log --oneline -5` and `git status --short`.
- Lint was 0 warnings at 0.1.4 (cleanup task 2.0 committed). 0.1.6 shows 10 warnings; the list was never pasted. Fix in the next cleanup.
- Backups: phase0 verified. phase1 and phase2 backup commands were given; results NOT reported, treat as not done. Backup counter in docs/backup-log.md is 3 (BACKUP DUE).

## What exists (all unit tested with mocks)
textPipeline (clean, chunk, packs paragraphs up to 2000 chars), speechClient (one retry on 429-other or 5xx, never on 4xx, daily-cap detection), audioCache (IndexedDB store plus memory store), requestCounter (UTC day), settingsStore, textStats, scheduler (window = playhead + lookahead, cap pause, resume), wiring.js (the only file that imports readKey), App shell (text panel, counts, settings drawer, reader list with Play per ready chunk, Job panel).

## Verified live
- Curl: HTTP 200, valid mp3, no voice field.
- Browser page (cors-test.html, deleted): POST with Authorization header works. HTTP 200, audio/mpeg, 35943 bytes, decoded 2.247 s, speech heard. Browser-only stands.
- Readable response headers in the browser: cf-ray, content-type, x-generation-id. X-RateLimit-Reset was NOT readable (seen on a 200 only). Assume the cap reset time is unreadable; scheduler falls back to the next 00:00 UTC (01:00 CET).
- Empty voice ID works. The empty voice is not the cause of the current bug.

## Current bug (open, cause unknown)
In 0.1.6 pressing Start Reading shows no visible result and no sound. Key saved, text shown, privacy line shown.
- Not known: whether requests were sent (Requests today did not necessarily rise), whether chunk rows appeared, what the Network tab and console show.
- Hermes diagnosis (read-only): "not found in code". Facts it found: runLoop() in start() is not awaited; createAudioCache.get swallows store errors and returns a miss, so failures can be invisible.
- Playback in 0.1.6 is manual on purpose: each ready chunk has a Play button. Start Reading does not auto-play. Auto-play comes with the Phase 4 player.
- Task 2.4 (written in chat, NOT yet sent to Hermes): cache errors propagate, scheduler catches everything, status bar at the bottom of the page logs every click and event, window error handlers. Bump 0.1.7-alpha.

## Not verified
Build and lint on 0.1.6 (build passed, lint 10 warnings). IndexedDB path live. Cache hit after reload. Voice consistency between chunks. Gaps at chunk edges (item 8). Max input size (item 2). Whether failed requests count toward the cap (item 4). Joined mp3 (item 5). Best chunk size (item 6). 429 header readability.

## Cap and credits
Free cap 50 per UTC day, shared with Plinth Image Analysis. Today used: at least 2 (curl, browser page) plus any from Start Reading attempts; the app counter only sees requests made by the app. Owner adds 5 credits on 2026-11-06 (cap 1000 a day). Do not assume it until confirmed.

## Decisions made today (not in plan.md yet)
1. Chunks pack whole paragraphs up to the limit to save requests.
2. Chunk status comes from the cache, not from a separate saved list.
3. The request counter counts every attempt, including failed ones.
4. Phase 3 (visible UI) was moved ahead of the player so the owner can see progress.
5. Owner rule: every click must give visible feedback, and errors show on screen (status bar).
6. A word longer than the chunk limit is hard-cut. This is the only allowed word cut.

## Next steps in order
1. Check git state (see Version and git). Commit 0.1.6 by file name if not committed.
2. Send Hermes task 2.4. Run lint, build, tests on the P75. Commit 0.1.7.
3. Reload, press Start Reading, read the status bar. Report the exact text (never the key).
4. If still silent: F12, Console and Network (look for `speech`), paste the red lines.
5. Lint cleanup task for the 10 warnings.
6. Backups: make phase1 and phase2 archives with the -I zstd form, test, scan, then tell Hermes the counter is 0.
7. Live 3-chunk read, listen for voice change and cut words. Reload and press Start Reading again: chunks must be ready with no new requests.
8. Then Phase 4: player (Web Audio gapless, speed, pitch check at 1.5x and 2x).

## Open decisions
Voice ID list UI, whether short texts need a special mode, final app name, paid fallback model (owner decides).

## Files not yet committed
Unknown until step 1. Expected: src/wiring.js, src/App.jsx, src/App.css, tests/wiring.test.mjs, package.json, CHANGELOG.md, docs/backup-log.md.
