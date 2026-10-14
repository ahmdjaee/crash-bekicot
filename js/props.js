/* BK.Props: komponen reusable (palem/pinus/gubuk/batu).
   Geometri & material di-cache bersama. Tiap komponen bawa radius
   collider; BK.placeProp otomatis mendaftarkan ke holder.colliders. */
(function(){
  const geos={}, mats={};
  function G(k,make){ if(!geos[k])geos[k]=make(); return geos[k]; }
  function Mt(color){ if(!mats[color])mats[color]=new THREE.MeshLambertMaterial({color}); return mats[color]; }
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
