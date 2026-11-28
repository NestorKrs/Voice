# Changelog

## 0.2.94-beta - 2026-11-28
- The highlight map and the clip editor align on the spoken text: buildChunkMap strips directives before aligning and maps the result back to the original chunk, and ClipEditor strips tags from clip text, the chunk strip and file names; new tests/spokenTextSource.test.mjs

## 0.2.93-beta - 2026-11-28
- App-made pauses are wired into the reader: a chunk with a break tag is requested once as clean text, the extra silence is derived and cached under the chunk key, the status bar and row show added/skipped pauses, and a selection read derives the same way; new tests/pausesWiringSource.test.mjs

## 0.2.92-beta - 2026-11-28
- The scheduler accepts an optional pauses config (prepare/derive/onReport): raw audio is fetched and cached under the clean text's key, the derived audio is cached under the chunk key, and a changed pause value costs no request; without the config nothing changes

## 0.2.91-beta - 2026-11-28
- New pure src/pauseApply.js (mapPausesToSpoken, applyPauses) maps pause markers to the spoken text and inserts their seconds as silence (aligned to a matched pause, snapped to a near quiet gap, or skipped with a reason); not imported by the app yet

## 0.2.90-beta - 2026-11-28
- The / menu now opens wherever a slash is typed in the Text editor, stays visible in fullscreen and on phones, and sizes tag buttons to their own text instead of a fixed-width grid

## 0.2.89-beta - 2026-11-28
- alignTimeMap now also returns pairs (matched break offset and silence seconds) and indexToTime (inverse of timeToIndex by bisection); ok:false results carry pairs [] and indexToTime null; existing fields unchanged

## 0.2.88-beta - 2026-11-28
- Typing / at a line start in the Text editor opens the same category/tag menu and replaces the command in place; inserted tags scroll into view and flash teal text for 3 seconds

## 0.2.87-beta - 2026-11-28
- Speech errors show the HTTP status (status bar, reader note and per-row note); Resume no longer re-sends a chunk rejected with HTTP 400 unless its text, voice or provider changed, and shows a note instead

## 0.2.86-beta - 2026-11-28
- The / menu now starts with category buttons; clicking one shows that category's tags as a button grid, typing still filters across categories, and arrows/Enter work on both tabs and buttons

## 0.2.85-beta - 2026-11-28
- The / command menu now renders inside the Text panel find row, so its absolute CSS anchor is the row and the tag list appears under the input; added a placement regression test and created docs/lessons.md

## 0.2.84-beta - 2026-11-28
- chunkText now protects delivery tags and break tags with private placeholders while splitting, restores them byte for byte, and merges chunks with nothing speakable into a neighbour; text without directives chunks exactly as before

## 0.2.83-beta - 2026-11-28
- New pure src/pauseMarkers.js (extractPauses, hasPauses, stripForRequest) pulls <break> tags out of the text and reports each pause's clean-text index and seconds (comma decimals, 60 s clamp, adjacent tags merged); not imported by the app yet

## 0.2.82-beta - 2026-11-28
- New pure slashContext(text, caret) in src/slashMenu.js decides whether a textarea caret is typing a slash command (line-start slash, no space after it, query <= 40 chars), with appended tests; not used by the app yet

## 0.2.81-beta - 2026-11-28
- Text panel find row: typing / opens a slash command menu (src/slashMenu.js) under the find input to insert delivery tags and break pauses at the last caret; arrows/Enter insert, Esc closes, disabled items show the model reason, inserting while reading shows "Stop playback to edit the text."; new tests/slashMenuSource.test.mjs

## 0.2.80-beta - 2026-11-28
- New pure src/slashMenu.js (BREAK_PRESETS, parseSlashInput, moveHighlight) builds the / command menu for tags and break tags from directiveSupport flags, with tests; not imported by the app yet

## 0.2.79-beta - 2026-11-28
- Per-provider directive capabilities: every provider entry in src/providers.js carries directives { tags, breaks, breakMode, reasonTags, reasonBreaks } and directiveSupport(provider) returns a validated copy with 'unknown' defaults; TAGS_TESTED_ON set to heygen/heygen-voice-1-turbo:free; tests appended; not wired into the app yet

