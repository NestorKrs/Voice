# Changelog

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
