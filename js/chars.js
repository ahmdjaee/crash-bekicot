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
      board:0x4a4a52, flame:0xff9f1c, boostCol:0xffb04a, scale:1.62, mass:1.12, rig:'benteng',
      stat:{topMul:1.02, accelMul:0.8, turnMul:0.92, chargeMul:0.9, wallMul:0.45, spinMul:0.6},
      bars:{SPD:3,ACC:2,DRF:2} },
    { id:'hantu', name:'Siput Hantu', icon:'👻', desc:'Lincah • drift & charge cepat, ringkih',
      body:0xb9aef5, head:0xcfc6fb, shellBase:'#4a3a80', shellStripe:'#c9b8ff',
      board:0x2a2338, flame:0xc26bff, boostCol:0xc26bff, scale:1.5, mass:0.96, rig:'arwah',
      stat:{topMul:0.95, accelMul:1.06, turnMul:1.16, chargeMul:1.28, wallMul:1.35, spinMul:1.25},
      bars:{SPD:2,ACC:4,DRF:5} },
    { id:'spora', name:'Ratu Spora', icon:'🍄', desc:'Lincah di tikungan • charge drift cepat', locked:true,
      unlockDesc:'Kalahkan Ratu Spora di 🍄 Rimba Jamur',
      body:0xf2e6c9, head:0xf7eeda, shellBase:'#c8352c', shellStripe:'#fff3e0',
      board:0x5a4228, flame:0x7cfc9a, boostCol:0x7cfc9a, scale:1.55, mass:1.0, rig:'jamur',
      stat:{topMul:0.98, accelMul:1.02, turnMul:1.12, chargeMul:1.2, wallMul:1.0, spinMul:1.05},
      bars:{SPD:3,ACC:3,DRF:5} },
    { id:'bara', name:'Jenderal Bara', icon:'🌋', desc:'Berat & kencang • tak goyah kena dorong', locked:true,
      unlockDesc:'Kalahkan Jenderal Bara di 🌋 Kawah Panas',
      body:0x5a3a34, head:0x6e463c, shellBase:'#2a1a1a', shellStripe:'#ff6a2a',
      board:0x2a2228, flame:0xff6a2a, boostCol:0xff8a3a, scale:1.62, mass:1.14, rig:'lava',
      stat:{topMul:1.05, accelMul:0.88, turnMul:0.95, chargeMul:0.95, wallMul:0.55, spinMul:0.7},
      bars:{SPD:5,ACC:2,DRF:2} },
    { id:'balnok', name:'Balnok', icon:'🏁', desc:'Kart balap klasik • top speed & grip terbaik', locked:true, rig:'kart',
      unlockDesc:'Kalahkan Kapten Balnok di 🏖️ Pantai Bekicot',
      body:0xece7db, head:0xf2ede1, shellBase:'#c8352c', shellStripe:'#f4efe4',
      board:0xb9b4a8, flame:0x2f8fe8, boostCol:0x8fd0ff, scale:1.6,
      stat:{topMul:1.05, accelMul:1.0, turnMul:1.03, chargeMul:1.0, wallMul:0.95, spinMul:0.95},
      bars:{SPD:4,ACC:3,DRF:3} },
    { id:'krambil', name:'Krambil', icon:'🥥', desc:'Buggy rimba • gigit aspal & lampor tanjakan', locked:true, rig:'buggy',
      unlockDesc:'Kalahkan Krambil di ❄️ Puncak Salju',
      body:0xdcb87f, head:0xe8d9b5, shellBase:'#7a5230', shellStripe:'#3f7a3e',
      board:0x9c7a4a, flame:0x39c48f, boostCol:0x7ce8c0, scale:1.55,
      stat:{topMul:0.99, accelMul:1.10, turnMul:1.02, chargeMul:1.18, wallMul:0.7, spinMul:1.0},
      bars:{SPD:3,ACC:4,DRF:3} },
    { id:'juara', name:'Juara', icon:'👑', desc:'Kart Juara • cepat di semua lini', locked:true, rig:'juara',
      unlockDesc:'Kalahkan Raja Juara di 👑 Mahkota Kawah',
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

  // ===== Bantuan geometri halus khusus Siput Hantu (bukan low-poly) =====
  // Tube yang bisa mengecil/membesar di sepanjang kurva. Dipakai untuk tangkai
  // mata, pipa knalpot, dan cangkang spiral. Semua vertex punya normal halus.
  function sweepTube(curve, radiusFn, radial, tubular){
    radial=radial||18; tubular=tubular||40;
    const frames=curve.computeFrenetFrames(tubular,false);
    const pos=[], uv=[], idx=[];
    const M=radial, N=tubular;
    for(let i=0;i<=N;i++){
      const u=i/N;
      const p=curve.getPointAt(u);
      const n=frames.normals[Math.min(i,frames.normals.length-1)];
      const b=frames.binormals[Math.min(i,frames.binormals.length-1)];
      const rr=Math.max(0.002, radiusFn(u,p));
      for(let j=0;j<=M;j++){
        const v=j/M*Math.PI*2, cv=Math.cos(v), sv=Math.sin(v);
        pos.push(p.x+(n.x*cv+b.x*sv)*rr, p.y+(n.y*cv+b.y*sv)*rr, p.z+(n.z*cv+b.z*sv)*rr);
        uv.push(u, j/M);
      }
    }
    for(let i=0;i<N;i++){
      for(let j=0;j<M;j++){
        const a=i*(M+1)+j, b=a+M+1, c=a+1, d=b+1;
        idx.push(a,b,c, b,d,c);
      }
    }
    // tutup ujung (ujung tangkai tersembunyi di mata, ujung pipa di knalpot)
    const cap=(u, flip)=>{
      const ci=pos.length/3, c=curve.getPointAt(u);
      pos.push(c.x,c.y,c.z); uv.push(0.5,0.5);
      const ring=(flip?N:0)*(M+1);
      for(let j=0;j<M;j++){
        if(flip) idx.push(ci, ring+j, ring+j+1);
        else idx.push(ci, ring+j+1, ring+j);
      }
    };
    cap(0,false); cap(1,true);
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  function taperedTube(points, r0, r1, radial, tubular){
    const curve=new THREE.CatmullRomCurve3(points,false,'catmullrom',0.5);
    return sweepTube(curve, u=>r0+(r1-r0)*u, radial||16, tubular||28);
  }

  // Cangkang turbinat padat: profil lathe kerucut + relief spiral (suture/whorl) di permukaan.
  // Bukan piringan tipis dan bukan tabung melayang: cangkang punya isi, dari samping terlihat kerucut berigir.
  let _hantuShell=null;
  function hantuShellGeo(){
    if(_hantuShell) return _hantuShell;
    const raw=[
      [0.00,-0.50],[0.10,-0.49],[0.20,-0.47],[0.31,-0.43],[0.40,-0.37],
      [0.47,-0.29],[0.51,-0.19],[0.52,-0.07],[0.49,0.06],[0.43,0.18],
      [0.34,0.29],[0.24,0.38],[0.14,0.45],[0.06,0.485],[0.00,0.50]
    ];
    const profile=new THREE.SplineCurve(raw.map(p=>new THREE.Vector2(p[0],p[1])));
    const pts=[];
    const SAMPLES=160;
    for(let i=0;i<=SAMPLES;i++){
      const q=profile.getPoint(i/SAMPLES);
      pts.push(new THREE.Vector2(Math.max(0.0006,q.x),q.y));
    }
    const geo=new THREE.LatheGeometry(pts,144);
    const N=3.0;
    const pos=geo.attributes.position, uv=geo.attributes.uv;
    for(let i=0;i<pos.count;i++){
      const r=Math.hypot(pos.getX(i),pos.getZ(i));
      if(r<0.03) continue;
      const u=uv.getX(i), v=uv.getY(i);
      const wobble=0.018*Math.sin(v*17.0+u*Math.PI*4.0);
      let d=((u-N*v+wobble)%1+1)%1;
      const dist=Math.min(d,1-d);
      const groove=-0.034*Math.exp(-Math.pow(dist/0.05,2));
      const rib=0.014*Math.exp(-Math.pow((dist-0.11)/0.065,2));
      const step=0.024*(d-0.5);
      const disp=(groove+rib+step)*(0.90+0.10*v);
      const k=disp/r;
      pos.setX(i,pos.getX(i)*(1+k));
      pos.setZ(i,pos.getZ(i)*(1+k));
    }
    geo.computeVertexNormals();
    _hantuShell={geo,profile,N};
    return _hantuShell;
  }

  // Tekstur cangkang: pita warna spiral yang selaras dengan rigi 3D, garis tumbuh, dan bintik.
  // UV lathe: u = keliling, v = profil. Garis u - 3v = konstan adalah spiral yang sama dengan rigi.
  let _hantuShellTex=null;
  function hantuShellTex(){
    if(_hantuShellTex) return _hantuShellTex;
    const S=512;
    const c=document.createElement('canvas'); c.width=c.height=S;
    const g=c.getContext('2d');
    const img=g.createImageData(S,S); const d=img.data;
    const b=document.createElement('canvas'); b.width=b.height=S;
    const bg=b.getContext('2d');
    const bimg=bg.createImageData(S,S); const bd=bimg.data;
    const stops=[
      [0.00,30,21,58],[0.30,42,30,80],[0.50,50,36,92],
      [0.70,42,30,80],[1.00,30,21,58]
    ];
    function base(v){
      let a=stops[0], z=stops[stops.length-1];
      for(let i=0;i<stops.length-1;i++){
        if(v>=stops[i][0] && v<=stops[i+1][0]){ a=stops[i]; z=stops[i+1]; break; }
      }
      const f=(v-a[0])/Math.max(0.0001,z[0]-a[0]);
      return [a[1]+(z[1]-a[1])*f, a[2]+(z[2]-a[2])*f, a[3]+(z[3]-a[3])*f];
    }
    function noise(x,y){
      return 0.55*Math.sin(x*0.021+y*0.013)
           + 0.30*Math.sin(x*0.009-y*0.027+1.3)
           + 0.15*Math.sin(x*0.047+y*0.039+2.1);
    }
    for(let y=0;y<S;y++){
      const v=y/S;
      const bc=base(v);
      for(let x=0;x<S;x++){
        const u=x/S;
        const sp=((u-3.0*v)%1+1)%1;
        const stripe=Math.pow(0.5+0.5*Math.cos(sp*Math.PI*2*3.0-0.35),0.62);
        const fine=0.5+0.5*Math.sin(sp*Math.PI*2*20 + noise(x*0.7,y*0.7)*1.8);
        const m=0.5+0.5*noise(x*0.53,y*0.53);
        const seam=Math.exp(-Math.pow(Math.min(sp,1-sp)/0.050,2));
        const cyan=Math.max(0,Math.cos(sp*Math.PI*2*3.0-0.9))*0.10;
        // dua nada: dasar violet tua + pita spiral lavender pucat
        const mix=0.10+0.55*stripe;
        let r=bc[0]*(1-mix)+121*mix+(m-0.5)*13+(fine-0.5)*2.4-cyan*16;
        let gg=bc[1]*(1-mix)+103*mix+(m-0.5)*11+(fine-0.5)*2.0+cyan*20;
        let bb=bc[2]*(1-mix)+178*mix+(m-0.5)*18+(fine-0.5)*2.8+cyan*18;
        r*=1-0.48*seam; gg*=1-0.48*seam; bb*=1-0.48*seam;
        // bukaan cangkang: oval gelap dengan bibir tipis, dicat di tekstur agar tidak melayang
        let duu=u-0.012; duu-=Math.round(duu);
        const dvp=(v-0.255)/0.100, eud=duu/0.060;
        const ap=eud*eud+dvp*dvp;
        if(ap<1){
          const k=1-Math.pow(ap,0.55);
          r=r*(1-k*0.92)+10*k; gg=gg*(1-k*0.92)+6*k; bb=bb*(1-k*0.92)+18*k;
        } else if(ap<1.28){
          const rim=(1-(ap-1)/0.28)*0.35;
          r+=rim*34; gg+=rim*26; bb+=rim*44;
        }
        const edge=Math.min(1,Math.min(v,1-v)*7);
        const rim=0.82+0.18*edge;
        r*=rim; gg*=rim; bb*=rim;
        const i=(y*S+x)*4;
        d[i]=Math.max(0,Math.min(255,r|0));
        d[i+1]=Math.max(0,Math.min(255,gg|0));
        d[i+2]=Math.max(0,Math.min(255,bb|0));
        d[i+3]=255;
        const h=0.65*stripe+0.08*(fine-0.5)-0.30*seam+0.10*(m-0.5)-0.55*Math.max(0,1-ap);
        const hv=Math.max(0,Math.min(255,128+h*110|0));
        bd[i]=hv; bd[i+1]=hv; bd[i+2]=hv; bd[i+3]=255;
      }
    }
    g.putImageData(img,0,0);
    bg.putImageData(bimg,0,0);
    const map=new THREE.CanvasTexture(c); map.anisotropy=8;
    map.wrapS=THREE.RepeatWrapping;
    const bump=new THREE.CanvasTexture(b); bump.anisotropy=4;
    bump.wrapS=THREE.RepeatWrapping;
    _hantuShellTex={map,bump};
    return _hantuShellTex;
  }

  // Kulit hantu: bintik mineral lembut supaya badan tidak terbaca sebagai bola plastik.
  let _hantuSkinTex=null;
  function hantuSkinTex(){
    if(_hantuSkinTex) return _hantuSkinTex;
    const S=512, c=document.createElement('canvas'); c.width=c.height=S;
    const g=c.getContext('2d');
    g.fillStyle='#e9e3ff'; g.fillRect(0,0,S,S);
    for(let i=0;i<95;i++){
      const x=Math.random()*S, y=Math.random()*S, r=18+Math.random()*70;
      const rg=g.createRadialGradient(x,y,0,x,y,r);
      const a=0.04+Math.random()*0.12;
      rg.addColorStop(0,'rgba(92,64,150,'+a+')');
      rg.addColorStop(0.65,'rgba(120,88,180,'+(a*0.35)+')');
      rg.addColorStop(1,'rgba(120,88,180,0)');
      g.fillStyle=rg; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
    }
    for(let i=0;i<1400;i++){
      const a=Math.random();
      g.fillStyle=a<0.55?'rgba(255,255,255,'+(0.03+Math.random()*0.13)+')':'rgba(58,36,102,'+(0.02+Math.random()*0.08)+')';
      const z=1+Math.random()*1.6;
      g.fillRect(Math.random()*S,Math.random()*S,z,z);
    }
    const t=new THREE.CanvasTexture(c); t.anisotropy=4;
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    _hantuSkinTex=t; return t;
  }

  BK.buildSnail = function(char){
    const g = new THREE.Group();
    const ghost = !!char.ghost;
    const gh = {}; // TANPA transparansi menyeluruh: dulu bikin wajah saling tembus (seperti bug)
    const refs = {wheels:[], eyes:[], stalks:[]};

    // sasis kart: hidung + bumper + side-pod + knalpot + jok + spoiler
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

  // ===== Balnok: go-kart aero biru-emas =====
  // stylized biru-emas, knalpot raksasa, api boost.
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
    const pal=opts.colors||[0xffffaa,0xff5500,0x333333];
    const _c1=new THREE.Color(pal[0]), _c2=new THREE.Color(pal[1]), _c3=new THREE.Color(pal[2]);
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
    const steeringWheel=hdSteer(kartGroup,darkMetalMat,leatherMat); // setir bersama: tak lagi menembus wajah

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
      steeringWheel.rotation.z=THREE.MathUtils.lerp(steeringWheel.rotation.z,targetSteer*1.5,dt*8);
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
    const steeringWheel=hdSteer(kartGroup,darkMetal,velvetMat,goldMat,{tube:0.04}); // setir bersama

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
      steeringWheel.rotation.z=THREE.MathUtils.lerp(steeringWheel.rotation.z,targetSteer*1.5,dt*8);
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
    const dash=new THREE.Mesh(rBoxGeo(0.72,0.18,0.22,0.04,3),orangeMat); dash.position.set(0,0.76,0.50); dash.rotation.x=-0.2;
    const glass=new THREE.Mesh(rBoxGeo(0.70,0.40,0.03,0.015,2),glassMat); glass.position.set(0,0.98,0.64); glass.rotation.x=-0.52;
    g.add(dash,glass);
    const steeringWheel=hdSteer(g,darkSteelMat,tanMat,null,{y:0.92,z:0.45,len:0.3}); // kepala Krambil lebih tinggi (y1.05)

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
      steeringWheel.rotation.z=THREE.MathUtils.lerp(steeringWheel.rotation.z,steerInput*0.9,dt*8);
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

  // =====================================================================
  // RIG HD GENERASI-2: Benteng Besi (besi), Kereta Arwah (hantu),
  // Kereta Jamur (spora), Tank Lava (bara). Satu keluarga dengan
  // Balnok/Krambil/Juara: kerangka kart ±1.2 × 2.6 m pada skala 1, skala 1.5–1.65.
  // Turbo SENGAJA tetap rig lama (buildSnail): kart pemula yang "cupu".
  // Komponen di bawah dipakai >1 rig → geometri/tekstur di-cache modul.
  // =====================================================================
  const phong=(color,sh,spec,extra)=>new THREE.MeshPhongMaterial(Object.assign(
    {color,shininess:sh==null?30:sh,specular:spec==null?0x333333:spec},extra||{}));
  const basic=(color,extra)=>new THREE.MeshBasicMaterial(Object.assign({color},extra||{}));
  const V2=a=>a.map(p=>new THREE.Vector2(p[0],p[1]));
  const rb=(w,h,d,r,mat,s)=>new THREE.Mesh(rBoxGeo(w,h,d,r,s||3),mat);
  const tubeMesh=(pts,r,mat,seg,rad)=>new THREE.Mesh(new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p[0],p[1],p[2])),false,'catmullrom',0.35),
    seg||40,r,rad||12,false),mat);
  const at=(m,x,y,z,parent)=>{ m.position.set(x,y,z); if(parent)parent.add(m); return m; };

  // ---- tekstur kanvas prosedural (≤512px, sekali-buat) ----
  const _t2={};
  function canvasTex(key,S,draw,repeat){
    if(_t2[key]) return _t2[key];
    const c=document.createElement('canvas'); c.width=c.height=S;
    draw(c.getContext('2d'),S);
    const t=new THREE.CanvasTexture(c); t.anisotropy=4;
    if(repeat){ t.wrapS=t.wrapT=THREE.RepeatWrapping; }
    return _t2[key]=t;
  }
  function speckle(g,S,n,dark,light){
    for(let i=0;i<n;i++){
      g.fillStyle=Math.random()<0.5?'rgba('+dark+','+(Math.random()*0.10)+')':'rgba('+light+','+(Math.random()*0.10)+')';
      g.fillRect(Math.random()*S,Math.random()*S,1+Math.random()*2.5,1+Math.random()*2.5);
    }
  }
  function hazardTex(){ return canvasTex('hazard',128,(g,S)=>{
    g.fillStyle='#ffc21a'; g.fillRect(0,0,S,S);
    g.fillStyle='#1c1d20';
    for(let k=-S;k<S*2;k+=32){ g.beginPath(); g.moveTo(k,0); g.lineTo(k+16,0); g.lineTo(k+16-S,S); g.lineTo(k-S,S); g.closePath(); g.fill(); }
    speckle(g,S,160,'0,0,0','255,255,255');
  },true); }
  function plateTex(){ return canvasTex('plate',256,(g,S)=>{ // pelat baja: sapuan kuas + sambungan panel + paku keling
    g.fillStyle='#7d8894'; g.fillRect(0,0,S,S);
    for(let y=0;y<S;y+=2){ g.fillStyle='rgba(255,255,255,'+(Math.random()*0.05)+')'; g.fillRect(0,y,S,1); }
    g.strokeStyle='rgba(20,24,30,0.55)'; g.lineWidth=3;
    [0,128].forEach(p=>{ g.beginPath(); g.moveTo(p,0); g.lineTo(p,S); g.moveTo(0,p); g.lineTo(S,p); g.stroke(); });
    g.fillStyle='rgba(225,230,236,0.85)';
    for(let a=10;a<S;a+=28){ [[a,8],[a,136],[8,a],[136,a]].forEach(([x,y])=>{ g.beginPath(); g.arc(x,y,3,0,Math.PI*2); g.fill(); }); }
    speckle(g,S,500,'20,20,20','255,255,255');
  },true); }
  function lavaTex(){ // batu basal + retakan magma: map (warna) + emissiveMap (hanya retakan menyala)
    if(_t2.lava) return _t2.lava;
    const S=256, a=document.createElement('canvas'), b=document.createElement('canvas');
    a.width=a.height=b.width=b.height=S;
    const g=a.getContext('2d'), e=b.getContext('2d');
    g.fillStyle='#2b201e'; g.fillRect(0,0,S,S); e.fillStyle='#000'; e.fillRect(0,0,S,S);
    for(let i=0;i<170;i++){
      const x=Math.random()*S, y=Math.random()*S, r=4+Math.random()*20, v=Math.random();
      g.fillStyle='rgba('+(38+v*34|0)+','+(28+v*22|0)+','+(26+v*18|0)+',0.55)';
      g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
    }
    for(let k=0;k<13;k++){
      let x=Math.random()*S, y=Math.random()*S, ang=Math.random()*Math.PI*2;
      const pts=[[x,y]];
      for(let s=0;s<15;s++){ ang+=(Math.random()-0.5)*1.2; x+=Math.cos(ang)*9; y+=Math.sin(ang)*9; pts.push([x,y]); }
      [[g,'#c2420f',4.2],[g,'#ff8a1e',2.2],[g,'#ffd36a',0.9],[e,'#ff5a10',5],[e,'#ffb040',2.2],[e,'#fff0a0',0.9]].forEach(([c,col,lw])=>{
        c.strokeStyle=col; c.lineWidth=lw; c.lineJoin='round'; c.lineCap='round';
        c.beginPath(); pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1])); c.stroke();
      });
    }
    speckle(g,S,500,'0,0,0','255,200,160');
    const mk=c=>{ const t=new THREE.CanvasTexture(c); t.anisotropy=4; t.wrapS=t.wrapT=THREE.RepeatWrapping; return t; };
    return _t2.lava={map:mk(a),emi:mk(b)};
  }
  function spotTex(base,spot){ return canvasTex('spot'+base+spot,256,(g,S)=>{ // topi jamur bertotol
    g.fillStyle=base; g.fillRect(0,0,S,S);
    const rg=g.createLinearGradient(0,0,0,S); rg.addColorStop(0,'rgba(255,255,255,0.10)'); rg.addColorStop(1,'rgba(0,0,0,0.18)');
    g.fillStyle=rg; g.fillRect(0,0,S,S);
    const placed=[];
    for(let i=0;i<70 && placed.length<22;i++){
      const x=Math.random()*S, y=18+Math.random()*(S-36), r=9+Math.random()*15;
      if(placed.some(p=>Math.hypot(p[0]-x,p[1]-y)<p[2]+r+6)) continue;
      placed.push([x,y,r]);
      [0,S,-S].forEach(dx=>{ // tembus tepi u agar jahitan lathe/bola tak terpotong
        g.fillStyle='rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(x+dx+1.5,y+2,r,r*0.9,0,0,Math.PI*2); g.fill();
        g.fillStyle=spot; g.beginPath(); g.ellipse(x+dx,y,r,r*0.9,0,0,Math.PI*2); g.fill();
      });
    }
    speckle(g,S,260,'0,0,0','255,255,255');
  }); }
  function barkTex(){ return canvasTex('bark',256,(g,S)=>{ // kulit kayu: alur memanjang
    g.fillStyle='#6b4527'; g.fillRect(0,0,S,S);
    for(let i=0;i<70;i++){
      const x=Math.random()*S, w=2+Math.random()*6;
      g.strokeStyle=Math.random()<0.6?'rgba(40,24,12,0.55)':'rgba(150,108,70,0.35)'; g.lineWidth=w;
      g.beginPath(); g.moveTo(x,0);
      for(let y=0;y<=S;y+=16) g.lineTo(x+Math.sin(y*0.05+i)*4,y);
      g.stroke();
    }
    speckle(g,S,400,'0,0,0','255,230,200');
  },true); }
  function ringTex(){ return canvasTex('rings',128,(g,S)=>{ // irisan kayu: lingkar tahun
    g.fillStyle='#d7b07a'; g.fillRect(0,0,S,S);
    for(let r=6;r<S/2;r+=5+Math.random()*3){
      g.strokeStyle='rgba(120,78,40,'+(0.25+Math.random()*0.3)+')'; g.lineWidth=1.5;
      g.beginPath(); g.arc(S/2+Math.random(),S/2,r,0,Math.PI*2); g.stroke();
    }
    g.strokeStyle='#5a3a1e'; g.lineWidth=9; g.beginPath(); g.arc(S/2,S/2,S/2-4,0,Math.PI*2); g.stroke();
  }); }
  function gillTex(){ return canvasTex('gill',256,(g,S)=>{ // insang bawah topi jamur
    g.fillStyle='#efe2c6'; g.fillRect(0,0,S,S);
    g.strokeStyle='rgba(150,118,80,0.55)'; g.lineWidth=1.4;
    for(let k=0;k<96;k++){ const a=k/96*Math.PI*2;
      g.beginPath(); g.moveTo(S/2+Math.cos(a)*14,S/2+Math.sin(a)*14); g.lineTo(S/2+Math.cos(a)*S/2,S/2+Math.sin(a)*S/2); g.stroke(); }
    g.fillStyle='#d9c7a0'; g.beginPath(); g.arc(S/2,S/2,16,0,Math.PI*2); g.fill();
  }); }
  function bannerTex(){ return canvasTex('banner',128,(g,S)=>{ // panji Jenderal Bara: gunung api menyala
    g.fillStyle='#8e1f14'; g.fillRect(0,0,S,S);
    g.fillStyle='#c8902e'; g.fillRect(0,0,S,8); g.fillRect(0,S-8,S,8);
    g.fillStyle='#2a1a16'; g.beginPath(); g.moveTo(20,S-22); g.lineTo(52,40); g.lineTo(76,40); g.lineTo(108,S-22); g.closePath(); g.fill();
    g.fillStyle='#ff8a1e'; g.beginPath(); g.moveTo(52,40); g.lineTo(64,14); g.lineTo(76,40); g.closePath(); g.fill();
    g.fillStyle='#ffd36a'; g.beginPath(); g.moveTo(58,40); g.lineTo(64,24); g.lineTo(70,40); g.closePath(); g.fill();
    g.strokeStyle='#ff6a1e'; g.lineWidth=3; g.beginPath(); g.moveTo(64,42); g.lineTo(58,70); g.lineTo(66,86); g.stroke();
  }); }

  // ---- moncong kapsul (profil sama Balnok/Juara) ----
  let _noseG=null;
  function kartNoseGeo(){
    if(_noseG) return _noseG;
    const geo=new THREE.LatheGeometry(V2([[0.05,0],[0.30,0.05],[0.385,0.16],[0.40,0.34],[0.345,0.52],[0.245,0.66],[0.115,0.76],[0.0,0.80]]),28);
    geo.rotateX(Math.PI/2);
    const pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const t=Math.min(1,Math.max(0,(pos.getZ(i)+0.10)/0.90));
      pos.setX(i,pos.getX(i)*(1-0.30*t*t)); pos.setY(i,pos.getY(i)-0.10*t*t);
    }
    geo.computeVertexNormals();
    return _noseG=geo;
  }

  // ---- roda HD bersama: ban (slick/rib), velg mangkuk 2 muka, palang bintang n, opsi lis/duri ----
  const _hdW={};
  function hdWheelGeo(r,w,n,ribbed){
    const key=[r,w,n,ribbed?1:0].join('|');
    if(_hdW[key]) return _hdW[key];
    let tp;
    if(ribbed){
      tp=[[r*0.52,-w/2],[r-0.08,-w/2+0.01]];
      for(let k=0;k<8;k++) tp.push([k%2?r:r-0.026,-w/2+0.07+k*(w-0.14)/7]);
      tp.push([r-0.08,w/2-0.01],[r*0.52,w/2],[r*0.52,-w/2]);
    } else {
      const sh=Math.min(0.15,w*0.45);
      tp=[[r*0.52,-w/2],[r-0.09,-w/2],[r-0.03,-w/2+0.055],[r,-w/2+sh],[r,w/2-sh],[r-0.03,w/2-0.055],[r-0.09,w/2],[r*0.52,w/2],[r*0.52,-w/2]];
    }
    const tire=new THREE.LatheGeometry(V2(tp),28); tire.rotateZ(Math.PI/2);
    const lip=w*0.40, bowl=w*0.26;
    const rimL=new THREE.LatheGeometry(V2([[r*0.93,lip],[r*0.88,lip+0.01],[r*0.80,lip*0.86],[r*0.62,bowl+0.02],[r*0.30,bowl],[r*0.10,bowl]]),22);
    rimL.rotateZ(Math.PI/2);
    const rimR=new THREE.LatheGeometry(V2([[r*0.93,-lip],[r*0.88,-(lip+0.01)],[r*0.80,-lip*0.86],[r*0.62,-(bowl+0.02)],[r*0.30,-bowl],[r*0.10,-bowl]]),22);
    rimR.rotateZ(Math.PI/2);
    const st=new THREE.Shape(), oR=r*0.47, iR=r*0.22;
    for(let k=0;k<n*2;k++){
      const a=Math.PI/2+k*Math.PI/n, rr=k%2?iR:oR;
      if(k) st.lineTo(Math.cos(a)*rr,Math.sin(a)*rr); else st.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);
    }
    st.closePath();
    const starR=new THREE.ExtrudeGeometry(st,{depth:0.045,bevelEnabled:true,bevelThickness:0.01,bevelSize:0.01,bevelSegments:2});
    starR.rotateY(Math.PI/2);
    const starL=starR.clone().rotateY(Math.PI); // cermin via rotasi (winding aman)
    const hub=new THREE.CylinderGeometry(r*0.2,r*0.2,w*0.5,8); hub.rotateZ(Math.PI/2);
    const ring=new THREE.TorusGeometry(r*0.90,0.014,6,30); ring.rotateY(Math.PI/2);
    const tread=new THREE.TorusGeometry(r*0.985,0.011,6,30); tread.rotateY(Math.PI/2);
    const stud=new THREE.ConeGeometry(r*0.13,r*0.42,8);
    return _hdW[key]={tire,rimL,rimR,starL,starR,hub,ring,tread,stud};
  }
  function hdWheel(r,w,m,o){
    o=o||{};
    const gw=hdWheelGeo(r,w,o.spokes||5,!!o.ribbed), wh=new THREE.Group();
    wh.add(new THREE.Mesh(gw.tire,m.tire));
    m.rim.side=THREE.DoubleSide;
    wh.add(new THREE.Mesh(gw.rimL,m.rim),new THREE.Mesh(gw.rimR,m.rim));
    const sp=m.spoke||m.rim;
    at(new THREE.Mesh(gw.starR,sp),w*0.30-0.05,0,0,wh);
    at(new THREE.Mesh(gw.starL,sp),-(w*0.30-0.05),0,0,wh);
    wh.add(new THREE.Mesh(gw.hub,m.hub||m.rim));
    if(!o.ribbed) [-1,1].forEach(s=>at(new THREE.Mesh(gw.tread,m.groove||m.tire),s*w*0.22,0,0,wh));
    if(o.ring) [-1,1].forEach(s=>at(new THREE.Mesh(gw.ring,o.ring),s*w*0.31,0,0,wh));
    if(o.studs) [-1,1].forEach(s=>{
      const c=at(new THREE.Mesh(gw.stud,o.studs),s*(w*0.25+r*0.21),0,0,wh); c.rotation.z=-s*Math.PI/2;
    });
    return wh;
  }
  // F/R = {x,z,r,w}; pivot di sumbu roda (kontrak fisika: pivot=belok, spin=putar)
  function hdWheels(g,refs,F,R,m,oF,oR){
    [[-1,F,oF],[1,F,oF],[-1,R,oR],[1,R,oR]].forEach(([s,d,o],i)=>{
      const pv=at(new THREE.Group(),s*d.x,d.r,d.z,g);
      const wh=hdWheel(d.r,d.w,m,o); pv.add(wh);
      refs.wheels.push({pivot:pv,spin:wh,front:i<2});
    });
  }
  // knalpot bell (profil Balnok); sumbu +Y, mulut di y≈0.73k
  const _bell={};
  function hdBell(mat,k,glowMat){
    if(!_bell[k]) _bell[k]=new THREE.LatheGeometry(V2([[0.055,0],[0.06,0.14],[0.068,0.34],[0.075,0.50],[0.095,0.62],[0.125,0.70],[0.142,0.73],[0.128,0.735],[0.10,0.70]].map(p=>[p[0]*k,p[1]*k])),20);
    const m=new THREE.Mesh(_bell[k],mat);
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.10*k,0.10*k,0.02,16),basic(0x0a0a0a)),0,0.725*k,0,m);
    if(glowMat){ const gr=at(new THREE.Mesh(new THREE.TorusGeometry(0.128*k,0.016*k,6,20),glowMat),0,0.733*k,0,m); gr.rotation.x=Math.PI/2; }
    return m;
  }
  // spatbor lengkung: kulit silinder terbuka (busur depan→atas→belakang) + lis tepi; sumbu roda = X
  const _fend={};
  function hdFender(g,x,y,z,R,w,mat,edgeMat){
    const key=R+'|'+w;
    if(!_fend[key]){
      const sk=new THREE.CylinderGeometry(R,R,w,30,1,true,0.35,Math.PI-0.55); sk.rotateZ(Math.PI/2);
      const ed=new THREE.TorusGeometry(R,0.022,6,30,Math.PI-0.55); ed.rotateY(Math.PI/2); ed.rotateX(0.2); // φ∈[0,π-0.55] → sudut kulit [0.35, π-0.2]
      _fend[key]={sk,ed};
    }
    const f=at(new THREE.Group(),x,y,z,g);
    mat.side=THREE.DoubleSide;
    f.add(new THREE.Mesh(_fend[key].sk,mat));
    [-1,1].forEach(s=>at(new THREE.Mesh(_fend[key].ed,edgeMat||mat),s*w/2,0,0,f));
    return f;
  }
  // Setir bersama semua kart HD. Dulu lingkar di (y.88,z.23) = DI DALAM kepala pembalap (pusat y1.0 z.05 r.24).
  // Sekarang di depan-bawah wajah (jarak ≥.12), lingkar condong menghadap pembalap, kolom menancap ke dasbor
  // depan-bawah. Kembalian = grup putar: rotation.z = belok (+ = kanan, searah jarum jam dilihat pembalap).
  const _steerG={};
  function hdSteer(g,shaftMat,rimMat,hubMat,o){
    o=o||{};
    const r=o.r||0.15, tube=o.tube||0.036, len=o.len||0.42, key=r+'|'+tube+'|'+len;
    const G=_steerG[key]||(_steerG[key]={
      rim:new THREE.TorusGeometry(r,tube,8,22),
      col:new THREE.CylinderGeometry(0.024,0.03,len,8).rotateX(Math.PI/2).translate(0,0,len/2),
      hub:new THREE.CylinderGeometry(0.05,0.05,0.045,12).rotateX(Math.PI/2),
      spoke:new THREE.BoxGeometry(r,0.024,0.018).translate(r/2,0,0)});
    const W=at(new THREE.Group(),0,o.y||0.86,o.z||0.44,g); W.rotation.x=o.tilt!=null?o.tilt:0.55;
    W.add(new THREE.Mesh(G.col,shaftMat));
    const S=at(new THREE.Group(),0,0,0,W);
    S.add(new THREE.Mesh(G.rim,rimMat), new THREE.Mesh(G.hub,hubMat||shaftMat));
    [0,Math.PI,-Math.PI/2].forEach(a=>{ const sp=new THREE.Mesh(G.spoke,shaftMat); sp.rotation.z=a; S.add(sp); }); // jari T
    return S;
  }

  // ---- pembalap bekicot HD bersama: badan, cangkang, kepala, helm/tangkai mata ----
  // o.helmet: 'race' | 'steel' | 'general' | 'none' (tangkai mata terlihat, ikut goyang fisika)
  function hdEye(size,iris){
    const e=new THREE.Group();
    e.add(new THREE.Mesh(new THREE.SphereGeometry(size,16,12),basic(0xffffff)));
    if(iris!=null){ const ir=at(new THREE.Mesh(new THREE.SphereGeometry(size*0.56,14,10),basic(iris)),0,0,size*0.84,e); ir.scale.z=0.38; }
    const p=at(new THREE.Mesh(new THREE.SphereGeometry(size*(iris!=null?0.28:0.42),10,8),basic(0x120c10)),0,0,size*(iris!=null?0.98:0.80),e);
    p.scale.z=0.5;
    at(new THREE.Mesh(new THREE.SphereGeometry(size*0.13,8,6),basic(0xffffff)),-size*0.3,size*0.32,size*1.0,e);
    return e;
  }
  function hdMouth(g,mat,frown){
    const d=frown?0.016:-0.016;
    const c=new THREE.CatmullRomCurve3([new THREE.Vector3(-0.075,0.905,0.262),new THREE.Vector3(0,0.893+d,0.287),new THREE.Vector3(0.075,0.905,0.262)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c,12,0.012,6,false),mat));
  }
  function hdRider(g,char,o){
    o=o||{};
    const R={eyes:[],stalks:[]};
    const skin=o.skin||phong(char.body,26), skinH=o.skinHead||phong(char.head,26);
    const body=at(new THREE.Mesh(new THREE.SphereGeometry(0.30,22,16),skin),0,0.72,-0.14,g);
    body.scale.set(0.95,0.8,1.25); R.body=body;
    let shell=o.shell;
    if(!shell){
      shell=new THREE.Mesh(new THREE.LatheGeometry(V2([[0,0],[0.5,0.03],[0.66,0.2],[0.6,0.45],[0.42,0.68],[0.18,0.82],[0.02,0.86]]),30),
        o.shellMat||phong(0xffffff,70,0x777777,{map:shellTexH(char.shellBase,char.shellStripe)}));
      shell.scale.setScalar(0.55); shell.rotation.x=-0.5; shell.position.set(0,0.86,-0.42);
      if(o.spikes){ // duri cangkang (anak lathe → ikut napas/miring cangkang)
        const up=new THREE.Vector3(0,1,0), dir=new THREE.Vector3(), cg=new THREE.ConeGeometry(0.075,0.30,8);
        for(let k=0;k<7;k++){
          const a=k/7*Math.PI*2+0.3;
          dir.set(Math.cos(a),0.45,Math.sin(a)).normalize();
          const c=at(new THREE.Mesh(cg,o.spikes),Math.cos(a)*0.60,0.42,Math.sin(a)*0.60,shell);
          c.quaternion.setFromUnitVectors(up,dir);
        }
        at(new THREE.Mesh(cg,o.spikes),0,0.95,0,shell);
      }
    }
    g.add(shell); R.shell=shell;
    const head=at(new THREE.Mesh(new THREE.SphereGeometry(0.24,22,16),skinH),0,1.0,0.05,g); R.head=head;
    const mouthM=basic(0x2a1416);
    const hm=o.helmMat||phong(0x6b7682,60,0x99a4b0), trim=o.trimMat||phong(0x2e3540,40);
    if(o.helmet==='race'){
      at(new THREE.Mesh(new THREE.SphereGeometry(0.29,22,16),phong(0xffffff,120,0xbbbbbb,{map:stripeTexH()})),0,1.03,0.04,g);
      at(new THREE.Mesh(new THREE.BoxGeometry(0.42,0.18,0.2),phong(0x16283c,120,0x9db4cc)),0,1.02,0.24,g);
      [-1,1].forEach(s=>{ const e=at(hdEye(0.075),s*0.09,0.95,0.30,g); R.eyes.push(e); });
    } else if(o.helmet==='steel'||o.helmet==='general'){
      const dome=at(new THREE.Mesh(new THREE.SphereGeometry(0.30,26,14,0,Math.PI*2,0,Math.PI*0.52),hm),0,1.03,0.03,g);
      const brim=at(new THREE.Mesh(new THREE.TorusGeometry(0.295,0.028,8,30),trim),0,1.02,0.03,g);
      brim.rotation.x=Math.PI/2-0.12;
      [-1,1].forEach(s=>{ const e=at(hdEye(0.074,o.iris),s*0.09,0.935,0.262,g); R.eyes.push(e); });
      hdMouth(g,mouthM,o.helmet==='general');
      if(o.helmet==='steel'){ // tali + kacamata las di dahi helm
        const band=at(new THREE.Mesh(new THREE.TorusGeometry(0.288,0.022,6,30),trim),0,1.12,0.03,g); band.rotation.x=Math.PI/2-0.25;
        [-1,1].forEach(s=>{
          const gg=at(new THREE.Mesh(new THREE.CylinderGeometry(0.068,0.072,0.07,16),trim),s*0.1,1.15,0.27,g); gg.rotation.x=Math.PI/2-0.45;
          const ln=at(new THREE.Mesh(new THREE.CylinderGeometry(0.052,0.052,0.012,16),basic(0xffb04a)),s*0.1,1.165,0.30,g); ln.rotation.x=Math.PI/2-0.45;
        });
      } else { // jenderal: paku puncak kuningan, lencana, jambul, alis marah
        const brass=o.brassMat||phong(0xc08a2e,80,0xffe0a0);
        at(new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.065,0.06,12),brass),0,1.33,0.03,g);
        at(new THREE.Mesh(new THREE.ConeGeometry(0.035,0.16,10),brass),0,1.44,0.03,g);
        const badge=at(new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.055,0.02,6),brass),0,1.18,0.28,g); badge.rotation.x=Math.PI/2-0.55;
        const gem=at(new THREE.Mesh(new THREE.SphereGeometry(0.026,8,6),basic(0xff6a1e)),0,1.19,0.295,g); gem.scale.z=0.5;
        g.add(new THREE.Mesh(taperedTube([new THREE.Vector3(0,1.36,0.0),new THREE.Vector3(0,1.50,-0.10),
          new THREE.Vector3(0,1.50,-0.28),new THREE.Vector3(0,1.36,-0.40)],0.055,0.018,12,24),o.plumeMat||phong(0xd23a1e,20)));
        [-1,1].forEach(s=>{ const br=at(rb(0.10,0.026,0.03,0.012,trim),s*0.09,1.005,0.30,g); br.rotation.z=s*0.38; });
      }
      void dome;
    } else { // 'none': tangkai mata melengkung (pivot di pangkal → goyang fisika)
      const iris=o.iris==null?0x3a2a6a:o.iris;
      [-1,1].forEach(s=>{
        const st=at(new THREE.Group(),s*0.085,1.17,0.06,g);
        st.add(new THREE.Mesh(taperedTube([new THREE.Vector3(0,-0.02,0),new THREE.Vector3(s*0.012,0.12,0.012),
          new THREE.Vector3(s*0.025,0.24,0.03),new THREE.Vector3(s*0.035,0.33,0.05)],0.036,0.026,12,20),skinH));
        const e=at(hdEye(0.085,iris),s*0.035,0.37,0.055,st); e.rotation.y=s*0.25;
        st.rotation.z=s*0.14;
        R.stalks.push(st); R.eyes.push(e);
      });
      hdMouth(g,mouthM,false);
    }
    R.hatAt=new THREE.Vector3(0,o.helmet==='none'?1.30:1.36,0.04); // titik topi toko (attachHat)
    return R;
  }
  function hdFinish(g,refs,char,tick){
    const sh=at(new THREE.Mesh(new THREE.SphereGeometry(1.7,16,12),basic(0x33ccff,{transparent:true,opacity:0,depthWrite:false})),0,0.72,0,g);
    refs.shield=sh;
    g.scale.setScalar(char.scale||1); // WAJIB di builder (menu/countdown/hub tanpa fisika)
    g.rotation.order='YXZ';
    Object.assign(g.userData,refs);
    if(tick) g.userData.tick=tick;
    return g;
  }

  // ===== Besi: "Benteng Besi" — kart bulldozer lapis baja =====
  BK.buildBenteng=function(char){
    const g=new THREE.Group(), refs={wheels:[],eyes:[],stalks:[]};
    const plate=phong(0xffffff,45,0x667080,{map:plateTex()});
    const armorD=phong(0x3b434e,35,0x444c58);
    const steel=phong(0xb4bdc8,80,0xffffff);
    const hazard=phong(0xffffff,20,0x222222,{map:hazardTex()});
    const orange=phong(0xff9f1c,50,0x664422);
    const seatM=new THREE.MeshStandardMaterial({color:0x2a2d33,roughness:0.85});
    const tire=new THREE.MeshStandardMaterial({color:0x1d1e21,roughness:0.92});
    const glowO=basic(0xffb04a), lensM=basic(0xfff3c4), tailM=basic(0xff3a2a);

    // 1. sasis + lambung depan bersudut + dek miring
    const chassis=at(rb(1.30,0.18,2.15,0.05,armorD,4),0,0.33,-0.02,g);
    const hull=at(rb(1.12,0.28,0.95,0.08,plate,4),0,0.52,0.62,g); hull.rotation.x=0.10;
    const glacis=at(rb(1.0,0.05,0.62,0.02,armorD),0,0.67,0.66,g); glacis.rotation.x=0.16;
    // 2. bilah dozer bergaris hazard + bibir baja + lengan dorong & piston
    const blade=at(rb(1.52,0.34,0.07,0.03,hazard),0,0.44,1.20,g); blade.rotation.x=-0.22;
    at(rb(1.56,0.06,0.10,0.025,steel),0,0.28,1.245,g);
    at(rb(1.56,0.05,0.10,0.02,armorD),0,0.615,1.16,g);
    [-1,1].forEach(s=>{
      at(rb(0.09,0.10,0.34,0.03,armorD),s*0.45,0.38,1.04,g);
      g.add(tubeMesh([[s*0.30,0.63,0.80],[s*0.30,0.58,0.98],[s*0.30,0.52,1.13]],0.032,steel,12,10));
      at(rb(0.12,0.04,0.06,0.015,armorD),s*0.30,0.52,1.15,g);
    });
    // 3. pod samping lapis + pita hazard + spatbor baja di atas roda
    [-1,1].forEach(s=>{
      at(rb(0.22,0.30,0.62,0.06,plate,4),s*0.56,0.47,-0.02,g);
      at(rb(0.23,0.07,0.44,0.02,hazard),s*0.565,0.60,-0.02,g);
      hdFender(g,s*0.90,0.44,-0.70,0.54,0.50,plate,orange);
      at(rb(0.05,0.30,0.06,0.02,armorD),s*0.645,0.70,-0.70,g); // penopang spatbor
      at(rb(0.36,0.04,0.66,0.015,armorD),s*0.80,0.665,0.65,g);
    });
    // 4. lampu sorot ganda berkerangkeng di dek
    [-1,1].forEach(s=>{
      const lp=new THREE.Group(); at(lp,s*0.34,0.79,0.86,g);
      const hs=new THREE.Mesh(new THREE.CylinderGeometry(0.095,0.08,0.12,16),armorD); hs.rotation.x=Math.PI/2; lp.add(hs);
      const ln=at(new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.075,0.012,16),lensM),0,0,0.062,lp); ln.rotation.x=Math.PI/2;
      [-0.035,0.035].forEach(x=>at(rb(0.016,0.17,0.016,0.006,steel),x,0,0.075,lp));
      at(rb(0.05,0.10,0.05,0.015,armorD),0,-0.10,0,lp);
    });
    // 5. jok + mesin lapis + kisi belakang + cerobong tegak (titik api boost)
    at(rb(0.7,0.15,0.6,0.06,seatM,4),0,0.45,-0.10,g);
    at(rb(0.7,0.66,0.15,0.06,seatM,4),0,0.78,-0.40,g).rotation.x=-0.2;
    const engine=at(rb(0.72,0.46,0.50,0.06,armorD,4),0,0.62,-0.86,g);
    at(rb(0.60,0.32,0.03,0.015,steel),0,0.62,-1.115,g);
    for(let k=0;k<4;k++) at(rb(0.56,0.022,0.04,0.008,armorD),0,0.52+k*0.065,-1.135,g);
    at(rb(0.64,0.04,0.42,0.015,plate),0,0.865,-0.86,g);
    const stacks=[-1,1].map(s=>{
      const m=hdBell(steel,0.78,glowO); m.position.set(s*0.25,0.86,-0.92); m.rotation.set(-0.28,0,-s*0.08); g.add(m);
      at(new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.075,0.22,12,1,true),armorD),0,0.2,0,m); // pelindung panas
      return m;
    });
    // 6. lampu belakang + kait derek + paku keling
    [-1,1].forEach(s=>at(rb(0.14,0.06,0.03,0.012,tailM),s*0.5,0.45,-1.105,g));
    at(new THREE.Mesh(new THREE.TorusGeometry(0.06,0.018,6,14),steel),0,0.36,-1.14,g);
    const rivG=new THREE.SphereGeometry(0.022,8,6);
    [[-0.5,0.66,1.0],[0.5,0.66,1.0],[-0.5,0.70,0.3],[0.5,0.70,0.3],[-0.62,0.48,1.21],[0.62,0.48,1.21],[-0.2,0.48,1.235],[0.2,0.48,1.235]]
      .forEach(p=>at(new THREE.Mesh(rivG,steel),p[0],p[1],p[2],g));
    // 7. setir + roda baja 6 palang (rib) + pembalap helm baja berduri
    const sw=hdSteer(g,armorD,seatM,orange);
    hdWheels(g,refs,{x:0.80,z:0.65,r:0.31,w:0.30},{x:0.90,z:-0.70,r:0.44,w:0.44},
      {tire,rim:phong(0x8f99a5,60,0xcccccc),spoke:orange,hub:armorD},{spokes:6,ribbed:true},{spokes:6,ribbed:true});
    Object.assign(refs,hdRider(g,char,{helmet:'steel',helmMat:phong(0x6b7682,60,0xa0aab6),trimMat:armorD,
      spikes:phong(0x2e3540,50,0x777777),iris:0x2a5a8a}));
    const sparks=BK._sparkFX(g,stacks,36,{speedBase:2.2,speedRand:1.6,colors:[0xffe0a0,0xff7a1a,0x3a3a3a]});
    return hdFinish(g,refs,char,(time,dt,boosting,steer)=>{
      sw.rotation.z+=(steer*0.68-sw.rotation.z)*Math.min(1,dt*8);
      const sh=Math.sin(time*52)*0.012*(boosting?2.2:1);
      stacks[0].position.y=0.86+sh; stacks[1].position.y=0.86-sh;
      engine.position.y=0.62+Math.sin(time*15)*0.004;
      chassis.position.y=0.33+Math.sin(time*15)*0.003;
      sparks.update(time,dt,boosting);
    });
  };

  // ===== Hantu: "Kereta Arwah" — kart ramping, lentera pancing, ekor arwah, nisan =====
  BK.buildArwah=function(char){
    const g=new THREE.Group(), refs={wheels:[],eyes:[],stalks:[],orbs:[]};
    const TAU=Math.PI*2, V3=THREE.Vector3;
    const paint=new THREE.MeshPhysicalMaterial({color:0x2c2140,metalness:0.4,roughness:0.3,clearcoat:1,clearcoatRoughness:0.12});
    const paintDeep=new THREE.MeshPhysicalMaterial({color:0x171020,metalness:0.55,roughness:0.38,clearcoat:0.8,clearcoatRoughness:0.22});
    const accent=new THREE.MeshPhysicalMaterial({color:0x8b5cf6,metalness:0.35,roughness:0.28,clearcoat:1,
      clearcoatRoughness:0.16,emissive:0x3a1978,emissiveIntensity:0.55});
    const chrome=phong(0xcfc6e6,95,0xffffff);
    const stone=phong(0x4a4262,18,0x222233);
    const velvet=new THREE.MeshStandardMaterial({color:0x3a2456,roughness:0.8});
    const glow=basic(0xc26bff), cyan=basic(0x8ff0ff);
    const wisp=phong(0xe2d6ff,40,0xb79bff,{emissive:0x8a5ae0,emissiveIntensity:1.0,transparent:true,opacity:0.7,depthWrite:false});
    const tire=new THREE.MeshStandardMaterial({color:0x1b1920,roughness:0.92});

    // 1. sasis + moncong kapsul + splitter bertepi neon
    const chassis=at(rb(1.15,0.16,2.0,0.05,paintDeep,4),0,0.34,0,g);
    const nose=at(new THREE.Mesh(kartNoseGeo(),paint),0,0.54,0.42,g); nose.scale.set(1.0,0.5,1.15); nose.rotation.x=0.22;
    at(rb(0.14,0.03,0.7,0.014,accent),0,0.70,0.62,g).rotation.x=0.24;
    at(rb(1.2,0.045,0.32,0.02,paintDeep),0,0.30,1.12,g);
    at(rb(1.22,0.026,0.06,0.01,accent),0,0.315,1.285,g);
    // 2. pod samping + garis neon + ekor arwah melengkung jadi "sayap"
    [-1,1].forEach(s=>{
      at(rb(0.20,0.30,0.90,0.09,paint,4),s*0.55,0.44,-0.05,g);
      at(rb(0.03,0.04,0.7,0.012,glow),s*0.655,0.46,-0.05,g);
      g.add(new THREE.Mesh(taperedTube([new V3(s*0.52,0.50,-0.40),new V3(s*0.52,0.62,-0.95),new V3(s*0.48,0.95,-1.32),
        new V3(s*0.36,1.22,-1.30),new V3(s*0.29,1.26,-1.12),new V3(s*0.33,1.13,-1.02)],0.095,0.014,16,48),wisp));
    });
    // 3. jok beludru + mesin gelap + NISAN penutup mesin (lengkung atas, bertepi neon)
    at(rb(0.66,0.14,0.56,0.06,velvet,4),0,0.45,-0.10,g);
    at(rb(0.66,0.62,0.14,0.06,velvet,4),0,0.77,-0.38,g).rotation.x=-0.2;
    at(rb(0.56,0.36,0.44,0.06,paintDeep,4),0,0.58,-0.80,g);
    const tomb=new THREE.Shape(); tomb.moveTo(-0.27,0); tomb.lineTo(0.27,0); tomb.lineTo(0.27,0.30); tomb.absarc(0,0.30,0.27,0,Math.PI,false); tomb.lineTo(-0.27,0);
    const tombGeo=new THREE.ExtrudeGeometry(tomb,{depth:0.16,bevelEnabled:true,bevelThickness:0.025,bevelSize:0.025,bevelSegments:3,curveSegments:20});
    const tombM=at(new THREE.Mesh(tombGeo,stone),0,0.42,-1.12,g); tombM.rotation.x=-0.10;
    const crescent=at(new THREE.Mesh(new THREE.TorusGeometry(0.085,0.016,8,24,Math.PI*1.25),glow),0,0.78,-1.195,g);
    crescent.rotation.set(0,Math.PI,0.9);
    // 4. lentera pancing: tiang melengkung dari moncong, lentera berayun & berdenyut
    g.add(new THREE.Mesh(taperedTube([new V3(0,0.66,0.92),new V3(0,0.98,1.0),new V3(0,1.24,1.18),new V3(0,1.27,1.40)],0.032,0.018,12,30),chrome));
    const lantern=at(new THREE.Group(),0,1.27,1.40,g);
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.10,6),chrome),0,-0.05,0,lantern);
    const cage=new THREE.Group(); at(cage,0,-0.18,0,lantern);
    at(new THREE.Mesh(new THREE.ConeGeometry(0.075,0.06,12),chrome),0,0.085,0,cage);
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.065,0.03,12),chrome),0,-0.075,0,cage);
    for(let k=0;k<4;k++){ const a=k/4*TAU; at(new THREE.Mesh(new THREE.CylinderGeometry(0.007,0.007,0.15,5),chrome),Math.cos(a)*0.058,0,Math.sin(a)*0.058,cage); }
    const flameIn=at(new THREE.Mesh(new THREE.SphereGeometry(0.045,14,10),cyan),0,0,0,cage);
    const halo=at(new THREE.Mesh(new THREE.SphereGeometry(0.13,14,10),basic(0x9a7aff,{transparent:true,opacity:0.22,blending:THREE.AdditiveBlending,depthWrite:false})),0,0,0,cage);
    // 5. knalpot ikal (pipa melengkung + bell neon)
    const pipes=[-1,1].map(s=>{
      g.add(new THREE.Mesh(taperedTube([new V3(s*0.22,0.55,-0.98),new V3(s*0.34,0.58,-1.14),new V3(s*0.40,0.70,-1.27),new V3(s*0.40,0.82,-1.33)],0.045,0.055,12,24),chrome));
      const b=hdBell(chrome,0.62,glow); b.position.set(s*0.40,0.82,-1.33); b.rotation.set(-1.0,0,0); g.add(b);
      return b;
    });
    // 6. roda velg neon (lis ungu menyala)
    hdWheels(g,refs,{x:0.80,z:0.65,r:0.30,w:0.28},{x:0.85,z:-0.70,r:0.42,w:0.40},
      {tire,rim:chrome,spoke:paint,hub:accent},{spokes:5,ring:glow},{spokes:5,ring:glow});
    // 7. pembalap: siput arwah tembus-pandang, tangkai mata beriris, cangkang spiral turbinat
    const skinTex=hantuSkinTex();
    const skin=new THREE.MeshPhysicalMaterial({color:0x9c8ecf,map:skinTex,roughness:0.56,clearcoat:0.08,
      transparent:true,opacity:0.93,emissive:0x140b26,emissiveIntensity:0.3});
    const skinH=new THREE.MeshPhysicalMaterial({color:0xbcafe8,map:skinTex,roughness:0.5,clearcoat:0.12,
      transparent:true,opacity:0.96,emissive:0x1b112f,emissiveIntensity:0.3});
    const st=hantuShellTex();
    const shellMat=new THREE.MeshPhysicalMaterial({map:st.map,bumpMap:st.bump,bumpScale:0.014,roughness:0.52,
      clearcoat:0.12,clearcoatRoughness:0.62,emissive:0x180c2e,emissiveIntensity:0.26});
    const shell=new THREE.Group(); shell.position.set(0,1.10,-0.50); shell.rotation.set(-0.30,0.25,-0.08); shell.scale.setScalar(0.62);
    shell.add(new THREE.Mesh(hantuShellGeo().geo,shellMat));
    at(new THREE.Mesh(new THREE.ConeGeometry(0.058,0.13,18),shellMat),0,0.555,0,shell);
    Object.assign(refs,hdRider(g,char,{helmet:'none',skin,skinHead:skinH,shell,iris:0x6c4bff}));
    // 8. mote arwah melayang (partikel mungil, tanpa getar kamera)
    const orbMat=basic(0xba8cff,{transparent:true,opacity:0.55,blending:THREE.AdditiveBlending,depthWrite:false});
    const orbGeo=new THREE.SphereGeometry(1,10,8);
    for(let k=0;k<6;k++){
      const m=new THREE.Mesh(orbGeo,orbMat); m.scale.setScalar(0.022+Math.random()*0.03);
      const a=Math.random()*TAU, rr=0.55+Math.random()*0.45, y=0.9+Math.random()*0.7;
      g.add(m); refs.orbs.push({mesh:m,angle:a,radius:rr,y,speed:0.25+Math.random()*0.45,phase:Math.random()*TAU});
    }
    const sparks=BK._sparkFX(g,pipes,34,{speedBase:2.0,speedRand:1.4,colors:[0xf0d8ff,0xa060ff,0x302040]});
    return hdFinish(g,refs,char,(time,dt,boosting,steer,speed)=>{
      refs.orbs.forEach(o=>{ const a=o.angle+time*o.speed;
        o.mesh.position.set(Math.cos(a)*o.radius,o.y+Math.sin(time*1.6+o.phase)*0.08,-0.4+Math.sin(a)*o.radius*0.7); });
      lantern.rotation.x=Math.sin(time*2.3)*0.14-Math.min(0.35,Math.abs(speed||0)*0.008);
      lantern.rotation.z=Math.sin(time*1.7)*0.08-(steer||0)*0.12;
      const p=0.85+Math.sin(time*5.0)*0.15+(boosting?0.25:0);
      flameIn.scale.setScalar(p); halo.scale.setScalar(0.9+p*0.25);
      shell.scale.setScalar(0.62*(1+Math.sin(time*4)*0.015));
      chassis.position.y=0.34+Math.sin(time*15)*0.003;
      sparks.update(time,dt,boosting);
    });
  };

  // ===== Spora: "Kereta Jamur" — bodi topi jamur bertotol, spoiler jamur raksasa, pod batang kayu =====
  BK.buildJamur=function(char){
    const g=new THREE.Group(), refs={wheels:[],eyes:[],stalks:[]};
    const TAU=Math.PI*2;
    const capM=phong(0xffffff,40,0x553333,{map:spotTex('#c8352c','#fff3e0')});
    const cream=phong(0xf2e6c9,25,0x444444);
    const bark=phong(0xffffff,10,0x111111,{map:barkTex()});
    const woodD=phong(0x6a4426,15,0x222222);
    const rings=phong(0xffffff,10,0x111111,{map:ringTex()});
    const moss=phong(0x4f8a3a,12,0x223322);
    const leaf=phong(0x63ad48,20,0x335533,{side:THREE.DoubleSide});
    const gill=phong(0xffffff,10,0x222222,{map:gillTex(),side:THREE.DoubleSide});
    const bio=basic(0x7cfc9a), bio2=basic(0xa8fff0);
    const tire=new THREE.MeshStandardMaterial({color:0x2a231d,roughness:0.92});

    // daun pipih (ShapeGeometry, dipakai di sulur, mahkota)
    const lf=new THREE.Shape(); lf.moveTo(0,0); lf.quadraticCurveTo(0.06,0.05,0,0.14); lf.quadraticCurveTo(-0.06,0.05,0,0);
    const leafGeo=new THREE.ShapeGeometry(lf,6);
    const addLeaf=(x,y,z,ry,rz,sc)=>{ const m=at(new THREE.Mesh(leafGeo,leaf),x,y,z,g); m.rotation.set(-0.6,ry,rz); m.scale.setScalar(sc||1); return m; };
    // jamur mini (lampu, hiasan pod, mahkota)
    const capG=new THREE.SphereGeometry(1,20,10,0,TAU,0,Math.PI*0.5);
    const miniShroom=(parent,x,y,z,h,r,cm)=>{
      const s=at(new THREE.Group(),x,y,z,parent);
      at(new THREE.Mesh(new THREE.CylinderGeometry(r*0.35,r*0.45,h,10),cream),0,h/2,0,s);
      const c=at(new THREE.Mesh(capG,cm||capM),0,h,0,s); c.scale.set(r,r*0.7,r);
      return s;
    };

    // 1. sasis kayu + moncong topi jamur bertotol
    const chassis=at(rb(1.2,0.16,2.0,0.05,woodD,4),0,0.34,0,g);
    const nose=at(new THREE.Mesh(kartNoseGeo(),capM),0,0.55,0.42,g); nose.scale.set(1.05,0.55,1.05); nose.rotation.x=0.22;
    // 2. bumper akar + lampu jamur bioluminesen di ujungnya
    g.add(tubeMesh([[-0.62,0.28,1.04],[-0.30,0.38,1.22],[0,0.40,1.25],[0.30,0.38,1.22],[0.62,0.28,1.04]],0.05,bark,40,10));
    const lamps=[-1,1].map(s=>{
      const sh=miniShroom(g,s*0.46,0.33,1.15,0.13,0.10,bio);
      at(new THREE.Mesh(new THREE.CircleGeometry(0.095,16),gill),0,0.128,0,sh).rotation.x=Math.PI/2;
      addLeaf(s*0.60,0.32,1.08,s*0.8,s*0.5,1.1);
      return sh;
    });
    // 3. pod batang kayu (kulit + irisan cincin tahun) + lumut + jamur mini
    [-1,1].forEach(s=>{
      const log=at(new THREE.Group(),s*0.49,0.45,-0.02,g);
      const cyl=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.84,18,1,true),bark); cyl.rotation.x=Math.PI/2; log.add(cyl);
      [1,-1].forEach(e=>{ const c=at(new THREE.Mesh(new THREE.CircleGeometry(0.16,18),rings),0,0,e*0.42,log); c.rotation.y=e>0?0:Math.PI; });
      const ms=at(new THREE.Mesh(new THREE.SphereGeometry(1,16,10),moss),0,0.14,0.05,log); ms.scale.set(0.11,0.045,0.30);
      miniShroom(log,s*0.03,0.13,-0.22,0.08,0.055);
      miniShroom(log,s*0.06,0.12,-0.12,0.05,0.035);
      // sulur menyusuri pod
      g.add(tubeMesh([[s*0.52,0.34,1.0],[s*0.50,0.56,0.55],[s*0.44,0.64,0.12],[s*0.50,0.62,-0.30],[s*0.42,0.74,-0.78]],0.022,moss,40,8));
      addLeaf(s*0.50,0.60,0.40,s*1.2,s*0.6,0.9); addLeaf(s*0.47,0.66,-0.10,-s*0.6,-s*0.5,0.8); addLeaf(s*0.46,0.70,-0.58,s*1.0,s*0.7,0.9);
    });
    // 4. jok krem + mesin akar berlumut
    at(rb(0.66,0.14,0.56,0.06,cream,4),0,0.45,-0.10,g);
    at(rb(0.66,0.62,0.14,0.06,cream,4),0,0.77,-0.38,g).rotation.x=-0.2;
    at(rb(0.58,0.42,0.46,0.07,woodD,4),0,0.60,-0.92,g);
    const em=at(new THREE.Mesh(new THREE.SphereGeometry(1,16,10),moss),0,0.81,-0.92,g); em.scale.set(0.27,0.06,0.21);
    // 5. SPOILER topi jamur raksasa di atas tangkai + insang bawah
    const capGroup=at(new THREE.Group(),0,0.80,-1.08,g);
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.11,0.52,14),cream),0,0.26,0,capGroup);
    const ann=at(new THREE.Mesh(new THREE.TorusGeometry(0.09,0.018,6,16),cream),0,0.36,0,capGroup); ann.rotation.x=Math.PI/2;
    const bigCap=at(new THREE.Mesh(new THREE.SphereGeometry(0.58,36,14,0,TAU,0,Math.PI*0.5),capM),0,0.50,0,capGroup);
    bigCap.scale.set(1,0.46,0.68);
    const under=at(new THREE.Mesh(new THREE.CircleGeometry(0.58,36),gill),0,0.50,0,capGroup); under.rotation.x=Math.PI/2; under.scale.set(1,0.68,1);
    // 6. knalpot bola-spora: batang melengkung + bola puff menyala (titik api boost)
    const puffG=new THREE.SphereGeometry(0.10,16,12);
    const puffs=[-1,1].map(s=>{
      g.add(tubeMesh([[s*0.26,0.62,-1.12],[s*0.36,0.66,-1.22],[s*0.44,0.78,-1.30]],0.03,moss,16,8));
      const p=new THREE.Mesh(puffG,cream); p.scale.set(1,0.9,1); p.position.set(s*0.44,0.80,-1.31); p.rotation.set(-0.9,0,0);
      const ring=at(new THREE.Mesh(new THREE.TorusGeometry(0.045,0.014,6,14),bio),0,0.088,0,p); ring.rotation.x=Math.PI/2;
      at(new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.02,10),basic(0x10200f)),0,0.092,0,p);
      g.add(p); return p;
    });
    // 7. setir ranting + roda kayu 6 palang berlis hijau
    const sw=hdSteer(g,woodD,bark,bio);
    hdWheels(g,refs,{x:0.80,z:0.65,r:0.30,w:0.28},{x:0.85,z:-0.70,r:0.42,w:0.40},
      {tire,rim:phong(0x9c6b3e,30,0x332211),spoke:cream,hub:moss},{spokes:6,ring:bio},{spokes:6,ring:bio});
    // 8. Ratu Spora: cangkang bertotol, tangkai mata, mahkota daun + 3 jamur mini
    Object.assign(refs,hdRider(g,char,{helmet:'none',iris:0x2f9a4a,
      shellMat:phong(0xffffff,60,0x664444,{map:spotTex('#c8352c','#fff3e0')})}));
    const crown=at(new THREE.Group(),0,1.13,0.04,g);
    const band=new THREE.Mesh(new THREE.TorusGeometry(0.20,0.022,8,30),moss); band.rotation.x=Math.PI/2; crown.add(band);
    [-0.75,0,0.75].forEach((a,i)=>{
      miniShroom(crown,Math.sin(a)*0.20,0.0,Math.cos(a)*0.20,i===1?0.11:0.08,i===1?0.065:0.05);
    });
    [-1.6,1.6].forEach(a=>{ const m=at(new THREE.Mesh(leafGeo,leaf),Math.sin(a)*0.2,0.0,Math.cos(a)*0.2,crown); m.rotation.set(-0.3,a,0); });
    refs.hatAt=new THREE.Vector3(0,1.36,0.04);
    const sparks=BK._sparkFX(g,puffs,34,{speedBase:1.8,speedRand:1.3,colors:[0xe8ffd0,0x7cfc9a,0x3a5a3a]});
    return hdFinish(g,refs,char,(time,dt,boosting,steer)=>{
      sw.rotation.z+=(steer*0.68-sw.rotation.z)*Math.min(1,dt*8);
      capGroup.rotation.z=Math.sin(time*2.1)*0.035-(steer||0)*0.05;
      capGroup.rotation.x=Math.sin(time*1.6)*0.025;
      const k=0.5+0.5*Math.sin(time*3.2);
      bio.color.setRGB(0.40+0.2*k,0.85+0.14*k,0.55+0.2*k);
      lamps.forEach((l,i)=>l.rotation.z=Math.sin(time*3+i)*0.05);
      chassis.position.y=0.34+Math.sin(time*15)*0.003;
      sparks.update(time,dt,boosting);
    });
  };

  // ===== Bara: "Tank Lava" — lambung basal beretak magma, tanduk, cerobong gunung api, panji =====
  BK.buildLava=function(char){
    const g=new THREE.Group(), refs={wheels:[],eyes:[],stalks:[]};
    const V3=THREE.Vector3;
    const lt=lavaTex();
    const rock=phong(0xffffff,30,0x332222,{map:lt.map,emissiveMap:lt.emi,emissive:0xff6a2a,emissiveIntensity:0.9});
    const iron=phong(0x3a302e,40,0x554444);
    const ironD=phong(0x231c1b,60,0x665555);
    const brass=phong(0xc08a2e,80,0xffe0a0);
    const leather=new THREE.MeshStandardMaterial({color:0x3a2420,roughness:0.8});
    const hot=basic(0xff7a2a), hotCore=basic(0xffd060);
    const tire=new THREE.MeshStandardMaterial({color:0x1a1515,roughness:0.92});

    // 1. sasis besi + lambung baji basal (extrude profil samping)
    const chassis=at(rb(1.30,0.18,2.15,0.05,iron,4),0,0.33,-0.02,g);
    const prof=new THREE.Shape();
    prof.moveTo(-0.15,0); prof.lineTo(1.22,0); prof.lineTo(1.24,0.07); prof.lineTo(0.25,0.32); prof.lineTo(-0.15,0.32); prof.lineTo(-0.15,0);
    const hullGeo=new THREE.ExtrudeGeometry(prof,{depth:1.0,bevelEnabled:true,bevelThickness:0.04,bevelSize:0.04,bevelSegments:2});
    hullGeo.rotateY(-Math.PI/2); hullGeo.translate(0.5,0,0);
    at(new THREE.Mesh(hullGeo,rock),0,0.40,0,g);
    at(rb(0.08,0.04,0.95,0.015,brass),0,0.625,0.735,g).rotation.x=0.245;
    // 2. tanduk obsidian melengkung + ujung membara
    [-1,1].forEach(s=>{
      g.add(new THREE.Mesh(taperedTube([new V3(s*0.42,0.52,0.98),new V3(s*0.60,0.58,1.12),new V3(s*0.68,0.74,1.24),new V3(s*0.62,0.88,1.32)],0.075,0.016,14,30),ironD));
      at(new THREE.Mesh(new THREE.SphereGeometry(0.02,8,6),hotCore),s*0.62,0.885,1.32,g);
      at(new THREE.Mesh(new THREE.TorusGeometry(0.075,0.018,6,16),brass),s*0.47,0.535,1.02,g).rotation.y=s*0.9;
    });
    // 3. pelat bahu samping: basal + lis kuningan + paku keling + duri
    const rivG=new THREE.SphereGeometry(0.024,8,6), spikeG=new THREE.ConeGeometry(0.045,0.14,8);
    [-1,1].forEach(s=>{
      at(rb(0.22,0.30,0.70,0.05,rock,4),s*0.56,0.47,-0.05,g);
      at(rb(0.23,0.03,0.72,0.012,brass),s*0.565,0.625,-0.05,g);
      [-0.30,-0.05,0.20].forEach(z=>at(new THREE.Mesh(rivG,brass),s*0.672,0.53,z,g));
      [0.18,-0.08].forEach(z=>{ const c=at(new THREE.Mesh(spikeG,ironD),s*0.73,0.42,z,g); c.rotation.z=-s*Math.PI/2; });
      hdFender(g,s*0.90,0.44,-0.70,0.54,0.48,iron,brass); // spatbor belakang
    });
    // 4. jok kulit + mesin besi + jendela magma belakang
    at(rb(0.7,0.15,0.6,0.06,leather,4),0,0.45,-0.10,g);
    at(rb(0.7,0.66,0.15,0.06,leather,4),0,0.78,-0.40,g).rotation.x=-0.2;
    [-1,1].forEach(s=>at(new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.66,8),brass),s*0.35,0.79,-0.42,g).rotation.x=-0.2);
    const engine=at(rb(0.50,0.44,0.50,0.06,iron,4),0,0.60,-0.86,g);
    at(rb(0.36,0.08,0.03,0.012,hot),0,0.62,-1.115,g);
    at(rb(0.44,0.04,0.04,0.012,brass),0,0.68,-1.115,g);
    // 5. cerobong gunung api (lathe kerucut + kawah menyala) = titik api boost
    const stackG=new THREE.LatheGeometry(V2([[0.20,0],[0.175,0.22],[0.135,0.46],[0.115,0.60],[0.135,0.65],[0.10,0.672],[0.085,0.62]]),22);
    const stacks=[-1,1].map(s=>{
      const m=new THREE.Mesh(stackG,rock); m.position.set(s*0.27,0.62,-0.95); m.rotation.set(-0.22,0,-s*0.06); g.add(m);
      at(new THREE.Mesh(new THREE.CylinderGeometry(0.088,0.088,0.02,14),hotCore),0,0.63,0,m);
      const rim=at(new THREE.Mesh(new THREE.TorusGeometry(0.118,0.014,6,18),hot),0,0.655,0,m); rim.rotation.x=Math.PI/2;
      const bnd=at(new THREE.Mesh(new THREE.TorusGeometry(0.168,0.016,6,18),brass),0,0.20,0,m); bnd.rotation.x=Math.PI/2;
      return m;
    });
    // 6. panji perang di tiang kuningan (berkibar)
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.022,1.12,8),brass),-0.58,1.03,-1.08,g);
    at(new THREE.Mesh(new THREE.SphereGeometry(0.04,10,8),brass),-0.58,1.60,-1.08,g);
    const flagGeo=new THREE.PlaneGeometry(0.46,0.30,10,4); flagGeo.rotateY(Math.PI/2); flagGeo.translate(0,0,-0.23);
    const flagBase=Float32Array.from(flagGeo.attributes.position.array);
    const flag=at(new THREE.Mesh(flagGeo,phong(0xffffff,10,0x111111,{map:bannerTex(),side:THREE.DoubleSide})),-0.58,1.40,-1.10,g);
    // 7. setir besi + roda: depan 5 palang, belakang rib + duri hub, lis magma
    const sw=hdSteer(g,ironD,leather,brass);
    hdWheels(g,refs,{x:0.80,z:0.65,r:0.31,w:0.30},{x:0.90,z:-0.70,r:0.44,w:0.44},
      {tire,rim:phong(0x3a302e,50,0x665555),spoke:brass,hub:ironD},{spokes:5,ring:hot},{spokes:5,ribbed:true,ring:hot,studs:ironD});
    // 8. Jenderal Bara: helm jenderal (paku + jambul + lencana), cangkang berduri
    Object.assign(refs,hdRider(g,char,{helmet:'general',helmMat:phong(0x2e2624,60,0x776666),trimMat:ironD,
      brassMat:brass,plumeMat:phong(0xd23a1e,20),spikes:ironD,iris:0xff6a1e}));
    const sparks=BK._sparkFX(g,stacks,44,{speedBase:2.4,speedRand:1.8,colors:[0xffe080,0xff4a10,0x2a2020]});
    const fp=flagGeo.attributes.position;
    return hdFinish(g,refs,char,(time,dt,boosting,steer,speed)=>{
      sw.rotation.z+=(steer*0.68-sw.rotation.z)*Math.min(1,dt*8);
      rock.emissiveIntensity=0.75+0.22*Math.sin(time*2.6)+(boosting?0.35:0);
      const amp=0.035+Math.min(0.05,Math.abs(speed||0)*0.0015);
      for(let i=0;i<fp.count;i++){
        const z=flagBase[i*3+2];
        fp.setX(i,flagBase[i*3]+Math.sin(time*7+z*9)*amp*(-z/0.46));
      }
      fp.needsUpdate=true;
      engine.position.y=0.60+Math.sin(time*13)*0.004;
      chassis.position.y=0.33+Math.sin(time*15)*0.003;
      sparks.update(time,dt,boosting);
    });
  };

  // pilihan rig: field `rig` → builder HD; tanpa rig (Turbo) = kart siput klasik pemula
  const RIGS={kart:'buildKart',juara:'buildJuara',buggy:'buildBuggy',benteng:'buildBenteng',arwah:'buildArwah',jamur:'buildJamur',lava:'buildLava'};
  BK.buildRig=function(c){ const fn=c.rig&&BK[RIGS[c.rig]]; return fn?fn(c):BK.buildSnail(c); };

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
