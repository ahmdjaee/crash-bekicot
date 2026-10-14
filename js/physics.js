/* Kart: visual dari js/chars.js (BK.buildSnail) + fisika arcade + drift CTR */
(function(){
  const C = BK.Config;

  BK.placeOnStart = function(kart, world, k){
    const s = world.slot(k);
    kart.pos.copy(s.pos); kart.heading=s.heading;
    kart.gy=s.pos.y;
    kart.speed=0; kart.lastIdx=s.idx; kart.lap=1; kart.halfPassed=false;
    kart.progress= - (world.N - s.idx); // start sedikit negatif biar urutan benar
    kart.drifting=false; kart.charge=0; kart.boostTime=0; kart.spinTime=0;
    kart.item=null; kart.finishTime=null;
    kart.mesh.position.copy(kart.pos); kart.mesh.rotation.y=kart.heading;
  };

  function chargeLevel(charge){
    const D=C.drift;
    if(charge>=D.chargeT3) return 3;
    if(charge>=D.chargeT2) return 2;
    if(charge>=D.chargeT1) return 1;
    return 0;
  }

  BK.updateKart = function(k, world, inp, dt, time){
    const P=C.player, D=C.drift;
    if(k.finishTime!=null){ // sudah finish: melambat otomatis
      k.speed=Math.max(0,k.speed-20*dt);
    }
    const spinning = k.spinTime>0;
    if(spinning){ k.spinTime-=dt; k.drifting=false; k.charge=0; }

    // --- boost ---
    let boosting = k.boostTime>0;
    if(boosting) k.boostTime-=dt;
    const topSpeed = P.topSpeed*(k.stat?k.stat.topMul:1) + (boosting? k.boostPower : 0);
    const accel = P.accel*(k.stat?k.stat.accelMul:1) + (boosting? 18 : 0);

    // --- gas / rem (rem prioritas: tetap bisa ngerem & mundur walau gas ketahan) ---
    if(!spinning && k.finishTime==null){
      if(inp.brake){
        if(k.speed>1) k.speed -= P.brake*dt;
        else k.speed=Math.max(-9, k.speed-18*dt); // mundur
      } else if(inp.gas){
        k.speed += accel*dt*(k.speed<0?2.5:1);
      } else {
        // drag
        k.speed -= k.speed*0.7*dt;
        if(Math.abs(k.speed)<0.3) k.speed=0;
      }
    } else if(spinning){
      k.speed += (5-k.speed)*2*dt;
    }
    k.speed=Math.min(k.speed, topSpeed+8);
    if(k.speed>topSpeed) k.speed+=(topSpeed-k.speed)*0.8*dt; // decay kelebihan boost

    // --- drift state ala CTR ---
    const wantDrift = !spinning && k.finishTime==null && inp.drift &&
      Math.abs(inp.steer)>0.12 && k.speed>D.minSpeed;
    if(wantDrift && !k.drifting){
      k.drifting=true; k.driftDir=Math.sign(inp.steer);
      k.charge=0; k.chargeLv=0; k.hopT=0.24;
      if(k.isPlayer) BK.Audio.drift();
    }
    if(k.drifting && (!inp.drift || k.speed<D.minSpeed*0.6 || spinning)){
      // lepas drift -> boost sesuai tier
      const lv=chargeLevel(k.charge);
      if(lv>0 && !spinning){
        const tiers=[0,D.boostT1,D.boostT2,D.boostT3];
        k.boostTime=tiers[lv]; k.boostPower=D.boostPower+(lv===3?8:0);
        if(k.isPlayer){ BK.Audio.boost(); BK.spawnBurst&&BK.spawnBurst(k.pos, lv===3?0xc26bff:0x33aaff, 14); }
      }
      k.drifting=false; k.charge=0; k.chargeLv=0;
    }
    if(k.drifting){
      // counter-steer mengisi lebih cepat (kunci CTR)
      const counter = Math.sign(inp.steer)!==k.driftDir && Math.abs(inp.steer)>0.1;
      k.charge += dt*(counter?1.5:0.95)*(k.stat?k.stat.chargeMul:1)*(k._ice?2:1);
      const lv=chargeLevel(k.charge);
      if(lv>k.chargeLv){ k.chargeLv=lv; if(k.isPlayer) BK.Audio.pickup(); }
      if(Math.random()<dt*20 && k.isPlayer) BK.Audio.drift();
    }

    // --- belok ---
    const spdF = Math.min(1, Math.abs(k.speed)/14);
    let turnRate = P.turn*(k.stat?k.stat.turnMul:1) * spdF * (1-Math.min(0.35, Math.abs(k.speed)/topSpeed*0.35));
    if(k._ice)turnRate*=1.25; // es: liar
    if(k.speed<0) turnRate*=-1;
    if(k.drifting) turnRate*=D.turnMul;
    if(!spinning) k.heading -= inp.steer*turnRate*dt;
    if(spinning) k.heading += 9*dt;

    // driftOffset: selisih arah gerak vs heading (slide)
    const targetOffset = k.drifting ? k.driftDir*0.42 : 0;
    let grip = k.drifting? D.gripDrift : P.grip;
    if(k._ice)grip=Math.min(grip,2.5); // es: melintir
    k.driftOffset += (targetOffset-k.driftOffset)*Math.min(1,grip*dt);

    // --- gerak ---
    const moveDir = k.heading + k.driftOffset;
    const dx=Math.sin(moveDir)*k.speed*dt, dz=Math.cos(moveDir)*k.speed*dt;
    k.pos.x+=dx; k.pos.z+=dz;

    // --- dinding (collider logis) / batas pulau hub ---
    let q={idx:k.lastIdx,dist:0,lateral:0};
    if(world.isHub){
      // garis pantai organik: radius tergantung sudut
      const coast=world.coast;
      let R=world.boundR||145;
      if(coast){
        let f=Math.atan2(k.pos.x,k.pos.z)/(Math.PI*2)*coast.length;
        f=((f%coast.length)+coast.length)%coast.length;
        const i0=Math.floor(f)%coast.length, i1=(i0+1)%coast.length, fr=f-Math.floor(f);
        R=coast[i0]+(coast[i1]-coast[i0])*fr;
      }
      const d=Math.hypot(k.pos.x,k.pos.z);
      if(d>R){
        k.pos.x*=R/d; k.pos.z*=R/d;
        k.speed*=0.6;
        if(k.isPlayer&&k.hitWall<=0){ k.hitWall=0.6; BK.flashMsg('PUTAR BALIK! ITU LAUT!'); }
      }
      // terrain milik sendiri: ikuti tinggi + gravitasi tanjakan
      if(world.heightAt){
        const gyT=world.heightAt(k.pos.x,k.pos.z);
        const gg=(k.gy||0), gd=Math.abs(gyT-gg);
        k.gy=gg+(gyT-gg)*(gd>2?1:Math.min(1,10*dt));
        const e=2;
        const gx=(world.heightAt(k.pos.x+e,k.pos.z)-world.heightAt(k.pos.x-e,k.pos.z))/(2*e);
        const gz=(world.heightAt(k.pos.x,k.pos.z+e)-world.heightAt(k.pos.x,k.pos.z-e))/(2*e);
        const fx=Math.sin(k.heading+k.driftOffset), fz=Math.cos(k.heading+k.driftOffset);
        k.speed-=(gx*fx+gz*fz)*30*dt;
      } else k.gy=0;
    } else {
    q=world.nearest(k.pos.x,k.pos.z,k.lastIdx);
    k.lastIdx=q.idx; k.lateral=q.lateral;
    const lim=world.half-1.0;
    if(Math.abs(q.lateral)>lim){
      const n=world.normals[q.idx];
      const side=Math.sign(q.lateral);
      k.pos.x-=n.x*(Math.abs(q.lateral)-lim)*side;
      k.pos.z-=n.z*(Math.abs(q.lateral)-lim)*side;
      const wmul=(k.stat?k.stat.wallMul:1);
      if(Math.abs(k.speed)>8 && k.hitWall<=0){
        const impact=Math.abs(k.speed);
        k.hitWall=0.4;
        k.speed*=(1-0.25*wmul); // jeduk pertama saja
        if(BK.spawnBurst)BK.spawnBurst(k.pos,0xffaa00,4,0.22); // percikan kecil
        if(k.isPlayer){
          k._wallSndT=(k._wallSndT||0)-dt;
          if(k._wallSndT<=0){ k._wallSndT=1.0; if(BK.Audio.thud)BK.Audio.thud(); }
          if(impact>25&&BK.shake)BK.shake(0.25); // getar hanya jeduk keras
        }
      } else {
        k.speed*=(1-Math.min(0.5,1.5*dt)*wmul); // gesek dinding: melicinkan, tidak kepaku
      }
      // belokkan moncong menjauh dinding (lateral+ = sisi kanan -> heading tambah)
      k.heading+=side*1.4*dt*Math.sign(k.speed||1);
    }
    if(k.hitWall>0)k.hitWall-=dt;
    if(k.padCd>0)k.padCd-=dt;

    // --- elevasi: ikuti tinggi trek + gravitasi + es (frame depan untuk grip/belok) ---
    if(!world.isHub&&world.pts){
      const gyT=world.pts[q.idx].y;
      const gg=(k.gy||0), gd=Math.abs(gyT-gg);
      k.gy=gg+(gyT-gg)*(gd>2?1:Math.min(1,10*dt));
      const seg=world.trackLen/world.N;
      const yA=world.pts[(q.idx+3)%world.N].y, yB=world.pts[(q.idx-3+world.N)%world.N].y;
      k.speed-=((yA-yB)/(6*seg))*30*dt; // nanjak melambat, turun melaju
      k._ice=false;
      if(world.ice)for(const p of world.ice){
        let di=Math.abs(q.idx-p.idx); di=Math.min(di,world.N-di);
        if(di<8&&Math.abs(q.lateral)<p.w/2){k._ice=true;break;}
      }
    } else { k.gy=0; k._ice=false; }

    // --- turbo pad ---
    if(!world.isHub&&k.padCd<=0){
      for(const p of world.pads){
        let di=Math.abs(q.idx-p.idx); di=Math.min(di, world.N-di);
        if(di<5 && Math.abs(q.lateral)<p.w/2){
          k.boostTime=0.85; k.boostPower=19; k.padCd=1;
          if(k.isPlayer){ BK.Audio.boost(); BK.spawnBurst(k.pos,0x2288ff,12); }
          break;
        }
      }
    }
    } // tutup cabang !isHub (dinding+pad)

    // --- tabrakan properti (lingkaran, SEMUA world yang pakai BK.placeProp) ---
    if(world.colliders){
      for(const c of world.colliders){
        const dx=k.pos.x-c.x, dz=k.pos.z-c.z;
        const rr=c.r+1.2, d2=dx*dx+dz*dz;
        if(d2<rr*rr&&d2>0.0001){
          const d=Math.sqrt(d2), push=rr-d;
          k.pos.x+=dx/d*push; k.pos.z+=dz/d*push;
          if(Math.abs(k.speed)>6&&k.hitWall<=0){
            k.hitWall=0.3; k.speed*=0.85;
            if(k.isPlayer){
              if(BK.Audio.thud)BK.Audio.thud();
              if(BK.spawnBurst)BK.spawnBurst(k.pos,0xaaaaaa,4,0.22);
            }
          }
        }
      }
    }

    // --- hop visual + debu mendarat ---
    const wasAir=k.hopT>0;
    if(k.hopT>0)k.hopT-=dt;
    if(wasAir&&k.hopT<=0&&Math.abs(k.speed)>6&&BK.spawnDust&&(BK.Config.smoke||0)!==0){
      const lx=Math.sin(k.heading), lz=Math.cos(k.heading);
      for(let s=0;s<3;s++)BK.spawnDust(k.pos,world.def.dust||0xcccccc,-lx*k.speed*0.2,-lz*k.speed*0.2);
    }
    const hopY = k.hopT>0 ? Math.sin((0.24-k.hopT)/0.24*Math.PI)*0.9 : 0;

    // --- progress / lap (balapan saja, hub bebas) ---
    if(!world.isHub){
    // idx 0 = garis start. Lap nambah saat melintasi 0 dari belakang setelah lewat tengah
    const prev=k._prevIdx!==undefined?k._prevIdx:q.idx;
    k._prevIdx=q.idx;
    const crossed = prev>world.N*0.8 && q.idx<world.N*0.2;
    const crossedBack = prev<world.N*0.2 && q.idx>world.N*0.8;
    if(crossed && k.halfPassed && k.finishTime==null){
      k.lap++;
      if(k.lap>C.laps+ (k.isPlayer?0:0)){
        // finish ditangani game.js (butuh waktu); tandai mentok
      }
    }
    if(crossedBack) k.halfPassed=false;
    // tandai sudah setengah putaran
    const midLow=world.N*0.35, midHigh=world.N*0.65;
    if(q.idx>midLow&&q.idx<midHigh) k.halfPassed=true;
    k.progress=(k.lap-1)*world.N+q.idx+(crossed?0:0);
    } // tutup cabang balapan

    // --- visual ---
    k.wheelSpin+=k.speed*dt*2;
    const u=k.mesh.userData;
    k.mesh.position.set(k.pos.x, (k.gy||0)+hopY, k.pos.z);
    k.mesh.rotation.y=k.heading;
    // miring saat belok/drift
    const lean = k.drifting? k.driftDir*0.22 : -inp.steer*0.1*Math.min(1,k.speed/20);
    k.mesh.rotation.z=lean;
    k.mesh.rotation.x=Math.min(0.08,Math.max(-0.12,-k.speed*0.001+(boosting?-0.06:0)));
    u.wheels.forEach(w=>{
      w.spin.rotation.x=k.wheelSpin;
      if(w.front) w.pivot.rotation.y=-inp.steer*0.45;
    });
    // api boost
    const fl = boosting||k.chargeLv>0&&k.drifting;
    u.flame.material.opacity += ((fl?0.9:0)-u.flame.material.opacity)*Math.min(1,10*dt);
    const s=boosting?1+Math.random()*0.4:0.7;
    u.flame.scale.set(s,s,s);
    u.flame.material.color.setHex(k.chargeLv===3?0xc26bff:k.chargeLv===2?0xff9f1c:k.chargeLv===1?0x3fb6ff:0x33aaff);
    // perisai
    u.shield.material.opacity += ((k.shieldTime>0?0.28:0)-u.shield.material.opacity)*Math.min(1,8*dt);
    if(k.shieldTime>0)k.shieldTime-=dt;
    // bekicot hidup: kedip + tangkai bergoyang + squash & stretch
    if(u.eyes){
      k.blinkT-=dt;
      if(k.blinkT<=0){ k.blinkT=2.2+Math.random()*2.5; k._blink=0.13; }
      if(k._blink>0)k._blink-=dt;
      const eo=k._blink>0?0.12:1;
      u.eyes.forEach(e=>e.scale.set(1,eo,1));
      (u.stalks||[]).forEach((s,i)=>{
        s.rotation.x=0.15+Math.min(0.3,Math.abs(k.speed)/70)+Math.sin(time*7+(k.seed||0)*9+i)*0.05;
      });
      const bs=k.baseScale||1;
      let sx=1,sy=1,sz=1;
      if(boosting){ sx=0.96; sy=0.94; sz=1.1; }
      if(k.hitWall>0.15){ sx=1.12; sy=0.78; sz=0.9; }
      else if(k.hopT>0){ sy=1.08; }
      const kk=Math.min(1,10*dt);
      k._sq=k._sq||{x:1,y:1,z:1};
      k._sq.x+=(sx-k._sq.x)*kk; k._sq.y+=(sy-k._sq.y)*kk; k._sq.z+=(sz-k._sq.z)*kk;
      k.mesh.scale.set(bs*k._sq.x,bs*k._sq.y,bs*k._sq.z);
    }

    // efek ban. Dua bahasa visual: JALANAN = asap lembut (spawnDust),
    // AKSI (drift/rem/boost) = semburan tegas pendek (spawnPuff).
    const fx=Math.sin(k.heading), fz=Math.cos(k.heading);
    const rx=-fz, rz=fx; // kanan layar
    const rl={x:k.pos.x-fx*1.2+rx*1.0, z:k.pos.z-fz*1.2+rz*1.0};
    const rr={x:k.pos.x-fx*1.2-rx*1.0, z:k.pos.z-fz*1.2-rz*1.0};
    const dustC=world.def.dust||0xcccccc;
    const SMK=(BK.Config.smoke==null?1:BK.Config.smoke); // knob intensitas asap jalan
    const bvx=-fx*k.speed*0.25, bvz=-fz*k.speed*0.25; // hanyut ke belakang ikut laju
    if(k.drifting&&Math.abs(k.speed)>10&&BK.spawnPuff){
      // makin besar slide, makin banyak semburan
      const bigSlide=Math.abs(k.driftOffset)>0.2;
      if(Math.random()<(bigSlide?0.15:0.04))
        BK.spawnPuff(Math.random()<0.5?rl:rr,dustC);
      if(BK.spawnSkid){
        k._skidT=(k._skidT||0)+dt;
        if(k._skidT>0.12&&k.hopT<=0){ k._skidT=0; // tidak di udara
          BK.spawnSkid(rl.x,rl.z,k.heading,k.gy||0);
          BK.spawnSkid(rr.x,rr.z,k.heading,k.gy||0);
        }
      }
    }
    // baseline jalanan: ngebut = napas debu sangat tipis
    if(SMK>0&&!k.drifting&&Math.abs(k.speed)>24&&BK.spawnDust&&Math.random()<0.04*SMK)
      BK.spawnDust({x:k.pos.x-fx*1.2,z:k.pos.z-fz*1.2},dustC,bvx,bvz);
    // wheelspin saat start pelan tapi gas pol (di atas aspal -> asap lembut)
    if(SMK>0&&!spinning&&k.finishTime==null&&inp.gas&&k.speed>=0&&k.speed<8&&BK.spawnDust){
      if(Math.random()<0.25*SMK)BK.spawnDust(Math.random()<0.5?rl:rr,dustC,bvx,bvz);
    }
    // rem mengunci di kecepatan tinggi: asap tegas + decit
    if(!spinning&&inp.brake&&k.speed>20){
      if(BK.spawnPuff&&Math.random()<0.18)BK.spawnPuff(Math.random()<0.5?rl:rr,0xdddddd);
      if(k.isPlayer&&BK.Audio.screech){ k._scrT=(k._scrT||0)-dt; if(k._scrT<=0){k._scrT=0.5;BK.Audio.screech();} }
    }
    // jejak api boost: ungu permanen kalau 7 huruf lengkap, kalau tidak warna karakter
    if(boosting&&BK.spawnPuff&&Math.random()<0.14){
      let tcol=(k.char&&k.char.boostCol)||0x66ccff;
      if(k.isPlayer&&BK.Save.trailColor){ const tc=BK.Save.trailColor(); if(tc!=null)tcol=tc; }
      BK.spawnPuff({x:k.pos.x-fx*2.0,z:k.pos.z-fz*2.0},tcol);
    }
    return q;
  };
})();
