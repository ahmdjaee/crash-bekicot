/* Konfigurasi soundtrack — ganti FILE saja tanpa ubah kode.
   Lihat assets/audio/music/README.md untuk cara mengganti. */
window.BK_MUSIC = {
  volume: 0.7,      // volume musik (0..1), terpisah dari SFX
  fadeIn: 1200,     // ms
  fadeOut: 800,     // ms
  states: {
    menu:   { file: 'assets/audio/music/menu.mp3',   synth: 'menu' },
    hub:    { file: 'assets/audio/music/hub.mp3',    synth: 'hub' },
    race:   { file: 'assets/audio/music/race.mp3',   synth: 'race' },
    final:  { file: 'assets/audio/music/final.mp3',  synth: 'final' },
    finish: { file: 'assets/audio/music/finish.mp3',  synth: 'finish' }
  }
};
