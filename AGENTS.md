# AGENTS.md — Aturan main repo Crash Bekicot

## 0. Aturan & referensi (baca dulu)
- Stack: `index.html` + script global, Three r128 via `libs/`, jalan via double-click
  `file://`. DILARANG: npm/Vite/module/Three baru/CDN/fetch/aset luar.
- Struktur: `js/config|save|audio|tracks|terrain|props|world|physics|chars|ai|items|
  particles|camera|ui|game.js`. Dependensi luar DILARANG (termasuk THREE.Terrain asli:
  ESM + butuh r160+ + server; tekniknya saja yang diadaptasi ke `js/terrain.js`).
- Konvensi arah: lateral `+` = kanan; belok kanan = heading berkurang.
- Ribbon mesh: winding menghadap ATAS. Rem di speed rendah = mundur (AI jangan menahan).
- Rasa game: anti-pusing (getar hanya misil/minyak/jeduk keras, FOV kick kecil,
  partikel kecil-singkat); knob `smoke`/`effects` di `config.js`.
- Verifikasi wajib: `node --check`, sim headless (AI finish semua trek, tabrakan
  terukur), screenshot bila visual; naikkan `?v=` tiap file berubah.
- Referensi teknik → implementasi milik kita:
  - FBM/noise, radial falloff, biome by height/slope, scatter berpengecualian ← ide
    dari `/var/www/THREE.Terrain` (clone studi; ESM+r160+, TIDAK di-vendor).
  - Struktur hub (portal trofi, pintu bos, kunci) ← CTR Adventure (desain saja).
- Jangan kembalikan sistem yang sudah dibuang (mini-game hub) tanpa diskusi.

## 1. Reusable dulu, sekali pakai belakangan
Sebelum membuat komponen/visual/fungsi baru, jawab: **"apakah ini akan dipakai di >1 tempat (atau >1 trek) ke depannya?"**
- Ya → taruh di `js/props.js` sebagai factory (`BK.Props.nama()`), geometri & material di-cache bersama, dukung parameter ukuran/warna.
- Tidak → boleh inline di builder, tapi beri komentar `// sekali-pakai: <nama-trek>`.

## 2. Pola komponen yang berlaku
- Factory mengembalikan `{group, r}` — `r` = radius collider pada skala 1 (0 jika tidak bisa ditabrak).
- Penempatan SELALU lewat `BK.placeProp(holder, item, x, y, z, ry)` — otomatis masuk scene + `holder.colliders` bila `r > 0`.
- Jangan `new THREE.*Geometry/Material` per instance untuk komponen umum — pakai cache modul (`G()`/`Mt()` di `props.js`).
- Builder khas-satu-trek (lighthouse, tengkorak, manusia salju) boleh tetap lokal, tapi collider-nya tetap didaftarkan manual ke `colliders`.

## 3. Fisika ikut komponen
- Setiap entri `world.colliders = [{x, z, r}]` otomatis ditabrak kart via `physics.js` (dorong + melambat 15% + duk pelan). Tidak perlu kode tabrakan per objek.
- Jarak aman dari garis balap: collider ≥ 6m dari centerline (dinding sudah menahan duluan).

## 4. Objek terjangkau wajib hidup
Setiap objek yang DAPAT DIJANGKAU pemain wajib punya (a) respons fisika
(dorong/melambat/trigger) dan (b) umpan balik minimal (bunyi/partikel/pesan).
Pengecualian hanya dekorasi di luar jangkauan — tandai `// dekorasi: tak terjangkau`.
Contoh patuh: item box (roulette+pecah), pad (boost), dinding (thud), es/pasir (efek),
pohon via collider, NPC (dialog + dorongan lembut), kolam (cipratan + lambat).

## 5. Lainnya
- Offline penuh: tanpa CDN/fetch/aset luar. Tekstur hanya kanvas prosedural, maksimal 512px.
- Anti-pusing: tanpa getar layar kecuali misil/minyak/jeduk keras; partikel kecil & singkat; ada knob `smoke`/`effects` di `config.js`.
- Verifikasi tiap perubahan: `node --check`, sim headless (AI finish semua trek), screenshot bila visual.
- Naikkan `?v=` di `index.html` untuk tiap file JS/CSS yang diubah.