## 0.2.78-beta - 2026-11-28
- New pure src/directives.js (TAG_RE, BREAK_RE, formatBreak, formatTag, normalizeBreaks, findBreaks, directiveRanges, safeSplitIndex, stripDirectives, stripWithMap, hasSpeakableText, insertAt) and src/deliveryTags.js (TAG_CATEGORIES, RETEST_TAGS, TAGS_TESTED_ON, allTags, isKnownTag) for delivery tags and break tags, with tests; not imported by the app yet

## 0.2.77-beta - 2026-11-28
- Clip editor: volume and speed sliders in the transport row drive the clip player (setVolume/setRate on src/clipPlayer.js with a master gain and per-source playbackRate); the zoom buttons move under the waveform next to play; the close button gets the settings-cog hover highlight; the editor widens to three quarters. App.jsx untouched

## 0.2.76-beta - 2026-11-28
- Clip editor: new pure src/mixEngine.js (createMixEngine) drives the live mix graph (voiceGain, musicGain, fade, duck, master) from one shared plan, with load/setPlan/play/pause/seek/getPosition/getState/setOnEnd/close and a hand-written fake-context test; not imported by the app yet

## 0.2.75-beta - 2026-11-28
- Clip editor: new pure src/mixPlan.js (MAX_MIX_VOICE_SECONDS, DEFAULT_PARAMS, normalizeParams, clampStartSec, parseOffsetTime, buildMixPlan, fadeValueAt, scheduleAt, peakBound) builds one shared plan of numbers and curves for both the live preview graph and the offline export graph, with tests; not imported by the app yet

## 0.2.74-beta - 2026-11-28
- Clip editor: new pure src/mixLoad.js (musicFileRejection, loadMusicFile) guards and decodes a music file (.mp3/.wav/.m4a/.ogg, 30 MB, 5:00, rate match) for the mixer, with tests; not imported by the app yet

## 0.2.73-beta - 2026-11-28
- Clip editor: new pure src/mixCore.js (mixDown) mixes a mono voice with optional mono/stereo music into a stereo pair with gain, offset, loop, fades, ducking and a 0.99 limiter, with tests; not imported by the app yet

## 0.2.72-beta - 2026-11-28
- Clip editor: new pure src/mixDuck.js (duckEnvelope, gainAtSample) builds a per-frame ducking gain envelope from a voice track for mixing under music, with tests; not imported by the app yet

## 0.2.71-beta - 2026-11-28
- Clip editor: src/clipPlayer.js load accepts a mono Float32Array or an array of one or two channel arrays (extra channels ignored, empty array is no audio) and builds the buffer with the matching channel count; no UI change

## 0.2.70-beta - 2026-11-28
- Clip editor: type a cut time (s, m:ss, h:mm:ss, comma decimals) in "Cut at" and press Enter, and edit a selected marker's time in place; exact reasons show under the tools row, with a marker picker, one-undo-step moves and no change to existing handlers

## 0.2.69-beta - 2026-11-28
- Clip editor: delete a cut with Delete/Backspace or the new button, clip times and list update live during marker drags, and a Refresh button reloads saved cuts for the current audio

## 0.2.68-beta - 2026-11-28
- Clip editor: Start Reading is disabled while the editor is open, clip rows can be reordered by grip drag (visual only), the Text panel highlights the playing clip's text, and sentence highlights keep rounded corners across line breaks

## 0.2.67-beta - 2026-11-28
- Clip editor: new pure src/clipTime.js parses typed cut times (seconds, m:ss, h:mm:ss, comma decimals) to an exact sample with reason strings, with tests; not imported by the app yet

## 0.2.66-beta - 2026-11-27
- Clip editor: file names now come from the clip text in src/ClipEditor.jsx (ZIP, CSV, single download and the row download title), with the single clip aligned to its own segment; App.jsx untouched

## 0.2.65-beta - 2026-11-27
- Clip editor: unnamed clips are named from the first six words of their text (nameFromText in src/clipSlices.js, optional texts argument in src/clipExport.js), so audio file names and the CSV name column match; no UI change

## 0.2.64-beta - 2026-11-27
- Clip editor: each clip row's name field shows that clip's own spoken text as its placeholder (with a ~ prefix and a hover title when estimated), and the strip below shows the clip under the playhead as "Clip N of M - chunk K"; src/ClipEditor.jsx and src/App.css only

