# LinkedIn draft 01 — BolNote (AI lane)
State: DRAFT_READY · package INCOMPLETE (live URL + screen recording
come after deploy) · NOT approved, NOT scheduled.

## Draft copy

My lecture recordings were dying in my phone.

I checked why the big note-taking apps could not help. On Otter's own
pricing page: the free plan stops a conversation at 30 minutes, lets
you import 3 files in your entire lifetime, and transcribes in six
languages. Hindi is not one of them.

So I built the thing I needed. It is called BolNote.

You upload a recording — Hindi, English, Hinglish, up to 4 hours. It
comes back as a transcript you can search. The summary is not a black
box: every point carries the exact second it came from, so you can tap
and hear it yourself instead of trusting the AI.

Two honest things I learned while building it:

1. The transcription API kept rejecting my server with a 403. The
model was fine, the key was fine. The culprit was my HTTP library's
default identity string — the service's front door blocks it. One
line fixed it. Half a day went into finding that line.

2. On a hard recording — an old, dense Hindi discourse — the
transcript is rough in places. On clear speech it is strong. I am not
going to quote an accuracy number I did not measure. The timestamps
are the safety net: any line is one tap from the audio it came from.

Speaker names are the known gap. The service I use does not provide
them, so BolNote does not pretend to.

Next: real Hinglish conversations — lectures, interviews, client
calls — tested one recording at a time.

## Evidence packet (for the approval package)
- Problem evidence: otter.ai/pricing, read directly 24 Nov 2026
  (30-min cap, 3 lifetime imports, 6 languages, no Hindi).
- Build evidence: local git f03c927; tests 12/12; live smoke on a
  real 40-second Hindi recording (language detected Hindi, segments
  + 3-point summary, 0 invented action items).
- Claims NOT made: no accuracy %, no user counts, no market size.
- Missing before approval can be requested: live HTTPS URL, GitHub
  repo URL, screen recording of the deployed product + narration.
