# Clip editor handoff

Scope: ONLY the clip editor feature. The general project status stays in docs/handoff.md (stale at 0.2.19-beta; do not use it for this feature).
Owner: @Eleven. Updated 2026-11-26. Version when written: 0.2.43-beta. Agents: Hermes (code), Claude (planning, task texts).

## Goal
Cut one generated audio (one chunk, or the whole joined audio) into many clips by time, locally, with ZERO extra requests. The owner pastes unrelated sentences, generates once, then cuts them into separate files. Used mainly for voiceover for animation and video. Meant for all visitors of the site, desktop only in v1.

## Why not one request per line
Rejected by the owner: it costs credits (50 per day free, 1000 with credits, 20 per minute, shared, failed attempts count).

## Decisions (final)
- Cut points: mainly press a key (M) while the audio plays; also a slice (scissors) tool that cuts where you click on the waveform; also typed times. Auto-suggest from pauses is unreliable: optional, last.
- Time is whole samples (integers). Timer and nudge precision 1 ms (Shift = 10 ms).
- Waveform with zoom: plain mouse wheel zooms around the pointer, drag scrolls, double-click shows all, plus and minus icon buttons above the waveform. Peak pyramid (src/waveformPeaks.js) keeps zoom fast.
- The Close control is an X icon button only. Icon buttons reuse class icon-btn with 16px stroke SVGs.
- Marker controls v1: drag, arrow-key nudge, delete, undo/redo, zoom, slice tool.
- Snap to the nearest quiet spot only while a key is held (uses src/silenceMap.js).
- Key-press markers get a small reaction-time compensation; owner tunes the value live. Bluetooth headsets add 150 to 250 ms audio delay, so the playhead may look early; a manual playhead offset constant may be needed.
- Source: one chunk or the whole joined audio, owner chooses.
- UI: the editor renders inside the Reader section and hides the chunk list and the Download card (no new grid panel).
- Playback: the editor has its own player (Web Audio, src/clipPlayer.js) with play/pause under the waveform, a moving playhead, and the playing chunk's text shown under the waveform. Space toggles play/pause while the editor is open (not while typing in a field). While the editor is open the bottom bar player is disabled with an exact reason, so there is ONE obvious play control. The Text panel highlight does not follow the editor (decided).
- Output: play button on each clip, editable name per clip, per-clip download AND one ZIP. Format follows Settings (MP3 or WAV).
- Fades: tiny fades at cut edges are an optional toggle, OFF by default (a few ms when on).
- Markers are saved in the browser per audio (capped, oldest dropped); key = the audio's cache key (one chunk) or the ordered chunk keys joined (whole text).
- Export writes a cut list CSV (clip name, start, end; milliseconds and m:ss.mmm; names escaped) next to the ZIP.
- Desktop only in v1: show the exact reason on phones.
- Cuts are made at sample level on decoded audio, then encoded with the existing encoders (cutting MP3 bytes is not exact).

## Ideas taken from storytold/soundcraft and storytold/filmcraft (Rust, inspiration only, no code reuse)
Integer time; every edit a pure command with undo; peak overviews; tiny fades at cut edges against clicks; cut list CSV export; markers saved per audio in the browser; nudge steps. Not wanted: plugins, MIDI, multitrack, automation.

## Task log (statuses from CHANGELOG.md)
2.29a orient - NOT DONE
2.29b src/clipCuts.js pure cut state with undo/redo - DONE 0.2.29-beta
2.29d src/waveformPeaks.js peak pyramid - DONE 0.2.30-beta (sent twice by mistake; the second run stopped with no change)
2.30a src/clipEditorAudio.js concatMono - DONE 0.2.31-beta
2.30b src/ClipEditor.jsx read-only waveform view and CSS - DONE 0.2.32-beta
2.30c src/clipEditorLoad.js loader - DONE 0.2.33-beta
2.30d wiring into App.jsx (Edit clips button, state, load handlers, Reader swap) - DONE 0.2.34-beta. Live test by the owner: looks right, cannot cut yet.
2.30e tooltip fix and close-on-stale - STOPPED by Hermes (the reset effect is declared above closeClipEditor); replaced by 2.30f
2.30f tooltip fix and close-on-stale (new effect below closeClipEditor) - DONE 0.2.35-beta
2.31a src/clipView.js pure zoom and scroll maths - DONE 0.2.37-beta
2.31b src/clipPlayer.js Web Audio player (fake-context tests) - DONE 0.2.36-beta
2.31c ClipEditor zoom, wheel, drag, X and plus/minus icons - DONE 0.2.38-beta (refined 0.2.39-beta)
2.32g src/clipEditorLoad.js decoded length limit (MAX_EDIT_SECONDS 900) and tests - DONE 0.2.40-beta
2.32b src/clipCsv.js cut-list CSV writer and tests - DONE 0.2.41-beta (not imported by the app yet)
2.32c src/clipSlices.js sample slicing, fades and safe clip names - DONE 0.2.42-beta (not imported by the app yet)
2.32d src/clipMarkerStore.js per-audio marker store with injected storage - DONE 0.2.43-beta (not imported by the app yet; test import is the wiring proof)
Next: orient 2.32a; E4d transport under the waveform, moving playhead, Space, chunk text under the playhead, bottom bar disabled reason; E4e cut lines, scissors tool and M key (uses src/clipCuts.js); E5 drag, nudge, delete, undo/redo, saved markers; E6 snap while a key is held; E7 per-clip play and names; E8 export (ZIP, per-clip download, fades toggle, cut list CSV).

## Known gaps
- No markers, no playback and no export yet.
- Nothing about zoom, scroll or playback has been tested live in Brave yet.
- Whole joined audio is capped at 900 s (~15 min) decoded; longer text must be edited one chunk at a time.
- src/clipCsv.js is pure and tested but not wired to any export button yet.
- src/clipSlices.js is pure and tested but not wired to any cut, name or export control yet.
- src/clipMarkerStore.js is pure and tested but not wired to any marker UI yet.

## Open decisions
- Reaction-time compensation value and playhead offset (tuned live).
- Public access (each visitor needs their own OpenRouter key) and request-cost warnings: decide before the editor is announced.

## Rules for agents
Follow AGENTS.md and the voice skill. One task per message. Touch only named files. App.jsx is one big component: exact anchors and the duplicate check. New pure modules go in src/*.js with tests/*.test.mjs (node cannot import .jsx). Mock everything; no real audio or IndexedDB here, so the owner tests live. EVERY clip-editor task ends by updating this file in place (task log, known gaps, verified, version) and lists it in READY TO COMMIT with its own git add line.

## Verified
- npm test: 384 pass, 0 fail (2026-11-26, 0.2.43-beta), including 12 new src/clipMarkerStore.js tests.
- node --check clean on src/clipMarkerStore.js and tests/clipMarkerStore.test.mjs; no imports, no localStorage reference and no app import in the module (test import is the wiring proof; grep on src/App.jsx exits 1).
- Live in Brave: only the read-only waveform and the Edit clips button have been seen; zoom, scroll, playback and cutting are untested.
- Owner must test live: nothing for this task until markers are wired to the editor; then check that markers survive a reload, that a changed total discards them, that the 51st saved audio drops the oldest, that names cut at 60 characters, and that a blocked or full localStorage does not break the editor.
