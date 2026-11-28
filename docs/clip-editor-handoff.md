# Clip editor handoff

Scope: ONLY the clip editor feature. The general project status stays in docs/handoff.md (stale at 0.2.19-beta; do not use it for this feature).
Owner: @Eleven. Updated 2026-11-28. Version when written: 0.2.76-beta. Agents: Hermes (code), Claude (planning, task texts).

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
- Snap to the nearest quiet spot only while a key is held (uses src/clipSnap.js with its own small quiet-spot search, NOT src/silenceMap.js, which finds long pauses).
- Key-press markers get a small reaction-time compensation; owner tunes the value live. Bluetooth headsets add 150 to 250 ms audio delay, so the playhead may look early; a manual playhead offset constant may be needed.
- Source: one chunk or the whole joined audio, owner chooses.
- UI: the editor renders inside the Reader section and hides the chunk list and the Download card (no new grid panel).
- Playback: the editor has its own player (Web Audio, src/clipPlayer.js) with play/pause under the waveform, a moving playhead, and the playing chunk's text shown under the waveform. Space toggles play/pause while the editor is open (not while typing in a field). While the editor is open the bottom bar player is disabled with an exact reason, so there is ONE obvious play control. The Text panel highlight does not follow the editor (decided).
- Output: play button on each clip, editable name per clip, per-clip download AND one ZIP. Format follows Settings (MP3 or WAV).
- Fades: tiny fades at cut edges are an optional toggle, OFF by default (a few ms when on). The mixer plan (src/mixPlan.js) is shared by the live preview and the export graph, so the two cannot disagree.
- Markers are saved in the browser per audio (capped, oldest dropped); key = the audio's cache key (one chunk) or the ordered chunk keys joined (whole text).
- Export writes a cut list CSV (clip name, start, end; milliseconds and m:ss.mmm; names escaped) next to the ZIP.
- Desktop only in v1: show the exact reason on phones.
- Cuts are made at sample level on decoded audio, then encoded with the existing encoders (cutting MP3 bytes is not exact).
- Unnamed clips are named from the first six words of their text, joined with hyphens, 50 characters max (src/clipSlices.js nameFromText); a typed name always wins.

## Ideas taken from storytold/soundcraft and storytold/filmcraft (Rust, inspiration only, no code reuse)
Integer time; every edit a pure command with undo; peak overviews; tiny fades at cut edges against clicks; cut list CSV export; markers saved per audio in the browser; nudge steps. Not wanted: plugins, MIDI, multitrack, automation.

