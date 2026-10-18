/* Global config - Crash Bekicot */
window.BK = window.BK || {};
BK.Config = {
  laps: 3,
  samples: 220,          // centerline resolution
  wallBounce: 0.45,
  difficulties: {
    easy:   { aiTop: 32.5, aiAccel: 27, rubber: 7.8,  missileChance: 0.35, errMul: 0.70, aggrMul: 1.0,  name: 'Santai' },
    normal: { aiTop: 34.5, aiAccel: 31, rubber: 10.0, missileChance: 0.55, errMul: 0.20, aggrMul: 1.35, name: 'Seru' },
    hard:   { aiTop: 36.5, aiAccel: 35, rubber: 12.5, missileChance: 0.75, errMul: 0.0,  aggrMul: 1.75, name: 'Ngamuk' }
  },
  player: { topSpeed: 34, accel: 30, brake: 42, grip: 8.5, turn: 2.1, offroadMul: 0.55 },
  drift: {
    minSpeed: 14,
    turnMul: 1.75,
    gripDrift: 2.2,
    chargeT1: 0.7,   // biru
    chargeT2: 1.5,   // oranye
    chargeT3: 2.4,   // ungu (sacred)
    boostT1: 0.7,
    boostT2: 1.2,
    boostT3: 1.9,
    boostPower: 22
  },
  items: { boxRespawn: 5, missileSpeed: 46, spinTime: 1.25 },
  smoke: 1.0, // knob intensitas ASAP JALAN (0 = mati, 1 = normal)
  effects: 1.0, // ini knob peredam GUNCANGAN LAYAR (0 = mati total)
  // katup MODE OPEN-WORLD (hub pulau): false = fitur disetel mati sementara —
  // tombol/kunci pintas disembunyikan dari UI, seluruh kode dipertahankan untuk pengembangan ulang.
  // Setel true untuk menghidupkan lagi kapan pun.
  openworld: false,
};
