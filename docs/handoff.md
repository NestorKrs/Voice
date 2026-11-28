# Voice handoff

Date: 2026-11-28 (end of day). Owner: @Eleven. Plan: docs/plan.md. Rules: AGENTS.md. Feature detail: docs/clip-editor-handoff.md and docs/directives-handoff.md.

## Version and git
- package.json: 0.2.94-beta. First CHANGELOG entry is 0.2.94-beta (matches). Every version from 0.2.66 to 0.2.94 has its own CHANGELOG entry; no gap.
- CHANGELOG.md has exactly one `# Changelog` heading.
- Sandbox has no .git; on the P75 run `git -C ~/Work/Voice log --oneline -5` and `git status --short`.
- Backup counter in docs/backup-log.md is 4 (BACKUP DUE: 3 or more).

## What was done this session (0.2.92 → 0.2.94, all 2026-11-28)
- 0.2.92-beta (2.60e): src/scheduler.js takes an optional pauses config (prepare/derive/onReport); raw audio cached under the clean text, derived audio under the chunk key; a changed pause value costs no request; without the config nothing changes. Appended 10 tests to tests/scheduler.test.mjs.
- 0.2.93-beta (2.60f): pauses wired into src/App.jsx — deriveChunkAudio, handlePauseReport, pauseNotes, scheduler pauses config, and the selection read; status bar and row show added/skipped pauses. New tests/pausesWiringSource.test.mjs.
- 0.2.94-beta (2.60g): the highlight map (buildChunkMap) and the clip editor align on the spoken text via stripWithMap/stripDirectives, so tags never shift the highlight or reach clip text and file names. New tests/spokenTextSource.test.mjs; appended a case to tests/clipEditorSource.test.mjs.

## Verified
- npm test: 773 pass, 0 fail (2026-11-28, 0.2.94-beta), 5.97 s. Full raw run pasted in the wrap-up report.
- node --check clean on every changed .mjs (tests/scheduler.test.mjs, tests/pausesWiringSource.test.mjs, tests/spokenTextSource.test.mjs, tests/clipEditorSource.test.mjs).
- App.jsx duplicate check: only the two known false positives (const chunks, const commit).
- NOT verified here: build, lint, browser rendering, audio, IndexedDB and live network. .jsx and .css cannot be compiled in the sandbox; the owner's vship build is the real check.

## Owner must test live (desktop Brave)
1. Pauses: `First sentence. <break time="2s"/> Second sentence.` makes exactly ONE request and plays a two-second gap; status bar `Chunk 1: 1 pause added: +2 s`; 2s→3s then Start Reading makes NO request; a mid-sentence marker lands on a word gap or shows the skipped reason; the downloaded chunk, joined file and clip editor carry the longer pause.
2. Spoken text: with `[slowly]` tags the word highlight follows the voice and never highlights a tag; the editor's clip text and default file names carry no tags; a text without tags highlights exactly as before.
3. Everything else in the reader, player and clip editor still behaves as before.

## Known bugs and gaps
- Nothing in the new pauses path or the spoken-text alignment has been tested live in Brave yet.
- Derived audio is WAV, so the cache is bigger; old derived entries stay until the cache is cleared.
- Highlight and clip text now strip tags, but the Text panel and downloads still show the raw chunk (tags included) — downloads read the chunk key, which holds derived audio.
- Clip text is approximate unless a cut lands on a pause (src/clipText.js linear fallback, marked estimated).
- src/timeMap.js and src/phoneView.js are dead code; older 0.1.x CHANGELOG formatting issues remain.

## Open decisions
- Reaction-time compensation and playhead offset values (owner tunes live).
- Whether #ff6f6f should become the app-wide --accent.
- Public access (each visitor needs an OpenRouter key) and request-cost warnings before the editor is announced.
- Touch equivalents, the single 768px breakpoint, CHANGELOG cleanup, deleting src/timeMap.js and src/phoneView.js, final app name, voice-list UI.
- Parked editor features: mixer, auto-suggest from pauses.

## Next steps in order
1. Owner: vship (lint, build, tests), commit, check `git status --short` on the P75; take the backup (counter 4).
2. Work through the live list above in Brave; report anything that looks off.
3. Decide the open items, then the remaining phase-5/6 leftovers.

## Files not yet committed (check on the P75)
This session (mtime 2026-11-28): src/App.jsx, src/ClipEditor.jsx, src/scheduler.js, tests/scheduler.test.mjs, tests/pausesWiringSource.test.mjs, tests/spokenTextSource.test.mjs, tests/clipEditorSource.test.mjs, package.json, CHANGELOG.md, docs/backup-log.md, docs/directives-handoff.md, docs/clip-editor-handoff.md. docs/handoff.md (this file) is not staged by vship: git add it explicitly. Older pending files may still be uncommitted: src/audioCache.js, src/fileTypes.js, their tests, tests/viteBase.test.mjs, tests/favicon.test.mjs, index.html, public/, vite.config.js, AGENTS.md, docs/lessons.md, docs/codebase-map.md.