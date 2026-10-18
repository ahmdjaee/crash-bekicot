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
      body:0xb9aef5, head:0xcfc6fb, shellBase:'#4a3a80', shellStripe:'#c9b8ff',
      board:0x2a2338, flame:0xc26bff, boostCol:0xc26bff, scale:0.96, ghost:true,
      stat:{topMul:0.95, accelMul:1.06, turnMul:1.16, chargeMul:1.28, wallMul:1.35, spinMul:1.25},
      bars:{SPD:2,ACC:4,DRF:5} },
    { id:'balnok', name:'Balnok', icon:'🏁', desc:'Kart balap klasik • top speed & grip terbaik', locked:true, rig:'kart',
      unlockDesc:'Selesaikan 🏝️ Pantai (map 1) untuk membuka',
      body:0xece7db, head:0xf2ede1, shellBase:'#c8352c', shellStripe:'#f4efe4',
      board:0xb9b4a8, flame:0x2f8fe8, boostCol:0x8fd0ff, scale:1.6,
      stat:{topMul:1.05, accelMul:1.0, turnMul:1.03, chargeMul:1.0, wallMul:0.95, spinMul:0.95},
      bars:{SPD:4,ACC:3,DRF:3} },
    { id:'krambil', name:'Krambil', icon:'🥥', desc:'Buggy rimba • gigit aspal & lampor tanjakan', locked:true, rig:'buggy',
      unlockDesc:'Selesaikan ❄️ Puncak Salju (map 3) untuk membuka',
      body:0xdcb87f, head:0xe8d9b5, shellBase:'#7a5230', shellStripe:'#3f7a3e',
      board:0x9c7a4a, flame:0x39c48f, boostCol:0x7ce8c0, scale:1.55,
      stat:{topMul:0.99, accelMul:1.10, turnMul:1.02, chargeMul:1.18, wallMul:0.7, spinMul:1.0},
      bars:{SPD:3,ACC:4,DRF:3} },
    { id:'juara', name:'Juara', icon:'👑', desc:'Kart Juara • cepat di semua lini', locked:true, rig:'juara',
      unlockDesc:'Selesaikan 🌋 Kawah Panas (map terakhir) untuk membuka',
      body:0xffd23f, head:0xffe97a, shellBase:'#b8860b', shellStripe:'#fff2b0',
      board:0x3a3a3a, flame:0xffd23f, boostCol:0xffd23f, scale:1.5,
      stat:{topMul:1.04, accelMul:1.0, turnMul:1.02, chargeMul:1.1, wallMul:0.9, spinMul:0.9},
      bars:{SPD:5,ACC:3,DRF:4} }
  ];
  BK.charById = id => BK.Characters.find(c=>c.id===id) || BK.Characters[0];
  BK.charOpen = c => !c.locked || BK.Save.charOpen(c.id);

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
    const gh = {}; // TANPA transparansi menyeluruh: dulu bikin wajah saling tembus (seperti bug)
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
        new THREE.MeshBasicMaterial({color:ghost?0x301a4a:0x141414}));
      pupil.position.set(s*0.22,2.2,1.5); g.add(pupil);
    });
    // mulut senyum (torus pipih) — hantu diberi senyum ungu, yang lain hijau daun
    const smile=new THREE.Mesh(new THREE.TorusGeometry(0.18,0.045,6,12,Math.PI),
      new THREE.MeshBasicMaterial({color:ghost?0x4a3a80:0x2a4a12}));
    smile.position.set(0,1.0,1.72); smile.rotation.z=Math.PI;
    g.add(smile);

    // cangkang spiral: kubah lathe + cincin + pola cat
    const shellMat = ghost
      ? new THREE.MeshPhongMaterial({map:shellTexture(char.shellBase,char.shellStripe),transparent:true,opacity:0.85,
          depthWrite:false,side:THREE.FrontSide,shininess:90,specular:0x9a7aff,emissive:0x241640})
      : new THREE.MeshLambertMaterial({map:shellTexture(char.shellBase,char.shellStripe)});
    const prof=[[0.06,0],[0.62,0.04],[0.8,0.22],[0.72,0.5],[0.48,0.74],[0.2,0.88],[0.02,0.92]]
      .map(p=>new THREE.Vector2(p[0],p[1]));
    const shell=new THREE.Mesh(new THREE.LatheGeometry(prof,18), shellMat);
    shell.position.set(0,1.15,-0.85); shell.rotation.x=-0.4; g.add(shell);
    refs.shell=shell;
    [0.62,0.4].forEach((r,k)=>{
      const ring=new THREE.Mesh(new THREE.TorusGeometry(r,0.075,7,20), lam(char.spikes?0x333333:(ghost?0x9d7bff:0x7a1f16)));
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
    if(ghost){ // aura hantu: glow additive berlapis (tidak mengaburkan — depthWrite off)
      const glowMat=(o)=>new THREE.MeshBasicMaterial({color:0x8a4dff,transparent:true,opacity:o,
        blending:THREE.AdditiveBlending,depthWrite:false});
      const aura1=new THREE.Mesh(new THREE.SphereGeometry(1.55,14,12),glowMat(0.12));
      aura1.position.set(0,1.25,-0.3); aura1.scale.set(0.9,0.92,1.25); g.add(aura1);
      const aura2=new THREE.Mesh(new THREE.SphereGeometry(2.0,14,12),glowMat(0.055));
      aura2.position.set(0,1.25,-0.3); aura2.scale.set(0.9,0.92,1.3); g.add(aura2);
      // (ekor wisp dihapus — Fase 16: di preview katalog terbaca seperti asap di antara knalpot)
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
      new THREE.MeshBasicMaterial({color:char.flame,transparent:true,opacity:0,depthWrite:false}));
    flame.position.set(0,0.55,-2.5); flame.rotation.x=-Math.PI/2; g.add(flame);
    refs.flame=flame;
    // perisai
    const shield=new THREE.Mesh(new THREE.SphereGeometry(2.1,12,10),
      new THREE.MeshBasicMaterial({color:0x33ccff,transparent:true,opacity:0,depthWrite:false}));
    shield.position.y=1; g.add(shield);
    refs.shield=shield;

    g.scale.setScalar(char.scale||1);
    g.rotation.order='YXZ';
    Object.assign(g.userData, refs);
    return g;
  };

  // ===== Balnok: "CTR Go-Kart" smooth/aero upgrade =====
  // Asal: kode user createInteractiveCTRGoKart() (stylized biru-emas, knalpot raksasa, api boost).
  // Upgrade visual mulus: lathe + taper vertex (kapsul nose), rBoxGeo (rounded box),
  // CatmullRomCurve3+TubeGeometry (gold roll-cage), LatheGeometry (knalpot belled, ban membulat),
  // ExtrudeGeometry star 5 palang + rim deep-dish. Adaptasi untuk file:// tanpa npm:
  // three-subdivide/three-bvh-csg digantikan teknik vanilla berasal-tetes yang setara visual.
  const _tex={};
  function stripeTexH(){ // striping helm: doble merah di dasar putih
    if(_tex.helm) return _tex.helm;
    const S=256, c=document.createElement('canvas'); c.width=S; c.height=S;
    const g=c.getContext('2d');
    g.fillStyle='#f4f1ea'; g.fillRect(0,0,S,S);
    g.fillStyle='#d43a30'; g.fillRect(0,S*0.42,S,26); g.fillRect(0,S*0.54,S,26);
    g.fillStyle='#20304e'; g.fillRect(0,0,S,18);
    for(let i=0;i<300;i++){
      g.fillStyle='rgba(0,0,0,'+(Math.random()*0.05)+')';
      g.fillRect(Math.random()*S,Math.random()*S,2,2);
    }
    const t=new THREE.CanvasTexture(c); t.anisotropy=8;
    return _tex.helm=t;
  }
  function shellTexH(base,stripe){ // cangkang pembalap HD
    if(_tex['sh'+base]) return _tex['sh'+base];
    const S=512, c=document.createElement('canvas'); c.width=S; c.height=S;
    const g=c.getContext('2d');
    g.fillStyle=base; g.fillRect(0,0,S,S);
    g.fillStyle=stripe;
    for(let x=0;x<S;x+=128) g.fillRect(x,0,52,S);
    g.strokeStyle='rgba(0,0,0,0.28)'; g.lineWidth=5;
    for(let r=40;r<S;r+=64){ g.beginPath(); g.arc(S*0.62,S*0.40,r,0.4,3.6); g.stroke(); }
    for(let i=0;i<240;i++){
      g.fillStyle='rgba(255,255,255,'+(Math.random()*0.16)+')';
      g.fillRect(Math.random()*S,Math.random()*S,1+Math.random()*3,1+Math.random()*3);
    }
    g.fillStyle='rgba(0,0,0,0.14)'; g.fillRect(0,S-90,S,90);
    const t=new THREE.CanvasTexture(c); t.anisotropy=8;
    return _tex['sh'+base]=t;
  }
  // RoundedBoxGeometry vanilla: rounded-rect shape + bevel 2 sisi → semua tepi membulat
  function rBoxGeo(w,h,d,r,seg){
    seg=seg||4;
    const wx=w/2-r, hy=h/2-r, dep=d-2*r;
    const sh2=new THREE.Shape();
    sh2.moveTo(-wx,-hy);
    sh2.lineTo(wx,-hy);
    sh2.absarc(wx,-hy,r,-Math.PI/2,0,false);
    sh2.lineTo(wx,hy);
    sh2.absarc(wx,hy,r,0,Math.PI/2,false);
    sh2.lineTo(-wx,hy);
    sh2.absarc(-wx,hy,r,Math.PI/2,Math.PI,false);
    sh2.lineTo(-wx,-hy);
    sh2.absarc(-wx,-hy,r,Math.PI,Math.PI*1.5,false);
    const geo=new THREE.ExtrudeGeometry(sh2,{depth:dep,bevelEnabled:true,bevelThickness:r,bevelSize:Math.max(0.001,r-0.001),bevelSegments:seg,curveSegments:seg*3});
    geo.translate(0,0,-(dep/2));
    return geo;
  }

  // Factory bersama: semburan api boost (Balnok & rig-rig baru yang memakai knalpot).
  // Partikel kecil & pendek (anti-pusing); warna kuning->oranye->abu asap; tanpa `new` per frame.
  BK._sparkFX = function(kartGroup, exhausts, count, opts){
    count=count||40;
    opts=opts||{};
    const sb=opts.speedBase==null?2.6:opts.speedBase;
    const sr=opts.speedRand==null?2.0:opts.speedRand;
    const geo=new THREE.SphereGeometry(0.06,4,4);
    const parts=[];
    for(let i=0;i<count;i++){
      const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xffffaa,transparent:true,opacity:0.85,depthWrite:false}));
      m.visible=false; kartGroup.add(m);
      parts.push({mesh:m,life:0,maxLife:0,speed:new THREE.Vector3()});
    }
    exhausts.forEach(ex=>{ // sumbu pipa lokal: arah semburan ikut kemiringan knalpot
      ex.userData.axis=new THREE.Vector3(0,1,0).applyQuaternion(ex.quaternion);
    });
    const _c1=new THREE.Color(0xffffaa), _c2=new THREE.Color(0xff5500), _c3=new THREE.Color(0x333333);
    const _ct=new THREE.Color(), _sp=new THREE.Vector3(), _jit=new THREE.Vector3();
    let lastSpawn=0;
    return {
      particles:parts,
      update:function(time,dt,boosting){
        if(boosting && time-lastSpawn>0.02){
          lastSpawn=time;
          const p=parts.find(q=>!q.mesh.visible);
          if(p){
            const ex=exhausts[Math.floor(Math.random()*exhausts.length)];
            ex.getWorldPosition(_sp);
            kartGroup.worldToLocal(_sp); // dunia -> lokal kart (presisi saat bergerak/berputar)
            p.mesh.position.copy(_sp);
            p.mesh.position.z-=0.06;
            p.mesh.visible=true;
            p.life=0;
            p.maxLife=0.2+Math.random()*0.25;
            _jit.set((Math.random()-0.5)*0.5,(Math.random()-0.2)*0.4,0);
            p.speed.copy(ex.userData.axis).multiplyScalar(sb+Math.random()*sr).add(_jit);
          }
        }
        parts.forEach(p=>{
          if(p.mesh.visible){
            p.life+=dt;
            const tt=p.life/p.maxLife;
            if(p.life>=p.maxLife){ p.mesh.visible=false; }
            else{
              if(tt<0.45)_ct.copy(_c1).lerp(_c2,tt/0.45);
              else _ct.copy(_c2).lerp(_c3,(tt-0.45)/0.55);
              p.mesh.material.color.copy(_ct);
              if(tt>0.7)p.mesh.material.opacity=0.85*(1-(tt-0.7)/0.3);
              p.mesh.position.addScaledVector(p.speed,dt);
              const sc=Math.max(0.2,1.0-tt*0.85);
              p.mesh.scale.set(sc,sc,sc);
            }
          }
        });
      }
    };
  };

  BK.buildKart = function(char){
    const kartGroup=new THREE.Group();
    const refs={wheels:[],eyes:[],stalks:[]};

    // 1. MATERIAL (stylized penuh warna)
    const bodyMat = new THREE.MeshStandardMaterial({color:0x1a8cff,roughness:0.2,metalness:0.1});
    const goldPipesMat = new THREE.MeshStandardMaterial({color:0xffaa00,roughness:0.3,metalness:0.85});
    const darkMetalMat = new THREE.MeshStandardMaterial({color:0x222222,roughness:0.5,metalness:0.6});
    const chromeMat = new THREE.MeshPhongMaterial({color:0xe8ecf1,shininess:90,specular:0xffffff}); // krom jernih dgn cahaya matahari scene
    const leatherMat = new THREE.MeshStandardMaterial({color:0x2b1d16,roughness:0.7,metalness:0.0});
    const tireMat = new THREE.MeshStandardMaterial({color:0x1c1c1c,roughness:0.85,metalness:0.0});
    const rimMat = new THREE.MeshStandardMaterial({color:0xffbb00,roughness:0.4,metalness:0.6});

    // 2. CHASSIS & BODI (rounded + nose kapsul aero + sidepod ergonomis)
    const chassisGeo=rBoxGeo(1.2,0.18,2.0,0.05,4);
    const chassis=new THREE.Mesh(chassisGeo,darkMetalMat); chassis.position.y=0.35;
    kartGroup.add(chassis);
    // nose: lathe kapsul + taper vertex (menyempit & meruncing ke bawah — tanpa box mentah)
    const noseProf=[[0.05,0],[0.30,0.05],[0.385,0.16],[0.40,0.34],[0.345,0.52],[0.245,0.66],[0.115,0.76],[0.0,0.80]]
      .map(pt=>new THREE.Vector2(pt[0],pt[1]));
    const noseGeo=new THREE.LatheGeometry(noseProf,24);
    noseGeo.rotateX(Math.PI/2); // sumbu lathe +Y -> +Z (ujung ke depan)
    { // taper vertex: pipih samping ke moncong + turun (drop)
      const pos=noseGeo.attributes.position, n=pos.count;
      for(let i=0;i<n;i++){
        const z=pos.getZ(i), t=Math.min(1,Math.max(0,(z-(-0.10))/0.90));
        pos.setX(i,pos.getX(i)*(1-0.30*t*t));
        pos.setY(i,pos.getY(i)-0.10*t*t);
      }
      noseGeo.computeVertexNormals();
    }
    const nose=new THREE.Mesh(noseGeo,bodyMat);
    nose.scale.set(1,0.55,1); nose.position.set(0,0.56,0.42); nose.rotation.x=0.25;
    kartGroup.add(nose);
    const podGeo=rBoxGeo(0.2,0.35,1.3,0.07,5);
    const leftPod=new THREE.Mesh(podGeo,bodyMat); leftPod.position.set(-0.6,0.45,-0.1);
    const rightPod=leftPod.clone(); rightPod.position.x=0.6;
    kartGroup.add(leftPod, rightPod);
    [-1,1].forEach(s=>{ // lingkaran silver kecil di sisi pod (detail desain)
      const dot=new THREE.Mesh(new THREE.CylinderGeometry(0.085,0.085,0.02,20),chromeMat);
      dot.rotation.z=Math.PI/2; dot.position.set(s*0.705,0.45,-0.16); kartGroup.add(dot);
      const dot2=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.02,16),goldPipesMat);
      dot2.rotation.z=Math.PI/2; dot2.position.set(s*0.705,0.45,0.18); kartGroup.add(dot2);
    });

    // 3. RANGKA PIPA EMAS (CatmullRomCurve3 + TubeGeometry — bumper ganda & sidebar roll-bar)
    const tube48=(pts,r)=>new THREE.Mesh(new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)),false,'catmullrom',0.35),48,r||0.045,16,false),goldPipesMat);
    // bumper ganda depan: dua busur melengkung naik mengikuti lekukan moncong
    kartGroup.add(tube48([[-0.62,0.26,1.08],[-0.30,0.46,1.26],[0,0.50,1.28],[0.30,0.46,1.26],[0.62,0.26,1.08]]));
    kartGroup.add(tube48([[-0.52,0.40,1.12],[-0.24,0.60,1.24],[0,0.63,1.25],[0.24,0.60,1.24],[0.52,0.40,1.12]]));
    // sidebar kiri: menyusuri tepi pod lalu naik jadi roll-bar di belakang kursi (mirror kanan)
    const sideL=[[-0.70,0.30,1.00],[-0.77,0.38,0.30],[-0.79,0.50,-0.45],[-0.72,0.82,-0.92],[-0.48,1.06,-1.12]];
    const sideR=sideL.map(p=>[-p[0],p[1],p[2]]);
    kartGroup.add(tube48(sideL),tube48(sideR));

    // 4. KURSI KULIT + MESIN BERSIRIP
    const seatBase=new THREE.Mesh(rBoxGeo(0.7,0.15,0.6,0.06,4),leatherMat);
    seatBase.position.set(0,0.45,-0.1);
    const seatBack=new THREE.Mesh(rBoxGeo(0.7,0.7,0.15,0.06,4),leatherMat);
    seatBack.position.set(0,0.78,-0.38); seatBack.rotation.x=-0.2;
    kartGroup.add(seatBase,seatBack);
    [-1,1].forEach(s=>{ // bantalan bahu menyempit ke atas (menempel sandaran)
      const bol=new THREE.Mesh(rBoxGeo(0.13,0.36,0.14,0.05,4),leatherMat);
      bol.position.set(s*0.33,0.96,-0.44); bol.rotation.z=-s*0.30; bol.rotation.x=-0.2;
      kartGroup.add(bol);
    });
    const engineBox=new THREE.Mesh(rBoxGeo(0.6,0.5,0.5,0.055,4),darkMetalMat);
    engineBox.position.set(0,0.6,-0.75); kartGroup.add(engineBox);
    for(let k=0;k<3;k++){ // sirip pendingin
      const fin=new THREE.Mesh(rBoxGeo(0.66,0.025,0.44,0.01,2),darkMetalMat);
      fin.position.set(0,0.78+k*0.07,-0.75); kartGroup.add(fin);
    }
    const airFilter=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.15,0.16,16),darkMetalMat); // filter udara
    airFilter.position.set(0,0.95,-0.7); kartGroup.add(airFilter);
    const airRing=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.03,16),goldPipesMat);
    airRing.position.set(0,1.02,-0.7); kartGroup.add(airRing);

    // 5. PEDAL & KEMUDI
    const pedalGeo=rBoxGeo(0.12,0.2,0.05,0.02,3);
    const leftPedal=new THREE.Mesh(pedalGeo,darkMetalMat);
    leftPedal.position.set(-0.25,0.5,0.55); leftPedal.rotation.x=-0.4;
    const rightPedal=leftPedal.clone(); rightPedal.position.x=0.25;
    kartGroup.add(leftPedal, rightPedal);
    const steeringShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.6,8), darkMetalMat);
    steeringShaft.position.set(0,0.7,0.4); steeringShaft.rotation.x=-0.6;
    const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(0.16,0.04,8,16), leatherMat);
    steeringWheel.position.set(0,0.88,0.23); steeringWheel.rotation.x=-0.6;
    kartGroup.add(steeringShaft, steeringWheel);

    // 6. KNALPOT KEMBAR BELL-LATHE + rongga hitam
    const exhaustProf=[[0.055,0],[0.06,0.14],[0.068,0.34],[0.075,0.50],[0.095,0.62],[0.125,0.70],[0.142,0.73],[0.128,0.735],[0.10,0.70]]
      .map(pt=>new THREE.Vector2(pt[0],pt[1])); // bibir tebal + cekung ke dalam
    function makeExhaust(sx){
      const m=new THREE.Mesh(new THREE.LatheGeometry(exhaustProf,18),chromeMat);
      m.position.set(sx,0.9,-0.9); m.rotation.set(-0.5,0,sx>0?-0.1:0.1);
      const hole=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.10,0.02,16),
        new THREE.MeshStandardMaterial({color:0x0a0a0a,roughness:1}));
      // rongga hitam duduk di bibir ujung (pangkal pipa = Y+ lathe)
      hole.position.y=0.725;
      m.add(hole);
      // sumbu pipa lokal (0,1,0) dirotasi mesh → arah semburan atas-belakang
      m.userData.axis=new THREE.Vector3(0,1,0).applyQuaternion(m.quaternion);
      return m;
    }
    const pipeGroup=new THREE.Group();
    const leftExhaust=makeExhaust(-0.25), rightExhaust=makeExhaust(0.25);
    pipeGroup.add(leftExhaust,rightExhaust);
    kartGroup.add(pipeGroup);

    // 7. BAN & VELG: ban lathe membulat + alur, velg deep-dish lathe, bintang 5 palang extrude
    const _wg={};
    function wheelParts(r,w){
      const key=r+'|'+w;
      if(_wg[key]) return _wg[key];
      // ban: profil bahu membulat (lathe), sumbu Y → X
      const tirePts=[
        [r*0.52,-w/2],[r-0.09,-w/2],[r-0.03,-w/2+0.055],[r,-w/2+0.15],
        [r,w/2-0.15],[r-0.03,w/2-0.055],[r-0.09,w/2],[r*0.52,w/2],[r*0.52,-w/2]
      ].map(pt=>new THREE.Vector2(pt[0],pt[1]));
      const tireGeo=new THREE.LatheGeometry(tirePts,26); tireGeo.rotateZ(Math.PI/2);
      // velg deep-dish: mangkuk terbuka keluar (profil lip luar → mangkuk ke dalam),
      // dua salinan cermin → kedua muka roda ber-dish
      const lipOut=w*0.40, bowlIn=w*0.26;
      const rimPtsL=[
        [r*0.93,lipOut],[r*0.88,lipOut+0.01],[r*0.80,lipOut*0.86],[r*0.62,bowlIn+0.02],[r*0.30,bowlIn],[r*0.10,bowlIn]
      ].map(pt=>new THREE.Vector2(pt[0],pt[1]));
      const rimGeoL=new THREE.LatheGeometry(rimPtsL,20); rimGeoL.rotateZ(Math.PI/2); // opens -X
      // profil cermin untuk muka +X (winding baik, bukan refleksi)
      const rimPtsR=[
        [r*0.93,-lipOut],[r*0.88,-(lipOut+0.01)],[r*0.80,-lipOut*0.86],[r*0.62,-(bowlIn+0.02)],[r*0.30,-bowlIn],[r*0.10,-bowlIn]
      ].map(pt=>new THREE.Vector2(pt[0],pt[1]));
      const rimGeoR2=new THREE.LatheGeometry(rimPtsR,20); rimGeoR2.rotateZ(Math.PI/2); // opens +X
      // bintang 5 palang (extrude), bidang roda = YZ; cermin via rotasi (bukan refleksi)
      const star=new THREE.Shape();
      const oR=r*0.46, iR=r*0.24;
      for(let k=0;k<10;k++){
        const ang=Math.PI/2+k*Math.PI/5, rr=(k%2?iR:oR);
        const x=Math.cos(ang)*rr, y=Math.sin(ang)*rr;
        if(k===0)star.moveTo(x,y); else star.lineTo(x,y);
      }
      star.closePath();
      const starGeoR=new THREE.ExtrudeGeometry(star,{depth:0.05,bevelEnabled:true,bevelThickness:0.01,bevelSize:0.01,bevelSegments:2});
      starGeoR.rotateY(Math.PI/2); // sumbu extrude → +X, bidang bintang di YZ
      const starGeoL=starGeoR.clone().rotateY(Math.PI); // cermin via rotasi murni (winding aman)
      const treadGeoG=new THREE.TorusGeometry(r*0.985,0.012,6,30);
      const treadGeoD=new THREE.TorusGeometry(r*0.985,0.008,6,30);
      const hubGeo=new THREE.CylinderGeometry(r*0.2,r*0.2,w*0.5,6);
      return _wg[key]={tireGeo,rimGeoL,rimGeoR2,starGeoR,starGeoL,treadGeoG,treadGeoD,hubGeo};
    }
    function createDetailedWheel(radius,width){
      const wheel=new THREE.Group();
      const g=wheelParts(radius,width);
      const tire=new THREE.Mesh(g.tireGeo,tireMat); tire.castShadow=true; wheel.add(tire);
      [-1,1].forEach(s=>{ // alur tapak halus di kedua bahu
        const t1=new THREE.Mesh(g.treadGeoG,darkMetalMat); t1.rotation.y=Math.PI/2; t1.position.x=s*width*0.22; wheel.add(t1);
        const t2=new THREE.Mesh(g.treadGeoD,tireMat); t2.rotation.y=Math.PI/2; t2.position.x=s*width*0.34; wheel.add(t2);
      });
      const rimL=new THREE.Mesh(g.rimGeoL,rimMat); rimL.material.side=THREE.DoubleSide;
      const rimR=new THREE.Mesh(g.rimGeoR2,rimMat); rimR.material.side=THREE.DoubleSide; // satu material, dua mesh
      const starR=new THREE.Mesh(g.starGeoR,rimMat); starR.material.side=THREE.DoubleSide;
      starR.position.x=width*0.30-0.05; // agak masuk mangkuk (deep dish)
      const starL=new THREE.Mesh(g.starGeoL,rimMat);
      starL.position.x=-(width*0.30-0.05);
      const hub=new THREE.Mesh(g.hubGeo,darkMetalMat); hub.rotation.z=Math.PI/2; wheel.add(hub);
      wheel.add(rimL,rimR,starR,starL,hub);
      return wheel;
    }
    const frontLeftPivot=new THREE.Group(); frontLeftPivot.position.set(-0.8,0.32,0.65);
    const flWheel=createDetailedWheel(0.3,0.28); frontLeftPivot.add(flWheel);
    const frontRightPivot=new THREE.Group(); frontRightPivot.position.set(0.8,0.32,0.65);
    const frWheel=createDetailedWheel(0.3,0.28); frontRightPivot.add(frWheel);
    const rlPivot=new THREE.Group(); rlPivot.position.set(-0.85,0.42,-0.7);
    const rlWheel=createDetailedWheel(0.42,0.40); rlPivot.add(rlWheel);
    const rrPivot=new THREE.Group(); rrPivot.position.set(0.85,0.42,-0.7);
    const rrWheel=createDetailedWheel(0.42,0.42); rrPivot.add(rrWheel);
    kartGroup.add(frontLeftPivot, frontRightPivot, rlPivot, rrPivot);
    refs.wheels=[
      {pivot:frontLeftPivot, spin:flWheel, front:true},
      {pivot:frontRightPivot, spin:frWheel, front:true},
      {pivot:rlPivot, spin:rlWheel, front:false},
      {pivot:rrPivot, spin:rrWheel, front:false}
    ];

    // pembalap bekicot (helm + mata kedip) — dna kart tetap satu identitas Balnok
    const bodyM=new THREE.MeshPhongMaterial({color:char.body,shininess:26,specular:0x333333});
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.30,18,14), bodyM);
    body.scale.set(0.95,0.8,1.25); body.position.set(0,0.72,-0.14); kartGroup.add(body);
    refs.body=body;
    const shell=new THREE.Mesh(new THREE.LatheGeometry(
      [[0,0],[0.5,0.03],[0.66,0.2],[0.6,0.45],[0.42,0.68],[0.18,0.82],[0.02,0.86]].map(p=>new THREE.Vector2(...p)),26),
      new THREE.MeshPhongMaterial({map:shellTexH(char.shellBase,char.shellStripe),shininess:70,specular:0x777777}));
    shell.scale.setScalar(0.55); shell.position.set(0,0.86,-0.42); shell.rotation.x=-0.5;
    kartGroup.add(shell); refs.shell=shell;
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.24,18,14), new THREE.MeshPhongMaterial({color:char.head,shininess:26,specular:0x333333}));
    head.position.set(0,1.0,0.05); kartGroup.add(head); refs.head=head;
    const helm=new THREE.Mesh(new THREE.SphereGeometry(0.29,20,16), new THREE.MeshPhongMaterial({map:stripeTexH(),shininess:120,specular:0xbbbbbb}));
    helm.position.set(0,1.03,0.04); kartGroup.add(helm);
    const visor=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.18,0.2), new THREE.MeshPhongMaterial({color:0x16283c,shininess:120,specular:0x9db4cc}));
    visor.position.set(0,1.02,0.24); kartGroup.add(visor);
    [-1,1].forEach(s=>{
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.075,10,8), new THREE.MeshBasicMaterial({color:0xffffff}));
      eye.position.set(s*0.09,0.95,0.3); kartGroup.add(eye); refs.eyes.push(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.032,7,7), new THREE.MeshBasicMaterial({color:0x141414}));
      pupil.position.set(s*0.09,0.95,0.355); kartGroup.add(pupil);
    });
    [-1,1].forEach(s=>{
      const stalk=new THREE.Mesh(new THREE.CylinderGeometry(0.026,0.034,0.15,8), new THREE.MeshPhongMaterial({color:char.head,shininess:26,specular:0x333333}));
      stalk.position.set(s*0.09,1.16,-0.20); stalk.rotation.x=0.35; stalk.visible=false;
      kartGroup.add(stalk); refs.stalks.push(stalk);
    });

    // perisai item (kontrak rig)
    const shield=new THREE.Mesh(new THREE.SphereGeometry(1.7,14,12),
      new THREE.MeshBasicMaterial({color:0x33ccff,transparent:true,opacity:0,depthWrite:false}));
    shield.position.y=0.72; kartGroup.add(shield); refs.shield=shield;

    // 8. PARTIKEL API→ASAP — factory bersama BK._sparkFX (dipakai juga rig baru)
    const sparks=BK._sparkFX(kartGroup,[leftExhaust,rightExhaust]);
    const fireParticles=sparks.particles;
    let lastSpawn=0;
    kartGroup.userData={pivots:[frontLeftPivot,frontRightPivot],exhausts:[leftExhaust,rightExhaust],particles:fireParticles,lastSpawn:0};

    // KART UPDATE — signature asli dipertahankan: (speed, steerInput, isBoosting, time, deltaTime)
    kartGroup.update=function(speed, steerInput, isBoosting, time, deltaTime){
      const dt=deltaTime;
      // setir kosmetik mengikuti kemudi (roda dijalankan fisika game — anti dobel-animasi)
      const targetSteer=steerInput*0.45;
      steeringWheel.rotation.y=THREE.MathUtils.lerp(steeringWheel.rotation.y,targetSteer*1.5,dt*8);
      // getaran halus knalpot & dengung idle mesin
      const shake=Math.sin(time*65)*0.015*(isBoosting?2.5:1.0);
      leftExhaust.position.y=0.9+shake;
      rightExhaust.position.y=0.9-shake;
      chassis.position.y=0.35+(Math.sin(time*15)*0.005);
      // semburan api boost (factory bersama)
      sparks.update(time,dt,isBoosting);
    };
    // jembatan fisika game → signature update asli (urutan diterjemahkan)
    kartGroup.userData.tick=function(time,dt,boosting,steerInput,speed){
      kartGroup.update(speed||0, steerInput||0, !!boosting, time, dt);
    };

    kartGroup.traverse(child=>{ if(child.isMesh){ child.castShadow=true; child.receiveShadow=true; } });

    kartGroup.scale.setScalar(char.scale||1); // WAJIB: skala dipasang di builder (menu/countdown/penduduk lain jalan tanpa fisika)
    kartGroup.rotation.order='YXZ';
    Object.assign(kartGroup.userData,refs);
    return kartGroup;
  };

  // ===== Juara: "Kart Juara" — kart emas raja HD (bentuk kunci-bos) =====
  // Satu keluarga teknik dengan Balnok/Krambil: rBoxGeo, lathe moncong + taper vertex,
  // CatmullRom+Tube (ark samping), ExtrudeGeometry bintang velg, kanvas prosedural, BK._sparkFX.
  BK.buildJuara = function(char){
    const kartGroup=new THREE.Group();
    const refs={wheels:[],eyes:[],stalks:[]};

    // 1. MATERIAL — emas memakai Phong (Standard metalness tinggi = hitam di bawah lampu game)
    const goldMat   = new THREE.MeshPhongMaterial({color:0xd7a41c,shininess:88,specular:0xffe9a0});
    const goldDeep  = new THREE.MeshPhongMaterial({color:0x9a7410,shininess:70,specular:0xffd97a});
    const velvetMat = new THREE.MeshStandardMaterial({color:0x8f1622,roughness:0.7,metalness:0.05});
    const creamMat  = new THREE.MeshPhongMaterial({color:0xf5eed9,shininess:30,specular:0x555555});
    const chromeMat = new THREE.MeshPhongMaterial({color:0xe8ecf1,shininess:95,specular:0xffffff});
    const darkMetal = new THREE.MeshStandardMaterial({color:0x232020,roughness:0.55,metalness:0.5});
    const tireMat   = new THREE.MeshStandardMaterial({color:0x1b1b1b,roughness:0.9});
    const rimMat    = new THREE.MeshPhongMaterial({color:0xe0b32e,shininess:80,specular:0xfff0b8});
    const pearlMat  = new THREE.MeshBasicMaterial({color:0xfff7e0});
    const rubyMat   = new THREE.MeshBasicMaterial({color:0xd02040});

    // 2. SISIS & BODI EMAS: dasar rendah + rok gelap + jok moncong lathe (taper ke bawah-depan)
    const chassis=new THREE.Mesh(rBoxGeo(1.2,0.16,2.0,0.05,4),goldMat); chassis.position.y=0.34; kartGroup.add(chassis);
    const skirt=new THREE.Mesh(rBoxGeo(1.0,0.10,1.7,0.04,3),darkMetal); skirt.position.y=0.26; kartGroup.add(skirt);
    const noseProf=[[0.05,0],[0.30,0.05],[0.385,0.16],[0.40,0.34],[0.345,0.52],[0.245,0.66],[0.115,0.76],[0.0,0.80]]
      .map(pt=>new THREE.Vector2(pt[0],pt[1]));
    const noseGeo=new THREE.LatheGeometry(noseProf,24); noseGeo.rotateX(Math.PI/2);
    { const pos=noseGeo.attributes.position, n=pos.count;
      for(let i=0;i<n;i++){ const z=pos.getZ(i), t=Math.min(1,Math.max(0,(z-(-0.10))/0.90));
        pos.setX(i,pos.getX(i)*(1-0.30*t*t)); pos.setY(i,pos.getY(i)-0.10*t*t); }
      noseGeo.computeVertexNormals(); }
    const nose=new THREE.Mesh(noseGeo,goldMat);
    nose.scale.set(1.05,0.5,1.05); nose.position.set(0,0.54,0.40); nose.rotation.x=0.22; kartGroup.add(nose);
    // penyerap (splitter) depan bertepi emas
    const splitter=new THREE.Mesh(rBoxGeo(0.92,0.05,0.46,0.02,3),darkMetal); splitter.position.set(0,0.30,1.06); kartGroup.add(splitter);
    const splitterLip=new THREE.Mesh(rBoxGeo(0.96,0.035,0.08,0.015,2),goldMat); splitterLip.position.set(0,0.315,1.28); kartGroup.add(splitterLip);

    // 3. MAHKOTA HIAS MONCONG (tanda kunci-bos): band + 5 duri + mutiara/rubi
    const orn=new THREE.Group(); orn.position.set(0,0.62,1.12); orn.rotation.x=0.22; kartGroup.add(orn);
    const ornBase=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.085,0.05,12),goldMat); ornBase.position.y=-0.03; orn.add(ornBase);
    const ornBand=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.055,0.05,12),goldDeep); ornBand.position.y=0.015; orn.add(ornBand);
    for(let k=0;k<5;k++){
      const mid=(k===2);
      const spike=new THREE.Mesh(new THREE.ConeGeometry(0.017,mid?0.105:0.075,6),goldMat);
      const a=(k-2)*0.42; spike.position.set(Math.sin(a)*0.048,0.028+(mid?0.028:0.012),Math.cos(a)*0.048);
      spike.rotation.z=-Math.sin(a)*0.55; spike.rotation.x=Math.cos(a)*0.30;
      orn.add(spike);
      const tip=new THREE.Mesh(new THREE.SphereGeometry(mid?0.016:0.011,8,6), mid?pearlMat:rubyMat);
      tip.position.set(Math.sin(a)*0.056, (mid?0.10:0.068)+0.012, Math.cos(a)*0.056); orn.add(tip);
    }

    // 4. POD SISI KREM + cincin laurel emas + rubi
    const podGeo=rBoxGeo(0.22,0.32,1.25,0.06,5);
    const leftPod=new THREE.Mesh(podGeo,creamMat); leftPod.position.set(-0.58,0.44,-0.05);
    const rightPod=leftPod.clone(); rightPod.position.x=0.58; kartGroup.add(leftPod,rightPod);
    [-1,1].forEach(sd=>{
      const ring=new THREE.Mesh(new THREE.TorusGeometry(0.10,0.016,7,20),goldMat);
      ring.rotation.y=Math.PI/2; ring.position.set(sd*0.70,0.46,0.02); kartGroup.add(ring);
      const gem=new THREE.Mesh(new THREE.SphereGeometry(0.028,8,6),rubyMat);
      gem.position.set(sd*0.72,0.46,0.02); kartGroup.add(gem);
    });

    // 5. ARK PELINDUNG EMAS (CatmullRom+Tube): memeluk tepi pod lalu naik ke belakang jok
    const tube48=(pts,r)=>new THREE.Mesh(new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)),false,'catmullrom',0.35),48,r||0.045,16,false),goldMat);
    const arcL=[[-0.66,0.30,1.02],[-0.73,0.40,0.30],[-0.75,0.52,-0.50],[-0.67,0.88,-0.96],[-0.40,1.16,-1.14]];
    const arcR=arcL.map(p=>[-p[0],p[1],p[2]]);
    kartGroup.add(tube48(arcL),tube48(arcR));

    // 6. JOK BELUDRU MERAH + pipa(perimeter) EMAS + sandaran kepala + bendera jeg
    const seatBase=new THREE.Mesh(rBoxGeo(0.7,0.15,0.6,0.06,4),velvetMat); seatBase.position.set(0,0.45,-0.10);
    const seatBack=new THREE.Mesh(rBoxGeo(0.7,0.7,0.15,0.06,4),velvetMat); seatBack.position.set(0,0.78,-0.38); seatBack.rotation.x=-0.2;
    const pipingL=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.72,8),goldMat);
    pipingL.rotation.x=-0.2; pipingL.position.set(-0.35,1.10,-0.40);
    const pipingR=pipingL.clone(); pipingR.position.x=0.35;
    const headrest=new THREE.Mesh(rBoxGeo(0.36,0.15,0.10,0.03,3),velvetMat); headrest.position.set(0,1.15,-0.46); headrest.rotation.x=-0.2;
    const banner=new THREE.Mesh(rBoxGeo(0.30,0.16,0.015,0.01,2),velvetMat); banner.position.set(0,1.15,-0.535); banner.rotation.x=-0.2;
    const bannerTrim=new THREE.Mesh(rBoxGeo(0.30,0.035,0.02,0.01,2),goldMat); bannerTrim.position.set(0,1.10,-0.54); bannerTrim.rotation.x=-0.2;
    kartGroup.add(seatBase,seatBack,pipingL,pipingR,headrest,banner,bannerTrim);

    // 7. KAP MESIN EMAS BERKIPAS + filter + penopang
    const engineBox=new THREE.Mesh(rBoxGeo(0.6,0.5,0.5,0.055,4),darkMetal); engineBox.position.set(0,0.6,-0.75); kartGroup.add(engineBox);
    for(let k=0;k<3;k++){ const fin=new THREE.Mesh(rBoxGeo(0.66,0.025,0.44,0.01,2),goldDeep);
      fin.position.set(0,0.78+k*0.07,-0.75); kartGroup.add(fin); }
    const airFilter=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.15,0.16,16),darkMetal); airFilter.position.set(0,0.95,-0.7); kartGroup.add(airFilter);
    const airRing=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.03,16),goldMat); airRing.position.set(0,1.02,-0.7); kartGroup.add(airRing);

    // 8. KNALPOT KEMBAR BELL-LATHE EMAS + rongga hitam
    const exhaustProf=[[0.055,0],[0.06,0.14],[0.068,0.34],[0.075,0.50],[0.095,0.62],[0.125,0.70],[0.142,0.73],[0.128,0.735],[0.10,0.70]]
      .map(pt=>new THREE.Vector2(pt[0],pt[1]));
    function makeExhaust(sx){
      const m=new THREE.Mesh(new THREE.LatheGeometry(exhaustProf,18),goldMat);
      m.position.set(sx,0.9,-0.9); m.rotation.set(-0.5,0,sx>0?-0.1:0.1);
      const hole=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.10,0.02,16),
        new THREE.MeshStandardMaterial({color:0x0a0a0a,roughness:1}));
      hole.position.y=0.725; m.add(hole);
      m.userData.axis=new THREE.Vector3(0,1,0).applyQuaternion(m.quaternion);
      return m;
    }
    const leftExhaust=makeExhaust(-0.25), rightExhaust=makeExhaust(0.25);
    kartGroup.add(leftExhaust,rightExhaust);

    // 9. SAYAP (SPOILER) EMAS + pelat ujung beludru + TROFI EMAS di tengah
    const wing=new THREE.Mesh(rBoxGeo(1.0,0.045,0.26,0.02,3),goldMat); wing.position.set(0,1.14,-1.00);
    const wingLip=new THREE.Mesh(rBoxGeo(1.0,0.03,0.05,0.01,2),goldDeep); wingLip.position.set(0,1.175,-1.11);
    kartGroup.add(wing,wingLip);
    [-1,1].forEach(sd=>{
      const endplate=new THREE.Mesh(rBoxGeo(0.05,0.16,0.26,0.02,3),velvetMat); endplate.position.set(sd*0.51,1.16,-1.00); kartGroup.add(endplate);
      const post=new THREE.Mesh(rBoxGeo(0.05,0.20,0.05,0.015,2),darkMetal); post.position.set(sd*0.28,0.99,-0.99); kartGroup.add(post);
    });
    const trophy=new THREE.Group(); trophy.position.set(0,1.165,-0.98); kartGroup.add(trophy);
    const tPlinth=new THREE.Mesh(rBoxGeo(0.15,0.045,0.15,0.012,2),goldDeep); tPlinth.position.y=0.02; trophy.add(tPlinth);
    const tCup=new THREE.Mesh(new THREE.LatheGeometry(
      [[0.012,0],[0.145,0.005],[0.172,0.075],[0.15,0.165],[0.085,0.235],[0.04,0.275],[0.0,0.30]].map(p=>new THREE.Vector2(...p)),16),goldMat);
    tCup.position.y=0.04; trophy.add(tCup);
    [-1,1].forEach(sd=>{
      const handle=new THREE.Mesh(new THREE.TorusGeometry(0.05,0.011,6,10,Math.PI),goldMat);
      handle.position.set(sd*0.175,0.21,0); handle.rotation.y=sd*Math.PI/2; handle.rotation.z=sd*0.25; trophy.add(handle);
    });
    const tBand=new THREE.Mesh(new THREE.TorusGeometry(0.168,0.012,6,18),velvetMat);
    tBand.rotation.x=Math.PI/2; tBand.position.y=0.115; trophy.add(tBand);

    // 10. KAACA ANGIN BENAR (point Flash: depthWrite far) depan dada pembalap
    const windArc=Math.PI*0.62;
    const windscreen=new THREE.Mesh(new THREE.CylinderGeometry(0.40,0.47,0.34,16,1,true,-windArc/2,windArc),
      new THREE.MeshPhongMaterial({color:0xd6e4ec,shininess:110,specular:0xbfd4e0,transparent:true,opacity:0.26,
        side:THREE.DoubleSide,depthWrite:false}));
    windscreen.position.set(0,0.88,0.30); kartGroup.add(windscreen);
    [-1,1].forEach(sd=>{
      const wpost=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.016,0.40,8),goldMat);
      wpost.position.set(sd*0.34,0.86,0.27); wpost.rotation.x=-0.10; kartGroup.add(wpost);
    });

    // 11. KEMUDI & PEDAL (kesaksian gaya kart)
    const pedalGeo=rBoxGeo(0.12,0.2,0.05,0.02,3);
    const leftPedal=new THREE.Mesh(pedalGeo,darkMetal); leftPedal.position.set(-0.25,0.5,0.55); leftPedal.rotation.x=-0.4;
    const rightPedal=leftPedal.clone(); rightPedal.position.x=0.25;
    kartGroup.add(leftPedal,rightPedal);
    const steeringShaft=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.6,8),darkMetal);
    steeringShaft.position.set(0,0.7,0.4); steeringShaft.rotation.x=-0.6;
    const steeringWheel=new THREE.Mesh(new THREE.TorusGeometry(0.16,0.045,8,18),velvetMat);
    steeringWheel.position.set(0,0.88,0.23); steeringWheel.rotation.x=-0.6;
    const wheelHubJ=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.04,10),goldMat);
    wheelHubJ.rotation.x=Math.PI/2-0.6; wheelHubJ.position.set(0,0.88,0.22); kartGroup.add(wheelHubJ);
    kartGroup.add(steeringShaft,steeringWheel);

    // 12. RODA: ban lathe bahu bulat + velg mangkuk dible + bintang 5 palang extrude + lis per batu
    const _jw={};
    function wheelParts(r,w){
      const key=r+'|'+w; if(_jw[key]) return _jw[key];
      const tirePts=[[r*0.52,-w/2],[r-0.09,-w/2],[r-0.03,-w/2+0.055],[r,-w/2+0.15],
        [r,w/2-0.15],[r-0.03,w/2-0.055],[r-0.09,w/2],[r*0.52,w/2],[r*0.52,-w/2]].map(pt=>new THREE.Vector2(pt[0],pt[1]));
      const tireGeo=new THREE.LatheGeometry(tirePts,26); tireGeo.rotateZ(Math.PI/2);
      const lipOut=w*0.40, bowlIn=w*0.26;
      const rimPtsL=[[r*0.93,lipOut],[r*0.88,lipOut+0.01],[r*0.80,lipOut*0.86],[r*0.62,bowlIn+0.02],[r*0.30,bowlIn],[r*0.10,bowlIn]]
        .map(pt=>new THREE.Vector2(pt[0],pt[1]));
      const rimGeoL=new THREE.LatheGeometry(rimPtsL,20); rimGeoL.rotateZ(Math.PI/2);
      const rimPtsR=[[r*0.93,-lipOut],[r*0.88,-(lipOut+0.01)],[r*0.80,-lipOut*0.86],[r*0.62,-(bowlIn+0.02)],[r*0.30,-bowlIn],[r*0.10,-bowlIn]]
        .map(pt=>new THREE.Vector2(pt[0],pt[1]));
      const rimGeoR2=new THREE.LatheGeometry(rimPtsR,20); rimGeoR2.rotateZ(Math.PI/2);
      const star=new THREE.Shape(); const oR=r*0.46,iR=r*0.24;
      for(let k=0;k<10;k++){ const ang=Math.PI/2+k*Math.PI/5, rr=(k%2?iR:oR);
        const x=Math.cos(ang)*rr, y=Math.sin(ang)*rr; if(k===0)star.moveTo(x,y); else star.lineTo(x,y); }
      star.closePath();
      const starGeoR=new THREE.ExtrudeGeometry(star,{depth:0.05,bevelEnabled:true,bevelThickness:0.01,bevelSize:0.01,bevelSegments:2});
      starGeoR.rotateY(Math.PI/2);
      const starGeoL=starGeoR.clone().rotateY(Math.PI);
      const treadGeoG=new THREE.TorusGeometry(r*0.985,0.012,6,30);
      const treadGeoD=new THREE.TorusGeometry(r*0.985,0.008,6,30);
      const hubGeo=new THREE.CylinderGeometry(r*0.2,r*0.2,w*0.5,6);
      const stripeGeo=new THREE.TorusGeometry(r*0.90,0.012,6,26); // lis merah pada bibir velg
      return _jw[key]={tireGeo,rimGeoL,rimGeoR2,starGeoR,starGeoL,treadGeoG,treadGeoD,hubGeo,stripeGeo};
    }
    function createRoyalWheel(radius,width){
      const wheel=new THREE.Group();
      const g=wheelParts(radius,width);
      const tire=new THREE.Mesh(g.tireGeo,tireMat); tire.castShadow=true; wheel.add(tire);
      [-1,1].forEach(sd=>{
        const t1=new THREE.Mesh(g.treadGeoG,darkMetal); t1.rotation.y=Math.PI/2; t1.position.x=sd*width*0.22; wheel.add(t1);
        const t2=new THREE.Mesh(g.treadGeoD,tireMat);    t2.rotation.y=Math.PI/2; t2.position.x=sd*width*0.34; wheel.add(t2);
        const stripe=new THREE.Mesh(g.stripeGeo,rubyMat); stripe.rotation.y=Math.PI/2; stripe.position.x=sd*width*0.30; wheel.add(stripe);
      });
      const rimL=new THREE.Mesh(g.rimGeoL,rimMat); rimL.material.side=THREE.DoubleSide;
      const rimR=new THREE.Mesh(g.rimGeoR2,rimMat); rimR.material.side=THREE.DoubleSide;
      const starR=new THREE.Mesh(g.starGeoR,rimMat); starR.material.side=THREE.DoubleSide; starR.position.x=width*0.30-0.05;
      const starL=new THREE.Mesh(g.starGeoL,rimMat); starL.position.x=-(width*0.30-0.05);
      const hub=new THREE.Mesh(g.hubGeo,darkMetal); hub.rotation.z=Math.PI/2;
      wheel.add(rimL,rimR,starR,starL,hub);
      const nutRing=new THREE.Mesh(new THREE.TorusGeometry(radius*0.12,0.010,6,18),goldDeep); // cincin mur bat dyn
      nutRing.rotation.y=Math.PI/2; wheel.add(nutRing);
      return wheel;
    }
    const frontLeftPivot=new THREE.Group(); frontLeftPivot.position.set(-0.80,0.32,0.65);
    const flWheel=createRoyalWheel(0.30,0.28); frontLeftPivot.add(flWheel);
    const frontRightPivot=new THREE.Group(); frontRightPivot.position.set(0.80,0.32,0.65);
    const frWheel=createRoyalWheel(0.30,0.28); frontRightPivot.add(frWheel);
    const rlPivot=new THREE.Group(); rlPivot.position.set(-0.85,0.42,-0.70);
    const rlWheel=createRoyalWheel(0.42,0.40); rlPivot.add(rlWheel);
    const rrPivot=new THREE.Group(); rrPivot.position.set(0.85,0.42,-0.70);
    const rrWheel=createRoyalWheel(0.42,0.42); rrPivot.add(rrWheel);
    kartGroup.add(frontLeftPivot,frontRightPivot,rlPivot,rrPivot);
    refs.wheels=[
      {pivot:frontLeftPivot, spin:flWheel, front:true},
      {pivot:frontRightPivot, spin:frWheel, front:true},
      {pivot:rlPivot, spin:rlWheel, front:false},
      {pivot:rrPivot, spin:rrWheel, front:false}
    ];

    // 13. PEMBALAP SIPUT JUARA: badan emas + cangkang gelap emas + helm + MAHKOTA
    const bodyM=new THREE.MeshPhongMaterial({color:char.body,shininess:26,specular:0x333333});
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.30,18,14),bodyM);
    body.scale.set(0.95,0.8,1.25); body.position.set(0,0.72,-0.14); kartGroup.add(body); refs.body=body;
    const shell=new THREE.Mesh(new THREE.LatheGeometry(
      [[0,0],[0.5,0.03],[0.66,0.2],[0.6,0.45],[0.42,0.68],[0.18,0.82],[0.02,0.86]].map(p=>new THREE.Vector2(...p)),26),
      new THREE.MeshPhongMaterial({map:shellTexH(char.shellBase,char.shellStripe),shininess:70,specular:0x777777}));
    shell.scale.setScalar(0.55); shell.position.set(0,0.86,-0.42); shell.rotation.x=-0.5; kartGroup.add(shell); refs.shell=shell;
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.24,18,14),bodyM);
    head.position.set(0,1.0,0.05); kartGroup.add(head); refs.head=head;
    const helm=new THREE.Mesh(new THREE.SphereGeometry(0.29,20,16),
      new THREE.MeshPhongMaterial({map:stripeTexH(),shininess:120,specular:0xbbbbbb}));
    helm.position.set(0,1.03,0.04); kartGroup.add(helm);
    const visor=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.18,0.2),
      new THREE.MeshPhongMaterial({color:0x2a1f28,shininess:120,specular:0x9db4cc}));
    visor.position.set(0,1.02,0.24); kartGroup.add(visor);
    [-1,1].forEach(sd=>{
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.075,10,8),new THREE.MeshBasicMaterial({color:0xffffff}));
      eye.position.set(sd*0.09,0.95,0.30); kartGroup.add(eye); refs.eyes.push(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.032,7,7),new THREE.MeshBasicMaterial({color:0x141414}));
      pupil.position.set(sd*0.09,0.95,0.355); kartGroup.add(pupil);
      const stalk=new THREE.Mesh(new THREE.CylinderGeometry(0.026,0.034,0.15,8),bodyM);
      stalk.position.set(sd*0.09,1.16,-0.20); stalk.rotation.x=0.35; stalk.visible=false;
      kartGroup.add(stalk); refs.stalks.push(stalk);
    });
    // mahkota kaca helm: band + 5 duri + permata
    const crown=new THREE.Group(); crown.position.set(0,1.29,0.02); kartGroup.add(crown);
    const cBand=new THREE.Mesh(new THREE.CylinderGeometry(0.125,0.135,0.05,14),goldMat); crown.add(cBand);
    for(let k=0;k<5;k++){
      const mid=(k===0||k===4);
      const a=-0.9+k*0.45;
      const spike=new THREE.Mesh(new THREE.ConeGeometry(0.014,mid?0.085:0.06,6),goldMat);
      spike.position.set(Math.sin(a)*0.108,0.055,Math.cos(a)*0.108);
      spike.rotation.z=-Math.sin(a)*0.40; spike.rotation.x=Math.cos(a)*0.35;
      crown.add(spike);
      const gem=new THREE.Mesh(new THREE.SphereGeometry(0.010,6,6), mid?pearlMat:rubyMat);
      gem.position.set(Math.sin(a)*0.118,0.10,Math.cos(a)*0.118); crown.add(gem);
    }

    // 14. perisai item (kontrak rig): depthWrite off (dibahahi Fase 13 — bola tak terlihat jangan menghalangi)
    const shield=new THREE.Mesh(new THREE.SphereGeometry(1.7,14,12),
      new THREE.MeshBasicMaterial({color:0x33ccff,transparent:true,opacity:0,depthWrite:false}));
    shield.position.y=0.72; kartGroup.add(shield); refs.shield=shield;

    // 15. SEMBURAN API BOOST — factory bersama
    const sparks=BK._sparkFX(kartGroup,[leftExhaust,rightExhaust]);
    kartGroup.userData={pivots:[frontLeftPivot,frontRightPivot],exhausts:[leftExhaust,rightExhaust],
      particles:sparks.particles,lastSpawn:0};

    // 16. UPDATE — signature keluarga kart: (speed, steerInput, isBoosting, time, deltaTime)
    kartGroup.update=function(speed,steerInput,isBoosting,time,deltaTime){
      const dt=deltaTime;
      const targetSteer=steerInput*0.45;
      steeringWheel.rotation.y=THREE.MathUtils.lerp(steeringWheel.rotation.y,targetSteer*1.5,dt*8);
      const shake=Math.sin(time*65)*0.015*(isBoosting?2.5:1.0);
      leftExhaust.position.y=0.9+shake; rightExhaust.position.y=0.9-shake;
      chassis.position.y=0.34+(Math.sin(time*15)*0.005);
      trophy.rotation.y=Math.sin(time*1.6)*0.18;            // trofi menyala gantung berayun pelan
      sparks.update(time,dt,isBoosting);
    };
    kartGroup.userData.tick=function(time,dt,boosting,steerInput,speed){
      kartGroup.update(speed||0, steerInput||0, !!boosting, time, dt);
    };

    kartGroup.traverse(child=>{ if(child.isMesh){ child.castShadow=true; child.receiveShadow=true; } });

    kartGroup.scale.setScalar(char.scale||1); // WAJIB: skala dipasang di builder (menu/countdown/raceSizes)
    kartGroup.rotation.order='YXZ';
    Object.assign(kartGroup.userData,refs);
    return kartGroup;
  };

  // ===== Krambil: "Buggy Rimba" — off-road garapan HD =====
  // Teknik setara Balnok: rBoxGeo (bevel), LatheGeometry (knalpot stack/velg dasa/roda rib),
  // CatmullRomCurve3+TubeGeometry (bumper & roll cage), kanvas ≤1px-512px, spark factory bersama.
  BK.buildBuggy = function(char){
    const g=new THREE.Group();
    const refs={wheels:[],eyes:[],stalks:[]};

    // material gaya rimba: jingga terbakar, rangka senjata gelap, aksen amber
    const orangeMat=new THREE.MeshStandardMaterial({color:0xd4622a,roughness:0.5,metalness:0.15});
    const gunMat=new THREE.MeshStandardMaterial({color:0x2c2f34,roughness:0.55,metalness:0.55});
    const steelMat=new THREE.MeshPhongMaterial({color:0xa7aeb8,shininess:55,specular:0x8fa0b0});
    const darkSteelMat=new THREE.MeshStandardMaterial({color:0x1f2226,roughness:0.6,metalness:0.5});
    const tanMat=new THREE.MeshStandardMaterial({color:0x8a6a48,roughness:0.75});
    const tireMatB=new THREE.MeshStandardMaterial({color:0x232323,roughness:0.9});
    const amberMat=new THREE.MeshBasicMaterial({color:0xffc23d});
    const chromeMat=new THREE.MeshPhongMaterial({color:0xe8ecf1,shininess:90,specular:0xffffff});
    const glassMat=new THREE.MeshPhongMaterial({color:0xbfdcff,shininess:100,specular:0x88aacc,transparent:true,opacity:0.3,side:THREE.DoubleSide,depthWrite:false});

    // 1. rangka rel + dasar lantai + pelindung bawah
    const railL=new THREE.Mesh(rBoxGeo(0.10,0.14,2.5,0.04,3),gunMat); railL.position.set(-0.40,0.32,-0.05);
    const railR=railL.clone(); railR.position.x=0.40;
    const floor=new THREE.Mesh(rBoxGeo(0.86,0.06,2.0,0.03,3),gunMat); floor.position.set(0,0.42,-0.02);
    const kick=new THREE.Mesh(rBoxGeo(0.98,0.05,0.4,0.04,3),darkSteelMat); kick.position.set(0,0.30,1.10);
    g.add(railL,railR,floor,kick);

    // 2. kap depan: cowl melengkung + dagu + grill LED
    const cowl=new THREE.Mesh(rBoxGeo(0.95,0.26,0.85,0.09,5),orangeMat); cowl.position.set(0,0.66,0.75); cowl.rotation.x=-0.12;
    const chin=new THREE.Mesh(rBoxGeo(1.0,0.16,0.3,0.06,4),orangeMat); chin.position.set(0,0.50,1.22); chin.rotation.x=0.22;
    const grille=new THREE.Mesh(rBoxGeo(0.62,0.16,0.08,0.02,3),darkSteelMat); grille.position.set(0,0.62,1.30);
    g.add(cowl,chin,grille);
    [0.58,0.66].forEach(sltY=>{ // dua langkah LED grill
      const slat=new THREE.Mesh(rBoxGeo(0.5,0.02,0.02,0.008,2),amberMat); slat.position.set(0,sltY,1.345); g.add(slat);
    });

    // 3. lamp bar depan: empat lampu lensa amber (tiang penopang)
    const lampBar=new THREE.Mesh(rBoxGeo(0.88,0.13,0.13,0.04,3),gunMat); lampBar.position.set(0,0.95,0.95); lampBar.rotation.x=-0.12;
    g.add(lampBar);
    [-0.30,0.30].forEach(sx=>{ const post=new THREE.Mesh(rBoxGeo(0.06,0.14,0.08,0.02,2),gunMat); post.position.set(sx,0.84,0.95); post.rotation.x=-0.12; g.add(post); });
    const lampGeo=new THREE.CylinderGeometry(0.05,0.05,0.06,10);
    [-0.42,-0.16,0.16,0.42].forEach(lx=>{
      const pod=new THREE.Mesh(lampGeo,gunMat); pod.rotation.x=Math.PI/2; pod.position.set(lx,0.94,1.01); g.add(pod);
      const lens=new THREE.Mesh(new THREE.CylinderGeometry(0.042,0.042,0.014,10),amberMat); lens.rotation.x=Math.PI/2; lens.position.set(lx,0.94,1.045); g.add(lens);
    });

    // 4. fender mudguard: cincin setengah-konsentris dgn roda (anti-tembus pasti).
    //    TorusGeometry busur atas, radius = radius ban + bibir tube, tepat di sumbu pivot roda:
    //    permukaan dalam selalu di LUAR ban, apapun arah putaran/kemudi.
    function guardGeo(R,tube,arc){
      const geo=new THREE.TorusGeometry(R,tube,10,30,arc);
      geo.rotateY(Math.PI/2);            // bidang cincin YZ (mengelilingi sumbu roda X)
      geo.rotateX((Math.PI-arc)/2);      // busur dipusatkan di mahkota (belakang-tengah-depan)
      return geo;
    }
    const guardFrontGeo=guardGeo(0.43,0.052,Math.PI*0.72); // dalam 0.378 > ban 0.33+simpul
    const guardRearGeo =guardGeo(0.62,0.070,Math.PI*0.76); // dalam 0.550 > ban 0.48, ruang kemudi
    const guardFrontTips=[[-0.371,0.187],[0.371,0.187]];   // [dz,dy] relatif pivot
    const guardRearTips =[[-0.541,0.231],[0.541,0.231]];
    function addGuards(px,py,pz,geo,tips){
      const m=new THREE.Mesh(geo,orangeMat); m.position.set(px,py,pz); g.add(m);
      tips.forEach(tp=>{ const c=new THREE.Mesh(new THREE.SphereGeometry(tp[1]>0.2?0.07:0.052,8,6),orangeMat);
        c.position.set(px,py+tp[1],pz+tp[0]); g.add(c); });
    }
    addGuards(-0.60,0.33,0.62,guardFrontGeo,guardFrontTips);
    addGuards( 0.60,0.33,0.62,guardFrontGeo,guardFrontTips);
    addGuards(-0.58,0.48,-0.66,guardRearGeo,guardRearTips);
    addGuards( 0.58,0.48,-0.66,guardRearGeo,guardRearTips);

    // 5. bumper tabung depan/belakang + pelindung bawah + tow ring (CatmullRom+Tube)
    const tubePts=(pts,r)=>new THREE.Mesh(new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)),false,'catmullrom',0.35),40,r,12,false),gunMat);
    g.add(tubePts([[-0.55,0.36,1.30],[0,0.42,1.36],[0.55,0.36,1.30]],0.035));
    g.add(tubePts([[-0.55,0.36,1.30],[-0.55,0.30,1.10]],0.03));
    g.add(tubePts([[0.55,0.36,1.30],[0.55,0.30,1.10]],0.03));
    g.add(tubePts([[-0.58,0.40,-1.22],[0,0.46,-1.26],[0.58,0.40,-1.22]],0.035));
    g.add(tubePts([[-0.50,0.40,-1.24],[-0.50,0.28,-1.24]],0.03));
    g.add(tubePts([[0.50,0.40,-1.24],[0.50,0.28,-1.24]],0.03));
    const skid=new THREE.Mesh(rBoxGeo(0.9,0.05,0.35,0.03,2),darkSteelMat); skid.position.set(0,0.34,1.06); skid.rotation.x=0.30; g.add(skid);
    const tow=new THREE.Mesh(new THREE.TorusGeometry(0.06,0.016,6,14),darkSteelMat); tow.position.set(0,0.36,-1.30); g.add(tow);

    // 6. dashboard + kaca angin genet + setir
    const dash=new THREE.Mesh(rBoxGeo(0.72,0.18,0.22,0.04,3),orangeMat); dash.position.set(0,0.74,0.34); dash.rotation.x=-0.2;
    const glass=new THREE.Mesh(rBoxGeo(0.70,0.40,0.03,0.015,2),glassMat); glass.position.set(0,0.96,0.30); glass.rotation.x=-0.52;
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.5,8),darkSteelMat); shaft.position.set(0,0.82,0.34); shaft.rotation.x=-0.6;
    const steeringWheel=new THREE.Mesh(new THREE.TorusGeometry(0.15,0.032,8,18),tanMat); steeringWheel.position.set(0,0.95,0.24); steeringWheel.rotation.x=-0.6;
    g.add(dash,glass,shaft,steeringWheel);

    // 7. jok + tali pengaman amber
    const seatB=new THREE.Mesh(rBoxGeo(0.56,0.14,0.46,0.06,4),tanMat); seatB.position.set(0,0.64,-0.20);
    const seatK=new THREE.Mesh(rBoxGeo(0.56,0.55,0.13,0.06,4),tanMat); seatK.position.set(0,0.92,-0.46); seatK.rotation.x=-0.18;
    g.add(seatB,seatK);
    const strapMat=new THREE.MeshStandardMaterial({color:0xd8981f,roughness:0.7});
    [-0.14,0.14].forEach(sx=>{ const strap=new THREE.Mesh(rBoxGeo(0.06,0.42,0.02,0.01,2),strapMat); strap.position.set(sx,1.02,-0.50); strap.rotation.x=-0.18; g.add(strap); });

    // 8. roll cage belakang + balok silang + bracing
    g.add(tubePts([[-0.42,0.36,0.14],[-0.44,0.70,0.10],[-0.52,0.95,-0.20],[-0.46,1.18,-0.48]],0.045));
    g.add(tubePts([[0.42,0.36,0.14],[0.44,0.70,0.10],[0.52,0.95,-0.20],[0.46,1.18,-0.48]],0.045));
    g.add(tubePts([[-0.46,1.18,-0.48],[0,1.22,-0.52],[0.46,1.18,-0.48]],0.045));

    // 9. mesin + sirip pendingin + stack knalpot kembar LatheGeometry (bibir berkalung + rongga hitam)
    const engine=new THREE.Mesh(rBoxGeo(0.48,0.40,0.36,0.05,4),gunMat); engine.position.set(0,0.80,-0.86);
    g.add(engine);
    [0.94,1.00,1.06].forEach(ey=>{ const fin=new THREE.Mesh(rBoxGeo(0.54,0.02,0.32,0.01,2),gunMat); fin.position.set(0,ey,-0.86); g.add(fin); });
    const carb=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.12,0.12,10),darkSteelMat); carb.position.set(0,1.12,-0.82); g.add(carb);
    const stackProf=[[0.05,0],[0.055,0.10],[0.06,0.30],[0.075,0.50],[0.085,0.52],[0.10,0.54],[0.08,0.545]]
      .map(pt=>new THREE.Vector2(pt[0],pt[1]));
    const stackGeo=new THREE.LatheGeometry(stackProf,16);
    function makeStack(sx){
      const m=new THREE.Mesh(stackGeo,chromeMat);
      m.position.set(sx,0.90,-0.84); m.rotation.x=-0.35;
      const bead=new THREE.Mesh(new THREE.TorusGeometry(0.078,0.01,6,16),chromeMat); bead.position.y=0.30; bead.rotation.x=Math.PI/2; m.add(bead);
      const hole=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.02,12),new THREE.MeshStandardMaterial({color:0x0a0a0a,roughness:1})); hole.position.y=0.542; m.add(hole);
      return m;
    }
    const leftStack=makeStack(-0.17), rightStack=makeStack(0.17);
    g.add(leftStack,rightStack);

    // 10. ban cadangan di punggung + tali
    const plate=new THREE.Mesh(rBoxGeo(0.44,0.40,0.06,0.03,3),gunMat); plate.position.set(0,0.80,-1.12); plate.rotation.x=0.10; g.add(plate);
    const spare=new THREE.Mesh(new THREE.TorusGeometry(0.15,0.085,8,18),tireMatB); spare.position.set(0,0.82,-1.17); g.add(spare);
    const spareRim=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.05,10),steelMat); spareRim.position.set(0,0.82,-1.21); spareRim.rotation.x=Math.PI/2; g.add(spareRim);
    const spareStrap=new THREE.Mesh(rBoxGeo(0.36,0.05,0.02,0.01,2),strapMat); spareStrap.position.set(0,0.94,-1.13); spareStrap.rotation.x=0.10; g.add(spareStrap);

    // 11. roda off-road: ban rib Lathe + velg dasa 6 palang + beadlock amber
    const _wb={};
    function wheelBuggyParts(r,w){
      const key=r+'|'+w;
      if(_wb[key])return _wb[key];
      const pts=[[r*0.5,-w/2],[r-0.10,-w/2+0.02]];
      for(let k=0;k<8;k++){ // rib gerigi melingkar roda
        const y=-w/2+0.10+k*(w-0.22)/7;
        pts.push([k%2?r:r-0.024,y]);
      }
      pts.push([r-0.04,w/2-0.03],[r-0.10,w/2],[r*0.5,w/2],[r*0.5,-w/2]);
      const tireGeo=new THREE.LatheGeometry(pts.map(pt=>new THREE.Vector2(pt[0],pt[1])),26); tireGeo.rotateZ(Math.PI/2);
      // velg dasa baja: mangkuk dua muka (profil cermin)
      const lip=w*0.38, bowl=w*0.24;
      const rpL=[[r*0.92,lip],[r*0.86,lip+0.01],[r*0.72,bowl+0.03],[r*0.40,bowl],[r*0.14,bowl]].map(pt=>new THREE.Vector2(pt[0],pt[1]));
      const rimGeoL=new THREE.LatheGeometry(rpL,20); rimGeoL.rotateZ(Math.PI/2);
      const rpR=[[r*0.92,-lip],[r*0.86,-(lip+0.01)],[r*0.72,-(bowl+0.03)],[r*0.40,-bowl],[r*0.14,-bowl]].map(pt=>new THREE.Vector2(pt[0],pt[1]));
      const rimGeoR=new THREE.LatheGeometry(rpR,20); rimGeoR.rotateZ(Math.PI/2);
      const star=new THREE.Shape(); const oR=r*0.44, iR=r*0.20;
      for(let k=0;k<12;k++){ // 6 palang
        const ang=Math.PI/2+k*Math.PI/6, rr=(k%2?iR:oR);
        const x=Math.cos(ang)*rr, y=Math.sin(ang)*rr;
        if(k===0)star.moveTo(x,y); else star.lineTo(x,y);
      }
      star.closePath();
      const starGeoR=new THREE.ExtrudeGeometry(star,{depth:0.045,bevelEnabled:true,bevelThickness:0.01,bevelSize:0.01,bevelSegments:2});
      starGeoR.rotateY(Math.PI/2);
      const starGeoL=starGeoR.clone().rotateY(Math.PI);
      const beadGeoL=new THREE.TorusGeometry(r*0.80,0.013,6,22); beadGeoL.rotateY(Math.PI/2); beadGeoL.translate(-(w*0.38-0.02),0,0);
      const beadGeoR=beadGeoL.clone().rotateY(Math.PI);
      const hubGeo=new THREE.CylinderGeometry(r*0.18,r*0.18,w*0.5,6);
      return _wb[key]={tireGeo,rimGeoL,rimGeoR,starGeoL,starGeoR,beadGeoL,beadGeoR,hubGeo};
    }
    function createWheelBuggy(radius,width,){
      const wheel=new THREE.Group();
      const gp=wheelBuggyParts(radius,width);
      const tire=new THREE.Mesh(gp.tireGeo,tireMatB); wheel.add(tire);
      const rimL=new THREE.Mesh(gp.rimGeoL,steelMat); rimL.material=steelMat.clone(); rimL.material.side=THREE.DoubleSide;
      const rimR=new THREE.Mesh(gp.rimGeoR,rimL.material); wheel.add(rimL,rimR);
      const starL=new THREE.Mesh(gp.starGeoL,rimL.material); starL.position.x=-(width*0.30-0.045);
      const starR=new THREE.Mesh(gp.starGeoR,rimL.material); starR.position.x=(width*0.30-0.045);
      wheel.add(starL,starR);
      const bL=new THREE.Mesh(gp.beadGeoL,amberMat), bR=new THREE.Mesh(gp.beadGeoR,amberMat); wheel.add(bL,bR);
      const hub=new THREE.Mesh(gp.hubGeo,darkSteelMat); hub.rotation.z=Math.PI/2; wheel.add(hub);
      return wheel;
    }
    const flPivot=new THREE.Group(); flPivot.position.set(-0.60,0.33,0.62);
    const flWheel=createWheelBuggy(0.33,0.28); flPivot.add(flWheel);
    const frPivot=new THREE.Group(); frPivot.position.set(0.60,0.33,0.62);
    const frWheel=createWheelBuggy(0.33,0.28); frPivot.add(frWheel);
    const rlPivot=new THREE.Group(); rlPivot.position.set(-0.58,0.48,-0.66);
    const rlWheel=createWheelBuggy(0.48,0.44); rlPivot.add(rlWheel);
    const rrPivot=new THREE.Group(); rrPivot.position.set(0.58,0.48,-0.66);
    const rrWheel=createWheelBuggy(0.48,0.44); rrPivot.add(rrWheel);
    g.add(flPivot,frPivot,rlPivot,rrPivot);
    refs.wheels=[
      {pivot:flPivot,spin:flWheel,front:true},
      {pivot:frPivot,spin:frWheel,front:true},
      {pivot:rlPivot,spin:rlWheel,front:false},
      {pivot:rrPivot,spin:rrWheel,front:false}
    ];

    // 12. suspensi shock 4 aksen jingga (depan jangan menabrak fender)
    const shockMat=new THREE.MeshStandardMaterial({color:0xd9622a,roughness:0.45,metalness:0.4});
    [-1,1].forEach(s=>{
      const shF=new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.032,0.36,8),shockMat);
      shF.position.set(s*0.54,0.46,0.50); shF.rotation.z=-s*0.35; g.add(shF);
      const shR=new THREE.Mesh(new THREE.CylinderGeometry(0.036,0.036,0.40,8),shockMat);
      shR.position.set(s*0.56,0.58,-0.48); shR.rotation.z=-s*0.38; g.add(shR);
    });

    // 13. pembalap bekicot (cangkang kelapa, helm double strip)
    const bodyM=new THREE.MeshPhongMaterial({color:char.body,shininess:26,specular:0x333333});
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.30,18,14),bodyM);
    body.scale.set(0.95,0.8,1.25); body.position.set(0,0.88,-0.14); g.add(body); refs.body=body;
    const shell=new THREE.Mesh(new THREE.LatheGeometry(
      [[0,0],[0.5,0.03],[0.66,0.2],[0.6,0.45],[0.42,0.68],[0.18,0.82],[0.02,0.86]].map(p=>new THREE.Vector2(...p)),26),
      new THREE.MeshPhongMaterial({map:shellTexH(char.shellBase,char.shellStripe),shininess:70,specular:0x777777}));
    shell.scale.setScalar(0.46); shell.position.set(0,0.96,-0.38); shell.rotation.x=-0.5;
    g.add(shell); refs.shell=shell;
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.24,18,14),new THREE.MeshPhongMaterial({color:char.head,shininess:26,specular:0x333333}));
    head.position.set(0,1.05,0.04); g.add(head); refs.head=head;
    const helm=new THREE.Mesh(new THREE.SphereGeometry(0.29,20,16),new THREE.MeshPhongMaterial({map:stripeTexH(),shininess:120,specular:0xbbbbbb}));
    helm.position.set(0,1.08,0.03); g.add(helm);
    const visor=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.18,0.2),new THREE.MeshPhongMaterial({color:0x16283c,shininess:120,specular:0x9db4cc}));
    visor.position.set(0,1.07,0.22); g.add(visor);
    [-1,1].forEach(s=>{
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.075,10,8),new THREE.MeshBasicMaterial({color:0xffffff}));
      eye.position.set(s*0.09,1.00,0.28); g.add(eye); refs.eyes.push(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.032,7,7),new THREE.MeshBasicMaterial({color:0x141414}));
      pupil.position.set(s*0.09,1.00,0.335); g.add(pupil);
    });

    // perisai item (kontrak rig) + spark factory biasa
    const shield=new THREE.Mesh(new THREE.SphereGeometry(1.7,14,12),
      new THREE.MeshBasicMaterial({color:0x33ccff,transparent:true,opacity:0,depthWrite:false}));
    shield.position.y=0.72; g.add(shield); refs.shield=shield;
    const sparksB=BK._sparkFX(g,[leftStack,rightStack],40,{speedBase:1.9,speedRand:1.4});
    g.userData={pivots:[flPivot,frPivot],exhausts:[leftStack,rightStack],particles:sparksB.particles,lastSpawn:0};

    // UPDATE — signature sama dgn Balnok: (speed, steerInput, isBoosting, time, deltaTime)
    g.update=function(speed, steerInput, isBoosting, time, deltaTime){
      const dt=deltaTime;
      steeringWheel.rotation.y=THREE.MathUtils.lerp(steeringWheel.rotation.y,steerInput*0.45,dt*8);
      engine.rotation.z=Math.sin(time*13)*0.012;
      sparksB.update(time,dt,isBoosting);
    };
    g.userData.tick=function(time,dt,boosting,steerInput,speed){
      g.update(speed||0,steerInput||0,!!boosting,time,dt);
    };

    g.traverse(child=>{ if(child.isMesh){ child.castShadow=true; child.receiveShadow=true; } });
    g.scale.setScalar(char.scale||1); // skala dipasang di builder (menu/countdown/balap konsisten)
    g.rotation.order='YXZ';
    Object.assign(g.userData,refs);
    return g;
  };

  // pilihan rig: 3 karakter lain tetap snail-kart; field rig:'kart' pindah ke kart balap
  BK.buildRig = function(c){ return (c.rig==='juara'&&BK.buildJuara) ? BK.buildJuara(c)
    : (c.rig==='kart'&&BK.buildKart) ? BK.buildKart(c) : (c.rig==='buggy'&&BK.buildBuggy) ? BK.buildBuggy(c) : BK.buildSnail(c); };

  // ganti createKart bawaan: pakai karakter
  BK.createKart = function(scene, charId, isPlayer){
    const char = (typeof charId==='string') ? BK.charById(charId) : BK.Characters[0];
    const mesh = BK.buildRig(char);
    scene.add(mesh);
    if(typeof BK.softDisc==='function'){ // bayangan cakram (diskalakan per frame di physics)
      const blob=BK.softDisc(1.7,0x000000,0.4);
      blob.position.y=0.06; scene.add(blob);
      mesh.userData.blob=blob;
    }
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
