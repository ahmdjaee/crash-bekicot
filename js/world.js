/* World: trek + jalan detail + bangunan + langit. API balap tetap sama. Semua prosedural, offline. */
(function(){
  function sampleCenterline(def, N){
    const v3 = def.pts.map(p=>new THREE.Vector3(p[0],p[2]||0,p[1]));
    const curve = new THREE.CatmullRomCurve3(v3, true, 'catmullrom', 0.6);
    const pts = curve.getSpacedPoints(N);
    pts.pop();
    return pts;
  }

  // --- material cache ---
  const matCache={};
  function M(color){ if(!matCache[color]) matCache[color]=new THREE.MeshLambertMaterial({color}); return matCache[color]; }
  function BM(color, opacity){
    return new THREE.MeshBasicMaterial({color, transparent:opacity<1, opacity, fog:false});
  }

  // --- tekstur kanvas prosedural (offline) ---
  function canvasTex(w,h,draw){
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    draw(c.getContext('2d'),w,h);
    const t=new THREE.CanvasTexture(c); t.anisotropy=4;
    return t;
  }
  function checkerTexture(){
    return canvasTex(128,32,(g,w,h)=>{
      const cw=w/8, ch=h/2;
      for(let y=0;y<2;y++)for(let x=0;x<8;x++){ g.fillStyle=(x+y)%2?'#111':'#fff'; g.fillRect(x*cw,y*ch,cw,ch); }
    });
  }

  function chevronTexture(){
    const t=canvasTex(128,128,(g,w,h)=>{
      g.clearRect(0,0,w,h);
      g.strokeStyle='#fff'; g.lineWidth=14; g.lineCap='round';
      for(let k=0;k<2;k++){ const y=20+k*52;
        g.beginPath(); g.moveTo(14,y+34); g.lineTo(w/2,y); g.lineTo(w-14,y+34); g.stroke(); }
    });
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1,2);
    return t;
  }
  // tekstur ringan 128px (sekali buat, diulang) — biar tidak polos, tetap murah
  function speckle(base, dots, n){
    return canvasTex(128,128,(g,w,h)=>{
      g.fillStyle=base; g.fillRect(0,0,w,h);
      for(let i=0;i<(n||260);i++){
        g.fillStyle=dots[(Math.random()*dots.length)|0];
        const r=1+Math.random()*2.2;
        g.fillRect(Math.random()*w,Math.random()*h,r,r);
      }
    });
  }
  let _asphalt=null, _noise=null, _snow=null, _sand=null, _dirtRoad=null, _forestSoil=null;
  function asphaltTex(){ if(!_asphalt){ _asphalt=speckle('#8a8f9c',['#7a7f8c','#9aa0ac','#6e737e']); _asphalt.wrapS=_asphalt.wrapT=THREE.RepeatWrapping; } return _asphalt; }
  function groundTex(){ if(!_noise){ _noise=speckle('#ffffff',['#e8e8e8','#f4f4f4','#dcdcdc']); _noise.wrapS=_noise.wrapT=THREE.RepeatWrapping; _noise.repeat.set(28,28); } return _noise; }
  function snowTex(){ if(!_snow){ _snow=speckle('#fbfdff',['#eaf3fb','#ffffff','#dde9f5'],320); _snow.wrapS=_snow.wrapT=THREE.RepeatWrapping; _snow.repeat.set(24,24); } return _snow; }
  function sandTex(){ if(!_sand){ _sand=speckle('#edd8a1',['#dfC688','#f7e7ba','#cfa86b','#ffffff'],340); _sand.wrapS=_sand.wrapT=THREE.RepeatWrapping; _sand.repeat.set(1,6); } return _sand; }
  // tekstur jalan tanah & kerikil (jejak ban + batu kerikil + tepi berumput)
  function dirtRoadTex(){
    if(_dirtRoad) return _dirtRoad;
    _dirtRoad=canvasTex(128,128,(g,w,h)=>{
      g.fillStyle='#8c6d46'; g.fillRect(0,0,w,h);
      // tepi tanah lembap & lumut tipis di pinggir jalan (v=0 dan v=1)
      g.fillStyle='#5c472c'; g.fillRect(0,0,w,14); g.fillRect(0,h-14,w,14);
      g.fillStyle='#4a6b32'; g.fillRect(0,0,w,5); g.fillRect(0,h-5,w,5);
      // 2 jalur jejak roda (wheel ruts) yang lebih padat
      g.fillStyle='#785a37'; g.fillRect(0,28,w,20); g.fillRect(0,h-48,w,20);
      // sebaran kerikil (pebbles) terang & gelap
      const cols=['#b89b72','#634b2e','#d1b894','#4f3b22','#a3845b','#7a7368'];
      let s=9127; const rnd=()=>((s=(s*16807)%2147483647)/2147483647);
      for(let i=0;i<420;i++){
        g.fillStyle=cols[(rnd()*cols.length)|0];
        const rx=rnd()*w, ry=rnd()*h, rw=1+rnd()*3.2, rh=1+rnd()*2.4;
        g.fillRect(rx,ry,rw,rh);
      }
    });
    _dirtRoad.wrapS=_dirtRoad.wrapT=THREE.RepeatWrapping;
    return _dirtRoad;
  }
  // tekstur tanah hutan berkerikil & serasah daun
  function forestSoilTex(){
    if(_forestSoil) return _forestSoil;
    _forestSoil=speckle('#e6dec8',['#c7ba9b','#f2ead5','#a69676','#8c7d5e','#b5c496'],380);
    _forestSoil.wrapS=_forestSoil.wrapT=THREE.RepeatWrapping; _forestSoil.repeat.set(28,28);
    return _forestSoil;
  }
  // value-noise FBM deterministik (seed tetap: visual = fisika = minimap)
  function makeNoise2D(seed){
    const perm=[...Array(256).keys()];
    let s=seed;
    const rnd=()=> (s=(s*16807)%2147483647)/2147483647;
    for(let i=255;i>0;i--){ const j=(rnd()*(i+1))|0; const t=perm[i]; perm[i]=perm[j]; perm[j]=t; }
    const p=new Uint8Array(512);
    for(let i=0;i<512;i++)p[i]=perm[i&255];
    const fade=t=>t*t*(3-2*t);
    const n2=(x,y)=>{
      const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
      const h=(X,Y)=>p[(p[X&255]+(Y&255))&511]/255;
      const u=fade(xf), v=fade(yf);
      return (h(xi,yi)*(1-u)+h(xi+1,yi)*u)*(1-v)+(h(xi,yi+1)*(1-u)+h(xi+1,yi+1)*u)*v;
    };
    return function(x,y,oct){
      let v=0,amp=0.5,f=1,sum=0;
      const n=oct||3;
      for(let i=0;i<n;i++){ v+=n2(x*f,y*f)*amp; sum+=amp; amp*=0.5; f*=2.03; }
      return v/sum;
    };
  }
  const fbm2=makeNoise2D(1337);
  let _soft=null;
  function softTex(){
    if(_soft) return _soft;
    _soft=canvasTex(128,128,(g,w,h)=>{
      const grd=g.createRadialGradient(64,64,4,64,64,62);
      grd.addColorStop(0,'rgba(255,255,255,1)');
      grd.addColorStop(0.7,'rgba(255,255,255,.5)');
      grd.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=grd; g.fillRect(0,0,w,h);
    });
    return _soft;
  }
  function pavingTex(){
    const t=canvasTex(128,128,(g,w,h)=>{
      g.fillStyle='#cfcfd6'; g.fillRect(0,0,w,h);
      g.strokeStyle='#8a8a92'; g.lineWidth=4;
      for(let i=0;i<=4;i++){
        g.beginPath(); g.moveTo(i*32,0); g.lineTo(i*32,h); g.stroke();
        g.beginPath(); g.moveTo(0,i*32); g.lineTo(w,i*32); g.stroke();
      }
      for(let i=0;i<120;i++){ g.fillStyle='#b9b9c2'; g.fillRect(Math.random()*w,Math.random()*h,2,2); }
    });
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(7,7);
    return t;
  }
  function waterTex(){
    const t=speckle('#3aa5c4',['#6fd0ea','#2a8db0','#9fe2f5'],200);
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(40,40);
    return t;
  }
  let _sandR=null;
  function sandRippleTex(){ // riak angin + butir pasir; putih-ish agar dikalikan warna vertex
    if(_sandR) return _sandR;
    _sandR=canvasTex(512,512,(g,w,h)=>{
      g.fillStyle='#f4f1ea'; g.fillRect(0,0,w,h);
      for(let y=0;y<h;y+=2){ // riak bergelombang, dibuat tileable (periode = lebar)
        const a=0.5+0.5*Math.sin(y/h*Math.PI*2*14);
        g.fillStyle=`rgba(150,128,90,${(a*a*0.10).toFixed(3)})`;
        for(let x=0;x<w;x+=8){ const off=Math.sin(x/w*Math.PI*2*3)*6; g.fillRect(x,(y+off+h)%h,8,2); }
      }
      for(let i=0;i<9000;i++){ const c=Math.random(); g.fillStyle=c<0.45?'rgba(120,100,70,.18)':c<0.9?'rgba(255,255,255,.35)':'rgba(70,60,50,.25)'; g.fillRect(Math.random()*w,Math.random()*h,1+(c>0.97?1:0),1); }
    });
    _sandR.wrapS=_sandR.wrapT=THREE.RepeatWrapping;
    return _sandR;
  }
  // aspal pantai: u = sepanjang jalan (berulang), v = melintang (0..1 tepi ke tepi, tak berulang).
  // garis tepi putih, jejak ban di 2 jalur balap, debu pasir tertiup ke pinggir, retak halus.
  let _beachRoad=null;
  function beachRoadTex(){
    if(_beachRoad) return _beachRoad;
    _beachRoad=canvasTex(512,256,(g,w,h)=>{
      g.fillStyle='#5f636c'; g.fillRect(0,0,w,h);
      for(let i=0;i<14000;i++){ const c=Math.random(); // agregat batu aspal
        g.fillStyle=c<0.4?'rgba(40,42,48,.5)':c<0.8?'rgba(140,144,152,.35)':'rgba(190,170,130,.3)';
        g.fillRect(Math.random()*w,Math.random()*h,1+(c>0.95?1:0),1); }
      [[0.30,0.07],[0.70,0.07]].forEach(([v,bw])=>{ // jejak ban gelap & sedikit mengkilap
        const y=v*h, gr=g.createLinearGradient(0,y-bw*h,0,y+bw*h);
        gr.addColorStop(0,'rgba(30,30,36,0)'); gr.addColorStop(0.5,'rgba(30,30,36,.30)'); gr.addColorStop(1,'rgba(30,30,36,0)');
        g.fillStyle=gr; g.fillRect(0,y-bw*h,w,bw*2*h); });
      g.strokeStyle='rgba(35,36,40,.22)'; g.lineWidth=1; // retak rambut (dibungkus horizontal agar tileable)
      for(let i=0;i<10;i++){ let x=Math.random()*w, y=h*0.15+Math.random()*h*0.7; g.beginPath(); g.moveTo(x,y);
        for(let k=0;k<6;k++){ x+=6+Math.random()*14; y+=(Math.random()-0.5)*10; g.lineTo(x%w,y); if(x>w){ g.stroke(); g.beginPath(); g.moveTo(x%w,y); x%=w; } } g.stroke(); }
      [[0,1],[h,-1]].forEach(([y0,d])=>{ // debu pasir di pinggir (gradasi + butir)
        const gr=g.createLinearGradient(0,y0,0,y0+d*h*0.2);
        gr.addColorStop(0,'rgba(222,200,150,.75)'); gr.addColorStop(1,'rgba(222,200,150,0)');
        g.fillStyle=gr; g.fillRect(0,Math.min(y0,y0+d*h*0.2),w,h*0.2);
        for(let i=0;i<1600;i++){ const t=Math.pow(Math.random(),2.2)*h*0.22; g.fillStyle='rgba(230,210,160,.55)'; g.fillRect(Math.random()*w,y0+d*t,2,1); } });
      g.fillStyle='rgba(245,243,235,.92)'; g.fillRect(0,h*0.075,w,h*0.035); g.fillRect(0,h*0.89,w,h*0.035); // garis tepi putih
      for(let i=0;i<220;i++){ g.fillStyle='rgba(95,99,108,.6)'; const y=Math.random()<0.5?h*0.075:h*0.89; g.fillRect(Math.random()*w,y+Math.random()*h*0.035,2+Math.random()*4,1.5); } // cat aus
    });
    _beachRoad.wrapS=THREE.RepeatWrapping; _beachRoad.anisotropy=8;
    return _beachRoad;
  }
  function pathTex(){
    const t=speckle('#cbb489',['#b89a6e','#e0cda3','#a78d60'],300);
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1,6);
    return t;
  }
  let _feather=null;
  function featherTex(){ // alpha tepi jalan: tengah penuh, sisi baur
    if(_feather) return _feather;
    _feather=canvasTex(64,64,(g,w,h)=>{
      const grd=g.createLinearGradient(0,0,w,0);
      grd.addColorStop(0,'#000000'); grd.addColorStop(0.18,'#ffffff');
      grd.addColorStop(0.82,'#ffffff'); grd.addColorStop(1,'#000000');
      g.fillStyle=grd; g.fillRect(0,0,w,h);
    });
    return _feather;
  }
  function bannerTexture(main, sub, bg, fg){
    return canvasTex(512,128,(g,w,h)=>{
      g.fillStyle=bg; g.fillRect(0,0,w,h);
      g.strokeStyle=fg; g.lineWidth=8; g.strokeRect(6,6,w-12,h-12);
      g.fillStyle=fg; g.textAlign='center'; g.font='900 52px Arial';
      g.fillText(main, w/2, sub?68:84);
      if(sub){ g.font='700 30px Arial'; g.fillText(sub, w/2, 106); }
    });
  }

  BK.buildWorld = function(scene, def){
    const N = BK.Config.samples;
    const pts = sampleCenterline(def, N);
    // RAMP LOMPAT ASIMETRIS (gaya ski-jump: tanjakan mulus menuju bibir ramp, lalu turunan curam di balik bibir agar terbang tinggi di udara!)
    const rampsList={
      pantai:[[52,1.7,7],[116,2.5,8]],
      hutan:[[46,1.8,7],[148,2.7,8]],
      kawah:[[58,1.8,7],[138,2.5,7]],
      salju:[[64,1.9,7],[108,2.7,8]]
    }[def.id]||[];
    for(const rc of rampsList){
      const RI=rc[0], RH=rc[1], RW=rc[2];
      for(let i=0;i<N;i++){
        let delta=i-RI;
        if(delta>N/2) delta-=N;
        if(delta<-N/2) delta+=N;
        if(delta<=0){
          // Sisi nanjak menuju bibir ramp (delta -RW*1.5 .. 0)
          pts[i].y += RH * Math.exp(-(delta*delta)/(RW*RW));
        } else {
          // Sisi lepas landas di balik bibir (turun cepat + sedikit cekungan pendaratan agar hang-time terasa jauh & nyata!)
          const rwDown = RW * 0.34;
          const drop = RH * Math.exp(-(delta*delta)/(rwDown*rwDown));
          const dip  = -0.42 * RH * Math.exp(-Math.pow((delta - RW*0.75)/(RW*0.55), 2));
          pts[i].y += drop + dip;
        }
      }
    }
    for(let i=0;i<N;i++) if(pts[i].y<0.25) pts[i].y=0.25;
    let trackLen=0;
    for(let li=0;li<N;li++) trackLen+=pts[li].distanceTo(pts[(li+1)%N]);
    const group = new THREE.Group();
    scene.add(group);
    scene.background = new THREE.Color(def.sky);
    scene.fog = new THREE.Fog(def.fog, 120, 420);

    const tangents=[], normals=[];
    for(let i=0;i<N;i++){
      const a=pts[i], b=pts[(i+1)%N];
      const t=new THREE.Vector3().subVectors(b,a); t.y=0; t.normalize();
      tangents.push(t);
      normals.push(new THREE.Vector3(-t.z,0,t.x)); // + = sisi kanan trek
    }
    const W = def.width, half=W/2;
    const anim={clouds:[],flags:[],crowd:[],lava:[],glow:[]};
    const colliders=[]; // diisi BK.placeProp: [{x,z,r}]

    function at(t, side, dist){
      const i=((Math.floor(t*N)%N)+N)%N;
      const p=pts[i], n=normals[i], tg=tangents[i];
      const x=p.x+n.x*side*dist, z=p.z+n.z*side*dist;
      return { i, x, y:groundH(x,z), z,
               heading:Math.atan2(tg.x,tg.z) };
    }

    // --- jalan (mengikuti elevasi; di hutan = jalan tanah padat & kerikil) ---
    const roadGeo = new THREE.BufferGeometry();
    {
      const verts=[], uvs=[], idx=[];
      for(let i=0;i<N;i++){
        const p=pts[i], n=normals[i];
        verts.push(p.x+n.x*half,p.y+0.02,p.z+n.z*half, p.x-n.x*half,p.y+0.02,p.z-n.z*half);
        uvs.push(i*0.35,0, i*0.35,1);
        const a=i*2, b=i*2+1, c=((i+1)%N)*2, d=((i+1)%N)*2+1;
        idx.push(a,c,b, b,c,d); // winding menghadap atas
      }
      roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts,3));
      roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2));
      roadGeo.setIndex(idx); roadGeo.computeVertexNormals();
    }
    const rMap=def.id==='hutan'?dirtRoadTex():def.id==='pantai'?beachRoadTex():asphaltTex();
    const rCol=(def.id==='hutan'||def.id==='pantai')?0xffffff:def.road;
    group.add(new THREE.Mesh(roadGeo, new THREE.MeshLambertMaterial({map:rMap,color:rCol})));

    // bahu jalan (di hutan = bahu kerikil kasar + batu tepi lumut; lainnya = oranye + putih)
    function ribbon(offset, w, mat, yOff){
      const g=new THREE.BufferGeometry(); const v=[], id=[];
      for(let i=0;i<N;i++){
        const p=pts[i], n=normals[i];
        v.push(p.x+n.x*offset,p.y+yOff,p.z+n.z*offset, p.x+n.x*(offset+w),p.y+yOff,p.z+n.z*(offset+w));
        const a=i*2,b=i*2+1,c=((i+1)%N)*2,d=((i+1)%N)*2+1;
        id.push(a,c,b,b,c,d); // winding menghadap atas
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(v,3));
      g.setIndex(id); g.computeVertexNormals();
      const m=new THREE.Mesh(g,mat); group.add(m); return m;
    }
    // Apron transisi tepi jalan (menyatu lembut ke atas pinggir aspal menggunakan featherTex agar TIDAK terasa misah dengan jalanan)
    const apronMat = def.id==='pantai'
      ? new THREE.MeshLambertMaterial({map:sandTex(), alphaMap:featherTex(), transparent:true, opacity:0.92, color:0xe8d296, depthWrite:false})
      : def.id==='hutan'
      ? new THREE.MeshLambertMaterial({map:pathTex(), alphaMap:featherTex(), transparent:true, opacity:0.90, color:0x8a704c, depthWrite:false})
      : def.id==='kawah'
      ? new THREE.MeshLambertMaterial({map:pathTex(), alphaMap:featherTex(), transparent:true, opacity:0.92, color:0x472c34, depthWrite:false})
      : new THREE.MeshLambertMaterial({map:snowTex(), alphaMap:featherTex(), transparent:true, opacity:0.92, color:0xe6f2ff, depthWrite:false});
    function featherRibbon(offset, w, mat, yOff){
      const g=new THREE.BufferGeometry(); const v=[], uv=[], id=[];
      for(let i=0;i<N;i++){
        const p=pts[i], n=normals[i];
        v.push(p.x+n.x*offset,p.y+yOff,p.z+n.z*offset, p.x+n.x*(offset+w),p.y+yOff,p.z+n.z*(offset+w));
        uv.push(0,i*0.3, 1,i*0.3);
        const a=i*2,b=i*2+1,c=((i+1)%N)*2,d=((i+1)%N)*2+1;
        id.push(a,c,b,b,c,d);
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(v,3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
      g.setIndex(id); g.computeVertexNormals();
      const m=new THREE.Mesh(g,mat); group.add(m); return m;
    }
    featherRibbon(half-1.25, 2.1, apronMat, 0.032);
    featherRibbon(-half-0.85, 2.1, apronMat, 0.032);

    // marka tengah putus-putus (di hutan = susunan batu candi / cobblestone di tengah jalur tanah)
    {
      const v=[], id=[]; let q=0;
      for(let i=0;i<N;i+=(def.id==='hutan'?4:6)){
        const p=pts[i], tg=tangents[i], n=normals[i];
        const len=def.id==='hutan'?1.1:1.6, wid=def.id==='hutan'?0.42:0.25;
        const cx=p.x, cz=p.z, cy=p.y+0.04, dx=tg.x*len, dz=tg.z*len, ox=n.x*wid, oz=n.z*wid;
        v.push(cx-dx+ox,cy,cz-dz+oz, cx-dx-ox,cy,cz-dz-oz,
               cx+dx+ox,cy,cz+dz+oz, cx+dx-ox,cy,cz+dz-oz);
        id.push(q,q+2,q+1, q+1,q+2,q+3); q+=4; // winding menghadap atas
      }
      const g=new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v,3));
      g.setIndex(id); g.computeVertexNormals();
      const cMat=def.id==='hutan'
        ? new THREE.MeshLambertMaterial({color:0xa89f8e})
        : new THREE.MeshBasicMaterial({color:0xffd23f});
      group.add(new THREE.Mesh(g,cMat));
    }

    // kerb merah-putih di apex tikungan tajam (komponen BK.Props.kerbs)
    if(def.id==='pantai'){ const kb=BK.Props.kerbs(pts,normals,tangents,half,0.40); if(kb) group.add(kb); }

    // garis start kotak-kotak
    {
      const p=pts[0], tg=tangents[0];
      const m=new THREE.Mesh(new THREE.PlaneGeometry(W,4),
        new THREE.MeshBasicMaterial({map:checkerTexture()}));
      m.rotation.x=-Math.PI/2; m.rotation.z=-Math.atan2(tg.x,tg.z);
      m.position.set(p.x,p.y+0.05,p.z); group.add(m);
    }

    // Pembatas jalan kiri-kanan berupa FORMASI BEBATUAN NYAMBUNG (continuous connected rock ridge)
    // yang tumbuh langsung dari tepi jalan (half - 0.35) dengan tinggi sedang (~0.58m..0.92m) & menyatu dengan pasir/tanah/gunung/salju:
    function continuousRockRidge(side){
      const SUB = 3, M_STEPS = N * SUB, K = 7; // 660 cincin × 7 titik profil melintang
      const g = new THREE.BufferGeometry();
      const v = [], cols = [], id = [];

      const cBase  = new THREE.Color(def.id==='pantai'?0xe8d294 : def.id==='hutan'?0x6e5638 : def.id==='kawah'?0x362028 : 0xeaf4ff);
      const cDrift = new THREE.Color(def.id==='pantai'?0xdcc180 : def.id==='hutan'?0x4d6e35 : def.id==='kawah'?0x4d2b34 : 0xf6faff);
      const cRock1 = new THREE.Color(def.id==='pantai'?0x8a7d6c : def.id==='hutan'?0x6e6a5e : def.id==='kawah'?0x472b35 : 0x8296ad);
      const cRock2 = new THREE.Color(def.id==='pantai'?0x6b5f52 : def.id==='hutan'?0x546348 : def.id==='kawah'?0x2c1a22 : 0x6b7f96);
      const cCap   = new THREE.Color(def.id==='pantai'?0xd6c3a1 : def.id==='hutan'?0x4a6b34 : def.id==='kawah'?0x5e3843 : 0xf4f9ff);
      const tmpC   = new THREE.Color();

      for(let m=0; m<M_STEPS; m++){
        const f = m / SUB, i0 = Math.floor(f)%N, i1 = (i0+1)%N, u = f - Math.floor(f);
        const p0 = pts[i0], p1 = pts[i1], n0 = normals[i0], n1 = normals[i1];
        const px = p0.x + (p1.x-p0.x)*u, py = p0.y + (p1.y-p0.y)*u, pz = p0.z + (p1.z-p0.z)*u;
        let nx = n0.x + (n1.x-n0.x)*u, nz = n0.z + (n1.z-n0.z)*u;
        const nl = Math.hypot(nx,nz)||1; nx/=nl; nz/=nl;

        // Noise deterministik berlapis agar punggung batu naik-turun alami namun 100% menyambung utuh
        const ph = m * 0.21 + (side>0 ? 0 : 4.7);
        const nA = 0.5 + 0.5*(Math.sin(ph)*0.55 + Math.sin(ph*2.37+1.3)*0.30 + Math.cos(ph*4.13+0.7)*0.15);
        const nB = 0.5 + 0.5*(Math.cos(ph*1.41+0.9)*0.6 + Math.sin(ph*3.17+2.1)*0.4);
        const crag = Math.sin(ph*3.7)*0.14;

        // 7 titik profil melintang: mulai dari DALAM tepi jalan (half - 0.38) agar 100% menyatu dengan jalanan!
        const prof = [
          // 0: Kaki pasir/tanah di tepi aspal (menyatu langsung tanpa celah)
          { off: half - 0.38, y: 0.022, col: cBase },
          // 1: Gundukan pasir/tanah/salju yang menimbun kaki batu bagian dalam
          { off: half + 0.02 + crag*0.35, y: 0.24 + 0.14*nB, col: tmpC.copy(cBase).lerp(cDrift, 0.55).clone() },
          // 2: Dinding batu bagian dalam (mulai menonjol berfaset)
          { off: half + 0.38 + crag*0.65, y: 0.58 + 0.24*nA, col: tmpC.copy(cRock1).lerp(cDrift, nB*(def.id==='pantai'?0.22:0.35)).clone() },
          // 3: Puncak punggung bebatuan utama (tinggi ~0.64m..0.96m, nyambung utuh sepanjang trek)
          { off: half + 0.88 + crag*0.80, y: 0.68 + 0.28*nA, col: tmpC.copy(cRock2).lerp(cCap, nA*(def.id==='pantai'?0.40:0.65)).clone() },
          // 4: Bahu batu bagian luar
          { off: half + 1.52 + crag*0.60, y: 0.52 + 0.22*nB, col: tmpC.copy(cRock1).lerp(cRock2, 0.5).clone() },
          // 5: Lereng pasir/tanah/salju bagian luar
          { off: half + 2.25 + crag*0.40, y: 0.20 + 0.12*nB, col: cDrift },
          // 6: Kaki luar menyatu ke permukaan terrain
          { off: half + 3.25, y: -0.36, col: cBase }
        ];

        for(let k=0; k<K; k++){
          const pr = prof[k];
          const d = side * pr.off;
          v.push(px + nx*d, py + pr.y, pz + nz*d);
          cols.push(pr.col.r, pr.col.g, pr.col.b);
        }

        const rowA = m * K, rowB = ((m+1)%M_STEPS) * K;
        for(let k=0; k<K-1; k++){
          const a = rowA+k, b = rowA+k+1, c = rowB+k, d = rowB+k+1;
          if(side>0){
            id.push(a,c,b, b,c,d);
          } else {
            id.push(a,b,c, b,d,c);
          }
        }
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(v,3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols,3));
      g.setIndex(id);
      g.computeVertexNormals();
      const ridgeMat = new THREE.MeshLambertMaterial({vertexColors:true});
      group.add(new THREE.Mesh(g, ridgeMat));
    }
    continuousRockRidge(1);
    continuousRockRidge(-1);

    // Bongkahan batu memanjang yang SALING TUMPANG-TINDIH (interlocking boulders) + timbunan pasir/lumut/salju di kaki batu
    {
      const rockPalette = def.id==='pantai' ? [0xf2ede4,0xd9d2c4,0xc8beac,0xfaf6ec] // dikalikan tekstur karang
        : def.id==='hutan' ? [0x6e6a5f,0x55664b,0x7d7668,0x4c5e42]
        : def.id==='kawah' ? [0x422831,0x2d1a22,0x57343e,0x38212a]
        : [0x869ab0,0x9eb2c7,0x72859c,0xd8ecff];
      const moundPalette = def.id==='pantai' ? [0xe8d398,0xdcc284,0xf0dea6]
        : def.id==='hutan' ? [0x52703a,0x6e573a,0x456130]
        : def.id==='kawah' ? [0x331e25,0x4a2a33,0x3d232b]
        : [0xf4f9ff,0xdceeff,0xe8f3ff];

      const rockSpots=[], moundSpots=[];
      const SUB_B = 2, NB = N * SUB_B; // 440 batu per sisi (jarak ~1.7m, panjang batu 2.5..3.4m -> 100% saling nyambung!)
      for(let m=0; m<NB; m++){
        const f = m / SUB_B, i0 = Math.floor(f)%N, i1 = (i0+1)%N, u = f - Math.floor(f);
        const p0 = pts[i0], p1 = pts[i1], n0 = normals[i0], n1 = normals[i1], t0 = tangents[i0];
        const px = p0.x + (p1.x-p0.x)*u, py = p0.y + (p1.y-p0.y)*u, pz = p0.z + (p1.z-p0.z)*u;
        let nx = n0.x + (n1.x-n0.x)*u, nz = n0.z + (n1.z-n0.z)*u;
        const nl = Math.hypot(nx,nz)||1; nx/=nl; nz/=nl;
        const h = Math.atan2(t0.x,t0.z);

        [-1,1].forEach((side,si)=>{
          const hSeed = Math.sin(m*12.9898 + si*78.233)*43758.5453;
          const r1 = hSeed - Math.floor(hSeed);
          const r2 = (hSeed*1.37) - Math.floor(hSeed*1.37);
          // Posisi batu nempel langsung di bibir jalan (half + 0.55 .. half + 0.95)
          const off = half + 0.58 + r1*0.36;
          const rx = px + nx*side*off;
          const rz = pz + nz*side*off;
          // Panjang sz = 1.9..2.6 (diameter ~2.5..3.4m) sehingga antar batu saling menembus & nyambung tanpa celah!
          // Tinggi sy = 0.55..0.88 (puncak ~0.62m..0.95m dari jalan)
          const sx = 0.95 + r1*0.45;
          const sy = 0.56 + r2*0.32;
          const sz = 1.85 + r1*0.75;
          rockSpots.push({x:rx, y:py+sy*0.52, z:rz, sx, sy, sz, ry:h+(r2-0.5)*0.45, c:rockPalette[(m+si)%rockPalette.length]});

          // Timbunan pasir/tanah/salju yang menjorok dari atas tepi aspal (half - 0.05) menyelimuti kaki batu
          const mOff = half + 0.18 + r2*0.35;
          const mx = px + nx*side*mOff;
          const mz = pz + nz*side*mOff;
          moundSpots.push({x:mx, y:py+0.16, z:mz, sx:1.15+r2*0.50, sy:0.28+r1*0.16, sz:1.95+r1*0.65, ry:h+(r1-0.5)*0.35, c:moundPalette[(m+si)%moundPalette.length]});
        });
      }
      // batu pembatas = komponen 'rock' (desain sama dgn batu sebaran & hub); dodeca lama r=0.68 → skala komponen
      const rk=0.68/1.2;
      BK.Comp.scatter(group,'rock',rockSpots.map(it=>({x:it.x,y:it.y,z:it.z,s:it.sx*rk,sy:it.sy*rk,sz:it.sz*rk,ry:it.ry,tint:it.c,v:def.id==='pantai'?'coast':'plain'})));
      const moundInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.75,7,5), new THREE.MeshLambertMaterial({color:0xffffff}), moundSpots.length);
      const mtx=new THREE.Matrix4(), q=new THREE.Quaternion(), eu=new THREE.Euler(), sc=new THREE.Vector3(), col=new THREE.Color();
      moundSpots.forEach((it,k)=>{
        eu.set(0,it.ry,0); q.setFromEuler(eu); sc.set(it.sx,it.sy,it.sz);
        mtx.compose(new THREE.Vector3(it.x,it.y,it.z),q,sc);
        moundInst.setMatrixAt(k,mtx);
        if(moundInst.setColorAt){ col.setHex(it.c); moundInst.setColorAt(k,col); }
      });
      moundInst.instanceMatrix.needsUpdate=true; if(moundInst.instanceColor) moundInst.instanceColor.needsUpdate=true;
      group.add(moundInst);
    }

    // tanah relief + biome (G1/G2: dune analitik + warna tanah/lumpur/rumput/batu)
    // amplitudo per trek; diratakan di dekat jalan agar tidak menelan trek
    const reliefAmp={pantai:1.2,hutan:2.4,kawah:1.0,salju:1.5}[def.id]||0;
    const island = def.id==='pantai'; // pantai: warna pasir per-vertex (bentuk daratan TIDAK diubah)
    function groundH(x,z){
      if(!reliefAmp) return 0;
      const h=reliefAmp*Math.sin(x*0.02)*Math.cos(z*0.017)+reliefAmp*0.4*Math.sin(x*0.05+1)*Math.cos(z*0.043);
      const tdy=trackDistY(x,z); // [jarak, tinggiJalan] -> tanah menyambung ke tepi jalan
      const t=Math.max(0,Math.min(1,(tdy[0]-half-8)/18));
      const s=t*t*(3-2*t);
      const baseRoadY=tdy[1];
      let g=baseRoadY+(h-baseRoadY)*s;
      if(Math.hypot(x,z)<354) g=Math.max(-0.05,g); // daratan tak boleh di bawah laut (tepi cakram bebas turun)
      // Di kolong dalam koridor jalan (tdy[0] <= half+4.5), turunkan tanah di bawah permukaan jalan agar poligon terrain tidak pernah menembus jalan
      const underRoad=Math.max(0, 1 - Math.max(0, (tdy[0]-half-0.5)/4.5));
      g -= underRoad * 0.72;
      return g;
    }
    {
      const NR=56, NS=120, RD=385;
      const g=new THREE.BufferGeometry(); const v=[], uvs=[], cols=[], id=[];
      const cSand=new THREE.Color(def.ground);
      const cWet=new THREE.Color(def.id==='hutan'?0x473624:def.id==='kawah'?0x7a2e1d:def.id==='salju'?0xaed6f5:0xC9B184); // lumpur/kerak magma/es lembah
      const cGrass=new THREE.Color(def.id==='hutan'?0x4b873b:def.id==='kawah'?0x241822:def.id==='salju'?0xf5f9ff:0x9aa04d); // rumput/batu basalt/puncak salju
      const cGravel=new THREE.Color(def.id==='kawah'?0x3d242c:def.id==='salju'?0xc8dff5:0x8c7658); // kerikil/abu/es padat bahu jalan
      const tmp=new THREE.Color();
      const edgeT=0.92;
      function gxy(r,a){
        const x=Math.sin(a)*r, z=Math.cos(a)*r;
        let h=groundH(x,z);
        if(r/RD>edgeT) h=h*(1-(r/RD-edgeT)/(1-edgeT))+(-0.6)*((r/RD-edgeT)/(1-edgeT));
        return [x,h-0.1,z];
      }
      // pantai: pasir kering 2 nada + petak rumput, pasir basah, buih di garis air, gradasi toska di bawah laut
      const cDry=new THREE.Color(0xe2cf9c), cDry2=new THREE.Color(0xd8c08a), cBGrass=new THREE.Color(0xa9ad62),
            cWetS=new THREE.Color(0xbfa577), cFoam=new THREE.Color(0xf4f1e6), cShal=new THREE.Color(0x8fe0d6), cDeep=new THREE.Color(0x1f86aa);
      function gcolIsland(x,z,h){
        const SEA=-0.25; // permukaan mesh = groundH-0.1 → garis air visual di laut y=-0.35
        if(Math.hypot(x,z)<340) h=Math.max(h,1.0); // daratan dalam: selalu pasir kering (garis pantai lama di tepi cakram)
        if(h<SEA-0.08){ const d=Math.min(1,(SEA-h)/3.2); tmp.copy(cShal).lerp(cDeep,Math.pow(d,0.8)); }
        else if(h<SEA+0.12) tmp.copy(cFoam).lerp(cWetS,Math.max(0,(h-SEA)/0.12)*0.6);
        else if(h<SEA+0.75) tmp.copy(cWetS).lerp(cDry,(h-SEA-0.12)/0.63);
        else {
          const n=fbm2(x*0.045,z*0.045,3), n2=fbm2(x*0.012+40,z*0.012-17,2);
          tmp.copy(cDry).lerp(cDry2,Math.max(0,Math.min(1,(n-0.42)*3)));
          const gr=Math.max(0,Math.min(1,(n2-0.56)*5))*Math.max(0,Math.min(1,(h-0.9)/0.8)); // rumput pantai di daratan tinggi
          tmp.lerp(cBGrass,gr*0.7);
          const td=trackDist(x,z); tmp.lerp(cDry2,(1-Math.max(0,Math.min(1,(td-half-1)/6)))*0.5); // bahu jalan sedikit lebih gelap
        }
        return [tmp.r,tmp.g,tmp.b];
      }
      function gcol(x,z,h){
        if(island) return gcolIsland(x,z,h);
        const wet=1-Math.max(0,Math.min(1,h/0.6));
        const dry=Math.max(0,Math.min(1,(h-0.5)/1.1));
        tmp.copy(cSand).lerp(cWet,wet*0.75).lerp(cGrass,dry*0.8);
        if(def.id==='hutan'||def.id==='kawah'||def.id==='salju'){
          const td=trackDist(x,z);
          const nearRoad=1-Math.max(0,Math.min(1,(td-half-2)/14));
          tmp.lerp(cGravel, nearRoad*0.75);
        }
        return [tmp.r,tmp.g,tmp.b];
      }
      v.push(0,groundH(0,0)-0.1,0); uvs.push(0,0);
      { const c0=gcol(0,0,groundH(0,0)); cols.push(c0[0],c0[1],c0[2]); }
      for(let j=1;j<=NR;j++)for(let i=0;i<NS;i++){
        const a=i/NS*Math.PI*2, r=RD*j/NR;
        const p=gxy(r,a);
        v.push(p[0],p[1],p[2]); uvs.push(p[0]/8,p[2]/8);
        const c0=gcol(p[0],p[2],p[1]+0.1);
        cols.push(c0[0],c0[1],c0[2]);
      }
      for(let j=0;j<NR;j++)for(let i=0;i<NS;i++){
        if(j===0){ const A=1+i, B=1+(i+1)%NS; id.push(0,A,B); }
        else { const A=1+(j-1)*NS+i, B=1+j*NS+i, C=1+(j-1)*NS+(i+1)%NS, D=1+j*NS+(i+1)%NS; id.push(A,B,C, C,B,D); }
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(v,3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols,3));
      g.setIndex(id); g.computeVertexNormals();
      // tekstur klon repeat sendiri: milik trek saja (punya hub jangan ikut berubah)
      let gmap=def.id==='salju'?snowTex():def.id==='hutan'?forestSoilTex():island?sandRippleTex():groundTex();
      gmap=gmap.clone(); gmap.needsUpdate=true;
      gmap.wrapS=gmap.wrapT=THREE.RepeatWrapping; gmap.repeat.set(1,1);
      const useVCol=(def.id==='hutan'||def.id==='kawah'||def.id==='salju'||island);
      group.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:useVCol,map:gmap,color:useVCol?0xffffff:def.ground})));
    }
    scene.add(new THREE.HemisphereLight(def.id==='hutan'?0xfff6d6:def.id==='kawah'?0xffcfa3:def.id==='salju'?0xeaf6ff:0xffffff, def.id==='hutan'?0x4a3b28:def.id==='kawah'?0x3a1820:def.id==='salju'?0x425b78:0x334455, 0.95));
    const sun=new THREE.DirectionalLight(0xffffff,0.9); sun.position.set(80,120,40); scene.add(sun);
    if(def.id==='pantai'){ // G5 cahaya sore hangat
      sun.position.set(140,55,60); sun.color.setHex(0xffdfb0);
      scene.fog=new THREE.Fog(0x9fd0e8, 120, 420);
    } else if(def.id==='hutan'){ // cahaya matahari tropis menembus kanopi
      sun.position.set(110,115,-60); sun.color.setHex(0xffeab3);
      scene.fog=new THREE.Fog(def.fog, 125, 420);
    } else if(def.id==='kawah'){ // cahaya bara vulkanik
      sun.position.set(120,95,-80); sun.color.setHex(0xffb88c);
      scene.fog=new THREE.Fog(def.fog, 115, 410);
    } else { // salju: cahaya kutub cerah & jernih
      sun.position.set(115,110,70); sun.color.setHex(0xf2f8ff);
      scene.fog=new THREE.Fog(def.fog, 125, 430);
    }

    // --- langit: kubah gradasi + matahari/bulan + awan + bintang ---
    {
      const g=new THREE.SphereGeometry(760,16,12);
      const top=new THREE.Color(def.top||def.sky), hor=new THREE.Color(def.horizon||0xffffff);
      const pos=g.attributes.position, cols=[];
      for(let i=0;i<pos.count;i++){
        const y=pos.getY(i)/760; // -1..1
        const c=hor.clone().lerp(top, Math.max(0,Math.min(1,(y+0.1)*1.4)));
        cols.push(c.r,c.g,c.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols,3));
      const dome=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));
      group.add(dome);
      const sunM=new THREE.Mesh(new THREE.CircleGeometry(def.id==='hutan'?38:34,20),
        new THREE.MeshBasicMaterial({color:def.id==='kawah'?0xf5f0ff:def.id==='hutan'?0xfff0b8:0xfff2b0,fog:false}));
      sunM.position.set(260,300,-560); sunM.lookAt(0,0,0); group.add(sunM);
      // awan
      const cloudM=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.9,fog:false});
      for(let k=0;k<7;k++){
        const c=new THREE.Group();
        for(let j=0;j<3;j++){
          const s=new THREE.Mesh(new THREE.SphereGeometry(6+Math.random()*6,8,6),cloudM);
          s.position.set(j*9-9+Math.random()*3,Math.random()*2,Math.random()*4);
          s.scale.y=0.55; c.add(s);
        }
        c.position.set((Math.random()-0.5)*700, 70+Math.random()*50, (Math.random()-0.5)*700);
        group.add(c); anim.clouds.push({g:c, v:1+Math.random()*1.5});
      }
      if(def.id==='kawah'){ // bintang
        const n=220, vp=new Float32Array(n*3);
        for(let i=0;i<n;i++){
          const th=Math.random()*Math.PI*2, ph=Math.random()*Math.PI*0.42;
          vp[i*3]=Math.cos(th)*Math.cos(ph)*700; vp[i*3+1]=Math.sin(ph)*700+40; vp[i*3+2]=Math.sin(th)*Math.cos(ph)*700;
        }
        const sg=new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.BufferAttribute(vp,3));
        group.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:2.2,sizeAttenuation:false,fog:false})));
      }
    }

    // --- detail tanah per tema ---
    function trackDist(x,z){
      let m=1e18;
      for(let i=0;i<N;i++){ const dx=x-pts[i].x,dz=z-pts[i].z; const d=dx*dx+dz*dz; if(d<m)m=d; }
      return Math.sqrt(m);
    }
    function trackDistY(x,z){
      let m=1e18, y=0;
      for(let i=0;i<N;i++){ const dx=x-pts[i].x,dz=z-pts[i].z; const d=dx*dx+dz*dz; if(d<m){m=d;y=pts[i].y;} }
      return [Math.sqrt(m),y];
    }
    function farFromTrack(x,z,pad){ return trackDist(x,z)>half+pad; }
    if(def.id==='pantai'){
      const sea=new THREE.Mesh(new THREE.CircleGeometry(900,32),
        new THREE.MeshLambertMaterial({map:waterTex(),color:0x2a9db8}));
      sea.rotation.x=-Math.PI/2; sea.position.y=-0.35; group.add(sea);
      // cincin dangkal gradasi + buih mengikuti tepi cakram (RD=385)
      const sg=new THREE.BufferGeometry(); const sv=[], scs=[], sid=[];
      const cD1=new THREE.Color(0xE8D8A0), cD2=new THREE.Color(0x7fd4e8), cD3=new THREE.Color(0x2a9db8);
      for(let i=0;i<=72;i++){
        const a=i/72*Math.PI*2;
        [[378,-0.24,cD1],[396,-0.3,cD2],[470,-0.4,cD3]].forEach(([r,y,c])=>{
          sv.push(Math.sin(a)*r,y,Math.cos(a)*r); scs.push(c.r,c.g,c.b);
        });
      }
      for(let i=0;i<72;i++){
        const A=i*3;
        sid.push(A,A+1,A+3, A+1,A+4,A+3, A+1,A+2,A+4, A+2,A+5,A+4);
      }
      sg.setAttribute('position', new THREE.Float32BufferAttribute(sv,3));
      sg.setAttribute('color', new THREE.Float32BufferAttribute(scs,3));
      sg.setIndex(sid); sg.computeVertexNormals();
      group.add(new THREE.Mesh(sg,new THREE.MeshBasicMaterial({vertexColors:true})));
      const foam=new THREE.Mesh(new THREE.RingGeometry(376,383,72),
        new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.55,side:THREE.DoubleSide}));
      foam.rotation.x=-Math.PI/2; foam.position.y=-0.12; group.add(foam);
      anim.foam=foam.material;
    }

    // Helper cakram tanah/kolam yang mengikuti kontur groundH(x,z) & dijamin aman dari jalan (jarak tepi >= 6m dari bahu jalan)
    function addGroundDisc(cx, cz, r, mat, yOff, segs){
      if(!farFromTrack(cx, cz, r + 6)) return null;
      const g = new THREE.CircleGeometry(r, segs || 24);
      g.rotateX(-Math.PI/2);
      const pos = g.attributes.position;
      for(let i=0;i<pos.count;i++){
        const vx = cx + pos.getX(i), vz = cz + pos.getZ(i);
        pos.setY(i, groundH(vx, vz) + (yOff || 0.04));
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.position.set(cx, 0, cz);
      group.add(m);
      return m;
    }

    if(def.id==='pantai'){
      // Laguna pasang toska & teluk pasir basah di tepi lintasan
      [[28,-18,18],[-32,-8,16],[95,78,18],[-125,-75,18]].forEach(([lx,lz,lr],idx)=>{
        if(!farFromTrack(lx,lz,lr+10)) return;
        addGroundDisc(lx, lz, lr+3.5, M(0xd6c083), 0.03, 24);
        addGroundDisc(lx, lz, lr, new THREE.MeshLambertMaterial({map:waterTex(),color:idx%2?0x45c4d6:0x2fb3cc}), 0.06, 24);
      });
    }
    if(def.id==='hutan'){
      // laguna sungai & kubangan lumpur di lembah rimba
      [[52,-25,15],[-45,72,14],[145,0,16],[-138,-20,16]].forEach(([lx,lz,lr],idx)=>{
        if(!farFromTrack(lx,lz,lr+10)) return;
        addGroundDisc(lx, lz, lr+3.2, M(0x4f3d28), 0.03, 22);
        addGroundDisc(lx, lz, lr, new THREE.MeshLambertMaterial({map:waterTex(),color:idx%2?0x3b8c78:0x2e9ca8}), 0.06, 22);
      });
      // bercak tanah basah & hamparan kerikil di sekitar lembah
      for(let k=0;k<10;k++){
        const x=((k*73)%320)-160, z=((k*113)%320)-160;
        const r=9+(k%4)*4;
        addGroundDisc(x, z, r, M(k%2?0x6e5536:0x827258), 0.03, 14);
      }
      // serbuk sari emas & kunang-kunang hutan tropis
      [[0xffe875,65],[0xa8ff70,45]].forEach(([col,n])=>{
        const vp=new Float32Array(n*3);
        for(let i=0;i<n;i++){
          const c=pts[(i*5)%N];
          vp[i*3]=c.x+(Math.random()-0.5)*36;
          vp[i*3+1]=c.y+1.0+Math.random()*5.0;
          vp[i*3+2]=c.z+(Math.random()-0.5)*36;
        }
        const fg=new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(vp,3));
        const fm=new THREE.PointsMaterial({color:col,size:2.8,sizeAttenuation:false,transparent:true,opacity:0.85});
        group.add(new THREE.Points(fg,fm));
        anim.glow.push(fm);
      });
    }
    if(def.id==='salju'){
      // 1. Danau Gletser Beku Lembah & Kolam Es Tepi Lintasan (rata kontur tanah & aman dari jalan via addGroundDisc)
      const snowRim=new THREE.MeshBasicMaterial({color:0xf4f9ff});
      const iceLake=new THREE.MeshBasicMaterial({color:0x8fd0f5});
      const iceCore=new THREE.MeshBasicMaterial({color:0xdbf3ff});
      [[0,0,15],[125,-12,17],[-125,25,16],[22,106,15],[-22,-106,14]].forEach(([lx,lz,lr])=>{
        addGroundDisc(lx, lz, lr+2.5, snowRim, 0.03, 22);
        addGroundDisc(lx, lz, lr, iceLake, 0.06, 22);
        addGroundDisc(lx, lz, lr*0.52, iceCore, 0.09, 18);
      });
      [[0.18,-1],[0.38,1],[0.60,1],[0.84,-1]].forEach(([t,side])=>{
        const a=at(t,side,half+19);
        addGroundDisc(a.x, a.z, 9.5, snowRim, 0.03, 20);
        addGroundDisc(a.x, a.z, 7.6, iceLake, 0.06, 20);
        addGroundDisc(a.x, a.z, 4.0, iceCore, 0.09, 16);
      });
      // 2. Hujan salju lembut
      const n=260, vp=new Float32Array(n*3);
      for(let i=0;i<n;i++){
        const c=pts[(i*13)%N];
        vp[i*3]=c.x+(Math.random()-0.5)*220; vp[i*3+1]=Math.random()*60; vp[i*3+2]=c.z+(Math.random()-0.5)*220;
      }
      const sg=new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(vp,3));
      const snowPts=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:1.6,transparent:true,opacity:0.9}));
      group.add(snowPts);
      anim.snow={geo:sg};
    }
    if(def.id==='kawah'){
      // 1. Danau Magma Lembah Kaldera & Kolam Lava Tepi Lintasan (rata kontur tanah & aman dari jalan via addGroundDisc)
      const rimMat=new THREE.MeshLambertMaterial({color:0x24151c});
      const lavaMat=new THREE.MeshBasicMaterial({color:0xff4a00});
      const coreMat=new THREE.MeshBasicMaterial({color:0xffaa00});
      anim.glow.push(coreMat);
      [[0,0,15],[130,-10,18],[-130,25,16],[25,108,16],[-25,-108,15]].forEach(([lx,lz,lr])=>{
        addGroundDisc(lx, lz, lr+2.5, rimMat, 0.04, 22);
        const pool=addGroundDisc(lx, lz, lr, lavaMat, 0.09, 22);
        if(pool) anim.lava.push(pool);
        addGroundDisc(lx, lz, lr*0.52, coreMat, 0.14, 18);
      });
      [[0.16,-1],[0.30,1],[0.46,-1],[0.62,-1],[0.85,1]].forEach(([t,side])=>{
        const a=at(t,side,half+17);
        addGroundDisc(a.x, a.z, 7.8, rimMat, 0.04, 18);
        const pool=addGroundDisc(a.x, a.z, 6.0, lavaMat, 0.09, 18);
        if(pool) anim.lava.push(pool);
        addGroundDisc(a.x, a.z, 3.0, coreMat, 0.13, 14);
      });
      // 2. Retakan Magma Bercahaya di Tanah Basalt
      for(let k=0,guard=0;k<18&&guard<120;guard++){
        const c=pts[(guard*19)%N];
        const rx=c.x+(Math.random()-0.5)*85, rz=c.z+(Math.random()-0.5)*85;
        if(!farFromTrack(rx,rz,11)) continue;
        k++;
        const m=new THREE.Mesh(new THREE.BoxGeometry(6.5+(k%3)*2.5,0.14,0.85),
          k%2?lavaMat:coreMat);
        m.position.set(rx, groundH(rx,rz)+0.06, rz);
        m.rotation.y=Math.random()*Math.PI; group.add(m);
      }
    }

    // --- builder properti (khas: lighthouse/pillar/skull; umum: BK.Props) ---
    function lighthouse(x,z){
      const g=new THREE.Group();
      const t1=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.8,7,10), M(0xf2f2f2)); t1.position.y=3.5; g.add(t1);
      const t2=new THREE.Mesh(new THREE.CylinderGeometry(1.7,2.2,5,10), M(0xd23c2e)); t2.position.y=9; g.add(t2);
      const lamp=new THREE.Mesh(new THREE.SphereGeometry(1.2,10,8),
        new THREE.MeshBasicMaterial({color:0xffe97a})); lamp.position.y=12.4; g.add(lamp);
      anim.glow.push(lamp.material);
      const cap=new THREE.Mesh(new THREE.ConeGeometry(1.8,1.6,10), M(0x333333)); cap.position.y=14; g.add(cap);
      g.position.set(x,groundH(x,z),z); group.add(g); return g;
    }

    function snowman(x,y,z){
      const g=new THREE.Group();
      const b1=new THREE.Mesh(new THREE.SphereGeometry(1.1,10,8), M(0xffffff)); b1.position.y=1.1; g.add(b1);
      const b2=new THREE.Mesh(new THREE.SphereGeometry(0.75,10,8), M(0xffffff)); b2.position.y=2.6; g.add(b2);
      const nose=new THREE.Mesh(new THREE.ConeGeometry(0.14,0.7,7),
        new THREE.MeshLambertMaterial({color:0xff7a2a}));
      nose.rotation.x=Math.PI/2; nose.position.set(0,2.6,0.85); g.add(nose);
      [-1,1].forEach(s=>{
        const eye=new THREE.Mesh(new THREE.SphereGeometry(0.11,7,6),
          new THREE.MeshBasicMaterial({color:0x222222}));
        eye.position.set(s*0.28,2.85,0.62); g.add(eye);
      });
      g.position.set(x,y,z); group.add(g); return g;
    }
    function cabin(x,y,z,ry){
      const g=new THREE.Group();
      const base=new THREE.Mesh(new THREE.BoxGeometry(5.5,2.8,4.5), M(0x7a5230)); base.position.y=1.4; g.add(base);
      const roof=new THREE.Mesh(new THREE.ConeGeometry(4.4,2.2,4), M(0xf2f6fc)); roof.position.y=4.0; roof.rotation.y=Math.PI/4; g.add(roof);
      const win=new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.1),
        new THREE.MeshBasicMaterial({color:0xffd97a}));
      win.position.set(-1.2,1.5,2.28); g.add(win);
      const win2=win.clone(); win2.position.x=1.2; g.add(win2);
      g.position.set(x,y,z); g.rotation.y=ry; group.add(g); return g;
    }

    // helper umum: pastikan prop di luar kurva jalan lain (jarak aman >= half + r + 3.5)
    function placeSafe(holder, item, a, ry){
      if(trackDist(a.x,a.z) < half + (item.r||1) + 3.5) return;
      BK.placeProp(holder, item, a.x, a.y, a.z, ry);
    }

    // landmark per trek
    if(def.id==='pantai'){
      const holder={group,colliders};
      // 1. Tanjung Mercusuar Ikonik di sisi luar teluk (tanjung cembung agar bukit pasir tidak menyentuh jalan)
      const l=at(0.32,1,half+32);
      const mound=new THREE.Mesh(new THREE.SphereGeometry(1,14,10), M(0xD9C184));
      mound.scale.set(15,5.2,15); mound.position.set(l.x,groundH(l.x,l.z)-0.5,l.z); group.add(mound);
      lighthouse(l.x,l.z).position.y+=4.0;
      colliders.push({x:l.x,z:l.z,r:3});

      // 2. Gapura bangkai kapal bajak laut (sekali-pakai: pantai) di t=0.23: lambung terguling setengah terkubur
      //    di satu sisi, tiang batu karang di sisi lain, tiang layar melengkung + layar robek di atas jalan.
      //    Dua sisi punya collider; bagian di atas jalan setinggi ≥7 m (kart lewat di bawahnya).
      {
        const idxS=((Math.floor(0.23*N)%N)+N)%N;
        const pS=pts[idxS], tgS=tangents[idxS], nS=normals[idxS], hS=Math.atan2(tgS.x,tgS.z);
        const shipArch=new THREE.Group();
        const wood=BK.Props.plankMat(0x7a4a26), woodD=M(0x4e3018);
        const hull=new THREE.Mesh(BK.Props.hullGeo(13,3.6,3.2), wood);
        hull.rotation.set(0.12,0,-1.05); hull.position.set(-(half+6.6),0.4,0); shipArch.add(hull);
        [-4.2,-1.6,1.2].forEach((z,k)=>{ // rusuk patah menyembul dari pasir
          const rib=new THREE.Mesh(new THREE.TorusGeometry(2.7-k*0.25,0.2,6,12,Math.PI*(0.8-k*0.12)), woodD);
          rib.position.set(-(half+8.6),-0.3,z); rib.rotation.z=0.25; shipArch.add(rib);
        });
        [[0,2.0,0,3.1],[0.5,5.3,-0.3,2.5],[-0.3,8.0,0.2,2.0]].forEach(([x,y,z,r])=>{ // tumpukan komponen 'rock' karang
          const rk=BK.Comp.make('rock',r/1.2,'coast',0xd8cdb8).group;
          rk.position.set(half+4.6+x,y,z); rk.scale.y*=1.15; rk.rotation.set(x,y,z); shipArch.add(rk);
        });
        const spar=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-(half+5.2),5.0,0),new THREE.Vector3(-1.5,12.2,0),new THREE.Vector3(half+4.2,9.6,0));
        shipArch.add(new THREE.Mesh(new THREE.TubeGeometry(spar,20,0.42,7,false), woodD));
        const sailTex=canvasTex(256,128,(g,w,h)=>{ // kanvas lusuh, garis merah, tepi bawah robek (alpha)
          g.fillStyle='#efe4cc'; g.fillRect(0,0,w,h);
          g.fillStyle='#c8382c'; g.fillRect(0,h*0.32,w,h*0.18);
          for(let i=0;i<300;i++){ g.fillStyle='rgba(120,90,50,.08)'; g.fillRect(Math.random()*w,Math.random()*h,3,3); }
          g.globalCompositeOperation='destination-out'; g.beginPath(); g.moveTo(0,h);
          for(let x=0;x<=w;x+=16) g.lineTo(x,h-8-Math.random()*30); g.lineTo(w,h); g.fill();
          [[60,40,9],[170,70,12],[210,30,7]].forEach(([x,y,r])=>{ g.beginPath(); g.arc(x,y,r,0,7); g.fill(); });
        });
        const sail=new THREE.Mesh(new THREE.PlaneGeometry(9.5,3.6),
          new THREE.MeshLambertMaterial({map:sailTex,side:THREE.DoubleSide,alphaTest:0.4,emissive:0x6a5f50})); // kanvas tembus cahaya: tak gelap saat membelakangi matahari
        sail.position.set(-0.4,9.3,0.1); sail.rotation.z=-0.08; shipArch.add(sail);
        // Lentera harta karun emas menggantung di bawah palang kapal
        [-1,1].forEach(s=>{
          const lantern=new THREE.Mesh(new THREE.OctahedronGeometry(0.6,0),
            new THREE.MeshBasicMaterial({color:0xffd23f}));
          lantern.position.set(s*(half-2.0),8.6+(s>0?1.3:-0.4),0); shipArch.add(lantern);
          anim.glow.push(lantern.material);
          const cx=pS.x+nS.x*s*(half+3.5), cz=pS.z+nS.z*s*(half+3.5);
          if(trackDist(cx,cz)>=half+2.0) colliders.push({x:cx,z:cz,r:2.2});
        });
        shipArch.position.set(pS.x,pS.y,pS.z); shipArch.rotation.y=hS; group.add(shipArch);
      }

      // 3. Jembatan Dermaga Kayu & Tiang Pancang Pesisir (sekali-pakai: pantai) di sekitar ramp dermaga t=0.48..0.58
      for(let i=Math.floor(0.47*N);i<=Math.floor(0.58*N);i+=3){
        const pD=pts[i], nD=normals[i];
        [-1,1].forEach(s=>{
          const px=pD.x+nD.x*s*(half+2.2), pz=pD.z+nD.z*s*(half+2.2);
          if(trackDist(px,pz)<half+1.6) return;
          const post=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.48,pD.y+3.2,7), M(0x6e4726));
          post.position.set(px, (pD.y+1.2)/2, pz);
          group.add(post);
        });
      }

      // 4. Tebing Karang Tropis & Air Terjun Pantai (sekali-pakai: pantai) di t=0.82
      {
        const wf=at(0.82,1,half+30);
        const cliff=new THREE.Group();
        const rockMain=new THREE.Mesh(new THREE.CylinderGeometry(7.5,12.5,23,9), M(0xb8a686));
        rockMain.position.y=10.5; cliff.add(rockMain);
        const greenCap=new THREE.Mesh(new THREE.ConeGeometry(9.0,5.5,9), M(0x4b9c42));
        greenCap.position.y=24; cliff.add(greenCap);
        const fall=new THREE.Mesh(new THREE.PlaneGeometry(5.0,21),
          new THREE.MeshBasicMaterial({map:waterTex(),color:0x7be8fa,transparent:true,opacity:0.86,side:THREE.DoubleSide}));
        fall.position.set(0,10.5,10.2); cliff.add(fall);
        cliff.position.set(wf.x,groundH(wf.x,wf.z)-1,wf.z);
        cliff.lookAt(pts[wf.i].x,wf.y+3,pts[wf.i].z);
        group.add(cliff);
        if(trackDist(wf.x,wf.z)>=half+14) colliders.push({x:wf.x,z:wf.z,r:9});
      }

      // 5. Gubuk pantai, perahu kayu bersandar, obor tiki, terumbu karang & rumpun kelapa
      [[0.12,1],[0.4,-1],[0.76,-1],[0.92,1]].forEach(([t,s])=>{ const a=at(t,s,half+12); placeSafe(holder,BK.Props.hut(1),a,a.heading); });
      [[0.16,-1],[0.52,-1],[0.66,1]].forEach(([t,s],k)=>{ const a=at(t,s,half+12); placeSafe(holder,BK.Props.woodenBoat(1.1),a,a.heading+0.4*k); });
      [[0.06,-1],[0.18,1],[0.31,-1],[0.44,-1],[0.60,-1],[0.73,1],[0.86,-1],[0.96,1]].forEach(([t,s])=>{
        const a=at(t,s,half+8.5);
        placeSafe(holder,BK.Props.tikiTorch(1.05),a,0);
      });
      const cCols=[0xff6b8b,0xff9f43,0xa55eea,0x2bcbba];
      [[0.10,-1],[0.27,1],[0.38,1],[0.56,1],[0.68,-1],[0.84,1]].forEach(([t,s],k)=>{
        const a=at(t,s,half+10.5);
        placeSafe(holder,BK.Props.coralCluster(1.15,cCols[k%cCols.length]),a,k*1.2);
      });
      // payung instanced (tiang + tudung tint per instance, 2 draw call)
      {
        const up=[], ut=[];
        [[0.2,-1,0xff5a5a],[0.33,1,0x3fb6ff],[0.55,-1,0xffd23f],[0.7,1,0xff5a5a],[0.9,-1,0x3fb6ff]].forEach(([t,s,c])=>{
          const a=at(t,s,half+8.5);
          if(trackDist(a.x,a.z)<half+5) return;
          colliders.push({x:a.x,z:a.z,r:1});
          up.push({x:a.x,y:a.y+1.3,z:a.z,s:1});
          ut.push({x:a.x,y:a.y+2.8,z:a.z,s:1,c});
        });
        fillInstanced(new THREE.CylinderGeometry(0.09,0.09,2.6,6), M(0xdddddd), up);
        fillInstanced(new THREE.ConeGeometry(1.8,1,8),
          new THREE.MeshLambertMaterial({color:0xffffff}), ut,
          (it,k2,cc)=>cc.setHex([0xff5a5a,0x3fb6ff,0xffd23f][k2%3]));
      }
      [[0.04,1],[0.09,1],[0.19,-1],[0.3,-1],[0.36,1],[0.49,1],[0.62,1],[0.74,-1],[0.88,-1],[0.95,-1]].forEach(([t,s],k)=>{
        const a=at(t,s,half+10+(k%3)*2.5);
        placeSafe(holder,BK.Props.palm(0.95+(k%3)*0.2,0.5+(k%4)*0.45),a,k*1.1);
      });
      [[0.28,1,0xff5a5a],[0.58,-1,0x3fb6ff],[0.83,1,0xffd23f]].forEach(([t,s,c])=>{ // bola pantai
        const a=at(t,s,half+7.5);
        if(trackDist(a.x,a.z)<half+4.5) return;
        const b=new THREE.Mesh(new THREE.SphereGeometry(0.9,12,10), M(0xffffff));
        b.position.set(a.x,a.y+0.9,a.z); group.add(b);
        [-0.5,0.5].forEach(o=>{
          const band=new THREE.Mesh(new THREE.TorusGeometry(0.72,0.18,7,16), M(c));
          band.position.set(a.x,a.y+0.9+o,a.z); band.rotation.x=Math.PI/2; group.add(band);
        });
      });
    }
    if(def.id==='hutan'){
      const holder={group,colliders};
      // 1. Pohon rimba purba, batu besar, pilar candi & jamur hutan alami di tepi lintasan
      const mCols=[0xd93829,0xe67e22,0xc88a32,0xb83b5e];
      [[0.07,1],[0.20,-1],[0.35,1],[0.48,-1],[0.63,1],[0.77,-1],[0.90,1]].forEach(([t,s],k)=>{
        const a=at(t,s,half+12);
        placeSafe(holder,BK.Props.ancientTree(1.25+(k%2)*0.25),a,k*1.3);
      });
      [[0.04,-1],[0.15,1],[0.28,-1],[0.41,1],[0.54,-1],[0.68,-1],[0.83,1],[0.94,-1]].forEach(([t,s],k)=>{
        const a=at(t,s,half+9.5);
        placeSafe(holder,BK.Props.mushroom(1.05+(k%3)*0.25,mCols[k%mCols.length]),a,k*0.9);
      });
      [[0.12,-1],[0.31,1],[0.44,1],[0.58,-1],[0.73,1],[0.86,-1]].forEach(([t,s],k)=>{
        const a=at(t,s,half+10);
        placeSafe(holder,k%2===0?BK.Props.ruinPillar(1.15):BK.Props.rock(1.6),a,a.heading);
      });

      // 2. Gapura Candi Batu Lumut (sekali-pakai: hutan) di t=0.03 & t=0.55
      [0.03, 0.55].forEach(tArch=>{
        const idxA=((Math.floor(tArch*N)%N)+N)%N;
        const pA=pts[idxA], tgA=tangents[idxA], nA=normals[idxA], hA=Math.atan2(tgA.x,tgA.z);
        const arch=new THREE.Group();
        [-1,1].forEach(s=>{
          const leg=new THREE.Mesh(new THREE.BoxGeometry(2.0,9.5,2.0), M(0x787367));
          leg.position.set(s*(half+2.5),4.75,0); arch.add(leg);
          const vine=new THREE.Mesh(new THREE.BoxGeometry(2.3,2.5,2.3), M(0x3e6b2c));
          vine.position.set(s*(half+2.5),7.8,0); arch.add(vine);
          // obor api candi di puncak pilar
          const brazier=new THREE.Mesh(new THREE.OctahedronGeometry(0.85,0),
            new THREE.MeshBasicMaterial({color:0xff9f1c}));
          brazier.position.set(s*(half+2.5),10.2,0); arch.add(brazier);
          anim.glow.push(brazier.material);
          const cx=pA.x+nA.x*s*(half+2.5), cz=pA.z+nA.z*s*(half+2.5);
          if(trackDist(cx,cz)>=half+1.8) colliders.push({x:cx, z:cz, r:1.5});
        });
        const lintel=new THREE.Mesh(new THREE.BoxGeometry(W+8,1.7,2.4), M(0x696458));
        lintel.position.y=9.2; arch.add(lintel);
        const mossTop=new THREE.Mesh(new THREE.BoxGeometry(W+8.6,0.8,2.6), M(0x4b7d35));
        mossTop.position.y=10.2; arch.add(mossTop);
        arch.position.set(pA.x,pA.y,pA.z); arch.rotation.y=hA; group.add(arch);
      });

      // 3. Terowongan Akar Kayu Tua & Kanopi Rimba (sekali-pakai: hutan) di sekitar t=0.21..0.31
      [0.21, 0.245, 0.28, 0.315].forEach((tRib,rk)=>{
        const idxR=((Math.floor(tRib*N)%N)+N)%N;
        const pR=pts[idxR], tgR=tangents[idxR], nR=normals[idxR], hR=Math.atan2(tgR.x,tgR.z);
        const rib=new THREE.Group();
        const torus=new THREE.Mesh(new THREE.TorusGeometry(half+2.5,1.15,8,18,Math.PI), M(0x543b22));
        torus.position.y=0.2; rib.add(torus);
        const leafCrown=new THREE.Mesh(new THREE.SphereGeometry(3.2,8,6), M(0x2e6b2b));
        leafCrown.position.set(0,half+3.5,0); leafCrown.scale.set(2.4,0.8,1.3); rib.add(leafCrown);
        [-1,1].forEach(s=>{
          const lantern=new THREE.Mesh(new THREE.SphereGeometry(0.5,8,6),
            new THREE.MeshBasicMaterial({color:rk%2?0xffb833:0xffe066}));
          lantern.position.set(s*(half-1.5), (half+2.5)*0.72, 0); rib.add(lantern);
          anim.glow.push(lantern.material);
          const cx=pR.x+nR.x*s*(half+2.5), cz=pR.z+nR.z*s*(half+2.5);
          if(trackDist(cx,cz)>=half+1.8) colliders.push({x:cx, z:cz, r:1.5});
        });
        rib.position.set(pR.x,pR.y,pR.z); rib.rotation.y=hR; group.add(rib);
      });

      // 4. Tebing Batu & Air Terjun Rimba di sisi luar trek (sekali-pakai: hutan)
      {
        const wf=at(0.47,1,half+32);
        const cliff=new THREE.Group();
        const rockMain=new THREE.Mesh(new THREE.CylinderGeometry(8,13,26,9), M(0x6b6559));
        rockMain.position.y=12; cliff.add(rockMain);
        const mossCap=new THREE.Mesh(new THREE.ConeGeometry(9.5,6,9), M(0x3f7833));
        mossCap.position.y=27; cliff.add(mossCap);
        const fall=new THREE.Mesh(new THREE.PlaneGeometry(5.5,24),
          new THREE.MeshBasicMaterial({map:waterTex(),color:0x8be8f5,transparent:true,opacity:0.85,side:THREE.DoubleSide}));
        fall.position.set(0,12,10.6); cliff.add(fall);
        const mist=new THREE.Mesh(new THREE.CircleGeometry(9,18),
          new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.5}));
        mist.rotation.x=-Math.PI/2; mist.position.set(0,0.2,12); cliff.add(mist);
        anim.glow.push(mist.material);
        cliff.position.set(wf.x,groundH(wf.x,wf.z)-1,wf.z);
        cliff.lookAt(pts[wf.i].x,wf.y+4,pts[wf.i].z);
        group.add(cliff);
        if(trackDist(wf.x,wf.z)>=half+14) colliders.push({x:wf.x,z:wf.z,r:10});
      }

      // 5. Tiang penyangga jembatan kayu layang di bagian jalan yang tinggi
      {
        const sup=[];
        for(let i=0;i<N;i+=8){
          if(pts[i].y>2.2){
            const h=pts[i].y-groundH(pts[i].x,pts[i].z)+0.6;
            sup.push({x:pts[i].x,y:pts[i].y-h/2,z:pts[i].z,s:1.1,sy:Math.max(1,h)});
          }
        }
        if(sup.length) fillInstanced(new THREE.CylinderGeometry(0.6,0.75,1,7), M(0x543b22), sup);
      }

      // 6. Tanggul tanah & hamparan kerikil di sisi luar dinding jalan
      const gravelBank=new THREE.MeshLambertMaterial({map:pathTex(),color:0x826a48});
      ribbon(half+0.6, 3.8, gravelBank, -0.15); ribbon(-half-4.4, 3.8, gravelBank, -0.15);
    }
    if(def.id==='kawah'){
      const holder={group,colliders};
      // 1. Properti tepi lintasan: kristal magma bercahaya, tungku api vulkanik, obor tiki, pilar reruntuhan & batu basalt
      const cryCols=[0xff6a00,0xff2a00,0xffaa00,0xff4500];
      [[0.07,1],[0.19,-1],[0.27,-1],[0.43,1],[0.52,-1],[0.66,1],[0.79,-1],[0.91,1]].forEach(([t,s],k)=>{
        const a=at(t,s,half+10.5);
        placeSafe(holder,BK.Props.lavaCrystal(1.15+(k%3)*0.2,cryCols[k%cryCols.length]),a,k*1.1);
      });
      [[0.02,-1],[0.14,1],[0.24,1],[0.48,-1],[0.60,1],[0.71,-1],[0.84,1],[0.95,-1]].forEach(([t,s])=>{
        const a=at(t,s,half+9.0);
        placeSafe(holder,BK.Props.fireBrazier(1.15),a,0);
      });
      [[0.09,-1],[0.22,-1],[0.41,-1],[0.54,1],[0.64,-1],[0.77,1],[0.89,-1]].forEach(([t,s],k)=>{
        const a=at(t,s,half+11.5);
        placeSafe(holder,k%2===0?BK.Props.ruinPillar(1.2):BK.Props.rock(1.75),a,a.heading);
      });
      [[0.12,-1],[0.45,1],[0.69,1],[0.93,1]].forEach(([t,s])=>{
        const a=at(t,s,half+8.5);
        placeSafe(holder,BK.Props.tikiTorch(1.1),a,0);
      });

      // 2. Gerbang Tengkorak & Tanduk Naga Raksasa (sekali-pakai: kawah) di t=0.04 & t=0.56 (mengikuti elevasi jalan pA.y)
      [0.04, 0.56].forEach(tArch=>{
        const idxA=((Math.floor(tArch*N)%N)+N)%N;
        const pA=pts[idxA], tgA=tangents[idxA], nA=normals[idxA], hA=Math.atan2(tgA.x,tgA.z);
        const arch=new THREE.Group();
        [-1,1].forEach(s=>{
          const leg=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.5,9.5,7), M(0x2d1e26));
          leg.position.set(s*(half+2.6),4.75,0); arch.add(leg);
          const ring=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,1.2,7), M(0x52343b));
          ring.position.set(s*(half+2.6),7.6,0); arch.add(ring);
          const horn=new THREE.Mesh(new THREE.ConeGeometry(0.85,3.2,7), M(0xe8dec8));
          horn.position.set(s*(half+2.8),10.6,0); horn.rotation.z=-s*0.32; arch.add(horn);
          const flame=new THREE.Mesh(new THREE.OctahedronGeometry(0.85,0),
            new THREE.MeshBasicMaterial({color:0xff5500}));
          flame.position.set(s*(half+1.6),9.8,0); arch.add(flame);
          anim.glow.push(flame.material);
          const cx=pA.x+nA.x*s*(half+2.6), cz=pA.z+nA.z*s*(half+2.6);
          if(trackDist(cx,cz)>=half+1.8) colliders.push({x:cx, z:cz, r:1.5});
        });
        const beam=new THREE.Mesh(new THREE.BoxGeometry(W+8.5,1.7,2.2), M(0x38242e));
        beam.position.y=9.0; arch.add(beam);
        // Ornamen tengkorak raksasa di tengah palang gerbang + mata menyala merah bara
        const skull=new THREE.Mesh(new THREE.DodecahedronGeometry(1.85,1), M(0xe6dcc5));
        skull.position.set(0,9.8,0); skull.scale.set(1.15,1.2,1.15); arch.add(skull);
        [-1,1].forEach(fz=>{
          [-0.6,0.6].forEach(ex=>{
            const eye=new THREE.Mesh(new THREE.SphereGeometry(0.36,8,6),
              new THREE.MeshBasicMaterial({color:0xff2200}));
            eye.position.set(ex,9.9,fz*1.95); arch.add(eye);
            anim.glow.push(eye.material);
          });
        });
        arch.position.set(pA.x,pA.y,pA.z); arch.rotation.y=hA; group.add(arch);
      });

      // 3. Terowongan Rusuk Naga & Lengkungan Basalt (sekali-pakai: kawah) di punggung bukit tinggi t=0.31..0.39
      [0.31, 0.35, 0.39].forEach((tRib,rk)=>{
        const idxR=((Math.floor(tRib*N)%N)+N)%N;
        const pR=pts[idxR], tgR=tangents[idxR], nR=normals[idxR], hR=Math.atan2(tgR.x,tgR.z);
        const rib=new THREE.Group();
        const archRib=new THREE.Mesh(new THREE.TorusGeometry(half+2.6,1.05,7,16,Math.PI),
          M(rk%2===1?0xd9ceb8:0x36222b));
        archRib.position.y=0.2; rib.add(archRib);
        // Duri punggung naga di puncak lengkungan
        const spine=new THREE.Mesh(new THREE.ConeGeometry(0.85,2.4,6), M(0xe6dcc5));
        spine.position.set(0,half+4.2,0); rib.add(spine);
        // Kristal magma menggantung di sisi atas lengkungan
        [-1,1].forEach(s=>{
          const shard=new THREE.Mesh(new THREE.OctahedronGeometry(0.65,0),
            new THREE.MeshBasicMaterial({color:rk%2?0xffaa00:0xff4500}));
          shard.position.set(s*(half-1.4), (half+2.6)*0.72, 0); shard.scale.set(0.8,1.5,0.8); rib.add(shard);
          anim.glow.push(shard.material);
          const cx=pR.x+nR.x*s*(half+2.6), cz=pR.z+nR.z*s*(half+2.6);
          if(trackDist(cx,cz)>=half+1.8) colliders.push({x:cx, z:cz, r:1.5});
        });
        rib.position.set(pR.x,pR.y,pR.z); rib.rotation.y=hR; group.add(rib);
      });

      // 4. Gunung Berapi Aktif & Air Terjun Lava Pijar (sekali-pakai: kawah) di t=0.74 sisi luar
      {
        const wf=at(0.74,1,half+34);
        const volc=new THREE.Group();
        const coneMain=new THREE.Mesh(new THREE.CylinderGeometry(7.0,15.5,28,10), M(0x2c1b24));
        coneMain.position.y=13; volc.add(coneMain);
        const rimGlow=new THREE.Mesh(new THREE.CylinderGeometry(7.4,7.8,2.2,10),
          new THREE.MeshBasicMaterial({color:0xff4a00}));
        rimGlow.position.y=27.2; volc.add(rimGlow);
        anim.glow.push(rimGlow.material);
        const lavaFall=new THREE.Mesh(new THREE.PlaneGeometry(5.6,26),
          new THREE.MeshBasicMaterial({color:0xff6600,side:THREE.DoubleSide}));
        lavaFall.position.set(0,13,11.6); volc.add(lavaFall);
        const lavaCore=new THREE.Mesh(new THREE.PlaneGeometry(2.6,25.5),
          new THREE.MeshBasicMaterial({color:0xffcc22,side:THREE.DoubleSide}));
        lavaCore.position.set(0,13,11.75); volc.add(lavaCore);
        anim.glow.push(lavaCore.material);
        volc.position.set(wf.x,groundH(wf.x,wf.z)-1,wf.z);
        volc.lookAt(pts[wf.i].x,wf.y+3,pts[wf.i].z);
        group.add(volc);
        if(trackDist(wf.x,wf.z)>=half+16) colliders.push({x:wf.x,z:wf.z,r:11});
      }

      // 5. Tiang Penyangga Jembatan Batu Basalt pada bagian jalan tinggi (y > 2.0m)
      {
        const sup=[];
        for(let i=0;i<N;i+=8){
          if(pts[i].y>2.0){
            const h=pts[i].y-groundH(pts[i].x,pts[i].z)+0.6;
            sup.push({x:pts[i].x,y:pts[i].y-h/2,z:pts[i].z,s:1.25,sy:Math.max(1,h)});
          }
        }
        if(sup.length) fillInstanced(new THREE.CylinderGeometry(0.65,0.85,1,6), M(0x2b1c24), sup);
      }

      // 6. Tanggul Batu Basalt & Kerak Abu Vulkanik di sisi luar dinding lintasan
      const basaltBank=new THREE.MeshLambertMaterial({color:0x362028});
      ribbon(half+0.6, 3.6, basaltBank, -0.16); ribbon(-half-4.2, 3.6, basaltBank, -0.16);
    }
    if(def.id==='salju'){
      const holder={group,colliders};
      // 1. Properti tepi lintasan: pinus salju, kristal es kutub, igloo, kabin kayu, boneka salju & obor gunung (semua via placeSafe)
      const iceCols=[0x7ce8ff,0xa8f2ff,0x5ad4ff,0xc8f8ff];
      [[0.06,1],[0.15,-1],[0.25,-1],[0.36,1],[0.45,1],[0.54,-1],[0.64,-1],[0.77,1],[0.85,-1],[0.93,1]].forEach(([t,s],k)=>{
        const a=at(t,s,half+10.5+(k%2)*2);
        placeSafe(holder,BK.Props.snowPineProp(1.1+(k%3)*0.18),a,k*1.1);
      });
      [[0.09,-1],[0.21,1],[0.41,-1],[0.50,1],[0.68,1],[0.81,-1],[0.91,-1]].forEach(([t,s],k)=>{
        const a=at(t,s,half+10.0);
        placeSafe(holder,BK.Props.iceCrystal(1.15+(k%2)*0.2,iceCols[k%iceCols.length]),a,k*1.3);
      });
      [[0.12,1],[0.47,-1],[0.71,-1],[0.88,1]].forEach(([t,s],k)=>{
        const a=at(t,s,half+12.5);
        placeSafe(holder,BK.Props.igloo(1.05+(k%2)*0.12),a,a.heading+(s>0?-Math.PI/2:Math.PI/2));
      });
      [[0.27,-1],[0.58,1],[0.79,-1]].forEach(([t,s])=>{
        const a=at(t,s,half+13.5);
        if(trackDist(a.x,a.z)>=half+7.0){
          cabin(a.x,a.y,a.z,a.heading);
          colliders.push({x:a.x,z:a.z,r:3.5});
        }
      });
      [[0.03,1],[0.23,1],[0.49,-1],[0.66,-1],[0.86,1]].forEach(([t,s])=>{
        const a=at(t,s,half+8.5);
        if(trackDist(a.x,a.z)>=half+5.0){
          snowman(a.x,a.y,a.z);
          colliders.push({x:a.x,z:a.z,r:1.2});
        }
      });
      [[0.02,-1],[0.18,1],[0.43,1],[0.62,-1],[0.75,1],[0.95,-1]].forEach(([t,s])=>{
        const a=at(t,s,half+8.5);
        placeSafe(holder,BK.Props.tikiTorch(1.1),a,0);
      });

      // 2. Gapura Benteng Es & Menara Kristal Kutub (sekali-pakai: salju) di t=0.04 & t=0.56 (mengikuti elevasi jalan pA.y)
      [0.04, 0.56].forEach(tArch=>{
        const idxA=((Math.floor(tArch*N)%N)+N)%N;
        const pA=pts[idxA], tgA=tangents[idxA], nA=normals[idxA], hA=Math.atan2(tgA.x,tgA.z);
        const arch=new THREE.Group();
        [-1,1].forEach(s=>{
          const col=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.55,9.5,8), M(0xc8e4f8));
          col.position.set(s*(half+2.6),4.75,0); arch.add(col);
          const snowCap=new THREE.Mesh(new THREE.ConeGeometry(1.85,2.6,8), M(0x5caee0));
          snowCap.position.set(s*(half+2.6),10.4,0); arch.add(snowCap);
          const cryTop=new THREE.Mesh(new THREE.OctahedronGeometry(0.85,0),
            new THREE.MeshBasicMaterial({color:0x7cf5ff}));
          cryTop.position.set(s*(half+2.6),12.2,0); arch.add(cryTop);
          anim.glow.push(cryTop.material);
          const cx=pA.x+nA.x*s*(half+2.6), cz=pA.z+nA.z*s*(half+2.6);
          if(trackDist(cx,cz)>=half+1.8) colliders.push({x:cx, z:cz, r:1.5});
        });
        const lintel=new THREE.Mesh(new THREE.BoxGeometry(W+8.5,1.6,2.2), M(0xb4daf5));
        lintel.position.y=9.0; arch.add(lintel);
        const snowTop=new THREE.Mesh(new THREE.BoxGeometry(W+9.0,0.75,2.5), M(0xf6faff));
        snowTop.position.y=9.95; arch.add(snowTop);
        // Deretan stalaktit es (icicles) menggantung di bawah palang gerbang
        [-6.5,-3.2,0,3.2,6.5].forEach((ix,ik)=>{
          const ic=new THREE.Mesh(new THREE.ConeGeometry(0.32,1.4+(ik%2)*0.45,6),
            new THREE.MeshBasicMaterial({color:0xb8f2ff}));
          ic.rotation.x=Math.PI; ic.position.set(ix,7.6,0); arch.add(ic);
        });
        arch.position.set(pA.x,pA.y,pA.z); arch.rotation.y=hA; group.add(arch);
      });

      // 3. Terowongan Gua Gletser & Stalaktit Es (sekali-pakai: salju) di punggung puncak t=0.30..0.38
      [0.30, 0.34, 0.38].forEach((tRib,rk)=>{
        const idxR=((Math.floor(tRib*N)%N)+N)%N;
        const pR=pts[idxR], tgR=tangents[idxR], nR=normals[idxR], hR=Math.atan2(tgR.x,tgR.z);
        const rib=new THREE.Group();
        const iceArch=new THREE.Mesh(new THREE.TorusGeometry(half+2.6,1.15,8,18,Math.PI),
          M(rk%2===1?0xa4d6f5:0xdaf0fc));
        iceArch.position.y=0.2; rib.add(iceArch);
        const crest=new THREE.Mesh(new THREE.ConeGeometry(1.1,2.6,6), M(0x7be0ff));
        crest.position.set(0,half+4.3,0); rib.add(crest);
        [-1,1].forEach(s=>{
          const icicle=new THREE.Mesh(new THREE.ConeGeometry(0.45,1.8,6),
            new THREE.MeshBasicMaterial({color:0x8cf2ff}));
          icicle.rotation.x=Math.PI; icicle.position.set(s*(half-1.6), (half+2.6)*0.72, 0); rib.add(icicle);
          anim.glow.push(icicle.material);
          const cx=pR.x+nR.x*s*(half+2.6), cz=pR.z+nR.z*s*(half+2.6);
          if(trackDist(cx,cz)>=half+1.8) colliders.push({x:cx, z:cz, r:1.5});
        });
        rib.position.set(pR.x,pR.y,pR.z); rib.rotation.y=hR; group.add(rib);
      });

      // 4. Tebing Gletser Raksasa & Air Terjun Beku (sekali-pakai: salju) di t=0.73 sisi luar
      {
        const wf=at(0.73,1,half+33);
        const cliff=new THREE.Group();
        const rockMain=new THREE.Mesh(new THREE.CylinderGeometry(8.0,14.5,27,9), M(0x889cb2));
        rockMain.position.y=12.5; cliff.add(rockMain);
        const snowCap=new THREE.Mesh(new THREE.ConeGeometry(10.0,6.5,9), M(0xf6faff));
        snowCap.position.y=28; cliff.add(snowCap);
        const iceFall=new THREE.Mesh(new THREE.PlaneGeometry(5.8,25),
          new THREE.MeshBasicMaterial({color:0x8ee2ff,side:THREE.DoubleSide}));
        iceFall.position.set(0,12.5,11.2); cliff.add(iceFall);
        const iceCore=new THREE.Mesh(new THREE.PlaneGeometry(2.8,24.5),
          new THREE.MeshBasicMaterial({color:0xe0f8ff,side:THREE.DoubleSide}));
        iceCore.position.set(0,12.5,11.35); cliff.add(iceCore);
        anim.glow.push(iceCore.material);
        cliff.position.set(wf.x,groundH(wf.x,wf.z)-1,wf.z);
        cliff.lookAt(pts[wf.i].x,wf.y+3,pts[wf.i].z);
        group.add(cliff);
        if(trackDist(wf.x,wf.z)>=half+16) colliders.push({x:wf.x,z:wf.z,r:10});
      }

      // 5. Tiang Penyangga Jembatan Kayu & Batu Gunung (mengikuti kontur groundH)
      {
        const sup=[];
        for(let i=0;i<N;i+=8){
          if(pts[i].y>2.0){
            const h=pts[i].y-groundH(pts[i].x,pts[i].z)+0.6;
            sup.push({x:pts[i].x,y:pts[i].y-h/2,z:pts[i].z,s:1.2,sy:Math.max(1,h)});
          }
        }
        if(sup.length) fillInstanced(new THREE.BoxGeometry(1.2,1,1.2), M(0x6b4a2a), sup);
      }

      // 6. Tanggul Salju Tebal di Sisi Luar Dinding Lintasan
      const bankM=new THREE.MeshLambertMaterial({color:0xf2f7ff});
      ribbon(half+0.6, 4.5, bankM, -0.20); ribbon(-half-5.1, 4.5, bankM, -0.20);
    }

    // --- tribun penonton + bendera (semua trek) ---
    {
      const a=at(0.965,-1,half+13);
      const st=new THREE.Group();
      for(let r=0;r<3;r++){
        const step=new THREE.Mesh(new THREE.BoxGeometry(16,1,2.2), M(r%2?0x3a4668:0x2c3550));
        step.position.set(0,0.5+r, -r*2.2); st.add(step);
      }
      const crowdColors=[0xff5a5a,0x3fb6ff,0xffd23f,0x7CFC00,0xf2f2f2];
      for(let r=0;r<3;r++)for(let k=0;k<6;k++){
        const p=new THREE.Mesh(new THREE.BoxGeometry(0.9,1.1,0.9), M(crowdColors[(r*6+k)%5]));
        p.position.set(-6.2+k*2.5, 1.6+r, -r*2.2); st.add(p);
        anim.crowd.push({m:p, ph:(r*6+k)*0.7});
      }
      [-7.5,7.5].forEach(x=>{
        const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,7,6), M(0xcccccc));
        pole.position.set(x,3.5,-1); st.add(pole);
      });
      const roof=new THREE.Mesh(new THREE.BoxGeometry(17,0.4,7), M(0xd94f30)); roof.position.set(0,7.2,-2); st.add(roof);
      const ban=new THREE.Mesh(new THREE.PlaneGeometry(12,3),
        new THREE.MeshBasicMaterial({map:bannerTexture('BEKICOT GP',def.name,'#16204a','#ffd23f')}));
      ban.position.set(0,5.6,1.8); st.add(ban);
      st.position.set(a.x,a.y,a.z);
      const look=pts[0]; st.lookAt(look.x,a.y,look.z);
      group.add(st);
      // bendera start
      for(let k=0;k<6;k++){
        const f=at(0.985-k*0.004,k%2?1:-1,half+2.5);
        const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,4.5,6), M(0xeeeeee));
        pole.position.set(f.x,f.y+2.25,f.z); group.add(pole);
        const flag=new THREE.Mesh(new THREE.PlaneGeometry(1.6,1),
          new THREE.MeshBasicMaterial({color:k%2?0xffd23f:0xff5a5a,side:THREE.DoubleSide}));
        flag.position.set(f.x+0.85,f.y+3.8,f.z); group.add(flag);
        anim.flags.push({m:flag,ph:k});
      }
    }

    // --- gantry start + lampu ---
    const startLights={red:[],green:null};
    {
      const s0=at(0.0,0,0);
      const g=new THREE.Group();
      [-1,1].forEach(s=>{
        const leg=new THREE.Mesh(new THREE.BoxGeometry(0.8,7.5,0.8), M(0x222a3a));
        leg.position.set(s*(half+1.5),3.75,0); g.add(leg);
      });
      const beam=new THREE.Mesh(new THREE.BoxGeometry(W+5,1.4,1), M(0x222a3a)); beam.position.y=7; g.add(beam);
      const ban=new THREE.Mesh(new THREE.PlaneGeometry(W+3,2.2),
        new THREE.MeshBasicMaterial({map:bannerTexture(def.name,'CRASH BEKICOT','#b32e12','#ffffff')}));
      ban.position.set(0,5.2,0.55); g.add(ban);
      const ban2=ban.clone(); ban2.rotation.y=Math.PI; ban2.position.z=-0.55; g.add(ban2);
      for(let k=0;k<3;k++){
        const l=new THREE.Mesh(new THREE.SphereGeometry(0.45,10,8),
          new THREE.MeshBasicMaterial({color:0x550000}));
        l.position.set(-1.4+k*1.4,7,0.7); g.add(l); startLights.red.push(l);
      }
      const gr=new THREE.Mesh(new THREE.SphereGeometry(0.55,10,8),
        new THREE.MeshBasicMaterial({color:0x003300}));
      gr.position.set(2.6,7,0.7); g.add(gr); startLights.green=gr;
      g.position.set(pts[0].x,pts[0].y,pts[0].z); g.rotation.y=s0.heading;
      group.add(g);
    }

    // --- filler instanced jauh dari trek ---
    // seeded RNG per trek (pola skill terrain-patterns #1): layout stabil antar kunjungan
    function xhash(str){ let h=2166136261; for(const c of str){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; }
    function mulberry(seed){
      let a=seed>>>0;
      return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
    }
    const R=mulberry(xhash(def.id||'hub'));
    function scatter(count, place, opts){
      opts=opts||{};
      let made=0, guard=0;
      const avoid=opts.avoid||[];
      while(made<count && guard++<count*20){
        let x,z;
        if(opts.cluster && R()<0.65){ // rumpun: 65% lahir di sekitar pusat cluster
          const c=opts.cluster[(R()*opts.cluster.length)|0];
          const a=R()*Math.PI*2, rr=(R()+R())*c.spread;
          x=c.x+Math.cos(a)*rr; z=c.z+Math.sin(a)*rr;
        } else {
          x=(R()-0.5)*440; z=(R()-0.5)*440;
        }
        if(!farFromTrack(x,z,10)) continue;
        if(avoid.some(p=>{const dx=x-p[0],dz=z-p[1];return dx*dx+dz*dz<36;})) continue;
        avoid.push([x,z]);
        place(x,z,made,trackDist(x,z)); made++;
      }
      return made;
    }
    function fillInstanced(geo, mat, list, tintFn){
      const inst=new THREE.InstancedMesh(geo,mat,list.length);
      const mtx=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler();
      const useTint=(typeof tintFn==='function')&&(typeof inst.setColorAt==='function');
      const tmpC=useTint?new THREE.Color():null;
      list.forEach((it,k)=>{
        e.set(0,it.ry||0,0); q.setFromEuler(e);
        mtx.compose(new THREE.Vector3(it.x,it.y||0,it.z),q,new THREE.Vector3(it.s,it.sy||it.s,it.s));
        inst.setMatrixAt(k,mtx);
        if(useTint){ tintFn(it,k,tmpC); inst.setColorAt(k,tmpC); }
      });
      inst.instanceMatrix.needsUpdate=true;
      if(useTint&&inst.instanceColor)inst.instanceColor.needsUpdate=true;
      group.add(inst);
    }
    // sebaran pakai KOMPONEN TERPADU (BK.Comp): desain batu/pohon/pinus/jamur sama dgn hub & landmark.
    // mul = konversi ukuran geometri lama → komponen (dodeca lama r=gr, komponen r=1.2) agar ukuran tetap.
    function compRocks(list,palette,gr,variant){
      const mul=(gr||1.2)/1.2;
      list.forEach((it,k)=>{ it.s*=mul; if(it.sy!=null) it.sy*=mul; it.tint=palette?palette[k%palette.length]:undefined; if(variant) it.v=variant; });
      BK.Comp.scatter(group,'rock',list);
    }
    if(def.id==='hutan'){
      const placed=[];
      const treeCl=[{x:135,z:-10,spread:45},{x:-120,z:50,spread:50},{x:20,z:145,spread:45},{x:-60,z:-130,spread:45}];
      const rockCl=[{x:55,z:-35,spread:35},{x:-35,z:65,spread:38},{x:-135,z:-25,spread:35},{x:115,z:95,spread:40}];
      const crowns=[], trunks=[], boulders=[], pebbles=[], mCaps=[], mStems=[], ferns=[], mounds=[];
      const zf=d=>Math.max(0.55,Math.min(1.45,(d-half-8)/36));
      // 1. Pohon rimba kanopi lebat (instanced dengan variasi tint daun hijau alami)
      scatter(110,(x,z,md,d)=>{
        const s=(0.9+R()*1.35)*zf(d), gy=groundH(x,z);
        crowns.push({x,y:gy,z,s:s*1.15,ry:R()*3}); // komponen 'forestTree' (origin di tanah)
      },{cluster:treeCl,avoid:placed});
      crowns.forEach((it,k)=>{ it.tint=[0xffffff,0xe6f2dc,0xd2e6c8,0xf2ffe8][k%4]; });
      BK.Comp.scatter(group,'forestTree',crowns);

      // 2. Batu kali & bongkahan batu berlumut (boulders) di sekitar lembah & lereng
      scatter(65,(x,z,md,d)=>{
        const s=(0.85+R()*1.8)*zf(d), gy=groundH(x,z);
        boulders.push({x,y:gy+0.8*s,z,s:s*1.3,sy:s*0.95,ry:R()*3});
      },{cluster:rockCl,avoid:placed});
      compRocks(boulders,[0x7a756c,0x666259,0x8c8578,0x596652],1.2);

      // 3. Sabuk batu kerikil (gravel & pebbles) padat di pinggir lintasan (sabuk 8.5..24m dari centerline)
      {
        let pg=0;
        while(pebbles.length<130&&pg++<900){
          const ti=(R()*N)|0, side=R()<0.5?-1:1;
          const dist=half+1.6+R()*11;
          const x=pts[ti].x+normals[ti].x*side*dist+(R()-0.5)*3;
          const z=pts[ti].z+normals[ti].z*side*dist+(R()-0.5)*3;
          if(!farFromTrack(x,z,1.3)) continue;
          const s=0.28+R()*0.55;
          pebbles.push({x,y:groundH(x,z)+0.18*s,z,s:s*1.3,sy:s*0.65,ry:R()*3});
        }
        compRocks(pebbles,[0x9c8c74,0x7d6e58,0xb5a48b,0x695c49],0.9);
      }

      // 4. Gundukan tanah & tebing tanah (dirt embankments) di dekat tikungan
      {
        const spots=[]; let dg=0;
        while(spots.length<8&&dg++<300){
          const x=(R()-0.5)*340, z=(R()-0.5)*340;
          if(farFromTrack(x,z,34)||!farFromTrack(x,z,13)) continue;
          if(spots.some(p=>Math.hypot(p[0]-x,p[1]-z)<45)) continue;
          spots.push([x,z]); placed.push([x,z]);
        }
        spots.forEach(([x,z])=>{
          for(let b=0;b<2;b++){
            const ox=(R()-0.5)*9, oz=(R()-0.5)*9, w=4.0+R()*5.5;
            mounds.push({x:x+ox,y:groundH(x+ox,z+oz)-0.4,z:z+oz,s:w,sy:1.2+R()*1.4,ry:R()*3});
          }
        });
        fillInstanced(new THREE.SphereGeometry(1,10,7), M(0x6e5436), mounds);
      }

      // 5. Rumpun jamur hutan & semak pakis tropis
      scatter(45,(x,z,md,d)=>{
        const s=(0.6+R()*0.95)*zf(d), gy=groundH(x,z);
        mCaps.push({x,y:gy,z,s:s*0.6,ry:R()*3}); // komponen 'mushroom'
      },{cluster:rockCl,avoid:placed});
      mCaps.forEach((it,k)=>{ it.tint=[0xd93829,0xe67e22,0xc88a32,0xb83b5e][k%4]; });
      BK.Comp.scatter(group,'mushroom',mCaps);

      scatter(75,(x,z)=>{
        const s=0.7+R()*0.9, gy=groundH(x,z);
        ferns.push({x,y:gy+0.9*s,z,s:s*1.3,sy:s*0.9,ry:R()*3});
      },{avoid:placed});
      fillInstanced(new THREE.ConeGeometry(1.4,2.2,6), M(0x3f7d32), ferns);

      // 6. Pegunungan/tebing batu & hutan di cakrawala
      [[270,110,85],[-270,90,95],[140,-290,80],[-230,-250,75],[0,295,90]].forEach(([mx,mz,mh])=>{
        const m=new THREE.Mesh(new THREE.ConeGeometry(mh*0.95,mh*1.15,9), M(0x5c5346));
        m.position.set(mx,mh*0.38,mz); group.add(m);
        const cap=new THREE.Mesh(new THREE.ConeGeometry(mh*0.55,mh*0.5,9), M(0x3b6e32));
        cap.position.set(mx,mh*0.72,mz); group.add(cap);
      });
    } else if(def.id==='pantai'){
      const rocks=[], bush=[];
      const placed=[]; // jarak minimum bersama
      const rockCl=[{x:120,z:-20,spread:45},{x:-80,z:60,spread:40}];
      const bushCl=[{x:40,z:80,spread:38},{x:-60,z:-50,spread:42}];
      const zf=d=>Math.max(0.35,Math.min(1.3,(d-half-10)/40)); // kecil dekat trek, besar jauh
      scatter(60,(x,z,md,d)=>{ const s=(0.8+R()*2)*zf(d); rocks.push({x,y:groundH(x,z)+0.3*s,z,s,sy:s*0.7,ry:R()*3}); /* setengah terkubur */ },{cluster:rockCl,avoid:placed});
      scatter(70,(x,z,md,d)=>{ const s=(0.8+R())*zf(d); bush.push({x,y:groundH(x,z)+1.2*s,z,s}); },{cluster:bushCl,avoid:placed});
      compRocks(rocks,[0xfaf6ee,0xe8e2d6,0xf3eee4,0xdcd5c8,0xffffff],1.2,'coast'); // batu karang pantai
      // detail tambahan pakai RNG terpisah agar posisi objek lama tidak bergeser
      const Q=mulberry(xhash('pantai-detail'));
      const tufts=[];
      bush.forEach(b=>{ const n=3+((Q()*3)|0); // semak kerucut lama -> rumpun rumput pantai di titik yang sama
        for(let k=0;k<n;k++){ const x=b.x+(Q()-0.5)*3.2*b.s, z=b.z+(Q()-0.5)*3.2*b.s, s=(0.8+Q()*0.7)*Math.max(0.8,b.s);
          tufts.push({x,y:groundH(x,z)-0.1,z,s,sy:s*(0.8+Q()*0.5),ry:Q()*3}); } });
      fillInstanced(BK.Props.tuftGeo(), BK.Props.tuftMat(), tufts,
        (it,k,c)=>c.setHex(0xffffff).offsetHSL(((k*53)%11-5)*0.01,0,((k*29)%9-4)*0.03));
      // gundukan natural: 6 cluster tak beraturan, tiap 2-3 bola tumpang tindih
      const dunes=[];
      { const spots=[]; let dg=0;
        while(spots.length<6&&dg++<300){
          const x=(R()-0.5)*360, z=(R()-0.5)*360;
          if(farFromTrack(x,z,34)||!farFromTrack(x,z,14)) continue; // sabuk 14..34m
          if(spots.some(p=>Math.hypot(p[0]-x,p[1]-z)<55)) continue;
          if(placed.some(p=>{const dx=x-p[0],dz=z-p[1];return dx*dx+dz*dz<324;})) continue;
          spots.push([x,z]); placed.push([x,z]);
        }
        spots.forEach(([x,z])=>{
          const nB=2+((R()*2)|0);
          for(let b=0;b<nB;b++){
            const ox=(R()-0.5)*10, oz=(R()-0.5)*10;
            const w=3.5+R()*6.5;
            dunes.push({x:x+ox,y:groundH(x+ox,z+oz)-0.4,z:z+oz,
              s:w,sy:(1.0+R()*1.3)*(b===0?1:0.55),ry:R()*3});
          }
        }); }
      fillInstanced(new THREE.SphereGeometry(1,14,8), new THREE.MeshLambertMaterial({map:sandRippleTex(),color:0xdcc896}), dunes);
      // sabuk kerang: kecil, dekat sisi jalan
      const shells=[];
      { let sg=0;
        while(shells.length<36&&sg++<300){
          const x=(R()-0.5)*360, z=(R()-0.5)*360;
          if(farFromTrack(x,z,26)||!farFromTrack(x,z,11)) continue;
          shells.push({x,y:groundH(x,z)+0.15,z,s:0.3+R()*0.25,ry:R()*3});
        } }
      fillInstanced(new THREE.SphereGeometry(1,8,6),
        new THREE.MeshLambertMaterial({color:0xffffff}), shells,
        (it,k,c)=>c.setHex([0xffffff,0xffd9e8,0xffe8c8][k%3]));
      // patch pasir basah (lebih gelap, variasi visual)
      for(let k=0;k<6;k++){
        let px=0,pz=0,ok=false;
        for(let t=0;t<40&&!ok;t++){
          px=(R()-0.5)*300; pz=(R()-0.5)*300;
          ok=farFromTrack(px,pz,20);
        }
        if(!ok) continue;
        const pr=6+R()*6;
        const pm=new THREE.Mesh(new THREE.CircleGeometry(pr,14), M(0xC9B184));
        pm.rotation.x=-Math.PI/2; pm.position.set(px,groundH(px,pz)+0.03,pz); group.add(pm);
      }
      // rumpun palem tambahan di daratan kosong (detail; RNG terpisah, jarak aman dari trek & objek lama)
      { const holderP={group,colliders}; let made=0, g=0;
        while(made<8&&g++<600){ const x=(Q()-0.5)*360, z=(Q()-0.5)*360;
          if(!farFromTrack(x,z,18)||Math.hypot(x,z)>330) continue;
          if(placed.some(p=>{const dx=x-p[0],dz=z-p[1];return dx*dx+dz*dz<144;})) continue;
          placed.push([x,z]); made++;
          const n=2+((Q()*2)|0);
          for(let k=0;k<n;k++){ const px=x+(Q()-0.5)*8, pz=z+(Q()-0.5)*8;
            placeSafe(holderP,BK.Props.palm(0.85+Q()*0.45,0.4+Q()*1.6),{x:px,y:groundH(px,pz),z:pz},Q()*6.28); } } }
    } else if(def.id==='salju'){
      const placed=[];
      const pineCl=[{x:130,z:-15,spread:45},{x:-125,z:35,spread:48},{x:25,z:115,spread:42},{x:-35,z:-115,spread:42}];
      const rockCl=[{x:60,z:-40,spread:36},{x:-55,z:65,spread:38},{x:-140,z:-35,spread:38},{x:120,z:90,spread:40}];
      const pines=[], snowCaps=[], trunks=[], boulders=[], pebbles=[], mounds=[];
      const zf=d=>Math.max(0.55,Math.min(1.45,(d-half-8)/36));
      // 1. Hutan pinus salju (menapak groundH + tudung salju putih di puncak)
      scatter(95,(x,z,md,d)=>{
        const s=(0.85+R()*1.25)*zf(d), gy=groundH(x,z);
        pines.push({x,y:gy,z,s:s*1.1,ry:(x*7.3+z*3.1)%6.28,v:'snow'}); // komponen 'pine' bertudung salju
      },{cluster:pineCl,avoid:placed});
      pines.forEach((it,k)=>{ it.tint=[0x2e6b4a,0x25593d,0x357a55][k%3]; });
      BK.Comp.scatter(group,'pine',pines);

      // 2. Bongkahan batu gletser & tebing es di lembah
      scatter(60,(x,z,md,d)=>{
        const s=(0.85+R()*1.75)*zf(d), gy=groundH(x,z);
        boulders.push({x,y:gy+0.85*s,z,s:s*1.3,sy:s*0.95,ry:R()*3});
      },{cluster:rockCl,avoid:placed});
      compRocks(boulders,[0x9cb4cc,0xb8d2eb,0x8299b0,0xd6e8f8],1.25);

      // 3. Sabuk bongkahan es & bola salju kecil di bahu lintasan
      {
        let pg=0;
        while(pebbles.length<115&&pg++<850){
          const ti=(R()*N)|0, side=R()<0.5?-1:1;
          const dist=half+1.8+R()*11;
          const x=pts[ti].x+normals[ti].x*side*dist+(R()-0.5)*3;
          const z=pts[ti].z+normals[ti].z*side*dist+(R()-0.5)*3;
          if(!farFromTrack(x,z,1.4)) continue;
          const s=0.28+R()*0.55;
          pebbles.push({x,y:groundH(x,z)+0.18*s,z,s:s*1.25,sy:s*0.7,ry:R()*3});
        }
        compRocks(pebbles,[0xe8f3fc,0xc2dcf2,0x9fb8d1,0xf7fbff],0.9);
      }

      // 4. Gundukan salju tebal (snowdrifts) di sekitar tikungan
      {
        const spots=[]; let dg=0;
        while(spots.length<7&&dg++<280){
          const x=(R()-0.5)*340, z=(R()-0.5)*340;
          if(farFromTrack(x,z,34)||!farFromTrack(x,z,13)) continue;
          if(spots.some(p=>Math.hypot(p[0]-x,p[1]-z)<45)) continue;
          spots.push([x,z]); placed.push([x,z]);
        }
        spots.forEach(([x,z])=>{
          for(let b=0;b<2;b++){
            const ox=(R()-0.5)*9, oz=(R()-0.5)*9, w=4.2+R()*5.5;
            mounds.push({x:x+ox,y:groundH(x+ox,z+oz)-0.4,z:z+oz,s:w,sy:1.2+R()*1.4,ry:R()*3});
          }
        });
        fillInstanced(new THREE.SphereGeometry(1,10,7), M(0xf0f6ff), mounds);
      }

      // 5. Deretan Pegunungan Salju Alpen di Cakrawala
      [[270,125,85],[-285,65,95],[125,-305,88],[-245,-265,80],[0,295,90]].forEach(([mx,mz,mh])=>{
        const m=new THREE.Mesh(new THREE.ConeGeometry(mh*0.95,mh*1.12,9), M(0x8396ad));
        m.position.set(mx,mh*0.38,mz); group.add(m);
        const cap=new THREE.Mesh(new THREE.ConeGeometry(mh*0.48,mh*0.52,9), M(0xf7fbff));
        cap.position.set(mx,mh*0.73,mz); group.add(cap);
      });
    } else {
      const placed=[];
      const rockCl=[{x:130,z:-15,spread:45},{x:-125,z:30,spread:48},{x:25,z:115,spread:42},{x:-30,z:-115,spread:42}];
      const spireCl=[{x:60,z:-40,spread:36},{x:-55,z:65,spread:38},{x:-140,z:-35,spread:38},{x:120,z:90,spread:40}];
      const rocks=[], spires=[], slag=[], mounds=[];
      const zf=d=>Math.max(0.5,Math.min(1.45,(d-half-8)/36));
      // 1. Bongkahan batu basalt & obsidian (mengikuti kontur groundH)
      scatter(95,(x,z,md,d)=>{
        const s=(0.9+R()*1.9)*zf(d), gy=groundH(x,z);
        rocks.push({x,y:gy+0.9*s,z,s:s*1.3,sy:s*0.95,ry:R()*3});
      },{cluster:rockCl,avoid:placed});
      compRocks(rocks,[0x36222c,0x281820,0x472b35,0x1f131a],1.3);

      // 2. Menara batu basalt heksagonal meruncing (volcanic spires)
      scatter(55,(x,z,md,d)=>{
        const s=(0.85+R()*1.45)*zf(d), gy=groundH(x,z);
        spires.push({x,y:gy+2.2*s,z,s:s*0.95,sy:s*2.2,ry:R()*3});
      },{cluster:spireCl,avoid:placed});
      fillInstanced(new THREE.ConeGeometry(1.35,2.4,6),
        new THREE.MeshLambertMaterial({color:0xffffff}), spires,
        (it,k,c)=>c.setHex([0x2d1b24,0x3d242e,0x22141c][k%3]));

      // 3. Sabuk kerikil vulkanik & kerak terak (slag pebbles) di tepi jalan
      {
        let sg=0;
        while(slag.length<120&&sg++<850){
          const ti=(R()*N)|0, side=R()<0.5?-1:1;
          const dist=half+1.8+R()*11;
          const x=pts[ti].x+normals[ti].x*side*dist+(R()-0.5)*3;
          const z=pts[ti].z+normals[ti].z*side*dist+(R()-0.5)*3;
          if(!farFromTrack(x,z,1.4)) continue;
          const s=0.28+R()*0.55;
          slag.push({x,y:groundH(x,z)+0.18*s,z,s:s*1.3,sy:s*0.65,ry:R()*3});
        }
        compRocks(slag,[0x2b1b22,0x3d252e,0x4f2c33,0x1f1419],0.9);
      }

      // 5. Gundukan abu vulkanik di dekat tikungan
      {
        const spots=[]; let dg=0;
        while(spots.length<7&&dg++<280){
          const x=(R()-0.5)*340, z=(R()-0.5)*340;
          if(farFromTrack(x,z,34)||!farFromTrack(x,z,13)) continue;
          if(spots.some(p=>Math.hypot(p[0]-x,p[1]-z)<45)) continue;
          spots.push([x,z]); placed.push([x,z]);
        }
        spots.forEach(([x,z])=>{
          for(let b=0;b<2;b++){
            const ox=(R()-0.5)*9, oz=(R()-0.5)*9, w=4.0+R()*5.5;
            mounds.push({x:x+ox,y:groundH(x+ox,z+oz)-0.4,z:z+oz,s:w,sy:1.2+R()*1.4,ry:R()*3});
          }
        });
        fillInstanced(new THREE.SphereGeometry(1,10,7), M(0x331e26), mounds);
      }

      // 6. Deretan Gunung Berapi Meletus di Cakrawala Kaldera
      [[280,130,90],[-290,70,100],[130,-310,95],[-250,-270,85],[0,295,88]].forEach(([mx,mz,mh])=>{
        const m=new THREE.Mesh(new THREE.ConeGeometry(mh*0.95,mh*1.12,9), M(0x281822));
        m.position.set(mx,mh*0.36,mz); group.add(m);
        const lavaCap=new THREE.Mesh(new THREE.ConeGeometry(mh*0.38,mh*0.36,9),
          new THREE.MeshBasicMaterial({color:0xff5500}));
        lavaCap.position.set(mx,mh*0.76,mz); group.add(lavaCap);
      });
    }

    // boost pads: komponen BK.Props.boostPad (desain sama dgn hub), mengikuti lengkung jalan searah balapan
    const pads=[];
    def.pads.forEach(t=>{
      const i=((Math.floor(t*N)%N)+N)%N, p=pts[i];
      const w=W*0.55, l=7.5;
      const pad=BK.Props.boostPad(BK.Props.pathSampler(pts,i,true),w,l);
      group.add(pad.group);
      pads.push({t, idx:i, pos:new THREE.Vector3(p.x,0,p.z), mesh:pad.mesh, frame:pad.frame, cx:pad.cx, cz:pad.cz, tx:pad.tx, tz:pad.tz, w, l, pulse:Math.random()*6});
    });

    // Marka panah kuning-oranye di bibir tiap ramp lompatan (mengikuti kemiringan tanjakan ramp)
    for(const rc of rampsList){
      const ri = rc[0];
      const i0 = (ri - 3 + N) % N, i1 = ri;
      const p0 = pts[i0], p1 = pts[i1], n0 = normals[i0], n1 = normals[i1];
      const rw = W * 0.42;
      const rg = new THREE.BufferGeometry();
      const rv = [
        p0.x - n0.x*rw, p0.y + 0.07, p0.z - n0.z*rw,
        p0.x + n0.x*rw, p0.y + 0.07, p0.z + n0.z*rw,
        p1.x - n1.x*rw, p1.y + 0.07, p1.z - n1.z*rw,
        p1.x + n1.x*rw, p1.y + 0.07, p1.z + n1.z*rw
      ];
      rg.setAttribute('position', new THREE.Float32BufferAttribute(rv, 3));
      rg.setAttribute('uv', new THREE.Float32BufferAttribute([0,0, 1,0, 0,1, 1,1], 2));
      rg.setIndex([0,2,1, 1,2,3]);
      rg.computeVertexNormals();
      const rm = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({
        map: chevronTexture(), transparent: true, opacity: 0.92, color: 0xffaa22
      }));
      group.add(rm);
      anim.glow.push(rm.material);
    }

    // zona es licin (def.ice): grip hilang, charge boost 2x (di atas ASPAL)
    const ice=[];
    (def.ice||[]).forEach(t=>{
      const i=((Math.floor(t*N)%N)+N)%N;
      const w=W*0.8, l=14, at=BK.Props.pathSampler(pts,i,true), c=at(0);
      // tapak es mengikuti lengkung jalan (dulu PlaneGeometry berputar salah arah); hitbox = tapak ini
      const m=new THREE.Mesh(BK.Props.pathStrip(at,l,w,0.05,1,10),
        new THREE.MeshBasicMaterial({color:0xbfe8ff,transparent:true,opacity:0.75,depthWrite:false}));
      group.add(m);
      ice.push({idx:i, w, l, cx:c.x, cz:c.z, tx:c.tx, tz:c.tz, mesh:m, pulse:Math.random()*6});
    });

    // item boxes
    const boxes=[];
    const boxGeo=new THREE.BoxGeometry(1.8,1.8,1.8);
    def.boxes.forEach((t,k)=>{
      const i=((Math.floor(t*N)%N)+N)%N, p=pts[i], n=normals[i];
      const lane=[0,-1,1][k%3]*(W*0.2); // bias garis balap tengah
      const pos=new THREE.Vector3(p.x+n.x*lane, p.y+1.2, p.z+n.z*lane);
      const m=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({
        color:0x2266ff, transparent:true, opacity:0.9, emissive:0x1133aa}));
      m.add(new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({wireframe:true,color:0xffffff})));
      m.position.copy(pos); group.add(m);
      boxes.push({t, idx:i, base:pos.clone(), mesh:m, active:true, timer:0});
    });

    function slot(k){
      const back = 6 + Math.floor(k/2)*5;
      const side = (k%2===0?-1:1)* (W*0.22);
      let i = (N - back) % N; if(i<0)i+=N;
      const p=pts[i], n=normals[i], tg=tangents[i];
      const pos=new THREE.Vector3(p.x+n.x*side, p.y, p.z+n.z*side);
      const heading=Math.atan2(tg.x,tg.z);
      return {pos, heading, idx:i};
    }

    let goTimer=-1;
    const world={
      def, pts, tangents, normals, N, half, group, boxes, pads, ice, trackLen,
      colliders,
      // zona lompat eksplisit + puncak tanjakan: (idx, setengah-lebar, laju min)
      launchZones: rampsList.map(rc=>({idx:rc[0], halfWidth:7, minSpeed:16, height:rc[1]})),
      slot, startIdx:0,
      setStartLights(stage){
        startLights.red.forEach((l,k)=>{
          const on = stage>0 && k < (4-stage); // 3->3 nyala, 2->2, 1->1
          l.material.color.setHex(on?0xff2222:0x550000);
        });
        startLights.green.material.color.setHex(stage===0?0x22ff44:0x003300);
      },
      notifyGo(){ goTimer=3; },
      nearest(x,z,hint){
        let best=-1,bd=1e18;
        for(let k=-12;k<=12;k++){
          const i=(hint+k+N*2)%N;
          const dx=x-pts[i].x,dz=z-pts[i].z;
          const d=dx*dx+dz*dz;
          if(d<bd){bd=d;best=i;}
        }
        if(bd>60*60){
          for(let i=0;i<N;i+=2){
            const dx=x-pts[i].x,dz=z-pts[i].z; const d=dx*dx+dz*dz;
            if(d<bd){bd=d;best=i;}
          }
        }
        const n=normals[best];
        const dx=x-pts[best].x,dz=z-pts[best].z;
        const lateral=dx*n.x+dz*n.z;
        return {idx:best, dist:Math.sqrt(bd), lateral};
      },
      update(dt,time){
        boxes.forEach(b=>{
          if(!b.active){ b.timer-=dt;
            if(b.timer<=0){ b.active=true; b.mesh.visible=true; b._pop=0.35; } return; }
          b.mesh.rotation.y+=dt*2; b.mesh.position.y=b.base.y+Math.sin(time*3+b.idx)*0.25;
          if(b._pop>0){ b._pop-=dt; const s=1+Math.max(0,b._pop)*2.2; b.mesh.scale.set(s,s,s); }
          else if(b.mesh.scale.x!==1) b.mesh.scale.set(1,1,1);
          if(BK.camPos){
            const cdx=BK.camPos.x-b.mesh.position.x, cdz=BK.camPos.z-b.mesh.position.z;
            b.mesh.visible=(cdx*cdx+cdz*cdz)>6.25;
          }
        });
        pads.forEach(p=>BK.Props.tickBoostPad(p,dt));
        ice.forEach(p=>{ p.pulse+=dt*3;
          p.mesh.material.opacity=0.55+Math.abs(Math.sin(p.pulse))*0.3;
        });
        if(anim.snow){
          const sp=anim.snow.geo.attributes.position;
          for(let i=0;i<sp.count;i++){
            let y=sp.getY(i)-dt*9;
            if(y<0)y=50+Math.random()*20;
            sp.setY(i,y);
          }
          sp.needsUpdate=true;
        }
        if(anim.foam) anim.foam.opacity=0.3+Math.abs(Math.sin(time*1.2))*0.25;
        anim.clouds.forEach(c=>{ c.g.position.x+=c.v*dt; if(c.g.position.x>380)c.g.position.x=-380; });
        anim.flags.forEach(f=>{ f.m.rotation.y=Math.sin(time*4+f.ph)*0.45; });
        anim.crowd.forEach(c=>{ c.m.scale.y=1+Math.max(0,Math.sin(time*6+c.ph))*0.25; });
        anim.lava.forEach((p,k)=>{ const s=1+Math.sin(time*2.4+k*2)*0.06; p.scale.set(s,s,1); });
        anim.glow.forEach((m,k)=>{ if(m.opacity!==undefined) m.opacity=0.6+Math.abs(Math.sin(time*3+k))*0.4; });
        if(goTimer>0){ goTimer-=dt; if(goTimer<=0) this.setStartLights(-1); }
      }
    };
    world.setStartLights(-1);
    BK.currentWorld=world;
    return world;
  };

  /* HUB: Pulau Bekicot open-world besar + 4 zona bioma portal + ramp lompat + turbo pad */
  // ------------------------------------------------------------------------
  // Peta hub lama (pulau generik + 4 portal) sudah dipensiunkan.
  // Pulau open-world baru dibangun oleh js/hub.js yang mengisi
  // BK.buildHub dengan kontrak world yang sama (isHub, heightAt, portals, ...).
  // ------------------------------------------------------------------------
})();
