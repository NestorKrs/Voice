# Voice

Personal, single-user, browser-only text-to-speech reader. Paste or drop long text and it reads it aloud, chunk by chunk, with OpenRouter's free models: Fish Audio S2.1 Pro Free (mp3) and HeyGen Voice Turbo Free (pcm). Switch providers in the top bar.

Status: 0.1.48-alpha. Plan: docs/plan.md. Handoff: docs/handoff.md.

Run: npm install, then npm run dev, then open http://127.0.0.1:5180/

Features: three draggable, resizable panels (Text, Reader, Job); bottom player with speed 0.75x to 2x, volume and seek; settings drawer (API key, voice, chunk size, lookahead, daily limit, font weight, audio cache); status bar with an event log; audio cache in IndexedDB; text and settings in localStorage.

Limits: .txt/.md/.doc files load as plain text (.docx and .pdf are not parsed yet); there is no Download button yet; playback uses HTML audio, not gapless Web Audio.

Privacy: the pasted text is sent to OpenRouter. The API key is typed into the app and stays in this browser.
