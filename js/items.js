/* Items: pickup box, misil, minyak, perisai, boost */
(function(){
  const C=BK.Config.items;

  // --- ASSET MISIL HD: roket lathe + sirip ekor + api boost; geometri/material dibagikan (satu piset untuk semua misil) ---
  let _msA=null;
  function missileAssets(){
    if(_msA) return _msA;
    // fuselage: ekor lurus → cincin pemandu → tonjolan baja abu; sumbu Y→Z dibakar (moncong +Z = arah terbang)
    const prof=[[0.27,-0.30],[0.27,0.18],[0.235,0.30],[0.235,0.66],[0.285,0.72],[0.285,0.78],[0.235,0.84],[0.19,0.98],[0.17,1.02]]
      .map(pt=>new THREE.Vector2(pt[0],pt[1]));
    const bodyGeo=new THREE.LatheGeometry(prof,20); bodyGeo.rotateX(Math.PI/2);
    // kepala peledak ogive merah
    const nprof=[[0.17,0],[0.13,0.16],[0.09,0.34],[0.05,0.46],[0.005,0.53]].map(pt=>new THREE.Vector2(pt[0],pt[1]));
    const noseGeo=new THREE.LatheGeometry(nprof,18); noseGeo.rotateX(Math.PI/2); noseGeo.translate(0,0,1.02);
    // lonceng knalpot di belakang
    const bellGeo=new THREE.CylinderGeometry(0.20,0.25,0.14,14); bellGeo.rotateX(Math.PI/2); bellGeo.translate(0,0,-0.37);
    // semburan api boost additive (menyala sepanjang terbang) — depthWrite:false
    const flameGeo=new THREE.ConeGeometry(0.14,0.60,10,1,true);
    flameGeo.rotateX(Math.PI/2); flameGeo.rotateY(Math.PI); flameGeo.translate(0,0,-0.75);
    // 4 sirip ekor jala-jala (trapesium menyapu ke belakang), diputar 90° sek-elap
    const fs=new THREE.Shape();
    fs.moveTo(0,0.20); fs.lineTo(0.42,0.20); fs.lineTo(0.30,0.48); fs.lineTo(0.10,0.48); fs.closePath();
    const finBase=new THREE.ExtrudeGeometry(fs,{depth:0.02,bevelEnabled:false});
    finBase.rotateY(Math.PI/2); finBase.translate(0,0,0.42);
    const finGeo=[0,1,2,3].map(k=>finBase.clone().rotateZ(k*Math.PI/2));
    // dua band merah peringatan
    const bandAGeo=new THREE.TorusGeometry(0.252,0.016,6,20); bandAGeo.translate(0,0,0.30);
    const bandBGeo=new THREE.TorusGeometry(0.212,0.014,6,20); bandBGeo.translate(0,0,0.90);
    const bodyMat=new THREE.MeshPhongMaterial({color:0xaeb9c2,shininess:70,specular:0xdfe8ee});
    const noseMat=new THREE.MeshPhongMaterial({color:0xd23c2e,shininess:80,specular:0xffe0d8});
    const finMat=new THREE.MeshStandardMaterial({color:0x2e3238,roughness:0.55,metalness:0.5});
    const bellMat=new THREE.MeshStandardMaterial({color:0x1f2226,roughness:0.6,metalness:0.5});
    const bandMat=new THREE.MeshPhongMaterial({color:0xd23c2e,shininess:60,specular:0xff9999});
    const flameMat=new THREE.MeshBasicMaterial({color:0xffa22e,transparent:true,opacity:0.75,
      blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
    return _msA={bodyGeo,noseGeo,bellGeo,flameGeo,finGeo,bandAGeo,bandBGeo,
      bodyMat,noseMat,finMat,bellMat,bandMat,flameMat};
  }
  function missileMesh(){
    const A=missileAssets();
    const g=new THREE.Group();
    g.add(new THREE.Mesh(A.bodyGeo,A.bodyMat));
    g.add(new THREE.Mesh(A.noseGeo,A.noseMat));
    g.add(new THREE.Mesh(A.bellGeo,A.bellMat));
    g.add(new THREE.Mesh(A.flameGeo,A.flameMat));
    A.finGeo.forEach(fg=>g.add(new THREE.Mesh(fg,A.finMat)));
    g.add(new THREE.Mesh(A.bandAGeo,A.bandMat));
    g.add(new THREE.Mesh(A.bandBGeo,A.bandMat));
    g.scale.setScalar(1.15);
    return g;
  }
  BK.Items = {
    list: [], oils: [], missiles: [],
    reset(scene, world){
      // hapus sisa
      this.list.forEach(m=>scene.remove(m.mesh));
      this.oils.forEach(o=>scene.remove(o.mesh));
      this.missiles.forEach(m=>scene.remove(m.mesh));
      this.list=[]; this.oils=[]; this.missiles=[];
      this.scene=scene; this.world=world;
    },
    roll(){
      const r=Math.random();
      if(r<0.3) return 'boost';
      if(r<0.55) return 'missile';
      if(r<0.78) return 'oil';
      return 'shield';
    },
    icon(t){ return {boost:'⚡',missile:'🚀',oil:'🛢️',shield:'🛡️'}[t]||'?'; },
    names:{boost:'Boost',missile:'Misil',oil:'Minyak',shield:'Perisai'},
    tryPickup(kart, world){
      for(const b of world.boxes){
        if(!b.active) continue;
        const dx=kart.pos.x-b.mesh.position.x, dz=kart.pos.z-b.mesh.position.z;
        if(dx*dx+dz*dz<4*4){
          // nabrak box = roulette baru, item lama langsung ditimpa
          kart.item=null; kart.roulette=0.8;
          if(kart.isPlayer && BK.refreshItemHUD)BK.refreshItemHUD();
          b.active=false; b.timer=C.boxRespawn; b.mesh.visible=false;
          if(BK.spawnBurst)BK.spawnBurst(b.mesh.position,0x66ccff,4,0.22); // pecah kecil
          BK.Audio.pickup();
          return true;
        }
      }
      // injak minyak?
      for(let i=this.oils.length-1;i>=0;i--){
        const o=this.oils[i];
        const dx=kart.pos.x-o.mesh.position.x, dz=kart.pos.z-o.mesh.position.z;
        if(dx*dx+dz*dz<2.2*2.2){
          if(kart.shieldTime>0){ kart.shieldTime=0; }
          else if(kart.spinTime<=0){
            kart.spinTime=C.spinTime*(kart.stat?kart.stat.spinMul:1); kart.boostTime=0;
            BK.Audio.hit(); if(kart.isPlayer){BK.shake(0.6);BK.flashMsg('KEPLESET!');}
          }
          this.scene.remove(o.mesh); this.oils.splice(i,1);
        }
      }
      return false;
    },
    use(kart, racers){
      if(!kart.item || kart.spinTime>0) return;
      const t=kart.item; kart.item=null;
      if(kart.isPlayer){ BK.Audio.item(); BK.refreshItemHUD(); }
      if(t==='boost'){ kart.boostTime=1.4; kart.boostPower=24; BK.Audio.boost(); }
      else if(t==='shield'){ kart.shieldTime=8; }
      else if(t==='oil'){ this.dropOil(kart); }
      else if(t==='missile'){ this.fireMissile(kart, racers); }
    },
    dropOil(kart){
      const g=new THREE.CylinderGeometry(1.1,1.3,0.25,10);
      const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color:0x1a1a1a}));
      const bx=kart.pos.x-Math.sin(kart.heading)*4, bz=kart.pos.z-Math.cos(kart.heading)*4;
      const by=(kart.gy!=null?kart.gy:0)+0.15;
      m.position.set(bx,by,bz); this.scene.add(m);
      this.oils.push({mesh:m, life:40});
    },
    fireMissile(kart, racers){
      // target: pembalap terdekat di depan
      let best=null,bd=1e18;
      racers.forEach(r=>{
        if(r===kart||r.finishTime!=null) return;
        const gap=r.progress-kart.progress;
        if(gap>0&&gap<bd){bd=gap;best=r;}
      });
      const m=missileMesh();
      m.rotation.order='YZX'; // yaw mengikuti homing, roll berputar pada sumbu terbang
      m.rotation.y=kart.heading;
      m.rotation.z=Math.random()*Math.PI*2;
      const my=(kart.gy!=null?kart.gy:0)+1.0;
      m.position.set(kart.pos.x+Math.sin(kart.heading)*3,my,kart.pos.z+Math.cos(kart.heading)*3);
      this.scene.add(m);
      this.missiles.push({mesh:m, owner:kart, target:best, heading:kart.heading, speed:C.missileSpeed, life:6, lastIdx:kart.lastIdx||0});
      BK.Audio.boost();
    },
    update(dt, racers){
      // roulette item ala CTR untuk semua pembalap
      const pool=['boost','missile','oil','shield'];
      racers.forEach(r=>{
        if(r.roulette>0){
          r.roulette-=dt;
          if(r.isPlayer && BK.refreshRouletteHUD) BK.refreshRouletteHUD(pool[((performance.now()/90)|0)%4]);
          if(r.roulette<=0){
            r.roulette=0; r.item=this.roll();
            if(r.isPlayer){
              BK.refreshItemHUD();
              if(BK.Audio.itemGet)BK.Audio.itemGet(r.item); else BK.Audio.item();
            }
          }
        }
      });
      // misil
      for(let i=this.missiles.length-1;i>=0;i--){
        const mi=this.missiles[i];
        mi.life-=dt;
        if(mi.target&&mi.target.finishTime==null){
          const dx=mi.target.pos.x-mi.mesh.position.x, dz=mi.target.pos.z-mi.mesh.position.z;
          const want=Math.atan2(dx,dz);
          let d=want-mi.heading;
          while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2;
          mi.heading+=Math.max(-3.6*dt,Math.min(3.6*dt,d));
        }
        mi.mesh.position.x+=Math.sin(mi.heading)*mi.speed*dt;
        mi.mesh.position.z+=Math.cos(mi.heading)*mi.speed*dt;
        mi.mesh.rotation.y=mi.heading;   // dulu: model tak pernah berbelok (membawa arah lama saat homing melengkung)
        mi.mesh.rotation.z+=dt*8;
        const q=this.world.nearest(mi.mesh.position.x,mi.mesh.position.z,mi.lastIdx||0);
        mi.lastIdx=q.idx;
        if(this.world.pts && this.world.pts[q.idx]){
          mi.mesh.position.y = this.world.pts[q.idx].y + 1.0;
        }
        let hit=false;
        racers.forEach(r=>{
          if(r===mi.owner||r.finishTime!=null) return;
          const dx=r.pos.x-mi.mesh.position.x, dz=r.pos.z-mi.mesh.position.z;
          if(dx*dx+dz*dz<2.6*2.6){
            if(r.shieldTime>0){ r.shieldTime=0; }
            else { r.spinTime=BK.Config.items.spinTime*(r.stat?r.stat.spinMul:1); r.boostTime=0; r.drifting=false;
              BK.Audio.hit(); if(r.isPlayer){BK.shake(0.7);BK.flashMsg('KENA MISIL!');} }
            hit=true;
          }
        });
        // kena dinding?
        if(Math.abs(q.lateral)>this.world.half) hit=true;
        if(hit||mi.life<=0){ this.scene.remove(mi.mesh); this.missiles.splice(i,1); }
      }
      // minyak kedaluwarsa
      for(let i=this.oils.length-1;i>=0;i--){
        this.oils[i].life-=dt;
        if(this.oils[i].life<=0){ this.scene.remove(this.oils[i].mesh); this.oils.splice(i,1); }
      }
      // AI pakai item secara taktis & agresif
      racers.forEach(r=>{
        if(r.isPlayer||!r.item||r.finishTime!=null||r.spinTime>0) return;
        const prof=BK.aiProfile?BK.aiProfile(r):null;
        const waitBase=prof?prof.itemWait:0.85;
        r._aiItemT=(r._aiItemT==null?waitBase+r.seed*0.8:r._aiItemT)-dt;

        // Deteksi situasi taktis instan
        const hasTargetAhead = racers.some(o=>o!==r && o.finishTime==null && (o.progress - r.progress)>1.5 && (o.progress - r.progress)<48);
        const tailgaterBehind = racers.some(o=>o!==r && o.finishTime==null && (r.progress - o.progress)>1.5 && (r.progress - o.progress)<22);
        const incomingMissile = this.missiles.some(m=>m.target===r || (m.owner!==r && Math.hypot(m.mesh.position.x-r.pos.x, m.mesh.position.z-r.pos.z)<24));

        if(r.item==='shield' && incomingMissile){
          this.use(r, racers); r._aiItemT=waitBase; return;
        }
        if(r.item==='missile' && hasTargetAhead && r._aiItemT<=waitBase*0.5){
          this.use(r, racers); r._aiItemT=waitBase; return;
        }
        if(r.item==='oil' && tailgaterBehind && r._aiItemT<=waitBase*0.6){
          this.use(r, racers); r._aiItemT=waitBase; return;
        }
        if(r._aiItemT<=0){
          r._aiItemT=waitBase+Math.random()*0.9;
          if(r.item==='shield' && prof && prof.def>0.5 && !incomingMissile){
            const closeRival = racers.some(o=>o!==r && Math.hypot(o.pos.x-r.pos.x, o.pos.z-r.pos.z)<7.5);
            if(!closeRival){ r._aiItemT=0.6; return; }
          }
          if(r.item==='missile' && !hasTargetAhead){
            r._aiItemT=0.45; return; // simpan misil sampai ada lawan di depan
          }
          this.use(r, racers);
        }
      });
    }
  };
})();