## 0.2.63-beta - 2026-11-27
- Clip editor: new pure src/clipText.js maps a sample range back to the spoken text (pause-aligned, sentence and word snapping, 300-character cap) with tests; not imported by the app yet

## 0.2.62-beta - 2026-11-27
- Clip editor: Fade in / Fade out toggles and an All clips / Selected clips scope picker in the export row; rows are selectable (click, Ctrl+click, Shift+click) and the selection drives per-clip fades

## 0.2.61-beta - 2026-11-27
- Clip editor: a Loop clips toggle in the transport row; a clip's play button repeats between its two cuts while on, the looping row is highlighted, and cuts that change restart the loop on the new range

## 0.2.60-beta - 2026-11-27
- Clip editor: draggable playhead (ruler strip scrub, playhead handle, grab the line in the waveform) and a Go to start button plus Home key

## 0.2.59-beta - 2026-11-27
- Clip editor fits the panel height: tools row above the waveform, transport below, only the clip list flexes and scrolls, the chunk text strip stays last and fully visible; per-clip row reordered to play, download, name, times, duration

## 0.2.58-beta - 2026-11-27
- Added range looping to src/clipPlayer.js (play opts.loop, setLoop, wrapped position, loop-aware seek and getState), with appended tests and no UI change

## 0.2.57-beta - 2026-11-27
- Separate fade-in/fade-out and per-clip fade selection in clipSlices.js and clipExport.js, with tests (no UI change)

## 0.2.56-beta - 2026-11-27
- Clip editor export: ZIP, single-clip and cut-list CSV download buttons with picker-first saving, injected encoders and an opt-in fade toggle

## 0.2.55-beta - 2026-11-27
- Added src/clipExport.js: sequential clip encoding with fades, unique file names, skipped empty clips, cut-list CSV bytes and ZIP entries, with 11 focused tests

## 0.2.54-beta - 2026-11-26
- Clip editor: centre the zoom/blade/undo row, dim the helper text to teal, one more clip-list row, and the same × close button as Settings

## 0.2.53-beta - 2026-11-26
- Clip editor: reader takes two thirds while editing, coral markers and faded hint row, blade tool, taller clip list, and play/timer on the zoom row

## 0.2.52-beta - 2026-11-26
- Clip editor footer: shortcuts and restored-cut count share one row above the bottom separator, the list gets more height and the name field is much wider

## 0.2.51-beta - 2026-11-26
- Clip editor list polish: highlight only the playing clip button, show the cut's first sentence as the name placeholder, space the rows, drop the timeline end numbers, pin chunk info to the bottom and style the transport play button like the playbar

## 0.2.50-beta - 2026-11-26
- Clip editor clip list: per-clip play/pause buttons and editable names that stay with their clip when cuts change

## 0.2.49-beta - 2026-11-26
- Clip editor: hold Shift while cutting or dragging a cut to snap to the quietest spot within 80 ms, with a snapped hover preview and a marker drag preview

## 0.2.48-beta - 2026-11-26
- Remember cut markers per audio in the clip editor, with restore, debounced saving and exact storage failure reasons

## 0.2.47-beta - 2026-11-26
- Added clip editor markers: slice tool, M key, undo/redo, cut lines, clip list and CSS

## 0.2.46-beta - 2026-11-26
- Added clip editor playback with playhead, click-to-seek, Space control, chunk text strip and transport CSS

## 0.2.45-beta - 2026-11-26
- Locked the bottom player bar while the clip editor is open, with an exact tooltip, and passed chunk texts to the editor

## 0.2.44-beta - 2026-11-26
- Added src/clipSnap.js: quiet-spot snapping and key-press reaction compensation with tests

## 0.2.43-beta - 2026-11-26
- Added src/clipMarkerStore.js: per-audio marker store with injected storage and tests

## 0.2.42-beta - 2026-11-26
- Added src/clipSlices.js: pure sample slicing, edge fades and safe clip names with tests

## 0.2.41-beta - 2026-11-26
- Added src/clipCsv.js: pure cut-list CSV writer with spreadsheet-safe escaping, with tests

## 0.2.40-beta - 2026-11-26
- Added a 15-minute decoded-audio length limit to the clip editor loader, with tests

## 0.2.39-beta - 2026-11-26
- Limited clip editor max zoom to about 0.4 s, moved the close button to the Reader head, and put zoom tools between elapsed and remaining time

