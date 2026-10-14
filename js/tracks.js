/* Track data: control points (x,z), width, theme. Centerline di-sample CatmullRom di world.js */
(function(){
  BK.Tracks = [
    {
      id: 'pantai', name: 'Pantai Bekicot', icon: '🏖️', desc: 'Oval cepat • pemanasan drift',
      width: 16, sky: 0x87ceeb, fog: 0x87ceeb, ground: 0xE8D8A0, road: 0x5a5f6e, grass: 0x7ec850,
      dust: 0xE6D199, top: 0x3f8fd1, horizon: 0xcfeef7,
      pads: [0.22, 0.62], boxes: [0.08,0.2,0.33,0.46,0.58,0.71,0.84,0.94],
      pts: [[0,-90,0],[70,-80,1.5],[110,-40,3],[105,20,4],[60,55,2.5],[10,45,1],[-40,60,2],[-90,40,3],[-110,-20,1.5],[-70,-70,0.5]]
    },
    {
      id: 'hutan', name: 'Hutan Lendir', icon: '🌿', desc: 'S-curve + hairpin • teknik',
      width: 13, sky: 0x9fd8a0, fog: 0xa8d8a8, ground: 0x3f7d3a, road: 0x555a66, grass: 0x4da34d,
      dust: 0x8fae5f, top: 0x4d9e6b, horizon: 0xd8f0c8,
      pads: [0.3, 0.75], boxes: [0.05,0.16,0.28,0.4,0.52,0.64,0.76,0.88],
      pts: [[0,-100],[60,-90],[100,-50],[80,-10],[30,-20],[-10,10],[-60,5],[-80,50],[-30,80],[30,70],[70,95],[110,60],[90,110],[20,120],[-60,110],[-110,80]]
    },
    {
      id: 'kawah', name: 'Kawah Panas', icon: '🌋', desc: 'Sempit & berapi • chaos item',
      width: 11, sky: 0x2b1a3a, fog: 0x3a2040, ground: 0x4a3040, road: 0x4a4a55, grass: 0x6b3a2a,
      dust: 0x6a6a6a, top: 0x120a24, horizon: 0xff7a3a,
      pads: [0.18, 0.55], boxes: [0.06,0.18,0.3,0.42,0.54,0.66,0.78,0.9],
      pts: [[0,-80],[50,-75],[85,-40],[70,0],[90,35],[50,60],[10,40],[-30,60],[-70,40],[-60,0],[-90,-30],[-45,-55]]
    },
    {
      id: 'salju', name: 'Puncak Salju', icon: '❄️', desc: 'Naik-turun • es licin',
      width: 13, sky: 0xbfe3f5, fog: 0xcfe8f8, ground: 0xe8f0fa, road: 0x565b68, grass: 0xd8e6f5,
      dust: 0xffffff, top: 0x6fb3e0, horizon: 0xe8f4ff,
      pads: [0.15, 0.7], ice: [0.42, 0.52], boxes: [0.06,0.18,0.3,0.42,0.54,0.66,0.78,0.9],
      pts: [[0,-80,0],[50,-75,3],[85,-40,7],[70,0,11],[90,35,14],[50,60,10],[10,40,6],[-30,60,4],[-70,40,2],[-60,0,0],[-90,-30,1],[-45,-55,0]]
    }
  ];
})();