## Task log (statuses from CHANGELOG.md)
2.29a orient; 2.29b src/clipCuts.js pure cut state with undo/redo - DONE 0.2.29-beta; 2.29d src/waveformPeaks.js peak pyramid - DONE 0.2.30-beta (sent twice; the second run stopped with no change); 2.30a src/clipEditorAudio.js concatMono; 2.30b src/ClipEditor.jsx read-only waveform view and CSS - DONE 0.2.31-beta/0.2.32-beta; 2.30c src/clipEditorLoad.js loader - DONE 0.2.33-beta
2.30d wiring into App.jsx (Edit clips button, state, load handlers, Reader swap) - DONE 0.2.34-beta. Live test by the owner: looks right, cannot cut yet.
2.30e tooltip fix and close-on-stale - STOPPED by Hermes (the reset effect is declared above closeClipEditor); 2.30f tooltip fix and close-on-stale (new effect below closeClipEditor) - DONE 0.2.35-beta
2.31a src/clipView.js pure zoom and scroll maths; 2.31b src/clipPlayer.js Web Audio player (fake-context tests) - DONE 0.2.37-beta/0.2.36-beta; 2.31c ClipEditor zoom, wheel, drag, X and plus/minus icons - DONE 0.2.38-beta (refined 0.2.39-beta)
2.32g src/clipEditorLoad.js decoded length limit (MAX_EDIT_SECONDS 900) and tests - DONE 0.2.40-beta; 2.32b src/clipCsv.js cut-list CSV writer and tests - DONE 0.2.41-beta (not imported by the app yet); 2.32c src/clipSlices.js sample slicing, fades and safe clip names - DONE 0.2.42-beta (not imported by the app yet)
2.32d src/clipMarkerStore.js per-audio marker store with injected storage - DONE 0.2.43-beta (not imported by the app yet; test import is the wiring proof); 2.32e src/clipSnap.js quiet-spot snapping and key-press reaction compensation - DONE 0.2.44-beta (not imported by the app yet; test import is the wiring proof); 2.33a bottom player bar locked while the editor is open with the exact tooltip, chunkTexts passed to ClipEditor - DONE 0.2.45-beta (prop passed but not consumed by ClipEditor yet); 2.33b playback in ClipEditor (transport, playhead, click-to-seek, Space, chunk text strip) and transport CSS - DONE 0.2.46-beta
2.34a markers in ClipEditor (slice tool, M key, undo/redo, cut lines, clip list) and CSS - DONE 0.2.47-beta; 2.34c remember cut markers per audio (audio key, store restore, debounced save) - DONE 0.2.48-beta
2.35a hold Shift to snap slice click, M key, marker drag and hover line to the quietest spot within 80 ms; hint and CSS - DONE 0.2.49-beta (the dragMarker STOP anchor was stale; marker drag was added here)
2.36a clip list with per-clip play/pause and editable names; src/clipNames.js alignment helper and CSS - DONE 0.2.50-beta (the clipNames.js STOP anchor was stale; the pure module was created here)
2.36b list feedback (row play highlight, first-sentence placeholders, roomier rows, no end numbers, chunk info pinned, playbar-style transport) and 2.36c footer layout (hint and restore note in one row, taller list, wider name inputs) - DONE 0.2.51-beta/0.2.52-beta
2.36d editor opening takes two thirds of the width via CSS, coral markers and faded shortcut row, blade icon/text, taller list, play/timer on the zoom row - DONE 0.2.53-beta (App.jsx untouched); 2.36e centre the zoom/blade/undo tools, remove the helper highlight and dim its text to teal, use the Settings × close button, list +1 row - DONE 0.2.54-beta (one App.jsx line changed)
2.37a src/clipExport.js pure clip export (clipFileNames, buildClipFiles, buildCutListFile, buildZipEntries) and tests - DONE 0.2.55-beta (not imported by the app yet; test import is the wiring proof; App.jsx untouched); 2.37b export from the editor: saveClipFile + clipExportDeps in App.jsx, ZIP/CSV/per-clip buttons, fade toggle and CSS - DONE 0.2.56-beta (wired; App.jsx handlers untouched)
2.40a separate fade-in/fade-out and per-clip fades in clipSlices.js and clipExport.js - DONE 0.2.57-beta (no UI, App.jsx untouched; not imported by the app yet; test import is the wiring proof); 2.40b looping in src/clipPlayer.js (play opts.loop, setLoop, wrapped position, loop-aware seek, getState range) with appended tests - DONE 0.2.58-beta (no UI, App.jsx untouched; not imported by the app yet; test import is the wiring proof)
2.40c fit the editor into the panel height (tools above waveform, transport below, only the list flexes and scrolls, chunk strip last) and per-clip row reordered to play, download, name, times, duration - DONE 0.2.59-beta (App.jsx untouched); 2.40d draggable playhead (ruler strip scrub, playhead handle, grab the line in the waveform) and Go to start button + Home key in src/ClipEditor.jsx with CSS - DONE 0.2.60-beta (App.jsx untouched); 2.40e Loop clips toggle in the transport row, per-clip loop play/pause/resume, looping row highlight and loop-follows-cuts in src/ClipEditor.jsx with CSS - DONE 0.2.61-beta (App.jsx untouched)
2.40f Fade in / Fade out toggles, All/Selected scope picker and row selection (click, Ctrl+click, Shift+click) driving per-clip fades in src/ClipEditor.jsx with CSS - DONE 0.2.62-beta (App.jsx untouched)
2.41a src/clipText.js pure sample-range to text mapper (SNAP_CHARS, MAX_TEXT_CHARS, createClipTextMapper) and tests - DONE 0.2.63-beta (no UI, App.jsx untouched; not imported by the app yet; test import is the wiring proof); 2.41b clip row and strip show each clip's own text (name placeholder, hover title, "Clip N of M - chunk K") in src/ClipEditor.jsx and src/App.css - DONE 0.2.64-beta (App.jsx untouched)
2.42a nameFromText in src/clipSlices.js and an optional texts argument in src/clipExport.js so unnamed clips are named from their text (audio names and CSV match), with appended tests - DONE 0.2.65-beta (no UI, App.jsx untouched; not imported by the app yet; test import is the wiring proof); 2.42b file names from the clip text in src/ClipEditor.jsx (clipTextList, texts in exportArgs, aligned single download, row download title) - DONE 0.2.66-beta (App.jsx untouched)
2.43a src/clipTime.js pure typed-time parser (parseTime) and tests - DONE 0.2.67-beta (no UI, App.jsx untouched; not imported by the app yet; test import is the wiring proof); 2.43b Start Reading disabled while the editor is open, visual clip-row reorder by grip drag (src/clipOrder.js with tests), Text panel shows the playing clip's text as one highlight block, and rounded sentence highlight across line breaks - DONE 0.2.68-beta (App.jsx, ClipEditor.jsx, App.css and source tests changed; all wired)
2.43c cut markers can be deleted (Delete/Backspace or button, nearestMarkerIndex in src/clipCuts.js with tests), clip times/list update live during marker drags, and a Refresh button reloads saved cuts - DONE 0.2.69-beta (all wired; untested live)
2.43b typed cut times in src/ClipEditor.jsx (Cut at field, editable selected-marker time, marker picker, timeMsg line) and CSS - DONE 0.2.70-beta (App.jsx untouched; all wired; untested live)
2.44a src/clipPlayer.js load accepts mono or one/two channel arrays (extra ignored, empty = no audio) with appended tests - DONE 0.2.71-beta (no UI, App.jsx untouched; not imported by the app yet; test import is the wiring proof)
2.44b new pure src/mixDuck.js (DUCK_FRAME_MS, DEFAULT_DUCK, duckEnvelope, gainAtSample) per-frame ducking envelope with tests - DONE 0.2.72-beta (no UI, App.jsx untouched; not imported by the app yet; test import is the wiring proof)
2.44c new pure src/mixCore.js (mixDown) mixes mono voice with optional mono/stereo music into a stereo pair (gain, offset, loop, fades, ducking, 0.99 limiter) with tests - DONE 0.2.73-beta (no UI, App.jsx untouched; not imported by the app yet; test import is the wiring proof)
2.44d new pure src/mixLoad.js (musicFileRejection, loadMusicFile) guards and decodes a music file (.mp3/.wav/.m4a/.ogg, 30 MB, 5:00, rate match) with tests - DONE 0.2.74-beta (no UI, App.jsx untouched; not imported by the app yet; test import is the wiring proof)
2.45a new pure src/mixPlan.js (MAX_MIX_VOICE_SECONDS, DEFAULT_PARAMS, normalizeParams, clampStartSec, parseOffsetTime, buildMixPlan, fadeValueAt, scheduleAt, peakBound) one shared plan of numbers and curves for the live preview and the export graph with tests - DONE 0.2.75-beta (no UI, App.jsx untouched; not imported by the app yet; test import is the wiring proof)
2.45b new pure src/mixEngine.js (createMixEngine) drives the live mix graph from the shared plan (load/setPlan/play/pause/seek/getPosition/getState/setOnEnd/close) with a hand-written fake-context test - DONE 0.2.76-beta (no UI, App.jsx untouched; not imported by the app yet; test import is the wiring proof)
Next: none — all earlier planned items are DONE: orient 2.32a (docs only, no bump); E4d 2.33a/2.33b 0.2.45-beta/0.2.46-beta; E4e 2.34a 0.2.47-beta; E5 2.34c 0.2.48-beta; E6 2.35a 0.2.49-beta; E7 2.36a-2.36c 0.2.50-beta/0.2.51-beta/0.2.52-beta; E8 2.37a/2.37b 0.2.55-beta/0.2.56-beta.

