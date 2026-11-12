---
name: terrain-patterns
description: Procedural terrain techniques for the Crash Bekicot offline kart game (Three.js r128 global, file://, no build). Use whenever touching terrain, island shape, ground textures, scatter/decor placement, heightAt/physics height, or reviewing anything in js/terrain.js and js/world.js builders — even if the user only says "map", "pulau", "terrain", "bukit", or "dekorasi acak".
---

# Terrain Patterns (Crash Bekicot)

Teknik adaptasi dari THREE.Terrain (`/var/www/THREE.Terrain`, clone studi — ESM + r160+,
TIDAK di-vendor, baca source-nya sebagai referensi saja). Semua pola di bawah
sudah disesuaikan ke stack repo: script global, Three r128, `file://` offline.

## Aturan stack (tidak bisa ditawar)
- Tanpa ESM/module, tanpa npm/Vite, tanpa CDN/fetch. Satu-satunya lib: `libs/three.min.js`.
- Geometri BufferGeometry r128 (PlaneGeometry dkk SUDAH Buffer-based). Tidak ada
  `geometry.vertices` — pakai `attributes.position`.
- Deterministik: visual = fisika = minimap. Seed tetap, tanpa `Math.random` telanjang
  untuk hal yang memengaruhi gameplay/layout.

## Pola 1 — Seeded RNG (dari `random.js`: xorshift32)
```js
// pola: mulberry32/xorshift, seed dari string id
function rngFor(str){ let h=2166136261; for(const c of str){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return mulberry(h>>>0); }
```
Gunakan untuk: scatter layout per trek (`rngFor(trackId)`), variasi prop. Layout stabil
antar kunjungan. Jangan untuk efek per-frame (di sana `Math.random` boleh).

## Pola 2 — Multipass composition (dari `generators.js` MultiPass)
Bentuk = base shape (dome/plateau) + detail FBM amplitudo kecil:
```js
h = BASE * shape(rn) + (fbm(x*f, z*f) - 0.5) * 2 * AMP * (1 - smooth(0.8, 1.0, rn));
```
Detail selalu difade-out mendekati tepi agar garis pantai tidak bergerigi.

## Pola 3 — Island falloff (dari `filters.js` Edges/RadialEdges)
`rn = dist / coastR(angle)`; `h = PEAK * pow(max(0,1-rn*rn), 1.35)`; di luar `rn>=1`
turun curam ke dasar laut. Coast SATU array dipakai visual + fisika + minimap.

## Pola 4 — Biome by height/slope (dari `materials.js` levels)
Vertex color, bukan shader:
- `h < 1.1` → pasir; `1.1..6` → rumput gradasi; `h > 6` atau slope > 0.9 → batu;
  `h < 0.3` → dasar laut gelap. Slope via finite-difference `heightAt`.

## Pola 5 — Scatter spread × filter (dari `scatter.js`)
- `spread`: peluang dasar + clumping (pilih pusat rumpun dulu, lalu offset kecil).
- `filter`: tolak `h < min`, `h > max`, slope > ambang, dalam radius jalan/portal.
- `sizeVariance`: skala 0.7–1.6 acak via RNG seed.
- `tintRange`: variasi warna per instance via `instanceColor.setColorAt` (r128 OK,
  guard `typeof inst.setColorAt==='function'`); deterministik dari indeks agar stabil.
- `min-distance`: untuk objek besar (gubuk), tolak jika < 25m dari sejenis.
- Semua scatter: `y = heightAt(x,z)`, collider via `BK.placeProp` (lihat AGENTS.md).

## Pola 6 — Influences geografis (dari `influences.js`)
Fitur = entry `{x,z,ri,ro,mode,h}` pada fungsi tinggi: `set` (plateau/terracing),
`dip` (kawah/laguna: target `h - depth`). Kurva: `t = 1 - smooth(ri,ro,dist)`.

## Workflow wajib tiap ubahan terrain
1. `node --check` file yang diubah.
2. Sim headless: bangun world, kelilingi (tidak tenggelam/melayang: gap `gy` vs
   `heightAt` < 2m), AI finish semua trek bila trek balap tersentuh.
3. Screenshot sebelum/sesudah bila visual berubah.
4. Naikkan `?v=` di `index.html`.
5. Draw calls: pulau ≤ ~250 mesh (instancing untuk rumput/tiang), tekstur ≤128px.

## Larangan
- Jangan port `grass.js` (shader instancing WebGL2-ish, rawan r128).
- Jangan port blended GLSL material (pakai vertex color).
- Jangan ambil kode ESM apa pun mentah-mentah; tulis ulang sebaris sesuai pola di atas.
