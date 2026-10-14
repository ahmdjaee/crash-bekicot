/* Particles: debu/boost/ledakan + bekas selip ban. Offline, tanpa tekstur. */
(function(){
  let pool=[], scene=null;
  BK.initParticles=function(sc){
    scene=sc; pool=[];
    [skids,rings,floats,smokes].forEach(arr=>arr.forEach(s=>{ try{scene.remove(s.mesh); s.mesh.material.dispose();}catch(e){} }));
    skids=[]; rings=[]; floats=[]; smokes=[];
  };
  function spawn(pos,color,n,spread,up,life,size,op){
    for(let i=0;i<n;i++){
      if(pool.length>400) { const old=pool.shift(); scene.remove(old.mesh); }
      const g=new THREE.SphereGeometry(size||0.35,5,4);
      const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,transparent:true,opacity:op==null?0.9:op}));
      m.position.set(pos.x+(Math.random()-0.5)*(spread||2), 0.5+Math.random(), pos.z+(Math.random()-0.5)*(spread||2));
      scene.add(m);
      pool.push({mesh:m, vx:(Math.random()-0.5)*6, vy:(up||3)+Math.random()*3, vz:(Math.random()-0.5)*6, life:life||0.6, max:life||0.6});
    }
  }
  BK.spawnDust=function(pos,color,vx,vz){ // debu JALANAN: asap lembut natural
    BK.spawnSmoke(pos.x,pos.z,color,vx,vz,0.8,2.4);
  };
  BK.spawnPuff=function(pos,color){ // efek AKSI (drift/rem/boost): semburan tegas pendek
    if(pool.length>150) return;
    spawn(pos,color||0xcccccc,2,2,1.2,0.3,0.12,0.45); // kecil & cepat hilang
  };
  // ---- asap natural: sprite lembut, lahir di tanah, mengembang lalu menipis ----
  let smokeTex=null;
  function getSmokeTex(){
    if(smokeTex) return smokeTex;
    const c=document.createElement('canvas'); c.width=c.height=64;
    const g=c.getContext('2d');
    const grd=g.createRadialGradient(32,32,2,32,32,30);
    grd.addColorStop(0,'rgba(255,255,255,1)');
    grd.addColorStop(0.55,'rgba(255,255,255,.55)');
    grd.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=grd; g.fillRect(0,0,64,64);
    g.globalCompositeOperation='destination-out'; // bintik agar tidak mulus palsu
    for(let i=0;i<36;i++){
      g.fillStyle='rgba(0,0,0,'+(0.1+Math.random()*0.2)+')';
      const r=2+Math.random()*5;
      g.beginPath(); g.arc(Math.random()*64,Math.random()*64,r,0,7); g.fill();
    }
    smokeTex=new THREE.CanvasTexture(c);
    return smokeTex;
  }
  let smokes=[];
  BK.spawnSmoke=function(x,z,color,vx,vz,life,grow){
    if(!scene) return;
    if(smokes.length>70){ const o=smokes.shift(); scene.remove(o.mesh); o.mesh.material.dispose(); }
    const m=new THREE.SpriteMaterial({map:getSmokeTex(),color:color||0xbbbbbb,transparent:true,opacity:0.5,depthWrite:false});
    const s=new THREE.Sprite(m);
    const s0=0.5+Math.random()*0.4;
    s.position.set(x+(Math.random()-0.5)*0.5,0.15,z+(Math.random()-0.5)*0.5);
    s.scale.set(s0,s0*0.75,1);
    m.rotation=Math.random()*Math.PI*2;
    scene.add(s);
    smokes.push({mesh:s,
      vx:(vx||0)+(Math.random()-0.5)*1.6, vy:0.6+Math.random()*0.9, vz:(vz||0)+(Math.random()-0.5)*1.6,
      life:life||0.8, max:life||0.8, grow:grow||2.4, rot:(Math.random()-0.5)*1.6, s0});
  };
  BK.spawnBurst=function(pos,color,n,sz){ spawn(pos,color,n||12,3,5,0.7,sz||0.4); };
  // ring shockwave di tanah
  let rings=[];
  const ringGeo=new THREE.RingGeometry(0.8,1.0,24);
  BK.spawnRing=function(x,z,color,y){
    if(!scene) return;
    if(rings.length>12){ const o=rings.shift(); scene.remove(o.mesh); o.mesh.material.dispose(); }
    const m=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:color||0xffffff,transparent:true,opacity:0.9,side:THREE.DoubleSide}));
    m.rotation.x=-Math.PI/2; m.position.set(x,(y==null?0.08:y),z); scene.add(m);
    rings.push({mesh:m,life:0.45,max:0.45});
  };
  // teks melayang 3D (sprite kanvas, offline)
  let floats=[];
  BK.spawnFloatText=function(x,z,str){
    if(!scene||!str) return;
    const c=document.createElement('canvas'); c.width=256; c.height=64;
    const g=c.getContext('2d');
    g.font='900 44px Arial'; g.textAlign='center';
    g.lineWidth=9; g.strokeStyle='rgba(0,0,0,.85)'; g.strokeText(str,128,48);
    g.fillStyle='#fff'; g.fillText(str,128,48);
    const tex=new THREE.CanvasTexture(c);
    const m=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
    m.scale.set(4.4,1.1,1); m.position.set(x,2.8,z); scene.add(m);
    if(floats.length>10){ const o=floats.shift(); scene.remove(o.mesh); }
    floats.push({mesh:m,life:1.0});
  };

  // bekas ban: kotak pipih di aspal, memudar lalu hilang
  let skids=[];
  const skidGeo=new THREE.BoxGeometry(0.65,0.03,1.5);
  BK.spawnSkid=function(x,z,heading,gy){
    if(!scene) return;
    if(skids.length>160){ const o=skids.shift(); scene.remove(o.mesh); o.mesh.material.dispose(); }
    const m=new THREE.Mesh(skidGeo,
      new THREE.MeshBasicMaterial({color:0x050505,transparent:true,opacity:0.75}));
    m.position.set(x,(gy||0)+0.055,z); m.rotation.y=heading;
    scene.add(m);
    skids.push({mesh:m, life:4.5});
  };

  BK.updateParticles=function(dt){
    for(let i=pool.length-1;i>=0;i--){
      const p=pool[i]; p.life-=dt;
      p.mesh.position.x+=p.vx*dt; p.mesh.position.y+=p.vy*dt; p.mesh.position.z+=p.vz*dt;
      p.mesh.material.opacity=Math.max(0,p.life/p.max);
      p.mesh.scale.setScalar(1+(1-p.life/p.max)*1.5);
      if(p.life<=0){ scene.remove(p.mesh); pool.splice(i,1); }
    }
    for(let i=skids.length-1;i>=0;i--){
      const s=skids[i]; s.life-=dt;
      if(s.life<1.2) s.mesh.material.opacity=Math.max(0,s.life/1.2*0.5);
      if(s.life<=0){ scene.remove(s.mesh); s.mesh.material.dispose(); skids.splice(i,1); }
    }
    for(let i=rings.length-1;i>=0;i--){
      const r=rings[i]; r.life-=dt;
      const k=1-Math.max(0,r.life)/r.max;
      r.mesh.scale.set(1+k*7,1+k*7,1);
      r.mesh.material.opacity=0.9*Math.max(0,r.life/r.max);
      if(r.life<=0){ scene.remove(r.mesh); r.mesh.material.dispose(); rings.splice(i,1); }
    }
    for(let i=floats.length-1;i>=0;i--){
      const f=floats[i]; f.life-=dt;
      f.mesh.position.y+=dt*2.2; f.mesh.material.opacity=Math.max(0,f.life);
      if(f.life<=0){ scene.remove(f.mesh); floats.splice(i,1); }
    }
    for(let i=smokes.length-1;i>=0;i--){
      const sm=smokes[i]; sm.life-=dt;
      const age=1-Math.max(0,sm.life)/sm.max;
      sm.mesh.position.x+=sm.vx*dt; sm.mesh.position.z+=sm.vz*dt;
      if(sm.mesh.position.y<1.6) sm.mesh.position.y+=sm.vy*dt;
      const sc=sm.s0*(1+age*sm.grow);
      sm.mesh.scale.set(sc,sc*0.75,1);
      sm.mesh.material.rotation+=sm.rot*dt;
      sm.mesh.material.opacity=0.5*Math.max(0,sm.life/sm.max);
      if(sm.life<=0){ scene.remove(sm.mesh); sm.mesh.material.dispose(); smokes.splice(i,1); }
    }
  };
})();