## Known gaps
- Export is wired to the editor but not tested live in Brave yet; nothing about zoom, scroll or playback has been tested live in Brave yet.
- Whole joined audio is capped at 900 s (~15 min) decoded; longer text must be edited one chunk at a time.
- The real encoders (encodeWav/encodeMp3 via clipExportDeps.encode) and the save dialog (saveClipFile) are wired; output is untested live.
- src/clipMarkerStore.js is wired to the editor for markers; names are not saved or restored, and clear is not wired yet.
- src/clipSnap.js snapToQuiet is wired to Shift snapping for slice click, M, marker drag and the hover line; untested live.
- Marker drag previews the clip list live and commits on release, and Delete/Backspace removes the nearest cut, but both are untested live; arrow-key nudge is still not wired. Refresh reloads saved cuts for the current audio only and is untested live. Marker saving and restore are untested live in Brave.
- A name is dropped when its clip is deleted (no name history); undo cannot bring that name back.
- Zero-length segments are skipped in audio files but still listed in cut-list.csv (buildCutListFile takes no skip input).
- A skipped-clip note or export failure in exportMsg hides the editor body: the existing message gate shows the message instead of the controls.
- Coral #ff6f6f replaces the marker orange inside the editor only; the app-wide --accent is still teal (#4fa9a2).
- The two-thirds width override, the centred tool row and the Settings-style close button are untested live in Brave.
- Per-clip play/pause, editable names, first-sentence placeholders and the playing-button highlight are untested live in Brave; so are the footer row, the taller list and the wider name field.
- The bottom-bar lock, the transport, click-to-seek, Space, cut lines and the clip list are untested live in Brave.
- The new height fit (tools row above the waveform, transport below, only the list flexes and scrolls, chunk strip pinned last) and the reordered clip row (play, download, name, times, duration) are untested live in Brave.
- The playhead may look early on a Bluetooth headset; the manual offset is tuned in a later task.
- Fade in / Fade out toggles, the All/Selected scope picker and row selection (click, Ctrl+click, Shift+click) are wired into the export calls but untested live in Brave; the single-clip download fades by the original clip index (restricted set [] or [0]).
- Looping is wired to the editor (Loop clips toggle, per-clip loop play, looping row highlight, loop follows cuts) but untested live in Brave; resuming a paused non-loop clip and a paused loop after a cut change need a live check.
- The ruler strip, playhead handle, grab-the-line scrub and Go to start (button and Home) are wired but untested live in Brave. Clip text is approximate unless the cut lands on a pause: src/clipText.js falls back to a linear position estimate and marks that part estimated.
- Clip text placeholders, the hover title and the clip strip ("Clip N of M - chunk K") are wired but untested live in Brave.
- nameFromText and the texts argument are wired into the export path (ZIP, CSV, single download, row download title) but untested live in Brave.
- Typed cut times are wired (Cut at field, editable selected-marker time, marker picker) but untested live in Brave, and the marker picker is the only way to select a marker (no click-to-select on the waveform); the "arrows: 1 ms, Shift: 10 ms, Delete removes" hint is shown next to the marker time field, but arrow-key nudge is still not wired.
- Clip-row drag order is display-only (not saved, not used by playback or export); the Text panel highlight falls back to the whole chunk when the clip text cannot be found in it.
- The live mix engine (src/mixEngine.js) is untested with real audio: the fake-context test proves call sequences only, not that the mix sounds right.

## Open decisions
- Reaction-time compensation value and playhead offset (tuned live).
- Public access (each visitor needs their own OpenRouter key) and request-cost warnings: decide before the editor is announced.
- Parked features: mixer, auto-suggest from pauses, and Space for the main player.

## Rules for agents
Follow AGENTS.md and the voice skill. One task per message. Touch only named files. App.jsx is one big component: exact anchors and the duplicate check. New pure modules go in src/*.js with tests/*.test.mjs (node cannot import .jsx). Mock everything; no real audio or IndexedDB here, so the owner tests live. EVERY clip-editor task ends by updating this file in place (task log, known gaps, verified, version) and lists it in READY TO COMMIT with its own git add line.

## Verified
- npm test: 615 pass, 0 fail (2026-11-28, 0.2.76-beta; full raw run pasted in the task report).
- node --check clean on src/mixEngine.js and tests/mixEngine.test.mjs. .jsx and .css cannot be compiled here, so the owner's vship build is the real check.
- Owner must test live in Brave: nothing to test live yet for 2.45b — src/mixEngine.js is not imported by the app until a later task wires the mixer. When it is wired, play a voice with and without music, a delayed and a negative music start, a loop, fades and ducking, and confirm it sounds right and the position and pause/seek behave.
