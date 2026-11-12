/* BK.Props: komponen reusable (palem/pinus/gubuk/batu).
   Geometri & material di-cache bersama. Tiap komponen bawa radius
   collider; BK.placeProp otomatis mendaftarkan ke holder.colliders. */
(function(){
  const geos={}, mats={};
  function G(k,make){ if(!geos[k])geos[k]=make(); return geos[k]; }
  function Mt(color){ if(!mats[color])mats[color]=new THREE.MeshLambertMaterial({color}); return mats[color]; }
  function Mb(color){ const k='b'+color; if(!mats[k])mats[k]=new THREE.MeshBasicMaterial({color}); return mats[k]; }
  BK.Props={
    // ↓ desain-desain ini DIDEFINISIKAN SEKALI di BK.Comp (bawah). Wrapper ini = objek tunggal ber-collider.
    palm(s, lean){ return BK.Comp.make('palm', s, BK.Comp.palmLean(lean)); },
    pine(s){ return BK.Comp.make('pine', s, 'plain'); },
    hut(s){
      s=s||1;
      const g=new THREE.Group();
      shade(g,3.6);
      const base=new THREE.Mesh(G('hbase',()=>new THREE.BoxGeometry(5,2.6,4)),Mt(0xc9a06a));
      base.position.y=1.3; g.add(base);
      const roof=new THREE.Mesh(G('hroof',()=>new THREE.ConeGeometry(4,2.2,4)),Mt(0x8a4a2a));
      roof.position.y=3.7; roof.rotation.y=Math.PI/4; g.add(roof);
      const door=new THREE.Mesh(G('hdoor',()=>new THREE.PlaneGeometry(1.2,2)),
        new THREE.MeshBasicMaterial({color:0x4a2e12}));
      door.position.set(0,1,2.02); g.add(door);
      g.scale.setScalar(s);
      return {group:g, r:3.2*s};
    },
    rock(s){ const it=BK.Comp.make('rock', s, 'plain', 0x9a9a9a); it.group.children.forEach(m=>{ m.position.y=0.7; m.rotation.set(0.4,0.7,0.2); }); shade(it.group,1.8); return it; },
    mushroom(s, col){ return BK.Comp.make('mushroom', s, 0, col||0xd93829); },
    ancientTree(s){ return BK.Comp.make('forestTree', (s||1)*1.6, 0, 0xffffff, 1.9*(s||1)); },
    ruinPillar(s){
      s=s||1;
      const g=new THREE.Group();
      shade(g,2.2);
      const base=new THREE.Mesh(G('rpbase',()=>new THREE.BoxGeometry(2.4,0.8,2.4)),Mt(0x6e685c));
      base.position.y=0.4; g.add(base);
      const col=new THREE.Mesh(G('rpcol',()=>new THREE.CylinderGeometry(0.85,0.95,5.2,8)),Mt(0x827c6e));
      col.position.y=3.0; g.add(col);
      const moss=new THREE.Mesh(G('rpmoss',()=>new THREE.BoxGeometry(2.1,0.7,2.1)),Mt(0x3f7833));
      moss.position.y=5.7; g.add(moss);
      const rune=new THREE.Mesh(G('rprune',()=>new THREE.OctahedronGeometry(0.55,0)),
        new THREE.MeshBasicMaterial({color:0xffa62b}));
      rune.position.y=6.6; g.add(rune);
      g.scale.setScalar(s);
      return {group:g, r:1.4*s};
    },
    tikiTorch(s){
      s=s||1;
      const g=new THREE.Group();
      shade(g,1.1);
      const pole=new THREE.Mesh(G('tkpole',()=>new THREE.CylinderGeometry(0.18,0.24,3.8,6)),Mt(0x7a4e24));
      pole.position.y=1.9; g.add(pole);
      const head=new THREE.Mesh(G('tkhead',()=>new THREE.CylinderGeometry(0.45,0.32,0.9,7)),Mt(0x4a2c12));
      head.position.y=3.9; g.add(head);
      const flame=new THREE.Mesh(G('tkflame',()=>new THREE.ConeGeometry(0.38,0.95,6)),
        new THREE.MeshBasicMaterial({color:0xff9f1c}));
      flame.position.y=4.65; g.add(flame);
      g.scale.setScalar(s);
      return {group:g, r:0.6*s};
    },
    coralCluster(s, col){
      s=s||1; col=col||0xff6b8b;
      const g=new THREE.Group();
      shade(g,1.8);
      const base=new THREE.Mesh(G('crbase',()=>new THREE.DodecahedronGeometry(1.3,0)),Mt(0xc8b89a));
      base.position.y=0.6; base.scale.y=0.65; g.add(base);
      [-0.55,0,0.6].forEach((ox,i)=>{
        const br=new THREE.Mesh(G('crbr',()=>new THREE.CylinderGeometry(0.24,0.36,2.1,6)),Mt(col));
        br.position.set(ox,1.3+(i%2)*0.3,(i-1)*0.3);
        br.rotation.z=(i-1)*0.32; g.add(br);
      });
      g.scale.setScalar(s);
      return {group:g, r:1.3*s};
    },
    // perahu kayu: lambung papan melengkung (penampang U meruncing ke haluan) + bangku + dayung
    woodenBoat(s){
      s=s||1;
      const g=new THREE.Group();
      shade(g,2.8);
      const hull=new THREE.Mesh(BK.Props.hullGeo(4.8,1.15,0.95),BK.Props.plankMat(0x9a6434)); g.add(hull);
      const seat=new THREE.Mesh(G('btseat',()=>new THREE.BoxGeometry(1.9,0.12,0.5)),Mt(0xc49a62));
      seat.position.set(0,0.72,-0.3); g.add(seat);
      const oar=new THREE.Mesh(G('btoar',()=>new THREE.CylinderGeometry(0.05,0.05,3.2,5)),Mt(0xb88b58));
      oar.rotation.set(0.15,0,1.25); oar.position.set(0.5,0.95,0.6); g.add(oar);
      g.scale.setScalar(s);
      return {group:g, r:2.0*s};
    },
    snowPineProp(s){ return BK.Comp.make('pine', s, 'snow'); },
    lavaCrystal(s, col){
      s=s||1; col=col||0xff6a00;
      const g=new THREE.Group();
      shade(g,2.5);
      const rock=new THREE.Mesh(G('lcbase',()=>new THREE.DodecahedronGeometry(2.0,0)),Mt(0x3a2430));
      rock.position.y=1.4; rock.rotation.set(0.3,0.6,0.2); g.add(rock);
      [[-0.9,1.9,0.5,-0.35],[0.85,2.2,-0.4,0.32],[0.1,3.1,0.2,0.08]].forEach(([cx,cy,cz,rz])=>{
        const shard=new THREE.Mesh(G('lcshard',()=>new THREE.OctahedronGeometry(0.78,0)),Mb(col));
        shard.position.set(cx,cy,cz); shard.scale.set(0.75,1.65,0.75); shard.rotation.z=rz;
        g.add(shard);
      });
      g.scale.setScalar(s);
      return {group:g, r:1.8*s};
    },
    fireBrazier(s){
      s=s||1;
      const g=new THREE.Group();
      shade(g,2.0);
      const ped=new THREE.Mesh(G('fbped',()=>new THREE.CylinderGeometry(0.7,1.05,2.2,8)),Mt(0x2e222a));
      ped.position.y=1.1; g.add(ped);
      const bowl=new THREE.Mesh(G('fbbowl',()=>new THREE.CylinderGeometry(1.35,0.75,1.0,8)),Mt(0x47313b));
      bowl.position.y=2.5; g.add(bowl);
      const coal=new THREE.Mesh(G('fbcoal',()=>new THREE.CylinderGeometry(1.15,1.15,0.25,8)),Mb(0xff4500));
      coal.position.y=2.95; g.add(coal);
      const flame=new THREE.Mesh(G('fbflame',()=>new THREE.ConeGeometry(0.85,1.9,7)),Mb(0xff9f1c));
      flame.position.y=3.85; g.add(flame);
      g.scale.setScalar(s);
      return {group:g, r:1.3*s};
    },
    iceCrystal(s, col){
      s=s||1; col=col||0x7ce8ff;
      const g=new THREE.Group();
      shade(g,2.4);
      const base=new THREE.Mesh(G('icbase',()=>new THREE.DodecahedronGeometry(1.9,0)),Mt(0xcce4f7));
      base.position.y=1.1; base.scale.y=0.75; g.add(base);
      [[-0.85,2.0,0.4,-0.32],[0.8,2.2,-0.35,0.28],[0.05,3.2,0.1,0.06]].forEach(([cx,cy,cz,rz])=>{
        const spire=new THREE.Mesh(G('icspire',()=>new THREE.ConeGeometry(0.65,2.8,6)),Mb(col));
        spire.position.set(cx,cy,cz); spire.rotation.z=rz;
        g.add(spire);
      });
      g.scale.setScalar(s);
      return {group:g, r:1.75*s};
    },
    igloo(s){
      s=s||1;
      const g=new THREE.Group();
      shade(g,3.6);
      const dome=new THREE.Mesh(G('igdome',()=>new THREE.SphereGeometry(2.7,12,8,0,Math.PI*2,0,Math.PI*0.55)),Mt(0xf2f7ff));
      dome.position.y=0.1; g.add(dome);
      const band=new THREE.Mesh(G('igband',()=>new THREE.CylinderGeometry(2.72,2.78,0.5,12)),Mt(0xd4e7f7));
      band.position.y=0.25; g.add(band);
      const tunnel=new THREE.Mesh(G('igtun',()=>new THREE.BoxGeometry(1.7,1.55,1.8)),Mt(0xe4effc));
      tunnel.position.set(0,0.75,2.45); g.add(tunnel);
      const door=new THREE.Mesh(G('igdoor',()=>new THREE.PlaneGeometry(1.05,1.1)),Mb(0xffd97a));
      door.position.set(0,0.68,3.38); g.add(door);
      const chim=new THREE.Mesh(G('igchim',()=>new THREE.CylinderGeometry(0.36,0.42,1.1,7)),Mt(0xc4ddf2));
      chim.position.set(-0.9,2.5,-0.5); g.add(chim);
      g.scale.setScalar(s);
      return {group:g, r:2.8*s};
    }
  };
  /* ---- geometri gabungan & tekstur pantai (palem HD, rumput pantai) ---- */
  function canvasT(w,h,draw){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
    const t=new THREE.CanvasTexture(c); return t; }
  // gabung beberapa geometri (opsional matriks) jadi satu BufferGeometry non-indexed: pos/normal/uv
  function mergeGeos(list){ // item: {geo, mtx?, color?} — color (hex) → atribut warna vertex
    const pos=[],nor=[],uv=[],col=[]; const useCol=list.some(it=>it.color!=null); const c=new THREE.Color();
    list.forEach(({geo,mtx,color})=>{
      const g=geo.index?geo.toNonIndexed():geo.clone(); if(mtx) g.applyMatrix4(mtx);
      const P=g.attributes.position, Nn=g.attributes.normal, U=g.attributes.uv; c.set(color==null?0xffffff:color);
      for(let i=0;i<P.count;i++){ pos.push(P.getX(i),P.getY(i),P.getZ(i)); nor.push(Nn.getX(i),Nn.getY(i),Nn.getZ(i)); uv.push(U?U.getX(i):0,U?U.getY(i):0); if(useCol) col.push(c.r,c.g,c.b); }
    });
    const m=new THREE.BufferGeometry();
    m.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    m.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
    m.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    if(useCol) m.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    return m;
  }
  const _m4=new THREE.Matrix4(), _q=new THREE.Quaternion(), _e=new THREE.Euler(), _v=new THREE.Vector3(), _sv=new THREE.Vector3();
  function TRS(x,y,z, rx,ry,rz, sx,sy,sz){ // matriks bantu untuk menyusun bagian komponen
    _e.set(rx||0,ry||0,rz||0); _q.setFromEuler(_e);
    return new THREE.Matrix4().compose(_v.set(x||0,y||0,z||0).clone(),_q.clone(),_sv.set(sx==null?1:sx,sy==null?(sx==null?1:sx):sy,sz==null?(sx==null?1:sx):sz).clone());
  }
  function palmTrunkGeo(lean){
    const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,0,0),new THREE.Vector3(lean*0.05,3.8,0),new THREE.Vector3(lean,7,0));
    const R=12, S=8, v=[], uv=[], id=[];
    for(let i=0;i<=R;i++){
      const t=i/R, c=curve.getPoint(t), r=0.46*(1-t)+0.27*t+(i===0?0.08:0);
      for(let k=0;k<=S;k++){ const a=k/S*Math.PI*2; v.push(c.x+Math.cos(a)*r,c.y,c.z+Math.sin(a)*r); uv.push(k/S,t*9); }
    }
    for(let i=0;i<R;i++)for(let k=0;k<S;k++){ const a=i*(S+1)+k, b=a+S+1; id.push(a,b,a+1, a+1,b,b+1); }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(v,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(id); g.computeVertexNormals(); return g;
  }
  // satu pelepah: pita melengkung naik lalu menjuntai, lipatan-V di tulang daun; lebar anak-daun dari tekstur alpha
  function palmFrondGeo(){
    const S=10, L=4.4, W=0.95, v=[], uv=[], id=[];
    for(let i=0;i<=S;i++){
      const u=i/S, x=L*u, y=2.2*u*(1-u)-1.7*u*u;
      v.push(x,y-0.14,-W, x,y+0.10,0, x,y-0.14,W); uv.push(u,0, u,0.5, u,1);
    }
    for(let i=0;i<S;i++){ const a=i*3; id.push(a,a+3,a+1, a+1,a+3,a+4, a+1,a+4,a+2, a+2,a+4,a+5); }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(v,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(id); g.computeVertexNormals(); return g;
  }
  function palmFrondsGeo(){
    const f=palmFrondGeo(), list=[], m=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler();
    for(let k=0;k<9;k++){
      e.set(0,k/9*Math.PI*2+(k%2)*0.25,((k*37)%7-3)*0.07,'YXZ'); q.setFromEuler(e);
      m.compose(new THREE.Vector3(0,0.05,0),q,new THREE.Vector3(1,1,1)); list.push({geo:f,mtx:m.clone()});
    }
    return mergeGeos(list);
  }
  function palmNutsGeo(){
    const sp=new THREE.SphereGeometry(0.24,8,6), list=[], m=new THREE.Matrix4();
    [[0.25,-0.3,0.1],[-0.18,-0.32,0.2],[0.02,-0.3,-0.26]].forEach(p=>{ m.makeTranslation(p[0],p[1],p[2]); list.push({geo:sp,mtx:m.clone()}); });
    return mergeGeos(list);
  }
  let _ptm=null,_plm=null,_tuftM=null;
  function palmTrunkMat(){
    if(_ptm) return _ptm;
    const t=canvasT(64,64,(g,w,h)=>{
      g.fillStyle='#9a6a3a'; g.fillRect(0,0,w,h);
      for(let i=0;i<70;i++){ g.fillStyle=Math.random()<0.5?'#8a5c30':'#a97a48'; g.fillRect(Math.random()*w,Math.random()*h,2+Math.random()*6,1); }
      const grd=g.createLinearGradient(0,0,0,h); // cincin batang: pita gelap tiap ubin
      grd.addColorStop(0,'rgba(60,36,16,.85)'); grd.addColorStop(0.22,'rgba(60,36,16,0)'); grd.addColorStop(0.8,'rgba(255,230,190,0)'); grd.addColorStop(1,'rgba(255,230,190,.25)');
      g.fillStyle=grd; g.fillRect(0,0,w,h);
    });
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    _ptm=new THREE.MeshLambertMaterial({map:t});
    return _ptm;
  }
  function palmLeafMat(){
    if(_plm) return _plm;
    const t=canvasT(256,64,(g,w,h)=>{
      g.clearRect(0,0,w,h); g.lineCap='round';
      for(let x=6;x<w-4;x+=5){ // anak daun menyirip kiri-kanan, panjang mengikuti profil pelepah
        const u=x/w, len=(h*0.47)*Math.pow(Math.sin(Math.PI*Math.min(1,u*1.08)),0.7);
        const shade=['#2f8a3c','#3da049','#2a7a35','#47ad52'][(x/5|0)%4];
        g.strokeStyle=shade; g.lineWidth=3.2;
        [-1,1].forEach(sd=>{ g.beginPath(); g.moveTo(x,h/2); g.lineTo(x+len*0.55,h/2+sd*len); g.stroke(); });
      }
      g.strokeStyle='#cdbf6a'; g.lineWidth=2.4; g.beginPath(); g.moveTo(0,h/2); g.lineTo(w,h/2); g.stroke(); // tulang daun
    });
    _plm=new THREE.MeshLambertMaterial({map:t,alphaTest:0.45,side:THREE.DoubleSide});
    return _plm;
  }
  // rumput pantai: 3 bidang silang bertekstur bilah (alpha) — untuk InstancedMesh (warna per-instance mengalikan)
  BK.Props.tuftGeo=function(){
    return G('tuft',()=>{
      const p=new THREE.PlaneGeometry(1.5,1.1); p.translate(0,0.55,0);
      const list=[], m=new THREE.Matrix4();
      [0,Math.PI/3,Math.PI*2/3].forEach(a=>{ [0,Math.PI].forEach(b=>{ m.makeRotationY(a+b); list.push({geo:p,mtx:m.clone()}); }); }); // 2 muka (FrontSide) agar sisi belakang tak gelap
      const g=mergeGeos(list); g.computeVertexNormals();
      const n=g.attributes.normal; for(let i=0;i<n.count;i++) n.setXYZ(i,0,1,0); // normal ke atas: bercahaya rata spt rumput
      return g;
    });
  };
  BK.Props.tuftMat=function(){
    if(_tuftM) return _tuftM;
    const t=canvasT(128,128,(g,w,h)=>{
      g.clearRect(0,0,w,h); g.lineCap='round';
      for(let i=0;i<34;i++){
        const x0=12+Math.random()*(w-24), lean=(Math.random()-0.5)*44, hgt=h*(0.45+Math.random()*0.5);
        g.strokeStyle=['#a7b257','#c9c27a','#8f9e45','#d8cf8e'][i%4]; g.lineWidth=2.5+Math.random()*2;
        g.beginPath(); g.moveTo(x0,h); g.quadraticCurveTo(x0+lean*0.3,h-hgt*0.6,x0+lean,h-hgt); g.stroke();
      }
    });
    _tuftM=new THREE.MeshLambertMaterial({map:t,alphaTest:0.5});
    return _tuftM;
  };
  // lambung kapal: penampang U (θ 0..π) disapu sepanjang z; haluan (+z) runcing, buritan (−z) tumpul. Terbuka di atas.
  BK.Props.hullGeo=function(L,W,H){
    return G('hull'+L+'|'+W+'|'+H,()=>{
      const S=14, A=10, v=[], uv=[], id=[];
      for(let i=0;i<=S;i++){
        const zn=i/S*2-1, z=zn*L/2;
        const w=W*(zn>0?1-Math.pow(zn,2.2):1-0.35*Math.pow(-zn,3)), dep=H*(zn>0?1-0.25*zn*zn:1);
        for(let k=0;k<=A;k++){ const th=k/A*Math.PI;
          v.push(Math.cos(th)*w, H-Math.sin(th)*dep+(zn>0?zn*zn*0.35:0), z); uv.push(i/S*3, k/A*5); }
      }
      for(let i=0;i<S;i++)for(let k=0;k<A;k++){ const a=i*(A+1)+k, b=a+A+1; id.push(a,a+1,b, a+1,b+1,b); }
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(v,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      g.setIndex(id); g.computeVertexNormals(); return g;
    });
  };
  const _plank={};
  BK.Props.plankMat=function(color){
    if(_plank[color]) return _plank[color];
    const t=canvasT(64,64,(g,w,h)=>{
      g.fillStyle='#ffffff'; g.fillRect(0,0,w,h);
      for(let y=0;y<h;y+=13){ g.fillStyle='rgba(60,35,15,.55)'; g.fillRect(0,y,w,2); } // sambungan papan
      for(let i=0;i<60;i++){ g.fillStyle=Math.random()<0.5?'rgba(90,55,25,.18)':'rgba(255,240,210,.2)'; g.fillRect(Math.random()*w,Math.random()*h,6+Math.random()*14,1); }
    });
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    return (_plank[color]=new THREE.MeshLambertMaterial({map:t,color,side:THREE.DoubleSide}));
  };

  /* =====================================================================
     BK.Comp — KOMPONEN TERPADU. Satu definisi desain dipakai di SEMUA tempat:
       • BK.Comp.make(nama, s, varian, tint)        → {group, r}  (objek tunggal, lewat BK.placeProp)
       • BK.Comp.scatter(parent, nama, daftar)      → InstancedMesh per bagian (ribuan objek, sedikit draw call)
     Dipakai trek (world.js: landmark & sebaran) DAN hub pulau (hub.js).
     Ubah desain di sini → berubah di semua trek & hub.
     Bagian (part): {geo, mat, base?, tint?}. mat berwarna putih bila base diisi (warna = base / tint item).
     ===================================================================== */
  const COMPS={};
  const _tintMats={};
  function matFor(mat,color){ // material dgn warna tertentu (dibagi bersama; untuk objek tunggal)
    if(color==null) return mat;
    const k=mat.uuid+'|'+color; if(!_tintMats[k]){ const m=mat.clone(); m.color=new THREE.Color(color); _tintMats[k]=m; } return _tintMats[k];
  }
  function Mw(key,opts){ const k='w'+key; if(!mats[k]) mats[k]=new THREE.MeshLambertMaterial(Object.assign({color:0xffffff},opts||{})); return mats[k]; }
  BK.Comp={
    define(name,spec){ COMPS[name]=spec; },
    parts(name,v){ const c=COMPS[name]; if(v==null) v=c.dv; return G('comp|'+name+'|'+v,()=>c.parts(v)); },
    radius(name,s){ return COMPS[name].r*(s||1); },
    make(name,s,v,tint,r){
      s=s||1; const c=COMPS[name]; const g=new THREE.Group();
      if(c.shadow) shade(g,c.shadow);
      BK.Comp.parts(name,v).forEach(p=>{
        const col=(p.tint&&tint!=null)?tint:p.base;
        g.add(new THREE.Mesh(p.geo, col!=null?matFor(p.mat,col):p.mat));
      });
      g.scale.setScalar(s);
      return {group:g, r:r!=null?r:c.r*s};
    },
    // daftar item: {x,y,z, s, sy?, sz?, rx?, ry?, rz?, v?, tint?} — y = pangkal (komponen ber-origin di tanah)
    scatter(parent,name,list){
      const c=COMPS[name], byV={}, out=[];
      list.forEach(it=>{ const v=it.v==null?c.dv:it.v; (byV[v]=byV[v]||[]).push(it); });
      const mtx=new THREE.Matrix4(), col=new THREE.Color();
      Object.keys(byV).forEach(v=>{
        const items=byV[v];
        BK.Comp.parts(name,v).forEach(p=>{
          const inst=new THREE.InstancedMesh(p.geo,p.mat,items.length);
          const colored=p.base!=null||(p.tint&&items.some(it=>it.tint!=null));
          items.forEach((it,k)=>{
            mtx.copy(TRS(it.x,it.y,it.z,it.rx,it.ry,it.rz,it.s,it.sy==null?it.s:it.sy,it.sz==null?it.s:it.sz));
            inst.setMatrixAt(k,mtx);
            if(colored&&inst.setColorAt){ col.set((p.tint&&it.tint!=null)?it.tint:(p.base!=null?p.base:0xffffff)); inst.setColorAt(k,col); }
          });
          inst.instanceMatrix.needsUpdate=true; if(inst.instanceColor) inst.instanceColor.needsUpdate=true;
          inst.frustumCulled=false; inst.name='comp:'+name; parent.add(inst); out.push(inst);
        });
      });
      if(c.shadow&&c.scatterShadow!==false&&list.length){ // bayangan cakram lembut, 1 draw call
        const sd=new THREE.InstancedMesh(G('compshadow',()=>new THREE.CircleGeometry(1,16).rotateX(-Math.PI/2)),
          G('m:compshadow',()=>new THREE.MeshBasicMaterial({map:softDTex(),color:0x000000,transparent:true,opacity:0.28,depthWrite:false})),list.length);
        list.forEach((it,k)=>{ const r=c.shadow*it.s; mtx.copy(TRS(it.x,it.y+0.04,it.z,0,0,0,r,1,r)); sd.setMatrixAt(k,mtx); });
        sd.instanceMatrix.needsUpdate=true; sd.frustumCulled=false; parent.add(sd); out.push(sd);
      }
      return out;
    },
    palmLean(lean){ const L=[0.4,0.9,1.4,1.9]; lean=lean==null?1.1:lean; let b=0; L.forEach((x,i)=>{ if(Math.abs(x-lean)<Math.abs(L[b]-lean)) b=i; }); return b; }
  };

  // --- PALEM (varian 0..3 = condong 0.4/0.9/1.4/1.9 m) ---
  BK.Comp.define('palm',{ r:0.9, shadow:1.6, dv:1, parts(v){
    const lean=[0.4,0.9,1.4,1.9][v]||0.9, T=TRS(lean,7,0);
    return [ {geo:palmTrunkGeo(lean), mat:palmTrunkMat()},
             {geo:G('pfronds',palmFrondsGeo).clone().applyMatrix4(T), mat:palmLeafMat(), tint:true},
             {geo:G('pnuts',palmNutsGeo).clone().applyMatrix4(T), mat:Mw('plain'), base:0x5a3a1c} ];
  }});
  // --- PINUS (varian 'snow' bertudung salju | 'plain') ---
  BK.Comp.define('pine',{ r:1.3, shadow:2.2, dv:'plain', parts(v){
    const tiers=[], caps=[], cone=new THREE.ConeGeometry(2.5,2.7,8), cap=new THREE.ConeGeometry(1.9,1.15,8);
    for(let k=0;k<3;k++){ const sc=1-k*0.22;
      tiers.push({geo:cone,mtx:TRS(0,2.3+k*1.75,0,0,k*0.5,0,sc,1,sc)});
      caps.push({geo:cap,mtx:TRS(0,3.15+k*1.75,0,0,k*0.5,0,sc,1,sc)}); }
    const out=[ {geo:new THREE.CylinderGeometry(0.35,0.45,1.6,7).translate(0,0.8,0), mat:Mw('plain'), base:0x5a4028},
                {geo:mergeGeos(tiers), mat:Mw('plain'), base:0x2e6b4a, tint:true} ];
    if(v==='snow') out.push({geo:mergeGeos(caps), mat:Mw('plain'), base:0xf2f6fc});
    return out;
  }});
  // --- POHON HUTAN: batang + dahan + mahkota 5 gumpal (warna gumpal berbeda via warna vertex) ---
  BK.Comp.define('forestTree',{ r:0.8, shadow:2.6, dv:0, parts(){
    const blobs=[], d=new THREE.DodecahedronGeometry(1,1), cols=[0x2e7034,0x3d8b3e,0x245f30,0x55a147,0x3a8a3c];
    for(let k=0;k<5;k++){ const a=k/5*Math.PI*2, r=k===4?0.2:1.8;
      blobs.push({geo:d, color:cols[k], mtx:TRS(Math.cos(a)*r,k===4?6.6:5.4,Math.sin(a)*r,0.2,a,0.1,k===4?2.2:2.6,k===4?2.6:1.9,k===4?2.2:2.6)}); }
    const bark=new THREE.CylinderGeometry(1,1,1,7);
    const wood=[{geo:new THREE.CylinderGeometry(0.26,0.42,5.4,7), mtx:TRS(0,2.5,0)},
                {geo:bark, mtx:TRS(0.9,3.65,0.35,0,0,-0.95,0.13,2.7,0.13)}];
    return [ {geo:mergeGeos(wood), mat:Mw('plain'), base:0x5c4328},
             {geo:mergeGeos(blobs), mat:Mw('vc',{vertexColors:true}), tint:true} ];
  }});
  // --- POHON MATI (abu vulkanik) ---
  BK.Comp.define('deadTree',{ r:0.58, shadow:1.6, dv:0, parts(){
    const cyl=new THREE.CylinderGeometry(1,1,1,7), beams=[];
    const beam=(x1,y1,z1,x2,y2,z2,r)=>{ const A=new THREE.Vector3(x1,y1,z1), B=new THREE.Vector3(x2,y2,z2), d=B.clone().sub(A), L=d.length();
      const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
      beams.push({geo:cyl, mtx:new THREE.Matrix4().compose(A.add(B).multiplyScalar(0.5),q,new THREE.Vector3(r,L,r))}); };
    beam(0,-0.15,0, 0,5.4,0.8, 0.26);
    for(let k=0;k<4;k++){ const a=k/4*Math.PI*2+0.3, y=2.0+k*0.8; beam(0,y,0.3, Math.sin(a)*2.2,y+1.4,0.3+Math.cos(a)*2.2, 0.10); }
    return [ {geo:mergeGeos(beams), mat:Mw('plain'), base:0x4b3f3d, tint:true} ];
  }});
  // --- BATU (origin di pusat batu; varian 'plain' diwarnai tint | 'coast' bertekstur karang pantai) ---
  BK.Comp.define('rock',{ r:1.3, shadow:0, dv:'plain', parts(v){
    const geo=G('rockgeo',()=>new THREE.DodecahedronGeometry(1.2,0));
    if(v==='coast') return [{geo, mat:G('m:coastrock',()=>new THREE.MeshLambertMaterial({map:BK.Props.coastRockTex()})), base:0xffffff, tint:true}];
    return [{geo, mat:Mw('plain'), base:0x9a9a9a, tint:true}];
  }});
  // --- JAMUR (tangkai + topi setengah bola + cincin) ---
  BK.Comp.define('mushroom',{ r:1.2, shadow:2.2, dv:0, parts(){
    return [ {geo:new THREE.CylinderGeometry(0.45,0.65,3.2,8).translate(0,1.6,0), mat:Mw('plain'), base:0xede0cc},
             {geo:new THREE.SphereGeometry(2.3,12,8,0,Math.PI*2,0,Math.PI*0.58).translate(0,2.8,0), mat:Mw('plain'), base:0xd93829, tint:true},
             {geo:new THREE.TorusGeometry(1.4,0.22,6,14).rotateX(Math.PI/2).translate(0,3.8,0), mat:Mw('plain'), base:0xf7efe2} ];
  }});

  // batu karang pantai: abu-cokelat lapuk, berpori, rembesan pasir (dipakai batu pantai, pembatas jalan, gapura)
  let _coastRock=null;
  BK.Props.coastRockTex=function(){
    if(_coastRock) return _coastRock;
    _coastRock=canvasT(256,256,(g,w,h)=>{
      g.fillStyle='#8c8274'; g.fillRect(0,0,w,h);
      for(let i=0;i<900;i++){ const v=90+Math.random()*80; g.globalAlpha=0.12+Math.random()*0.18;
        g.fillStyle=`rgb(${v|0},${(v*0.94)|0},${(v*0.84)|0})`; const sz=2+Math.random()*8; g.fillRect(Math.random()*w,Math.random()*h,sz,sz*0.7); }
      g.globalAlpha=1;
      for(let i=0;i<260;i++){ g.fillStyle='rgba(45,40,35,.45)'; g.beginPath(); g.arc(Math.random()*w,Math.random()*h,0.8+Math.random()*1.8,0,7); g.fill(); }
      for(let i=0;i<40;i++){ g.fillStyle='rgba(230,210,160,'+(0.15+Math.random()*0.25)+')'; g.beginPath(); g.arc(Math.random()*w,Math.random()*h,3+Math.random()*10,0,7); g.fill(); }
    });
    _coastRock.wrapS=_coastRock.wrapT=THREE.RepeatWrapping; _coastRock.anisotropy=4;
    return _coastRock;
  };

  /* ---- KOMPONEN JALUR: boost pad & kerb (mengikuti lengkung jalan; dipakai trek & hub) ---- */
  // sampler jalur: points [{x,z,y?}], i0 = indeks pusat; at(s) = titik s meter maju dari pusat (arah urutan titik)
  BK.Props.pathSampler=function(points,i0,closed,getY){
    const n=points.length, P=k=>points[closed?((k%n)+n)%n:Math.max(0,Math.min(n-1,k))];
    const seg=Math.max(0.3,Math.hypot(P(i0+1).x-P(i0).x,P(i0+1).z-P(i0).z));
    return s=>{ const f=i0+s/seg, fi=Math.floor(f), u=f-fi, A=P(fi), B=P(fi+1);
      const x=A.x+(B.x-A.x)*u, z=A.z+(B.z-A.z)*u, L=Math.hypot(B.x-A.x,B.z-A.z)||1;
      return {x,z, y:getY?getY(x,z):(A.y||0)+((B.y||0)-(A.y||0))*u, tx:(B.x-A.x)/L, tz:(B.z-A.z)/L}; };
  };
  // pita datar sepanjang jalur: uv u = melintang 0..1, v = 0 (belakang) → vRep (depan). Winding dijamin menghadap atas.
  function pathStrip(at,len,wid,yOff,vRep,S){
    S=S||8; const v=[], uv=[], id=[];
    for(let k=0;k<=S;k++){ const p=at((k/S-0.5)*len), nx=p.tz, nz=-p.tx;
      v.push(p.x-nx*wid/2,p.y+yOff,p.z-nz*wid/2, p.x+nx*wid/2,p.y+yOff,p.z+nz*wid/2); uv.push(0,k/S*vRep, 1,k/S*vRep);
      if(k<S){ const q=k*2; id.push(q,q+1,q+2, q+1,q+3,q+2); } }
    // cek arah normal segitiga pertama; balik bila menghadap bawah
    const ax=v[3]-v[0], az=v[5]-v[2], bx=v[6]-v[0], bz=v[8]-v[2];
    if(az*bx-ax*bz<0) for(let i=0;i<id.length;i+=3){ const t=id[i+1]; id[i+1]=id[i+2]; id[i+2]=t; }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(v,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(id); g.computeVertexNormals(); return g;
  }
  BK.Props.pathStrip=pathStrip;
  let _padFrame=null;
  function padFrameTex(){ // panel biru tua transparan, tepi neon cyan, lampu samping
    if(_padFrame) return _padFrame;
    _padFrame=canvasT(128,256,(g,w,h)=>{
      g.clearRect(0,0,w,h);
      const r=18; g.beginPath(); g.moveTo(r,2); g.lineTo(w-r,2); g.quadraticCurveTo(w-2,2,w-2,r); g.lineTo(w-2,h-r); g.quadraticCurveTo(w-2,h-2,w-r,h-2);
      g.lineTo(r,h-2); g.quadraticCurveTo(2,h-2,2,h-r); g.lineTo(2,r); g.quadraticCurveTo(2,2,r,2); g.closePath();
      const gr=g.createLinearGradient(0,0,w,0); gr.addColorStop(0,'rgba(10,60,120,.80)'); gr.addColorStop(0.5,'rgba(8,30,70,.72)'); gr.addColorStop(1,'rgba(10,60,120,.80)');
      g.fillStyle=gr; g.fill();
      g.shadowColor='#4fe3ff'; g.shadowBlur=10; g.strokeStyle='#5ee8ff'; g.lineWidth=7; g.stroke();
      g.shadowBlur=0; g.strokeStyle='rgba(255,255,255,.85)'; g.lineWidth=2; g.stroke();
      g.fillStyle='rgba(94,232,255,.35)'; for(let y=20;y<h-20;y+=22){ g.fillRect(10,y,6,10); g.fillRect(w-16,y,6,10); }
    });
    return _padFrame;
  }
  function padChevronTex(){ // satu panah runcing (puncak di atas kanvas = v+ = maju); per-pad agar offset animasi terpisah
    const t=canvasT(128,128,(g,w,h)=>{
      g.clearRect(0,0,w,h); g.lineJoin='round'; g.lineCap='round';
      const path=()=>{ g.beginPath(); g.moveTo(22,112); g.lineTo(w/2,22); g.lineTo(w-22,112); };
      g.shadowColor='#36d6ff'; g.shadowBlur=12; g.strokeStyle='#29c4ff'; g.lineWidth=22; path(); g.stroke();
      g.shadowBlur=0; const gr=g.createLinearGradient(0,22,0,112); gr.addColorStop(0,'#ffffff'); gr.addColorStop(1,'#bff4ff');
      g.strokeStyle=gr; g.lineWidth=11; path(); g.stroke();
    });
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    return t;
  }
  // boost pad: at = BK.Props.pathSampler(...). Kembali {group, mesh(chevron), frame}. Animasi: BK.Props.tickBoostPad.
  BK.Props.boostPad=function(at,w,l){
    const g=new THREE.Group();
    const frame=new THREE.Mesh(pathStrip(at,l,w,0.055,1),
      new THREE.MeshBasicMaterial({map:padFrameTex(),transparent:true,depthWrite:false,side:THREE.DoubleSide}));
    frame.renderOrder=2; g.add(frame);
    const mesh=new THREE.Mesh(pathStrip(at,l*0.86,w*0.62,0.07,2),
      new THREE.MeshBasicMaterial({map:padChevronTex(),transparent:true,opacity:0.95,depthWrite:false,side:THREE.DoubleSide}));
    mesh.renderOrder=3; g.add(mesh);
    const c=at(0); // hitbox persegi = tapak pad (pusat + arah jalan + lebar/panjang)
    return {group:g, mesh, frame, cx:c.x, cz:c.z, tx:c.tx, tz:c.tz, w, l};
  };
  // HITBOX zona datar persegi (boost pad, es): kena bila ≥ setengah badan kart masuk tapak.
  // z = {cx,cz,tx,tz,w,l}; k = kart (pakai BK.kartHit untuk ukuran badan).
  BK.Props.boostPadHit=function(z,k){
    const h=BK.kartHit?BK.kartHit(k):{hw:1.2,hl:1.8};
    const dx=k.pos.x-z.cx, dz=k.pos.z-z.cz, along=dx*z.tx+dz*z.tz, lat=dx*z.tz-dz*z.tx;
    return Math.abs(along)<z.l/2+h.hl*0.5 && Math.abs(lat)<z.w/2+h.hw*0.5;
  };
  BK.Props.tickBoostPad=function(p,dt){
    p.pulse=(p.pulse||0)+dt*4;
    p.mesh.material.opacity=0.75+Math.abs(Math.sin(p.pulse))*0.25;
    if(p.frame) p.frame.material.opacity=0.85+Math.abs(Math.sin(p.pulse*0.5))*0.15;
    if(p.mesh.material.map) p.mesh.material.map.offset.y-=dt*2.2; // offset turun = chevron mengalir maju
  };
  // kerb merah-putih di apex tikungan tajam: pts/normals/tangents = centerline tertutup, half = setengah lebar jalan
  BK.Props.kerbs=function(pts,normals,tangents,half,thresh){
    const N=pts.length; thresh=thresh||0.40;
    const kTex=G('t:kerb',()=>{ const t=canvasT(64,16,(g,w,h)=>{ g.fillStyle='#f3f1ea'; g.fillRect(0,0,w,h); g.fillStyle='#d4372c'; g.fillRect(0,0,w/2,h);
      g.fillStyle='rgba(0,0,0,.12)'; g.fillRect(0,h-3,w,3); }); t.wrapS=THREE.RepeatWrapping; return t; });
    const curv=[]; for(let i=0;i<N;i++){ const t1=tangents[(i-4+N)%N], t2=tangents[(i+4)%N]; curv.push(Math.abs(t1.x*t2.z-t1.z*t2.x)); }
    const on=curv.map((c,i)=>Math.max(c,curv[(i+1)%N],curv[(i-1+N)%N],curv[(i+2)%N],curv[(i-2+N)%N])>thresh);
    const v=[], uv=[], id=[]; let q=0, dist=0;
    for(let i=0;i<N;i++){
      const j=(i+1)%N, p=pts[i], p2=pts[j], segL=Math.hypot(p2.x-p.x,p2.z-p.z);
      if(on[i]&&on[j]) [[half-1.05,half],[-half,-half+1.05]].forEach(([o1,o2])=>{
        const n1=normals[i], n2=normals[j];
        v.push(p.x+n1.x*o1,p.y+0.045,p.z+n1.z*o1, p.x+n1.x*o2,p.y+0.045,p.z+n1.z*o2,
               p2.x+n2.x*o1,p2.y+0.045,p2.z+n2.z*o1, p2.x+n2.x*o2,p2.y+0.045,p2.z+n2.z*o2);
        uv.push(dist/3.2,0, dist/3.2,1, (dist+segL)/3.2,0, (dist+segL)/3.2,1);
        id.push(q,q+1,q+2, q+1,q+3,q+2); q+=4; // winding menghadap atas (normal +y, diverifikasi)
      });
      dist+=segL;
    }
    if(!q) return null;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(v,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(id); g.computeVertexNormals();
    return new THREE.Mesh(g,G('m:kerb',()=>new THREE.MeshLambertMaterial({map:kTex})));
  };
  BK.placeProp=function(holder,item,x,y,z,ry){
    item.group.position.set(x,y,z);
    if(ry)item.group.rotation.y=ry;
    holder.group.add(item.group);
    if(item.r&&holder.colliders)holder.colliders.push({x,z,r:item.r});
    return item.group;
  };
  /* cakram lembut: bayangan alas & tepi baur (tekstur radial sekali-buat) */
  let _softD=null;
  function softDTex(){
    if(_softD) return _softD;
    const c=document.createElement('canvas'); c.width=c.height=64;
    const g=c.getContext('2d');
    const grd=g.createRadialGradient(32,32,2,32,32,30);
    grd.addColorStop(0,'rgba(255,255,255,1)');
    grd.addColorStop(0.7,'rgba(255,255,255,.45)');
    grd.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=grd; g.fillRect(0,0,64,64);
    _softD=new THREE.CanvasTexture(c);
    return _softD;
  }
  BK.softDisc=function(r,color,opacity){
    const m=new THREE.Mesh(
      G('softdisc',()=>new THREE.CircleGeometry(1,20)),
      new THREE.MeshBasicMaterial({map:softDTex(),color:color==null?0x000000:color,transparent:true,opacity:opacity==null?0.35:opacity,depthWrite:false}));
    m.rotation.x=-Math.PI/2; m.scale.set(r,r,1);
    return m;
  };
  function shade(parent,r){
    const s=BK.softDisc(r,0x000000,0.32);
    s.position.y=0.03; parent.add(s);
  }
})();