## 0.2.38-beta - 2026-11-26
- Added wheel zoom, drag scroll and zoom tools to the clip editor waveform with pure clipView maths

## 0.2.37-beta - 2026-11-26
- Added src/clipView.js: pure zoom and scroll window maths for the clip editor

## 0.2.36-beta - 2026-11-26
- Added src/clipPlayer.js: lazy AudioContext-backed mono buffer player with play, pause, seek, position and end callback

## 0.2.35-beta - 2026-11-26
- Fixed the Edit clips tooltip and closed a stale clip editor when provider, voice, chunk size or text changes

## 0.2.34-beta - 2026-11-26
- Wired the clip editor into the Reader panel: Edit clips button, scope picker, waveform view and desktop-only gating

## 0.2.33-beta - 2026-11-26
- Added src/clipEditorLoad.js: pure loader that joins cached chunk audio to mono and reports skipped chunks

## 0.2.32-beta - 2026-11-26
- Added src/ClipEditor.jsx: read-only waveform view with chunk boundaries and scope picker

## 0.2.31-beta - 2026-11-26
- Added src/clipEditorAudio.js: pure mono chunk concatenation for a later clip editor

## 0.2.30-beta - 2026-11-26
- Added src/waveformPeaks.js: pure waveform peak pyramid for a later clip editor

## 0.2.29-beta - 2026-11-26
- Added src/clipCuts.js: pure cut-marker state with undo/redo for a later clip editor

## 0.2.28-beta - 2026-11-22
- Settings labels shortened: "Cache", "Clear", "Save" and "Clear"; removed the blue mobile tap-highlight

## 0.2.27-beta - 2026-11-22
- Text fullscreen: play/pause and exit buttons are the same 48px round size, both offset 24px from the sides and 32px from the bottom

## 0.2.26-beta - 2026-11-22
- Text fullscreen keeps a floating play/pause button in the bottom-left corner on desktop and mobile; the fullscreen exit button gets more margin

## 0.2.25-beta - 2026-11-22
- Settings: "Audio cache" is now just "Catch"; the fullscreen exit button moved from the top-right to the bottom-right corner with a margin

## 0.2.24-beta - 2026-11-22
- Settings drawer now spreads over the full height with more room between rows and a little more between sections

## 0.2.23-beta - 2026-11-22
- Settings drawer: Save key / Clear key split the row 50/50, Save settings is centred in its footer, the voice field stays on screen for providers without a voice list so switching providers no longer jumps, Chunk size and Lookahead share one row, and number inputs lost their stepper arrows

## 0.2.22-beta - 2026-11-22
- Settings drawer: one text-button style for provider, daily limit, highlight and download format (icons kept on WAV/MP3); removed the reset layout control and its helpers, the section titles and the separator lines; cache size now sits next to the Audio cache label

## 0.2.21-beta - 2026-11-22
- Settings drawer mobile: icon-button pickers (provider, daily limit, highlight, download format) matching Plinth Upscaler node Size section; shortened inputs/sliders/buttons to match Clear key width

## 0.2.20-beta - 2026-11-22
- Settings drawer mobile: label + input in one row per setting, tighter sections, no dividers, spellcheck hidden, reset layout hidden

## 0.2.19-beta - 2026-11-22
- Settings drawer mobile layout: full-width inputs, wrapped rows, equal buttons, proper footer

## 0.2.18-beta - 2026-11-22
- Highlight back on phones: removed phone-only override, uses saved setting
- Player buttons equal width on mobile (4 columns)

## 0.2.17-beta - 2026-11-22
- Mobile: player seek 2/3 width, speed slider 1/3 width on same row (corrected)

## 0.2.16-beta - 2026-11-22
- Mobile: player seek 2/3 width, speed slider 1/3 width on same row; speed label hidden

## 0.2.15-beta - 2026-11-22
- Mobile: player seek bar 2/3 width, speed slider 1/3 width, speed label hidden; text panel horizontal padding reduced

## 0.2.14-beta - 2026-11-22
- Fix undeclared setStatus in handleReadSelection: four failure/info calls replaced with setNotice + logEvent so selection read errors show in player-bar notice and status bar log instead of throwing ReferenceError

## 0.2.13-beta - 2026-11-22
- Phone errors visible: status bar shows while a failure reason is set, with room reserved only then

