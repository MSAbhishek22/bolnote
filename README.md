# BolNote

Upload a phone recording in **Hindi, English or Hinglish** — get a
transcript you can search, a summary you can audit, and action items
that point back to the exact second they came from.

Built because the big note apps cannot hear these recordings: on
Otter's own pricing page (Nov 2026) the free plan caps a conversation
at 30 minutes, allows 3 imported files per lifetime, and transcribes
in six languages — Hindi is not one of them.

## What it does
- **Upload-first.** No meeting bot, no account, no minute pool.
- **Chunked transcription** via Groq Whisper (large-v3): the browser
  slices the recording into 55-second pieces, so a 2-hour lecture is
  fine where a 30-minute cap is not.
- **The Waveform Ridge** — a Three.js timeline built from the
  recording's own energy. Click the ridge or any transcript line to
  hear that moment. (2D fallback when WebGL is unavailable.)
- **Auditable notes.** Every summary point and action item carries a
  [mm:ss] link to its source segment. If the notes invent something,
  you can catch it in one tap.
- **Exports:** copy, .txt, .srt — of the real transcript.
- Language ticks per line (amber = Devanagari/mixed script heard).

## Honest limits
- No speaker names — Groq's Whisper endpoint has no diarisation.
- Free-tier quota: heavy use can hit Groq's daily ceiling. No charges.
- Audio is sent to the Groq API in chunks for transcription; BolNote
  stores nothing server-side. Action-item checkboxes live in your
  browser's localStorage.
- Hinglish code-switching is the hard case this is built for — and
  where errors will still happen. Timestamps exist so you can verify.

## Run locally (dev)
```
python3 server.py 8795     # serves the app; /api/* via a key proxy
```
Production is Vercel: static files + `api/transcribe.py` and
`api/summarize.py` as Python functions. Set one env var:
`GROQ_API_KEY`. Note: the API code sets a named User-Agent — Groq's
edge rejects Python's default urllib UA with a 403 (found the hard
way, 24 Nov 2026).

## Tests
```
node tests/test_utils.mjs          # chunk planning, merging, SRT, script detection
python3 -m unittest discover -s tests   # API request shaping, notes parsing (no network)
```
Plus a live smoke (24 Nov 2026): a real 40-second Hindi discourse
recording → language detected "Hindi", timestamped segments, and a
3-point Hindi summary with source links and zero invented action
items.

## Design
`DESIGN_CONSTITUTION.md` + `design/` (reference research, 3D spec,
interaction inventory, budgets). Identity: "night radio studio" —
ink black, one amber accent, no gradients, no fake metrics.
