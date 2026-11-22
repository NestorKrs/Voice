# Changelog

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
