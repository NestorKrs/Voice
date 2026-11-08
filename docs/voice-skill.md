---
name: voice
description: Use for every message that starts with "voice task", "voice lesson:" or "good night" in the Voice project (the owner's browser text-to-speech reader, React + Vite, folder /workspace/voice). Holds the exact procedure, checks and report format. Not for other projects.
---

# Voice

Voice is the owner's personal, browser-only text-to-speech reader (React + Vite, NO backend). The owner pastes very long text (35 to 50+ pages). The app reads it aloud chunk by chunk with free OpenRouter models (Fish Audio S2.1 Pro Free and HeyGen Voice Turbo Free). You are the only writer of the code. The owner runs the app, builds, lints, commits and tests live.

## When to use

- Message starts with "voice task: backup done": run the Backup message procedure below.
- Any other message that starts with "voice task": run the Procedure below.
- Message starts with "voice lesson:": see Lessons.
- Message is "good night": do the Wrap-up in AGENTS.md. Change no code. Read package.json and the first CHANGELOG entry first; report any skipped version or missing entry, but do not fix it.
- Any other Voice message with no written task: answer in one or two short lines and ask which task to run. Do no work.
- Do not use this skill for other projects.
- The task prefix decides the skill, not the file names or code shape in the attached content. If the attachment starts with "voice task", load this skill even when the code looks like another project.

## Where things are

- Your folder: /workspace/voice. It is the same set of files as ~/Work/Voice on the owner's laptop. Syncthing copies changes both ways in about 30 seconds. Write ONLY inside /workspace/voice.
- Not synced: .git, node_modules, dist, .env, backups. So in the sandbox there is no git history, no node_modules and no network.
- Rules: AGENTS.md. Plan: docs/plan.md (the original plan, partly outdated: it still says Web Audio player and one model). Last status: docs/handoff.md (can be stale). Code map: docs/codebase-map.md. Lessons: docs/lessons.md. The last two may not exist yet.
- If this skill and AGENTS.md disagree, AGENTS.md wins. Say so in the report.
- For facts about the current state of the project, trust in this order: the code and package.json, then CHANGELOG.md, then docs/codebase-map.md, then AGENTS.md and this skill, then docs/handoff.md and docs/plan.md. If handoff.md names a version older than package.json, it is stale: say so in the report and do not act on its bugs, next steps or counter.
- AGENTS.md says to stop when it and docs/plan.md disagree. The known plan.md differences (Web Audio player, one model, paid-model wording) are not a reason to stop. List them in the report and go on.

## What you can run here

- Only: npm test (same as node --test tests/*.test.mjs), and node --check <file> on .js and .mjs files.
- NEVER run: npm install, npm run build, npm run lint, npm run dev, any git command that changes something, any call to OpenRouter, anything that touches the API key.
- The owner runs build, lint, the app and all live tests on the laptop (through the vship script) and pastes you the raw output.
- You cannot compile .jsx files here. So you must follow "Editing big files" below and say in the report that the owner's build is the real check.
- There is no IndexedDB, no DOM, no real audio and no real browser here. Test those parts with fakes shaped like the real thing, and say in the report that the live check is the owner's.
- npm test can time out in this sandbox. If it does, write TIMED OUT, paste what it printed, and say the owner's vship run is the real test result. Do not retry in a loop.

## Quick map (as of 2026-11-08; docs/codebase-map.md wins if it differs)

- src/App.jsx: the whole page in ONE big component (state, handlers, top bar, Text/Reader/Job panels, player bar, Settings drawer, status bar) plus two module-level controls (FontWeightControl, TextReadView). Most edits and most breakages happen here. src/highlight.js picks the word/sentence range and the weighted character index for the Text panel's read-only highlight view (textarea hidden while playing); the Job pane shows the selected-character count pinned at the bottom, and clicking a Reader chunk row jumps the player there.
- src/App.css (layout) and src/theme.css (colors, button look; CSS variables --bg --panel --line --muted --accent --ease --font).The font is @font-face in src/theme.css.
- src/panelLayout.js: panel order (drag by grip; the page changes the visual order with CSS order, the DOM order stays fixed). src/panelWidths.js: panel widths in percent, limits, handles.
- src/providers.js: provider list (Fish, HeyGen, owner-added), only models ending in :free. src/audioFormat.js: PCM to WAV, audio type detection.
- src/speechClient.js: the ONLY file that uses the network. src/wiring.js: the ONLY file that imports readKey; builds the services (cache, speak, counter, makeKey).
- src/scheduler.js: makes chunks ahead of the playhead (window = playhead + lookahead), pauses on the daily cap. src/audioCache.js: IndexedDB. src/requestCounter.js: requests per UTC day.
- src/playerEngine.js and src/playerCore.js: the bottom player (two Audio slots, preloads the next chunk, reset()).
- src/settingsStore.js: settings, key and text in localStorage. Settings keep one voice per provider; "voice" is the active provider's voice.
- src/textPipeline.js (clean and split text), src/textStats.js (counts).
- File loading (drop a file onto the Text panel, or the Load button): FileReader.readAsText only; the file input accepts .txt,.md,.doc,text/plain. No .docx/.pdf parsing yet (no mammoth, no pdfjs-dist). Dropping a file cancels the scheduler, clears the audio cache and resets the player; the Load button only sets the text.
- tests/*.test.mjs: one file per module.

## Standing rules (every task)

1. No written task means no work. Do exactly the numbered steps, in order. One task per message.
2. Touch only the files the task names. A file the task does not name stays untouched, even for a one-line tidy. No refactors, no renames, no extra features, no cleanup. Never delete or replace existing UI unless the task says so. New things are additive.
3. If a step fails, is unclear, or an anchor is not found exactly once: STOP. Paste the RAW output. Wait for the owner. Do not guess, do not work around it. An anchor is any line or text the task tells you to replace or insert next to.
4. Paste RAW command output, never a summary. Write NOT RUN for a command you did not run. Never invent output. Never say something works unless you ran a check and pasted its output. Tests with mocks do not prove the live app works.
5. Bugs: first a read-only diagnosis. A diagnosis task changes no file. Paste the code and the raw evidence, answer each lettered question in one line, in order, with the line number that proves it, and name the root cause and the failure layer. "Not found in code" is a valid answer; a guess is not. A summary instead of the raw output is a failed step. Fix only after the owner says go, or when the task itself says to fix if the evidence matches the condition it states.
6. Never weaken or edit an existing test to make it pass. If an old test breaks only because of a field your task introduced, change only that expected value and say which test.
7. Add no dependency. Never edit the dependency lists in package.json. If one is needed, tell the owner the package name. Approved later: mammoth, pdfjs-dist.
8. Secrets: never ask for, open, print or log the API key or any .env file. When you need network facts from the owner, ask for the Network tab Payload and Response only, never Headers.
9. Money and cap: only models whose ID ends in :free (code enforces it). The free cap is 50 requests per UTC day, or 1000 once the owner's lifetime credit purchases reach $10 (the owner bought $10; the Daily limit setting is chosen by hand and the 1000 cap is not verified), plus 20 requests per minute. The cap is shared with other free models and every attempt counts, including failed ones. The browser cannot read X-RateLimit-Reset, so a cap pause falls back to the next 00:00 UTC. Never make a live request. Never write code that loops requests. Never tell the owner to press Retry repeatedly.
10. Never log pasted text or chunk text. Diagnostics hold time, chunk number, status and latency only.
11. UI: dark theme. Every disabled control shows its exact reason (visible text or title). Every failure shows an exact reason on screen and in the status bar. No modals and no toasts for errors. Every click gives visible feedback. The bottom status bar and its expandable event log keep their markup and behavior; the owner copies logs from there. Change them only when a task says so.
12. Replies: short, plain words.
13. Lint: add no new lint warnings. No unused variables, functions, imports or parameters. If a parameter must stay unused, start its name with an underscore. The owner's vship run prints the warning count.
14. When the owner calls a task "quick", "mini" or "small", implement the smallest direct version that works; add no optional settings, abstractions or speculative guards, only the minimum needed for correct behaviour.

## Procedure

1. Gate. The message or its attached content must start with "voice task" and contain numbered steps. If not, ask for the task and stop. (Exception: the backup message, see below.) A prose feature request without the prefix is still a written task: answer the feasibility question with code evidence, confirm the direction with the clarify tool, then proceed once the owner picks.
2. Orient. Read AGENTS.md, docs/handoff.md, docs/codebase-map.md (if missing, say so and go on) and docs/lessons.md (if missing, go on). If handoff.md names a version older than package.json, say "handoff.md is stale" in the report and use the truth order from "Where things are". Read other code only where the task needs it.
3. Check the start. Read the version from package.json. Compare it with the first line of CHANGELOG.md that starts with "## ". If they differ, say so in the report. If CHANGELOG.md has no line for the current version, or skips a version number, say so too and do not fix it unless the task says so. For every anchor in the task, run grep -n on it first and paste the result. If an anchor does not match exactly once: STOP.
4. Do the steps. Before adding any name (function, const, state, import, class), run grep -n "<name>" on the file. If it already exists: STOP.
5. Check your work:
   - npm test. Paste RAW. If it fails, STOP and paste the full failure. If it times out, follow "What you can run here".
   - node --check <file> for every .js and .mjs file you changed.
   - For App.jsx run the duplicate check and print the lines around each insertion (see below).
   - Wiring proof: for every new function, state, prop, import or component, paste grep -n showing the definition AND at least one use. Defined but never used, or used but never defined, means the task is NOT done.
6. Version and notes (only when the task changes behavior, UI or fixes a bug; docs-only and tests-only tasks do not bump). Bump PATCH in the version line of package.json only. Add one entry to CHANGELOG.md as the new first "## " entry (newest first, above the previous newest): "## <version> - <date>" and one "- " line saying what changed. Do not move the "# Changelog" heading. Add 1 to the counter in docs/backup-log.md: read the current value and write that value plus 1. Edit the existing lines in place; never add a second version line or a second Counter line (vship stops on duplicates). When the counter reaches 3, write BACKUP DUE at the top of the report. Never reset the counter yourself; only the owner's backup message resets it.
7. Report, once, in the AGENTS.md format (what changed and why; version before and after; files with wc -l; commands with RAW output; READY TO COMMIT; BACKUP DUE or counter; Not verified). Add two lines: "Wiring proof" and "Lessons checked". The Not verified part says exactly what the owner must test live, step by step.
8. Give the owner commands in fenced blocks. One block per purpose, a label line before each, one command per line, owner paths (~/Work/Voice, never /workspace/voice). End a command with 2>&1 | wl-copy when the owner should paste the result back. Always include:
   - Files vship does NOT stage: docs/handoff.md, docs/codebase-map.md, docs/lessons.md, docs/plinth-reference.css, font/ and anything else outside that list. List each such file by name in READY TO COMMIT and give: git -C ~/Work/Voice add <the exact files>, then git -C ~/Work/Voice commit -m "<what>". Docs-only commits have no version in the message and no version bump.
   - Ship: end EVERY report with ONE fenced block that holds exactly one line: the complete vship command with the real message already written, ready to copy, for example vship "Generation follows playback: scheduler playhead tracks the player". No placeholders, no version number in the message, nothing else in that block, and it is the last thing in the report. This includes docs-only tasks. The good-night wrap-up is the exception: it ends with the single line vend, because vship does not stage docs/handoff.md. vship runs lint, build and tests, stages a fixed list of paths (src, tests, package.json, package-lock.json, CHANGELOG.md, README.md, AGENTS.md, docs/backup-log.md, docs/plan.md, index.html, vite.config.js, .gitignore), stops if the staged changes contain an sk-or- key pattern, asks y/N, commits as "<version>: <message>", and offers a backup when the counter is 3 or more. It copies its own output to the clipboard.
   Never git add -A.

## Backup message

The owner sends: "voice task: backup done, counter 0, label <x>, <date>". Do only this:
1. Set the Counter line in docs/backup-log.md to 0.
2. Add one row to the table in that file: the date, the current version from package.json, the label, and "backup made".
3. Paste the file. This is docs-only: no version bump, no CHANGELOG entry, no other file touched.
4. READY TO COMMIT: docs/backup-log.md. (vship stages it with the next commit.)

## Editing big files (App.jsx is one big component, hundreds of lines)

Hermes has broken this file by pasting a function inside another function, by declaring a name twice, and by skipping a step. So:

- Insert at the exact anchor the task gives. If the task gives none: put new component-level functions directly above `const panelClass =` (grep that it exists first) and new hooks next to the other hooks. New module-level components go next to FontWeightControl, above `export default function App()`.
- New component-level const lines are indented exactly 2 spaces. A function indented deeper than 2 spaces is inside another function and is WRONG.
- After editing, run this and paste the result (expect no output except the last word):
  (grep -oE "^  const [A-Za-z0-9_]+" src/App.jsx | sort | uniq -d); echo "dup check done"
- The dup check has a known pre-existing false positive: `const chunks` matches twice (once inside handleStart at 2-space indent, once at component level), so it prints `  const chunks` before `dup check done`. That is not your edit; do not "fix" the indentation unless the task says so.
- When a task says "after EVERY such line", grep the anchor first and count occurrences; the same line can appear at different indentation (for example `schedulerRef.current = null;` at 8 and 10 spaces). Patch each occurrence with its surrounding context, not replace_all.
- When a task says "append only" to a test file, append with a heredoc (`cat >> tests/x.test.mjs <<'EOF'`); never rewrite the file or reorder existing tests.
- Print the 6 lines before and after each insertion with sed -n and paste them.
- Re-read each changed block once for unbalanced braces and parentheses. The patch tool's fuzzy match can insert the leading indentation of old_string into the middle of a line; when patching a line-internal substring, keep old_string/new_string free of leading indentation and re-read the line after patching.
- Do every numbered step. A skipped step is the most common failure. Finish with the wiring proof.

## Finding the failure layer (bugs)

Name which layer fails before proposing a fix:
(a) wiring: a function or handler is not reachable, or never called;
(b) UI state: a handler or effect uses an old copy of state (stale closure, stale cached data);
(c) logic module: scheduler, cache, player engine, settings store, text pipeline;
(d) provider response: HTTP status and the exact message from OpenRouter;
(e) browser behavior: autoplay blocking, passive event listeners, native drag images, the Brave app window, page zoom;
(f) dev tooling: Vite showing an old or broken module (a syntax error in the terminal output).
If you must ask the owner, ask ONE question that separates two layers, for example what the status bar line says, or the Payload and Response of the failed speech request.

## Known pitfalls (each came from a real failure or a checked browser behavior)

- A function was pasted inside handleStart, so the dropdown could not find it. -> Follow "Editing big files"; check the indentation.
- A task step was skipped and the work was reported as done. -> Do every step; the wiring proof must show definition and use.
- The player kept the old audio after the provider changed, and dropping a new file had to clear the cache by hand. -> Anything that keeps loaded or cached state (player slots, scheduler window, schedState, audio cache) must be reset when its inputs change (provider, voice, chunk size, text, a loaded or dropped file). Ask: what stale copy does this keep?
- React onWheel and touch handlers are passive, so preventDefault does nothing and the browser zooms the whole page. -> Use a native addEventListener("wheel", fn, { passive: false }) inside an effect on the element, and remove it in the cleanup.
- Retry reused the voice and provider from the first Start Reading. -> A handler must read current settings, or the owner must start again; say which.
- The switch stayed disabled after an error. -> Disable controls only for the shortest real reason, and show that reason.
- Audio from different providers has different formats. -> Pick the audio type from the bytes (audioMime), never hardcode audio/mpeg.
- Pasting 150,000 characters must stay smooth. -> Keep typing state local and debounced; never re-render the whole chunk list on every key press.
- Eleven catch blocks were written as "catch {" but used the variable e, so any real error showed "e is not defined" and hid the cause. -> Always write catch (e) when the block uses e. A test (tests/app_catch.test.mjs) scans App.jsx for this.
- Code was added that nothing calls (an unwired engine), which added 5 lint warnings and made a commit message untrue. -> New code is only done when something imports and uses it; the wiring proof must show that.
- The cache passed its tests, but the IndexedDB store returned a record object while the memory store returned bytes, so saved audio read back as "no audio in cache" (the row said ready, Play found nothing). -> Every store follows one contract (get returns the bytes or null, never a record object), and tests also use a fake store shaped like IndexedDB, not only the memory store.
- An IndexedDB write was reported as done when its request succeeded, before the transaction committed. -> A write is finished only when the transaction completes; reject on error or abort.
- A one-line tidy was made in a file the task did not name (wiring.js, the file that reads the key). -> A file the task does not name stays untouched. Describe what you saw in the report instead.
- The backup counter was reset by the agent itself. -> Only the owner's backup message resets it.
- Diagnosis questions were answered with a summary, so the cause could not be checked. -> Answer each lettered question in one line with line numbers, and paste the raw output.
- A speed slider with step 0.25 reached 1.75, a value the player does not accept, so the thumb snapped back, and its label changed width as the number changed. -> A control for a fixed list of values moves by position in that list (import the list, never copy it) and its label has a fixed width. Do not hide jumpiness with a debounce or a transition.
- The highlighted chunk row came from its own state that only the row's Play button set, so Previous and Next never moved it. -> Derive what the screen shows from the engine state (activeRowIndex); never keep a second copy of what the engine already knows.
- A dragged panel followed the pointer as a full picture. The browser takes that picture itself and CSS cannot change it. -> In dragstart call dataTransfer.setDragImage with a visible element (the grip), and apply any dimming of the source after the drag has started (setTimeout 0).
- CHANGELOG entries were added above the "# Changelog" heading, which ended up in the middle of the file, and one version got no entry. -> Add the new entry as the first "## " entry and write one entry for every version bump; while adding entries, never move the heading. A docs fix for a heading stranded mid-file moves the single heading to line 1 and inserts the missing version entry in numeric order; check with grep -c "^# Changelog" (expect 1) and grep -n "^## " before and after.
- A test named "placeholder" covers nothing. -> Add a behavior test before claiming an integration is verified.
- A control looked active while playback state was stale. -> Map every control to a real engine method and drive the UI from the engine's onChange.
- Moved UI text or controls were left in their old place too. -> When you move something, remove the original; grep for the old text to prove it.
- A "switch X to Y" request can name X as if it already exists. -> Grep for X first and paste the evidence; if it is not in the code, say so and offer the executable alternatives instead of building a switch from nothing.
- The speech endpoint returns raw audio bytes with no word or sentence timestamps (speechClient sends {model, input, response_format} and reads arrayBuffer). -> A "highlight the word being read" feature can only estimate the position from audio position/duration; it drifts. Say so in the report.
- The Text panel is a plain <textarea> and chunkText cleans the text first, so chunks are slices of cleanText(text), not of the raw text. -> Highlight inside the chunk text in a read-only view; do not map chunk offsets back to the raw textarea text.
- playerState.position updates only about 4 times a second (throttled timeupdate), so a word-level highlight driven by it lags the voice. -> Poll playerEngine.getState() from a requestAnimationFrame loop throttled to ~50ms; getState() reads audio.currentTime live. Update only the highlight state and bail out when the range is unchanged, so App does not re-render at 60fps.
- A read-only view that replaces the textarea loses the textarea's handlers (Ctrl+wheel zoom, Ctrl++/-/0, file drop). -> Copy them onto the new view, with tabIndex=0 and a focus outline for the keyboard ones, or they silently stop working.
- Settings that change the live view (font weight, highlight mode) are applied and saved at once; settings that change generation (chunk size, lookahead, daily limit) are saved on the Save settings button. -> Follow the existing split; do not make a view setting wait for Save.
- The scheduler window stopped after the first 3 chunks because nothing advanced its playhead. -> A scheduler that makes chunks ahead of a playhead needs two wires: App.jsx must call scheduler.setPlayhead when the player index changes, and call playerEngine.notifyReady(index) when a chunk becomes ready; without both, generation stalls after the initial window.
- scheduler.setPlayhead has no not-started guard: calling it before start() starts runLoop with uncomputed keys (null). Only wire a pre-start setPlayhead when the task requires it, and list the race under Not verified.
- A read-only view that re-renders its text on every animation frame destroys the owner's drag-selection in it. -> Freeze the highlight while a selection is in progress (a ref set on mousedown, cleared on mouseup) and read window.getSelection() on mouseup; otherwise the selection count flashes or never appears.
- Adding onClick to a list row that contains buttons makes the buttons fire the row action too. -> Call e.stopPropagation() in the inner buttons, or the row action silently overrides them.
- The owner says "the bottom of the panel" and means pinned to the bottom, not flowing right after the last control. -> Use marginTop: 'auto' on the flex child; a block placed directly after a button row reads as "under the buttons".
- The TTS pauses between sentences, so the linear position/duration estimate reaches the next sentence before the voice does and a sentence highlight rushes ahead. -> Pull the sentence-mode position back by a small named constant (SENTENCE_DELAY) rather than touching the word mode or the shared estimate.
- The browser only re-runs spellcheck when a text control gains focus, so changing the spellcheck attribute on an unfocused textarea leaves the old red underlines until the owner clicks into it. -> Force the re-check in a useEffect on the setting (after React commits the attribute), not in the change handler: focus the textarea, blur it on the next task, then restore selectionStart/End, scrollTop/Left and the previously focused control. Skip the first run with a prev-value ref (StrictMode double-invokes effects) and skip while the element is hidden (offsetParent === null), or a view setting silently does nothing.
- A task can ask for a function that builds derived data (per-character weights) and for the caller to memoize that data once per chunk. A function that only takes the raw input cannot use the memoized copy, so the memo is an unused variable (lint warning) and the builder is dead code. -> Let the lookup accept the raw input or the precomputed form, and say which you chose in the report.
- A per-character index must use the same index space as the existing highlight code: text.length and text[i] (UTF-16 code units), because highlightRange returns regex/length indices; [...text] (code points) returns an index that mismatches on text with astral characters. Check a listed special character before the whitespace fallback ('\n' is both).
- A task step saying "do not change ... any other file" means unrelated files, not the mandatory version/CHANGELOG/backup bookkeeping; AGENTS.md requires a PATCH bump for every behavior change. Follow AGENTS.md and say so in the report.


## Lessons

When the owner sends a message starting with "voice lesson:", do only this: add one line "<mistake> -> <rule>" to docs/lessons.md (create it if missing). If a similar line exists, improve it instead of adding a second. Keep at most 20 lines; merge or drop the weakest. Then paste the file. This is docs-only: no version bump. Write only what the feedback or your own output proves; never invent a lesson. Never change this skill file; the owner does that. Before every report, check your work against docs/lessons.md and write "Lessons checked".

## Verification

A task is done only when the report shows: npm test output (or TIMED OUT with what printed), node --check output for changed .js and .mjs files, the duplicate check, the wiring proof, the version change (if any), and a Not verified list for the owner.