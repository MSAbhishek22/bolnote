/* BolNote pure logic — shared by the browser app and the node tests.
   No DOM, no network in here: chunk planning, segment merging,
   timestamps, SRT export, script detection. */
(function (root) {
  "use strict";

  var CHUNK_SECONDS = 55;          // under Groq's 25 MB free-tier file cap at 16 kHz mono WAV
  var MAX_SECONDS = 4 * 3600;      // honest v1 ceiling, stated on the page

  function planChunks(durationSec, chunkSec) {
    chunkSec = chunkSec || CHUNK_SECONDS;
    if (!isFinite(durationSec) || durationSec <= 0) return [];
    var n = Math.ceil(durationSec / chunkSec);
    var plan = [];
    for (var i = 0; i < n; i++) {
      plan.push({ index: i, start: i * chunkSec, end: Math.min(durationSec, (i + 1) * chunkSec) });
    }
    return plan;
  }

  /* chunkResults: [{offset, segments:[{start,end,text}], text, language}]
     Returns one merged, time-ordered segment list with absolute times. */
  function mergeSegments(chunkResults) {
    var merged = [];
    (chunkResults || []).forEach(function (chunk) {
      var offset = chunk.offset || 0;
      (chunk.segments || []).forEach(function (seg) {
        var text = (seg.text || "").trim();
        if (!text) return;
        merged.push({
          start: +(offset + (seg.start || 0)).toFixed(2),
          end: +(offset + (seg.end || seg.start || 0)).toFixed(2),
          text: text,
          script: detectScript(text)
        });
      });
    });
    merged.sort(function (a, b) { return a.start - b.start; });
    merged.forEach(function (seg, i) { seg.index = i; });
    return merged;
  }

  function detectScript(text) {
    var deva = 0, latin = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c >= 0x0900 && c <= 0x097F) deva++;
      else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) latin++;
    }
    if (deva > 0 && latin > 0) return "mixed";
    if (deva > 0) return "devanagari";
    return "latin";
  }

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var s = Math.floor(sec % 60), m = Math.floor((sec / 60) % 60), h = Math.floor(sec / 3600);
    var mm = (m < 10 ? "0" : "") + m, ss = (s < 10 ? "0" : "") + s;
    return h > 0 ? h + ":" + mm + ":" + ss : mm + ":" + ss;
  }

  function srtTime(sec) {
    var ms = Math.round((sec % 1) * 1000);
    var base = formatTime(sec);
    if (base.split(":").length === 2) base = "00:" + base;
    return base + "," + ("00" + ms).slice(-3);
  }

  function toSRT(segments) {
    return (segments || []).map(function (seg, i) {
      return (i + 1) + "\n" + srtTime(seg.start) + " --> " + srtTime(seg.end) + "\n" + seg.text + "\n";
    }).join("\n");
  }

  function toPlainText(segments) {
    return (segments || []).map(function (seg) {
      return "[" + formatTime(seg.start) + "] " + seg.text;
    }).join("\n");
  }

  var api = {
    CHUNK_SECONDS: CHUNK_SECONDS, MAX_SECONDS: MAX_SECONDS,
    planChunks: planChunks, mergeSegments: mergeSegments,
    detectScript: detectScript, formatTime: formatTime,
    srtTime: srtTime, toSRT: toSRT, toPlainText: toPlainText
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BolNoteUtils = api;
})(typeof window !== "undefined" ? window : globalThis);
