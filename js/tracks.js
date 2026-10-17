/* Track data: control points (x,z), width, theme. Centerline di-sample CatmullRom di world.js */
(function(){
  BK.Tracks = [
    {
      id: 'pantai', name: 'Pantai Bekicot', icon: '🏖️', desc: '',
      width: 22, sky: 0x87ceeb, fog: 0x87ceeb, ground: 0xE8D8A0, road: 0x5a5f6e, grass: 0x7ec850,
      dust: 0xE6D199, top: 0x3f8fd1, horizon: 0xcfeef7,
      pads: [0.22, 0.62], boxes: [0.08,0.2,0.33,0.46,0.58,0.71,0.84,0.94],
      pts: [[0,-90,0],[70,-80,1.5],[110,-40,3],[105,20,4],[60,55,2.5],[10,45,1],[-40,60,2],[-90,40,3],[-110,-20,1.5],[-70,-70,0.5]]
    },
    {
      id: 'hutan', name: 'Rimba Jamur', icon: '🍄', desc: '',
      width: 20, sky: 0x68b89e, fog: 0x7ec4a4, ground: 0x5c4630, road: 0x9c7e58, grass: 0x4b873b,
      dust: 0xc2a378, top: 0x2b7578, horizon: 0xd8f2c9,
      pads: [0.18, 0.50, 0.80], boxes: [0.06,0.16,0.28,0.40,0.54,0.66,0.78,0.90],
      pts: [[0,-95,0.5],[68,-85,2],[112,-35,6],[108,30,9],[72,82,6.5],[18,108,4],[-45,112,6],[-98,80,8],[-82,28,4.5],[-25,35,2.5],[25,15,1.5],[-20,-28,1.0],[-88,-25,2.0],[-105,-68,1.2],[-55,-92,0.5]]
    },
    {
      id: 'kawah', name: 'Kawah Panas', icon: '🌋', desc: '',
      width: 18, sky: 0x2b1a3a, fog: 0x3a2040, ground: 0x4a3040, road: 0x4a4a55, grass: 0x6b3a2a,
      dust: 0x6a6a6a, top: 0x120a24, horizon: 0xff7a3a,
      pads: [0.18, 0.55], boxes: [0.06,0.18,0.3,0.42,0.54,0.66,0.78,0.9],
      pts: [[0,-90,0],[56,-84,2],[96,-45,5.5],[78,0,8.5],[100,40,6.5],[56,68,2.5],[12,45,0.5],[-34,68,3.5],[-78,45,6],[-68,0,2.5],[-100,-34,1],[-50,-62,0]]
    },
    {
      id: 'salju', name: 'Puncak Salju', icon: '❄️', desc: '',
      width: 19, sky: 0xbfe3f5, fog: 0xcfe8f8, ground: 0xe8f0fa, road: 0x565b68, grass: 0xd8e6f5,
      dust: 0xffffff, top: 0x6fb3e0, horizon: 0xe8f4ff,
      pads: [0.15, 0.7], ice: [0.42, 0.52], boxes: [0.06,0.18,0.3,0.42,0.54,0.66,0.78,0.9],
      pts: [[0,-90,0],[56,-84,3],[96,-45,7],[78,0,11],[100,40,14],[56,68,10],[12,45,6],[-34,68,4],[-78,45,2],[-68,0,0],[-100,-34,1],[-50,-62,0]]
    }
  ];
})();