## 0.2.12-beta - 2026-11-22
- Lint cleanup only: three no-unused-expressions warnings in App.jsx rewritten, no behavior change

## 0.2.11-beta - 2026-11-22
- Highlight off on phones: effective mode forces none under 768px, map building skips; saved setting untouched

## 0.2.10-beta - 2026-11-22
- Phone: the text panel row splits, speaker/talker icon left and the three icon buttons pushed to the right edge

## 0.2.9-beta - 2026-11-22
- Phone space cleanup: hide find row, TEXT label, speaker icon and status bar; two-row player grid; small scrolling reader list; Start Reading becomes a circular talking icon on phones

## 0.2.8-beta - 2026-11-22
- Phone settings: requests chip in the drawer header, Provider dropdown at the top of the Voice card; top bar originals hidden on phones

## 0.2.7-beta - 2026-11-21
- Phone top bar as a grid with explicit rows; player notice hidden, equal 40px slider labels

## 0.2.6-beta - 2026-11-21
- Phone layout fix: Text row spacer hidden, provider select forced onto the second top-bar row

## 0.2.5-beta - 2026-11-21
- Phone layout polish: full-height Text panel, one-line find and Start rows, two-row top bar, equal sliders

## 0.2.4-beta - 2026-11-21
- Phone layout under 768px: panels stack, bars wrap, tap targets 44px, drawer full width

## 0.2.3-beta - 2026-11-21
- Favicon and touch icon added for the browser tab

## 0.2.2-beta - 2026-11-20
- Reject files that are not .txt or .md; IndexedDB open no longer hangs; cache failures are logged in the status bar

## 0.2.1-beta - 2026-11-20
- Web build uses base /voice/app/; Load and drop accept only .txt and .md

## 0.2.0-beta - 2026-11-09
- Project moves from alpha to beta testing; version 0.2.0-beta.

## 0.1.105-alpha - 2026-11-09
- Text fullscreen: a floating exit button in the top-right corner closes it with the mouse.

## 0.1.104-alpha - 2026-11-09
- Text fullscreen: only the textarea stays visible (the reading view while playing); the panel title, find row, stats, buttons and reason are hidden.

## 0.1.103-alpha - 2026-11-09
- Text fullscreen: a toggle button next to Clear, the Ctrl+Shift+Space handler listens in the capture phase and also accepts event.code Space, and the status bar log shows 'Text fullscreen on/off'.

## 0.1.102-alpha - 2026-11-09
- Ctrl+Shift+Space shows the Text panel fullscreen; fix: the panel was hidden together with its parent .columns. Reader, player bar, status bar and settings are hidden while it is on.

## 0.1.101-alpha - 2026-11-09
- Two panels: Job panel removed; job errors, pause state and Resume live in the Reader note.

## 0.1.100-alpha - 2026-11-09
- Reader pane: .job-note strip for errors and paused/cap state.

## 0.1.99-alpha - 2026-11-09
- Reader chunk rows: per-chunk progress bar and Pause/Resume/Cancel icons on the active row.

## 0.1.98-alpha - 2026-11-09
- Selected-character count moved from Job panel to bottom status bar.

## 0.1.97-alpha - 2026-11-09
- Top bar: "Requests today" shown as a teal pill, "(estimate)" removed.

## 0.1.96-alpha - 2026-11-09
- Highlight map: retry failed maps and log the real reason.

## 0.1.95-alpha - 2026-11-09
- Highlight now uses alignTimeMap (break-to-pause alignment) instead of the timeMap.js map, and corrects the decoded-audio/player length difference before looking up the character; log lines now read "aligned X of Y breaks, Z pauses".

## 0.1.94-alpha - 2026-11-09
- Added src/alignMap.js: alignTimeMap matches the punctuation breaks of a chunk text to the real pauses in its audio by dynamic programming (skippable breaks, long-pause bonus), so one wrong pause no longer shifts every later break.

## 0.1.93-alpha - 2026-11-09
- Highlight map is now triggered by the player (reading + chunk index + status) instead of the scheduler playhead effect, so every playing chunk gets a map; a chunk with no cached audio yet logs "no cached audio yet (estimated)".

## 0.1.92-alpha - 2026-11-09
- Highlight now follows the real pauses: the playing chunk's cached audio is decoded, its silences are found and mapped to character indexes; word and sentence highlight use that map, falling back to the old estimate when a chunk's map cannot be built.

