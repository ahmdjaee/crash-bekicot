---
name: arcade-kart-physics
description: Standar implementasi fisika kendaraan arcade bergaya CTR menggunakan Three.js dan Rapier 3D (Raycast Vehicle, Surface Alignment, Airborne Physics, dan Spring-Arm Chase Camera).
---

# Arcade Kart Physics & Camera Architecture (Three.js + Rapier)

> ADAPTASI WAJIB CRASH BEKICOT: skill ini ditulis generik (Rapier/ESM). Di repo
> ini **Rapier DILARANG** — stack terkunci: script global, Three r128
> (`libs/three.min.js`), `file://` offline, tanpa npm/CDN/fetch (lihat AGENTS.md
> dan `skills/terrain-patterns/SKILL.md`). Pakai bagian ini sebagai **ide yang
> diadaptasi ke fisika kustom**, bukan untuk di-port mentah:
> - "RigidBody/collider Rapier" → baca sebagai state kart di `js/physics.js`
>   (`BK.updateKart`: pos/heading/speed, raycast tanah manual via
>   `world.nearest` + `gy`).
> - "world.castRay Rapier" → raycast tanah manual yang sudah ada; prinsip
>   4-titik (§2) dipakai seperlunya untuk alignment visual, bukan full sim.
> - "ChaseCamera class" → `BK.updateCamera` di `js/camera.js` (sudah lerp +
>   FOV kick; kamera BUKAN child kart — sudah patuh §4).
> - "ColliderDesc.trimesh jalan" → jalan/ribon kami BufferGeometry + fisika
>   analitik (`trackDist`), bukan mesh collider. Jangan tambah Rapier.
> - Aturan anti-pusing AGENTS.md tetap di atas segalanya (getar hanya
>   misil/minyak/jeduk keras; FOV kick kecil; partikel kecil-singkat).

Saat membuat atau memodifikasi sistem kendaraan, patuhi arsitektur 3-lapis berikut agar kontrol terasa responsif seperti Crash Team Racing (CTR):

## 1. Pemisahan Physics Body dan Visual Mesh
- **JANGAN** menyalin rotasi `RigidBody` mentah-mentah ke `Mesh` visual jika menggunakan collider berbentuk bola/kapsul, atau gunakan `DynamicRayCastVehicleController` / 4-point custom raycast.
- **Collider Utama:** Gunakan `ColliderDesc.cuboid` atau `capsule` dengan pusat massa (*center of mass*) yang direndahkan pada sumbu Y agar mobil tidak mudah terguling saat belok tajam.
- **Collider Lintasan:** Pastikan mesh terrain/jalan menggunakan `ColliderDesc.trimesh(vertices, indices)` agar raycast membaca kontur tanjakan secara akurat.

## 2. Mekanisme 4-Titik Suspensi & Kemiringan Jalan (Pitch/Roll)
- Tembakkan 4 sinar (`world.castRay`) ke arah bawah lokal (`-Y`) dari sudut chassis (FL, FR, RL, RR).
- **Gaya Pegas (Suspension):** `Force = (restLength - currentLength) * springStiffness - ( damper * verticalVelocity )`.
- **Penyesuaian Kemiringan (Surface Normal Alignment):**
  - Ambil rata-rata vektor `normal` dari titik tabrak raycast yang menyentuh tanah (`isGrounded`).
  - Jika di tanah: putar orientasi mobil menggunakan `Quaternion.slerp` (kecepatan `10 * dt`) agar sejajar dengan kemiringan tanjakan/turunan.
  - Jika melayang (`0` roda menyentuh tanah): kembalikan rotasi pitch/roll secara perlahan ke arah horizontal (`Vector3(0, 1, 0)`) dengan `slerp` lambat (`2 * dt`) agar mobil mendarat rata dan tidak nyungsep.

## 3. Fisika Melayang di Tanjakan (Airborne & Jump Physics)
- Saat melewati tanjakan dengan kecepatan tinggi, biarkan momentum vertikal (`linvel().y > 0`) melontarkan mobil ke udara ketika panjang raycast melebihi `restLength`.
- **Arcade Gravity Multiplier:** Ketika `isGrounded === false`, tambahkan gaya gravitasi ekstra ke bawah (`applyImpulse({ x: 0, y: -extraGravity * dt, z: 0 })`) agar mobil tidak terasa melayang seperti di bulan.
- Matikan gaya dorong mesin utama saat di udara, namun izinkan sedikit kontrol rotasi Y (air control) yang diperlemah.

## 4. Chase Camera Dinamis (Spring-Arm Lerp)
- **JANGAN** menjadikan `THREE.Camera` sebagai child langsung dari `Mesh` kendaraan.
- Buat class `ChaseCamera` terpisah yang di-update setiap frame setelah step fisika:
  - **Ideal Offset:** Posisi di belakang dan atas mobil, dihitung relatif terhadap arah hadap (Yaw) dan sedikit mengikuti kemiringan tanjakan (Pitch) mobil.
  - **Transisi Posisi Horizontal (X, Z):** Gunakan `lerp` cepat (`10 * dt` hingga `15 * dt`).
  - **Transisi Posisi Vertikal (Y):** Gunakan `lerp` terpisah yang sedikit lebih lembut (`5 * dt` hingga `8 * dt`) saat mobil melompat agar ada efek kamera mengejar ketinggian mobil secara sinematik, namun cepat menyesuaikan saat mobil menanjak.
  - **LookAt Target:** Fokuskan kamera pada titik beberapa unit di depan hidung mobil (`kartPosition + forwardVector * lookAheadDistance`).

## 5. Aturan Kode & Performa
- Hindari membuat instance `new THREE.Vector3()` atau `new THREE.Quaternion()` di dalam loop `requestAnimationFrame` / `update()`. Gunakan variabel sementara (*reusable temp variables*) di tingkat modul/class untuk mencegah *garbage collection stutter*.
- Selalu gunakan `deltaTime` (dibatasi maksimal `Math.min(dt, 0.1)`) pada semua perhitungan gaya dan interpolasi kamera.

## Workflow wajib tiap ubahan fisika/kamera (repo ini)
1. `node --check` file yang diubah.
2. Sim headless dengan harness BENAR: `BK.updateAI(k,world,cfg,k.progress,DT)` dengan
   `DT=1/60` konstan (JANGAN oper waktu-elapsed sebagai dt — itu teleportasi),
   `placeOnStart` tanpa menimpa `progress`, `_startDelay`+`aiLane` di-set.
   Patokan sehat: AI 3 lap 67–152 dtk sesuai trek/level, urutan easy<normal<hard.
3. Metrik pemain: 0→top, waktu charge drift Lv1/2/3, jarak rem, radius belok.
4. Screenshot bila visual berubah; naikkan `?v=` di `index.html`.
