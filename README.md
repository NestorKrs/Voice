# Voice

Personal, single-user, browser-only text-to-speech reader. The owner pastes or loads very long text and it reads it aloud, chunk by chunk, using free OpenRouter text-to-speech models.

Models: Fish Audio (fish-audio/s2.1-pro-free:free) and HeyGen (heygen/heygen-voice-1-turbo:free), switchable in Settings. Only models whose ID ends in :free can be called (enforced in src/providers.js).

Status: Beta. The current version is in package.json and the history in CHANGELOG.md.

Features:
- Chunked reading with the next chunks made ahead.
- Audio cache in the browser (IndexedDB), so a chunk is never requested twice.
- Player with play, pause, stop, previous, next, seek, speed and volume.
- The playing chunk is highlighted (word or sentence, switchable in Settings); the highlight follows the real pauses in the audio, found by decoding the chunk and aligning its punctuation breaks to those pauses, and falls back to the old estimate when that fails.
- Select any text and a speaker icon reads just that selection aloud (cached like a chunk).
- A daily request limit setting (50 or 1000).
- A font weight slider (100-800) using the variable font.
- Draggable and resizable panels.
- A phone layout under 768px: stacked panels, wrapping bars, larger tap targets.
- A status bar with an event log.
- Loads .txt and .md files (drag and drop, or the Load button) as plain text.
- Download: each ready chunk, all ready chunks as one ZIP, or the whole text as one joined audio file (MP3 or WAV, chosen in Settings).
- Find in text with Previous/Next.
- Font leading slider and spell check toggle.
- Highlight mode (words, sentences or none).
- Provider switch between Fish Audio and HeyGen.
- Phone layout (the selection speaker icon is off on phones).
- Clip editor (desktop only): cut one generated audio (a chunk or the whole text) into separate clips at exact sample positions, with a zoomable waveform, a moving playhead, an M-key and scissors cut tool, snap to the quietest nearby spot (hold Shift), undo/redo, saved cut markers per audio, editable clip names, per-clip and ZIP download, and a cut list CSV. No extra speech requests are used.

Run: npm install, then npm run dev, then open http://127.0.0.1:5180/. Tests: npm test.
Web build: npm run build makes dist/, built for the path /voice/app/ (set in vite.config.js).

Key: The OpenRouter API key is typed into Settings and stays in this browser's localStorage. It is never written to a file.

Privacy: The pasted text is sent to OpenRouter and to the selected provider (Fish Audio or HeyGen) to make the speech.

Limits: OpenRouter free models allow 50 requests per UTC day (1000 if the account has bought $10 of credits in total) and 20 per minute, shared with all free models. Every attempt counts, including failed ones.
The clip editor decodes audio in memory: editing the whole text at once is limited to 15 minutes; choose a single chunk for longer texts.

Plan: docs/plan.md (original, partly outdated). Rules for coding agents: AGENTS.md.
