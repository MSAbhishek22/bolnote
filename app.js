/* BolNote app controller. State machine follows design/INTERACTION_INVENTORY.md:
   no control is shown unless it works. */
(function () {
  "use strict";
  var U = window.BolNoteUtils;

  var els = {};
  ["dropzone", "fileInput", "fileMeta", "fileName", "fileInfo", "newBtn",
   "langSelect", "transcribeBtn", "cancelBtn", "progress", "player",
   "ridge", "ridgeTip", "searchBox", "hitCount", "copyBtn", "txtBtn",
   "srtBtn", "transcriptEmpty", "transcript", "notesBtn", "notesStatus",
   "summaryList", "actionList"].forEach(function (id) { els[id] = document.getElementById(id); });

  var state = {
    file: null, objectUrl: null, audioBuffer: null, duration: 0,
    segments: [], chunkResults: [], nextChunk: 0, plan: [],
    running: false, cancel: false, detectedLanguage: null
  };

  var ridge = new window.RidgeWave(els.ridge, {
    onSeek: function (frac) {
      if (!state.duration) return;
      els.player.currentTime = frac * state.duration;
      if (els.player.paused && state.objectUrl) els.player.play().catch(function () {});
    },
    onHover: function (frac, ev) {
      if (frac === null || !state.segments.length) { els.ridgeTip.hidden = true; return; }
      var seg = ridge.segmentAt(frac);
      if (!seg) { els.ridgeTip.hidden = true; return; }
      els.ridgeTip.hidden = false;
      els.ridgeTip.textContent = U.formatTime(seg.start) + " — " + seg.text.slice(0, 60) + "…";
      var wrap = els.ridge.getBoundingClientRect();
      els.ridgeTip.style.left = Math.min(wrap.width - 270, Math.max(0, (ev.clientX - wrap.left) + 10)) + "px";
      els.ridgeTip.style.top = "6px";
    }
  });

  /* ---------------- file loading ---------------- */
  function pickFile() { els.fileInput.click(); }
  els.dropzone.addEventListener("click", pickFile);
  els.dropzone.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickFile(); } });
  els.dropzone.addEventListener("dragover", function (e) { e.preventDefault(); els.dropzone.classList.add("dragover"); });
  els.dropzone.addEventListener("dragleave", function () { els.dropzone.classList.remove("dragover"); });
  els.dropzone.addEventListener("drop", function (e) {
    e.preventDefault(); els.dropzone.classList.remove("dragover");
    if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
  });
  els.fileInput.addEventListener("change", function () {
    if (els.fileInput.files.length) loadFile(els.fileInput.files[0]);
  });

  function loadFile(file) {
    if (!/^(audio|video)\//.test(file.type) && !/\.(mp3|m4a|wav|ogg|webm|mp4|flac)$/i.test(file.name)) {
      setProgress("That file does not look like audio or video. Try an mp3, m4a, wav, ogg, webm or mp4 recording.");
      return;
    }
    resetWork();
    state.file = file;
    state.objectUrl = URL.createObjectURL(file);
    els.player.src = state.objectUrl;
    els.player.hidden = false;
    els.fileMeta.hidden = false;
    els.fileName.textContent = file.name;
    els.fileInfo.textContent = "reading the audio…";
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    file.arrayBuffer().then(function (buf) { return ctx.decodeAudioData(buf); })
      .then(function (decoded) {
        state.audioBuffer = decoded;
        state.duration = decoded.duration;
        if (state.duration > U.MAX_SECONDS) {
          setProgress("This recording is longer than 4 hours. BolNote handles up to 4 hours in one go.");
          els.fileInfo.textContent = U.formatTime(state.duration) + " — too long for one go";
          return;
        }
        els.fileInfo.textContent = U.formatTime(state.duration) + " · " + Math.round(file.size / 1024) + " KB";
        ridge.setEnergies(computeEnergies(decoded, 240), state.duration);
        state.plan = U.planChunks(state.duration);
        els.transcribeBtn.disabled = false;
        setProgress("Ready. " + state.plan.length + (state.plan.length === 1 ? " piece" : " pieces") + " to transcribe.");
      })
      .catch(function () {
        els.fileInfo.textContent = "";
        setProgress("This browser could not read that audio. Try converting it to mp3 or wav first.");
      });
  }

  function computeEnergies(buffer, buckets) {
    var data = buffer.getChannelData(0);
    var per = Math.floor(data.length / buckets), out = [];
    for (var i = 0; i < buckets; i++) {
      var sum = 0, start = i * per;
      for (var j = 0; j < per; j += 16) { var v = data[start + j] || 0; sum += v * v; }
      out.push(Math.min(1, Math.sqrt(sum / (per / 16)) * 2.4));
    }
    return out;
  }

  /* ---------------- chunked transcription ---------------- */
  function sliceWavBlob(buffer, startSec, endSec) {
    var rate = 16000;
    var srcRate = buffer.sampleRate;
    var start = Math.floor(startSec * srcRate), end = Math.min(buffer.length, Math.floor(endSec * srcRate));
    var src = buffer.getChannelData(0).subarray(start, end);
    var ratio = srcRate / rate;
    var len = Math.floor(src.length / ratio);
    var pcm = new Int16Array(len);
    for (var i = 0; i < len; i++) {
      var v = Math.max(-1, Math.min(1, src[Math.floor(i * ratio)]));
      pcm[i] = v < 0 ? v * 0x8000 : v * 0x7FFF;
    }
    var wav = new ArrayBuffer(44 + pcm.length * 2);
    var view = new DataView(wav);
    function wstr(off, s) { for (var i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); }
    wstr(0, "RIFF"); view.setUint32(4, 36 + pcm.length * 2, true); wstr(8, "WAVEfmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); wstr(36, "data"); view.setUint32(40, pcm.length * 2, true);
    for (var k = 0; k < pcm.length; k++) view.setInt16(44 + k * 2, pcm[k], true);
    return new Blob([wav], { type: "audio/wav" });
  }

  els.transcribeBtn.addEventListener("click", function () { runTranscription(); });
  els.cancelBtn.addEventListener("click", function () { state.cancel = true; });

  function runTranscription() {
    if (state.running || !state.audioBuffer) return;
    state.running = true; state.cancel = false;
    els.transcribeBtn.disabled = true; els.cancelBtn.hidden = false;
    var language = els.langSelect.value;
    var i = state.nextChunk;

    function step() {
      if (state.cancel) {
        finishRun("Stopped. The pieces above are safe — Transcribe resumes where it left off.");
        return;
      }
      if (i >= state.plan.length) {
        state.nextChunk = 0; state.chunkResults = state.chunkResults; // keep for reference
        finishRun("Done. " + state.segments.length + " lines, " +
          (state.detectedLanguage ? "recognised language: " + state.detectedLanguage + ". " : "") +
          "Tap any line to hear it.");
        els.notesBtn.disabled = state.segments.length === 0;
        return;
      }
      var chunk = state.plan[i];
      setProgress("Transcribing piece " + (i + 1) + " of " + state.plan.length +
        " (" + U.formatTime(chunk.start) + " – " + U.formatTime(chunk.end) + ")…");
      var blob = sliceWavBlob(state.audioBuffer, chunk.start, chunk.end);
      var form = new FormData();
      form.append("audio", blob, "chunk-" + i + ".wav");
      if (language) form.append("language", language);
      fetch("/api/transcribe", { method: "POST", body: form })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "failed"); return j; }); })
        .then(function (result) {
          if (result.language) state.detectedLanguage = result.language;
          state.chunkResults.push({ offset: chunk.start, segments: result.segments || [], text: result.text || "" });
          state.nextChunk = i + 1;
          state.segments = U.mergeSegments(state.chunkResults);
          renderTranscript();
          ridge.setSegments(state.segments);
          i++;
          step();
        })
        .catch(function (err) {
          finishRun("Piece " + (i + 1) + " didn't come back (" + err.message + "). " +
            "Your finished pieces are safe above — Transcribe retries from piece " + (i + 1) + ".");
        });
    }
    step();
  }

  function finishRun(message) {
    state.running = false;
    els.cancelBtn.hidden = true;
    els.transcribeBtn.disabled = !state.audioBuffer || state.duration > U.MAX_SECONDS;
    els.transcribeBtn.textContent = state.nextChunk > 0 && state.nextChunk < state.plan.length
      ? "Retry from piece " + (state.nextChunk + 1) : "Transcribe";
    setProgress(message);
    var has = state.segments.length > 0;
    els.copyBtn.disabled = els.txtBtn.disabled = els.srtBtn.disabled = !has;
  }

  function setProgress(text) { els.progress.textContent = text; }

  /* ---------------- transcript rendering + playback sync ---------------- */
  function renderTranscript() {
    els.transcriptEmpty.hidden = state.segments.length > 0;
    els.transcript.innerHTML = "";
    state.segments.forEach(function (seg) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "seg"; btn.dataset.index = seg.index;
      btn.dataset.script = seg.script;
      var stamp = document.createElement("span"); stamp.className = "stamp"; stamp.textContent = U.formatTime(seg.start);
      var text = document.createElement("span"); text.textContent = seg.text;
      btn.appendChild(stamp); btn.appendChild(text);
      btn.addEventListener("click", function () {
        els.player.currentTime = seg.start;
        if (els.player.paused) els.player.play().catch(function () {});
      });
      li.appendChild(btn);
      els.transcript.appendChild(li);
    });
    applySearch();
  }

  els.player.addEventListener("timeupdate", function () {
    if (!state.duration) return;
    ridge.setPlayhead(els.player.currentTime / state.duration);
    var t = els.player.currentTime;
    var active = null;
    state.segments.forEach(function (seg) { if (t >= seg.start && t <= seg.end) active = seg; });
    els.transcript.querySelectorAll(".seg").forEach(function (el) {
      el.classList.toggle("active", active && +el.dataset.index === active.index);
    });
  });

  function seekToSegment(index) {
    var seg = state.segments[index];
    if (!seg) return;
    els.player.currentTime = seg.start;
    if (els.player.paused && state.objectUrl) els.player.play().catch(function () {});
    var el = els.transcript.querySelector('.seg[data-index="' + index + '"]');
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  /* ---------------- search ---------------- */
  var hitIndexes = [], hitCursor = -1;
  function applySearch() {
    var q = els.searchBox.value.trim().toLowerCase();
    hitIndexes = []; hitCursor = -1;
    els.transcript.querySelectorAll(".seg").forEach(function (el) {
      var seg = state.segments[+el.dataset.index];
      var hit = q && seg && seg.text.toLowerCase().indexOf(q) !== -1;
      el.classList.toggle("hit", !!hit);
      if (hit) hitIndexes.push(seg.index);
    });
    els.hitCount.textContent = q ? (hitIndexes.length ? hitIndexes.length + " found" : "no matches in this transcript") : "";
  }
  els.searchBox.addEventListener("input", applySearch);
  els.searchBox.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && hitIndexes.length) {
      hitCursor = (hitCursor + 1) % hitIndexes.length;
      seekToSegment(hitIndexes[hitCursor]);
    }
  });

  /* ---------------- notes ---------------- */
  els.notesBtn.addEventListener("click", function () {
    if (!state.segments.length) return;
    els.notesBtn.disabled = true;
    els.notesStatus.textContent = "Making notes from your transcript…";
    fetch("/api/summarize", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segments: state.segments })
    })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "failed"); return j; }); })
      .then(function (notes) {
        renderNotes(notes);
        els.notesStatus.textContent = "Every point below links to the second it came from. Check one.";
      })
      .catch(function (err) { els.notesStatus.textContent = "Notes didn't come back (" + err.message + "). Your transcript is safe — try again."; })
      .finally(function () { els.notesBtn.disabled = false; });
  });

  function noteItem(item, isAction) {
    var li = document.createElement("li");
    var seg = state.segments[item.at];
    var at = document.createElement("button");
    at.type = "button"; at.className = "at";
    at.textContent = "[" + U.formatTime(seg ? seg.start : 0) + "]";
    at.setAttribute("aria-label", "Hear the moment this came from");
    at.addEventListener("click", function () { seekToSegment(item.at); });
    if (isAction) {
      var label = document.createElement("label");
      var box = document.createElement("input"); box.type = "checkbox";
      var key = "bolnote-action-" + (state.file ? state.file.name : "") + "-" + item.at + "-" + item.text.slice(0, 24);
      box.checked = localStorage.getItem(key) === "1";
      box.addEventListener("change", function () { localStorage.setItem(key, box.checked ? "1" : "0"); });
      label.appendChild(box);
      label.appendChild(document.createTextNode(item.text));
      li.appendChild(label); li.appendChild(at);
    } else {
      li.appendChild(document.createTextNode(item.text));
      li.appendChild(at);
    }
    return li;
  }

  function renderNotes(notes) {
    els.summaryList.innerHTML = "";
    (notes.summary || []).forEach(function (item) { els.summaryList.appendChild(noteItem(item, false)); });
    els.actionList.innerHTML = "";
    if ((notes.actions || []).length === 0) {
      var li = document.createElement("li");
      li.className = "muted"; li.textContent = "No action items were actually asked for in this recording.";
      els.actionList.appendChild(li);
    }
    (notes.actions || []).forEach(function (item) { els.actionList.appendChild(noteItem(item, true)); });
  }

  /* ---------------- exports + reset ---------------- */
  function download(name, content, type) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: type || "text/plain" }));
    a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  els.copyBtn.addEventListener("click", function () {
    navigator.clipboard.writeText(U.toPlainText(state.segments)).then(function () { setProgress("Transcript copied."); });
  });
  els.txtBtn.addEventListener("click", function () { download("bolnote-transcript.txt", U.toPlainText(state.segments)); });
  els.srtBtn.addEventListener("click", function () { download("bolnote-transcript.srt", U.toSRT(state.segments)); });
  els.newBtn.addEventListener("click", function () {
    resetWork();
    els.fileMeta.hidden = true; els.player.hidden = true; els.player.removeAttribute("src");
    els.fileInput.value = ""; setProgress("");
  });

  function resetWork() {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state = { file: null, objectUrl: null, audioBuffer: null, duration: 0, segments: [],
              chunkResults: [], nextChunk: 0, plan: [], running: false, cancel: false,
              detectedLanguage: null };
    els.transcript.innerHTML = "";
    els.transcriptEmpty.hidden = false;
    els.summaryList.innerHTML = ""; els.actionList.innerHTML = "";
    els.transcribeBtn.disabled = true; els.transcribeBtn.textContent = "Transcribe";
    els.notesBtn.disabled = true;
    els.copyBtn.disabled = els.txtBtn.disabled = els.srtBtn.disabled = true;
    ridge.dispose();
  }
})();
