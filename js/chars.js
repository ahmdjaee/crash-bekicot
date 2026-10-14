/* Karakter bekicot: model prosedural detail + stat. Tetap offline (tanpa aset luar). */
(function(){
  function shellTexture(base, stripe){
    const c=document.createElement('canvas'); c.width=c.height=128;
    const g=c.getContext('2d');
    g.fillStyle=base; g.fillRect(0,0,128,128);
    g.fillStyle=stripe;
    for(let x=0;x<128;x+=32) g.fillRect(x,0,14,128);
    g.fillStyle='rgba(255,255,255,.25)';
    for(let y=8;y<128;y+=24) g.fillRect(0,y,128,4);
    const t=new THREE.CanvasTexture(c); t.anisotropy=4;
    return t;
  }

  BK.Characters = [
    { id:'turbo', name:'Turbo', icon:'🔥', desc:'Seimbang • rekomendasi pemula',
      body:0x7CFC00, head:0x8be02a, shellBase:'#d23c2e', shellStripe:'#ffd23f',
      board:0x8a5a2a, flame:0x33aaff, boostCol:0x66ccff, scale:1,
      stat:{topMul:1, accelMul:1, turnMul:1, chargeMul:1, wallMul:1, spinMul:1},
      bars:{SPD:3,ACC:3,DRF:3} },
    { id:'besi', name:'Cangkang Besi', icon:'🛡️', desc:'Tank • tahan dinding & misil, akselerasi berat',
      body:0x6fae6f, head:0x7fbf7f, shellBase:'#5a6472', shellStripe:'#2e3540',
      board:0x4a4a52, flame:0xff9f1c, boostCol:0xffb04a, scale:1.12, spikes:true,
      stat:{topMul:1.02, accelMul:0.8, turnMul:0.92, chargeMul:0.9, wallMul:0.45, spinMul:0.6},
      bars:{SPD:3,ACC:2,DRF:2} },
    { id:'hantu', name:'Siput Hantu', icon:'👻', desc:'Lincah • drift & charge cepat, ringkih',
      body:0xb47aff, head:0xc49aff, shellBase:'#6a3fb5', shellStripe:'#d9b8ff',
      board:0x3a2a5a, flame:0xc26bff, boostCol:0xc26bff, scale:0.96, ghost:true,
      stat:{topMul:0.95, accelMul:1.06, turnMul:1.16, chargeMul:1.28, wallMul:1.35, spinMul:1.25},
      bars:{SPD:2,ACC:4,DRF:5} },
    { id:'juara', name:'Juara', icon:'👑', desc:'Kunci Bos • cepat di semua lini', locked:true,
      body:0xffd23f, head:0xffe97a, shellBase:'#b8860b', shellStripe:'#fff2b0',
      board:0x3a3a3a, flame:0xffd23f, boostCol:0xffd23f, scale:1.05,
      stat:{topMul:1.04, accelMul:1.0, turnMul:1.02, chargeMul:1.1, wallMul:0.9, spinMul:0.9},
      bars:{SPD:5,ACC:3,DRF:4} }
  ];
  BK.charById = id => BK.Characters.find(c=>c.id===id) || BK.Characters[0];

  function lam(color, extra){
    return new THREE.MeshLambertMaterial(Object.assign({color}, extra||{}));
  }
  // tapak ban chevron (tekstur kanvas sekali-buat, biar putaran terlihat)
  let _tread=null;
  function treadTex(){
    if(_tread) return _tread;
    const c=document.createElement('canvas'); c.width=128; c.height=32;
    const g=c.getContext('2d');
    g.fillStyle='#232327'; g.fillRect(0,0,128,32);
    g.strokeStyle='#0c0c0e'; g.lineWidth=6; g.lineCap='round';
    for(let i=0;i<9;i++){
      const x=i*16;
      g.beginPath(); g.moveTo(x-6,4); g.lineTo(x+6,16); g.lineTo(x-6,28); g.stroke();
    }
    _tread=new THREE.CanvasTexture(c);
    _tread.wrapS=_tread.wrapT=THREE.RepeatWrapping; _tread.repeat.set(3,1);
    return _tread;
  }

  BK.buildSnail = function(char){
    const g = new THREE.Group();
    const ghost = !!char.ghost;
    const gh = ghost ? {transparent:true, opacity:0.85} : {};
    const refs = {wheels:[], eyes:[], stalks:[]};

    // sasis kart ala CTR: hidung + bumper + side-pod + knalpot + jok + spoiler
    const kartM = lam(char.board, gh);
    const darkM = lam(0x23232c, gh);
    const accentM = lam(char.flame, gh);
    const metalM = lam(0x3a3f4a, gh);
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.7,0.3,2.6), kartM);
    chassis.position.y=0.5; g.add(chassis);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.62,1.3,4), accentM);
    nose.rotation.x=Math.PI/2; nose.rotation.y=Math.PI/4; nose.scale.set(1,1,0.55);
    nose.position.set(0,0.5,1.85); g.add(nose);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.32,0.04,2.3), accentM);
    stripe.position.set(0,0.66,0.3); g.add(stripe);
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.0,0.24,0.3), darkM);
    bumper.position.set(0,0.34,2.25); g.add(bumper);
    [-1,1].forEach(s=>{
      const pod=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.36,0.9), accentM);
      pod.position.set(s*1.0,0.5,0.05); g.add(pod);
    });
    const exR = char.spikes?1.35:1;
    [-1,1].forEach(s=>{
      const ex=new THREE.Mesh(new THREE.CylinderGeometry(0.16*exR,0.18*exR,0.9,9), metalM);
      ex.rotation.x=Math.PI/2; ex.position.set(s*0.55,0.55,-1.85); g.add(ex);
      const tip=new THREE.Mesh(new THREE.CylinderGeometry(0.11*exR,0.11*exR,0.12,9),
        new THREE.MeshBasicMaterial({color:char.flame}));
      tip.rotation.x=Math.PI/2; tip.position.set(s*0.55,0.55,-2.32); g.add(tip);
    });
    const seat=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.42,0.7), darkM);
    seat.position.set(0,0.82,-0.95); g.add(seat);
    const seatBack=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.7,0.22), darkM);
    seatBack.position.set(0,1.1,-1.28); seatBack.rotation.x=-0.18; g.add(seatBack);
    const col=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.6,6), metalM);
    col.position.set(0,0.95,0.55); col.rotation.x=0.5; g.add(col);
    const swheel=new THREE.Mesh(new THREE.TorusGeometry(0.22,0.06,7,14), darkM);
    swheel.position.set(0,1.12,0.72); g.add(swheel);
    [-1,1].forEach(s=>{
      const fin=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.55,0.7), accentM);
      fin.position.set(s*0.85,1.1,-1.95); g.add(fin);
    });
    const wing=new THREE.Mesh(new THREE.BoxGeometry(1.9,0.12,0.5), darkM);
    wing.position.set(0,1.38,-1.95); g.add(wing);
    // badan bekicot (kaki)
    const bodyMat = lam(char.body, gh);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.8,14,12), bodyMat);
    body.scale.set(0.85,0.62,1.7); body.position.set(0,0.85,-0.25); g.add(body);
    refs.body=body;
    // kepala
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55,14,12), lam(char.head, gh));
    head.position.set(0,1.15,1.2); g.add(head);
    refs.head=head;
    // tangkai mata + mata besar
    [-1,1].forEach(s=>{
      const stalk=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.09,0.85,7), lam(char.head, gh));
      stalk.position.set(s*0.22,1.75,1.28); stalk.rotation.x=0.15; g.add(stalk);
      refs.stalks.push(stalk);
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.23,12,10),
        new THREE.MeshBasicMaterial({color:0xffffff}));
      eye.position.set(s*0.22,2.2,1.3); g.add(eye);
      refs.eyes.push(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.1,8,8),
        new THREE.MeshBasicMaterial({color:0x141414}));
      pupil.position.set(s*0.22,2.2,1.5); g.add(pupil);
    });
    // mulut senyum (torus pipih)
    const smile=new THREE.Mesh(new THREE.TorusGeometry(0.18,0.045,6,12,Math.PI),
      new THREE.MeshBasicMaterial({color:0x2a4a12}));
    smile.position.set(0,1.0,1.72); smile.rotation.z=Math.PI;
    g.add(smile);

    // cangkang spiral: kubah lathe + cincin + pola cat
    const shellMat = new THREE.MeshLambertMaterial(
      Object.assign({map:shellTexture(char.shellBase,char.shellStripe)}, gh));
    const prof=[[0.06,0],[0.62,0.04],[0.8,0.22],[0.72,0.5],[0.48,0.74],[0.2,0.88],[0.02,0.92]]
      .map(p=>new THREE.Vector2(p[0],p[1]));
    const shell=new THREE.Mesh(new THREE.LatheGeometry(prof,18), shellMat);
    shell.position.set(0,1.15,-0.85); shell.rotation.x=-0.4; g.add(shell);
    refs.shell=shell;
    [0.62,0.4].forEach((r,k)=>{
      const ring=new THREE.Mesh(new THREE.TorusGeometry(r,0.075,7,20), lam(char.shellBase==='#5a6472'||char.shellBase==='#6a3fb5'?0x333333:0x7a1f16, gh));
      ring.position.set(0,1.5-k*0.28,-1.0+k*0.12); ring.rotation.x=Math.PI/2-0.4;
      g.add(ring);
    });
    if(char.spikes){ // duri tank
      for(let k=0;k<7;k++){
        const a=k/7*Math.PI*2;
        const sp=new THREE.Mesh(new THREE.ConeGeometry(0.16,0.55,6), lam(0x2e3540));
        sp.position.set(Math.cos(a)*0.62, 1.75, -0.85+Math.sin(a)*0.62);
        sp.rotation.set(Math.sin(a)*0.9, 0, -Math.cos(a)*0.9);
        g.add(sp);
      }
    }
    if(ghost){ // aura hantu
      const aura=new THREE.Mesh(new THREE.SphereGeometry(1.5,12,10),
        new THREE.MeshBasicMaterial({color:0x8a4dff,transparent:true,opacity:0.07}));
      aura.position.set(0,1.3,-0.2); aura.scale.set(0.95,1.0,1.3); g.add(aura);
    }

    // roda belang: pivot belok terpisah dari spin (pola raycast-vehicle/turbo-kart)
    // belakang besar, depan kecil + velg + jari-jari yang ikut berputar (ban opaque)
    const wm=new THREE.MeshLambertMaterial({color:0x1a1a1a,map:treadTex()});
    const hubM=new THREE.MeshBasicMaterial({color:char.flame});
    [[-1.05,1.05,0.36],[1.05,1.05,0.36],[-1.05,-1.05,0.5],[1.05,-1.05,0.5]].forEach(([x,z,r],i)=>{
      const pivot=new THREE.Group(); pivot.position.set(x,r,z); g.add(pivot);
      const spin=new THREE.Group(); pivot.add(spin);
      const w=new THREE.Mesh(new THREE.CylinderGeometry(r,r,0.36,12),wm); w.rotation.z=Math.PI/2;
      spin.add(w);
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(r*0.4,r*0.4,0.38,8),hubM);
      hub.rotation.z=Math.PI/2; spin.add(hub);
      const spoke=new THREE.Mesh(new THREE.BoxGeometry(0.4,r*1.1,0.1),hubM);
      spin.add(spoke);
      refs.wheels.push({pivot,spin,front:i<2});
    });
    // api boost (dari tengah knalpot ganda)
    const flame=new THREE.Mesh(new THREE.ConeGeometry(0.5,1.6,8),
      new THREE.MeshBasicMaterial({color:char.flame,transparent:true,opacity:0}));
    flame.position.set(0,0.55,-2.5); flame.rotation.x=-Math.PI/2; g.add(flame);
    refs.flame=flame;
    // perisai
    const shield=new THREE.Mesh(new THREE.SphereGeometry(2.1,12,10),
      new THREE.MeshBasicMaterial({color:0x33ccff,transparent:true,opacity:0}));
    shield.position.y=1; g.add(shield);
    refs.shield=shield;

    g.scale.setScalar(char.scale||1);
    Object.assign(g.userData, refs);
    return g;
  };

  // ganti createKart bawaan: pakai karakter
  BK.createKart = function(scene, charId, isPlayer){
    const char = (typeof charId==='string') ? BK.charById(charId) : BK.Characters[0];
    const mesh = BK.buildSnail(char);
    scene.add(mesh);
    const C = BK.Config;
    return {
      mesh, char, stat:char.stat, isPlayer:!!isPlayer,
      baseScale:char.scale||1, blinkT:2+Math.random()*3,
      pos:new THREE.Vector3(), heading:0, speed:0,
      driftOffset:0, drifting:false, driftDir:0, charge:0, chargeLv:0,
      boostTime:0, boostPower:0, spinTime:0, shieldTime:0,
      hopT:0, item:null, lap:1, halfPassed:false,
      lastIdx:0, lateral:0, progress:0, totalLaps:C.laps,
      finishTime:null, place:0, hitWall:0, padCd:0,
      wheelSpin:0, stopped:true, seed:Math.random()
    };
  };
})();
