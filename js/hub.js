/* ============================================================================
   ISLAND HUB — Pulau open-world Bekicot (hub antar-balapan)
   ----------------------------------------------------------------------------
   Modul mandiri. TIDAK membuat renderer/scene/loop sendiri. Cukup:
     const map = new BK.IslandHub(scene);
     const world = map.build();          // group + world API
     // di loop yang sudah ada:
     world.update(dt, elapsed);          // atau map.update(dt, elapsed)
     map.dispose();                      // saat pindah scene / reload

   Dunia yang dihasilkan tetap memakai kontrak hub lama (game.js/physics.js):
   isHub, heightAt, colliders, coast, boundR, portals, bossDoor, garage,
   npcs, pads, hubRamps, shallows, guideArrow, startPos/startHeading, update.
   Tambahan baru: collidableMeshes, spawnPoints, getSpawnPoint(), biomes,
   roadPaths, expeditionMap (instance kelas ini).
   Semua primitif, offline, tanpa dependensi luar.
   ========================================================================== */
(function () {
  'use strict';
  if (!window.BK || !window.THREE) return;

  const TAU = Math.PI * 2;
  const V3 = THREE.Vector3;
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  function smooth(a, b, x) {
    const t = clamp((x - a) / (b - a || 1e-6), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function wrapAngle(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  }
  function angleDist(a, b) { return Math.abs(wrapAngle(a - b)); }
  function nextFrame() { /* no-op penanda: modul tidak memakai RAF */ }

  // ---------- RNG deterministik (layout stabil tiap build) -------------------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function makeValueNoise(seed) {
    const rand = mulberry32(seed);
    const perm = [];
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    const p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const fade = t => t * t * (3 - 2 * t);
    function n2(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const hh = (X, Y) => p[(p[X & 255] + (Y & 255)) & 511] / 255;
      const u = fade(xf), v = fade(yf);
      return (hh(xi, yi) * (1 - u) + hh(xi + 1, yi) * u) * (1 - v) +
             (hh(xi, yi + 1) * (1 - u) + hh(xi + 1, yi + 1) * u) * v;
    }
    return function (x, y, oct) {
      let v = 0, amp = 0.5, f = 1, sum = 0;
      const n = oct || 3;
      for (let i = 0; i < n; i++) { v += n2(x * f, y * f) * amp; sum += amp; amp *= 0.5; f *= 2.03; }
      return v / sum;
    };
  }
  const noise = makeValueNoise(20261021);

  // ---------- tekstur kanvas (offline, <=512px) -----------------------------
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }
  function makeLabelTexture(text, color) {
    return canvasTex(512, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '900 54px Arial Black, Arial, sans-serif';
      g.lineJoin = 'round';
      g.lineWidth = 14;
      g.strokeStyle = 'rgba(8,14,24,.90)';
      g.strokeText(text, w / 2, h / 2);
      const grd = g.createLinearGradient(0, 22, 0, h - 22);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.5, color);
      grd.addColorStop(1, color);
      g.fillStyle = grd;
      g.fillText(text, w / 2, h / 2);
    });
  }
  function makeCrateTexture(kind) {
    return canvasTex(128, 128, (g, w, h) => {
      const isBomb = kind === 'bomb';
      g.fillStyle = isBomb ? '#a72520' : '#8a5424';
      g.fillRect(0, 0, w, h);
      g.fillStyle = isBomb ? '#7a1714' : '#6a3d18';
      for (let i = 0; i < 4; i++) g.fillRect(0, i * 32, w, 5);
      g.strokeStyle = isBomb ? '#3b0c0a' : '#3d2410';
      g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
      g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 3; g.strokeRect(15, 15, w - 30, h - 30);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (isBomb) {
        g.fillStyle = '#f4e4c1';
        g.font = '900 42px Arial Black, Arial';
        g.fillText('BOM', w / 2, h / 2 + 2);
        g.strokeStyle = '#f4e4c1'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(24, 28); g.lineTo(44, 12); g.stroke();
      } else {
        g.fillStyle = '#ffd23f';
        g.font = '900 84px Arial Black, Arial';
        g.fillText('?', w / 2, h / 2 + 4);
      }
    });
  }
  function makeRoadTexture() {
    const t = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#9a8d78'; g.fillRect(0, 0, w, h);
      // rembesan aspal/stone
      for (let i = 0; i < 420; i++) {
        const v = 100 + Math.random() * 70;
        g.fillStyle = 'rgba(' + (v | 0) + ',' + ((v * 0.92) | 0) + ',' + ((v * 0.78) | 0) + ',.28)';
        g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 8, 2 + Math.random() * 5);
      }
      // tepi jalan
      g.fillStyle = '#6b5b48'; g.fillRect(0, 0, 17, h); g.fillRect(w - 17, 0, 17, h);
      g.fillStyle = '#c9b896'; g.fillRect(19, 0, 5, h); g.fillRect(w - 24, 0, 5, h);
      // dua jalur roda
      g.fillStyle = 'rgba(92,80,64,.30)';
      g.fillRect(58, 0, 30, h); g.fillRect(w - 88, 0, 30, h);
      // marka tengah putus-putus
      g.fillStyle = '#f6e2a4';
      for (let y = 0; y < h; y += 64) g.fillRect(w / 2 - 4, y + 8, 8, 34);
      // batu kecil
      for (let i = 0; i < 120; i++) {
        g.fillStyle = i % 3 ? 'rgba(64,52,40,.25)' : 'rgba(255,245,215,.22)';
        g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  function makePlazaTexture() {
    const t = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#b9b0a0'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#948b7d'; g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke();
        g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke();
      }
      for (let i = 0; i < 100; i++) { g.fillStyle = 'rgba(80,70,60,.13)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5);
    return t;
  }
  function makeWaterfallTexture() {
    const t = canvasTex(64, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = 'rgba(168,231,255,.62)'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 44; i++) {
        g.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,.9)' : 'rgba(190,244,255,.55)';
        g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 12 + Math.random() * 80);
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 2);
    return t;
  }
  function makeBeamTexture() {
    return canvasTex(128, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      // redup di kedua ujung supaya tidak bertepi keras
      const v = g.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, 'rgba(255,255,255,0)');
      v.addColorStop(0.16, 'rgba(255,255,255,.6)');
      v.addColorStop(0.60, 'rgba(255,255,255,.82)');
      v.addColorStop(0.86, 'rgba(255,255,255,.22)');
      v.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = v; g.fillRect(0, 0, w, h);
      // tepi kiri/kanan juga memudar (dipakai sebagai sprite, bukan silinder)
      g.globalCompositeOperation = 'destination-in';
      const hz = g.createLinearGradient(0, 0, w, 0);
      hz.addColorStop(0, 'rgba(0,0,0,0)');
      hz.addColorStop(0.22, 'rgba(0,0,0,.55)');
      hz.addColorStop(0.5, 'rgba(0,0,0,1)');
      hz.addColorStop(0.78, 'rgba(0,0,0,.55)');
      hz.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = hz; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
      // serat vertikal tipis
      g.globalCompositeOperation = 'source-atop';
      for (let i = 0; i < 26; i++) {
        g.fillStyle = 'rgba(255,255,255,' + (0.08 + Math.random() * 0.18).toFixed(2) + ')';
        g.fillRect(Math.random() * w, Math.random() * h * 0.8, 1 + Math.random() * 2, 14 + Math.random() * 70);
      }
      g.globalCompositeOperation = 'source-over';
    });
  }
  let _softTex = null;
  function softTexture() {
    if (_softTex) return _softTex;
    _softTex = canvasTex(128, 128, (g, w, h) => {
      const grd = g.createRadialGradient(64, 64, 3, 64, 64, 62);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.55, 'rgba(255,255,255,.55)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    });
    return _softTex;
  }
  function makeBannerTexture(title, sub, bg, fg) {
    return canvasTex(512, 128, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = fg;
      g.font = '900 46px Arial Black, Arial';
      g.fillText(title, w / 2, sub ? 52 : 66);
      if (sub) { g.font = '700 25px Arial'; g.fillText(sub, w / 2, 94); }
    });
  }

  // ---------- geometri cache unit (hanya untuk Batch) -----------------------
  const G = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(1, 12, 8),
    sphereLow: new THREE.SphereGeometry(1, 8, 6),
    dodeca: new THREE.DodecahedronGeometry(1, 0),
    dodeca1: new THREE.DodecahedronGeometry(1, 1),
    octa: new THREE.OctahedronGeometry(1, 0),
    cone: new THREE.ConeGeometry(1, 1, 8),
    cone6: new THREE.ConeGeometry(1, 1, 6),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
    torus: new THREE.TorusGeometry(1, 0.15, 6, 16),
    circle: new THREE.CircleGeometry(1, 24),
    plane: new THREE.PlaneGeometry(1, 1)
  };

  function colorOf(c) { return (c && c.isColor) ? c : new THREE.Color(c); }
  function tintColor(hex, rnd, amount) {
    const c = new THREE.Color(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL((hsl.h + (rnd() - 0.5) * (amount || 0.018) + 1) % 1,
             clamp(hsl.s + (rnd() - 0.5) * 0.08, 0, 1),
             clamp(hsl.l + (rnd() - 0.5) * (amount || 0.06), 0.04, 0.94));
    return c;
  }

  // ---------- Batch penggabung geometri statis (hemat draw call) ----------
  function Batch() { this.p = []; this.n = []; this.c = []; this.u = []; }
  Batch.prototype.addM = function (geo, color, matrix) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    const col = colorOf(color);
    for (let i = 0; i < P.count; i++) {
      this.p.push(P.getX(i), P.getY(i), P.getZ(i));
      if (N) this.n.push(N.getX(i), N.getY(i), N.getZ(i));
      else this.n.push(0, 1, 0);
      if (U) this.u.push(U.getX(i), U.getY(i));
      else this.u.push(0, 0);
      this.c.push(col.r, col.g, col.b);
    }
    g.dispose();
    return this;
  };
  Batch.prototype.add = function (geo, color, x, y, z, rx, ry, rz, sx, sy, sz) {
    const m = new THREE.Matrix4();
    m.compose(
      new V3(x || 0, y || 0, z || 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0, 'YXZ')),
      new V3(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz)
    );
    return this.addM(geo, color, m);
  };
  Batch.prototype.geo = function () {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.computeBoundingSphere();
    return g;
  };
  Batch.prototype.mesh = function (material) {
    return new THREE.Mesh(this.geo(), material);
  };
  function beamMatrix(x1, y1, z1, x2, y2, z2, r) {
    const A = new V3(x1, y1, z1), B = new V3(x2, y2, z2);
    const mid = A.clone().add(B).multiplyScalar(0.5);
    const dir = B.clone().sub(A); const len = dir.length() || 0.0001;
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), dir.normalize());
    return new THREE.Matrix4().compose(mid, q, new V3(r, len, r));
  }
  function addBeam(b, color, x1, y1, z1, x2, y2, z2, r) {
    b.addM(G.cyl, color, beamMatrix(x1, y1, z1, x2, y2, z2, r));
  }

  // ---------- data bioma ----------------------------------------------------
  const BIOME_DEFS = [
    { key: 'center', name: 'LEMBAH PERMATA', short: 'PERMATA', x: 0, z: 0, color: '#7bffb0', labelColor: '#4dff9a', trackId: null },
    { key: 'beach',  name: 'TELUK BEKICOT', short: 'TELUK', x: -140, z: 178, color: '#ffe08a', labelColor: '#ffd34d', trackId: 'pantai' },
    { key: 'ruins',  name: 'RIMBA JAMUR', short: 'RIMBA', x: -232, z: 10, color: '#8cf06c', labelColor: '#7cfc6a', trackId: 'hutan' },
    { key: 'glacier', name: 'PUNCAK SALJU', short: 'SALJU', x: -120, z: -172, color: '#bdf3ff', labelColor: '#b8f4ff', trackId: 'salju' },
    { key: 'citadel', name: 'BENTENG BARA', short: 'BARA', x: 190, z: 2, color: '#ffad7b', labelColor: '#ff8a5c', trackId: 'kawah' }
  ];

  function IslandHub(scene, opts) {
    if (!(this instanceof IslandHub)) return new IslandHub(scene, opts);
    this.scene = scene;
    this.opts = opts || {};
    this.group = new THREE.Group();
    this.group.name = 'IslandHub';
    this.group.visible = false;
    this.root = this.group;
    this.colliders = [];
    this.collidableMeshes = [];
    this.spawnPoints = {};
    this.biomes = [];
    this.portals = [];
    this.npcs = [];
    this.pads = [];
    this.hubRamps = [];
    this.shallows = [];
    this.hazards = [];
    this.scatterExclusions = [];
    this.warpRings = [];
    this.crates = [];
    this.animated = {
      clouds: [], flags: [], gulls: [], rings: [], portals: [], karts: [],
      fires: [], smokes: [], pulses: [], orbiters: [], waterfalls: []
    };
    this.lights = [];
    this.roadPaths = [];
    this.roadMeshes = [];
    this.plazaMeshes = [];
    this.terrainMesh = null;
    this.ocean = null;
    this.world = null;
    this.built = false;
    this.disposed = false;
    this.grid = null;
    this.labels = [];
    this.seconds = 0;
    this.roadScan = [];
    this._temp = new THREE.Color();
  }

  IslandHub.prototype._coast = function () {
    const arr = [];
    const beachAngle = Math.atan2(BIOME_DEFS[1].x, BIOME_DEFS[1].z);
    for (let i = 0; i < 64; i++) {
      const a = i / 64 * TAU;
      let r = 302 + (noise(Math.cos(a) * 1.55 + 4.2, Math.sin(a) * 1.55 + 7.8, 3) - 0.5) * 58;
      // Teluk Bekicot — pantai landai tempat pier & kapal kandas.
      // Lekuk teluk dulu 50 m: garis pantai jatuh DI DALAM plaza pantai
      // (pantai 238 m, bibir plaza 255 m) sehingga plaza menggantung di atas
      // laut dan obor/gapura pier berdiri di air. 12 m menyisakan ±20 m pasir
      // landai di depan plaza; kapal tetap kandas di air dangkal.
      const bay = Math.exp(-Math.pow(angleDist(a, beachAngle) / 0.34, 2));
      r -= bay * 12;
      // lekuk kecil di barat laut (glacier) agar tebing terasa
      const north = Math.exp(-Math.pow(angleDist(a, Math.atan2(-175, -235)) / 0.24, 2));
      r += north * 10;
      arr.push(r);
    }
    return arr;
  };
  IslandHub.prototype._coastAt = function (x, z) {
    const coast = this.coast;
    let f = Math.atan2(x, z) / TAU * coast.length;
    f = ((f % coast.length) + coast.length) % coast.length;
    const i0 = Math.floor(f) % coast.length, i1 = (i0 + 1) % coast.length, fr = f - Math.floor(f);
    return coast[i0] + (coast[i1] - coast[i0]) * fr;
  };

  IslandHub.prototype._features = function () {
    return [
      { x: 0, z: 0, ri: 46, ro: 88, mode: 'set', h: 12.5 },                       // plateau Lembah Permata
      { x: -140, z: 178, ri: 52, ro: 82, mode: 'set', h: 2.35 },                   // Teluk Bekicot
      { x: -232, z: 10, ri: 52, ro: 84, mode: 'set', h: 10.6 },                    // Lost Ruins
      { x: 190, z: 2, ri: 58, ro: 92, mode: 'set', h: 9.6 },                       // Citadel
      { x: -120, z: -172, ri: 55, ro: 88, mode: 'set', h: 8.6 },                   // Glacier base
      { x: -174, z: -220, ri: 13, ro: 58, mode: 'set', h: 32 },                    // puncak glacier
      { x: -186, z: 145, ri: 6, ro: 18, mode: 'dip', h: 1.8 },                     // kolam air terjun
      { x: -50, z: -150, ri: 7, ro: 20, mode: 'dip', h: 2.2 },                     // kolam es 2
      { x: 247, z: 43, ri: 8, ro: 18, mode: 'dip', h: 2.4 },                       // kolam toxic
      { x: 248, z: -35, ri: 7, ro: 17, mode: 'dip', h: 2.0 },                      // kolam toxic 2
      // alas plaza dibuat benar-benar datar agar piringan plaza tidak tenggelam
      { x: -140, z: 178, ri: 30, ro: 40, mode: 'set', h: 2.35 },
      { x: -232, z: 10, ri: 31, ro: 41, mode: 'set', h: 10.6 },
      { x: 190, z: 2, ri: 32, ro: 42, mode: 'set', h: 9.6 },
      { x: -120, z: -172, ri: 31, ro: 41, mode: 'set', h: 8.6 },
      // gundukan piramida besar Rimba: tapaknya duduk di bibir plateau dan
      // sisi baratnya dulu menggantung ~7 m di atas lereng
      { x: -258, z: 56, ri: 22, ro: 36, mode: 'set', h: 10.6 }
    ];
  };

  IslandHub.prototype._baseHeight = function (x, z) {
    const R = this._coastAt(x, z);
    const dist = Math.hypot(x, z);
    const rn = dist / (R || 1);
    let h;
    if (rn >= 1) {
      h = -0.28 - (rn - 1) * 31;
    } else {
      h = 5.2 * Math.pow(Math.max(0, 1 - rn * rn), 1.22);
      h += (noise(x * 0.012 + 2.1, z * 0.012 - 1.7, 4) - 0.5) * 2 * 3.15 * (1 - smooth(0.78, 1.0, rn));
    }
    if (rn < 1.03) {
      const coastMask = 1 - smooth(0.91, 1.03, rn);
      const feat = this.features;
      for (let i = 0; i < feat.length; i++) {
        const f = feat[i];
        const fd = Math.hypot(x - f.x, z - f.z);
        if (fd < f.ro) {
          const t = (1 - smooth(f.ri, f.ro, fd)) * coastMask;
          const target = f.mode === 'set' ? f.h : h - f.h;
          h = h * (1 - t) + target * t;
        }
      }
    }
    return h;
  };

  IslandHub.prototype._waterfallY = function () {
    const f = this.features[6];
    return this._baseHeightRaw(f.x, f.z) + 0.25;
  };
  IslandHub.prototype._baseHeightRaw = function (x, z) {
    const save = this.features;
    return this._baseHeight(x, z);
  };

  IslandHub.prototype._makeRoadSpecs = function () {
    const specs = [];
    // cincin tengah mengelilingi plateau (jalur distribusi)
    const ringPts = [];
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU;
      ringPts.push([Math.sin(a) * 82, Math.cos(a) * 82]);
    }
    specs.push({ key: 'ring', label: 'Central Ring', pts: ringPts, width: 17, closed: true, kind: 'stone' });

    // spoke ke 5 bioma (center = plateau, 4 spoke keluar berhenti di bibir plaza)
    specs.push({
      key: 'beach', label: 'Beach Run', width: 19, closed: false, kind: 'sand',
      pts: [[0, 32], [16, 70], [2, 102], [-42, 132], [-92, 154], [-116, 164]]
    });
    specs.push({
      key: 'ruins', label: 'Jalur Rimba', width: 18, closed: false, kind: 'jungle',
      pts: [[-32, 0], [-88, 2], [-132, 4], [-172, 8], [-203, 10]]
    });
    specs.push({
      key: 'glacier', label: 'Tanjakan Salju', width: 18, closed: false, kind: 'snow',
      pts: [[-23, -23], [-50, -66], [-66, -100], [-82, -130], [-102, -150]]
    });
    specs.push({
      key: 'citadel', label: 'Titian Bara', width: 20, closed: false, kind: 'ash',
      pts: [[32, 0], [82, 2], [120, 2], [145, 2], [161, 2]]
    });

    // loop luar: menghubungkan ke-4 cabang di luar batas plaza & kastil
    specs.push({
      key: 'outer', label: 'Island Loop', width: 20, closed: true, kind: 'stone',
      pts: [
        [158, 2], [164, 78], [136, 146], [70, 188], [4, 204], [-68, 196], [-116, 164],
        [-170, 138], [-204, 84], [-206, 36], [-200, 10], [-208, -48], [-198, -110],
        [-158, -144], [-102, -150], [-52, -190], [10, -206], [84, -192], [142, -144],
        [168, -76], [162, -28]
      ]
    });

    // jalur menuju Gerbang Bos di utara plateau
    specs.push({
      key: 'bossPath', label: 'Boss Path', width: 14, closed: false, kind: 'boss',
      pts: [[0, -68], [0, -82], [0, -102]]
    });
    return specs;
  };

  IslandHub.prototype._sampleRoad = function (spec) {
    const pts = spec.pts.map(p => new V3(p[0], 0, p[1]));
    const curve = new THREE.CatmullRomCurve3(pts, !!spec.closed, 'catmullrom', 0.42);
    const length = Math.max(12, curve.getLength());
    const count = Math.max(18, Math.ceil(length / 3.2));
    const arr = [];
    for (let i = 0; i < count; i++) {
      const t = spec.closed ? i / count : i / (count - 1);
      const p = curve.getPointAt(t);
      const tg = curve.getTangentAt(t);
      tg.y = 0;
      if (tg.lengthSq() < 1e-6) tg.set(0, 0, 1);
      tg.normalize();
      const b0 = this._baseHeight(p.x, p.z);
      arr.push({ x: p.x, z: p.z, tx: tg.x, tz: tg.z, base: b0, base0: b0, y: 0, t });
    }
    // profil elevasi: ambil tinggi dasar lalu haluskan berkali-kali agar tanjakan nyaman
    for (let pass = 0; pass < 6; pass++) {
      const src = arr.map(p => p.base);
      for (let i = 0; i < arr.length; i++) {
        let sum = 0, n = 0;
        for (let k = -3; k <= 3; k++) {
          let j = i + k;
          if (spec.closed) j = (j + arr.length) % arr.length;
          else if (j < 0 || j >= arr.length) continue;
          sum += src[j]; n++;
        }
        arr[i].y = sum / n;
      }
      for (let i = 0; i < arr.length; i++) arr[i].base = arr[i].y;
    }
    // batasi kemiringan maksimum (nyaman untuk kart)
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 1; i < arr.length; i++) {
        const d = arr[i].y - arr[i - 1].y;
        if (Math.abs(d) > 2.4) {
          const want = arr[i - 1].y + Math.sign(d) * 2.4;
          arr[i].y = arr[i].y * 0.55 + want * 0.45;
        }
      }
      if (spec.closed && arr.length > 1) {
        arr[0].y = (arr[0].y + arr[arr.length - 1].y) * 0.5;
      }
    }
    // Ujung jalan non-loop harus duduk di tinggi tanah/plaza aslinya.
    // Tanpa ini, penghalusan elevasi menarik ujung jalan turun dan memahat
    // plateau/plaza (plaza lalu tampak melayang di atas lubang).
    // Anchor saja membuat tanjakan mendadak; blend 10 titik pertama/terakhir
    // supaya jalan turun landai dari bibir plateau ke rute normal.
    if (!spec.closed && arr.length > 1) {
      const firstY = arr[0].base0;
      const lastY = arr[arr.length - 1].base0;
      arr[0].y = firstY;
      arr[arr.length - 1].y = lastY;
      const blend = Math.min(10, arr.length - 2);
      for (let k = 1; k <= blend; k++) {
        const t = smooth(0, 1, k / (blend + 1));
        arr[k].y = lerp(firstY, arr[k].y, t);
        const j = arr.length - 1 - k;
        arr[j].y = lerp(lastY, arr[j].y, t);
      }
    }
    return {
      key: spec.key, label: spec.label, curve, length, width: spec.width,
      closed: !!spec.closed, kind: spec.kind, points: arr
    };
  };

  IslandHub.prototype._blendRoadJunctions = function () {
    const ring = this.roadPaths.find(r => r.key === 'ring');
    if (!ring) return;
    const RING_R = 82;
    const blendDist = 30;
    for (let s = 0; s < this.roadPaths.length; s++) {
      const road = this.roadPaths[s];
      if (road === ring) continue;
      // Titik jalan ini yang paling dekat dengan lingkaran ring.
      let cross = null, best = 1e9;
      for (let i = 0; i < road.points.length; i++) {
        const p = road.points[i];
        const d = Math.abs(Math.hypot(p.x, p.z) - RING_R);
        if (d < best) { best = d; cross = p; }
      }
      if (!cross || best > 18) continue;
      // Tinggi ring di titik persimpangan jadi acuan bersama.
      let targetY = null, rd = 1e9;
      for (let i = 0; i < ring.points.length; i++) {
        const q = ring.points[i];
        const d = Math.hypot(q.x - cross.x, q.z - cross.z);
        if (d < rd) { rd = d; targetY = q.y; }
      }
      if (targetY == null || rd > 24) continue;
      // Blend landai 30 m di kedua sisi persimpangan.
      for (let i = 0; i < road.points.length; i++) {
        const p = road.points[i];
        const d = Math.hypot(p.x - cross.x, p.z - cross.z);
        if (d > blendDist) continue;
        const w = 1 - smooth(0, blendDist, d);
        p.y = lerp(p.y, targetY, w);
      }
      cross.y = targetY;
    }
  };

  IslandHub.prototype._buildHeightGrid = function () {
    const span = 760;
    const N = 256;
    const min = -span / 2;
    const step = span / N;
    this.grid = { N, min, step, data: new Float32Array((N + 1) * (N + 1)) };
    const base = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) {
      const z = min + j * step;
      for (let i = 0; i <= N; i++) {
        const x = min + i * step;
        base[j * (N + 1) + i] = this._baseHeight(x, z);
      }
    }
    const roadW = new Float32Array((N + 1) * (N + 1));
    const roadY = new Float32Array((N + 1) * (N + 1));
    const roadDist = new Float32Array((N + 1) * (N + 1));
    roadDist.fill(1e9);
    this.roadPaths = [];
    const specs = this._makeRoadSpecs();
    for (let s = 0; s < specs.length; s++) {
      const road = this._sampleRoad(specs[s]);
      this.roadPaths.push(road);
      // jejak untuk scatter/minimap
      road.points.forEach(p => this.roadScan.push({ x: p.x, z: p.z, r: road.width * 0.5 + 3 }));
    }
    // Jalan yang bertemu di ring tengah harus punya tinggi yang sama.
    // Tanpa ini sisi jalan bisa ter-flatten ke tinggi jalan lain dan
    // permukaan jalan menukik 2-3 m di persimpangan.
    this._blendRoadJunctions();
    for (let s = 0; s < this.roadPaths.length; s++) {
      const road = this.roadPaths[s];
      const inner = road.width * 0.5 + 3.5;
      const outer = inner + 13;
      for (let q = 0; q < road.points.length; q++) {
        const p = road.points[q];
        const i0 = Math.max(0, Math.floor((p.x - outer - min) / step));
        const i1 = Math.min(N, Math.ceil((p.x + outer - min) / step));
        const j0 = Math.max(0, Math.floor((p.z - outer - min) / step));
        const j1 = Math.min(N, Math.ceil((p.z + outer - min) / step));
        for (let j = j0; j <= j1; j++) {
          const z = min + j * step;
          for (let i = i0; i <= i1; i++) {
            const x = min + i * step;
            const d = Math.hypot(x - p.x, z - p.z);
            if (d > outer) continue;
            const w = d <= inner ? 1 : 1 - smooth(inner, outer, d);
            const idx = j * (N + 1) + i;
            // Kalau bobot sama (di dalam koridor), pakai titik jalan TERDEKAT.
            // Dulu titik pertama yang menang; akibatnya ujung jalan menyeret
            // tinggi seluruh koridor dan jalan tenggelam di bawah tanah.
            if (w > roadW[idx] + 1e-5 || (Math.abs(w - roadW[idx]) <= 1e-5 && d < roadDist[idx])) {
              roadW[idx] = w; roadY[idx] = p.y; roadDist[idx] = d;
            }
          }
        }
      }
    }
    for (let j = 0; j <= N; j++) {
      const z = min + j * step;
      for (let i = 0; i <= N; i++) {
        const x = min + i * step;
        const idx = j * (N + 1) + i;
        let h = base[idx];
        if (roadW[idx] > 0) h = lerp(h, roadY[idx], clamp(roadW[idx], 0, 1));
        // pelan-pelan turun ke dasar laut di luar pantai (grid tetap aman untuk raycast)
        const rn = Math.hypot(x, z) / this._coastAt(x, z);
        if (rn > 1.03 && h > -1.2) h = lerp(h, -1.2, smooth(1.03, 1.12, rn));
        this.grid.data[idx] = h;
      }
    }
    // Pad plaza luar: ratakan tanah di bawah piringan plaza, lalu blend
    // keluar. Tanpa ini plaza menjadi teras sempit yang tepinya menembus
    // lereng (glacier) atau menggantung di atas air (beach), dan jalan
    // masuk terlihat naik/turun seperti tebing.
    const pads = [
      { x: -140, z: 178, r: 29 },
      { x: -232, z: 10, r: 30 },
      { x: -120, z: -172, r: 29 },
      { x: 190, z: 2, r: 31 }
    ];
    for (let p = 0; p < pads.length; p++) {
      const pd = pads[p];
      const hPad = this.heightAt(pd.x, pd.z);
      const blend = 8;
      const outerPad = pd.r + blend;
      const i0 = Math.max(0, Math.floor((pd.x - outerPad - min) / step));
      const i1 = Math.min(N, Math.ceil((pd.x + outerPad - min) / step));
      const j0 = Math.max(0, Math.floor((pd.z - outerPad - min) / step));
      const j1 = Math.min(N, Math.ceil((pd.z + outerPad - min) / step));
      for (let j = j0; j <= j1; j++) {
        const z = min + j * step;
        for (let i = i0; i <= i1; i++) {
          const x = min + i * step;
          const d = Math.hypot(x - pd.x, z - pd.z);
          if (d >= outerPad) continue;
          const w = d <= pd.r ? 1 : 1 - smooth(pd.r, outerPad, d);
          const idx = j * (N + 1) + i;
          this.grid.data[idx] = lerp(this.grid.data[idx], hPad, w);
        }
      }
    }
    this.coastMin = Math.min.apply(null, this.coast);
    this.coastMax = Math.max.apply(null, this.coast);
  };

  IslandHub.prototype.heightAt = function (x, z) {
    const g = this.grid;
    if (!g) return 0;
    const fx = (x - g.min) / g.step;
    const fz = (z - g.min) / g.step;
    if (fx < 0 || fz < 0 || fx >= g.N || fz >= g.N) return -7;
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j;
    const N1 = g.N + 1;
    const a = g.data[j * N1 + i], bx = g.data[j * N1 + i + 1];
    const cz = g.data[(j + 1) * N1 + i], d = g.data[(j + 1) * N1 + i + 1];
    // Interpolasi segitiga, BUKAN bilinear: harus sama persis dengan
    // triangulasi mesh terrain supaya jalan/props tidak tenggelam atau
    // mengambang terhadap permukaan yang benar-benar digambar.
    if (tx + tz <= 1) {
      return a + (cz - a) * tz + (bx - a) * tx;
    }
    return d + (cz - d) * (1 - tx) + (bx - d) * (1 - tz);
  };
  IslandHub.prototype._slope = function (x, z) {
    const e = 2.4;
    return Math.hypot(this.heightAt(x + e, z) - this.heightAt(x - e, z),
                      this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
  };
  IslandHub.prototype._nearRoad = function (x, z, extra) {
    const ex = extra || 0;
    for (let i = 0; i < this.roadScan.length; i++) {
      const p = this.roadScan[i];
      const dx = x - p.x, dz = z - p.z;
      const r = p.r + ex;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  };
  IslandHub.prototype._biomeMask = function (x, z, key) {
    const b = BIOME_DEFS.find(v => v.key === key);
    if (!b) return 0;
    return 1 - smooth(55, 120, Math.hypot(x - b.x, z - b.z));
  };

  // ---------- warna tanah bioma --------------------------------------------
  IslandHub.prototype._groundColor = function (x, z, h, slope, rnd) {
    const grass = new THREE.Color(0x6fba55);
    const grassDark = new THREE.Color(0x3f7e3a);
    const sand = new THREE.Color(0xe7cf8d);
    const sandWet = new THREE.Color(0xbda774);
    const stone = new THREE.Color(0x8e8b82);
    const snow = new THREE.Color(0xdcebf3);
    const ice = new THREE.Color(0xaedcec);
    const jungle = new THREE.Color(0x2e7438);
    const jungleLight = new THREE.Color(0x4c994a);
    const ash = new THREE.Color(0x39313a);
    const ashLight = new THREE.Color(0x5b4650);
    const c = new THREE.Color();
    const rn = Math.hypot(x, z) / this._coastAt(x, z);
    if (h < 0.35) {
      c.copy(sandWet).lerp(new THREE.Color(0x4d8c86), smooth(0.3, -2.5, h));
    } else if (h < 1.6) {
      c.copy(sandWet).lerp(sand, smooth(0.35, 1.25, h));
    } else {
      c.copy(grass).lerp(grassDark, noise(x * 0.05 + 5, z * 0.05, 3) * 0.7);
    }
    // pantai
    const mBeach = this._biomeMask(x, z, 'beach');
    if (mBeach > 0.01) c.lerp(sand, mBeach * 0.86);
    // rimba
    const mRuins = this._biomeMask(x, z, 'ruins');
    if (mRuins > 0.01) c.lerp(jungle, mRuins * 0.72).lerp(jungleLight, mRuins * 0.12);
    // salju
    const mGlacier = this._biomeMask(x, z, 'glacier');
    if (mGlacier > 0.01) {
      const snowLine = smooth(9, 18, h);
      c.lerp(ice, mGlacier * 0.42).lerp(snow, mGlacier * (0.4 + snowLine * 0.55));
    }
    // citadel
    const mCit = this._biomeMask(x, z, 'citadel');
    if (mCit > 0.01) c.lerp(ash, mCit * 0.88).lerp(ashLight, mCit * 0.16);
    // pusat: batu lumut
    const mCenter = 1 - smooth(46, 105, Math.hypot(x, z));
    if (mCenter > 0.01) c.lerp(stone, mCenter * 0.55).lerp(new THREE.Color(0x7ba86f), mCenter * 0.28);
    // tebing curam / salju pegunungan
    const rockAmt = smooth(0.55, 1.35, slope);
    c.lerp(stone, rockAmt * 0.65);
    if (mGlacier > 0.2 && h > 15) c.lerp(snow, smooth(15, 26, h) * 0.85);
    if (h < 0.2) c.lerp(new THREE.Color(0x3d7d78), 0.55);
    // variasi halus
    const v = (rnd ? rnd() : 0.5) * 0.06 - 0.03;
    c.offsetHSL(0, 0, v);
    return c;
  };

  // Masker jalan: area terrain di bawah aspal + bahu dibuang lewat shader
  // supaya tidak ada lagi triangle tanah yang menembus permukaan jalan.
  IslandHub.prototype._makeRoadMaskTexture = function () {
    const g = this.grid;
    const span = g.N * g.step;
    const S = 2048;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    const scale = S / span;
    for (let i = 0; i < this.roadPaths.length; i++) {
      const road = this.roadPaths[i];
      // 1.6 m di luar tepi aspal; bahu 1.8 m menutup tepi lubang.
      ctx.lineWidth = (road.width + 3.2) * scale;
      ctx.beginPath();
      for (let j = 0; j < road.points.length; j++) {
        const p = road.points[j];
        const px = (p.x - g.min) * scale;
        const pz = (p.z - g.min) * scale;
        if (j === 0) ctx.moveTo(px, pz); else ctx.lineTo(px, pz);
      }
      if (road.closed) ctx.closePath();
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  };

  // ---------- terrain mesh --------------------------------------------------
  IslandHub.prototype._buildTerrain = function () {
    // Mesh terrain memakai grid tinggi yang sama dengan heightAt. Sebelumnya
    // mesh ini 184x184 (langkah 3,8 m) sementara grid 256x256 (2,97 m);
    // selisih interpolasinya sampai 30 cm sehingga tanah menembus jalan.
    const g = this.grid;
    const N = g.N;
    const step = g.step;
    const min = g.min;
    const N1 = N + 1;
    const span = N * step;
    const pos = [], nor = [], col = [], uv = [], maskUv = [], idx = [];
    const rnd = mulberry32(7721);
    for (let j = 0; j <= N; j++) {
      const z = min + j * step;
      for (let i = 0; i <= N; i++) {
        const x = min + i * step;
        const h = g.data[j * N1 + i];
        pos.push(x, h, z);
        uv.push(x / 24, z / 24);
        maskUv.push((x - min) / span, (z - min) / span);
        const c = this._groundColor(x, z, h, this._slope(x, z), rnd);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i, b = a + N + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('maskUv', new THREE.Float32BufferAttribute(maskUv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const detail = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 380; i++) {
        g.fillStyle = i % 3 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.35)';
        g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
    });
    detail.wrapS = detail.wrapT = THREE.RepeatWrapping; detail.repeat.set(34, 34);
    const maskTex = this._makeRoadMaskTexture();
    this.roadMaskTexture = maskTex;
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, map: detail, roughness: 0.96, metalness: 0.0,
      flatShading: true
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.roadMask = { value: maskTex };
      shader.vertexShader = 'attribute vec2 maskUv;\nvarying vec2 vMaskUv;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vMaskUv = maskUv;'
      );
      shader.fragmentShader = 'uniform sampler2D roadMask;\nvarying vec2 vMaskUv;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\n  if (texture2D(roadMask, vMaskUv).r > 0.45) discard;'
      );
    };
    mat.customProgramCacheKey = function () { return 'hub-terrain-road-mask'; };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'Hub_Terrain';
    mesh.receiveShadow = false;
    this.group.add(mesh);
    this.terrainMesh = mesh;
    this.collidableMeshes.push(mesh);
    this.terrainMaterial = mat;
    this.terrainDetail = detail;
  };

  // ---------- ocean ---------------------------------------------------------
  // Laut digambar satu ShaderMaterial: gelombang di GPU (dulu loop CPU per
  // vertex tiap frame), warna menurut jarak ke pantai, buih garis pantai +
  // ombak yang bergulir masuk, kilau matahari, dan tepi cakram yang larut ke
  // kabut. Jarak ke pantai di-bake sekali dari grid tinggi (signed distance),
  // jadi buih selalu jatuh tepat di garis air, termasuk teluk & tanjung.
  const SEA_Y = -0.28;
  const SEA_SDF_MAX = 96;   // meter yang diwakili 0..1 di tekstur jarak
  function makeSeaNoiseTexture() {
    // tileable: bintik lembut digambar dengan wrap 3x3
    const t = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
      const rand = mulberry32(9137);
      for (let i = 0; i < 150; i++) {
        const x = rand() * w, y = rand() * h, r = 4 + rand() * 14;
        const v = rand() < 0.5 ? 255 : 0, a = 0.10 + rand() * 0.16;
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
          const gr = g.createRadialGradient(x + ox * w, y + oy * h, 0, x + ox * w, y + oy * h, r);
          gr.addColorStop(0, 'rgba(' + v + ',' + v + ',' + v + ',' + a + ')');
          gr.addColorStop(1, 'rgba(' + v + ',' + v + ',' + v + ',0)');
          g.fillStyle = gr; g.fillRect(x + ox * w - r, y + oy * h - r, r * 2, r * 2);
        }
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  IslandHub.prototype._bakeShoreField = function () {
    const g = this.grid, N1 = g.N + 1, step = g.step, INF = 1e9;
    const d = new Float32Array(N1 * N1);
    const land = new Uint8Array(N1 * N1);
    for (let k = 0; k < d.length; k++) { land[k] = g.data[k] > SEA_Y ? 1 : 0; d[k] = INF; }
    // inisialisasi sub-texel: jarak pusat texel ke titik potong muka air
    for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) {
      const k = j * N1 + i, h = g.data[k];
      const nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]];
      for (let q = 0; q < 4; q++) {
        const ni = nb[q][0], nj = nb[q][1];
        if (ni < 0 || nj < 0 || ni >= N1 || nj >= N1) continue;
        const kk = nj * N1 + ni;
        if (land[kk] === land[k]) continue;
        const h2 = g.data[kk];
        const f = clamp(Math.abs(h - SEA_Y) / (Math.abs(h - h2) || 1e-6), 0, 1);
        d[k] = Math.min(d[k], f * step);
      }
    }
    // chamfer 2-pass (cukup akurat untuk gradasi warna & buih)
    const a = step, b = step * Math.SQRT2;
    const relax = (k, kk, w) => { if (d[kk] + w < d[k]) d[k] = d[kk] + w; };
    for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) {
      const k = j * N1 + i;
      if (i > 0) relax(k, k - 1, a);
      if (j > 0) { relax(k, k - N1, a); if (i > 0) relax(k, k - N1 - 1, b); if (i < N1 - 1) relax(k, k - N1 + 1, b); }
    }
    for (let j = N1 - 1; j >= 0; j--) for (let i = N1 - 1; i >= 0; i--) {
      const k = j * N1 + i;
      if (i < N1 - 1) relax(k, k + 1, a);
      if (j < N1 - 1) { relax(k, k + N1, a); if (i < N1 - 1) relax(k, k + N1 + 1, b); if (i > 0) relax(k, k + N1 - 1, b); }
    }
    const px = new Uint8Array(N1 * N1 * 4);
    for (let k = 0; k < d.length; k++) {
      const sd = land[k] ? -d[k] : d[k];
      const v = clamp(0.5 + sd / (2 * SEA_SDF_MAX), 0, 1) * 255;
      px[k * 4] = px[k * 4 + 1] = px[k * 4 + 2] = v; px[k * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(px, N1, N1, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  };

  IslandHub.prototype._buildOcean = function () {
    // cakram polar: rapat dekat pulau (ombak & buih halus), jarang di cakrawala
    const RAD = 975, SEG = 112, RINGS = 46;
    const pos = [], idx = [];
    pos.push(0, 0, 0);
    for (let r = 1; r <= RINGS; r++) {
      const f = r / RINGS, rad = RAD * (0.55 * f + 0.45 * f * f * f);
      for (let s = 0; s < SEG; s++) {
        const a = s / SEG * TAU;
        pos.push(Math.sin(a) * rad, 0, Math.cos(a) * rad);
      }
    }
    for (let s = 0; s < SEG; s++) idx.push(0, 1 + s, 1 + (s + 1) % SEG);
    for (let r = 1; r < RINGS; r++) {
      const o0 = 1 + (r - 1) * SEG, o1 = 1 + r * SEG;
      for (let s = 0; s < SEG; s++) {
        const s1 = (s + 1) % SEG;
        idx.push(o0 + s, o1 + s, o1 + s1, o0 + s, o1 + s1, o0 + s1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), RAD + 2);

    const g = this.grid;
    const shore = this._bakeShoreField();
    const nTex = makeSeaNoiseTexture();
    this.textures = this.textures || [];
    this.textures.push(shore, nTex);
    const N1 = g.N + 1;
    const sun = new THREE.Vector3(190, 280, 130).normalize();
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 },
      uDay: { value: 1 },
      uShore: { value: null },
      uNoise: { value: null },
      // texel i berpusat di x = min + i*step → uv = ((x-min)/step + .5)/N1
      uShoreXf: { value: new THREE.Vector4(1 / (g.step * N1), (0.5 - g.min / g.step) / N1, SEA_SDF_MAX, RAD) },
      uSun: { value: sun },
      uSand: { value: new THREE.Color(0xe9d7a0) },
      uShallow: { value: new THREE.Color(0x63f0dc) },
      uMid: { value: new THREE.Color(0x1cc6dc) },
      uDeep: { value: new THREE.Color(0x138fc6) },
      uAbyss: { value: new THREE.Color(0x0e64a8) },
      uSkyRef: { value: new THREE.Color(0xbfeaf8) },
      uHorizon: { value: new THREE.Color(0xc5edf7) }
    }]);
    uniforms.uShore.value = shore;
    uniforms.uNoise.value = nTex;
    const mat = new THREE.ShaderMaterial({
      uniforms, fog: true,
      extensions: { derivatives: true },
      vertexShader: [
        'uniform float uTime;',
        'varying vec3 vW;',
        'varying vec3 vN;',
        '#include <fog_pars_vertex>',
        'void main(){',
        '  vec3 p = position;',
        '  float r = length(p.xz);',
        // ombak kecil di dekat pulau, swell panjang di laut lepas
        '  float amp = mix(0.16, 0.55, smoothstep(320.0, 700.0, r));',
        '  float t = uTime;',
        '  float w1 = sin(dot(p.xz, vec2(0.031, 0.022)) + t * 0.95);',
        '  float w2 = sin(dot(p.xz, vec2(-0.019, 0.037)) + t * 0.73 + 1.7);',
        '  float w3 = sin(dot(p.xz, vec2(0.052, -0.041)) + t * 1.35 + 0.4);',
        '  p.y = amp * (w1 * 0.55 + w2 * 0.35 + w3 * 0.2);',
        '  float dx = amp * (cos(dot(p.xz, vec2(0.031, 0.022)) + t * 0.95) * 0.55 * 0.031 + cos(dot(p.xz, vec2(-0.019, 0.037)) + t * 0.73 + 1.7) * 0.35 * -0.019 + cos(dot(p.xz, vec2(0.052, -0.041)) + t * 1.35 + 0.4) * 0.2 * 0.052);',
        '  float dz = amp * (cos(dot(p.xz, vec2(0.031, 0.022)) + t * 0.95) * 0.55 * 0.022 + cos(dot(p.xz, vec2(-0.019, 0.037)) + t * 0.73 + 1.7) * 0.35 * 0.037 + cos(dot(p.xz, vec2(0.052, -0.041)) + t * 1.35 + 0.4) * 0.2 * -0.041);',
        '  vN = normalize(vec3(-dx * 6.0, 1.0, -dz * 6.0));',
        '  vec4 wp = modelMatrix * vec4(p, 1.0);',
        '  vW = wp.xyz;',
        '  vec4 mvPosition = viewMatrix * wp;',
        '  gl_Position = projectionMatrix * mvPosition;',
        '  #include <fog_vertex>',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime; uniform float uDay;',
        'uniform sampler2D uShore; uniform sampler2D uNoise;',
        'uniform vec4 uShoreXf; uniform vec3 uSun;',
        'uniform vec3 uSand, uShallow, uMid, uDeep, uAbyss, uSkyRef, uHorizon;',
        'varying vec3 vW; varying vec3 vN;',
        '#include <fog_pars_fragment>',
        'void main(){',
        '  vec2 suv = vW.xz * uShoreXf.x + uShoreXf.y;',
        '  float sdf = (texture2D(uShore, suv).r - 0.5) * 2.0 * uShoreXf.z;',
        '  vec2 eu = min(suv, 1.0 - suv);',
        '  sdf = mix(uShoreXf.z, sdf, smoothstep(0.0, 0.04, min(eu.x, eu.y)));',
        '  float d = max(sdf, 0.0);',
        '  float r = length(vW.xz);',
        '  float t = uTime;',
        // dua lapis noise bergeser → riak & pemecah pola
        '  float n1 = texture2D(uNoise, vW.xz * 0.021 + vec2(t * 0.011, t * 0.006)).r;',
        '  float n2 = texture2D(uNoise, vW.xz * 0.047 + vec2(-t * 0.008, t * 0.013)).r;',
        '  float nn = n1 + n2 - 1.0;',
        // warna menurut jarak pantai, lalu laut lepas makin pekat
        '  vec3 col = mix(uShallow, uMid, smoothstep(4.0, 30.0, d + nn * 5.0));',
        '  col = mix(col, uDeep, smoothstep(26.0, 90.0, d + nn * 9.0));',
        '  col = mix(col, uAbyss, smoothstep(420.0, 820.0, r));',
        // air sangat dangkal memperlihatkan pasir + kaustik
        '  float sandy = 1.0 - smoothstep(0.0, 4.5, d);',
        '  col = mix(col, mix(uShallow, uSand, 0.55), sandy * 0.6);',
        '  float ca = abs(sin(vW.x * 0.33 + n1 * 5.0 + t * 0.8) + sin(vW.z * 0.29 - n2 * 5.0 + t * 0.6));',
        '  col += vec3(0.9, 1.0, 1.0) * smoothstep(1.55, 1.95, ca) * (1.0 - smoothstep(1.0, 14.0, d)) * 0.22;',
        // normal: gelombang vertex + riak tekstur
        '  vec3 N = normalize(vN + vec3(nn * 0.22, 0.0, (n1 - n2) * 0.22));',
        '  vec3 V = normalize(cameraPosition - vW);',
        '  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);',
        '  col = mix(col, uSkyRef, clamp(fres * 0.65, 0.0, 0.65));',
        '  float diff = 0.82 + 0.18 * max(dot(N, uSun), 0.0);',
        '  col *= diff;',
        '  vec3 H = normalize(uSun + V);',
        '  float spec = pow(max(dot(N, H), 0.0), 140.0);',
        '  col += vec3(1.0, 0.96, 0.85) * smoothstep(0.35, 0.9, spec) * 0.75 * uDay;',
        // buih: garis pantai bergoyang + 2 baris ombak yang bergulir ke darat
        '  float wob = (n1 - 0.5) * 1.6;',
        '  float edge = 1.0 - smoothstep(0.4, 1.6 + wob, sdf);',
        '  float ph = d * 0.62 + t * 1.15 + n2 * 1.4;',
        '  float band = smoothstep(0.80, 0.97, sin(ph));',
        '  band *= smoothstep(0.38, 0.62, n1 + 0.15) * (1.0 - smoothstep(3.0, 14.0, d));',
        '  float lap = 1.0 - smoothstep(0.0, 3.2 + 1.4 * sin(t * 0.9 + n1 * 6.0), d);',
        '  float foam = max(max(edge, band * 0.85), lap * 0.45);',
        // buih di puncak swell laut lepas, tipis & jarang
        '  foam = max(foam, smoothstep(0.86, 0.98, n1 * n2 * 2.2) * smoothstep(120.0, 260.0, r) * 0.35);',
        '  col = mix(col, vec3(0.97, 1.0, 1.0), clamp(foam, 0.0, 1.0));',
        // garis riak bergaya kartun: kontur noise yang ikut bergeser
        "  float cl = abs(fract((n1 * 0.7 + n2 * 0.5) * 5.0 + t * 0.05) - 0.5);",
        '  col += vec3(0.75, 0.95, 1.0) * (1.0 - smoothstep(0.02, 0.07, cl)) * smoothstep(8.0, 30.0, d) * (1.0 - smoothstep(260.0, 520.0, r)) * 0.13;',
        // suasana cerita (pulau masih redup di awal)
        '  col *= mix(vec3(0.58, 0.58, 0.72), vec3(1.0), uDay);',
        // tepi cakram larut ke warna cakrawala agar tak ada sudut/garis
        '  col = mix(col, uHorizon, smoothstep(uShoreXf.w * 0.62, uShoreXf.w * 0.98, r));',
        '  gl_FragColor = vec4(col, 1.0);',
        '  #include <fog_fragment>',
        '}'
      ].join('\n')
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = SEA_Y;
    mesh.name = 'Hub_Ocean';
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.ocean = mesh;
    this.oceanMesh = mesh;
    this.oceanMat = mat;
  };

  // ---------- langit & awan -------------------------------------------------
  IslandHub.prototype._buildSky = function () {
    const g = new THREE.SphereGeometry(980, 18, 12);
    const top = new THREE.Color(0x3e9dde), hor = new THREE.Color(0xc9f1ff), low = new THREE.Color(0xfff2cd);
    const p = g.attributes.position, cols = [];
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 980;
      let c;
      if (y < 0) c = low.clone().lerp(hor, smooth(-0.25, 0.02, y));
      else c = hor.clone().lerp(top, Math.pow(clamp(y, 0, 1), 0.8));
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false
    }));
    sky.name = 'Hub_Sky';
    this.group.add(sky);
    this.sky = sky;

    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.94, fog: false, depthWrite: false });
    const cloudGeo = new THREE.SphereGeometry(1, 8, 6);
    for (let k = 0; k < 12; k++) {
      const c = new THREE.Group();
      const n = 3 + ((k % 3) | 0);
      for (let j = 0; j < n; j++) {
        const s = new THREE.Mesh(cloudGeo, cloudMat);
        s.position.set((j - n / 2) * 8 + (Math.random() - 0.5) * 4, Math.random() * 2, (Math.random() - 0.5) * 5);
        s.scale.set(6 + Math.random() * 7, 3 + Math.random() * 3, 5 + Math.random() * 5);
        c.add(s);
      }
      c.position.set((Math.random() - 0.5) * 820, 82 + Math.random() * 55, (Math.random() - 0.5) * 820);
      this.group.add(c);
      this.animated.clouds.push({ group: c, speed: 0.8 + Math.random() * 1.6, drift: (Math.random() - 0.5) * 0.3 });
    }
    this.cloudGeo = cloudGeo;
    this.cloudMat = cloudMat;
  };

  // ---------- jalan ---------------------------------------------------------
  // Potongan melintang jalan yang sudah dipecah rapat (maxStep meter).
  // Tanpa pemecahan ini mesh jalan hanya punya titik tiap ~3 m, sehingga
  // bidang lurusnya bisa 20-45 cm di bawah mesh terrain yang lebih halus.
  IslandHub.prototype._roadSections = function (road, maxStep) {
    const pts = road.points, n = pts.length;
    if (!n) return [];
    const closed = !!road.closed;
    const segCount = closed ? n : n - 1;
    const out = [];
    let dist = 0;
    for (let i = 0; i < segCount; i++) {
      const p = pts[i % n], q = pts[(i + 1) % n];
      const dx = q.x - p.x, dz = q.z - p.z;
      const seg = Math.hypot(dx, dz);
      if (seg < 1e-5) continue;
      const sub = Math.max(1, Math.ceil(seg / (maxStep || 1.2)));
      let tx1 = p.tx, tz1 = p.tz, tx2 = q.tx, tz2 = q.tz;
      if (tx1 * tx1 + tz1 * tz1 < 1e-6) { tx1 = dx; tz1 = dz; }
      if (tx2 * tx2 + tz2 * tz2 < 1e-6) { tx2 = dx; tz2 = dz; }
      for (let k = 0; k < sub; k++) {
        const t = k / sub;
        const tx = tx1 + (tx2 - tx1) * t;
        const tz = tz1 + (tz2 - tz1) * t;
        const tl = Math.hypot(tx, tz) || 1;
        out.push({
          x: p.x + dx * t, z: p.z + dz * t,
          tx: tx / tl, tz: tz / tl,
          dist: dist + seg * t
        });
      }
      dist += seg;
    }
    const p = closed ? pts[0] : pts[n - 1];
    let tx = p.tx, tz = p.tz;
    if (tx * tx + tz * tz < 1e-6) {
      const q = closed ? pts[1 % n] : pts[Math.max(0, n - 2)];
      tx = p.x - q.x; tz = p.z - q.z;
    }
    const tl = Math.hypot(tx, tz) || 1;
    out.push({ x: p.x, z: p.z, tx: tx / tl, tz: tz / tl, dist });
    return out;
  };

  const PLAZA_BOUNDS = [
    { x: 0, z: 0, r: 33 },
    { x: -140, z: 178, r: 29 },
    { x: -232, z: 10, r: 30 },
    { x: -120, z: -172, r: 29 },
    { x: 190, z: 2, r: 31 }
  ];
  function isInsidePlaza(x, z, margin) {
    const m = margin || 0;
    for (let i = 0; i < PLAZA_BOUNDS.length; i++) {
      const pl = PLAZA_BOUNDS[i];
      if (Math.hypot(x - pl.x, z - pl.z) < pl.r + m) return true;
    }
    return false;
  }

  IslandHub.prototype._roadGeo = function (road, extraWidth, yOff, sidesOnly) {
    const half = road.width * 0.5 + (extraWidth || 0) * 0.5;
    const secs = this._roadSections(road, 1.2);
    const K = 15;
    const pos = [], uv = [], idx = [];
    const covered = [];
    const baseOff = yOff || 0.08;
    for (let i = 0; i < secs.length; i++) {
      const p = secs[i];
      const nx = -p.tz, nz = p.tx;
      for (let k = 0; k < K; k++) {
        const f = k / (K - 1);
        // k=0 di sisi kiri, lalu bergerak ke kanan; urutan ini yang
        // membuat seluruh segitiga menghadap ke atas.
        const off = half - f * half * 2;
        const vx = p.x + nx * off, vz = p.z + nz * off;
        const vo = isInsidePlaza(vx, vz, -0.4) ? 0.01 : baseOff;
        pos.push(vx, this.heightAt(vx, vz) + vo, vz);
        uv.push(f, p.dist / 9);
        covered.push(isInsidePlaza(vx, vz, -1.0));
      }
    }
    // Petak dibuang hanya bila KEEMPAT sudutnya tertutup piringan plaza.
    // Dulu yang dicek cuma garis tengah: jalan yang menyerempet tepi plaza
    // kehilangan aspal di luar piringan, sementara masker terrain tetap
    // melubangi tanah, sehingga laut di bawah pulau tampak seperti sungai
    // dan ujung jalan terlihat terpotong kotak (mis. di plaza Puncak Salju).
    for (let i = 0; i < secs.length - 1; i++) {
      for (let k = 0; k < K - 1; k++) {
        const a = i * K + k, b = a + K;
        if (covered[a] && covered[a + 1] && covered[b] && covered[b + 1]) continue;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };

  // Bahu jalan hanya dua strip di luar tepi aspal, bukan satu pita lebar
  // yang juga menutup bagian tengah jalan. Pita lebar bisa lebih tinggi
  // dari aspal di lereng dan muncul sebagai bercak kuning/putih di tengah.
  IslandHub.prototype._shoulderGeo = function (road, sideWidth, yOff) {
    const secs = this._roadSections(road, 1.4);
    const roadHalf = road.width * 0.5;
    const inner = Math.max(0.2, roadHalf - 0.45);
    const outer = roadHalf + (sideWidth || 1.8);
    const mid = (inner + outer) * 0.5;
    const pos = [], uv = [], idx = [];
    const covered = [];
    const K = 3;
    const baseOff = yOff || 0.04;
    for (let i = 0; i < secs.length; i++) {
      const p = secs[i];
      const nx = -p.tz, nz = p.tx;
      // kiri: outer -> mid -> inner
      const left = [outer, mid, inner];
      // kanan: inner -> mid -> outer
      const right = [inner, mid, outer];
      for (let k = 0; k < K; k++) {
        const vx = p.x + nx * left[k], vz = p.z + nz * left[k];
        const vo = isInsidePlaza(vx, vz, -0.2) ? 0.005 : baseOff;
        pos.push(vx, this.heightAt(vx, vz) + vo, vz);
        uv.push(0, p.dist / 9);
        covered.push(isInsidePlaza(vx, vz, -1.0));
      }
      for (let k = 0; k < K; k++) {
        const vx = p.x - nx * right[k], vz = p.z - nz * right[k];
        const vo = isInsidePlaza(vx, vz, -0.2) ? 0.005 : baseOff;
        pos.push(vx, this.heightAt(vx, vz) + vo, vz);
        uv.push(1, p.dist / 9);
        covered.push(isInsidePlaza(vx, vz, -1.0));
      }
    }
    // sama seperti aspal: buang petak hanya bila seluruh sudutnya di bawah plaza
    const hid = (q, r, t, u) => covered[q] && covered[r] && covered[t] && covered[u];
    for (let i = 0; i < secs.length - 1; i++) {
      const a = i * (K * 2), b = a + K * 2;
      for (let k = 0; k < K - 1; k++) {
        const L = a + k, Lb = b + k, R = K + a + k, Rb = K + b + k;
        if (!hid(L, L + 1, Lb, Lb + 1)) idx.push(L, Lb, L + 1, L + 1, Lb, Lb + 1);
        if (!hid(R, R + 1, Rb, Rb + 1)) idx.push(R, Rb, R + 1, R + 1, Rb, Rb + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };

  IslandHub.prototype._buildRoads = function () {
    const roadTex = makeRoadTexture();
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex, color: 0xffffff, roughness: 0.9, metalness: 0.0,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    });
    const trimBatch = new Batch();
    for (let i = 0; i < this.roadPaths.length; i++) {
      const road = this.roadPaths[i];
      const trimGeo = this._shoulderGeo(road, 1.8, 0.04);
      const tc = road.kind === 'ash' ? 0x4d3f4a : road.kind === 'snow' ? 0xc9dce6 :
                 road.kind === 'jungle' ? 0x52673b : road.kind === 'boss' ? 0x51484b : 0xb8a37a;
      trimBatch.addM(trimGeo, new THREE.Color(tc), new THREE.Matrix4());
      trimGeo.dispose();

      const geo = this._roadGeo(road, 0, 0.09);
      const mesh = new THREE.Mesh(geo, roadMat);
      mesh.name = 'Hub_Road_' + road.key;
      this.group.add(mesh);
      this.roadMeshes.push(mesh);
      this.collidableMeshes.push(mesh);
    }
    const trimMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0, metalness: 0, flatShading: true, side: THREE.DoubleSide });
    const trimMesh = trimBatch.mesh(trimMat);
    trimMesh.name = 'Hub_RoadShoulders';
    this.group.add(trimMesh);
    this.roadTrimMesh = trimMesh;
    this.roadTrimMaterial = trimMat;
    this.roadTexture = roadTex;
    this.roadMaterial = roadMat;
  };

  IslandHub.prototype._buildPlazas = function () {
    const tex = makePlazaTexture();
    const defs = [
      { key: 'center', x: 0, z: 0, r: 33, color: 0xa6a397, skirt: 0x7b7466 },
      { key: 'beach', x: -140, z: 178, r: 29, color: 0xd9c184, skirt: 0xbfa66f },
      { key: 'ruins', x: -232, z: 10, r: 30, color: 0x7f9468, skirt: 0x5c6f4b },
      { key: 'glacier', x: -120, z: -172, r: 29, color: 0xc7e7ef, skirt: 0x9fc0ca },
      { key: 'citadel', x: 190, z: 2, r: 31, color: 0x5a4e58, skirt: 0x352c39 }
    ];
    this.plazas = defs;
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      const mat = new THREE.MeshStandardMaterial({ map: tex, color: d.color, roughness: 0.94, metalness: 0.02 });
      const y = this.heightAt(d.x, d.z) + 0.11;
      const mesh = addGroundDisc(this, d.x, d.z, d.r, mat, y, 32);
      mesh.name = 'Hub_Plaza_' + d.key;
      this.group.add(mesh);
      this.plazaMeshes.push(mesh);
      this.collidableMeshes.push(mesh);
      // dasar piringan: dinding penopang agar plaza tidak terlihat melayang di tepi pantai
      const skirtMat = new THREE.MeshStandardMaterial({
        color: d.skirt || 0x6f675b, roughness: 1.0, metalness: 0, flatShading: true
      });
      const skirt = new THREE.Mesh(
        new THREE.CylinderGeometry(d.r - 0.1, d.r - 2.2, 3.4, 32, 1, true),
        skirtMat
      );
      skirt.position.set(d.x, y - 1.7, d.z);
      skirt.name = 'Hub_PlazaBase_' + d.key;
      this.group.add(skirt);
      const ringMat = new THREE.MeshBasicMaterial({ color: d.key === 'citadel' ? 0x2c2030 : 0x6c6258, transparent: true, opacity: 0.8 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(d.r - 0.7, 0.26, 6, 44), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(d.x, y + 0.05, d.z);
      this.group.add(ring);
    }
    this.plazaTexture = tex;
  };

  // ==========================================================================
  // BIOMA: GEM STONE VALLEY (pusat)
  // ==========================================================================
  IslandHub.prototype._buildCenter = function () {
    const b = this.batch, gl = this.glow;
    const x = 0, z = 0;
    const H = this.heightAt(x, z);

    // cincin batu konsentris di plateau
    for (let k = 0; k < 3; k++) {
      const r = 13 + k * 9;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.28 - k * 0.04, 6, 44),
        new THREE.MeshStandardMaterial({ color: 0x726b60, roughness: 1, flatShading: true }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, H + 0.14, z);
      this.group.add(ring);
    }
    // jalur masuk selatan: causeway batu rendah yang menyatu dengan tanah.
    // Dulu di sini ada tangga yang melayang 1,7 m di atas plaza karena
    // memakai tinggi pusat, bukan tinggi tanah setempat.
    b.add(G.box, 0x9a9588, x, H + 0.06, z + 35.5,
      0, 0, 0, 12, 0.09, 5.0);
    b.add(G.box, 0x948d7f, x, H + 0.08, z + 40.7,
      0, 0, 0, 17, 0.11, 6.8);
    // Apron masuk untuk tiga spoke lain: sambungkan bibir plaza ke ujung
    // jalan supaya tidak ada jalan menggantung di atas rumput.
    b.add(G.box, 0x948d7f, -38.5, H + 0.07, 0, 0, 0, 0, 13, 0.08, 18);
    b.add(G.box, 0x948d7f,  38.5, H + 0.07, 0, 0, 0, 0, 13, 0.08, 20);
    b.add(G.box, 0x948d7f, -28.4, H + 0.07, -28.4, 0, -Math.PI * 3 / 4, 0, 18, 0.08, 15);

    // pedestal
    b.add(G.cyl, 0x776f63, x, H + 0.6, z, 0, 0, 0, 9.2, 1.2, 9.2);
    b.add(G.cyl, 0x8d8577, x, H + 1.55, z, 0, 0, 0, 7.0, 0.9, 7.0);
    b.add(G.cyl, 0x6a6258, x, H + 2.7, z, 0, 0, 0, 4.8, 1.5, 4.8);
    b.add(G.cyl, 0x9d9a8c, x, H + 3.5, z, 0, 0, 0, 5.6, 0.25, 5.6);
    gl.add(G.torus, 0x5dff9c, x, H + 3.7, z, Math.PI / 2, 0, 0, 5.0, 5.0, 5.0);
    // pilar penjaga
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * TAU + Math.PI / 4;
      const px = Math.cos(a) * 12.5, pz = Math.sin(a) * 12.5;
      b.add(G.cyl, 0x8a8274, px, H + 2.0, pz, 0, 0, 0, 1.1, 4.0, 1.1);
      b.add(G.box, 0xa6a093, px, H + 4.2, pz, 0, a, 0, 2.5, 0.5, 2.5);
      gl.add(G.octa, 0x75ffab, px, H + 4.9, pz, 0, a, 0, 0.55, 0.9, 0.55);
    }
    // gerbang masuk selatan
    [-6.8, 6.8].forEach(sx => {
      b.add(G.box, 0x7e7769, x + sx, H + 3.0, z + 39, 0, 0, 0, 1.6, 6.0, 1.8);
      b.add(G.box, 0x9d9686, x + sx, H + 6.3, z + 39, 0, 0, 0, 2.2, 0.6, 2.3);
    });
    b.add(G.box, 0x857d6f, x, H + 6.8, z + 39, 0, 0, 0, 16, 1.0, 1.8);
    gl.add(G.box, 0x56ff9a, x, H + 6.3, z + 39.95, 0, 0, 0, 12.6, 0.12, 0.12);

    // kristal besar (dinamis)
    const gem = new THREE.Group();
    gem.name = 'Hub_GiantGem';
    const gemY = H + 12.2;
    const gemMat = new THREE.MeshStandardMaterial({
      color: 0x4bff98, emissive: 0x16c76a, emissiveIntensity: 1.25,
      roughness: 0.14, metalness: 0.2, flatShading: true, transparent: true, opacity: 0.96
    });
    const gemCoreMat = new THREE.MeshBasicMaterial({ color: 0xd2ffe8 });
    const main = new THREE.Mesh(new THREE.OctahedronGeometry(3.6, 0), gemMat);
    main.scale.set(1, 2.35, 1);
    gem.add(main);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), gemCoreMat);
    core.scale.set(1, 1.7, 1);
    gem.add(core);
    const shards = [];
    for (let k = 0; k < 4; k++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.55 + k * 0.1, 0), gemMat);
      s.scale.y = 1.5;
      s.position.set(Math.cos(k / 4 * TAU) * 5, 0, Math.sin(k / 4 * TAU) * 5);
      gem.add(s);
      shards.push(s);
    }
    const aura = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 4.6, 16, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x5cff9d, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    aura.position.y = -2;
    gem.add(aura);
    gem.position.set(x, gemY, z);
    this.group.add(gem);
    this.gem = gem;
    this.gemMain = main;
    this.gemShards = shards;
    const gemLight = new THREE.PointLight(0x45ff91, 1.25, 95, 2);
    gemLight.position.set(x, H + 14, z);
    this.group.add(gemLight);
    this.lights.push(gemLight);
    this.gemLight = gemLight;

    // blimp sci-fi kuning-biru
    const blimp = new THREE.Group();
    blimp.name = 'Hub_Blimp';
    const yellow = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.45, metalness: 0.18, flatShading: true });
    const blue = new THREE.MeshStandardMaterial({ color: 0x2f7fe0, roughness: 0.5, metalness: 0.22, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: 0x293240, roughness: 0.65, metalness: 0.4, flatShading: true });
    const envelope = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), yellow);
    envelope.scale.set(4.2, 4.2, 10.5);
    blimp.add(envelope);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(4.1, 4.8, 18), yellow);
    nose.rotation.x = Math.PI / 2; nose.position.z = 10.4;
    blimp.add(nose);
    for (let k = 0; k < 3; k++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(4.15, 0.16, 6, 24), blue);
      band.position.z = -6 + k * 5.2;
      blimp.add(band);
    }
    const gondola = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.2, 7.2), blue);
    gondola.position.set(0, -4.4, 0.4);
    blimp.add(gondola);
    for (let k = -1; k <= 1; k += 2) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.2, 4.5), dark);
      fin.position.set(0, 1.8, -9.2 + (k + 1) * 1.2);
      fin.rotation.z = k * 0.55;
      blimp.add(fin);
    }
    const prop = new THREE.Group();
    prop.position.set(0, -0.4, -10.9);
    for (let k = 0; k < 3; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.6, 0.16), dark);
      blade.rotation.z = k / 3 * TAU;
      blade.position.y = 1.6;
      prop.add(blade);
    }
    blimp.add(prop);
    for (let k = -2; k <= 2; k += 4) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.12), new THREE.MeshBasicMaterial({ color: 0x7ff7ff }));
      win.position.set(k, -4.1, 4.02);
      blimp.add(win);
    }
    blimp.position.set(38, H + 27, -18);
    this.group.add(blimp);
    this.blimp = blimp;
    this.blimpProp = prop;

    // panggung kecil & gapura di tepi utara plateau
    b.add(G.cyl, 0x817a6d, x, H + 0.8, z - 31, 0, 0, 0, 5.2, 1.6, 5.2);
    gl.add(G.torus, 0x5be7ff, x, H + 1.75, z - 31, Math.PI / 2, 0, 0, 4.0, 4.0, 4.0);

    // objek pusat ini solid: dulu kart bisa menembus pedestal, panggung,
    // dan tiang gerbang masuk selatan.
    this.colliders.push({ x, z, r: 9.3 });
    this.colliders.push({ x, z: z - 31, r: 5.3 });
    this.colliders.push({ x: x - 6.8, z: z + 39, r: 1.0 });
    this.colliders.push({ x: x + 6.8, z: z + 39, r: 1.0 });
    this.scatterExclusions.push({ x, z: z - 31, r: 8.0 });
    this.scatterExclusions.push({ x, z: z + 39, r: 10.5 });
  };

  // ==========================================================================
  // BIOMA: N. SANITY BEACH
  // ==========================================================================
  IslandHub.prototype._buildBeach = function () {
    const b = this.batch, gl = this.glow;
    const bx = -140, bz = 178;
    const H = this.heightAt(bx, bz);

    // pier kayu keluar ke laut. Mulai dari bibir plaza, bukan dari tengah
    // plaza: dulu seluruh badan pier tertimbun di bawah piringan plaza.
    const a = Math.atan2(bx, bz);
    const ox = Math.sin(a), oz = Math.cos(a);
    const px = -ox, pz = -oz;
    const beachPlaza = this.plazas && this.plazas.find(pl => pl.key === 'beach');
    const plazaR = beachPlaza ? beachPlaza.r : 29;
    const startR = Math.hypot(bx, bz) + plazaR - 1.0;
    const sx = Math.sin(a) * startR, sz = Math.cos(a) * startR;
    const deckY = H - 0.12; // atas papan ~ H+0.02, menyambung permukaan plaza
    const plankN = 28;
    for (let i = 0; i < plankN; i++) {
      const r = 2.0 + i * 1.7;
      const x = sx + ox * r, z = sz + oz * r;
      b.add(G.box, i % 3 === 0 ? 0x7a5028 : 0x91612f, x, deckY, z, 0, a, 0, 6.6, 0.28, 1.55);
      if (i % 6 === 0) this.scatterExclusions.push({ x, z, r: 6.5 });
      if (i % 4 === 0) {
        [-3, 3].forEach(s => {
          const postX = x + px * s, postZ = z + pz * s;
          const postBottom = -1.0;
          const postTop = deckY - 0.12;
          b.add(G.cyl, 0x5a3a1f, postX, (postBottom + postTop) * 0.5, postZ, 0, 0, 0, 0.36, postTop - postBottom, 0.36);
          b.add(G.cyl, 0x6d4928, postX, deckY + 0.92, postZ, 0, 0, 0, 0.26, 1.8, 0.26);
        });
      }
    }
    // gapura pier di pangkal deck, menghadap laut
    const endX = sx + ox * 2.0, endZ = sz + oz * 2.0;
    [-3.2, 3.2].forEach(s => {
      b.add(G.box, 0x6b4525, endX + px * s, H + 2.3, endZ + pz * s, 0, a, 0, 0.5, 4.6, 0.5);
    });
    b.add(G.box, 0x6b4525, endX, H + 4.4, endZ, 0, a, 0, 7.2, 0.5, 0.5);

    // kapal bajak laut kandas (group agar mudah dimiringkan)
    const ship = new THREE.Group();
    ship.name = 'Hub_PirateShip';
    const wood = new THREE.MeshStandardMaterial({ color: 0x6f431f, roughness: 0.9, flatShading: true });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x4b2a12, roughness: 0.95, flatShading: true });
    const sailMat = new THREE.MeshStandardMaterial({ color: 0xd8c8a2, roughness: 0.9, side: THREE.DoubleSide, flatShading: true });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(6.2, 3.2, 17), wood);
    hull.position.y = 1.4; ship.add(hull);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.5, 17.6), woodDark);
    belt.position.y = 2.65; ship.add(belt);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(4.2, 5.2, 4), wood);
    bow.rotation.x = Math.PI / 2; bow.rotation.z = Math.PI / 4;
    bow.position.set(0, 1.4, 9.9); ship.add(bow);
    const stern = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.2, 3.2), woodDark);
    stern.position.set(0, 2.4, -9.6); ship.add(stern);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 15, 8), woodDark);
    mast.position.set(0, 9.2, 0.5); ship.add(mast);
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 10.8, 7), woodDark);
    cross.rotation.z = Math.PI / 2; cross.position.set(0, 11.2, 0.5); ship.add(cross);
    const sailShape = new THREE.Shape();
    sailShape.moveTo(-4.7, 0); sailShape.lineTo(4.7, 0);
    sailShape.lineTo(3.8, 5.0); sailShape.lineTo(2.2, 4.4); sailShape.lineTo(1.0, 5.4);
    sailShape.lineTo(-0.8, 4.8); sailShape.lineTo(-2.4, 5.2); sailShape.lineTo(-3.9, 4.5);
    sailShape.closePath();
    const sailGeo = new THREE.ShapeGeometry(sailShape);
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0, 8.2, 0.55); ship.add(sail);
    const sail2 = new THREE.Mesh(sailGeo, sailMat);
    sail2.position.set(0, 8.2, 0.42); sail2.scale.setScalar(0.68); ship.add(sail2);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.15), new THREE.MeshBasicMaterial({ color: 0x26262e, side: THREE.DoubleSide }));
    flag.position.set(1.4, 15.8, 0.5); ship.add(flag);
    for (let k = 0; k < 4; k++) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.0, 7), woodDark);
      can.rotation.z = Math.PI / 2;
      can.position.set(3.35, 1.2, -5 + k * 3); ship.add(can);
    }
    // Geser wreck ke sisi timur pier supaya lambung tidak menembus papan.
    const shipX = -164, shipZ = 236;
    ship.position.set(shipX, Math.max(this.heightAt(shipX, shipZ) + 0.6, 0.05), shipZ);
    ship.rotation.set(0.16, 0.5, 0.18);
    this.group.add(ship);
    this.colliders.push({ x: shipX, z: shipZ, r: 8.5 });
    this.scatterExclusions.push({ x: shipX, z: shipZ, r: 14.0 });
    this.ship = ship;
    this.animated.flags.push({ mesh: flag, phase: 0.7, amp: 0.6 });

    // air terjun kecil: tebing batu + kolam
    const wx = -186, wz = 145;
    const wy = this.heightAt(wx, wz);
    this.scatterExclusions.push({ x: wx, z: wz, r: 12.5 });
    for (let k = 0; k < 7; k++) {
      const rx = wx + (Math.random() - 0.5) * 11;
      const rz = wz + (Math.random() - 0.5) * 8;
      const ss = 3.5 + Math.random() * 4;
      b.add(G.dodeca, k % 2 ? 0x77786c : 0x5f665d, rx, wy + ss * 0.55 + k * 0.36, rz, 0.2, Math.random() * 3, 0.15, ss, ss * 0.8, ss);
    }
    const fallTex = makeWaterfallTexture();
    const fallMat = new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false });
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 11.5), fallMat);
    fall.position.set(wx, wy + 6.2, wz + 4.6);
    fall.rotation.x = -0.06;
    this.group.add(fall);
    this.animated.waterfalls.push({ mesh: fall, tex: fallTex, speed: 1.35 });
    const poolMat = new THREE.MeshStandardMaterial({
      color: 0x62d6e8, roughness: 0.2, metalness: 0.05, transparent: true, opacity: 0.78, side: THREE.DoubleSide
    });
    const pool = addGroundDisc(this, wx, wz + 5.5, 7.2, poolMat, wy + 0.18, 24);
    this.group.add(pool);
    this.shallows.push({ x: wx, z: wz + 5.5, r: 7.4 });
    const foam = new THREE.Mesh(new THREE.RingGeometry(5.7, 7.4, 22),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
    foam.rotation.x = -Math.PI / 2; foam.position.set(wx, wy + 0.24, wz + 5.5);
    this.group.add(foam);
    this.animated.pulses.push({ mat: foam.material, base: 0.3, amp: 0.18, speed: 2.2 });

    // payung & bola pantai (di luar radius plaza r=29)
    const cols = [0xff5a5a, 0x3fb6ff, 0xffd23f, 0xff8a4c, 0x8b5cff];
    for (let k = 0; k < 7; k++) {
      const aa = k / 7 * TAU + 0.3;
      const rr = 32.5 + (k % 3) * 5;
      const x = bx + Math.cos(aa) * rr, z = bz + Math.sin(aa) * rr;
      if (this._nearRoad(x, z, 6) || Math.hypot(x - bx, z - bz) < plazaR + 2.5) continue;
      if (this._insideCollider(x, z, 1.5)) continue;
      const h = this.heightAt(x, z);
      if (h < 0.8) continue;
      b.add(G.cyl, 0xeeeae0, x, h + 1.45, z, 0, 0, 0, 0.08, 2.9, 0.08);
      b.add(G.cone, cols[k % cols.length], x, h + 3.1, z, 0, aa, 0, 2.1, 1.15, 2.1);
      b.add(G.sphereLow, cols[(k + 2) % cols.length], x + 2.6, h + 0.34, z + 1.2, 0, 0, 0, 0.38, 0.38, 0.38);
      this.colliders.push({ x, z, r: 0.6 });
    }
    // tiki torch pantai: diletakkan di sisi lapangan, bukan di tengah jalan.
    // Dulu tiangnya berdiri tepat di garis tengah Beach Run / Island Loop.
    [[-145.7, 210.5], [-168.6, 194.5]].forEach(p => {
      const x = p[0], z = p[1];
      const h = this.heightAt(x, z);
      b.add(G.cyl, 0x6f4320, x, h + 1.7, z, 0, 0, 0, 0.16, 3.4, 0.16);
      b.add(G.box, 0x4a2b12, x, h + 3.55, z, 0, 0.2, 0, 0.6, 0.75, 0.6);
      gl.add(G.cone, 0xff8a1f, x, h + 4.2, z, 0, 0, 0, 0.36, 1.0, 0.36);
      this.colliders.push({ x, z, r: 0.45 });
    });
    // papan nama pantai
    this._addSign(b, -155.8, 156.6, 0x6b4525, '#16204a', 'TELUK BEKICOT', 'OMBAK • PASIR • LAJU', '#ffd23f');
  };

  function addGroundDisc(map, x, z, r, mat, y, seg) {
    const g = new THREE.CircleGeometry(r, seg || 28);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y == null ? map.heightAt(x, z) + 0.06 : y, z);
    return m;
  }

  IslandHub.prototype._addSign = function (batch, x, z, woodColor, bg, title, sub, fg) {
    const h = this.heightAt(x, z);
    batch.add(G.cyl, 0x5a381d, x - 3.2, h + 2.1, z, 0, 0, 0, 0.22, 4.2, 0.22);
    batch.add(G.cyl, 0x5a381d, x + 3.2, h + 2.1, z, 0, 0, 0, 0.22, 4.2, 0.22);
    batch.add(G.box, woodColor, x, h + 4.15, z, 0, 0, 0, 7.8, 2.0, 0.36);
    // tiang papan nama ikut solid supaya kart tidak menembusnya
    this.colliders.push({ x: x - 3.2, z, r: 0.3 });
    this.colliders.push({ x: x + 3.2, z, r: 0.3 });
    const tex = makeBannerTexture(title, sub, bg, fg);
    // Papan dua sisi: teks di sisi belakang tidak tampil terbalik.
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 1.85),
      new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(x, h + 4.15, z + 0.22);
    this.group.add(sign);
    const signBack = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 1.85),
      new THREE.MeshBasicMaterial({ map: tex }));
    signBack.position.set(x, h + 4.15, z - 0.22);
    signBack.rotation.y = Math.PI;
    this.group.add(signBack);
    this.textures = this.textures || [];
    this.textures.push(tex);
  };

  // ==========================================================================
  // BIOMA: THE LOST RUINS
  // ==========================================================================
  IslandHub.prototype._addPyramid = function (cx, cz, base, height, levels, yaw, palette) {
    const b = this.batch, gl = this.glow;
    const y0 = this.heightAt(cx, cz);
    const stoneA = palette ? palette[0] : 0x8d8a72;
    const stoneB = palette ? palette[1] : 0x6e735a;
    const moss = palette ? palette[2] : 0x477a35;
    const stepH = height / levels;
    // Fondasi: tapak piramida bisa memotong lereng. Cari tanah terendah di
    // bawah tapak lalu isi dengan batu supaya sisi bawahnya tidak melayang.
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const footMin = (lx0, lz0, hw, hd) => {
      let m = Infinity;
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          const lx = lx0 + i / 2 * hw, lz = lz0 + j / 2 * hd;
          m = Math.min(m, this.heightAt(cx + lx * cy + lz * sy, cz - lx * sy + lz * cy));
        }
      }
      return m;
    };
    const baseMin = footMin(0, 0, base * 0.52, base * 0.52);
    if (y0 - baseMin > 0.2) {
      const bot = baseMin - 0.6, top = y0 + 0.05;
      b.add(G.box, stoneB, cx, (bot + top) * 0.5, cz, 0, yaw, 0, base * 1.04, top - bot, base * 1.04);
    }
    {
      // anak tangga paling bawah juga dijejakkan ke tanah
      const front0 = base * 0.5 + 1.0;
      const stMin = footMin(0, front0, 1.6, 0.9);
      if (y0 - stMin > 0.2) {
        const bot = stMin - 0.4, top = y0 + 0.05;
        b.add(G.box, 0xb6ac8e, cx + sy * front0, (bot + top) * 0.5, cz + cy * front0, 0, yaw, 0, 3.2, top - bot, 1.8);
      }
    }
    for (let k = 0; k < levels; k++) {
      const t = k / levels;
      const size = base * (1 - t * 0.7);
      const col = k % 2 ? stoneA : stoneB;
      b.add(G.box, col, cx, y0 + stepH * (k + 0.5), cz, 0, yaw, 0, size, stepH * 1.02, size);
      // lumut di sisi anak tangga
      if (k % 2 === 0) b.add(G.box, moss, cx + Math.sin(yaw + 0.5) * size * 0.32, y0 + stepH * (k + 0.15), cz + Math.cos(yaw + 0.5) * size * 0.32,
        0, yaw, 0, size * 0.3, 0.12, size * 0.08);
    }
    // tangga depan menghadap plaza
    for (let k = 0; k < levels; k++) {
      const t = k / levels;
      const size = base * (1 - t * 0.7);
      const front = size * 0.5 + 1.0;
      const lx = Math.sin(yaw) * front, lz = Math.cos(yaw) * front;
      b.add(G.box, 0xb6ac8e, cx + lx, y0 + stepH * (k + 0.5), cz + lz,
        0, yaw, 0, 3.2, stepH * 1.04, 1.8);
    }
    const topY = y0 + height;
    b.add(G.box, 0x9d967c, cx, topY + 1.4, cz, 0, yaw, 0, base * 0.24, 2.8, base * 0.22);
    gl.add(G.octa, 0xffb52e, cx, topY + 3.7, cz, 0, yaw, 0, 0.85, 1.3, 0.85);
    gl.add(G.torus, 0x8aff67, cx, topY + 0.35, cz, Math.PI / 2, yaw, 0, 3.2, 3.2, 3.2);
    // pintu masuk gelap
    const front = base * 0.5 + 0.15;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.8),
      new THREE.MeshBasicMaterial({ color: 0x151812, side: THREE.DoubleSide }));
    door.position.set(cx + Math.sin(yaw) * (front + 0.1), y0 + 2.0, cz + Math.cos(yaw) * (front + 0.1));
    door.rotation.y = yaw;
    this.group.add(door);
    // sulur menjalar
    const vineN = 6;
    for (let k = 0; k < vineN; k++) {
      const a = (k / vineN) * TAU + 0.2;
      const r0 = base * 0.45, r1 = base * 0.28;
      addBeam(b, 0x376b2d,
        cx + Math.cos(a) * r0, y0 + 0.8, cz + Math.sin(a) * r0,
        cx + Math.cos(a) * r1, y0 + height * 0.7, cz + Math.sin(a) * r1, 0.16);
    }
    this.colliders.push({ x: cx, z: cz, r: base * 0.57 });
    this.scatterExclusions.push({ x: cx, z: cz, r: base * 0.65 + 4.5 });
  };

  IslandHub.prototype._addTiki = function (x, z, s, yaw) {
    const b = this.batch, gl = this.glow;
    const h = this.heightAt(x, z);
    b.add(G.cyl, 0x75694f, x, h + 0.35, z, 0, yaw, 0, 1.5 * s, 0.7 * s, 1.5 * s);
    b.add(G.cyl, 0x8d805f, x, h + 2.0 * s, z, 0, yaw, 0, 1.3 * s, 3.0 * s, 1.3 * s);
    b.add(G.box, 0x7c6c4d, x, h + 4.2 * s, z, 0, yaw, 0, 2.5 * s, 2.4 * s, 2.1 * s);
    b.add(G.box, 0x5d563f, x, h + 5.5 * s, z, 0, yaw, 0, 2.9 * s, 0.45 * s, 2.4 * s);
    // mata & mulut menyala
    const ex = Math.cos(yaw) * 1.15 * s, ez = Math.sin(yaw) * 1.15 * s;
    gl.add(G.box, 0xffa52b, x + ex, h + 4.35 * s, z + ez, 0, yaw, 0, 0.42 * s, 0.34 * s, 0.12);
    gl.add(G.box, 0xffa52b, x - ex, h + 4.35 * s, z - ez, 0, yaw, 0, 0.42 * s, 0.34 * s, 0.12);
    gl.add(G.box, 0xff6c1f, x, h + 3.6 * s, z, 0, yaw, 0, 1.35 * s, 0.28 * s, 0.12);
    b.add(G.cone, 0x4d6b36, x, h + 6.3 * s, z, 0, yaw, 0, 1.6 * s, 1.3 * s, 1.6 * s);
    b.add(G.box, 0x6b5f45, x + 2.2 * s, h + 2.3 * s, z, 0, yaw, 0, 0.7 * s, 2.9 * s, 0.7 * s);
    this.colliders.push({ x, z, r: 1.3 * s });
  };

  IslandHub.prototype._buildRuins = function () {
    const b = this.batch, gl = this.glow;
    const cx = -232, cz = 10;
    const H = this.heightAt(cx, cz);

    // dua piramida bertingkat
    this._addPyramid(-258, 56, 30, 21, 7, Math.atan2(cx + 258, cz - 56) * -1, [0x938f76, 0x777a5e, 0x3e7532]);
    this._addPyramid(-218, -44, 24, 16, 6, Math.atan2(cx + 218, cz + 44), [0x9a957c, 0x70765a, 0x447c34]);

    // altar dengan bola api hijau
    const ax = -239, az = 24;
    b.add(G.box, 0x6f6b58, ax, H + 1.2, az, 0, 0.3, 0, 5.2, 1.0, 3.6);
    b.add(G.box, 0x8b846b, ax, H + 2.0, az, 0, 0.3, 0, 3.4, 0.7, 2.4);
    gl.add(G.octa, 0x7dff5b, ax, H + 3.2, az, 0, 0, 0, 0.8, 1.2, 0.8);
    gl.add(G.torus, 0x6fff47, ax, H + 0.55, az, Math.PI / 2, 0.3, 0, 4.4, 4.4, 4.4);
    this.colliders.push({ x: ax, z: az, r: 2.8 });

    // tiki penjaga (jarak aman dari jalan)
    const tikis = [
      [-216, 30, 1.0], [-222, -14, 1.15], [-252, 28, 1.2],
      [-250, -18, 0.95], [-202, 27, 1.05], [-242, 72, 0.9]
    ];
    tikis.forEach((t, k) => {
      if (this._nearRoad(t[0], t[1], 4)) return;
      this._addTiki(t[0], t[1], t[2], Math.atan2(cx - t[0], cz - t[1]) + k * 0.4);
    });

    // gapura batu di pintu masuk dari timur. Tiang digeser ke luar badan
    // jalan (setengah lebar 9 + tiang + clearance) supaya tidak tertembus.
    const gx = -205, gz = 10;
    [-11.5, 11.5].forEach(s => {
      b.add(G.box, 0x766e58, gx, H + 3.6, gz + s, 0, 0, 0, 2.0, 7.2, 2.0);
      b.add(G.box, 0x9f9476, gx, H + 7.5, gz + s, 0, 0, 0, 2.8, 0.7, 2.8);
      gl.add(G.octa, 0x8cff5a, gx, H + 8.25, gz + s, 0, 0, 0, 0.38, 0.6, 0.38);
      this.colliders.push({ x: gx, z: gz + s, r: 1.2 });
    });
    b.add(G.box, 0x6f6753, gx, H + 8.0, gz, 0, 0, 0, 3.2, 1.2, 25.0);
    b.add(G.box, 0x857b62, gx, H + 8.8, gz, 0, 0, 0, 2.0, 0.5, 23.2);

    // pilar batu bertingkat di lorong masuk. Hanya dua pasang di luar
    // plaza; pasangan di dekat gerbang dan spawn dihapus agar tidak
    // bertumpuk dengan gapura/spawn.
    for (let k = 0; k < 2; k++) {
      const px = -193 - k * 7;
      [-11.5, 11.5].forEach(s => {
        const pz = gz + s;
        if (this._nearRoad(px, pz, 2)) return;
        b.add(G.box, 0x7d765e, px, H + 1.2, pz, 0, 0.12, 0, 1.5, 2.4, 1.5);
        b.add(G.cyl, 0x928a6e, px, H + 3.2, pz, 0, 0, 0, 0.65, 3.2, 0.65);
        b.add(G.box, 0x3f7833, px, H + 4.8, pz, 0, 0.2, 0, 1.35, 0.35, 1.35);
        this.colliders.push({ x: px, z: pz, r: 0.9 });
      });
    }
    // batu monolit & tanaman rambat
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * TAU;
      const rr = 35 + (k % 3) * 9;
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      if (this._nearRoad(x, z, 5)) continue;
      if (this.plazas && this.plazas.some(pl => Math.hypot(x - pl.x, z - pl.z) < pl.r + 3)) continue;
      if (this.scatterExclusions && this.scatterExclusions.some(e => Math.hypot(x - e.x, z - e.z) < e.r)) continue;
      if (this._insideCollider(x, z, 1.2)) continue;
      b.add(G.dodeca, k % 2 ? 0x77725d : 0x5f6851, x, H + 0.8, z, 0.2, a, 0.1, 1.1 + (k % 2) * 0.6, 2.2 + (k % 3) * 0.6, 0.9);
      this.colliders.push({ x, z, r: 1.3 });
    }
    this._addFireflies(cx, cz, H + 3, 34, 16, 0x9dff72);
  };

  // ==========================================================================
  // BIOMA: GLACIER PARK
  // ==========================================================================
  // Puncak gunung es: kerucut radial tak beraturan, kaki mengikuti kontur tanah
  // (tanpa alas datar, jadi tidak ada permukaan hitam yang menggantung di atas plaza)
  IslandHub.prototype._addIcePeak = function (x, z, height, radius, seed, tone) {
    const rnd = mulberry32(seed);
    const seg = 11;
    const levels = [
      { t: 0.00, r: 1.00, y: 0.00 },
      { t: 0.30, r: 0.76, y: 0.26 },
      { t: 0.58, r: 0.52, y: 0.54 },
      { t: 0.80, r: 0.30, y: 0.78 },
      { t: 0.94, r: 0.11, y: 0.92 },
      { t: 1.00, r: 0.00, y: 1.00 }
    ];
    const topY = this.heightAt(x, z);
    const edge = [];
    for (let i = 0; i < seg; i++) edge.push(0.78 + rnd() * 0.40);
    const verts = levels.map((lv, li) => {
      const arr = [];
      for (let i = 0; i < seg; i++) {
        const a = i / seg * TAU + li * 0.11 + (rnd() - 0.5) * 0.1;
        const rr = radius * lv.r * (li === 0 ? edge[i] : (0.9 + rnd() * 0.2));
        const px = x + Math.cos(a) * rr;
        const pz = z + Math.sin(a) * rr;
        let py;
        if (li === 0) py = this.heightAt(px, pz) - 0.7;
        else py = topY + height * (lv.y + (li < 5 ? (rnd() - 0.5) * 0.035 : 0));
        arr.push({ x: px, y: py, z: pz });
      }
      return arr;
    });
    const cLow = new THREE.Color(tone || 0x606b78);
    const cMid = new THREE.Color(0x8c98a4);
    const cSnow = new THREE.Color(0xe9f5fb);
    const pos = [], col = [];
    const tri = (a, b, c) => {
      const avg = ((a.y + b.y + c.y) / 3 - topY) / height;
      const cc = new THREE.Color();
      if (avg < 0.34) cc.copy(cLow).lerp(cMid, smooth(0, 0.34, avg));
      else cc.copy(cMid).lerp(cSnow, smooth(0.34, 0.55, avg));
      cc.offsetHSL(0, 0, (rnd() - 0.5) * 0.035);
      [a, b, c].forEach(v => { pos.push(v.x, v.y, v.z); col.push(cc.r, cc.g, cc.b); });
    };
    for (let li = 0; li < levels.length - 1; li++) {
      for (let i = 0; i < seg; i++) {
        const i2 = (i + 1) % seg;
        const a = verts[li][i], b = verts[li][i2];
        const c = verts[li + 1][i], d = verts[li + 1][i2];
        tri(a, c, b);
        tri(b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.96, metalness: 0.01, flatShading: true
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'Hub_IcePeak';
    this.group.add(mesh);
    return mesh;
  };

  IslandHub.prototype._buildGlacier = function () {
    const b = this.batch, gl = this.glow;
    const cx = -120, cz = -172;
    const H = this.heightAt(cx, cz);

    // Gunung berfaset: satu puncak utama + dua punggung. Seluruh rangkaian
    // digeser ke barat laut supaya kaki gunung tidak lagi memotong plaza es.
    const mx = -174, mz = -220;
    const peaks = [
      { x: mx, z: mz, r: 40 },
      { x: mx - 27, z: mz + 19, r: 25 },
      { x: mx + 19, z: mz + 7, r: 22 }
    ];
    this._addIcePeak(peaks[0].x, peaks[0].z, 38, peaks[0].r, 3311, 0x5d6876);
    this._addIcePeak(peaks[1].x, peaks[1].z, 26, peaks[1].r, 3312, 0x68727f);
    this._addIcePeak(peaks[2].x, peaks[2].z, 21, peaks[2].r, 3313, 0x6c7682);
    // collider mengikuti badan gunung; exclusion scatter memakai radius visual
    peaks.forEach(p => {
      this.colliders.push({ x: p.x, z: p.z, r: p.r * 0.9 });
      this.scatterExclusions.push({ x: p.x, z: p.z, r: p.r + 2.5 });
    });

    const inPeak = (x, z, pad) => {
      const p = pad || 0;
      for (let i = 0; i < peaks.length; i++) {
        const pk = peaks[i];
        if (Math.hypot(x - pk.x, z - pk.z) < pk.r + p) return true;
      }
      return false;
    };

    // pecahan batu di kaki gunung
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * TAU;
      const rr = 44 + (k % 3) * 8;
      const x = mx + Math.cos(a) * rr, z = mz + Math.sin(a) * rr;
      if (this.plazas && this.plazas.some(pl => Math.hypot(x - pl.x, z - pl.z) < pl.r + 4)) continue;
      if (this._nearRoad(x, z, 3)) continue;
      if (inPeak(x, z, 1.5)) continue;
      const rrScale = 4 + k % 3;
      b.add(G.dodeca, k % 2 ? 0x77828c : 0x5f6873, x, this.heightAt(x, z) + 2, z, 0.2, a, 0.1, rrScale, 3.5 + (k % 4), 4);
      this.colliders.push({ x, z, r: 2.6 + (k % 3) * 0.5 });
    }

    // kolam es 2 (kolam di dalam badan gunung sudah dihapus)
    const ponds = [
      { x: -50, z: -150, r: 7.6 }
    ];
    ponds.forEach((p, k) => {
      const py = this.heightAt(p.x, p.z) + 0.28;
      const mat = new THREE.MeshStandardMaterial({
        color: 0x7fe4ff, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.8, side: THREE.DoubleSide
      });
      this.group.add(addGroundDisc(this, p.x, p.z, p.r, mat, py, 24));
      this.shallows.push({ x: p.x, z: p.z, r: p.r });
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * TAU + k;
        const rr = p.r + 1.5 + (i % 3) * 1.5;
        const x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr;
        gl.add(G.cone6, i % 2 ? 0xbdf6ff : 0x7fdcf2, x, this.heightAt(x, z) + 1.4, z, 0, a, 0.1, 0.6 + i % 2 * 0.3, 2.2 + i % 3, 0.6);
      }
    });

    // manusia salju
    const sx = -134, sz = -146;
    const sy = this.heightAt(sx, sz);
    b.add(G.sphere, 0xf6fbff, sx, sy + 1.15, sz, 0, 0, 0, 1.35, 1.3, 1.35);
    b.add(G.sphere, 0xf6fbff, sx, sy + 2.75, sz, 0, 0, 0, 0.95, 0.95, 0.95);
    b.add(G.cone, 0xff8a1c, sx + 0.95, sy + 2.8, sz, 0, 0, Math.PI / 2, 0.18, 0.7, 0.18);
    b.add(G.cyl, 0x4b3a2b, sx, sy + 2.75, sz, 0, 0, 0, 0.22, 0.8, 0.22);
    b.add(G.box, 0x26262e, sx - 0.35, sy + 2.95, sz + 0.78, 0, 0, 0, 0.16, 0.16, 0.1);
    b.add(G.box, 0x26262e, sx + 0.35, sy + 2.95, sz + 0.78, 0, 0, 0, 0.16, 0.16, 0.1);
    b.add(G.cyl, 0x2d6b4a, sx, sy + 4.1, sz, 0, 0, 0, 0.6, 0.65, 0.6);
    this.colliders.push({ x: sx, z: sz, r: 1.7 });

    // pecahan kristal es di luar batas plaza, tidak menembus gunung atau papan nama
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * TAU + 0.4;
      const rr = 31.5 + (k % 3) * 5;
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      if (this._nearRoad(x, z, 4.5) || Math.hypot(x - sx, z - sz) < 5.5) continue;
      if (this._insideCollider(x, z, 1.2)) continue;
      if (inPeak(x, z, 1.5)) continue;
      if (Math.hypot(x + 118.1, z + 146.0) < 7.5) continue;
      const y = this.heightAt(x, z);
      gl.add(G.cone6, k % 2 ? 0xbef7ff : 0x77dff4, x, y + 1.2, z, 0, a, 0.1, 0.55, 2.4 + (k % 3) * 0.8, 0.55);
      b.add(G.dodeca, 0xb9d9e6, x, y + 0.25, z, 0.2, a, 0.1, 1.2, 0.7, 1.2);
      this.colliders.push({ x, z, r: 0.8 });
    }
    // bercak salju lembut (bercak di bawah gunung dihapus)
    const soft = softTexture();
    const snowMat = new THREE.MeshBasicMaterial({ map: soft, color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false });
    [[-90, -135, 19], [-153, -147, 15], [-60, -185, 14]].forEach(p => {
      const m = addGroundDisc(this, p[0], p[1], p[2], snowMat, this.heightAt(p[0], p[1]) + 0.12, 24);
      this.group.add(m);
    });
    this._addSign(b, -118.1, -146.0, 0x5b4a37, '#152d3a', 'PUNCAK SALJU', 'ES • CEMARA • PUNCAK', '#b8f4ff');
    this._addFireflies(cx, cz, H + 4, 20, 9, 0xaeefff);
  };

  // ==========================================================================
  // BIOMA: CITADEL CITY
  // ==========================================================================
  IslandHub.prototype._groundRibbon = function (pts, width, material, yOff) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new V3(p[0], 0, p[1])), false, 'catmullrom', 0.35);
    const len = Math.max(10, curve.getLength());
    const n = Math.max(12, Math.ceil(len / 4));
    const pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = curve.getPointAt(t);
      const tg = curve.getTangentAt(t); tg.y = 0;
      if (tg.lengthSq() < 1e-6) tg.set(0, 0, 1);
      tg.normalize();
      const nx = -tg.z, nz = tg.x;
      const lx = p.x + nx * width * 0.5, lz = p.z + nz * width * 0.5;
      const rx = p.x - nx * width * 0.5, rz = p.z - nz * width * 0.5;
      pos.push(lx, this.heightAt(lx, lz) + (yOff || 0.12), lz);
      pos.push(rx, this.heightAt(rx, rz) + (yOff || 0.12), rz);
    }
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, material);
    this.group.add(mesh);
    return mesh;
  };

  IslandHub.prototype._addFireflies = function (cx, cz, y, r, n, color) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const data = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + Math.random() * 0.4;
      const rr = r * (0.18 + Math.random() * 0.82);
      const yy = y + Math.random() * 5.5;
      pos[i * 3] = cx + Math.cos(a) * rr;
      pos[i * 3 + 1] = yy;
      pos[i * 3 + 2] = cz + Math.sin(a) * rr;
      data.push({ a, rr, y: yy, speed: 0.35 + Math.random() * 0.75, phase: Math.random() * TAU });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: color, size: 0.8, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    this.group.add(points);
    this.animated.pulses.push({ mat, base: 0.55, amp: 0.35, speed: 2.4 });
    this.fireflies = this.fireflies || [];
    this.fireflies.push({ points, data, cx, cz, baseY: y });
  };

  IslandHub.prototype._addSmoke = function (x, y, z, n, color) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const data = [];
    for (let i = 0; i < n; i++) {
      const ox = (Math.random() - 0.5) * 2.6;
      const oz = (Math.random() - 0.5) * 2.6;
      pos[i * 3] = x + ox;
      pos[i * 3 + 1] = y + Math.random() * 18;
      pos[i * 3 + 2] = z + oz;
      data.push({ baseX: x + ox, baseZ: z + oz, speed: 1.6 + Math.random() * 2.2, height: Math.random() * 18, phase: Math.random() * TAU });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: color || 0x958f99, size: 4.5, transparent: true, opacity: 0.35,
      depthWrite: false, sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    this.group.add(points);
    this.smoke = this.smoke || [];
    this.smoke.push({ points, data, top: 22, baseY: y });
  };

  IslandHub.prototype._buildCitadel = function () {
    const b = this.batch, gl = this.glow;
    const cx = 232, cz = 2;
    const H = this.heightAt(cx, cz);
    this.scatterExclusions.push({ x: cx, z: cz, r: 28 });

    // gerbang kota di bibir barat plaza (sejajar sumbu z=2)
    const gateX = 165, gateZ = 2, gateY = this.heightAt(gateX, gateZ);
    [-8.2, 8.2].forEach(s => {
      b.add(G.box, 0x38313c, gateX, gateY + 4.2, gateZ + s, 0, 0, 0, 2.6, 8.4, 2.6);
      b.add(G.cone, 0x23202c, gateX, gateY + 9.6, gateZ + s, 0, Math.PI / 4, 0, 2.2, 3.0, 2.2);
      gl.add(G.box, 0x6dff91, gateX - 1.34, gateY + 5.0, gateZ + s, 0, 0, 0, 0.08, 2.2, 1.1);
    });
    // palang gerbang harus membentang di sumbu z agar menyambung kedua menara
    b.add(G.box, 0x2d2733, gateX, gateY + 8.8, gateZ, 0, 0, 0, 2.8, 1.6, 19.6);
    this.colliders.push({ x: gateX, z: gateZ - 8.2, r: 1.7 });
    this.colliders.push({ x: gateX, z: gateZ + 8.2, r: 1.7 });
    this.scatterExclusions.push({ x: gateX, z: gateZ, r: 12 });

    // kastil gotik (sejajar z=2, di tepi timur plaza)
    b.add(G.box, 0x2b2632, cx, H + 10, cz, 0, 0, 0, 24, 20, 20);
    b.add(G.box, 0x211d28, cx, H + 20.5, cz, 0, 0, 0, 21, 1.5, 17);
    b.add(G.box, 0x24202b, cx + 4, H + 27, cz, 0, 0, 0, 10, 14, 10);
    b.add(G.cone, 0x1a1720, cx + 4, H + 37.5, cz, 0, Math.PI / 4, 0, 7.4, 9, 7.4);
    // benteng atas
    for (let side = 0; side < 4; side++) {
      for (let k = -3; k <= 3; k++) {
        const ox = side < 2 ? k * 2.5 : (side === 2 ? -10.8 : 10.8);
        const oz = side < 2 ? (side === 0 ? -9.2 : 9.2) : k * 2.3;
        b.add(G.box, 0x37313c, cx + ox, H + 21.6, cz + oz, 0, 0, 0, 1.5, 1.6, 1.5);
      }
    }
    // menara sudut
    const towers = [[-13, -11], [13, -11], [-13, 11], [13, 11]];
    towers.forEach((t, k) => {
      const tx = cx + t[0], tz = cz + t[1];
      b.add(G.cyl, 0x2d2833, tx, H + 15, tz, 0, 0, 0, 4.2, 30, 4.2);
      b.add(G.cyl, 0x3a3342, tx, H + 29.4, tz, 0, 0, 0, 4.7, 1.2, 4.7);
      b.add(G.cone, 0x1b1823, tx, H + 35.5, tz, 0, Math.PI / 4, 0, 5.4, 11, 5.4);
      for (let w = 0; w < 3; w++) {
        gl.add(G.box, 0x6cff93, tx - 4.23, H + 12 + w * 6, tz, 0, 0, 0, 0.08, 1.1, 0.72);
      }
      this.colliders.push({ x: tx, z: tz, r: 5.0 });
      this.scatterExclusions.push({ x: tx, z: tz, r: 7.5 });
    });
    // jendela samping kastil berpendar (hanya di antara menara: k = -2, 0, 2)
    for (let row = 0; row < 3; row++) {
      for (let k = -2; k <= 2; k += 2) {
        gl.add(G.box, 0x5cff88, cx + k * 2.8, H + 9 + row * 4.6, cz - 10.06, 0, 0, 0, 1.0, 2.0, 0.1);
        gl.add(G.box, 0x5cff88, cx + k * 2.8, H + 9 + row * 4.6, cz + 10.06, 0, 0, 0, 1.0, 2.0, 0.1);
      }
    }
    // fasad barat (menghadap plaza): pilaster, cornice, jendela, dan lambang (di antara menara barat |oz| < 6.4)
    const wf = cx - 12.15;
    [-4.2, 4.2].forEach(oz => {
      b.add(G.box, 0x38313d, wf, H + 11.2, cz + oz, 0, 0, 0, 0.8, 17.6, 0.9);
      b.add(G.box, 0x463e4c, wf - 0.10, H + 20.1, cz + oz, 0, 0, 0, 1.0, 0.8, 1.2);
    });
    b.add(G.box, 0x3a3342, wf, H + 19.6, cz, 0, 0, 0, 0.6, 0.7, 13.0);
    [-3.3, 3.3].forEach(oz => {
      b.add(G.box, 0x4a4251, wf - 0.08, H + 4.5, cz + oz, 0, 0, 0, 0.45, 7.4, 0.45);
    });
    [-5.3, 5.3].forEach(oz => {
      gl.add(G.box, 0x5cff88, wf - 0.12, H + 12.4, cz + oz, 0, 0, 0, 0.08, 2.2, 0.8);
    });
    gl.add(G.octa, 0x62ff8b, wf - 0.38, H + 16.4, cz, 0, 0, 0, 1.15, 1.8, 0.32);
    // gerbang barat
    b.add(G.box, 0x16131a, cx - 12.1, H + 4.2, cz, 0, 0, 0, 0.5, 7.6, 6.0);
    for (let k = -2; k <= 2; k++) {
      b.add(G.box, 0x5d5764, cx - 12.42, H + 4.2, cz + k * 1.25, 0, 0, 0, 0.26, 6.8, 0.18);
    }
    // tangga masuk (menapak di bibir timur plaza)
    for (let s = 0; s < 5; s++) {
      b.add(G.box, 0x3e3745, cx - 14.4 + s * 0.7, H + 0.24 + s * 0.26, cz, 0, 0, 0, 2.0, 0.28, 10.6);
    }
    this.colliders.push({ x: cx, z: cz, r: 22.5 });

    // panji kastil dipasang menghadap barat tepat di atas gerbang masuk kastil
    const banTex = makeBannerTexture('BENTENG BARA', 'BENTENG ABU', '#191324', '#73ff97');
    this.textures = this.textures || []; this.textures.push(banTex);
    const banMat = new THREE.MeshBasicMaterial({ map: banTex, side: THREE.DoubleSide });
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.8), banMat);
    ban.position.set(cx - 12.55, H + 10.6, cz);
    ban.rotation.y = -Math.PI / 2;
    this.group.add(ban);

    // pabrik: pipa & cerobong (keluar dari belakang kastil ke utara & selatan)
    const pipeMat = 0x4d4652, pipeHi = 0x6b6274;
    const pipes = [
      [[242, 10], [245, 25], [247, 43]],
      [[242, -6], [245, -20], [248, -35]]
    ];
    // pipa, cerobong, dan lava bukan tempat tumbuh pohon/batu
    const blockSeg = (a, c, r) => {
      for (let t = 0; t <= 1; t += 0.2) {
        this.scatterExclusions.push({ x: a[0] + (c[0] - a[0]) * t, z: a[1] + (c[1] - a[1]) * t, r });
      }
    };
    pipes.forEach(pipe => {
      for (let i = 0; i < pipe.length - 1; i++) blockSeg(pipe[i], pipe[i + 1], 5.5);
      const end = pipe[pipe.length - 1];
      this.scatterExclusions.push({ x: end[0], z: end[1], r: 10.5 });
    });
    pipes.forEach((pipe, pi) => {
      for (let i = 0; i < pipe.length - 1; i++) {
        const a = pipe[i], c = pipe[i + 1];
        const ay = this.heightAt(a[0], a[1]) + 1.7, cy = this.heightAt(c[0], c[1]) + 1.7;
        addBeam(b, pipeMat, a[0], ay, a[1], c[0], cy, c[1], 0.9);
        addBeam(b, pipeHi, a[0], ay + 0.5, a[1], c[0], cy + 0.5, c[1], 0.28);
        const midX = (a[0] + c[0]) / 2, midZ = (a[1] + c[1]) / 2;
        b.add(G.cyl, 0x302b34, midX, this.heightAt(midX, midZ) + 0.7, midZ, 0, 0, 0, 0.35, 2.4, 0.35);
        // dua kaki pipa pertama berdiri di dalam menara kastil; collider-nya
        // redundan dan membuat audit tabrakan palsu.
        if (!this._insideCollider(midX, midZ, 0.2)) this.colliders.push({ x: midX, z: midZ, r: 0.4 });
      }
      const end = pipe[pipe.length - 1];
      const ey = this.heightAt(end[0], end[1]);
      b.add(G.cyl, 0x37313c, end[0], ey + 8, end[1], 0, 0, 0, 1.8, 16, 1.8);
      b.add(G.cyl, 0x24212a, end[0], ey + 16.2, end[1], 0, 0, 0, 2.2, 0.8, 2.2);
      addBeam(b, pipeHi, end[0], ey + 7, end[1], end[0], ey + 7, end[1] + 3.2, 0.5);
      gl.add(G.torus, 0x61ff7e, end[0], ey + 7, end[1], 0, 0, 0, 1.2, 1.2, 1.2);
      this.colliders.push({ x: end[0], z: end[1], r: 2.0 });
      this._addSmoke(end[0], ey + 16.8, end[1], 12, pi ? 0x8e7c9a : 0x7d8b84);
    });

    // kolam toxic + lava
    const pools = [[247, 43], [248, -35]];
    pools.forEach((p, k) => {
      const py = this.heightAt(p[0], p[1]) + 0.28;
      const mat = new THREE.MeshBasicMaterial({ color: 0x5cff67, transparent: true, opacity: 0.72 });
      this.group.add(addGroundDisc(this, p[0], p[1], 7.5, mat, py, 24));
      const ring = new THREE.Mesh(new THREE.RingGeometry(6.0, 8.4, 28),
        new THREE.MeshBasicMaterial({ color: 0x9dff77, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(p[0], py + 0.06, p[1]);
      this.group.add(ring);
      this.animated.pulses.push({ mat: ring.material, base: 0.28, amp: 0.34, speed: 1.7 + k });
      this.animated.pulses.push({ mat, base: 0.58, amp: 0.16, speed: 2.1 });
      this.hazards.push({ x: p[0], z: p[1], r: 7.6, type: 'toxic' });
      const light = new THREE.PointLight(0x69ff7e, 0.75, 38, 2);
      light.position.set(p[0], py + 2.2, p[1]);
      this.group.add(light);
      this.lights.push(light);
    });
    const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff6a1f, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
    const lava = this._groundRibbon([[232, 16], [241, 28], [248, 42]], 3.6, lavaMat, 0.16);
    this.animated.pulses.push({ mat: lavaMat, base: 0.7, amp: 0.24, speed: 3.3 });
    const lava2 = this._groundRibbon([[235, -20], [242, -29], [248, -35]], 3.0, lavaMat, 0.16);
    blockSeg([232, 16], [241, 28], 3.0);
    blockSeg([241, 28], [248, 42], 3.0);
    blockSeg([235, -20], [242, -29], 3.0);
    blockSeg([242, -29], [248, -35], 3.0);
    // bara di tepi lava
    for (let k = 0; k < 12; k++) {
      const t = k / 11;
      const x = 233 + t * 15, z = 16 + t * 26;
      if (k % 2 === 0) gl.add(G.dodeca, 0xff7a2a, x + 2.6, this.heightAt(x + 2.6, z) + 0.3, z, 0.2, k, 0.1, 0.5, 0.4, 0.5);
    }
    this.lavaMesh = lava; this.lavaMesh2 = lava2;

    // puing & tiang lampu hijau
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * TAU + 0.5;
      const rr = 34 + (k % 3) * 8;
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      if (this._nearRoad(x, z, 5)) continue;
      if (this._insideCollider(x, z, 0.8)) continue;
      if (this.hazards && this.hazards.some(hz => Math.hypot(x - hz.x, z - hz.z) < hz.r + 0.8)) continue;
      if (this.scatterExclusions && this.scatterExclusions.some(e => Math.hypot(x - e.x, z - e.z) < e.r)) continue;
      b.add(G.box, 0x37303d, x, this.heightAt(x, z) + 2.2, z, 0, a, 0.08, 0.7, 4.4, 0.7);
      gl.add(G.octa, 0x64ff87, x, this.heightAt(x, z) + 4.8, z, 0, a, 0, 0.35, 0.55, 0.35);
      this.colliders.push({ x, z, r: 0.4 });
    }
    this._addSign(b, 167.7, 16.9, 0x332b39, '#1b1422', 'BENTENG BARA', 'LAVA • ABU • BENTENG', '#79ff96');
  };


  // ==========================================================================
  // PROP STATIS: GERBANG BOS, GARASI, RAMBU, SCRAP
  // ==========================================================================
  IslandHub.prototype._buildBossGate = function () {
    const b = this.batch, gl = this.glow;
    const x = 0, z = -102;
    const H = this.heightAt(x, z);
    const open = !!(BK.Save && ((BK.Save.hasBossKey && BK.Save.hasBossKey()) || (BK.Save.trophyCount && BK.Save.trophyCount() >= 4)));

    // lapangan upacara kecil di ujung jalan
    b.add(G.cyl, 0x746c60, x, H + 0.10, z, 0, 0, 0, 17, 0.3, 15);
    for (let s = 0; s < 3; s++) {
      b.add(G.box, 0x8c8577, x, H + 0.18 + s * 0.22, z + 6.4 - s * 1.4, 0, 0, 0, 10 - s, 0.22, 1.4);
    }

    // pilar gerbang + tengkorak batu
    [-5.6, 5.6].forEach(s => {
      b.add(G.box, 0x39313d, x + s, H + 3.7, z, 0, 0, 0, 2.4, 7.4, 2.4);
      b.add(G.box, 0x4b414f, x + s, H + 7.6, z, 0, 0, 0, 3.2, 0.7, 3.2);
      b.add(G.dodeca, open ? 0x796a44 : 0x6b5f6e, x + s, H + 8.35, z, 0.1, s, 0.1, 1.2, 1.5, 1.2);
      gl.add(G.octa, open ? 0xffd23f : 0xff7a3a, x + s, H + 9.3, z, 0, 0, 0, 0.38, 0.7, 0.38);
    });
    b.add(G.box, 0x2c2531, x, H + 8.4, z, 0, 0, 0, 15, 1.7, 2.5);
    b.add(G.box, 0x443a49, x, H + 9.35, z, 0, 0, 0, 17, 0.5, 2.9);
    for (let k = -4; k <= 4; k += 2) {
      b.add(G.cone, 0x1f1a24, x + k, H + 7.2, z - 1.1, 0, 0, 0, 0.55, 2.2, 0.55);
    }

    // segel cincin di tengah gerbang
    const seal = new THREE.Mesh(
      new THREE.TorusGeometry(2.9, 0.42, 8, 28),
      new THREE.MeshBasicMaterial({ color: open ? 0xffd23f : 0x7b5bff, transparent: true, opacity: 0.9 })
    );
    // Segel diletakkan rendah supaya bibir bawah cincin menapak di lantai gerbang.
    seal.position.set(x, H + 3.2, z + 0.45);
    this.group.add(seal);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), new THREE.MeshBasicMaterial({ color: open ? 0xffe27a : 0xb99cff }));
    core.position.copy(seal.position);
    this.group.add(core);
    this.animated.rings.push({ mesh: core, baseY: core.position.y, speed: 1.6, phase: 0.8, spin: 1.4 });
    this.animated.pulses.push({ mat: seal.material, base: 0.55, amp: 0.3, speed: 2.1 });
    gl.add(G.torus, open ? 0xffd23f : 0x8a6bff, x, H + 3.2, z + 0.1, 0, 0, 0, 3.2, 3.2, 3.2);

    // berkas portal kalau gerbang sudah terbuka
    if (open) {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(3.2, 3.2, 11, 18, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
      );
      beam.position.set(x, H + 5.5, z + 0.2);
      this.group.add(beam);
      this.bossBeam = beam;
    }
    // panji status
    const tex = makeBannerTexture(
      'GERBANG UTARA',
      open ? 'RAJA JUARA MENUNGGU' : 'BUTUH 4 PIALA',
      open ? '#19402b' : '#42101c',
      open ? '#ffd23f' : '#ffb27a'
    );
    this.textures = this.textures || []; this.textures.push(tex);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 2.6), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    // Papan status ditempel ke balok atas gerbang, bukan melayang di atasnya.
    banner.position.set(x, H + 10.3, z + 0.8);
    this.group.add(banner);

    // obor di sisi kanan-kiri
    [-9.6, 9.6].forEach((ox, k) => {
      const tx = x + ox, tz = z + 2.4;
      const ty = this.heightAt(tx, tz);
      b.add(G.cyl, 0x44382c, tx, ty + 1.5, tz, 0, 0, 0, 0.28, 3.0, 0.28);
      gl.add(G.cone, 0xff8a2a, tx, ty + 3.4, tz, 0, 0, 0, 0.55, 1.25, 0.55);
      const l = new THREE.PointLight(0xff8a36, 0.55, 24, 2);
      l.position.set(tx, ty + 3.7, tz);
      this.group.add(l); this.lights.push(l);
      this.colliders.push({ x: tx, z: tz, r: 0.4 });
    });

    this.colliders.push({ x: x - 5.6, z, r: 1.8 });
    this.colliders.push({ x: x + 5.6, z, r: 1.8 });
    this.bossDoor = { x, z, r: 9, group: this.group };
  };

  IslandHub.prototype._buildGarage = function () {
    const b = this.batch;
    const x = 31, z = 36;
    const H = this.heightAt(x, z);
    const hut = new THREE.Group();
    hut.name = 'Hub_Garage';

    const baseMat = new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.92, flatShading: true });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8a4a2a, roughness: 0.95, flatShading: true });
    const base = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.2, 4.8), baseMat);
    base.position.y = 1.6; hut.add(base);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.0, 2.6, 4), roofMat);
    roof.position.y = 4.5; roof.rotation.y = Math.PI / 4; hut.add(roof);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), new THREE.MeshBasicMaterial({ color: 0x2e251d, side: THREE.DoubleSide }));
    door.position.set(0, 1.4, 2.42); hut.add(door);
    const banTex = makeBannerTexture('GARASI', 'GANTI PEMBALAP', '#16204a', '#7CFC00');
    this.textures = this.textures || []; this.textures.push(banTex);
    // Dua sisi supaya tulisan GARASI tidak tampil terbalik saat dilihat dari belakang.
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 1.45), new THREE.MeshBasicMaterial({ map: banTex }));
    ban.position.set(0, 6.15, 0.45); hut.add(ban);
    const banBack = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 1.45), new THREE.MeshBasicMaterial({ map: banTex }));
    banBack.position.set(0, 6.15, 0.44); banBack.rotation.y = Math.PI; hut.add(banBack);
    // Papan GARASI berdiri di atas bubungan; tanpa tiang ia tampak melayang.
    const signPostMat = new THREE.MeshStandardMaterial({ color: 0x4b3a2b, roughness: 1 });
    [-2.55, 2.55].forEach(px => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 0.16), signPostMat);
      post.position.set(px, 4.7, 0.35); hut.add(post);
    });
    hut.position.set(x, H, z);
    hut.rotation.y = Math.atan2(-x, -z);
    this.group.add(hut);
    this.garageHut = hut;

    // tong & palang kayu di samping
    for (let k = 0; k < 3; k++) {
      const tx = x + 5.6 + k * 1.4, tz = z + 1.8 - k * 0.7;
      const ty = this.heightAt(tx, tz);
      b.add(G.cyl, k % 2 ? 0x8a5a32 : 0x6f4728, tx, ty + 0.75, tz, 0, 0, 0, 0.55, 1.5, 0.55);
      this.colliders.push({ x: tx, z: tz, r: 0.55 });
    }
    b.add(G.box, 0x6f4728, x - 4.8, H + 1.1, z + 1.2, 0, 0.2, 0, 2.2, 0.8, 1.1);
    this.colliders.push({ x: x - 4.8, z: z + 1.2, r: 1.2 });
    this.colliders.push({ x, z, r: 3.7 });

    // dua kart latihan diparkir (objek terjangkau: terasa lewat tabrakan)
    const kartAt = (kx, kz, col, yaw) => {
      const ky = this.heightAt(kx, kz);
      b.add(G.box, col, kx, ky + 0.55, kz, 0, yaw, 0, 2.4, 0.55, 1.5);
      b.add(G.box, 0x2c2730, kx, ky + 0.95, kz, 0, yaw, 0, 1.1, 0.6, 1.05);
      b.add(G.cyl, 0x18161c, kx + Math.sin(yaw + Math.PI / 2) * 1.0, ky + 0.32, kz + Math.cos(yaw + Math.PI / 2) * 1.0, Math.PI / 2, yaw, 0, 0.42, 0.28, 0.42);
      b.add(G.cyl, 0x18161c, kx - Math.sin(yaw + Math.PI / 2) * 1.0, ky + 0.32, kz - Math.cos(yaw + Math.PI / 2) * 1.0, Math.PI / 2, yaw, 0, 0.42, 0.28, 0.42);
      this.colliders.push({ x: kx, z: kz, r: 1.45 });
    };
    kartAt(x - 7.4, z + 5.4, 0x2f8fe0, 0.6);
    kartAt(x + 7.6, z - 4.8, 0xff9f1c, -0.9);

    this.garage = { x, z, r: 6.5, group: hut };
  };

  // ==========================================================================
  // LAYAR KUIL STATUS PETUALANGAN (SAVE / STATUS SHRINE)
  // ==========================================================================
  IslandHub.prototype._buildShrine = function () {
    const b = this.batch, gl = this.glow;
    const x = -31, z = 36;
    const H = this.heightAt(x, z);
    const yaw = Math.atan2(-x, -z);
    const shrine = new THREE.Group();
    shrine.name = 'Hub_Shrine';

    // Landasan batu bertingkat & 2 pilar kuil kuno
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6f7368, roughness: 0.92, flatShading: true });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x8f9482, roughness: 0.88, flatShading: true });
    const base = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.55, 4.2), stoneMat);
    base.position.y = 0.27; shrine.add(base);
    [-2.5, 2.5].forEach(px => {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(1.15, 4.4, 1.15), stoneMat);
      pil.position.set(px, 2.45, 0); shrine.add(pil);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.45, 1.45), trimMat);
      cap.position.set(px, 4.75, 0); shrine.add(cap);
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.75, 1.45), trimMat);
    lintel.position.set(0, 5.2, 0); shrine.add(lintel);

    // Layar hologram neon hijau/pelangi
    const scrC = document.createElement('canvas'); scrC.width = 256; scrC.height = 192;
    const g = scrC.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 192);
    grd.addColorStop(0, '#072a24'); grd.addColorStop(0.5, '#0f5c48'); grd.addColorStop(1, '#06201c');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 192);
    g.strokeStyle = '#44ffaa'; g.lineWidth = 6; g.strokeRect(6, 6, 244, 180);
    for (let y = 16; y < 176; y += 12) {
      g.fillStyle = 'rgba(100,255,190,0.12)'; g.fillRect(12, y, 232, 4);
    }
    g.fillStyle = '#ffd23f'; g.font = '900 28px "Segoe UI",Arial,sans-serif'; g.textAlign = 'center';
    g.fillText('📊 STATUS PULAU', 128, 58);
    g.fillStyle = '#7dffb3'; g.font = '800 20px "Segoe UI",Arial,sans-serif';
    g.fillText('PIALA • TOKEN • RELIK', 128, 98);
    g.fillStyle = '#ffffff'; g.font = '700 18px "Segoe UI",Arial,sans-serif';
    g.fillText('TOKO & TELEPORT BIOMA', 128, 134);
    const scrTex = new THREE.CanvasTexture(scrC);
    this.textures = this.textures || []; this.textures.push(scrTex);

    const screenMat = new THREE.MeshBasicMaterial({ map: scrTex, side: THREE.DoubleSide, transparent: true, opacity: 0.94 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 2.75), screenMat);
    screen.position.set(0, 2.65, 0);
    shrine.add(screen);
    this.animated.pulses.push({ mat: screenMat, base: 0.86, amp: 0.12, speed: 3.2 });

    // Papan nama di puncak kuil (dua sisi)
    const banTex = makeBannerTexture('KUIL STATUS', 'PROGRES & TOKO PULAU', '#103828', '#7dffb3');
    this.textures.push(banTex);
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 1.45), new THREE.MeshBasicMaterial({ map: banTex }));
    ban.position.set(0, 6.45, 0.12); shrine.add(ban);
    const banBack = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 1.45), new THREE.MeshBasicMaterial({ map: banTex }));
    banBack.position.set(0, 6.45, -0.12); banBack.rotation.y = Math.PI; shrine.add(banBack);

    // Kristal zamrud berputar di atas kuil
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), new THREE.MeshBasicMaterial({ color: 0x44ffaa }));
    gem.position.set(0, 7.75, 0);
    shrine.add(gem);
    this.animated.rings.push({ mesh: gem, baseY: 7.75, speed: 2.0, phase: 0.4, spin: 1.8 });

    shrine.position.set(x, H, z);
    shrine.rotation.y = yaw;
    this.group.add(shrine);

    // 2 obor zamrud di samping kuil
    const c = Math.cos(yaw), s = Math.sin(yaw);
    [-4.2, 4.2].forEach(lx => {
      const wx = x + lx * c, wz = z - lx * s;
      const wy = this.heightAt(wx, wz);
      b.add(G.cyl, 0x4a453b, wx, wy + 1.1, wz, 0, 0, 0, 0.25, 2.2, 0.25);
      gl.add(G.octa, 0x44ffaa, wx, wy + 2.45, wz, 0, 0, 0, 0.42, 0.65, 0.42);
      this.colliders.push({ x: wx, z: wz, r: 0.45 });
    });

    this.colliders.push({ x: x - 2.5 * c, z: z + 2.5 * s, r: 1.1 });
    this.colliders.push({ x: x + 2.5 * c, z: z - 2.5 * s, r: 1.1 });
    this.scatterExclusions.push({ x, z, r: 10.5 });
    this.shrine = { x, z, r: 6.8, group: shrine };
  };

  // ==========================================================================
  // PORTAL BALAPAN
  // ==========================================================================
  IslandHub.prototype._buildPortals = function () {
    const Save = BK.Save || {};
    const tCount = Save.trophyCount ? Save.trophyCount() : 0;
    const defs = [
      { key: 'beach', trackId: 'pantai', name: 'Pantai Bekicot', stage: 1, color: 0x3fb6ff, need: null },
      { key: 'ruins', trackId: 'hutan', name: 'Rimba Jamur', stage: 2, color: 0x44ffaa, need: 1 },
      { key: 'glacier', trackId: 'salju', name: 'Puncak Salju', stage: 3, color: 0x5fd4ff, need: 2 },
      { key: 'citadel', trackId: 'kawah', name: 'Kawah Panas', stage: 4, color: 0xff5a2a, need: 3 }
    ];
    defs.forEach((d, idx) => {
      const bd = BIOME_DEFS.find(v => v.key === d.key);
      if (!bd) return;
      // portal Citadel diletakkan di tengah plaza (x=194, z=2) dengan jarak aman dari gerbang (165) & kastil (232)
      const px = d.key === 'citadel' ? 194 : bd.x;
      const pz = d.key === 'citadel' ? 2 : bd.z;
      const x = px, z = pz;
      const H = this.heightAt(x, z);
      const won = !!(Save.hasTrophy && Save.hasTrophy(d.trackId));
      const hasToken = !!(Save.hasToken && Save.hasToken(d.trackId));
      const hasRelic = !!(Save.hasRelic && Save.hasRelic(d.trackId));
      const best = Save.getBest ? Save.getBest(d.trackId) : null;
      const locked = !!(d.need != null && tCount < d.need && !won);
      const ringC = locked ? 0x9588aa : d.color;

      const g = new THREE.Group();
      g.name = 'Hub_Portal_' + d.trackId;

      // pad pendaratan + cincin dasar
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(4.4, 4.6, 0.22, 24),
        new THREE.MeshStandardMaterial({ color: won ? 0x5a4618 : 0x2c3550, roughness: 0.8, metalness: 0.1, flatShading: true })
      );
      pad.position.y = 0.14; g.add(pad);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(6.0, 0.26, 8, 40),
        new THREE.MeshBasicMaterial({ color: won ? 0xffd23f : ringC, transparent: true, opacity: 0.78 })
      );
      halo.rotation.x = Math.PI / 2; halo.position.y = 0.16; g.add(halo);
      if (!this.beamTex) {
        this.beamTex = makeBeamTexture();
        this.textures = this.textures || [];
        this.textures.push(this.beamTex);
      }
      const beam = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.beamTex, color: ringC, transparent: true, opacity: locked ? 0.18 : 0.34,
        depthWrite: false, blending: THREE.AdditiveBlending
      }));
      beam.scale.set(9.5, 19, 1);
      beam.position.y = 8.1; g.add(beam);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(4.2, 0.4, 9, 30),
        new THREE.MeshBasicMaterial({ color: ringC, transparent: true, opacity: locked ? 0.55 : 0.95 })
      );
      ring.position.y = 3.1; ring.rotation.x = Math.PI / 2; g.add(ring);
      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(2.6, 0.12, 6, 26),
        new THREE.MeshBasicMaterial({ color: won ? 0xffd23f : (locked ? 0xc9bfdc : ringC), transparent: true, opacity: locked ? 0.7 : 0.55 })
      );
      ring2.position.y = 3.1; ring2.rotation.x = Math.PI / 2; g.add(ring2);
      for (let k = 0; k < 4; k++) {
        const a = k / 4 * TAU;
        const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: won ? 0xffd23f : ringC }));
        o.position.set(Math.cos(a) * 4.2, 3.1, Math.sin(a) * 4.2);
        o.userData.a = a;
        g.add(o);
      }
      let trophy = null, tokenMesh = null, relicMesh = null;
      if (won) {
        trophy = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
        trophy.position.set(0, 7.8, 0); g.add(trophy);
      }
      if (hasToken) {
        tokenMesh = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.18, 8, 18), new THREE.MeshBasicMaterial({ color: 0x55ff88 }));
        tokenMesh.position.set(-1.9, 7.6, 0); g.add(tokenMesh);
      }
      if (hasRelic) {
        relicMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.68, 0), new THREE.MeshBasicMaterial({ color: 0x38d0ff }));
        relicMesh.scale.set(0.75, 1.35, 0.75);
        relicMesh.position.set(1.9, 7.6, 0); g.add(relicMesh);
      }

      // papan nama portal: di samping cincin portal dengan jarak aman dari menara kastil & badan jalan
      const signX = d.key === 'citadel' ? -11.0 : 0;
      const signZ = d.key === 'citadel' ? -3.0 : -12.0;
      const badgeStr = (won ? '🏆' : '⚪') + (hasToken ? '🔤' : '⚪') + (hasRelic ? '⏱️' : '⚪');
      const sub = locked
        ? 'BUTUH ' + d.need + ' PIALA (' + tCount + '/' + d.need + ')'
        : (won ? (hasToken && hasRelic ? 'TUNTAS ' + badgeStr : 'PILIH MODE ' + badgeStr) : 'BAB ' + d.stage + ' • REBUT PIALA');
      const tex = makeBannerTexture(d.name, sub, '#16204a', locked ? '#9b93a4' : '#ffd23f');
      this.textures = this.textures || []; this.textures.push(tex);
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.8), new THREE.MeshBasicMaterial({ map: tex }));
      ban.position.set(signX, 5.9, signZ); g.add(ban);
      const banBack = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.8), new THREE.MeshBasicMaterial({ map: tex }));
      banBack.position.set(signX, 5.9, signZ - 0.02); banBack.rotation.y = Math.PI; g.add(banBack);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.2, 0.35), new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 1 }));
      post.position.set(signX, 2.6, signZ - 0.12); g.add(post);

      g.position.set(x, H + 0.02, z);
      g.rotation.y = Math.atan2(-x, -z);
      this.group.add(g);

      const cr = Math.cos(g.rotation.y), sr = Math.sin(g.rotation.y);
      const postWX = x + (signX * cr + (signZ - 0.12) * sr);
      const postWZ = z + (-signX * sr + (signZ - 0.12) * cr);
      this.colliders.push({ x: postWX, z: postWZ, r: 0.35 });

      this.portals.push({
        x, z, r: 7.4, trackId: d.trackId, name: d.name, stage: d.stage, biome: d.key,
        ring, ring2, trophy, tokenMesh, relicMesh, disc: pad, pad, beam, ph: idx * 1.7,
        locked, lockMsg: locked ? 'Butuh ' + d.need + ' Piala! (' + tCount + '/' + d.need + ')' : '',
        won, hasToken, hasRelic, best, group: g, color: d.color
      });
    });
  };

  // ==========================================================================
  // PAD BOOST, RAMP LOMPAT, WARNA GERBANG WARP
  // ==========================================================================
  // turbo pad pulau = komponen BK.Props.boostPad (desain sama dgn trek), mengikuti lengkung jalan
  IslandHub.prototype._buildPads = function () {
    const picks = [
      ['beach', 0.24], ['beach', 0.68],
      ['ruins', 0.28], ['ruins', 0.72],
      ['glacier', 0.32], ['glacier', 0.70],
      ['citadel', 0.52],
      ['ring', 0.18], ['ring', 0.62]
    ];
    picks.forEach(([key, t], idx) => {
      const road = this.roadPaths.find(r => r.key === key);
      if (!road || !road.points.length) return;
      const i = Math.max(0, Math.min(road.points.length - 1, Math.floor(t * (road.points.length - 1))));
      const p = road.points[i];
      const at = BK.Props.pathSampler(road.points, i, false, (x, z) => this.heightAt(x, z) + 0.08);
      const pad = BK.Props.boostPad(at, 5.6, 7.6);
      this.group.add(pad.group);
      this.pads.push({ x: p.x, z: p.z, pos: new THREE.Vector3(p.x, this.heightAt(p.x, p.z) + 0.13, p.z), mesh: pad.mesh, frame: pad.frame,
        cx: pad.cx, cz: pad.cz, tx: pad.tx, tz: pad.tz, w: pad.w, l: pad.l, pulse: idx * 0.9 }); // hitbox persegi = tapak pad
    });
  };

  IslandHub.prototype._buildRamps = function () {
    const road = this.roadPaths.find(r => r.key === 'ring');
    if (!road || road.points.length < 16) return;

    function wedgeGeo(w, l, h) {
      const x = w * 0.5, z = l * 0.5;
      const pos = [
        -x, 0, -z,   x, 0, -z,   x, 0, z,   -x, 0, z,    // dasar
        -x, h, z,    x, h, z                              // bibir belakang tinggi
      ];
      const idx = [
        0, 4, 1, 1, 4, 5,       // bidang miring (menanjak ke +Z)
        3, 2, 4, 2, 5, 4,       // dinding belakang
        0, 3, 4,                // sisi kiri
        1, 5, 2,                // sisi kanan
        0, 1, 3, 1, 2, 3        // alas
      ];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    }

    const wg = wedgeGeo(8.0, 10.0, 2.8);
    const H = 2.8, L = 10.0, W = 8.0;
    [0.12, 0.47, 0.83].forEach((t, idx) => {
      const p = road.points[Math.max(0, Math.min(road.points.length - 1, Math.floor(t * (road.points.length - 1))))];
      const yaw = Math.atan2(p.tx, p.tz);
      const gy = this.heightAt(p.x, p.z);
      const m = new THREE.Matrix4().compose(
        new V3(p.x, gy, p.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
        new V3(1, 1, 1)
      );
      this.batch.addM(wg, idx === 1 ? 0x7d5c3c : 0x8b6a45, m);

      // rel samping sebagai penanda ramp
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const toW = (lx, lz) => [p.x + lx * c + lz * s, p.z - lx * s + lz * c];
      [-1, 1].forEach(sd => {
        const a = toW(sd * W * 0.42, -L * 0.5);
        const bb = toW(sd * W * 0.42, L * 0.5);
        addBeam(this.batch, 0xff9f1c, a[0], gy + 0.15, a[1], bb[0], gy + H + 0.15, bb[1], 0.22);
      });
      for (let k = 0; k < 3; k++) {
        const lt = (k + 0.5) / 3;
        const lz = -L * 0.5 + lt * L;
        const wp = toW(0, lz);
        this.batch.add(G.box, 0xffd23f, wp[0], gy + lt * H + 0.10, wp[1],
          -Math.atan2(H, L), yaw, 0, W * 0.70, 0.10, 0.62);
      }
      this.hubRamps.push({ x: p.x, z: p.z, r: 5.6, height: H, yaw, w: W, l: L }); // hitbox = tapak ramp berorientasi
    });
    wg.dispose();
  };

  IslandHub.prototype._buildWarpRings = function () {
    const picks = [
      ['ring', 0.07, 0x55c9ff], ['ring', 0.58, 0xa774ff],
      ['beach', 0.44, 0x55c9ff], ['beach', 0.82, 0xa774ff],
      ['ruins', 0.36, 0x55c9ff], ['ruins', 0.76, 0xa774ff],
      ['glacier', 0.46, 0x55c9ff], ['glacier', 0.86, 0xa774ff],
      ['citadel', 0.32, 0xa774ff], ['citadel', 0.78, 0x55c9ff],
      ['outer', 0.18, 0x55c9ff], ['outer', 0.43, 0xa774ff],
      ['outer', 0.69, 0x55c9ff], ['outer', 0.91, 0xa774ff]
    ];
    const soft = softTexture();
    picks.forEach(([key, t, color], idx) => {
      const road = this.roadPaths.find(r => r.key === key);
      if (!road || !road.points.length) return;
      const p = road.points[Math.max(0, Math.min(road.points.length - 1, Math.floor(t * (road.points.length - 1))))];
      const gy = this.heightAt(p.x, p.z);
      const group = new THREE.Group();
      // Pusat hoop tepat 3.5 m di atas tanah supaya bibir bawah cincin
      // menyentuh permukaan jalan; tidak ada lagi hoop melayang.
      group.position.set(p.x, gy + 3.5, p.z);
      group.rotation.y = Math.atan2(p.tx, p.tz);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.5, 0.20, 8, 30),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide })
      );
      group.add(ring);
      // Cincin luar dibuat datar di tanah sebagai "pad" pendaratan hoop,
      // bukan hoop vertikal kedua yang menggantung.
      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(4.35, 0.08, 6, 34),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide })
      );
      ring2.rotation.x = Math.PI / 2;
      ring2.position.y = -3.4;
      group.add(ring2);
      const orbit = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const a = k / 3 * TAU;
        const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        o.position.set(Math.cos(a) * 3.5, Math.sin(a) * 3.5, 0.12);
        orbit.add(o);
      }
      group.add(orbit);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: soft, color, transparent: true, opacity: 0.32, depthWrite: false
      }));
      glow.scale.set(9, 9, 1);
      group.add(glow);
      this.group.add(group);
      this.warpRings.push({ x: p.x, z: p.z, r: 4.0, hole: 3.3, yaw: Math.atan2(p.tx, p.tz), group, ring, ring2, orbit, glow, phase: idx * 0.7, baseY: gy + 3.5, color }); // hole = jari-jari dalam cincin
    });
  };

  // ==========================================================================
  // KRATE ? / BOM DI TEPI JALAN
  // ==========================================================================
  IslandHub.prototype._buildCrates = function () {
    const rnd = mulberry32(9163);
    const spots = [];
    const roads = this.roadPaths.filter(r => r.kind !== 'boss');
    roads.forEach(road => {
      const step = road.key === 'outer' ? 17 : 13;
      for (let i = 6; i < road.points.length - 4; i += step) {
        const p = road.points[i];
        const side = ((i / step) | 0) % 2 === 0 ? 1 : -1;
        const off = road.width * 0.5 + 2.5;
        const x = p.x - p.tz * off * side;
        const z = p.z + p.tx * off * side;
        const h = this.heightAt(x, z);
        if (h < 1.0 || this._slope(x, z) > 0.9) continue;
        if (this.plazas && this.plazas.some(pl => Math.hypot(x - pl.x, z - pl.z) < pl.r + 1.5)) continue;
        // jangan taruh krate di dalam piramida, gunung, kolam, lava, atau
        // lapangan upacara; dulu beberapa krate terkubur di landmark.
        if (this._insideCollider(x, z, 1.0)) continue;
        if (this.bossDoor && Math.hypot(x - this.bossDoor.x, z - this.bossDoor.z) < 19) continue;
        if (this.garage && Math.hypot(x - this.garage.x, z - this.garage.z) < 11.5) continue;
        if (this.shallows && this.shallows.some(s => Math.hypot(x - s.x, z - s.z) < s.r + 2.2)) continue;
        if (this.hazards && this.hazards.some(hz => Math.hypot(x - hz.x, z - hz.z) < hz.r + 2.2)) continue;
        if (this.scatterExclusions && this.scatterExclusions.some(e => Math.hypot(x - e.x, z - e.z) < e.r)) continue;
        const type = rnd() < 0.28 ? 'bomb' : 'q';
        spots.push({ x, z, y: h + 0.78, type, yaw: rnd() * TAU, tilt: (rnd() - 0.5) * 0.08, scale: 1 });
        if (rnd() < 0.18) {
          spots.push({ x: x + 0.15, z: z + 0.1, y: h + 2.12, type, yaw: rnd() * TAU, tilt: (rnd() - 0.5) * 0.12, scale: 0.92 });
        }
      }
    });

    const geo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const matQ = new THREE.MeshStandardMaterial({ map: makeCrateTexture('q'), roughness: 0.86, metalness: 0.02 });
    const matT = new THREE.MeshStandardMaterial({ map: makeCrateTexture('bomb'), roughness: 0.82, metalness: 0.03 });
    const groups = { q: spots.filter(s => s.type === 'q'), bomb: spots.filter(s => s.type === 'bomb') };
    const meshes = {
      q: new THREE.InstancedMesh(geo, matQ, Math.max(1, groups.q.length)),
      bomb: new THREE.InstancedMesh(geo, matT, Math.max(1, groups.bomb.length))
    };
    ['q', 'bomb'].forEach(type => {
      const mesh = meshes[type];
      mesh.name = 'Hub_Crates_' + type;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      const list = groups[type];
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const sc = new V3();
      list.forEach((s, i) => {
        e.set(s.tilt, s.yaw, 0, 'YXZ');
        q.setFromEuler(e);
        sc.set(s.scale, s.scale, s.scale);
        m.compose(new V3(s.x, s.y, s.z), q, sc);
        mesh.setMatrixAt(i, m);
        this.crates.push({ x: s.x, y: s.y, z: s.z, type, mesh, index: i, alive: true, yaw: s.yaw, tilt: s.tilt, scale: s.scale });
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
    });
    this.crateGeo = geo;
    this.crateMats = [matQ, matT];
  };

  IslandHub.prototype._updateCrates = function (dt) {
    const kart = (BK.playerKart && BK.playerKart.pos) ? BK.playerKart : null;
    this._crateMsgCd = Math.max(0, (this._crateMsgCd || 0) - dt);
    const px = kart ? kart.pos.x : 1e9, pz = kart ? kart.pos.z : 1e9;
    for (let i = 0; i < this.crates.length; i++) {
      const c = this.crates[i];
      if (!c.alive) {
        c.respawn = (c.respawn == null ? 8.0 : c.respawn) - dt;
        if (c.respawn <= 0) {
          c.alive = true;
          c.respawn = 0;
          const m = new THREE.Matrix4();
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(c.tilt, c.yaw, 0, 'YXZ'));
          const sc = new V3(c.scale, c.scale, c.scale);
          m.compose(new V3(c.x, c.y, c.z), q, sc);
          c.mesh.setMatrixAt(c.index, m);
          c.mesh.instanceMatrix.needsUpdate = true;
        }
        continue;
      }
      if (!kart) continue;
      const dx = px - c.x, dz = pz - c.z;
      if (dx * dx + dz * dz > 36) continue;
      if (!BK.kartTouch(kart, c.x, c.z, 0.95 * (c.scale || 1))) continue; // badan kart vs peti 1.5 m
      c.alive = false;
      c.respawn = 8.0;
      const z = new V3(0, 0, 0);
      c.mesh.setMatrixAt(c.index, new THREE.Matrix4().compose(z, new THREE.Quaternion(), z));
      c.mesh.instanceMatrix.needsUpdate = true;
      if (c.type === 'bomb') {
        if (BK.spawnBurst) BK.spawnBurst({ x: c.x, y: c.y, z: c.z }, 0xff6a2a, 18, 0.5);
        if (BK.spawnSmoke) BK.spawnSmoke(c.x, c.z, 0x4b3f3a, 0, 0, 0.9, 3.2, c.y);
        if (BK.Audio && BK.Audio.hit) BK.Audio.hit();
        if (kart) {
          kart.speed *= 0.85;
          kart._bumpVx = (kart._bumpVx || 0) + Math.sin(kart.heading + Math.PI) * 5;
          kart._bumpVz = (kart._bumpVz || 0) + Math.cos(kart.heading + Math.PI) * 5;
        }
        if (this._crateMsgCd <= 0 && BK.flashMsg) {
          this._crateMsgCd = 3.5;
          BK.flashMsg('💥 KRATE BOM MELEDAK!');
        }
      } else {
        if (BK.spawnBurst) BK.spawnBurst({ x: c.x, y: c.y, z: c.z }, 0xffd23f, 10, 0.35);
        if (BK.Audio && BK.Audio.pickup) BK.Audio.pickup();
        if (kart) {
          kart.item = null;
          kart.roulette = 0.8;
          if (kart.isPlayer && BK.refreshItemHUD) BK.refreshItemHUD();
        }
      }
    }
  };

  // ==========================================================================
  // SCRUB / POHON / BATU / RUMPUT (instanced)
  // ==========================================================================
  IslandHub.prototype._insideCollider = function (x, z, pad) {
    const p = pad || 0;
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (Math.hypot(x - c.x, z - c.z) < c.r + p) return true;
    }
    return false;
  };

  IslandHub.prototype._canScatter = function (x, z, clearance) {
    const h = this.heightAt(x, z);
    if (h < 1.15 || h > 30) return 0;
    if (this._slope(x, z) > 0.82) return 0;
    if (this._nearRoad(x, z, clearance == null ? 4.0 : clearance)) return 0;
    if (this.plazas) {
      for (let i = 0; i < this.plazas.length; i++) {
        const p = this.plazas[i];
        if (Math.hypot(x - p.x, z - p.z) < p.r + 3) return 0;
      }
    }
    // Jangan tanam pohon/batu di dalam kolam, lava, area pabrik, atau
    // lapangan upacara. Semua ini landmark statis yang tidak boleh tertembus.
    if (this.shallows) {
      for (let i = 0; i < this.shallows.length; i++) {
        const s = this.shallows[i];
        if (Math.hypot(x - s.x, z - s.z) < s.r + 2.2) return 0;
      }
    }
    if (this.hazards) {
      for (let i = 0; i < this.hazards.length; i++) {
        const hz = this.hazards[i];
        if (Math.hypot(x - hz.x, z - hz.z) < hz.r + 2.2) return 0;
      }
    }
    if (this.scatterExclusions) {
      for (let i = 0; i < this.scatterExclusions.length; i++) {
        const e = this.scatterExclusions[i];
        if (Math.hypot(x - e.x, z - e.z) < e.r) return 0;
      }
    }
    if (this.bossDoor && Math.hypot(x - this.bossDoor.x, z - this.bossDoor.z) < 19) return 0;
    if (this.garage && Math.hypot(x - this.garage.x, z - this.garage.z) < 11.5) return 0;
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (Math.hypot(x - c.x, z - c.z) < c.r + 2.4) return 0;
    }
    return h;
  };

  // vegetasi & batu pulau = KOMPONEN TERPADU BK.Comp (desain sama persis dgn trek). Item dikumpulkan lalu
  // di-instance sekali di akhir _scatterScenery. Ukuran dikonversi dari dimensi lama agar skala tetap.
  IslandHub.prototype._compAdd = function (name, it) { (this._comp[name] = this._comp[name] || []).push(it); };
  IslandHub.prototype._addPalm = function (b, x, z, s, yaw) {
    const h = this.heightAt(x, z);
    this._compAdd('palm', { x, y: h - 0.1, z, s: s * 0.83, ry: yaw - Math.PI / 2, v: 2 }); // batang condong ke arah yaw
    this.colliders.push({ x, z, r: 0.65 * s });
  };

  IslandHub.prototype._addJungleTree = function (b, x, z, s, yaw) {
    const h = this.heightAt(x, z);
    this._compAdd('forestTree', { x, y: h - 0.2, z, s, ry: yaw });
    this.colliders.push({ x, z, r: 0.8 * s });
  };

  IslandHub.prototype._addPine = function (b, x, z, s, yaw) {
    const h = this.heightAt(x, z);
    this._compAdd('pine', { x, y: h, z, s: s * 1.4, ry: yaw, v: 'snow' });
    this.colliders.push({ x, z, r: 0.72 * s });
  };

  IslandHub.prototype._addDeadTree = function (b, x, z, s, yaw) {
    const h = this.heightAt(x, z);
    this._compAdd('deadTree', { x, y: h, z, s, ry: yaw });
    this.colliders.push({ x, z, r: 0.58 * s });
  };

  IslandHub.prototype._addRock = function (b, x, z, s, yaw) {
    const h = this.heightAt(x, z), k = 1 / 1.2; // komponen 'rock' ber-radius 1.2
    this._compAdd('rock', { x, y: h + 0.55 * s, z, s: 1.25 * s * k, sy: 0.9 * s * k, sz: s * k, rx: 0.2, ry: yaw, rz: 0.15,
      tint: s > 1.5 ? 0x77756c : 0x686b61 });
    if (s > 1.1) this.colliders.push({ x, z, r: 0.95 * s });
  };

  IslandHub.prototype._scatterScenery = function () {
    const rnd = mulberry32(55021);
    const b = this.batch;
    this._comp = {};

    const placeZone = (key, tries, kind, minR, maxR) => {
      const bd = BIOME_DEFS.find(v => v.key === key);
      if (!bd) return;
      for (let k = 0; k < tries; k++) {
        const a = rnd() * TAU;
        const rr = minR + rnd() * (maxR - minR);
        const x = bd.x + Math.cos(a) * rr;
        const z = bd.z + Math.sin(a) * rr;
        if (!this._canScatter(x, z, 4.5)) continue;
        if (key === 'beach' && Math.hypot(x + 185, z - 224) < 17) continue;
        if (key === 'glacier' && Math.hypot(x + 174, z + 220) < 48) continue;
        const t = rnd();
        if (kind === 'beach') {
          this._addPalm(b, x, z, 0.85 + rnd() * 0.55, rnd() * TAU);
        } else if (kind === 'jungle') {
          if (t < 0.78) this._addJungleTree(b, x, z, 0.8 + rnd() * 0.5, rnd() * TAU);
          else this._addRock(b, x, z, 1.0 + rnd() * 1.1, rnd() * TAU);
        } else if (kind === 'glacier') {
          if (t < 0.8) this._addPine(b, x, z, 0.8 + rnd() * 0.55, rnd() * TAU);
          else this._addRock(b, x, z, 0.9 + rnd() * 1.0, rnd() * TAU);
        } else {
          if (t < 0.62) this._addDeadTree(b, x, z, 0.85 + rnd() * 0.45, rnd() * TAU);
          else this._addRock(b, x, z, 1.0 + rnd() * 1.2, rnd() * TAU);
        }
      }
    };

    placeZone('beach', 34, 'beach', 38, 92);
    placeZone('ruins', 38, 'jungle', 38, 98);
    placeZone('glacier', 32, 'glacier', 42, 100);
    placeZone('citadel', 24, 'ash', 42, 100);

    // sabuk hutan umum: pilih vegetasi menurut bioma terdekat
    for (let k = 0; k < 74; k++) {
      const a = rnd() * TAU, rr = 108 + rnd() * 138;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (!this._canScatter(x, z, 5.0)) continue;
      let best = 'island', bestD = 1e9;
      BIOME_DEFS.forEach(bd => {
        if (bd.key === 'center') return;
        const d = Math.hypot(x - bd.x, z - bd.z);
        if (d < bestD) { bestD = d; best = bd.key; }
      });
      const t = rnd();
      if (best === 'beach' && t < 0.8) this._addPalm(b, x, z, 0.8 + rnd() * 0.5, rnd() * TAU);
      else if (best === 'ruins') this._addJungleTree(b, x, z, 0.8 + rnd() * 0.55, rnd() * TAU);
      else if (best === 'glacier' && t < 0.8) this._addPine(b, x, z, 0.8 + rnd() * 0.5, rnd() * TAU);
      else if (best === 'citadel' && t < 0.65) this._addDeadTree(b, x, z, 0.85 + rnd() * 0.45, rnd() * TAU);
      else if (t < 0.34) this._addPalm(b, x, z, 0.75 + rnd() * 0.5, rnd() * TAU);
      else if (t < 0.70) this._addJungleTree(b, x, z, 0.75 + rnd() * 0.5, rnd() * TAU);
      else this._addRock(b, x, z, 0.9 + rnd() * 1.0, rnd() * TAU);
    }

    // batu besar tersebar
    for (let k = 0; k < 34; k++) {
      const a = rnd() * TAU, rr = 70 + rnd() * 200;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (!this._canScatter(x, z, 4.0)) continue;
      this._addRock(b, x, z, 1.0 + rnd() * 1.8, rnd() * TAU);
    }

    // rumput instanced: satu draw call, aman dari jalan/plaza
    const spots = [];
    for (let k = 0; k < 720 && spots.length < 480; k++) {
      const a = rnd() * TAU, rr = 24 + rnd() * 250;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const h = this.heightAt(x, z);
      if (h < 1.2 || h > 24) continue;
      if (this._slope(x, z) > 0.65) continue;
      if (this._nearRoad(x, z, 1.6)) continue;
      if (this.plazas && this.plazas.some(pl => Math.hypot(x - pl.x, z - pl.z) < pl.r + 1)) continue;
      spots.push({ x, z, h, s: 0.7 + rnd() * 0.9, r: rnd() * TAU });
    }
    if (spots.length) {
      const geo = new THREE.ConeGeometry(0.24, 0.9, 5);
      const mat = new THREE.MeshLambertMaterial({ color: 0x4d8f3d });
      const inst = new THREE.InstancedMesh(geo, mat, spots.length);
      inst.name = 'Hub_Grass';
      inst.frustumCulled = false;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new V3();
      const col = new THREE.Color();
      spots.forEach((s, i) => {
        e.set(0, s.r, 0); q.setFromEuler(e); sc.set(s.s, s.s, s.s);
        m.compose(new V3(s.x, s.h + 0.28 * s.s, s.z), q, sc);
        inst.setMatrixAt(i, m);
        col.setHSL(0.28 + (rnd() - 0.5) * 0.04, 0.38, 0.33 + rnd() * 0.12);
        if (inst.setColorAt) inst.setColorAt(i, col);
      });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      this.group.add(inst);
      this.grassMesh = inst;
    }

    // bunga kecil berwarna, pengisi warna padang
    for (let k = 0; k < 90; k++) {
      const a = rnd() * TAU, rr = 90 + rnd() * 145;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (!this._canScatter(x, z, 3.0)) continue;
      const h = this.heightAt(x, z);
      const cols = [0xff6b9d, 0xffd23f, 0x9a7bff, 0xffffff, 0x6de3ff];
      b.add(G.sphereLow, cols[k % cols.length], x, h + 0.26, z, 0, rnd() * TAU, 0, 0.18, 0.18, 0.18);
      b.add(G.cyl, 0x3d7a35, x, h + 0.12, z, 0, 0, 0, 0.035, 0.3, 0.035);
    }
    // instance semua komponen sekaligus (beberapa draw call per jenis)
    Object.keys(this._comp).forEach(name => BK.Comp.scatter(this.group, name, this._comp[name]));
    this._comp = null;
  };

  // ==========================================================================
  // LABEL BIOMA MELAYANG (CanvasTexture Sprite)
  // ==========================================================================
  IslandHub.prototype._buildLabels = function () {
    BIOME_DEFS.forEach((bd, idx) => {
      const tex = makeLabelTexture(bd.name, bd.labelColor);
      tex.needsUpdate = true;
      this.textures = this.textures || [];
      this.textures.push(tex);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      const lx = bd.key === 'citadel' ? 232 : bd.x;
      const lz = bd.key === 'citadel' ? 2 : bd.z;
      const y = this.heightAt(lx, lz) + (bd.key === 'citadel' ? 44 : bd.key === 'center' ? 23 : 19);
      sprite.position.set(lx, y, lz);
      sprite.scale.set(20, 5, 1);
      sprite.renderOrder = 3;
      this.group.add(sprite);
      this.labels.push({ sprite, baseY: y, phase: idx * 0.8, biome: bd.key, name: bd.name, text: bd.name, texture: tex });
    });
  };

  // ==========================================================================
  // NPC, BURUNG, PANAH KOMPAS
  // ==========================================================================
  IslandHub.prototype._buildNPCs = function () {
    // penghuni dan posisinya ditentukan naskah (js/story.js): panglima yang kalah pindah ke portalnya
    const defs = (BK.Story && BK.Story.hubNpcs) ? BK.Story.hubNpcs() : [];
    defs.forEach((d, idx) => {
      const mesh = BK.buildCastRig(d.who);
      mesh.position.set(d.x, this.heightAt(d.x, d.z), d.z);
      mesh.rotation.order = 'YXZ';
      mesh.rotation.y = d.face || 0;
      this.group.add(mesh);
      this.colliders.push({ x: d.x, z: d.z, r: 1.1 });
      this.npcs.push({
        mesh, who: d.who, x: d.x, z: d.z, face: d.face || 0, li: idx % 3, cd: 0,
        phase: idx * 1.3, base: mesh.scale.x, blink: 1 + Math.random() * 3
      });
    });
  };

  IslandHub.prototype._buildBirds = function () {
    const bodyGeo = new THREE.ConeGeometry(0.28, 1.6, 4);
    bodyGeo.rotateX(Math.PI / 2);
    bodyGeo.scale(1.5, 1, 0.5);
    const wingGeo = new THREE.BoxGeometry(2.2, 0.08, 0.5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let k = 0; k < 6; k++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, mat); g.add(body);
      const w1 = new THREE.Mesh(wingGeo, mat); w1.position.set(-1.0, 0.08, -0.1); w1.rotation.z = 0.18; g.add(w1);
      const w2 = new THREE.Mesh(wingGeo, mat); w2.position.set(1.0, 0.08, -0.1); w2.rotation.z = -0.18; g.add(w2);
      this.group.add(g);
      this.animated.gulls.push({
        mesh: g, a: k * 1.07, r: 92 + (k % 3) * 40,
        h: 34 + (k % 4) * 7, sp: 0.16 + (k % 3) * 0.035,
        cx: -10 + (k % 2) * 28, cz: 12 - k * 6
      });
    }
  };

  IslandHub.prototype._buildGuideArrow = function () {
    const guideArrow = new THREE.Group();
    guideArrow.name = 'Hub_GuideArrow';
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 8), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    cone.rotation.x = Math.PI / 2; cone.position.z = 0.55; guideArrow.add(cone);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 8), new THREE.MeshBasicMaterial({ color: 0xff9f1c }));
    tail.rotation.x = Math.PI / 2; tail.position.z = -0.2; guideArrow.add(tail);
    guideArrow.visible = false;
    this.group.add(guideArrow);
    this.guideArrow = guideArrow;
  };

  // ==========================================================================
  // KOIN EMAS BERPUTAR DI JALAN RAYA & TANJAKAN LOMPAT (InstancedMesh)
  // ==========================================================================
  IslandHub.prototype._buildCoins = function () {
    this.coins = [];
    const spots = [];
    // Koin di sepanjang jalan spoke & ring
    const roadPicks = [
      ['beach', [0.16, 0.20, 0.24, 0.56, 0.60, 0.64]],
      ['ruins', [0.20, 0.24, 0.28, 0.62, 0.66, 0.70]],
      ['glacier', [0.22, 0.26, 0.30, 0.60, 0.64, 0.68]],
      ['citadel', [0.20, 0.24, 0.28, 0.58, 0.62, 0.66]],
      ['outer', [0.10, 0.12, 0.32, 0.34, 0.56, 0.58, 0.80, 0.82]]
    ];
    roadPicks.forEach(([key, ts]) => {
      const road = this.roadPaths.find(r => r.key === key);
      if (!road || !road.points.length) return;
      ts.forEach((t, k) => {
        const idx = Math.max(0, Math.min(road.points.length - 1, Math.floor(t * (road.points.length - 1))));
        const p = road.points[idx];
        const h = this.heightAt(p.x, p.z);
        spots.push({ x: p.x, y: h + 1.05, z: p.z, phase: k * 0.45 });
      });
    });
    // Deretan koin melengkung di atas 3 ramp lompat jalan lingkar (bisa disapu saat Air Trick!)
    const ringRoad = this.roadPaths.find(r => r.key === 'ring');
    if (ringRoad && ringRoad.points.length > 16) {
      [0.12, 0.47, 0.83].forEach((t, ri) => {
        const idx = Math.max(0, Math.min(ringRoad.points.length - 1, Math.floor(t * (ringRoad.points.length - 1))));
        const p = ringRoad.points[idx];
        const gy = this.heightAt(p.x, p.z);
        for (let k = -1; k <= 2; k++) {
          const d = k * 3.2;
          const cx = p.x + p.tx * d, cz = p.z + p.tz * d;
          const arcY = gy + 1.8 + (k >= 0 ? Math.sin((k + 1) / 3 * Math.PI) * 2.2 : 0.4);
          spots.push({ x: cx, y: arcY, z: cz, phase: ri + k * 0.3 });
        }
      });
    }
    const geo = new THREE.CylinderGeometry(0.62, 0.62, 0.18, 14);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    const inst = new THREE.InstancedMesh(geo, mat, Math.max(1, spots.length));
    inst.name = 'Hub_Coins';
    inst.frustumCulled = false;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new V3(1, 1, 1);
    spots.forEach((s, i) => {
      e.set(0, s.phase, 0); q.setFromEuler(e);
      m.compose(new V3(s.x, s.y, s.z), q, sc);
      inst.setMatrixAt(i, m);
      this.coins.push({ x: s.x, y: s.y, z: s.z, phase: s.phase, index: i, alive: true, respawn: 0 });
    });
    inst.count = spots.length;
    inst.instanceMatrix.needsUpdate = true;
    this.group.add(inst);
    this.coinMesh = inst;
  };

  IslandHub.prototype._updateCoins = function (dt, t) {
    if (!this.coinMesh || !this.coins || !this.coins.length) return;
    const kart = (BK.playerKart && BK.playerKart.pos) ? BK.playerKart : null;
    // Tinggi kart yang sebenarnya ada di worldY (ikut lompatan); pos.y di hub
    // tidak diperbarui fisika dan tertinggal di tinggi spawn, sehingga koin di
    // jalan yang lebih rendah dari plateau tengah tidak pernah terambil.
    const ky = kart ? (kart.worldY != null ? kart.worldY : (kart.gy != null ? kart.gy : (kart.pos.y || 0))) : 1e9;
    const px = kart ? kart.pos.x : 1e9, py = ky, pz = kart ? kart.pos.z : 1e9;
    // Uji sapuan: kart bisa bergerak beberapa meter di antara dua frame
    // (HP lambat / fisika multi-langkah); cek segmen posisi lama -> baru.
    const lp = this._coinLastKart;
    const sweep = kart && lp && Math.hypot(px - lp.x, pz - lp.z) < 30;
    const ox = sweep ? lp.x : px, oy = sweep ? lp.y : py, oz = sweep ? lp.z : pz;
    const sx = px - ox, sz = pz - oz, sl2 = sx * sx + sz * sz;
    if (kart) this._coinLastKart = { x: px, y: py, z: pz };
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new V3(1, 1, 1), zero = new V3(0, 0, 0);
    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i];
      if (!c.alive) {
        c.respawn -= dt;
        if (c.respawn <= 0) c.alive = true;
        else continue;
      }
      if (kart) {
        let u = sl2 > 1e-6 ? ((c.x - ox) * sx + (c.z - oz) * sz) / sl2 : 1;
        u = u < 0 ? 0 : (u > 1 ? 1 : u);
        const qy = oy + (py - oy) * u;
        const dx = ox + sx * u - c.x, dy = (qy + 0.9) - c.y, dz = oz + sz * u - c.z;
        if (dx * dx + dz * dz < 2.35 * 2.35 && Math.abs(dy) < 2.8) {
          c.alive = false;
          c.respawn = 16.0;
          m.compose(zero, q, zero);
          this.coinMesh.setMatrixAt(c.index, m);
          if (BK.Save && BK.Save.addCoins) BK.Save.addCoins(1);
          if (BK.Audio && BK.Audio.coin) BK.Audio.coin();
          else if (BK.Audio && BK.Audio.pickup) BK.Audio.pickup();
          if (BK.spawnBurst) BK.spawnBurst({ x: c.x, y: c.y, z: c.z }, 0xffd23f, 8, 0.25);
          if (BK.refreshHubStats) BK.refreshHubStats();
          continue;
        }
      }
      e.set(0, t * 2.8 + c.phase, 0);
      q.setFromEuler(e);
      m.compose(new V3(c.x, c.y + Math.sin(t * 3.0 + c.phase) * 0.16, c.z), q, sc);
      this.coinMesh.setMatrixAt(c.index, m);
    }
    this.coinMesh.instanceMatrix.needsUpdate = true;
  };

  // ==========================================================================
  // PEMBALAP AI RIVAL KELILING JALAN RAYA PULAU (LIVING HUB WORLD)
  // ==========================================================================
  IslandHub.prototype._buildHubRacers = function () {
    this.hubRacers = [];
    if (!BK.buildRig || !BK.charById) return;
    const specs = [
      { charId: 'besi', who: 'pakoli', roadKey: 'ring', t: 0.25, dir: 1, speed: 16.5, color: '#3fb6ff',
        taunts: ['Dulu aku juga pembalap, sebelum lututku... eh, cangkangku encok.', 'Kotak ? di tepi jalan isinya item. Yang BOM jangan ditabrak.', 'Ramp di jalan lingkar itu bagus untuk latihan Air Trick!'] },
      { charId: 'hantu', who: 'lumi', roadKey: 'outer', t: 0.15, dir: 1, speed: 18.5, color: '#c9b8ff',
        taunts: ['Aku bukan hantu sungguhan, cangkangku saja yang pucat.', 'Cek jurnalmu di menu jeda kalau lupa ceritanya.', 'Drift di tikungan jalan lingkar ini enak banget!'] },
      { charId: 'turbo', who: 'gesit', roadKey: 'outer', t: 0.62, dir: -1, speed: 19.5, color: '#ff5a5a',
        taunts: ['Minggir! Knalpot kembarku sedang panas-panasnya!', 'Aku lari waktu Raja Juara datang? Namanya strategi!', 'Tahan gas tepat saat angka satu. Rahasia dagang, jangan bilang-bilang.'] }
    ];
    specs.forEach((sp, idx) => {
      const road = this.roadPaths.find(r => r.key === sp.roadKey);
      if (!road || road.points.length < 4) return;
      const cDef = BK.charById(sp.charId) || BK.charById('turbo');
      const mesh = BK.buildRig(cDef);
      const ptIdx = Math.floor(sp.t * road.points.length) % road.points.length;
      const pt = road.points[ptIdx];
      const gy = this.heightAt(pt.x, pt.z);
      const heading = Math.atan2(pt.tx * sp.dir, pt.tz * sp.dir);
      mesh.position.set(pt.x, gy, pt.z);
      mesh.rotation.y = heading;
      this.group.add(mesh);
      this.hubRacers.push({
        mesh, char: cDef, who: sp.who, color: sp.color,
        road, s: ptIdx, dir: sp.dir, speed: sp.speed,
        pos: new V3(pt.x, gy, pt.z), heading,
        taunts: sp.taunts, ti: idx, cd: 2.0
      });
    });
  };

  IslandHub.prototype._updateHubRacers = function (dt, t) {
    if (!this.hubRacers || !this.hubRacers.length) return;
    const player = (BK.playerKart && BK.playerKart.pos) ? BK.playerKart : null;
    this.hubRacers.forEach(r => {
      r.cd = Math.max(0, r.cd - dt);
      const pts = r.road.points;
      const N = pts.length;
      // maju menyusuri titik-titik jalan
      r.s = (r.s + r.dir * (r.speed * dt / 3.4) + N) % N;
      const i0 = Math.floor(r.s) % N;
      const i1 = (i0 + (r.dir > 0 ? 1 : N - 1)) % N;
      const frac = r.s - Math.floor(r.s);
      const p0 = pts[i0], p1 = pts[i1];
      const f = r.dir > 0 ? frac : (1 - frac);
      // ambil jalur agak ke pinggir kanan jalan supaya tidak menghalangi tengah jalan terus
      const laneOff = 2.1 * r.dir;
      const wx = lerp(p0.x, p1.x, f) - p0.tz * laneOff;
      const wz = lerp(p0.z, p1.z, f) + p0.tx * laneOff;
      const wy = this.heightAt(wx, wz);
      const dx = wx - r.pos.x, dz = wz - r.pos.z;
      if (dx * dx + dz * dz > 0.0001) {
        r.heading = Math.atan2(dx, dz);
      }
      r.pos.set(wx, wy, wz);
      r.mesh.position.set(wx, wy, wz);
      r.mesh.rotation.y = r.heading;
      const wheels = r.mesh.userData && r.mesh.userData.wheels;
      if (wheels) wheels.forEach(w => {
        const sp = w && (w.spin || w);
        if (sp && sp.rotation) sp.rotation.x += r.speed * dt * 1.4;
      });

      // interaksi hidup dengan kart pemain (sapaan rival + pantulan senggolan)
      if (player) {
        const pdx = player.pos.x - wx, pdz = player.pos.z - wz;
        const d2 = pdx * pdx + pdz * pdz;
        if (d2 < 9.5 * 9.5 && r.cd <= 0) {
          r.cd = 9.0;
          if (BK.speech) BK.speech(r.who, r.taunts[r.ti % r.taunts.length]);
          r.ti++;
          if (BK.Audio && BK.Audio.horn) BK.Audio.horn();
          else if (BK.Audio && BK.Audio.pickup) BK.Audio.pickup();
        }
        if (d2 < 2.5 * 2.5 && d2 > 0.001) {
          const d = Math.sqrt(d2);
          const nx = pdx / d, nz = pdz / d;
          player.pos.x = wx + nx * 2.55;
          player.pos.z = wz + nz * 2.55;
          player._bumpVx = (player._bumpVx || 0) + nx * 6;
          player._bumpVz = (player._bumpVz || 0) + nz * 6;
          if (BK.Audio && BK.Audio.thud) BK.Audio.thud(0.45);
        }
      }
    });
  };

  // ==========================================================================
  // TITIK SPAWN PER BIOMA
  // ==========================================================================
  IslandHub.prototype._buildSpawnPoints = function () {
    const spawns = [
      { key: 'center', x: 0, z: 54, heading: Math.PI },
      // spawn di tepi dalam plaza, menghadap portal, jauh dari cincin warp & gerbang
      { key: 'beach', x: -126, z: 162, heading: Math.atan2(-14, 16) },
      { key: 'ruins', x: -217, z: 20, heading: Math.atan2(-15, -10) },
      { key: 'glacier', x: -100, z: -166, heading: Math.atan2(-20, -6) },
      { key: 'citadel', x: 175, z: 14, heading: Math.atan2(19, -12) }
    ];
    spawns.forEach(s => {
      const bd = BIOME_DEFS.find(v => v.key === s.key);
      const y = this.heightAt(s.x, s.z);
      this.spawnPoints[s.key] = {
        key: s.key,
        name: bd ? bd.name : s.key,
        position: new THREE.Vector3(s.x, y, s.z),
        rotation: { x: 0, y: s.heading, z: 0 },
        heading: s.heading
      };
    });
    this.biomes = BIOME_DEFS.map(bd => ({
      key: bd.key, name: bd.name, short: bd.short,
      x: bd.x, z: bd.z, color: bd.color,
      trackId: bd.trackId,
      spawn: this.spawnPoints[bd.key] ? this.spawnPoints[bd.key].position.clone() : new THREE.Vector3(bd.x, this.heightAt(bd.x, bd.z), bd.z)
    }));
  };

  IslandHub.prototype.getSpawnPoint = function (biomeName) {
    const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const want = norm(biomeName);
    if (!want) return null;
    const direct = this.spawnPoints[biomeName];
    if (direct) {
      return { position: direct.position.clone(), rotation: { x: 0, y: direct.heading, z: 0 }, heading: direct.heading, key: direct.key, name: direct.name };
    }
    for (const key in this.spawnPoints) {
      const sp = this.spawnPoints[key];
      const keys = [key, sp.name, sp.key].map(norm);
      if (keys.some(k => k === want || (want.length > 2 && k.indexOf(want) >= 0) || (k.length > 2 && want.indexOf(k) >= 0))) {
        return { position: sp.position.clone(), rotation: { x: 0, y: sp.heading, z: 0 }, heading: sp.heading, key: sp.key, name: sp.name };
      }
    }
    return null;
  };

  // ==========================================================================
  // BAKE STATIS
  // ==========================================================================
  IslandHub.prototype._bakeStatic = function () {
    if (this.batch && this.batch.p.length) {
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.94, metalness: 0.02,
        flatShading: true
      });
      const mesh = this.batch.mesh(mat);
      mesh.name = 'Hub_Static';
      this.group.add(mesh);
      this.staticMesh = mesh;
      this.staticMaterial = mat;
      this.collidableMeshes.push(mesh);
    }
    if (this.glow && this.glow.p.length) {
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
      const mesh = this.glow.mesh(mat);
      mesh.name = 'Hub_StaticGlow';
      this.group.add(mesh);
      this.glowMesh = mesh;
      this.glowMaterial = mat;
    }
    this.batch = null;
    this.glow = null;
  };

  // ==========================================================================
  // BUILD / UPDATE / DISPOSE
  // ==========================================================================
  IslandHub.prototype.build = function () {
    if (this.built && this.world) return this.world;

    this.coast = this._coast();
    this.features = this._features();
    this.boundR = Math.max.apply(null, this.coast) + 10;
    this._buildHeightGrid();

    this.batch = new Batch();
    this.glow = new Batch();
    this.textures = this.textures || [];

    if (!this.group.parent) this.scene.add(this.group);
    this.group.visible = false;

    // atmosfer pulau
    this.scene.background = new THREE.Color(0x8bd8ee);
    this.scene.fog = new THREE.Fog(0xc5edf7, 360, 1080);

    const hemi = new THREE.HemisphereLight(0xe8fbff, 0x2f4934, 0.58);
    this.group.add(hemi);
    this.hemiLight = hemi;
    const sun = new THREE.DirectionalLight(0xfff2cf, 0.70);
    sun.position.set(190, 280, 130);
    this.group.add(sun);
    this.sunLight = sun;
    const fill = new THREE.AmbientLight(0xffffff, 0.08);
    this.group.add(fill);

    // permukaan & langit
    this._buildSky();
    this._buildOcean();
    this._buildTerrain();
    this._buildRoads();
    this._buildPlazas();

    // lima bioma
    this._buildCenter();
    this._buildBeach();
    this._buildRuins();
    this._buildGlacier();
    this._buildCitadel();

    // gerbang bos, garasi & kuil status
    this._buildBossGate();
    this._buildGarage();
    this._buildShrine();

    // ramp lompat di jalan lingkar (ikut batch statis)
    this._buildRamps();

    // pepohonan / batu / rumput
    this._scatterScenery();

    // portal balapan setelah semua landmark siap
    this._buildPortals();

    // gabungkan seluruh geometri statis jadi beberapa draw call
    this._bakeStatic();

    // objek yang beranimasi / butuh material sendiri
    this._buildLabels();
    this._buildPads();
    this._buildWarpRings();
    this._buildCrates();
    this._buildCoins();
    this._buildSpawnPoints();
    this._buildNPCs();
    this._buildHubRacers();
    this._buildBirds();
    this._buildGuideArrow();

    // simpan posisi dasar objek animasi
    if (this.gem) this.gemBaseY = this.gem.position.y;
    if (this.blimp) this.blimpBase = this.blimp.position.clone();
    if (this.ship) this.shipBaseRot = this.ship.rotation.clone();

    this.group.visible = true;
    this.built = true;
    this.disposed = false;

    const start = this.spawnPoints.center || { position: new THREE.Vector3(0, this.heightAt(0, 54), 54), heading: Math.PI };
    const hub = {
      def: { id: 'hub', name: 'Pulau Bekicot', dust: 0xE6D199 },
      isHub: true,
      boundR: this.boundR,
      hubR: this.boundR,
      group: this.group,
      boxes: [], pads: this.pads, hubRamps: this.hubRamps,
      portals: this.portals, coins: this.coins || [], letters: [],
      npcs: this.npcs, hubRacers: this.hubRacers || [],
      shop: null, garage: this.garage, shrine: this.shrine,
      guideArrow: this.guideArrow, drift: null, coast: this.coast,
      bossDoor: this.bossDoor, colliders: this.colliders,
      heightAt: (x, z) => this.heightAt(x, z),
      shallows: this.shallows,
      hazards: this.hazards,
      biomes: this.biomes,
      spawnPoints: this.spawnPoints,
      roadPaths: this.roadPaths,
      collidableMeshes: this.collidableMeshes,
      crates: this.crates,
      warpRings: this.warpRings,
      expeditionMap: this,
      startPos: new THREE.Vector3(start.position.x, this.heightAt(start.position.x, start.position.z), start.position.z),
      startHeading: start.heading,
      getSpawnPoint: (name) => this.getSpawnPoint(name),
      update: (dt, time) => this.update(dt, time),
      dispose: () => this.dispose()
    };
    this.world = hub;
    BK.currentWorld = hub;
    return hub;
  };

  /* Tahap cerita: 0 = padam (Permata pecah), 1-4 = kepingan kembali, 5 = utuh.
     Cahaya, langit, dan permata di pusat pulau mengikuti; kemajuan terasa di dunianya. */
  IslandHub.prototype.setStoryStage = function (stage, instant) {
    this.storyStage = stage;
    const k = clamp(stage / 5, 0, 1);
    this._lightGoal = k;
    if (instant) this._lightNow = k;
    this._applyGemStage(stage);
    if (instant) this._applyLight(k);
  };
  IslandHub.prototype._applyLight = function (k) {
    const bg = this._c1 || (this._c1 = new THREE.Color()), fog = this._c2 || (this._c2 = new THREE.Color()), sky = this._c3 || (this._c3 = new THREE.Color());
    bg.setHex(0x54607e).lerp(new THREE.Color(0x8bd8ee), k);
    fog.setHex(0x7d7f98).lerp(new THREE.Color(0xc5edf7), k);
    sky.setHex(0x8a7e9c).lerp(new THREE.Color(0xffffff), k);
    if (this.scene.background && this.scene.background.isColor) this.scene.background.copy(bg);
    if (this.scene.fog) this.scene.fog.color.copy(fog);
    if (this.sky) this.sky.material.color.copy(sky);
    if (this.cloudMat) this.cloudMat.color.setHex(0xa8a4b8).lerp(new THREE.Color(0xffffff), k);
    if (this.oceanMat) {
      this.oceanMat.uniforms.uDay.value = k;
      this.oceanMat.uniforms.uHorizon.value.copy(fog);
    }
    if (this.hemiLight) this.hemiLight.intensity = 0.42 + 0.16 * k;
    if (this.sunLight) {
      this.sunLight.intensity = 0.42 + 0.28 * k;
      this.sunLight.color.setHex(0xd8c8e8).lerp(new THREE.Color(0xfff2cf), k);
    }
  };
  IslandHub.prototype._applyGemStage = function (stage) {
    if (!this.gem) return;
    const whole = stage >= 5;
    if (this.gemMain) this.gemMain.visible = whole;
    this.gem.children.forEach(c => { if (c !== this.gemMain && this.gemShards.indexOf(c) < 0) c.visible = whole; });
    this.gemShards.forEach((s, i) => {
      s.visible = whole || i < stage;
      const sc = whole ? 1 : 2.6;
      s.scale.set(sc, sc * 1.5, sc);
    });
    this._gemWhole = whole;
  };

  IslandHub.prototype.init = function () {
    return this.build();
  };

  IslandHub.prototype.update = function (dt, time) {
    if (!this.built || this.disposed) return;
    const step = Math.min(dt || 0.016, 0.06);
    if (typeof time === 'number') this.seconds = time;
    else this.seconds += step;
    const t = this.seconds;

    // cahaya pulau bergeser halus menuju tahap cerita
    if (this._lightGoal != null && Math.abs(this._lightNow - this._lightGoal) > 0.002) {
      this._lightNow += (this._lightGoal - this._lightNow) * Math.min(1, 0.9 * step);
      this._applyLight(this._lightNow);
    }

    // laut: gelombang, riak & buih dihitung di shader
    if (this.oceanMat) this.oceanMat.uniforms.uTime.value = t;

    // awan & camar
    this.animated.clouds.forEach((c, i) => {
      c.group.position.x += c.speed * step;
      c.group.position.z += c.drift * step;
      if (c.group.position.x > 450) c.group.position.x = -450;
      if (c.group.position.z > 450) c.group.position.z = -450;
      if (c.group.position.z < -450) c.group.position.z = 450;
      c.group.position.y += Math.sin(t * 0.35 + i) * 0.003;
    });
    this.animated.gulls.forEach((g, i) => {
      g.a += g.sp * step;
      const x = g.cx + Math.cos(g.a) * g.r;
      const z = g.cz + Math.sin(g.a) * g.r;
      g.mesh.position.set(x, g.h + Math.sin(t * 1.2 + i) * 2.0, z);
      g.mesh.rotation.y = -g.a + Math.PI / 2;
    });

    // gem raksasa
    if (this.gem) {
      this.gem.rotation.y += step * 0.32;
      this.gem.position.y = this.gemBaseY + Math.sin(t * 0.9) * 0.55;
      const gemK = this._gemWhole ? 1 : 0.25 + 0.15 * (this.storyStage || 0);
      if (this.gemLight) this.gemLight.intensity = (1.05 + Math.sin(t * 2.1) * 0.25) * gemK;
      if (this.gemShards) {
        this.gemShards.forEach((s, i) => {
          const a = t * 0.65 + i / this.gemShards.length * TAU;
          const r = (this._gemWhole ? 5.0 : 3.2) + Math.sin(t * 0.7 + i) * 0.45;
          s.position.set(Math.cos(a) * r, Math.sin(t * 1.1 + i) * 1.3, Math.sin(a) * r);
          s.rotation.y += step * 1.2;
        });
      }
    }

    // blimp kuning-biru
    if (this.blimp) {
      this.blimp.position.y = this.blimpBase.y + Math.sin(t * 0.55) * 1.5;
      this.blimp.position.x = this.blimpBase.x + Math.sin(t * 0.23) * 4.0;
      this.blimp.rotation.y = Math.sin(t * 0.18) * 0.18;
      if (this.blimpProp) this.blimpProp.rotation.z += step * 9.5;
    }

    // kapal & air terjun
    if (this.ship) this.ship.rotation.z = 0.18 + Math.sin(t * 0.8) * 0.018;
    this.animated.waterfalls.forEach(w => {
      if (w.tex) w.tex.offset.y -= step * w.speed;
    });

    // semua material yang berdenyut (api, aura, toxic, lava)
    this.animated.pulses.forEach(p => {
      if (!p.mat) return;
      p.mat.opacity = clamp(p.base + Math.sin(t * p.speed + (p.phase || 0)) * p.amp, 0.02, 1);
    });

    // portal
    this.portals.forEach(p => {
      // cincin portal tetap datar; rotasi Y yang menumpuk membuatnya miring tak sengaja
      p.ring.rotation.set(Math.PI / 2, 0, 0);
      p.ring.position.y = 3.1 + Math.sin(t * 1.8 + p.ph) * 0.38;
      p.ring.scale.setScalar(1 + Math.sin(t * 1.9 + p.ph) * 0.04);
      if (p.ring2) {
        p.ring2.rotation.set(Math.PI / 2, 0, 0);
        p.ring2.position.y = p.ring.position.y;
        p.ring2.scale.setScalar(1 + Math.sin(t * 1.5 + p.ph + 1) * 0.08);
      }
      p.beam.material.opacity = (p.locked ? 0.14 : 0.30) + Math.abs(Math.sin(t * 1.8 + p.ph)) * (p.locked ? 0.04 : 0.10);
      if (p.trophy) {
        p.trophy.rotation.y += step * 2.0;
        p.trophy.position.y = 7.8 + Math.sin(t * 2.4 + p.ph) * 0.35;
      }
      if (p.tokenMesh) {
        p.tokenMesh.rotation.y += step * 2.4;
        p.tokenMesh.position.y = 7.6 + Math.sin(t * 2.2 + p.ph + 1.0) * 0.3;
      }
      if (p.relicMesh) {
        p.relicMesh.rotation.y -= step * 2.6;
        p.relicMesh.position.y = 7.6 + Math.sin(t * 2.5 + p.ph + 2.0) * 0.3;
      }
      p.group.children.forEach(o => {
        if (o.userData && o.userData.a != null) {
          const a = o.userData.a + t * 0.55;
          o.position.x = Math.cos(a) * 4.2;
          o.position.z = Math.sin(a) * 4.2;
          o.position.y = p.ring.position.y;
        }
      });
    });

    // gerbang warp di jalan
    this.warpRings.forEach(w => {
      // hoop tetap menapak; animasi hanya pada skala dan glow
      w.group.position.y = w.baseY;
      w.orbit.rotation.z += step * 0.8;
      const s = 1 + Math.sin(t * 1.7 + w.phase) * 0.06;
      w.ring.scale.setScalar(s);
      if (w.glow) w.glow.material.opacity = 0.24 + Math.abs(Math.sin(t * 1.2 + w.phase)) * 0.12;
    });

    // pad turbo
    this.pads.forEach(p => BK.Props.tickBoostPad(p, step));

    // krate ? / BOM, koin emas, dan pembalap AI rival di pulau
    this._updateCrates(step);
    this._updateCoins(step, t);
    this._updateHubRacers(step, t);

    // penghuni pulau: bernapas, berkedip, menoleh saat pemain dekat
    const npcKart = (BK.playerKart && BK.playerKart.pos) ? BK.playerKart : null;
    this.npcs.forEach(n => {
      n.cd = Math.max(0, n.cd - step);
      const br = Math.sin(t * 2.2 + n.phase);
      n.mesh.scale.set(n.base * (1 - br * 0.008), n.base * (1 + br * 0.016), n.base * (1 - br * 0.008));
      let want = n.face;
      if (npcKart) {
        const dx = npcKart.pos.x - n.x, dz = npcKart.pos.z - n.z;
        if (dx * dx + dz * dz < 400) want = Math.atan2(dx, dz);
      }
      n.mesh.rotation.y += wrapAngle(want - n.mesh.rotation.y) * Math.min(1, 4 * step);
      const u = n.mesh.userData;
      if (u.eyes && u.eyes.length) {
        n.blink -= step;
        if (n.blink <= 0) { n.blink = 1.8 + Math.random() * 3; n._b = 0.13; }
        if (n._b > 0) n._b -= step;
        const eo = n._b > 0 ? 0.12 : 1;
        u.eyes.forEach(e => e.scale.set(1, eo, 1));
      }
      if (u.tick) u.tick(t, step, false, 0, 0);
    });

    // label bioma
    this.labels.forEach(l => {
      l.sprite.position.y = l.baseY + Math.sin(t * 0.75 + l.phase) * 1.0;
      // nama bioma hanya penunjuk dari jauh; dari dekat ia menutupi HUD di atas layar
      const vp = BK._dev && BK._dev.player;
      if (vp) l.sprite.visible = Math.hypot(l.sprite.position.x - vp.pos.x, l.sprite.position.z - vp.pos.z) > 85;
    });

    // kunang-kunang / spora
    if (this.fireflies) {
      this.fireflies.forEach((f, fi) => {
        const P = f.points.geometry.attributes.position;
        f.data.forEach((d, i) => {
          const a = d.a + t * d.speed * 0.16;
          P.setX(i, f.cx + Math.cos(a) * d.rr);
          P.setZ(i, f.cz + Math.sin(a) * d.rr);
          P.setY(i, f.baseY + 1.2 + Math.sin(t * d.speed + d.phase) * 2.0 + (i % 3) * 0.55);
        });
        P.needsUpdate = true;
      });
    }

    // asap cerobong
    if (this.smoke) {
      this.smoke.forEach((s, si) => {
        const P = s.points.geometry.attributes.position;
        s.data.forEach((d, i) => {
          const cycle = ((t * 0.09 * d.speed + d.phase / TAU) % 1 + 1) % 1;
          P.setX(i, d.baseX + Math.sin(t * 0.6 + d.phase) * 1.4 * cycle);
          P.setZ(i, d.baseZ + Math.cos(t * 0.5 + d.phase) * 1.4 * cycle);
          P.setY(i, s.baseY + 1.2 + cycle * s.top);
        });
        P.needsUpdate = true;
      });
    }

    // core gerbang bos berputar
    this.animated.rings.forEach(r => {
      r.mesh.rotation.y += step * (r.spin || 1);
      r.mesh.rotation.x += step * 0.4;
      if (r.baseY != null) r.mesh.position.y = r.baseY + Math.sin(t * (r.speed || 1) + (r.phase || 0)) * 0.25;
    });

    if (this.bossBeam) this.bossBeam.material.opacity = 0.20 + Math.abs(Math.sin(t * 1.8)) * 0.12;
  };

  IslandHub.prototype.dispose = function () {
    if (this.disposed) return;
    this.disposed = true;
    const world = this.world;
    if (this.group && this.group.parent) this.group.parent.remove(this.group);

    if (this.group) {
      // Lepas rig karakter (NPC & rival AI) terlebih dahulu agar tekstur/geometri cache chars.js tidak ikut di-dispose
      if (this.npcs) this.npcs.forEach(n => { if (n.mesh && n.mesh.parent) n.mesh.parent.remove(n.mesh); });
      if (this.hubRacers) this.hubRacers.forEach(r => { if (r.mesh && r.mesh.parent) r.mesh.parent.remove(r.mesh); });
      const geos = new Set(), mats = new Set(), texs = new Set();
      const sharedGeo = new Set(Object.keys(G).map(k => G[k]));
      this.group.traverse(o => {
        if (o.geometry && !sharedGeo.has(o.geometry)) geos.add(o.geometry);
        const m = o.material;
        if (!m) return;
        const arr = Array.isArray(m) ? m : [m];
        arr.forEach(mm => {
          mats.add(mm);
          ['map', 'alphaMap', 'normalMap', 'emissiveMap', 'roughnessMap'].forEach(slot => {
            if (mm[slot] && mm[slot] !== _softTex) texs.add(mm[slot]);
          });
        });
      });
      geos.forEach(g => { try { g.dispose(); } catch (e) {} });
      texs.forEach(tx => { try { tx.dispose(); } catch (e) {} });
      mats.forEach(mm => { try { mm.dispose(); } catch (e) {} });
      if (this.labels) this.labels.length = 0;
    }
    if (this.roadMaskTexture && this.roadMaskTexture.dispose) {
      try { this.roadMaskTexture.dispose(); } catch (e) {}
      this.roadMaskTexture = null;
    }
    if (this.textures) this.textures.length = 0;
    this.world = null;
    if (BK.currentWorld === world) BK.currentWorld = null;
    this.built = false;
    this.group = null;
  };

  BK.IslandHub = IslandHub;
  // pengganti BK.buildHub lama: satu panggilan = pulau siap dipakai game.js
  BK.buildHub = function (scene, opts) {
    return new IslandHub(scene, opts).build();
  };
})();
