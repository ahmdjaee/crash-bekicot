/* Global config - Crash Bekicot */
window.BK = window.BK || {};
BK.Config = {
  laps: 3,
  samples: 220,          // centerline resolution
  wallBounce: 0.45,
  difficulties: {
    easy:   { aiTop: 26, aiAccel: 20, rubber: 4.5, missileChance: 0.1, errMul: 1.6, name: 'Santai' },
    normal: { aiTop: 30, aiAccel: 24, rubber: 6.5, missileChance: 0.25, errMul: 1.0, name: 'Seru' },
    hard:   { aiTop: 33, aiAccel: 27, rubber: 8.5, missileChance: 0.4, errMul: 0.4, name: 'Ngamuk' }
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
  effects: 1.0, // knob peredam GUNCANGAN LAYAR (0 = mati total)
};
