/* Items: pickup box, misil, minyak, perisai, boost */
(function(){
  const C=BK.Config.items;
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
      m.position.set(bx,0.15,bz); this.scene.add(m);
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
      const g=new THREE.ConeGeometry(0.5,1.8,8);
      const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xff3333}));
      m.rotation.x=Math.PI/2;
      m.position.set(kart.pos.x+Math.sin(kart.heading)*3,1,kart.pos.z+Math.cos(kart.heading)*3);
      this.scene.add(m);
      this.missiles.push({mesh:m, owner:kart, target:best, heading:kart.heading, speed:C.missileSpeed, life:6});
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
          mi.heading+=Math.max(-3*dt,Math.min(3*dt,d));
        }
        mi.mesh.position.x+=Math.sin(mi.heading)*mi.speed*dt;
        mi.mesh.position.z+=Math.cos(mi.heading)*mi.speed*dt;
        mi.mesh.rotation.z+=dt*8;
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
        const q=this.world.nearest(mi.mesh.position.x,mi.mesh.position.z,0);
        if(Math.abs(q.lateral)>this.world.half) hit=true;
        if(hit||mi.life<=0){ this.scene.remove(mi.mesh); this.missiles.splice(i,1); }
      }
      // minyak kedaluwarsa
      for(let i=this.oils.length-1;i>=0;i--){
        this.oils[i].life-=dt;
        if(this.oils[i].life<=0){ this.scene.remove(this.oils[i].mesh); this.oils.splice(i,1); }
      }
      // AI pakai item sesuai kepribadian (Reggie cepat, Coco menahan)
      racers.forEach(r=>{
        if(r.isPlayer||!r.item||r.finishTime!=null) return;
        // Reggie prioritaskan misil ke posisi 1: pakai langsung jika ada
        const prof=BK.aiProfile?BK.aiProfile(r):null;
        const waitBase=prof?prof.itemWait:1.5;
        r._aiItemT=(r._aiItemT==null?waitBase+r.seed*1.5:r._aiItemT)-dt;
        if(r._aiItemT<=0){
          r._aiItemT=waitBase+Math.random()*1.5;
          // Dingo pemburu: perisai dipakai hanya saat ada misil terbang
          if(r.item==='shield'&&prof&&prof.def>0.5){
            const threat=this.missiles.some(m=>m.owner!==r);
            if(!threat){ r._aiItemT=1.0; return; }
          }
          this.use(r, racers);
        }
      });
    }
  };
})();
