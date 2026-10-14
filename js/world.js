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
  let _asphalt=null, _noise=null, _snow=null;
  function asphaltTex(){ if(!_asphalt){ _asphalt=speckle('#8a8f9c',['#7a7f8c','#9aa0ac','#6e737e']); _asphalt.wrapS=_asphalt.wrapT=THREE.RepeatWrapping; } return _asphalt; }
  function groundTex(){ if(!_noise){ _noise=speckle('#ffffff',['#e8e8e8','#f4f4f4','#dcdcdc']); _noise.wrapS=_noise.wrapT=THREE.RepeatWrapping; _noise.repeat.set(28,28); } return _noise; }
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

    // --- jalan (mengikuti elevasi) ---
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
    group.add(new THREE.Mesh(roadGeo, new THREE.MeshLambertMaterial({map:asphaltTex(),color:def.road})));

    // bahu oranye + garis tepi putih (mengikuti elevasi)
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
    const shoulderM=new THREE.MeshBasicMaterial({color:0xff5a2a});
    const edgeM=new THREE.MeshBasicMaterial({color:0xf2f2f2});
    ribbon(half, 0.6, shoulderM, 0.03); ribbon(-half-0.6, 0.6, shoulderM, 0.03);
    ribbon(half-0.9, 0.35, edgeM, 0.035); ribbon(-half+0.55, 0.35, edgeM, 0.035);

    // marka tengah putus-putus
    {
      const v=[], id=[]; let q=0;
      for(let i=0;i<N;i+=6){
        const p=pts[i], tg=tangents[i], n=normals[i];
        const cx=p.x, cz=p.z, cy=p.y+0.04, dx=tg.x*1.6, dz=tg.z*1.6, ox=n.x*0.25, oz=n.z*0.25;
        v.push(cx-dx+ox,cy,cz-dz+oz, cx-dx-ox,cy,cz-dz-oz,
               cx+dx+ox,cy,cz+dz+oz, cx+dx-ox,cy,cz+dz-oz);
        id.push(q,q+2,q+1, q+1,q+2,q+3); q+=4; // winding menghadap atas
      }
      const g=new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v,3));
      g.setIndex(id); g.computeVertexNormals();
      group.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xffd23f})));
    }

    // garis start kotak-kotak
    {
      const p=pts[0], tg=tangents[0];
      const m=new THREE.Mesh(new THREE.PlaneGeometry(W,4),
        new THREE.MeshBasicMaterial({map:checkerTexture()}));
      m.rotation.x=-Math.PI/2; m.rotation.z=-Math.atan2(tg.x,tg.z);
      m.position.set(p.x,p.y+0.05,p.z); group.add(m);
    }

    // dinding + tiang patok
    function walls(offset, color){
      const g=new THREE.BufferGeometry(); const v=[], id=[];
      const H=1.1;
      for(let i=0;i<N;i++){
        const p=pts[i], n=normals[i];
        const x=p.x+n.x*offset, z=p.z+n.z*offset;
        v.push(x,p.y,z, x,p.y+H,z);
        const a=i*2,b=i*2+1,c=((i+1)%N)*2,d=((i+1)%N)*2+1;
        id.push(a,c,b, b,c,d);
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(v,3));
      g.setIndex(id); g.computeVertexNormals();
      group.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({color, side:THREE.DoubleSide})));
    }
    walls(half+0.6, 0xd94f30); walls(-half-0.6, 0xd94f30);
    {
      const post=new THREE.BoxGeometry(0.35,1.5,0.35);
      const spots=[];
      for(let i=0;i<N;i+=6){ spots.push([i,1]); spots.push([i,-1]); }
      const inst=new THREE.InstancedMesh(post, M(0xf5f5f5), spots.length);
      const mtx=new THREE.Matrix4(), q=new THREE.Quaternion(), s=new THREE.Vector3(1,1,1);
      spots.forEach(([i,side],k)=>{
        const p=pts[i], n=normals[i];
        mtx.compose(new THREE.Vector3(p.x+n.x*side*(half+1.0),p.y+0.75,p.z+n.z*side*(half+1.0)),q,s);
        inst.setMatrixAt(k,mtx);
      });
      inst.instanceMatrix.needsUpdate=true; group.add(inst);
    }

    // tanah relief + biome (G1/G2: dune analitik + warna pasir/basah/rumput)
    // amplitudo per trek; diratakan di dekat jalan agar tidak menelan trek
    const reliefAmp={pantai:1.2,hutan:0.8,kawah:1.0,salju:1.5}[def.id]||0;
    function groundH(x,z){
      if(!reliefAmp) return 0;
      const h=reliefAmp*Math.sin(x*0.02)*Math.cos(z*0.017)+reliefAmp*0.4*Math.sin(x*0.05+1)*Math.cos(z*0.043);
      const tdy=trackDistY(x,z); // [jarak, tinggiJalan] -> tanah menyambung ke tepi jalan
      const t=Math.max(0,Math.min(1,(tdy[0]-half-8)/18));
      const s=t*t*(3-2*t);
      let g=tdy[1]+(h-tdy[1])*s;
      if(Math.hypot(x,z)<354) g=Math.max(-0.05,g); // daratan tak boleh di bawah laut (tepi cakram bebas turun)
      return g;
    }
    {
      const NR=24, NS=72, RD=385;
      const g=new THREE.BufferGeometry(); const v=[], uvs=[], cols=[], id=[];
      const cSand=new THREE.Color(def.ground), cWet=new THREE.Color(0xC9B184), cGrass=new THREE.Color(0x9aa04d);
      const tmp=new THREE.Color();
      const edgeT=0.92;
      function gxy(r,a){
        const x=Math.sin(a)*r, z=Math.cos(a)*r;
        let h=groundH(x,z);
        if(r/RD>edgeT) h=h*(1-(r/RD-edgeT)/(1-edgeT))+(-0.6)*((r/RD-edgeT)/(1-edgeT));
        return [x,h-0.1,z];
      }
      function gcol(x,z,h){
        const wet=1-Math.max(0,Math.min(1,h/0.5));
        const dry=Math.max(0,Math.min(1,(h-0.7)/0.8));
        tmp.copy(cSand).lerp(cWet,wet*0.7).lerp(cGrass,dry*0.55);
        return [tmp.r,tmp.g,tmp.b];
      }
      v.push(0,groundH(0,0)-0.1,0); uvs.push(0,0);
      { const c0=gcol(0,0,groundH(0,0)); cols.push(c0[0],c0[1],c0[2]); }
      for(let j=1;j<=NR;j++)for(let i=0;i<NS;i++){
        const a=i/NS*Math.PI*2, r=RD*j/NR;
        const p=gxy(r,a);
        v.push(p[0],p[1],p[2]); uvs.push(p[0]/40,p[2]/40);
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
      const gmap=def.id==='salju'?snowTex():groundTex();
      group.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({map:gmap,color:def.ground})));
    }
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 0.95));
    const sun=new THREE.DirectionalLight(0xffffff,0.9); sun.position.set(80,120,40); scene.add(sun);
    if(def.id==='pantai'){ // G5 cahaya sore hangat
      sun.position.set(140,55,60); sun.color.setHex(0xffdfb0);
      scene.fog=new THREE.Fog(0x9fd0e8, 120, 420);
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
      const sunM=new THREE.Mesh(new THREE.CircleGeometry(34,20),
        new THREE.MeshBasicMaterial({color:def.id==='kawah'?0xf5f0ff:0xfff2b0,fog:false}));
      sunM.position.set(260,300,-560); sunM.lookAt(0,0,0); group.add(sunM);
      // awan
      const cloudM=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.92,fog:false});
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
      for(let i=0;i<N;i+=4){ const dx=x-pts[i].x,dz=z-pts[i].z; const d=dx*dx+dz*dz; if(d<m)m=d; }
      return Math.sqrt(m);
    }
    function trackDistY(x,z){
      let m=1e18, y=0;
      for(let i=0;i<N;i+=4){ const dx=x-pts[i].x,dz=z-pts[i].z; const d=dx*dx+dz*dz; if(d<m){m=d;y=pts[i].y;} }
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
    if(def.id==='hutan'){
      for(let k=0;k<12;k++){
        const x=(Math.random()-0.5)*380, z=(Math.random()-0.5)*380;
        if(!farFromTrack(x,z,14)) continue;
        const r=8+Math.random()*14;
        const p=new THREE.Mesh(new THREE.CircleGeometry(r,14), M(0x3a7038));
        p.rotation.x=-Math.PI/2; p.position.set(x,0.0,z); group.add(p);
      }
      // kunang-kunang
      const n=46, vp=new Float32Array(n*3);
      for(let i=0;i<n;i++){ const c=pts[(i*7)%N]; vp[i*3]=c.x+(Math.random()-0.5)*30; vp[i*3+1]=1+Math.random()*3; vp[i*3+2]=c.z+(Math.random()-0.5)*30; }
      const fg=new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(vp,3));
      const fm=new THREE.PointsMaterial({color:0xd6ff5a,size:3,sizeAttenuation:false,transparent:true,opacity:0.9});
      const fire=new THREE.Points(fg,fm); group.add(fire);
      anim.glow.push(fm);
    }
    if(def.id==='salju'){
      const a=at(0.6,1,half+22); // danau beku
      const lake=new THREE.Mesh(new THREE.CircleGeometry(14,24),
        new THREE.MeshBasicMaterial({color:0x9fd4f5}));
      lake.rotation.x=-Math.PI/2; lake.position.set(a.x,0.02,a.z); group.add(lake);
      const rim=new THREE.Mesh(new THREE.RingGeometry(14,16,24),
        new THREE.MeshBasicMaterial({color:0xffffff}));
      rim.rotation.x=-Math.PI/2; rim.position.set(a.x,0.03,a.z); group.add(rim);
      // hujan salju
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
      for(let k=0;k<10;k++){ // retakan lava
        const c=pts[(k*23)%N];
        const m=new THREE.Mesh(new THREE.BoxGeometry(7,0.12,0.9),
          new THREE.MeshBasicMaterial({color:0xff6a00}));
        m.position.set(c.x+(Math.random()-0.5)*60, 0.02, c.z+(Math.random()-0.5)*60);
        if(!farFromTrack(m.position.x,m.position.z,4)){ k--; continue; }
        m.rotation.y=Math.random()*Math.PI; group.add(m);
      }
      [[0.3,1],[0.62,-1],[0.85,1]].forEach(([t,side])=>{ // kolam lava
        const a=at(t,side,half+14);
        const pool=new THREE.Mesh(new THREE.CircleGeometry(6,18),
          new THREE.MeshBasicMaterial({color:0xff5a00}));
        pool.rotation.x=-Math.PI/2; pool.position.set(a.x,0.05,a.z); group.add(pool);
        anim.lava.push(pool);
      });
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
    function pillar(x,z,s){
      const g=new THREE.Group();
      const r=new THREE.Mesh(new THREE.DodecahedronGeometry(2.4*s,0), M(0x4a2a34)); r.position.y=2*s; r.rotation.set(0.4,0.7,0.2); g.add(r);
      const cry=new THREE.Mesh(new THREE.OctahedronGeometry(0.8*s,0),
        new THREE.MeshBasicMaterial({color:0xff8a00})); cry.position.set(1.4*s,1*s,0.6*s); g.add(cry);
      anim.glow.push(cry.material);
      g.position.set(x,groundH(x,z),z); group.add(g); return g;
    }
    function skullArch(x,z,heading){
      const g=new THREE.Group();
      [-1,1].forEach(s=>{
        const leg=new THREE.Mesh(new THREE.CylinderGeometry(1,1.3,9,8), M(0x3a3a3a)); leg.position.set(s*(half+2.5),4.5,0); g.add(leg);
        const horn=new THREE.Mesh(new THREE.ConeGeometry(0.7,2.4,7), M(0xe8e0cc)); horn.position.set(s*(half+2.5),9.6,0); g.add(horn);
      });
      const beam=new THREE.Mesh(new THREE.BoxGeometry(W+9,1.6,1.6), M(0x3a3a3a)); beam.position.y=8.6; g.add(beam);
      g.position.set(x,groundH(x,z),z); g.rotation.y=heading; group.add(g); return g;
    }

    function snowPine(x,y,z,s){
      const g=new THREE.Group();
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.35*s,0.45*s,1.6*s,7), M(0x5a4028));
      trunk.position.y=0.8*s; g.add(trunk);
      for(let k=0;k<3;k++){
        const c=new THREE.Mesh(new THREE.ConeGeometry((2.6-k*0.6)*s,2.8*s,8), M(0x2e6b4a));
        c.position.y=(2.4+k*1.8)*s; g.add(c);
        const cap=new THREE.Mesh(new THREE.ConeGeometry((2.0-k*0.5)*s,1.2*s,8),
          M(0xf2f6fc));
        cap.position.y=(3.3+k*1.8)*s; g.add(cap);
      }
      g.position.set(x,y,z); group.add(g); return g;
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

    // landmark per trek
    if(def.id==='pantai'){
      const l=at(0.5,1,half+26);
      // bukit mercusuar: timbunan di bawahnya (dekorasi: tak terjangkau)
      const mound=new THREE.Mesh(new THREE.SphereGeometry(1,14,10), M(0xD9C184));
      mound.scale.set(15,5,15); mound.position.set(l.x,groundH(l.x,l.z)-0.5,l.z); group.add(mound);
      lighthouse(l.x,l.z).position.y+=4; // duduk di puncak timbunan
      colliders.push({x:l.x,z:l.z,r:3});
      [[0.12,1],[0.4,-1],[0.78,-1]].forEach(([t,s])=>{ const a=at(t,s,half+11); BK.placeProp({group,colliders},BK.Props.hut(1),a.x,a.y,a.z,a.heading); });
      [[0.2,-1],[0.33,1],[0.55,-1],[0.7,1],[0.9,-1]].forEach(([t,s])=>{ const a=at(t,s,half+6); colliders.push({x:a.x,z:a.z,r:1}); });
      // payung instanced (tiang + tudung tint per instance, 2 draw call)
      {
        const up=[], ut=[];
        [[0.2,-1,0xff5a5a],[0.33,1,0x3fb6ff],[0.55,-1,0xffd23f],[0.7,1,0xff5a5a],[0.9,-1,0x3fb6ff]].forEach(([t,s,c])=>{
          const a=at(t,s,half+6);
          up.push({x:a.x,y:a.y+1.3,z:a.z,s:1});
          ut.push({x:a.x,y:a.y+2.8,z:a.z,s:1,c});
        });
        fillInstanced(new THREE.CylinderGeometry(0.09,0.09,2.6,6), M(0xdddddd), up);
        fillInstanced(new THREE.ConeGeometry(1.8,1,8),
          new THREE.MeshLambertMaterial({color:0xffffff}), ut,
          (it,k2,cc)=>cc.setHex([0xff5a5a,0x3fb6ff,0xffd23f][k2%3]));
      }
      [[0.08,1],[0.3,-1],[0.62,1],[0.88,-1]].forEach(([t,s])=>{ const a=at(t,s,half+9); BK.placeProp({group,colliders},BK.Props.palm(1),a.x,a.y,a.z,0); });
      [[0.28,1,0xff5a5a],[0.58,-1,0x3fb6ff],[0.83,1,0xffd23f]].forEach(([t,s,c])=>{ // bola pantai
        const a=at(t,s,half+5);
        const b=new THREE.Mesh(new THREE.SphereGeometry(0.9,12,10), M(0xffffff));
        b.position.set(a.x,a.y+0.9,a.z); group.add(b);
        [-0.5,0.5].forEach(o=>{
          const band=new THREE.Mesh(new THREE.TorusGeometry(0.72,0.18,7,16), M(c));
          band.position.set(a.x,a.y+0.9+o,a.z); band.rotation.x=Math.PI/2; group.add(band);
        });
      });
    }
    if(def.id==='hutan'){
      [[0.1,1],[0.25,-1],[0.45,1],[0.6,-1],[0.8,1],[0.93,-1]].forEach(([t,s])=>{ const a=at(t,s,half+8); BK.placeProp({group,colliders},BK.Props.pine(1.2),a.x,a.y,a.z,0); });
      const g=at(0.02,0,0); // gapura kayu start
      const arch=new THREE.Group();
      [-1,1].forEach(s=>{
        const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.6,8,7), M(0x6b4a2a)); leg.position.set(s*(half+1.5),4,0); arch.add(leg);
      });
      const beam=new THREE.Mesh(new THREE.BoxGeometry(W+5,1.2,1.2), M(0x6b4a2a)); beam.position.y=7.8; arch.add(beam);
      arch.position.set(g.x,0,g.z); arch.rotation.y=g.heading; group.add(arch);
    }
    if(def.id==='kawah'){
      [[0.1,1],[0.28,-1],[0.5,1],[0.68,-1],[0.88,1]].forEach(([t,s])=>{ const a=at(t,s,half+10); pillar(a.x,a.z,1.2); colliders.push({x:a.x,z:a.z,r:2.5}); });
      const s0=at(0.0,0,0); skullArch(s0.x,s0.z,s0.heading);
      colliders.push({x:s0.x-Math.cos(s0.heading)*(half+2.5),z:s0.z+Math.sin(s0.heading)*(half+2.5),r:1.5});
      colliders.push({x:s0.x+Math.cos(s0.heading)*(half+2.5),z:s0.z-Math.sin(s0.heading)*(half+2.5),r:1.5});
    }
    if(def.id==='salju'){
      [[0.08,1],[0.25,-1],[0.45,1],[0.6,-1],[0.82,1]].forEach(([t,s])=>{ const a=at(t,s,half+9); snowPine(a.x,a.y,a.z,1.1); colliders.push({x:a.x,z:a.z,r:1.8}); });
      [[0.3,-1],[0.55,1],[0.78,-1]].forEach(([t,s])=>{ const a=at(t,s,half+12); cabin(a.x,a.y,a.z,a.heading); colliders.push({x:a.x,z:a.z,r:3.5}); });
      [[0.05,1],[0.5,-1]].forEach(([t,s])=>{ const a=at(t,s,half+6); snowman(a.x,a.y,a.z); colliders.push({x:a.x,z:a.z,r:1.2}); });
      // gunung latar + tiang penyangga jalan layang
      [[260,120,70],[-280,60,80],[120,-300,75],[-240,-260,65]].forEach(([mx,mz,mh])=>{
        const m=new THREE.Mesh(new THREE.ConeGeometry(mh,mh*1.1,9), M(0x8a93a5));
        m.position.set(mx,mh*0.4,mz); group.add(m);
        const cap=new THREE.Mesh(new THREE.ConeGeometry(mh*0.45,mh*0.5,9), M(0xffffff));
        cap.position.set(mx,mh*0.72,mz); group.add(cap);
      });
      const sup=[];
      for(let i=0;i<N;i+=12){
        if(pts[i].y>2) sup.push({x:pts[i].x,y:(pts[i].y-0.5)/2,z:pts[i].z,s:1,sy:pts[i].y+0.5});
      }
      fillInstanced(new THREE.BoxGeometry(1.2,1,1.2), M(0x6b4a2a), sup);
      // tanggul salju di sisi jalan
      const bankM=new THREE.MeshBasicMaterial({color:0xf2f6fc});
      ribbon(half+0.6, 5, bankM, -0.25); ribbon(-half-5.6, 5, bankM, -0.25);
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
      g.position.set(s0.x,s0.y,s0.z); g.rotation.y=s0.heading;
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
    if(def.id==='hutan'){
      const trees=[], trunks=[];
      scatter(110,(x,z)=>{ const s=0.8+Math.random()*1.4;
        trees.push({x,y:4.4*s,z,s:s*1.6}); trunks.push({x,y:0.8*s,z,s}); });
      fillInstanced(new THREE.ConeGeometry(2.4,7,7), M(0x2d6b2d), trees);
      fillInstanced(new THREE.CylinderGeometry(0.4,0.5,2,6), M(0x6b4a2a), trunks);
    } else if(def.id==='pantai'){
      const rocks=[], bush=[];
      const placed=[]; // jarak minimum bersama
      const rockCl=[{x:120,z:-20,spread:45},{x:-80,z:60,spread:40}];
      const bushCl=[{x:40,z:80,spread:38},{x:-60,z:-50,spread:42}];
      const zf=d=>Math.max(0.35,Math.min(1.3,(d-half-10)/40)); // kecil dekat trek, besar jauh
      scatter(60,(x,z,md,d)=>{ const s=(0.8+R()*2)*zf(d); rocks.push({x,y:groundH(x,z)+1.0*s,z,s,ry:R()*3}); },{cluster:rockCl,avoid:placed});
      scatter(70,(x,z,md,d)=>{ const s=(0.8+R())*zf(d); bush.push({x,y:groundH(x,z)+1.2*s,z,s}); },{cluster:bushCl,avoid:placed});
      fillInstanced(new THREE.DodecahedronGeometry(1.2,0), M(0x9a9a9a), rocks,
        (it,k,c)=>c.setHex(0x9a9a9a).offsetHSL(0,0,((k*37)%11-5)*0.008));
      fillInstanced(new THREE.ConeGeometry(1.6,2.6,6), M(0x3e8e4d), bush,
        (it,k,c)=>c.setHex(0x3e8e4d).offsetHSL(((k*53)%11-5)*0.006,0,((k*29)%9-4)*0.01));
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
      fillInstanced(new THREE.SphereGeometry(1,12,8), M(0xD9C184), dunes);
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
    } else if(def.id==='salju'){
      const pines=[], trunks=[];
      scatter(80,(x,z)=>{ const s=0.9+Math.random()*1.1;
        pines.push({x,y:4.6*s,z,s:s*1.5}); trunks.push({x,y:0.8*s,z,s}); });
      fillInstanced(new THREE.ConeGeometry(2.2,6.5,7), M(0x2e6b4a), pines);
      fillInstanced(new THREE.CylinderGeometry(0.35,0.45,1.8,6), M(0x5a4028), trunks);
    } else {
      const rocks=[], crys=[];
      scatter(90,(x,z)=>{ rocks.push({x,y:1,z,s:1+Math.random()*2.4,ry:Math.random()*3}); });
      scatter(36,(x,z)=>{ crys.push({x,y:0.7,z,s:0.6+Math.random()*0.9,ry:Math.random()*3}); });
      fillInstanced(new THREE.DodecahedronGeometry(1.4,0), M(0x3a2530), rocks);
      fillInstanced(new THREE.OctahedronGeometry(0.9,0),
        new THREE.MeshBasicMaterial({color:0xff7a00}), crys);
    }

    // boost pads (chevron jalan, di atas ASPAL bukan tanah)
    const pads=[];
    def.pads.forEach(t=>{
      const i=((Math.floor(t*N)%N)+N)%N;
      const p=pts[i], tg=tangents[i];
      const a={i, x:p.x, y:p.y, z:p.z, heading:Math.atan2(tg.x,tg.z)};
      const w=W*0.55, l=7;
      const tex=chevronTexture();
      const m=new THREE.Mesh(new THREE.PlaneGeometry(w,l),
        new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:0.9,color:0x44ccff}));
      m.rotation.x=-Math.PI/2; m.rotation.z=-a.heading;
      m.position.set(a.x,a.y+0.06,a.z);
      group.add(m);
      pads.push({t, idx:a.i, pos:new THREE.Vector3(a.x,0,a.z), mesh:m, w, l, pulse:Math.random()*6});
    });

    // zona es licin (def.ice): grip hilang, charge boost 2x (di atas ASPAL)
    const ice=[];
    (def.ice||[]).forEach(t=>{
      const i=((Math.floor(t*N)%N)+N)%N;
      const p=pts[i], tg=tangents[i];
      const a={i, x:p.x, y:p.y, z:p.z, heading:Math.atan2(tg.x,tg.z)};
      const w=W*0.8, l=14;
      const m=new THREE.Mesh(new THREE.PlaneGeometry(w,l),
        new THREE.MeshBasicMaterial({color:0xbfe8ff,transparent:true,opacity:0.75}));
      m.rotation.x=-Math.PI/2; m.rotation.z=-a.heading;
      m.position.set(a.x,a.y+0.05,a.z);
      group.add(m);
      ice.push({idx:a.i, w, mesh:m, pulse:Math.random()*6});
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
        });
        pads.forEach(p=>{ p.pulse+=dt*4;
          p.mesh.material.opacity=0.65+Math.abs(Math.sin(p.pulse))*0.3;
          if(p.mesh.material.map) p.mesh.material.map.offset.y-=dt*1.5;
        });
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
    return world;
  };

  /* HUB: Pulau Bekicot open-world mini + 3 portal balapan */
  BK.buildHub = function(scene){
    // HUB_R = radius dasar pulau. Expand = naikkan angka ini; layout ikut skala via HS.
    const HUB_R=230, HS=HUB_R/143;
    const group = new THREE.Group();
    scene.add(group);
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 200, 850);
    const anim={clouds:[],rings:[],flags:[]};
    const colliders=[]; // diisi BK.placeProp: [{x,z,r}]

    // garis pantai organik dari FBM (bukan sinus kaku) — fisika & minimap pakai array SAMA
    const coast=[];
    for(let i=0;i<64;i++){
      const a=i/64*Math.PI*2;
      coast.push(HUB_R+(fbm2(Math.cos(a)*1.4+5,Math.sin(a)*1.4+5,3)-0.5)*68);
    }
    // laut berkilau +083d7 pantai gradasi (pasir basah -> dangkal -> dalam) + buih ikut lekuk
    const seaTex=waterTex();
    const sea=new THREE.Mesh(new THREE.CircleGeometry(900,40),
      new THREE.MeshBasicMaterial({map:seaTex,color:0x9fd4e8}));
    sea.rotation.x=-Math.PI/2; sea.position.y=-0.5; group.add(sea);
    anim.sea=seaTex;
    {
      const g=new THREE.BufferGeometry(); const v=[], cols=[], id=[];
      const cSand=new THREE.Color(0xD9C184), cShal=new THREE.Color(0x7fd4e8), cDeep=new THREE.Color(0x2a9db8);
      for(let i=0;i<=64;i++){
        const a=i/64*Math.PI*2, r=coast[i%64];
        v.push(Math.sin(a)*(r-8),-0.18,Math.cos(a)*(r-8));
        v.push(Math.sin(a)*(r+3),-0.28,Math.cos(a)*(r+3));
        v.push(Math.sin(a)*(r+16),-0.4,Math.cos(a)*(r+16));
        cols.push(cSand.r,cSand.g,cSand.b, cShal.r,cShal.g,cShal.b, cDeep.r,cDeep.g,cDeep.b);
      }
      for(let i=0;i<64;i++){
        const A=i*3, B=(i+1)*3;
        id.push(A,A+1,B, A+1,B+1,B, A+1,A+2,B+1, A+2,B+2,B+1);
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(v,3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols,3));
      g.setIndex(id); g.computeVertexNormals();
      group.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true})));
      // buih putih tepat di garis pasir
      const fg=new THREE.BufferGeometry(); const fv=[], fid=[];
      for(let i=0;i<=64;i++){
        const a=i/64*Math.PI*2, r=coast[i%64];
        fv.push(Math.sin(a)*(r-1.5),0.02,Math.cos(a)*(r-1.5));
        fv.push(Math.sin(a)*(r+2.5),0.02,Math.cos(a)*(r+2.5));
      }
      for(let i=0;i<64;i++){ const a=i*2; fid.push(a,a+1,a+2, a+1,a+3,a+2); }
      fg.setAttribute('position', new THREE.Float32BufferAttribute(fv,3));
      fg.setIndex(fid); fg.computeVertexNormals();
      const foam=new THREE.Mesh(fg,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.55,side:THREE.DoubleSide}));
      group.add(foam);
      anim.foamEdge=foam.material;
    }
    // --- terrain heightfield milik sendiri (ganti cakram datar) ---
    const FLATS=[
      {x:0,z:0,ri:26,ro:42,mode:'set',h:0.6}, // plaza
      {x:-60,z:45,ri:8,ro:22,mode:'dip',h:2.2} // kolam
    ];
    // E2 fitur geografis: gunung berapi timur, laguna barat, mesa selatan
    const VOLC={x:150,z:-40,r:26,peak:14}, LAG={x:-150,z:30,r:30}, MESA={x:40,z:-130,r:28,h:6.5};
    FLATS.push({x:VOLC.x,z:VOLC.z,ri:2,ro:VOLC.r,mode:'set',h:VOLC.peak});
    FLATS.push({x:MESA.x,z:MESA.z,ri:12,ro:MESA.r,mode:'set',h:MESA.h});
    FLATS.push({x:LAG.x,z:LAG.z,ri:10,ro:LAG.r,mode:'dip',h:5});
    [Math.PI/2,Math.PI/2+Math.PI*2/3,Math.PI/2+Math.PI*4/3].forEach(a=>{
      FLATS.push({x:Math.cos(a)*70*HS,z:Math.sin(a)*70*HS,ri:8,ro:18,mode:'set',h:2.0});
    });
    const HAT=(x,z)=>BK.Terrain.heightAt(x,z,coast,FLATS);
    {
      const N=120, S=600, st=S/N;
      const g=new THREE.BufferGeometry(); const v=[], uvs=[], cols=[], id=[];
      for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){
        const x=-S/2+i*st, z=-S/2+j*st;
        const h=HAT(x,z);
        v.push(x,h,z); uvs.push(x/40,z/40);
        const e=2;
        const sl={x:(HAT(x+e,z)-HAT(x-e,z))/(2*e), z:(HAT(x,z+e)-HAT(x,z-e))/(2*e)};
        const c=BK.Terrain.biome(h,sl);
        cols.push(c[0],c[1],c[2]);
      }
      for(let j=0;j<N;j++)for(let i=0;i<N;i++){
        const a=j*(N+1)+i;
        id.push(a,a+N+1,a+1, a+1,a+N+1,a+N+2);
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(v,3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols,3));
      g.setIndex(id); g.computeVertexNormals();
      group.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,map:groundTex()})));
    }
    const plazaEdge=new THREE.Mesh(new THREE.TorusGeometry(26,0.4,8,40),
      new THREE.MeshLambertMaterial({color:0x6a6a72}));
    plazaEdge.position.y=0.68; plazaEdge.rotation.x=Math.PI/2; group.add(plazaEdge);
    const plaza=new THREE.Mesh(new THREE.CircleGeometry(26,28),
      new THREE.MeshLambertMaterial({map:pavingTex(),color:0x9a9aa8}));
    plaza.rotation.x=-Math.PI/2; plaza.position.y=0.66; group.add(plaza);
    const pondY=HAT(-60,45);
    const pond=new THREE.Mesh(new THREE.CircleGeometry(11,22),
      new THREE.MeshLambertMaterial({map:waterTex(),color:0x9fd4e8}));
    pond.rotation.x=-Math.PI/2; pond.position.set(-60,pondY+0.25,45); group.add(pond);
    for(let s=-1;s<=1;s++){ // batu pijakan kolam
      const st=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.6,0.5,8), M(0x9a9a9a));
      const sx=-60+s*3.2, sz=45+s*1.2;
      st.position.set(sx,HAT(sx,sz)+0.15,sz); group.add(st);
    }
    scene.add(new THREE.HemisphereLight(0xffffff,0x334455,0.55));
    const hubSun=new THREE.DirectionalLight(0xffffff,0.75); hubSun.position.set(80,120,40); scene.add(hubSun);

    // kubah langit + awan (ringkas)
    {
      const g=new THREE.SphereGeometry(760,12,8);
      const top=new THREE.Color(0x3f8fd1), hor=new THREE.Color(0xcfeef7);
      const pos=g.attributes.position, cols=[];
      for(let i=0;i<pos.count;i++){
        const y=pos.getY(i)/760;
        const c=hor.clone().lerp(top, Math.max(0,Math.min(1,(y+0.1)*1.4)));
        cols.push(c.r,c.g,c.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols,3));
      group.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false})));
      const cloudM=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.92,fog:false});
      for(let k=0;k<6;k++){
        const c=new THREE.Group();
        for(let j=0;j<3;j++){
          const s=new THREE.Mesh(new THREE.SphereGeometry(6+Math.random()*6,8,6),cloudM);
          s.position.set(j*9-9,Math.random()*2,Math.random()*4); s.scale.y=0.55; c.add(s);
        }
        c.position.set((Math.random()-0.5)*600,75+Math.random()*40,(Math.random()-0.5)*600);
        group.add(c); anim.clouds.push({g:c,v:1+Math.random()*1.5});
      }
    }

    // pepohonan acak LEGA di tepi + rumpun (clumping) + variansi ukuran + jarak min gubuk
    const holder={group,colliders};
    const hutPts=[];
    const clusters=[]; for(let c=0;c<4;c++)clusters.push([Math.random()*Math.PI*2,50+Math.random()*60]);
    for(let k=0;k<12;k++){
      const a=Math.random()*Math.PI*2, r=(62+Math.random()*40)*HS;
      const x=Math.cos(a)*r, z=Math.sin(a)*r;
      const e=1.5; // tolak lereng curam (pola sama kayak rumput)
      const sl=Math.hypot(HAT(x+e,z)-HAT(x-e,z),HAT(x,z+e)-HAT(x,z-e))/(2*e);
      if(sl>0.55) continue;
      const s=0.7+Math.random()*0.9, t=Math.random();
      if(t<0.5) BK.placeProp(holder,BK.Props.palm(s),x,HAT(x,z),z,Math.random()*6);
      else if(t<0.8) BK.placeProp(holder,BK.Props.rock(s),x,HAT(x,z),z,Math.random()*6);
      else {
        if(hutPts.some(p=>Math.hypot(p[0]-x,p[1]-z)<25*HS)) continue;
        hutPts.push([x,z]);
        BK.placeProp(holder,BK.Props.hut(1),x,HAT(x,z),z,Math.random()*6);
      }
    }
    // rumput berumpun (instanced, 1 draw call, tolak curam/air)
    {
      const spots=[];
      let guard=0;
      while(spots.length<120&&guard++<900){
        const c=clusters[(Math.random()*clusters.length)|0];
        const a=c[0]+(Math.random()-0.5)*0.9, r=Math.max(28,(c[1]+(Math.random()-0.5)*36))*HS;
        const x=Math.cos(a)*r, z=Math.sin(a)*r;
        const h=HAT(x,z);
        if(h<1||h>5.5) continue;
        const e=1.5;
        const sl=Math.hypot(HAT(x+e,z)-HAT(x-e,z),HAT(x,z+e)-HAT(x,z-e))/(2*e);
        if(sl>0.45) continue;
        spots.push([x,h,z,0.7+Math.random()*0.8]);
      }
      const inst=new THREE.InstancedMesh(new THREE.ConeGeometry(0.28,0.9,5),
        new THREE.MeshLambertMaterial({color:0x4da34d}),Math.max(1,spots.length));
      const mtx=new THREE.Matrix4(), qt=new THREE.Quaternion(), eu=new THREE.Euler(), one=new THREE.Vector3();
      spots.forEach((s2,k)=>{
        eu.set(0,Math.random()*6,0); qt.setFromEuler(eu); one.set(s2[3],s2[3],s2[3]);
        mtx.compose(new THREE.Vector3(s2[0],s2[1]+0.3,s2[2]),qt,one);
        inst.setMatrixAt(k,mtx);
      });
      inst.count=spots.length;
      inst.instanceMatrix.needsUpdate=true; group.add(inst);
    }

    // jalan tanah plaza -> tiap portal (menempel terrain, 8 segmen)
    [[Math.PI/2],[Math.PI/2+Math.PI*2/3],[Math.PI/2+Math.PI*4/3]].forEach(([a])=>{
      const x0=Math.cos(a)*24, z0=Math.sin(a)*24, x1=Math.cos(a)*76*HS, z1=Math.sin(a)*76*HS;
      const SEG=8, pv=[], pid=[];
      for(let s=0;s<=SEG;s++){
        const x=x0+(x1-x0)*s/SEG, z=z0+(z1-z0)*s/SEG;
        const dx=(x1-x0), dz=(z1-z0), L=Math.hypot(dx,dz);
        const nx=-dz/L*3.5, nz=dx/L*3.5;
        pv.push(x+nx,HAT(x+nx,z+nz)+0.07,z+nz, x-nx,HAT(x-nx,z-nz)+0.07,z-nz);
      }
      for(let s=0;s<SEG;s++){ const A=s*2; pid.push(A,A+2,A+1, A+1,A+2,A+3); }
      const pg=new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.Float32BufferAttribute(pv,3));
      pg.setIndex(pid); pg.computeVertexNormals();
      group.add(new THREE.Mesh(pg,new THREE.MeshLambertMaterial({map:pathTex(),alphaMap:featherTex(),transparent:true,color:0xC9B184,side:THREE.DoubleSide})));
    });
    // teluk selatan: payung + bola + palem
    function tinyUmbrella(x,z,c){
      const hy=HAT(x,z);
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,2.6,6), M(0xdddddd)); pole.position.set(x,hy+1.3,z); group.add(pole);
      const top=new THREE.Mesh(new THREE.ConeGeometry(1.8,1,8), M(c)); top.position.set(x,hy+2.8,z); group.add(top);
    }
    tinyUmbrella(-6,102,0xff5a5a); tinyUmbrella(8,106,0x3fb6ff);
    // rumpun hutan barat-laut (reusable + collider)
    for(let k=0;k<7;k++){
      const x=-70+((k*37)%24)-12, z=-20+((k*53)%20)-10;
      BK.placeProp(holder,BK.Props.pine(1.1),x,HAT(x,z),z,Math.random()*6);
    }
    // kawah + bara gunung + bendera puncak mesa
    {
      const vy=HAT(VOLC.x,VOLC.z);
      const crater=new THREE.Mesh(new THREE.CircleGeometry(6,18),
        new THREE.MeshBasicMaterial({color:0x1a0a0a}));
      crater.rotation.x=-Math.PI/2; crater.position.set(VOLC.x,vy+0.15,VOLC.z); group.add(crater);
      const ember=new THREE.Mesh(new THREE.RingGeometry(4,6.5,20),
        new THREE.MeshBasicMaterial({color:0xff6a00,transparent:true,opacity:0.8,side:THREE.DoubleSide}));
      ember.rotation.x=-Math.PI/2; ember.position.set(VOLC.x,vy+0.2,VOLC.z); group.add(ember);
      anim.ember=ember.material;
      const my=HAT(MESA.x,MESA.z);
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,7,6), M(0xeeeeee));
      pole.position.set(MESA.x,my+3.5,MESA.z); group.add(pole);
      const fl=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.4),
        new THREE.MeshBasicMaterial({color:0x7CFC00,side:THREE.DoubleSide}));
      fl.position.set(MESA.x+1.3,my+6,MESA.z); group.add(fl);
      anim.flags.push({m:fl,ph:1.2});
    }
    [[70,-60],[74,-56],[66,-64]].forEach(([x,z],i)=>{
      BK.placeProp(holder,BK.Props.rock(1.3+i*0.4),x,HAT(x,z),z,Math.random()*6);
    });
    {
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,7,6), M(0xeeeeee));
      pole.position.set(70,HAT(70,-60)+3.5,-60); group.add(pole);
      const fl=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.4),
        new THREE.MeshBasicMaterial({color:0xffd23f,side:THREE.DoubleSide}));
      fl.position.set(71.3,HAT(70,-60)+6,-60); group.add(fl);
      anim.flags.push({m:fl,ph:0.5});
    }

    // pohon besar tengah + patch warna samar anti-kaku
    BK.placeProp(holder,BK.Props.pine(2.4),-24,-8,0);
    [[40,30,0x86d68a,26],[-60,-10,0x6fae62,30],[20,80,0xdcc78f,24],[-20,-70,0xd8c48c,22]].forEach(([x,z,c,r])=>{
      const m=new THREE.Mesh(new THREE.CircleGeometry(r,24),
        new THREE.MeshBasicMaterial({map:softTex(),color:c,transparent:true,opacity:0.55,depthWrite:false}));
      m.rotation.x=-Math.PI/2; m.position.set(x,0.06,z); group.add(m);
    });
    // gunung jauh + 2 pulau kecil + camar
    [[420,180,90],[-400,260,110],[80,-460,100],[-350,-320,80]].forEach(([mx,mz,mh])=>{
      const m=new THREE.Mesh(new THREE.ConeGeometry(mh*0.9,mh,9), M(0x7a8aa0));
      m.position.set(mx,mh*0.28,mz); group.add(m);
    });
    [[350,190,22,1],[-330,250,16,2]].forEach(([ix,iz,ir,seed])=>{
      const isl=new THREE.Mesh(new THREE.CircleGeometry(ir,20), M(0xE8D8A0));
      isl.rotation.x=-Math.PI/2; isl.position.set(ix,-0.3,iz); group.add(isl);
      BK.placeProp({group,colliders:null},BK.Props.palm(1.2),ix,-0.3,iz,seed);
    });
    const gulls=[];
    for(let k=0;k<3;k++){
      const gm=new THREE.Mesh(new THREE.ConeGeometry(0.5,1.6,4),
        new THREE.MeshBasicMaterial({color:0xffffff}));
      gm.rotation.x=Math.PI/2; gm.scale.set(1.6,1,0.5); group.add(gm);
      gulls.push({m:gm,a:k*2.1,r:60+k*15,h:28+k*4,sp:0.25+k*0.05});
    }
    anim.gulls=gulls;

    // 3 portal warp ala CTR (pad melayang + berkas cahaya)
    const wins=BK.Save.totalWins();
    const defs=[
      {trackId:'pantai', name:'Pantai Bekicot', color:0x3fb6ff, ang:Math.PI/2, need:null},
      {trackId:'hutan', name:'Hutan Lendir', color:0x7CFC00, ang:Math.PI/2+Math.PI*2/3, need:{wins:1}},
      {trackId:'kawah', name:'Kawah Panas', color:0xff5a2a, ang:Math.PI/2+Math.PI*4/3, need:{wins:3,best:'pantai'}}
    ];
    const portals=[];
    defs.forEach(d=>{
      const x=Math.cos(d.ang)*70*HS, z=Math.sin(d.ang)*70*HS;
      // kunci progresif
      let locked=false, lockMsg='';
      if(d.need){
        if(wins<(d.need.wins||0)){ locked=true; lockMsg='Butuh '+d.need.wins+' trofi! 🏆 ('+wins+'/'+d.need.wins+')'; }
        else if(d.need.best&&!BK.Save.getBest(d.need.best)){ locked=true; lockMsg='Selesaikan Pantai Bekicot dulu! 🏁'; }
      }
      const ringC=locked?0x555555:d.color;
      const g=new THREE.Group();
      // pad warp tipis (bisa dilindas) + berkas + cincin hover
      const pad=new THREE.Mesh(new THREE.CylinderGeometry(4.2,4.2,0.18,24),
        new THREE.MeshLambertMaterial({color:0x2c3550}));
      pad.position.y=0.1; g.add(pad);
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(2.9,2.9,11,20,1,true),
        new THREE.MeshBasicMaterial({color:ringC,transparent:true,opacity:0.28,side:THREE.DoubleSide}));
      beam.position.y=6.2; g.add(beam);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(4.2,0.45,10,28),
        new THREE.MeshBasicMaterial({color:ringC}));
      ring.position.y=3.0; ring.rotation.x=Math.PI/2; g.add(ring);
      const halo=new THREE.Mesh(new THREE.TorusGeometry(6,0.28,8,36),
        new THREE.MeshBasicMaterial({color:ringC,transparent:true,opacity:0.7}));
      halo.position.y=0.12; halo.rotation.x=Math.PI/2; g.add(halo);
      // papan nama kecil di samping
      const post=new THREE.Mesh(new THREE.BoxGeometry(0.5,5,0.5), M(0x8a5a2a));
      post.position.set(5.5,2.5,0); g.add(post);
      const ban=new THREE.Mesh(new THREE.PlaneGeometry(7,1.75),
        new THREE.MeshBasicMaterial({map:bannerTexture(d.name,locked?'🔒 TERKUNCI':'BALAPAN','#16204a',locked?'#888888':'#ffd23f'),side:THREE.DoubleSide}));
      ban.position.set(5.5,5.6,0); ban.rotation.y=Math.PI/2; g.add(ban);
      if(locked){
        const lock=new THREE.Mesh(new THREE.PlaneGeometry(5,1.25),
          new THREE.MeshBasicMaterial({map:bannerTexture('🔒 TERKUNCI',lockMsg,'#333333','#ffffff'),side:THREE.DoubleSide}));
        lock.position.set(0,9.4,0); g.add(lock);
      }
      g.position.set(x,HAT(x,z),z);
      g.lookAt(0,2,0);
      group.add(g);
      portals.push({x,z,r:7,trackId:d.trackId,name:d.name,ring,disc:null,pad,beam,ph:Math.random()*6,locked,lockMsg});
    });
    // PINTU BOS di utara (Fase H2: balapan 1v1 Juara)
    const bossDoor={x:0,z:-104*HS};
    {
      const g=new THREE.Group();
      [-1,1].forEach(s=>{
        const pil=new THREE.Mesh(new THREE.BoxGeometry(2.2,13,2.2), M(0x3a3f4a));
        pil.position.set(s*4.5,6.5,0); g.add(pil);
      });
      const lin=new THREE.Mesh(new THREE.BoxGeometry(12,2,2.4), M(0x3a3f4a)); lin.position.y=13.5; g.add(lin);
      const seal=new THREE.Mesh(new THREE.TorusGeometry(1.6,0.5,10,22),
        new THREE.MeshBasicMaterial({color:0xffd23f}));
      seal.position.set(0,6.5,0.4); g.add(seal);
      const ban=new THREE.Mesh(new THREE.PlaneGeometry(8,2),
        new THREE.MeshBasicMaterial({map:bannerTexture('PINTU BOS','SEGERA DIBUKA 🔒','#4a1010','#ffd23f'),side:THREE.DoubleSide}));
      ban.position.set(0,11,0.6); g.add(ban);
      g.position.set(bossDoor.x,HAT(bossDoor.x,bossDoor.z),bossDoor.z);
      group.add(g);
    }

    // --- D1 dua NPC bekicot keliling ---
    const npcs=[];
    [
      {r:18,sp:4,ph:0,lines:['Portal biru itu Pantai! 🌊','Hutan butuh 1 trofi! 🏆','Kawah butuh 3 trofi! 🌋']},
      {r:60,sp:5,ph:2.4,lines:['Pintu bos di utara masih disegel! 🔒','Teluk selatan enak buat santai! 🏖️','Menang balapan dapat trofi! 🏆']}
    ].forEach(d=>{
      d.r*=HS;
      let mesh;
      if(BK.buildSnail&&BK.charById){ mesh=BK.buildSnail(BK.charById('turbo')); mesh.scale.setScalar(0.8); }
      else { mesh=new THREE.Group(); const b=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),M(0x7CFC00)); b.position.y=1; mesh.add(b); }
      group.add(mesh);
      npcs.push({mesh,a:d.ph,sp:d.sp,r:d.r,lines:d.lines,li:0,cd:0});
    });
    // --- D2 bekas toko: gubuk kosong tepi plaza ( Fase H4: jadi gubuk NPC) ---
    {
      const hut=new THREE.Group();
      const base=new THREE.Mesh(new THREE.BoxGeometry(6,3,4.5), M(0xc9a06a)); base.position.y=1.5; hut.add(base);
      const roof=new THREE.Mesh(new THREE.ConeGeometry(4.6,2.4,4), M(0x8a4a2a)); roof.position.y=4.2; roof.rotation.y=Math.PI/4; hut.add(roof);
      hut.position.set(20,HAT(20,6),6); hut.lookAt(0,0,0); group.add(hut);
    }

    const hub={
      def:{id:'hub',name:'Pulau Bekicot',dust:0xE6D199}, isHub:true, boundR:143,
      group, boxes:[], pads:[], portals, coins:[], letters:[],
      npcs, shop:null, drift:null, coast, bossDoor, colliders, hubR:HUB_R,
      heightAt:(x,z)=>HAT(x,z),
      shallows:[{x:-60*HS,z:45*HS,r:11}],
      startPos:new THREE.Vector3(0,HAT(0,34*HS),34*HS), startHeading:Math.PI,
      update(dt,time){
        anim.clouds.forEach(c=>{ c.g.position.x+=c.v*dt; if(c.g.position.x>320)c.g.position.x=-320; });
        (anim.gulls||[]).forEach(g=>{
          g.a+=g.sp*dt;
          g.m.position.set(Math.cos(g.a)*g.r, g.h+Math.sin(time*2+g.a)*1.5, Math.sin(g.a)*g.r);
          g.m.rotation.z=g.a;
        });
        if(anim.sea) anim.sea.offset.x+=dt*0.015; // kilau ombak
        if(anim.foamEdge) anim.foamEdge.opacity=0.4+Math.abs(Math.sin(time*1.6))*0.25;
        if(anim.ember) anim.ember.opacity=0.5+Math.abs(Math.sin(time*3))*0.4;
        anim.flags.forEach(f=>{ f.m.rotation.y=Math.sin(time*4+f.ph)*0.45; });
        portals.forEach(p=>{
          p.ring.rotation.y+=dt*1.5;
          p.ring.position.y=3.0+Math.sin(time*2+p.ph)*0.4;
          p.beam.material.opacity=0.2+Math.abs(Math.sin(time*2+p.ph))*0.18;
        });
        // NPC keliling
        npcs.forEach(n=>{
          n.cd=Math.max(0,n.cd-dt);
          n.a+=n.sp*dt/n.r;
          const px=Math.cos(n.a)*n.r, pz=Math.sin(n.a)*n.r;
          n.mesh.position.x=px; n.mesh.position.z=pz;
          n.mesh.position.y=HAT(px,pz);
          n.mesh.rotation.y=Math.atan2(-Math.sin(n.a),Math.cos(n.a));
        });
      }
    };
    return hub;
  };
})();
