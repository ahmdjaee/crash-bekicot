# AGENTS.md — Aturan main repo Crash Bekicot

## 0. Aturan & referensi (baca dulu)
- Stack: `index.html` + script global, Three r128 via `libs/`. DILARANG:Three baru/CDN/fetch/aset luar.
- Struktur: `js/config|save|audio|tracks|terrain|props|world|hub|physics|chars|ai|items|
  particles|camera|ui|story|cutscene|game.js`. Dependensi luar DILARANG (termasuk THREE.Terrain asli:
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
  - Struktur hub (portal trofi, pintu bos, kunci) ← game kart lain sebagai inspirasi desain saja (lihat §0b).
- Jangan kembalikan sistem yang sudah dibuang (mini-game hub) tanpa diskusi.

## 0b. Game milik sendiri — tanpa unsur game lain
Crash Bekicot adalah IP sendiri. Game lain (mis. Crash Team Racing) HANYA referensi
rasa/struktur, dan tidak boleh muncul di repo:
- DILARANG nama/singkatan game lain di kode: nama file, variabel, fungsi, class,
  `mesh.name`, kunci data/mode, class CSS, teks UI, maupun komentar
  (contoh terlarang: `CTR`, `ctrLetters`, "ala CTR", "Crash Cove").
- DILARANG meniru aset/elemen khas mereka: nama karakter/level/item, logo,
  tulisan khas (mis. krate "TNT", "Nitro", "Wumpa"), musik, atau desain persis.
- Mekanik umum genre boleh (drift-turbo, item box, token huruf, relik waktu, hub
  portal), tapi beri nama & tampilan versi kita (B-K-T, Krate BOM, Pulau Bekicot).
- Cek sebelum commit: `grep -rnIE "\b(CTR|ctr|TNT|tnt|[Nn]itro|[Ww]umpa)\b|ctr[A-Z_]|CTR[A-Za-z_]|Crash (Team|Cove)" --exclude-dir=.git --exclude-dir=libs .`
  hanya boleh mengenai baris aturan ini.

## 1. Reusable dulu, sekali pakai belakangan
Sebelum membuat komponen/visual/fungsi baru, jawab: **"apakah ini akan dipakai di >1 tempat (atau >1 trek) ke depannya?"**
- Ya → taruh di `js/props.js` sebagai factory (`BK.Props.nama()`), geometri & material di-cache bersama, dukung parameter ukuran/warna.
- Tidak → boleh inline di builder, tapi beri komentar `// sekali-pakai: <nama-trek>`.

## 1b. Satu desain = satu komponen (trek + hub)
Objek yang muncul di >1 tempat (trek mana pun, landmark, sebaran, hub `js/hub.js`)
WAJIB memakai definisi yang sama di `js/props.js` — ubah di satu tempat, berubah di semua:
- Vegetasi/batu: `BK.Comp.define(nama, {r, shadow, dv, parts(v)})` → pakai `BK.Comp.make()` (objek
  tunggal) atau `BK.Comp.scatter(parent, nama, [{x,y,z,s,sy?,sz?,rx?,ry?,rz?,v?,tint?}])` (instanced).
  Sudah ada: `palm`, `pine`, `forestTree`, `deadTree`, `rock`, `mushroom`.
- Elemen jalur: `BK.Props.boostPad(BK.Props.pathSampler(...), w, l)` + `tickBoostPad`, `BK.Props.kerbs(...)`.
- Tekstur bersama: `BK.Props.coastRockTex()` dst. Jangan salin desain/tekstur ke file lain.
- Hub tidak boleh punya versi sendiri (`_addPalm` dll. hanya meneruskan ke `BK.Comp`).

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

## Git commits

- Commit only when the user explicitly asks. Otherwise, leave changes uncommitted in the working tree.
- Do not push or create branches unless the user explicitly asks. Commit to the current branch.
- Stage specific files with `git add <path>`. Do not use `git add .` or `git add -A`.
- Write commit messages in English, even if the conversation is in another language.
- Use the Conventional Commits format: `<type>(<optional scope>): <description>`
    - Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
    - Mark breaking changes with `!`, for example `feat(api)!: remove legacy login endpoint`
    - Examples: `fix(auth): handle expired token`, `docs: update setup guide`
- Never add AI attribution to commit messages. This includes `Co-Authored-By` trailers for Claude or any other AI, and lines such as "Generated with Claude Code".  
