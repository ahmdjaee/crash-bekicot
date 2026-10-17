/* BK.Props: komponen reusable (palem/pinus/gubuk/batu).
   Geometri & material di-cache bersama. Tiap komponen bawa radius
   collider; BK.placeProp otomatis mendaftarkan ke holder.colliders. */
(function(){
  const geos={}, mats={};
  function G(k,make){ if(!geos[k])geos[k]=make(); return geos[k]; }
  function Mt(color){ if(!mats[color])mats[color]=new THREE.MeshLambertMaterial({color}); return mats[color]; }
  function Mb(color){ const k='b'+color; if(!mats[k])mats[k]=new THREE.MeshBasicMaterial({color}); return mats[k]; }
  BK.Props={
    palm(s){
      s=s||1;
      const g=new THREE.Group();
      shade(g,1.4);
      const trunk=new THREE.Mesh(G('ptrunk',()=>new THREE.CylinderGeometry(0.35,0.5,7,7)),Mt(0x8a5a2a));
      trunk.position.y=3.5; trunk.rotation.z=0.12; g.add(trunk);
      for(let k=0;k<5;k++){
        const leaf=new THREE.Mesh(G('pleaf',()=>new THREE.ConeGeometry(1.1,4.5,5)),Mt(0x2e8b47));
        const a=k/5*Math.PI*2;
        leaf.position.set(Math.cos(a)*2,7,Math.sin(a)*2);
        leaf.rotation.z=Math.PI/2.3*Math.cos(a); leaf.rotation.x=-Math.PI/2.3*Math.sin(a);
        g.add(leaf);
      }
      g.scale.setScalar(s);
      return {group:g, r:0.9*s};
    },
    pine(s){
      s=s||1;
      const g=new THREE.Group();
      shade(g,2.6);
      const trunk=new THREE.Mesh(G('ttrunk',()=>new THREE.CylinderGeometry(0.4,0.5,2,7)),Mt(0x6b4a2a));
      trunk.position.y=1; g.add(trunk);
      for(let k=0;k<3;k++){
        const c=new THREE.Mesh(G('tcone',()=>new THREE.ConeGeometry(3,3.2,8)),Mt(0x2d6b2d));
        c.scale.set(1-k*0.23,1,1-k*0.23);
        c.position.y=2.6+k*2; g.add(c);
      }
      g.scale.setScalar(s);
      return {group:g, r:1.4*s};
    },
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
    rock(s){
      s=s||1;
      const g=new THREE.Group();
      shade(g,1.8);
      const m=new THREE.Mesh(G('rrock',()=>new THREE.DodecahedronGeometry(1.2,0)),Mt(0x9a9a9a));
      m.position.y=0.7; m.rotation.set(0.4,0.7,0.2); g.add(m);
      g.scale.setScalar(s);
      return {group:g, r:1.3*s};
    },
    mushroom(s, col){
      s=s||1; col=col||0xd93829;
      const g=new THREE.Group();
      shade(g,2.2);
      const stem=new THREE.Mesh(G('mstem',()=>new THREE.CylinderGeometry(0.45,0.65,3.2,8)),Mt(0xede0cc));
      stem.position.y=1.6; g.add(stem);
      const cap=new THREE.Mesh(G('mcap',()=>new THREE.SphereGeometry(2.3,12,8,0,Math.PI*2,0,Math.PI*0.58)),Mt(col));
      cap.position.y=2.8; g.add(cap);
      const ring=new THREE.Mesh(G('mring',()=>new THREE.TorusGeometry(1.4,0.22,6,14)),Mt(0xf7efe2));
      ring.rotation.x=Math.PI/2; ring.position.y=3.8; g.add(ring);
      g.scale.setScalar(s);
      return {group:g, r:1.2*s};
    },
    ancientTree(s){
      s=s||1;
      const g=new THREE.Group();
      shade(g,3.8);
      const trunk=new THREE.Mesh(G('atrunk',()=>new THREE.CylinderGeometry(1.0,1.8,8.5,8)),Mt(0x543b22));
      trunk.position.y=4.2; g.add(trunk);
      const c1=new THREE.Mesh(G('acrown1',()=>new THREE.DodecahedronGeometry(4.0,1)),Mt(0x2d6e2e));
      c1.position.set(0,8.8,0); c1.scale.y=0.72; g.add(c1);
      const c2=new THREE.Mesh(G('acrown2',()=>new THREE.DodecahedronGeometry(2.8,1)),Mt(0x3f8539));
      c2.position.set(1.5,10.3,0.7); c2.scale.y=0.75; g.add(c2);
      g.scale.setScalar(s);
      return {group:g, r:1.9*s};
    },
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
    woodenBoat(s){
      s=s||1;
      const g=new THREE.Group();
      shade(g,2.8);
      const hull=new THREE.Mesh(G('bthull',()=>new THREE.BoxGeometry(2.2,0.9,4.8)),Mt(0x7a4b26));
      hull.position.y=0.45; g.add(hull);
      const bow=new THREE.Mesh(G('btbow',()=>new THREE.ConeGeometry(1.35,1.8,4)),Mt(0x633b1c));
      bow.rotation.x=Math.PI/2; bow.rotation.z=Math.PI/4; bow.position.set(0,0.5,3.1); g.add(bow);
      const seat=new THREE.Mesh(G('btseat',()=>new THREE.BoxGeometry(1.9,0.2,0.8)),Mt(0xb88b58));
      seat.position.set(0,0.85,0); g.add(seat);
      g.scale.setScalar(s);
      return {group:g, r:2.0*s};
    },
    snowPineProp(s){
      s=s||1;
      const g=new THREE.Group();
      shade(g,2.2);
      const trunk=new THREE.Mesh(G('sptrunk',()=>new THREE.CylinderGeometry(0.35,0.45,1.6,7)),Mt(0x5a4028));
      trunk.position.y=0.8; g.add(trunk);
      for(let k=0;k<3;k++){
        const c=new THREE.Mesh(G('spcone',()=>new THREE.ConeGeometry(2.5,2.7,8)),Mt(0x2e6b4a));
        const sc=1-k*0.22; c.scale.set(sc,1,sc); c.position.y=2.3+k*1.75; g.add(c);
        const cap=new THREE.Mesh(G('spcap',()=>new THREE.ConeGeometry(1.9,1.15,8)),Mt(0xf2f6fc));
        cap.scale.set(sc,1,sc); cap.position.y=3.15+k*1.75; g.add(cap);
      }
      g.scale.setScalar(s);
      return {group:g, r:1.3*s};
    },
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
