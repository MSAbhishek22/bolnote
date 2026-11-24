# BolNote — Interaction Inventory

Every visible control, what it does, and its state rules. No dead
controls: anything listed here is implemented and tested; anything not
implemented is not shown.

| Control | Behaviour | States |
|---|---|---|
| Drop zone / "Choose a recording" | Opens file picker (audio/video: mp3, m4a, wav, ogg, webm, mp4); drag-drop also works | idle · dragover (amber outline) · rejected (wrong type → plain-language error) |
| Language select (Auto / Hindi / English / Hinglish mix) | Sets the Whisper language hint: Auto = detect, Hinglish mix = no forced language + script-based segment ticks | always enabled before transcription |
| "Transcribe" button | Disabled until a file is loaded; runs chunked upload → per-chunk progress ("chunk 2 of 5") → merged transcript | disabled · running (progress + Cancel) · done |
| Cancel (during transcription) | Stops further chunk uploads; already-returned chunks stay visible, marked partial | only while running |
| Audio player (native controls) | Plays the local file (object URL — the file never leaves the device except the chunks sent to the transcription API) | standard |
| 3D ridge | Click segment → seek + highlight; hover → tooltip with time + first words | WebGL · 2D fallback · reduced-motion static |
| Transcript segment (button) | Click → seek audio to segment start; active segment highlighted during playback | default · active · search-hit |
| Transcript search box | Live filter: hit count, Enter jumps to next hit, hits highlighted on ridge + text | empty · hits · no hits ("no matches in this transcript") |
| "Summary" panel | Generated from the transcript via the summarize API; every bullet carries a [mm:ss] link that seeks to its source segment | empty ("transcribe first") · loading · ready · failed (plain error + Retry) |
| Action items list | Same source-link rule as summary; checkbox per item (local only, stored in localStorage per file name) | — |
| Copy transcript / Download .txt / Download .srt | Real exports of the actual transcript (SRT built from segment timestamps) | disabled until transcript exists |
| "New recording" | Clears state, disposes 3D geometry, revokes object URL | always after first load |

## Error language (plain, no jargon)
- File too large for one chunk plan (> 4 hours): "This recording is
  longer than 4 hours. BolNote handles up to 4 hours in one go."
- API failure on a chunk: "Chunk 3 didn't come back. Your first chunks
  are safe above — tap Retry to continue from chunk 3."
- Quota: "The free transcription quota is used up for now. Nothing was
  charged; try again later."

# Responsive + accessibility checklist
- [ ] Works at 360px wide: ridge on top, transcript below, controls stack
- [ ] All interactive elements are real buttons/inputs, keyboard reachable
- [ ] Focus visible (amber outline), contrast ≥ 4.5:1 for body text
- [ ] Devanagari renders in a proper font, never tofu boxes
- [ ] prefers-reduced-motion honoured in 3D + CSS
- [ ] Screen-reader labels on icon-only controls; live region announces transcription progress
- [ ] Page usable with WebGL disabled (2D waveform fallback)

# Performance budget
- First load (excl. Three.js CDN): ≤ 120 KB of own CSS/JS
- Three.js: single CDN module, lazy-initialised after first paint
- No continuous rendering loop when idle (render on demand + playhead ticks)
- Chunk uploads: one at a time, ≤ 60s of audio per chunk (~≤ 10 MB WAV)