## 0.1.91-alpha - 2026-11-09
- Added src/timeMap.js: buildTimeMap turns findSilences pauses into a playback-time to character-index map (longest pauses kept, weighted inside a sentence, holds during a pause).

## 0.1.90-alpha - 2026-11-09
- Added src/silenceMap.js: a pure module that finds the real pauses in a chunk's decoded audio (10 ms RMS frames, relative threshold, leadIn and tail reported separately).

## 0.1.89-alpha - 2026-11-09
- Requests today now refreshes at once after a speaker icon request (success, failure or cap error).

## 0.1.88-alpha - 2026-11-09
- Selection speaker icon now sits at the top-right corner of the selection (above it), not below it.

## 0.1.87-alpha - 2026-11-09
- Selection speaker icon now works: appears after a selection, reads it aloud, stops on a second press, hides on outside mousedown, Esc, scroll and text/provider/voice changes, and yields to main playback.

## 0.1.86-alpha - 2026-11-09
- Selection speaker icon groundwork: selectionReadState module and tests; App state and handler.

## 0.1.85-alpha - 2026-11-09
- Reader panel: the Download card sits closer to the panel edges with tighter padding, and its label is "Download".

## 0.1.84-alpha - 2026-11-09
- Reader panel: the two download buttons now sit in a Downloads card with a separator, and their labels are shortened to "All chunks" and "All joined".

## 0.1.83-alpha - 2026-11-09
- Settings Display card: the Font leading slider now also drives the reading view line spacing, so the row distance persists while reading.

## 0.1.82-alpha - 2026-11-09
- Settings Display card: a Font leading slider next to Font weight adjusts the text panel line spacing (1.0-2.5) and is saved with the settings.

## 0.1.81-alpha - 2026-11-09
- Text panel find: the match is selected and scrolled into the middle of the textarea while typing and on Previous/Next, and the selection uses the accent colour.

## 0.1.80-alpha - 2026-11-09
- Text panel: a find row above the textarea searches the text case-insensitively, with a match count, Previous/Next buttons, Enter/Shift+Enter/Esc, and a clear button.

## 0.1.79-alpha - 2026-11-09
- Job panel: Pause and Cancel now each take half the panel width.

## 0.1.78-alpha - 2026-11-09
- Settings drawer Storage title: cache size back to two decimals (e.g. 123.04 MB), and the duplicate size under Audio cache is removed.

## 0.1.77-alpha - 2026-11-09
- Settings drawer: the Storage card title now shows the live cache size in parentheses, Save settings also slides the drawer closed, and the slide-out is slower (0.5s) than the slide-in (0.3s).

## 0.1.76-alpha - 2026-11-09
- Settings drawer: audio cache size now shows whole MB only, and the drawer slides in from the right on the cogwheel and slides back out to the right when it closes.

## 0.1.75-alpha - 2026-11-09
- Settings drawer: every drawer button (including the X close) now uses the same hover style as Save/Clear key, and clicking outside the drawer (e.g. into the text) closes it and saves the settings automatically.

## 0.1.74-alpha - 2026-11-09
- Settings drawer Storage & layout card: Clear audio cache and Reset layout buttons are the same width, the card label uses "&", the "Panel order and size." text is gone, and the cache size now shows as just "X MB" next to Audio cache.

## 0.1.73-alpha - 2026-11-09
- Settings drawer footer: removed the "Applies voice..." helper under Save settings and gave the button a balanced 16px margin above and below.

## 0.1.72-alpha - 2026-11-09
- Settings drawer Downloads card: "Chunk download format" is now "Download format" and its helper text is removed; the MP3/WAV dropdown is unchanged.

## 0.1.71-alpha - 2026-11-09
- Settings drawer Display card: font weight slider, highlight dropdown and spell check toggle are now the same width and line up on the same left edge.

## 0.1.70-alpha - 2026-11-09
- Settings drawer Display card: removed the font weight, highlight and spell check helpers, renamed "Highlight while reading" to "Highlight on reading", and removed the font weight slider's number indicator; the controls are unchanged.

## 0.1.69-alpha - 2026-11-09
- Settings drawer Reading card: removed the chunk size, lookahead and daily limit helpers and all three "Applied with Save settings." notes; the controls are unchanged.

