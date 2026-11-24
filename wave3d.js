/* BolNote "Waveform Ridge" — the recording's own energy shape as a 3D
   timeline. Click/hover map x-position -> time fraction, so the ridge
   and the transcript are two views of the same thing.
   Falls back to a flat 2D canvas waveform when WebGL/THREE is missing.
   See design/3D_EXPERIENCE_SPEC.md. */
(function () {
  "use strict";

  function RidgeWave(canvas, opts) {
    this.canvas = canvas;
    this.onSeek = (opts && opts.onSeek) || function () {};
    this.onHover = (opts && opts.onHover) || function () {};
    this.energies = [];
    this.duration = 0;
    this.segments = [];
    this.playFrac = 0;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.mode = "2d";
    this._bindPointer();
    this._tryInit3D();
    if (this.mode !== "3d") this._draw2D();
  }

  RidgeWave.prototype.setEnergies = function (energies, duration) {
    this.energies = energies || [];
    this.duration = duration || 0;
    if (this.mode === "3d") this._buildRidge(); else this._draw2D();
  };
  RidgeWave.prototype.setSegments = function (segments) {
    this.segments = segments || [];
    if (this.mode === "3d") this._buildNotches(); else this._draw2D();
  };
  RidgeWave.prototype.setPlayhead = function (frac) {
    this.playFrac = Math.max(0, Math.min(1, frac || 0));
    if (this.mode === "3d") this._render3D(); else this._draw2D();
  };
  RidgeWave.prototype.dispose = function () {
    if (this.renderer) { this.renderer.dispose(); this.renderer = null; }
    this.energies = []; this.segments = [];
    if (this.mode !== "3d") this._draw2D();
  };

  /* ---------- pointer: one mapping for 3D and 2D ---------- */
  RidgeWave.prototype._fracFromEvent = function (ev) {
    var rect = this.canvas.getBoundingClientRect();
    return Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
  };
  RidgeWave.prototype._bindPointer = function () {
    var self = this;
    this.canvas.addEventListener("click", function (ev) { self.onSeek(self._fracFromEvent(ev)); });
    this.canvas.addEventListener("pointermove", function (ev) { self.onHover(self._fracFromEvent(ev), ev); });
    this.canvas.addEventListener("pointerleave", function () { self.onHover(null); });
  };
  RidgeWave.prototype.segmentAt = function (frac) {
    if (!this.duration) return null;
    var t = frac * this.duration;
    for (var i = 0; i < this.segments.length; i++) {
      if (t >= this.segments[i].start && t <= this.segments[i].end) return this.segments[i];
    }
    return null;
  };

  /* ---------- 2D fallback ---------- */
  RidgeWave.prototype._draw2D = function () {
    var ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    var w = this.canvas.width = this.canvas.clientWidth * (window.devicePixelRatio || 1);
    var h = this.canvas.height = this.canvas.clientHeight * (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0b0b0f"; ctx.fillRect(0, 0, w, h);
    var n = this.energies.length;
    if (n) {
      ctx.fillStyle = "#f5b83d";
      var bw = w / n;
      for (var i = 0; i < n; i++) {
        var bh = Math.max(2, this.energies[i] * (h * 0.82));
        ctx.fillRect(i * bw, (h - bh) / 2, Math.max(1, bw * 0.7), bh);
      }
    }
    ctx.fillStyle = "#ece7db";
    ctx.fillRect(this.playFrac * w - 1, 0, 2, h);
  };

  /* ---------- Three.js ridge ---------- */
  RidgeWave.prototype._tryInit3D = function () {
    if (typeof THREE === "undefined") return;
    try {
      var renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer = renderer;
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x0b0b0f);
      this.scene.fog = new THREE.Fog(0x0b0b0f, 30, 60);
      this.camera = new THREE.PerspectiveCamera(42, 2, 0.1, 100);
      this.camera.position.set(-7.5, 4.2, 11);
      this.camera.lookAt(2.5, 0.6, 0);
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      var key = new THREE.DirectionalLight(0xf5b83d, 1.1);
      key.position.set(4, 8, 6); this.scene.add(key);
      var floor = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 24),
        new THREE.MeshStandardMaterial({ color: 0x121218, roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; this.scene.add(floor);
      this.ridgeGroup = new THREE.Group(); this.scene.add(this.ridgeGroup);
      this.playhead = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 3.4, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xece7db }));
      this.scene.add(this.playhead);
      this.mode = "3d";
      this._resize();
      var self = this;
      window.addEventListener("resize", function () { self._resize(); self._render3D(); });
      if (!this.reduced) {
        this.canvas.addEventListener("pointermove", function (ev) {
          var r = self.canvas.getBoundingClientRect();
          var nx = (ev.clientX - r.left) / r.width - 0.5;
          self.camera.position.x = -7.5 + nx * 1.6;
          self.camera.lookAt(2.5, 0.6, 0);
          self._render3D();
        });
      }
      this._buildRidge();
    } catch (err) {
      this.mode = "2d"; this.renderer = null;
    }
  };
  RidgeWave.prototype._resize = function () {
    if (!this.renderer) return;
    var w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  };
  RidgeWave.prototype._buildRidge = function () {
    if (this.mode !== "3d") return;
    while (this.ridgeGroup.children.length) {
      var child = this.ridgeGroup.children.pop();
      if (child.geometry) child.geometry.dispose();
    }
    var data = this.energies.length ? this.energies : demoEnergies();
    var n = data.length, width = 22, depth = 1.6;
    var positions = [], indices = [];
    for (var i = 0; i < n; i++) {
      var x = -width / 2 + (i / (n - 1)) * width;
      var y = 0.12 + data[i] * 2.6;
      positions.push(x, 0, -depth / 2, x, y, -depth / 2, x, y, depth / 2, x, 0, depth / 2);
      if (i < n - 1) {
        var a = i * 4, b = a + 4;
        indices.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2, a + 2, b + 2, a + 3, b + 2, b + 3, a + 3);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices); geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0xf5b83d, roughness: 0.45, metalness: 0.25 }));
    this.ridgeGroup.add(mesh);
    this._buildNotches();
    this._render3D();
  };
  RidgeWave.prototype._buildNotches = function () {
    if (this.mode !== "3d" || !this.duration) return;
    var width = 22;
    var notchGeo = new THREE.BoxGeometry(0.05, 0.3, 1.9);
    var notchMat = new THREE.MeshBasicMaterial({ color: 0x101014 });
    var self = this;
    this.segments.forEach(function (seg) {
      var x = -width / 2 + (seg.start / self.duration) * width;
      var notch = new THREE.Mesh(notchGeo, notchMat);
      notch.position.set(x, 0.15, 0);
      self.ridgeGroup.add(notch);
    });
    this._render3D();
  };
  RidgeWave.prototype._render3D = function () {
    if (this.mode !== "3d" || !this.renderer) return;
    var width = 22;
    this.playhead.position.x = -width / 2 + this.playFrac * width;
    this.playhead.position.y = 1.7;
    this.renderer.render(this.scene, this.camera);
  };

  function demoEnergies() {
    var out = [];
    for (var i = 0; i < 120; i++) out.push(0.12 + 0.1 * Math.abs(Math.sin(i * 0.35)));
    return out;
  }

  window.RidgeWave = RidgeWave;
})();
