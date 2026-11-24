# BolNote — 3D Experience Spec: "The Waveform Ridge"

## What it is
The recording's own waveform, drawn as a raised 3D ridge (extruded
line of peaks) on a dark studio floor, built with Three.js. It is the
audio timeline itself, spatialised — the primary navigation control
for the transcript, not a decoration.

## How the domain maps to the scene
- Ridge peaks = per-segment audio energy (RMS per transcript segment,
  computed in the browser from the decoded audio buffer).
- Ridge length = recording duration; segment boundaries are notches.
- A brass playhead marker travels the ridge during playback.
- Clicking (raycast) a ridge segment: seeks the audio to that
  segment's start, scrolls the transcript to it, highlights it.
- Hovering a segment shows its timestamp + first words in a tooltip.
- Empty state (no file yet): a low, quiet ridge generated from a
  built-in demo waveform shape, clearly inert (no fake transcript).

## Why this is meaningful, not decorative
MeetMap (CHI 2025) and the Descript/Granola research both show users
navigate recordings by *moments*, not by scrubbing a flat line. The
ridge makes loud/quiet structure and segment boundaries visible at a
glance, so a user can jump straight to the animated part of a lecture
or the quiet answer in an interview. Remove the ridge and the product
loses its fastest navigation path — that is the test it passes.

## Performance + fallback rules
- One canvas, one scene, capped DPR (≤1.5), geometry disposed on new
  file load. Ridge geometry is a single BufferGeometry (≤ ~600
  segments) — trivially cheap.
- Pauses rendering when the tab is hidden or the canvas is off-screen
  (IntersectionObserver).
- Low-end / no-WebGL fallback: a flat 2D canvas waveform with the same
  click-to-seek behaviour. The transcript remains fully usable with
  JavaScript 3D disabled — semantic HTML first, 3D as enhancement.
- `prefers-reduced-motion`: static camera, no travelling light
  animation (playhead still updates position on seek/play ticks).

## Camera + interaction
- Fixed gentle perspective from front-left; slow parallax on pointer
  move (disabled under reduced motion). No orbit controls — this is a
  tool, not a toy; keyboard users navigate via the transcript itself
  (every segment is a real <button>).