## 0.1.68-alpha - 2026-11-09
- Settings drawer Voice card: removed the voice hint, the model line and the "Applied with Save settings." footnote; the voice dropdown is unchanged.

## 0.1.67-alpha - 2026-11-09
- Settings drawer Connection card: API key field is longer, "Saved key" and its divider are gone, and Save key / Clear key each take half the width.

## 0.1.66-alpha - 2026-11-09
- Settings drawer: removed the "Stored in this browser only", "Your text is sent to OpenRouter." and Key set/No key texts from the Connection card; no function changed.

## 0.1.65-alpha - 2026-11-09
- Settings drawer: controls grouped into cards with a sticky header and a sticky Save settings footer; no control or handler changed.

## 0.1.64-alpha - 2026-11-09
- Reader panel: the two download buttons moved to the bottom of the panel, are always visible, and are renamed "Download all chunks" and "Download all joined".

## 0.1.63-alpha - 2026-11-09
- Job panel: download the whole text as one joined audio file (MP3 concatenated or encoded, WAV streamed); the save dialog opens first and the status bar shows progress.

## 0.1.62-alpha - 2026-11-09
- Job panel: download the ready chunks as one ZIP (stored, no compression); the save dialog opens first, chunks with no audio are skipped and logged.

## 0.1.61-alpha - 2026-11-09
- Chunk download can now encode MP3 in the browser from PCM/WAV (lazy lamejs import), and one shared convertChunk handles every format pair.

## 0.1.60-alpha - 2026-11-09
- Reader: each chunk row's Play button is now a Download icon button; Settings chooses MP3 or WAV, and WAV is decoded from MP3 in the browser when needed.

## 0.1.59-alpha - 2026-11-08
- Text pane: word highlight timing is weighted per character so it moves slower across pauses, and words mode leads the voice by 0.12s; sentence timing is unchanged.

## 0.1.58-alpha - 2026-11-08
- Settings: a Spell check toggle turns the browser's red underlines in the Text pane on or off; it is saved and stays across reloads.

## 0.1.57-alpha - 2026-11-08
- Job pane: selecting text in the reading view while the voice plays shows the selected character count; the word/sentence highlight pauses during the selection.

## 0.1.56-alpha - 2026-11-08
- Reader: click a chunk row to jump to that chunk and start reading; Retry and Play still work on their own.

## 0.1.55-alpha - 2026-11-08
- Job pane: the character count of the text selected in the Text pane shows at the bottom and disappears when the selection is cleared.

## 0.1.54-alpha - 2026-11-08
- Text pane: the sentence highlight is pulled back 0.15s so it no longer rushes ahead of the voice.

## 0.1.53-alpha - 2026-11-08
- Text pane: Ctrl+wheel zoom works during playback, the word highlight tracks the voice more closely, and a None option shows the text without highlights.

## 0.1.52-alpha - 2026-11-08
- Text pane highlights the word or sentence being read while playing; Settings can switch words/sentences.

## 0.1.51-alpha - 2026-11-08
- Settings: font weight slider moves in steps of 100 and uses the player slider accent color.

## 0.1.50-alpha - 2026-11-08
- Settings: font weight is a slider from 100 to 800 using the variable font, replacing the four-weight dropdown.

## 0.1.49-alpha - 2026-11-08
- Job panel: one Pause/Resume button works (highlighted while paused); Resume continues from the playing chunk, also after Cancel. Fix: an unexpected scheduler error now shows the error state.

## 0.1.48-alpha - 2026-11-08
- Generation follows playback: scheduler playhead tracks the player, ready chunks wake the player

## 0.1.47-alpha - 2026-11-06
- Dropping a file clears audio cache and resets playback.

## 0.1.46-alpha - 2026-11-06
- Status hint to press Start Reading after dropping a file.

## 0.1.45-alpha - 2026-11-06
- Fix drag-over tint being overridden on the textarea.

## 0.1.44-alpha - 2026-11-06
- Lighter full-area tint while dragging a file over the text panel.

## 0.1.43-alpha - 2026-11-06
- Highlight text panel while a file is dragged over it.

## 0.1.42-alpha - 2026-11-06
- Drop .txt/.md/.doc files onto the text panel to load them.

## 0.1.41-alpha - 2026-11-06
- No entry was written for this version.

## 0.1.40-alpha - 2026-11-06
- Text panel clear/load moved to right as circular icons.

