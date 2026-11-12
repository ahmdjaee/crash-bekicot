/* Global config - Crash Bekicot */
window.BK = window.BK || {};
BK.Config = {
  laps: 4, // lap trek ini pendek (±15-25 dtk): 4 putaran = balapan sekitar 1 menit
  samples: 220,          // centerline resolution
  wallBounce: 0.45,
  difficulties: {
    // patokan: pemain top 36. Rubber = kejaran maksimal saat AI tertinggal jauh (dibagi 3 tingkat di ai.js)
    easy:   { aiTop: 33.0, aiAccel: 27, rubber: 3.0, missileChance: 0.35, errMul: 0.70, aggrMul: 1.0,  boostMul: 0.35, name: 'Santai' },
    normal: { aiTop: 36.0, aiAccel: 31, rubber: 4.0, missileChance: 0.55, errMul: 0.20, aggrMul: 1.35, boostMul: 0.45, name: 'Seru' },
    hard:   { aiTop: 38.0, aiAccel: 35, rubber: 5.5, missileChance: 0.75, errMul: 0.0,  aggrMul: 1.75, boostMul: 0.55, name: 'Ngamuk' }
  },
  player: { topSpeed: 36, accel: 30, brake: 42, grip: 8.5, turn: 2.5, offroadMul: 0.55 },
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
    boostPower: 14
  },
  items: { boxRespawn: 5, missileSpeed: 46, spinTime: 1.25 },
  smoke: 1.0, // knob intensitas ASAP JALAN (0 = mati, 1 = normal)
  effects: 1.0, // ini knob peredam GUNCANGAN LAYAR (0 = mati total)
  // katup MODE OPEN-WORLD (hub pulau): pulau cerita aktif.
  // Setel false kalau perlu kembali ke alur menu/balapan saja.
  openworld: true,
};
