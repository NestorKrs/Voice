# Changelog

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