## 0.1.39-alpha - 2026-11-06
- Drag shows grip as drag image.

## 0.1.38-alpha - 2026-11-06
- Highlight playing chunk row via activeRowIndex.

## 0.1.37-alpha - 2026-11-06
- Fix jumpy speed slider.

## 0.1.36-alpha - 2026-11-06
- player forgets loaded audio when provider or voice changes

## 0.1.35-alpha - 2026-11-06
- Move Reset layout button into Settings drawer.

## 0.1.34-alpha - 2026-11-06
- Fix provider handler and switch lock.

## 0.1.33-alpha - 2026-11-06
- provider switch: Fish Audio and HeyGen

## 0.1.32-alpha - 2026-11-06
- Add provider registry, PCM/WAV support, and provider-aware settings.

## 0.1.31-alpha - 2026-11-06
- middle panel may grow up to 80 percent

## 0.1.30-alpha - 2026-11-06
- panels resize by drag and keyboard, always fill the window

## 0.1.29-alpha - 2026-11-06
- Wire panelWidths logic into the UI with grid columns and resize handles.

## 0.1.28-alpha - 2026-11-06
- Make side and middle panel sizing depend on current panel order.

## 0.1.27-alpha - 2026-11-06
- Add maximum widths to side panels and the middle panel.

## 0.1.26-alpha - 2026-11-06
- Make the middle panel flexible and keep the rightmost panel inside the app border.

## 0.1.25-alpha - 2026-11-06
- Make the middle panel fill the space between the leftmost and rightmost panels.

## 0.1.24-alpha - 2026-11-06
- Make the rightmost panel always stick to the right application border.

## 0.1.23-alpha - 2026-11-06
- Make all panels stick together and fill the application width with no gaps.

## 0.1.22-alpha - 2026-11-06
- Make rightmost panel stick to the app edge and show a small drag ghost.

## 0.1.21-alpha - 2026-11-06
- Keep resized panels within application borders and prevent overflow.

## 0.1.20-alpha - 2026-11-06
- Fix panel resize minimum width and keep all panels filling the available width.

## 0.1.19-alpha - 2026-11-06
- Add functional panel width resize handles with minimum widths and flex reflow.

## 0.1.18-alpha - 2026-11-06
- Implement functional player controls: play, pause, stop, previous, next, seek, speed, volume, and playback state.

## 0.1.17-alpha - 2026-11-06
- Draggable panels: grip in each panel header, teal drop marker, order saved in the browser, Reset layout button, Alt+Left and Alt+Right on a focused grip.

## 0.1.16-alpha - 2026-11-06
- Layout polish: panel headers, wrapped chunk rows with status badges, player bar placeholder, JetBrains Mono, no overlap with the status bar.

## 0.1.15-alpha - 2026-11-06
- Fix catch blocks that used an undefined e and hid the real error; add a source-scan test.

## 0.1.14-alpha - 2026-11-06
- Add theme.css: teal buttons, thin dark scrollbars, focus outlines, 0.25s transitions.

## 0.1.13-alpha - 2026-11-05
- playerEngine with tests.

## 0.1.12-alpha - 2026-11-05
- playerCore with tests.

## 0.1.11-alpha - 2026-11-05
- Daily limit setting (50 or 1000).

## 0.1.10-alpha - 2026-11-05
- Fix cache read path: store returns bytes, cache no double unwrap.

## 0.1.9-alpha - 2026-11-05
- Honest cache writes and on-screen cache check.

## 0.1.8-alpha - 2026-11-05
- Play path visibility in status bar.

## 0.1.7-alpha - 2026-11-05
- Visible status bar and swallowed-error surfacing.

## 0.1.6-alpha - 2026-11-05
- wiring and first live read of 3 chunks with HTML audio.

## 0.1.5-alpha - 2026-11-05
- scheduler with tests.

## 0.1.4-alpha - 2026-11-05
- App shell: dark layout, text panel with counts, settings drawer.

## 0.1.3-alpha - 2026-11-05
- audioCache and requestCounter with tests.

## 0.1.2-alpha - 2026-11-05
- speechClient: classifyError and requestSpeech with retry and tests.

## 0.1.1-alpha - 2026-11-05
- textPipeline: cleanText and chunkText with tests.

## 0.1.0-alpha - 2026-11-05
- Repo setup: Vite shell with a dark top bar and the version read from package.json.
