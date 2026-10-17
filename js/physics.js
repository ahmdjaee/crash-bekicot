/* Kart: visual dari js/chars.js (BK.buildSnail) + fisika arcade + drift CTR */
(function(){
  const C = BK.Config;

  BK.placeOnStart = function(kart, world, k){
    const s = world.slot(k);
    kart.pos.copy(s.pos); kart.heading=s.heading;
    kart.gy=s.pos.y; kart.worldY=s.pos.y; kart.airY=0; kart.vy=0; kart.airTime=0; kart.grounded=true;
    kart._prevGy=s.pos.y; kart._surfVy=0; kart._peakClimbVy=0; kart._airTricked=false; kart._trickSpin=0;
    kart._suspY=0; kart._suspV=0; kart._pitchV=0; kart._roll=0; kart._rollV=0;
    kart._bumpVx=0; kart._bumpVz=0;
    kart.speed=0; kart.lastIdx=s.idx; kart.lap=1; kart.halfPassed=false;
    kart.progress= - (world.N - s.idx); // start sedikit negatif biar urutan benar
    kart.drifting=false; kart.driftOffset=0; kart._driftYaw=0; kart.charge=0; kart.boostTime=0; kart.spinTime=0;
    kart.item=null; kart.finishTime=null;
    kart.mesh.rotation.order='YXZ';
    kart.mesh.position.copy(kart.pos); kart.mesh.rotation.set(0,kart.heading,0);
  };

  function chargeLevel(charge){
    const D=C.drift;
    if(charge>=D.chargeT3) return 3;
    if(charge>=D.chargeT2) return 2;
    if(charge>=D.chargeT1) return 1;
    return 0;
  }

  // Interpolasi Catmull-Rom 1D pada tinggi titik spline agar kontur & kemiringan 100% mulus (tanpa patahan poligon)
  function sampleTrackGround(world, x, z, idx){
    const pts=world.pts, N=world.N;
    const p0=pts[idx], pNext=pts[(idx+1)%N], pPrev=pts[(idx-1+N)%N];
    const vnx=pNext.x-p0.x, vnz=pNext.z-p0.z, ln2=vnx*vnx+vnz*vnz;
    const dotN=(x-p0.x)*vnx+(z-p0.z)*vnz;
    let fIdx;
    if(dotN>=0){
      fIdx = idx + Math.min(1, dotN/(ln2||1));
    } else {
      const vpx=p0.x-pPrev.x, vpz=p0.z-pPrev.z, lp2=vpx*vpx+vpz*vpz;
      const uPrev = Math.max(0, 1 + ((x-p0.x)*vpx+(z-p0.z)*vpz)/(lp2||1));
      fIdx = idx - 1 + uPrev;
    }
    function yAtF(f){
      const fw=((f%N)+N)%N, i1=Math.floor(fw), u=fw-i1;
      const i0=(i1-1+N)%N, i2=(i1+1)%N, i3=(i1+2)%N;
      const y0=pts[i0].y, y1=pts[i1].y, y2=pts[i2].y, y3=pts[i3].y;
      const u2=u*u, u3=u2*u;
      return 0.5*((2*y1)+(-y0+y2)*u+(2*y0-5*y1+4*y2-y3)*u2+(-y0+3*y1-3*y2+y3)*u3);
    }
    const gy = yAtF(fIdx);
    const seg = (world.trackLen||600)/N;
    // Skala dekat (1.2 segmen ~5m) untuk kemiringan instan & bibir ramp ski-jump
    const stepNear = 1.2;
    const yBn = yAtF(fIdx - stepNear), yAn = yAtF(fIdx + stepNear);
    const dsn = stepNear * seg;
    const sbNear = (gy - yBn) / dsn;
    const saNear = (yAn - gy) / dsn;
    const slope  = (yAn - yBn) / (2 * dsn);
    // Skala bukit alami (4.5 segmen ~18m ke belakang, 3.2 segmen ~13m ke depan) untuk puncak tanjakan panjang
    const stepBack = 4.5, stepFwd = 3.2;
    const sbHill = (gy - yAtF(fIdx - stepBack)) / (stepBack * seg);
    const saHill = (yAtF(fIdx + stepFwd) - gy) / (stepFwd * seg);
    const slopeBehind = Math.max(sbNear, sbHill);
    const slopeAhead  = Math.min(saNear, saHill);
    const crestDrop   = Math.max(sbNear - saNear, sbHill - saHill); // >0 saat menanjak lalu melewati puncak bukit/ramp
    return {gy, slope, slopeBehind, slopeAhead, crestDrop};
  }

  BK.updateKart = function(k, world, inp, dt, time){
    const P=C.player, D=C.drift;
    if(k.finishTime!=null){ // sudah finish: melambat otomatis
      k.speed=Math.max(0,k.speed-20*dt);
    }
    const spinning = k.spinTime>0;
    if(spinning){ k.spinTime-=dt; k.drifting=false; k.charge=0; }

    const isAir = !k.grounded && (k.airY||0) > 0.05;

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

    const hopEdge = inp.drift && !k._prevDriftInp;
    k._prevDriftInp = !!inp.drift;
    if(k._launchCd>0) k._launchCd-=dt;

    // --- drift state: aktif saat tekan Spasi (baik sambil belok maupun saat jalan lurus!) ---
    if(Math.abs(inp.steer)>0.12) k._lastSteerDir = Math.sign(inp.steer);
    const wantDrift = !spinning && k.finishTime==null && inp.drift && k.speed>D.minSpeed;
    if(wantDrift && !k.drifting){
      k.drifting=true;
      k._driftLockedDir = Math.abs(inp.steer)>0.12;
      k.driftDir = k._driftLockedDir ? Math.sign(inp.steer) : (k._lastSteerDir || 1);
      k.charge=0; k.chargeLv=0; k.hopT=0.24;
      if(k.isPlayer) BK.Audio.drift();
    }
    if(k.drifting && !k._driftLockedDir && Math.abs(inp.steer)>0.12){
      k.driftDir = Math.sign(inp.steer);
      k._driftLockedDir = true;
    }
    if(k.drifting && (!inp.drift || k.speed<D.minSpeed*0.6 || spinning)){
      // lepas drift -> boost sesuai tier
      const lv=chargeLevel(k.charge);
      if(lv>0 && !spinning){
        const tiers=[0,D.boostT1,D.boostT2,D.boostT3];
        k.boostTime=tiers[lv]; k.boostPower=D.boostPower+(lv===3?8:0);
        if(k.isPlayer){ BK.Audio.boost(); BK.spawnBurst&&BK.spawnBurst({x:k.pos.x,y:k.worldY||k.gy||0,z:k.pos.z}, lv===3?0xc26bff:0x33aaff, 14); }
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

    // --- belok & navigasi adaptable (mengikuti input setir pemain, tidak memaksa belok sendiri) ---
    const spdF = Math.min(1, Math.abs(k.speed)/14);
    let turnRate = P.turn*(k.stat?k.stat.turnMul:1) * spdF * (1-Math.min(0.35, Math.abs(k.speed)/topSpeed*0.35));
    if(k._ice)turnRate*=1.25; // es: liar
    if(k.speed<0) turnRate*=-1;
    if(k.drifting) turnRate*=D.turnMul;
    const deltaH = (!spinning) ? (-inp.steer*turnRate*dt) : (9*dt);
    k.heading += deltaH;

    // driftOffset: inersia ngesot menyamping (arah gerak moveDir tertinggal di belakang belokan moncong saat ban selip)
    if(k.drifting && !spinning){
      k.driftOffset -= deltaH * 0.65; // momentum meluncur keluar saat moncong dibelokkan
      if(k.hopT > 0 && Math.abs(inp.steer)>0.12) k.driftOffset += k.driftDir * 0.85 * dt; // lemparan ekor saat hop sambil belok
    }
    const targetOffset = k.drifting ? (inp.steer*0.42) : 0;
    let grip = k.drifting ? D.gripDrift : P.grip;
    if(k._ice) grip = Math.min(grip, 2.2); // es: melintir
    k.driftOffset += (targetOffset - k.driftOffset) * Math.min(1, grip * dt);
    k.driftOffset = Math.max(-0.55, Math.min(0.55, k.driftOffset));

    // --- gerak + kecepatan impuls senggolan (_bumpVx, _bumpVz) ---
    const moveDir = k.heading + k.driftOffset;
    const mvx=Math.sin(moveDir), mvz=Math.cos(moveDir);
    k._bumpVx = k._bumpVx || 0;
    k._bumpVz = k._bumpVz || 0;
    const dx=(mvx*k.speed + k._bumpVx)*dt, dz=(mvz*k.speed + k._bumpVz)*dt;
    k.pos.x+=dx; k.pos.z+=dz;
    const bumpDecay = Math.max(0, 1 - 7.2*dt);
    k._bumpVx *= bumpDecay; k._bumpVz *= bumpDecay;
    if(Math.abs(k._bumpVx)<0.05) k._bumpVx=0;
    if(Math.abs(k._bumpVz)<0.05) k._bumpVz=0;

    // --- dinding (collider logis) & pelontar gundukan/ramp (berdasarkan kecepatan × tinggi gundukan) ---
    let q={idx:k.lastIdx,dist:0,lateral:0};
    let gyNow=0, slope=0;
    if(k.grounded===undefined) k.grounded=true;

    if(world.isHub){
      // garis pantai organik: radius tergantung sudut
      const coast=world.coast;
      let R=world.boundR||280;
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
      if(world.heightAt){
        gyNow = world.heightAt(k.pos.x,k.pos.z);
        const stepD = 2.0;
        const yB = world.heightAt(k.pos.x - mvx*stepD, k.pos.z - mvz*stepD);
        const yA = world.heightAt(k.pos.x + mvx*stepD, k.pos.z + mvz*stepD);
        slope = (yA - yB) / (2 * stepD);
        if(k.grounded){
          k.speed -= slope * 26 * dt;
          // Cek gundukan ramp di pulau (hubRamps): lompat hanya di gundukan sesuai kecepatan × tinggi
          if(world.hubRamps && (k._launchCd||0)<=0 && !spinning){
            for(const hr of world.hubRamps){
              const hd = Math.hypot(k.pos.x - hr.x, k.pos.z - hr.z);
              if(hd < hr.r && k.speed > 15){
                const speedFactor = Math.max(0, (k.speed - 12) / P.topSpeed);
                const vLaunch = speedFactor * (hr.height || hr.h || 2.0) * 3.45;
                if(vLaunch > 2.4){
                  k.grounded = false;
                  k.worldY = gyNow + 0.08;
                  k.vy = Math.min(10.8, vLaunch);
                  k.airTime = 0; k._launchCd = 0.85; k._airTricked = false;
                  if(k.isPlayer && BK.Audio.jump) BK.Audio.jump();
                  break;
                }
              }
            }
          }
        }
      }
      if(k.padCd>0)k.padCd-=dt;
      if(world.pads && k.padCd<=0 && (k.airY||0)<2.2){
        for(const p of world.pads){
          const px = p.x != null ? p.x : (p.pos ? p.pos.x : 0);
          const pz = p.z != null ? p.z : (p.pos ? p.pos.z : 0);
          if(Math.hypot(k.pos.x-px, k.pos.z-pz) < (p.r||4.5)){
            k.boostTime=0.85; k.boostPower=19; k.padCd=1.0;
            if(k.isPlayer){ BK.Audio.boost(); BK.spawnBurst({x:k.pos.x,y:k.worldY||gyNow,z:k.pos.z},0x2288ff,12); }
            break;
          }
        }
      }
      k.gy = gyNow;
      k._slope = slope;
    } else {
      q=world.nearest(k.pos.x,k.pos.z,k.lastIdx);
      k.lastIdx=q.idx; k.lateral=q.lateral;
      const lim=world.half-1.0;
      if(Math.abs(q.lateral)>lim){
        const n=world.normals[q.idx];
        const side=Math.sign(q.lateral);
        k.pos.x-=n.x*(Math.abs(q.lateral)-lim)*side;
        k.pos.z-=n.z*(Math.abs(q.lateral)-lim)*side;
        // Pantulkan impuls senggolan dari dinding agar tidak menembus batas
        const bDot = (k._bumpVx*n.x + k._bumpVz*n.z)*side;
        if(bDot > 0){
          k._bumpVx -= n.x*side*bDot*1.35;
          k._bumpVz -= n.z*side*bDot*1.35;
        }
        const wmul=(k.stat?k.stat.wallMul:1);
        if(Math.abs(k.speed)>8 && k.hitWall<=0){
          const impact=Math.abs(k.speed);
          k.hitWall=0.4;
          k.speed*=(1-0.25*wmul); // jeduk pertama saja (persis HEAD)
          if(BK.spawnBurst)BK.spawnBurst({x:k.pos.x,y:k.worldY||k.gy||0,z:k.pos.z},0xffaa00,4,0.22);
          if(k.isPlayer){
            k._wallSndT=(k._wallSndT||0)-dt;
            if(k._wallSndT<=0){ k._wallSndT=1.0; if(BK.Audio.thud)BK.Audio.thud(); }
            if(impact>25&&BK.shake)BK.shake(0.25); // getar hanya jeduk keras
          }
        } else {
          k.speed*=(1-Math.min(0.5,1.5*dt)*wmul); // gesek dinding: melicinkan, tidak kepaku
        }
        // belokkan moncong menjauh dinding (persis HEAD: lateral+ = sisi kanan -> heading tambah)
        k.heading+=side*1.4*dt*Math.sign(k.speed||1);
      }
      if(k.hitWall>0)k.hitWall-=dt;
      if(k.padCd>0)k.padCd-=dt;

      // --- elevasi mulus Catmull-Rom + lompatan HANYA di gundukan/ramp (kecepatan × tinggi gundukan) ---
      if(world.pts){
        const sg = sampleTrackGround(world, k.pos.x, k.pos.z, q.idx);
        gyNow = sg.gy; slope = sg.slope;
        k.gy = gyNow;

        if(k.grounded){
          // Nanjak melambat, turun melaju (natural, TANPA terbang di tanjakan biasa!)
          k.speed -= slope * 26 * dt;

          // Cek gundukan/ramp (launchZones): tinggi lompatan = fungsi(kecepatan × tinggi gundukan)
          let lzIn=null;
          if(world.launchZones)for(const z of world.launchZones){
            let delta = q.idx - z.idx;
            if(delta > world.N/2) delta -= world.N;
            if(delta < -world.N/2) delta += world.N;
            if(delta >= -2 && delta <= 2){ lzIn=z; break; }
          }
          if(lzIn && k._lzIn!==lzIn && k.speed>lzIn.minSpeed && (k._launchCd||0)<=0 && !spinning){
            const speedFactor = Math.max(0, (k.speed - 12) / P.topSpeed);
            const hBump = lzIn.height || lzIn.h || 2.0;
            const vLaunch = speedFactor * hBump * 3.45;
            if(vLaunch > 2.4){
              k.grounded = false;
              k.worldY = gyNow + 0.08;
              k.vy = Math.min(10.8, vLaunch);
              k.airTime = 0; k._launchCd = 0.75; k._airTricked = false;
              if(k.isPlayer){
                if(BK.Audio.jump) BK.Audio.jump();
                if(BK.spawnBurst) BK.spawnBurst({x:k.pos.x,y:k.worldY,z:k.pos.z}, 0xffaa22, 6, 0.25);
              }
            }
          }
          k._lzIn = lzIn;
        }
        k._slope = slope;
        k._ice=false;
        if(world.ice)for(const p of world.ice){
          let di=Math.abs(q.idx-p.idx); di=Math.min(di,world.N-di);
          if(di<8&&Math.abs(q.lateral)<p.w/2){k._ice=true;break;}
        }
      } else { k.gy=0; k.worldY=0; k._ice=false; k._slope=0; }

      // --- turbo pad ---
      if(k.padCd<=0 && (k.airY||0)<2.2){
        for(const p of world.pads){
          let di=Math.abs(q.idx-p.idx); di=Math.min(di, world.N-di);
          if(di<5 && Math.abs(q.lateral)<p.w/2){
            k.boostTime=0.85; k.boostPower=19; k.padCd=1;
            if(k.isPlayer){ BK.Audio.boost(); BK.spawnBurst({x:k.pos.x,y:k.worldY||k.gy||0,z:k.pos.z},0x2288ff,12); }
            break;
          }
        }
      }
    } // tutup cabang !isHub

    // --- tabrakan properti (lingkaran, SEMUA world yang pakai BK.placeProp) ---
    if(world.colliders){
      for(const c of world.colliders){
        const cdx=k.pos.x-c.x, cdz=k.pos.z-c.z;
        const rr=c.r+1.2, d2=cdx*cdx+cdz*cdz;
        if(d2<rr*rr&&d2>0.0001){
          const d=Math.sqrt(d2), push=rr-d;
          k.pos.x+=cdx/d*push; k.pos.z+=cdz/d*push;
          if(Math.abs(k.speed)>6&&k.hitWall<=0){
            k.hitWall=0.3; k.speed*=0.85;
            k._suspV=(k._suspV||0)-2.2;
            if(k.isPlayer){
              if(BK.Audio.thud)BK.Audio.thud();
              if(BK.spawnBurst)BK.spawnBurst({x:k.pos.x,y:k.worldY||k.gy||0,z:k.pos.z},0xaaaaaa,4,0.22);
            }
          }
        }
      }
    }

    // --- Integrasi Fisika Vertikal World-Space (Hanya aktif saat lepas landas dari Gundukan/Ramp + Mid-Air Trick) ---
    if(k.worldY===undefined) k.worldY = gyNow;
    if(!k.grounded){
      k.airTime = (k.airTime||0) + dt;
      // Mid-Air Trick: tekan Spasi saat sedang terbang di udara -> putaran 360° + lonjakan + Trick Boost!
      if(hopEdge && !k._airTricked && k.airY > 0.45 && !spinning && k.finishTime==null){
        k._airTricked = true;
        k.vy = Math.min(9.5, Math.max(k.vy + 2.2, 4.2));
        k._trickSpin = Math.PI * 2;
        if(k.isPlayer){
          if(BK.Audio.pickup) BK.Audio.pickup();
          if(BK.spawnBurst) BK.spawnBurst({x:k.pos.x,y:k.worldY,z:k.pos.z}, 0xffd23f, 12, 0.32);
          BK.flashMsg('AIR TRICK! ✨');
        }
      }
      if((k._trickSpin||0) > 0){
        k._trickSpin = Math.max(0, k._trickSpin - Math.PI*2 * 2.4 * dt);
      }

      // Integrasi tinggi kart di World-Space
      k.worldY += k.vy * dt;
      const grav = Math.abs(k.vy) < 2.8 ? 22.0 : (k.vy > 0 ? 26.0 : 31.0);
      k.vy -= grav * dt;
      k.airY = k.worldY - gyNow;

      // Partikel hembusan angin saat melayang tinggi
      if(k.airY > 0.7 && Math.abs(k.speed) > 16 && BK.spawnPuff && Math.random() < 0.25){
        const fxA=Math.sin(k.heading), fzA=Math.cos(k.heading);
        BK.spawnPuff({x:k.pos.x-fxA*1.3, y:k.worldY+0.2, z:k.pos.z-fzA*1.3}, k._airTricked ? 0xffd23f : 0x88eeff);
      }

      // Cek pendaratan ketika busur parabolik worldY menyentuh permukaan jalan gyNow
      if(k.worldY <= gyNow && k.vy <= 0){
        const impactVy = -k.vy;
        const totalAir = k.airTime || 0;
        const didTrick = !!k._airTricked;
        k.worldY = gyNow; k.airY = 0; k.vy = 0; k.airTime = 0; k.grounded = true;
        k._airTricked = false; k._trickSpin = 0;
        k._suspV = (k._suspV||0) - Math.min(6.5, impactVy*0.46);
        k._landSquash = Math.min(0.28, impactVy*0.022);
        if(Math.abs(k.speed)>6 && BK.spawnDust && (BK.Config.smoke||0)!==0){
          const lx=Math.sin(k.heading), lz=Math.cos(k.heading);
          for(let s=0;s<4;s++) BK.spawnDust({x:k.pos.x,y:gyNow,z:k.pos.z}, world.def.dust||0xcccccc, -lx*k.speed*0.2, -lz*k.speed*0.2);
        }
        if(k.isPlayer && impactVy>6.5 && BK.Audio.thud) BK.Audio.thud();
        // Hang-Time / Trick Landing Boost
        if((totalAir >= 0.42 || didTrick) && !spinning && k.finishTime==null){
          const bigAir = totalAir >= 0.65 || didTrick;
          const jbTime = Math.min(1.4, (didTrick ? 0.85 : 0.5) + Math.max(0, totalAir - 0.4)*1.1);
          const jbPow  = didTrick ? 24 : (bigAir ? 21 : 17);
          if(jbTime > (k.boostTime||0)){
            k.boostTime = jbTime;
            k.boostPower = Math.max(k.boostPower||0, jbPow);
          }
          if(k.isPlayer){
            BK.Audio.boost();
            if(BK.spawnRing) BK.spawnRing(k.pos.x, k.pos.z, didTrick?0xffd23f:0x33ddff, gyNow+0.08);
            if(BK.spawnBurst) BK.spawnBurst({x:k.pos.x,y:gyNow+0.3,z:k.pos.z}, bigAir?0xffd23f:0x33ddff, 14);
            BK.flashMsg(didTrick ? 'TRICK BOOST! 🚀' : (bigAir ? 'SUPER AIR BOOST! 🚀' : 'JUMP BOOST! ⚡'));
          }
        }
      }
    } else {
      k.worldY = gyNow; k.airY = 0; k.vy = 0; k.grounded = true; k._trickSpin = 0;
    }

    // --- hop visual awal drift (persis commit HEAD: amplitudo 0.9 + debu mendarat) ---
    const wasHop = k.hopT>0;
    if(k.hopT>0) k.hopT-=dt;
    if(wasHop&&k.hopT<=0&&Math.abs(k.speed)>6&&BK.spawnDust&&(BK.Config.smoke||0)!==0){
      const lx=Math.sin(k.heading), lz=Math.cos(k.heading);
      for(let s=0;s<3;s++) BK.spawnDust({x:k.pos.x,y:gyNow,z:k.pos.z},world.def.dust||0xcccccc,-lx*k.speed*0.2,-lz*k.speed*0.2);
    }
    const hopArc = k.hopT>0 ? Math.sin((0.24-k.hopT)/0.24*Math.PI)*0.9 : 0;
    const hopY = k.airY + hopArc;

    // --- Pegas Suspensi & Oleng Samping Teredam (Damped Harmonic Oscillator) ---
    k._suspY = k._suspY || 0;
    k._suspV = k._suspV || 0;
    if(k.grounded && Math.abs(k.speed)>10 && world.def && world.def.id==='hutan'){
      // Getaran halus tekstur jalan tanah & kerikil pada suspensi kart (tanpa mengguncang layar)
      k._suspV += Math.sin(time*36 + (k.seed||0)*5) * 0.42 * dt * Math.min(1, Math.abs(k.speed)/30);
    }
    k._suspV += (-k._suspY*150 - k._suspV*14) * dt;
    k._suspY = Math.max(-0.26, Math.min(0.26, k._suspY + k._suspV*dt));
    if(k._landSquash>0) k._landSquash = Math.max(0, k._landSquash - 1.6*dt);

    // Pegas oleng bodi samping saat senggolan (tidak kaku!)
    k._roll = k._roll || 0;
    k._rollV = k._rollV || 0;
    k._rollV += (-k._roll*135 - k._rollV*11) * dt;
    k._roll = Math.max(-0.34, Math.min(0.34, k._roll + k._rollV*dt));

    // --- progress / lap (balapan saja, hub bebas) ---
    if(!world.isHub){
      const prev=k._prevIdx!==undefined?k._prevIdx:q.idx;
      k._prevIdx=q.idx;
      const crossed = prev>world.N*0.8 && q.idx<world.N*0.2;
      const crossedBack = prev<world.N*0.2 && q.idx>world.N*0.8;
      if(crossed && k.halfPassed && k.finishTime==null){
        k.lap++;
      }
      if(crossedBack) k.halfPassed=false;
      const midLow=world.N*0.35, midHigh=world.N*0.65;
      if(q.idx>midLow&&q.idx<midHigh) k.halfPassed=true;
      k.progress=(k.lap-1)*world.N+q.idx;
    }

    // --- visual ---
    k.wheelSpin+=k.speed*dt*2;
    const u=k.mesh.userData;
    k.mesh.rotation.order='YXZ';
    k.mesh.position.set(k.pos.x, k.worldY + hopArc + k._suspY*0.6, k.pos.z);
    // Sudut bodi menyamping (visual slip angle) saat drift: terlihat ngesot/sliding & responsif mengikuti setir pemain tanpa memaksa belok
    const targetYaw = k.drifting ? -(k.driftDir*0.28 + inp.steer*0.18) : 0;
    const yawRate = k.drifting ? (k.hopT>0 ? 14.0 : 7.5) : 9.5;
    k._driftYaw = (k._driftYaw||0) + (targetYaw - (k._driftYaw||0)) * Math.min(1, yawRate*dt);
    const bodyHeading = k.heading + k._driftYaw;
    k.mesh.rotation.y = bodyHeading + (k._trickSpin||0);
    // Kendaraan tetap rata menapak jalan (tidak miring / ban tidak terangkat)
    k.mesh.rotation.z=0;

    // Pitch (angguk): di darat sejajar kemiringan jalan; di udara mengikuti sudut terbang 3D (atan2(vy, speed))
    const pv0 = k._pitchV || 0;
    let targetPitch;
    if(k.grounded){
      const accelPitch = boosting ? -0.06 : -Math.min(0.035, k.speed*0.001);
      targetPitch = Math.max(-0.36, Math.min(0.36, -Math.atan(k._slope||0)*1.12)) + accelPitch;
      k._pitchV = pv0 + (targetPitch - pv0)*Math.min(1, 12*dt);
    } else {
      const flightAngle = -Math.atan2(k.vy, Math.max(15, Math.abs(k.speed))) * 1.15;
      targetPitch = Math.max(-0.42, Math.min(0.32, flightAngle));
      k._pitchV = pv0 + (targetPitch - pv0)*Math.min(1, 8.5*dt);
    }
    k.mesh.rotation.x = k._pitchV;

    // bayangan cakram: tetap menempel di tanah (k.gy) dan mengecil/memudar proporsional tinggi lompatan hopY
    if(!k._blob&&k.mesh.userData.blob) k._blob=k.mesh.userData.blob;
    if(k._blob){
      k._blob.position.set(k.pos.x,(k.gy||0)+0.06,k.pos.z);
      const hs=1+Math.max(0,hopY)*0.16;
      k._blob.scale.set(1.7*hs,1.7*hs,1);
      k._blob.material.opacity=Math.max(0.08,0.42/(1+Math.max(0,hopY)*0.55));
    }
    u.wheels.forEach(w=>{
      w.spin.rotation.x=k.wheelSpin;
      if(w.front){
        // Saat drift, roda depan ikut counter-steer terhadap sudut ngesot bodi (k._driftYaw)
        const fSteer = k.drifting ? (-inp.steer*0.30 - k._driftYaw*0.55) : (-inp.steer*0.45);
        w.pivot.rotation.y = Math.max(-0.58, Math.min(0.58, fSteer));
      }
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
    // bekicot hidup: kedip + tangkai bergoyang + squash & stretch (termasuk saat lompat & mendarat)
    if(u.eyes){
      k.blinkT-=dt;
      if(k.blinkT<=0){ k.blinkT=2.2+Math.random()*2.5; k._blink=0.13; }
      if(k._blink>0)k._blink-=dt;
      const eo=k._blink>0?0.12:1;
      u.eyes.forEach(e=>e.scale.set(1,eo,1));
      (u.stalks||[]).forEach((st,i)=>{
        st.rotation.x=0.15+Math.min(0.3,Math.abs(k.speed)/70)-Math.max(-0.2,Math.min(0.25,(k.vy||0)*0.02))+Math.sin(time*7+(k.seed||0)*9+i)*0.05;
      });
      const bs=k.baseScale||1;
      let sx=1,sy=1,sz=1;
      if(boosting){ sx=0.96; sy=0.94; sz=1.1; }
      if(k.hitWall>0.15){ sx=1.12; sy=0.78; sz=0.9; }
      else if((k._landSquash||0)>0.02){
        const ls=k._landSquash;
        sx=1+ls*0.55; sy=1-ls*0.75; sz=1+ls*0.35;
      } else if(!k.grounded){
        const stretch=Math.min(0.14, Math.abs(k.vy||0)*0.014);
        sx=1-stretch*0.4; sy=1+stretch; sz=1-stretch*0.3;
      } else if(k.hopT>0){ sy=1.08; }
      const kk=Math.min(1,12*dt);
      k._sq=k._sq||{x:1,y:1,z:1};
      k._sq.x+=(sx-k._sq.x)*kk; k._sq.y+=(sy-k._sq.y)*kk; k._sq.z+=(sz-k._sq.z)*kk;
      k.mesh.scale.set(bs*k._sq.x,bs*k._sq.y,bs*k._sq.z);
    }

    // efek ban: hanya saat roda menyentuh tanah (k.grounded), mencakup ban depan (fl, fr) & ban belakang (rl, rr)
    const yTire = k.worldY || k.gy || 0;
    const fx=Math.sin(bodyHeading), fz=Math.cos(bodyHeading);
    const rx=-fz, rz=fx; // kanan bodi
    const bsW=k.baseScale||1;
    const fwl={x:k.pos.x+fx*1.05*bsW+rx*1.05*bsW, y:yTire, z:k.pos.z+fz*1.05*bsW+rz*1.05*bsW};
    const fwr={x:k.pos.x+fx*1.05*bsW-rx*1.05*bsW, y:yTire, z:k.pos.z+fz*1.05*bsW-rz*1.05*bsW};
    const rl={x:k.pos.x-fx*1.05*bsW+rx*1.05*bsW, y:yTire, z:k.pos.z-fz*1.05*bsW+rz*1.05*bsW};
    const rr={x:k.pos.x-fx*1.05*bsW-rx*1.05*bsW, y:yTire, z:k.pos.z-fz*1.05*bsW-rz*1.05*bsW};
    const dustC=world.def.dust||0xcccccc;
    const SMK=(BK.Config.smoke==null?1:BK.Config.smoke);
    const bvx=-mvx*k.speed*0.25, bvz=-mvz*k.speed*0.25;
    if(k.grounded&&k.drifting&&k.hopT<=0&&Math.abs(k.speed)>10){
      const bigSlide=Math.abs(k._driftYaw||0)>0.18;
      if(BK.spawnPuff && Math.random()<(bigSlide?0.38:0.15)){
        const sparkC=k.chargeLv===3?0xc26bff:k.chargeLv===2?0xff9f1c:k.chargeLv===1?0x3fb6ff:dustC;
        BK.spawnPuff(Math.random()<0.5?rl:rr, sparkC);
      }
      if(SMK>0 && BK.spawnDust && Math.random()<0.18*SMK){
        BK.spawnDust(k.driftDir>0?rr:rl, dustC, bvx*0.6, bvz*0.6);
      }
      if(BK.spawnSkid){
        k._skidT=(k._skidT||0)+dt;
        if(k._skidT>0.06){ k._skidT=0;
          BK.spawnSkid(fwl.x,fwl.z,moveDir,k.gy||0);
          BK.spawnSkid(fwr.x,fwr.z,moveDir,k.gy||0);
          BK.spawnSkid(rl.x,rl.z,moveDir,k.gy||0);
          BK.spawnSkid(rr.x,rr.z,moveDir,k.gy||0);
        }
      }
    }
    if(k.grounded&&SMK>0&&!k.drifting&&Math.abs(k.speed)>24&&BK.spawnDust&&Math.random()<0.04*SMK)
      BK.spawnDust({x:k.pos.x-fx*1.2,y:yTire,z:k.pos.z-fz*1.2},dustC,bvx,bvz);
    if(k.grounded&&SMK>0&&!spinning&&k.finishTime==null&&inp.gas&&k.speed>=0&&k.speed<8&&BK.spawnDust){
      if(Math.random()<0.25*SMK)BK.spawnDust(Math.random()<0.5?rl:rr,dustC,bvx,bvz);
    }
    if(k.grounded&&!spinning&&inp.brake&&k.speed>20){
      if(BK.spawnPuff&&Math.random()<0.18)BK.spawnPuff(Math.random()<0.5?rl:rr,0xdddddd);
      if(k.isPlayer&&BK.Audio.screech){ k._scrT=(k._scrT||0)-dt; if(k._scrT<=0){k._scrT=0.5;BK.Audio.screech();} }
    }
    if(boosting&&BK.spawnPuff&&Math.random()<0.14){
      let tcol=(k.char&&k.char.boostCol)||0x66ccff;
      if(k.isPlayer&&BK.Save.trailColor){ const tc=BK.Save.trailColor(); if(tc!=null)tcol=tc; }
      BK.spawnPuff({x:k.pos.x-fx*1.4,y:yTire,z:k.pos.z-fz*1.4},tcol);
    }
    return q;
  };

  // --- Fisika Senggolan Antar-Kart (Elastis, Berbobot, Oleng Bodi & Impuls Samping) ---
  BK.resolveKartCollisions = function(racers, world, dt, time){
    if(!racers || racers.length < 2) return;
    const minD = 2.85;
    for(let i=0;i<racers.length;i++)for(let j=i+1;j<racers.length;j++){
      const a=racers[i], b=racers[j];
      if(a.finishTime!=null || b.finishTime!=null) continue;
      if((a._bumpCd||0)>0) a._bumpCd-=dt;
      if((b._bumpCd||0)>0) b._bumpCd-=dt;

      // Abaikan jika beda tinggi di udara terlalu jauh (misal satu sedang terbang tinggi di atas yang lain)
      const yA = a.worldY!=null ? a.worldY : (a.gy||0);
      const yB = b.worldY!=null ? b.worldY : (b.gy||0);
      if(Math.abs(yA - yB) > 2.2) continue;

      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const d2 = dx*dx + dz*dz;
      if(d2 >= minD*minD || d2 < 0.0001) continue;

      const d = Math.sqrt(d2);
      const nx = dx / d, nz = dz / d; // vektor normal dari A ke B
      const overlap = minD - d;

      // Bobot efektif: karakter besar/tahan dinding (wallMul kecil) atau sedang boost punya massa lebih kuat
      let mA = (a.baseScale||1) / Math.max(0.6, a.stat ? a.stat.wallMul : 1);
      let mB = (b.baseScale||1) / Math.max(0.6, b.stat ? b.stat.wallMul : 1);
      if(a.boostTime>0 && b.boostTime<=0) mA *= 1.35;
      else if(b.boostTime>0 && a.boostTime<=0) mB *= 1.35;
      const shareA = mB / (mA + mB), shareB = mA / (mA + mB);

      // Koreksi posisi lembut (60% langsung, sisanya didorong oleh pegas kecepatan _bumpVx/_bumpVz)
      const softPush = overlap * 0.62;
      a.pos.x -= nx * softPush * shareA; a.pos.z -= nz * softPush * shareA;
      b.pos.x += nx * softPush * shareB; b.pos.z += nz * softPush * shareB;

      // Kecepatan gerak aktual masing-masing kart (termasuk arah slide drift & sisa impuls)
      const dirA = a.heading + (a.driftOffset||0), dirB = b.heading + (b.driftOffset||0);
      const avx = Math.sin(dirA)*a.speed + (a._bumpVx||0), avz = Math.cos(dirA)*a.speed + (a._bumpVz||0);
      const bvx = Math.sin(dirB)*b.speed + (b._bumpVx||0), bvz = Math.cos(dirB)*b.speed + (b._bumpVz||0);
      const relN = (bvx - avx)*nx + (bvz - avz)*nz; // < 0 berarti saling mendekat

      // Picu impuls elastis saat saling mendekat atau bersenggolan rapat
      if(relN < 1.5 && ((a._bumpCd||0)<=0 || (b._bumpCd||0)<=0)){
        // Hentikan komponen _bumpV yang masih mengarah masuk ke lawan sebelum memantul
        const inA = (a._bumpVx||0)*nx + (a._bumpVz||0)*nz;
        if(inA > 0){ a._bumpVx -= nx*inA; a._bumpVz -= nz*inA; }
        const inB = (b._bumpVx||0)*nx + (b._bumpVz||0)*nz;
        if(inB < 0){ b._bumpVx -= nx*inB; b._bumpVz -= nz*inB; }

        const vClose = Math.max(0, -relN);
        const imp = Math.min(16.0, Math.max(7.5, vClose * 1.35 + overlap * 5.5));
        a._bumpVx = Math.max(-16, Math.min(16, (a._bumpVx||0) - nx * imp * shareA));
        a._bumpVz = Math.max(-16, Math.min(16, (a._bumpVz||0) - nz * imp * shareA));
        b._bumpVx = Math.max(-16, Math.min(16, (b._bumpVx||0) + nx * imp * shareB));
        b._bumpVz = Math.max(-16, Math.min(16, (b._bumpVz||0) + nz * imp * shareB));

        const fxA = Math.sin(a.heading), fzA = Math.cos(a.heading), rxA = -fzA, rzA = fxA;
        const fxB = Math.sin(b.heading), fzB = Math.cos(b.heading), rxB = -fzB, rzB = fxB;
        const fwdDot = nx*fxA + nz*fzA;
        const sideA  = nx*rxA + nz*rzA;
        const sideB  = nx*rxB + nz*rzB;

        // Transfer laju depan-belakang (sundul belakang = yang depan terdorong maju, yang belakang sedikit tertahan)
        if(fwdDot > 0.42 && a.speed > b.speed){
          const dv = Math.min(3.6, (a.speed - b.speed)*0.34);
          b.speed += dv * shareB * 1.3;
          a.speed *= (1 - 0.09 * shareA);
        } else if(fwdDot < -0.42 && b.speed > a.speed){
          const dv = Math.min(3.6, (b.speed - a.speed)*0.34);
          a.speed += dv * shareA * 1.3;
          b.speed *= (1 - 0.09 * shareB);
        } else {
          // Senggolan samping (side-by-side): sedikit gesekan kecepatan
          a.speed *= (1 - 0.04 * shareA);
          b.speed *= (1 - 0.04 * shareB);
        }

        // Guncangan pegas bodi samping (_rollV), suspensi vertikal (_suspV), dan sedikit belokan moncong
        const rollKick = Math.min(4.5, imp * 0.38);
        const sDirA = Math.abs(sideA) > 0.15 ? sideA : 0.45;
        const sDirB = Math.abs(sideB) > 0.15 ? sideB : 0.45;
        a._rollV = (a._rollV||0) + sDirA * rollKick * shareA;
        b._rollV = (b._rollV||0) - sDirB * rollKick * shareB;
        a._suspV = (a._suspV||0) - 2.3 * shareA;
        b._suspV = (b._suspV||0) - 2.3 * shareB;
        if(!a.drifting) a.heading += sideA * 0.065 * shareA;
        if(!b.drifting) b.heading -= sideB * 0.065 * shareB;

        a._bumpCd = 0.22; b._bumpCd = 0.22;
        a.hitWall = Math.max(a.hitWall||0, 0.24);
        b.hitWall = Math.max(b.hitWall||0, 0.24);

        // Percikan bunga api di titik kontak senggolan
        if(BK.spawnBurst){
          const mx = (a.pos.x + b.pos.x)*0.5, my = (yA + yB)*0.5 + 0.55, mz = (a.pos.z + b.pos.z)*0.5;
          BK.spawnBurst({x:mx, y:my, z:mz}, 0xffcc44, 6, 0.24);
        }
        if((a.isPlayer || b.isPlayer) && BK.Audio && BK.Audio.thud && (a._bumpSnd||0) <= (time||0)){
          a._bumpSnd = b._bumpSnd = (time||0) + 0.38;
          BK.Audio.thud();
          if(imp > 10.5 && BK.shake) BK.shake(0.18);
        }
        // Tandai ikon marah 💢 pada kart yang kalah dorong / lebih pelan
        (mA*Math.abs(a.speed) < mB*Math.abs(b.speed) ? a : b)._bumped = time || 0;
      }
    }
  };
})();
