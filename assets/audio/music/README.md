# Musik Crash Bekicot 🎵

## Kredit (wajib dipertahankan — lisensi CC-BY)
Semua trek oleh **Kevin MacLeod** ([incompetech.com](https://incompetech.com)),
lisensi Creative Commons BY 3.0/4.0:
- `menu.mp3` — "Monkeys Spinning Monkeys" (ceria)
- `hub.mp3` — "Marty Gots a Plan" (petualangan santai)
- `race.mp3` — "Kick Shock" (driving dance)
- `final.mp3` — "Volatile Reaction" (intens)
- `finish.mp3` — "Pixel Peeker Polka – faster" (ceria)

## Cara mengganti (tanpa ubah kode)
1. Siapkan file audio (MP3/OGG/WAV bebas, saran: MP3 ~128kbps).
2. Timpa file di atas (nama HARUS sama, atau ubah di `music-config.js`).
3. Pastikan awal-akhir audio nyambung (potong hening di ujung) agar loop tanpa jeda.

## Cara mengganti (tanpa ubah kode)
1. Siapkan file audio (MP3/OGG/WAV bebas, saran: MP3 ~128kbps).
2. Timpa file berikut (nama HARUS sama, atau ubah di `music-config.js`):
   - `menu.wav` — menu utama (santai, loop mulus)
   - `race.wav` — balapan (tempo cepat, loop mulus!)
   - `final.wav` — lap terakhir (lebih intens dari race)
   - `finish.wav` — finish/hasil (fanfare pendek, boleh tidak loop)
3. Pastikan awal-akhir audio nyambung (potong hening di ujung) agar loop tanpa jeda.

## Catatan offline
- Dibuka via **double-click (`file://`)**: browser memblokir file audio lokal,
  game otomatis pakai **musik synth fallback** (tetap bunyi, tanpa file).
- Dibuka via server lokal (`python3 -m http.server`) atau hosting: file di sini
  dipakai normal, termasuk loop + crossfade Howler.
- Volume musik terpisah dari SFX, diatur di `music-config.js` (`volume`).
- Tombol `M` = bisu/nyala musik.
