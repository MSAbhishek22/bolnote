# BolNote — Design Constitution

**Product in one line:** Upload a phone recording — Hindi, English or
Hinglish — get a transcript you can search, a summary you can audit,
and action items that point back to the exact second they came from.

**Identity: "Night radio studio."** The user is a person alone with a
recording, late in the evening, trying to pull the useful parts out of
it. The page should feel like a quiet studio desk: dark, warm, focused.

## Visual grammar
- Ground: near-black ink `#101014`; panels `#17171d`; hairlines `#26262e`.
- One accent: studio amber `#f5b83d` (the ON-AIR lamp). Recording/play
  state uses the same amber, never a second brand colour.
- Language chips: Hindi/Hinglish segments get an amber left tick;
  English segments a cool grey tick. The tick means "language the
  recogniser heard", computed per file from Whisper's detected language
  plus per-segment script detection (Devanagari vs Latin) — labelled as
  an estimate, never as certainty.
- Type: "Fraunces" for display (warm editorial serif), "Inter" for UI,
  system Devanagari fallback (`Noto Sans Devanagari`) so Hindi text
  never falls back to a mismatched font.
- No gradients, no glassmorphism, no stock illustrations, no fake
  logos or testimonials. Numbers shown are the user's own file's
  numbers (duration, segments, words) — nothing invented.

## Layout (problem → solution → outcome, per the landing rule)
1. Hero: the uploader itself (the product, not a picture of it) over
   the 3D waveform ridge in its empty state.
2. "The problem" — three short lines with the verified Otter facts
   (30-minute free cap, 3 lifetime imports, no Hindi) cited to
   otter.ai/pricing, accessed Nov 2026.
3. "What you get" — the live workflow: transcript, summary with
   source-linked bullets, action items, search.
4. "Honest limits" — no speaker names (Whisper via Groq has no
   diarisation), free-quota ceilings, audio processed via the Groq
   API. Stated on the page, not buried.

## Motion
- The ridge responds to playback (a travelling light). Nothing else
  moves continuously. `prefers-reduced-motion` freezes the ridge
  camera and the playhead light becomes a static marker.
- All animation is transform/opacity only.

## Voice
Plain words, first person where natural ("I built this because my own
lecture recordings were stuck in my phone"). No "revolutionary", no
"supercharge", no guru language — in the page or the LinkedIn draft.
