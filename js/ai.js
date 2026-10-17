/* AI: kepribadian agresif & kompetitif + garis balap apex + incar pad/box + senggol lawan + drift multi-tier & air trick */
(function(){
  BK.AI_PROFILES = {
    Reggie:{aggr:1.0,  def:0.45, itemWait:0.45, err:0.025, driftTarget:1.55},
    Coco:  {aggr:0.55, def:1.0,  itemWait:1.05, err:0.015, driftTarget:2.35},
    Dingo: {aggr:0.92, def:0.60, itemWait:0.75, err:0.035, driftTarget:1.50},
    Juara: {aggr:1.15, def:0.95, itemWait:0.35, err:0,     driftTarget:2.42}
  };
  BK.aiProfile=function(k){
    const n=(k.name||'').split(' ')[0];
    return BK.AI_PROFILES[n]||{aggr:0.75,def:0.5,itemWait:0.85,err:0.03,driftTarget:1.55};
  };

  BK.updateAI = function(k, world, cfg, playerProgress, dt, racers){
    const N=world.N;
    const prof=BK.aiProfile(k);
    const aggrMul = cfg.aggrMul != null ? cfg.aggrMul : 1.0;
    // start acak singkat (lebih sigap saat lampu hijau)
    if(k._startDelay>0){
      k._startDelay-=dt;
      BK.updateKart(k, world, {steer:0,gas:false,brake:true,drift:false}, dt, performance.now()/1000);
      return {steer:0,gas:false,brake:true,drift:false};
    }

    // tikungan tajam di depan: lihat lebih dekat agar tidak motong ke dinding dalam
    const t0=world.tangents[k.lastIdx], tH=world.tangents[(k.lastIdx+14)%N];
    const curveAhead=Math.abs(t0.x*tH.z-t0.z*tH.x);
    let look = 7 + Math.abs(k.speed)*0.48;
    if(curveAhead>0.28) look=Math.min(look, 9);
    const nearWall = Math.abs(k.lateral)>world.half-2.4;
    const ti=Math.floor((k.lastIdx+(nearWall?4:look))%N);

    // variasi garis per lap + offset kepribadian
    if(k._laneLap!==k.lap){ k._laneLap=k.lap; k._laneVar=(Math.random()-0.5)*1.6; }
    k.aiLane = k.aiLane||((k.seed||0.5)-0.5)*world.half*0.75;
    const target=world.pts[ti];
    const gap0=playerProgress-k.progress;

    // 1. Garis balap Apex: potong sisi dalam tikungan agar laju menikung jauh lebih kencang
    let laneTarget = k.aiLane*0.45 + (k._laneVar||0)*0.4;
    const tA=world.tangents[k.lastIdx], tB=world.tangents[(k.lastIdx+10)%N];
    const turnSign=(tA.x*tB.z-tA.z*tB.x);
    if(curveAhead>0.18){
      laneTarget = Math.sign(turnSign||0.01)*world.half*0.42;
    }

    // 2. Incar Boost Pad & Item Box di depan bila terjangkau
    if(!nearWall && world.pads){
      for(const p of world.pads){
        const di = (p.idx - k.lastIdx + N) % N;
        if(di >= 3 && di <= 16 && Math.abs(k.lateral) < world.half*0.65){
          laneTarget = 0; // tengah jalan (posisi turbo pad)
          break;
        }
      }
    }
    if(!nearWall && !k.item && !(k.roulette>0) && world.boxes){
      let bestDi=99;
      for(const b of world.boxes){
        if(!b.active) continue;
        const di = (b.idx - k.lastIdx + N) % N;
        if(di >= 3 && di <= 15 && di < bestDi){
          bestDi = di;
          const bLat = (b.mesh.position.x - world.pts[b.idx].x)*world.normals[b.idx].x +
                       (b.mesh.position.z - world.pts[b.idx].z)*world.normals[b.idx].z;
          if(Math.abs(bLat - (k.lateral||0)) < world.half*0.75) laneTarget = bLat;
        }
      }
    }

    // 3. Taktik Agresif: Senggol lawan di samping (Body-Check) & Blokir jalur salip pemain
    if(!nearWall && racers && racers.length > 1){
      for(const r of racers){
        if(r===k || r.finishTime!=null) continue;
        const gapR = r.progress - k.progress;
        // Lawan tepat di samping: AI agresif aktif menyenggol (body-check)
        if(Math.abs(gapR) < 3.5){
          const dR = Math.hypot(r.pos.x - k.pos.x, r.pos.z - k.pos.z);
          if(dR < 6.5 && Math.abs(r.lateral||0) < world.half - 2.2){
            const aggrStrength = Math.min(1, prof.aggr * aggrMul * 0.78);
            laneTarget += ((r.lateral||0) - laneTarget) * aggrStrength;
            break;
          }
        }
        // Pemain hendak menyalip dari belakang: AI defensif menutup jalur dalam/pemain
        if(r.isPlayer && gap0 < -2 && gap0 > -24 && prof.def > 0.35 && curveAhead < 0.25){
          laneTarget += ((r.lateral||0) - laneTarget) * Math.min(0.8, prof.def * aggrMul * 0.65);
        }
      }
    }

    // 4. Hindari genangan minyak di depan
    if(BK.Items && BK.Items.oils && BK.Items.oils.length){
      for(const o of BK.Items.oils){
        const odx = o.mesh.position.x - k.pos.x, odz = o.mesh.position.z - k.pos.z;
        const od2 = odx*odx + odz*odz;
        if(od2 < 18*18){
          const fx = Math.sin(k.heading), fz = Math.cos(k.heading);
          if(odx*fx + odz*fz > 0){
            const oLat = (o.mesh.position.x - world.pts[k.lastIdx].x)*world.normals[k.lastIdx].x +
                         (o.mesh.position.z - world.pts[k.lastIdx].z)*world.normals[k.lastIdx].z;
            if(Math.abs(oLat - laneTarget) < 3.4){
              laneTarget = oLat > 0 ? Math.max(-world.half+2.5, oLat - 4.2) : Math.min(world.half-2.5, oLat + 4.2);
            }
          }
        }
      }
    }

    laneTarget = Math.max(-(world.half-2.2), Math.min(world.half-2.2, laneTarget));
    const tx=target.x+world.normals[ti].x*laneTarget;
    const tz=target.z+world.normals[ti].z*laneTarget;
    const dx=tx-k.pos.x, dz=tz-k.pos.z;
    const want=Math.atan2(dx,dz);
    const curDir=k.heading+(k.driftOffset||0);
    let diff=want-curDir;
    while(diff>Math.PI)diff-=Math.PI*2;
    while(diff<-Math.PI)diff+=Math.PI*2;
    // steer+ = kanan layar (kamera kejar: belok kanan = heading berkurang)
    let steer=Math.max(-1,Math.min(1,-diff*2.4));

    // kesalahan manusiawi: dikurangi pada mode Seru/Ngamuk
    k._errCd=(k._errCd||0)-dt;
    if(k._errT>0){ k._errT-=dt; steer*=0.35; }
    else if(curveAhead>0.38&&k._errCd<=0&&k.spinTime<=0&&(cfg.errMul||0)>0){
      if(Math.random()<prof.err*(cfg.errMul||1)*dt*1.6){ k._errT=0.55; k._errCd=7; }
    }

    // rem hanya jika tikungan sangat tajam & terlalu dekat dinding luar
    const t1=world.tangents[k.lastIdx], t2=world.tangents[(k.lastIdx+14)%N];
    const curve=Math.abs(t1.x*t2.z-t1.z*t2.x);
    const needSlow = curve>0.36 && Math.abs(k.speed)>cfg.aiTop*0.86 && Math.abs(k.lateral)>world.half-3.2;

    // rubber-band kompetitif: terus menekan pemain sepanjang balapan
    const gap=playerProgress-k.progress; // + berarti pemain di depan
    let top=cfg.aiTop;
    if(gap>55) top+=cfg.rubber*0.95;
    else if(gap>22) top+=cfg.rubber*0.58;
    else if(gap>4) top+=cfg.rubber*0.32; // duel rapat agresif
    else if(gap<-75) top-=3.5;
    k._aiTop=top;

    const wantBrake = needSlow && k.speed>12;
    // Drift multi-tier ala pemain pro + Counter-Steer + Mid-Air Trick saat melompat!
    k._aiDriftCd=(k._aiDriftCd||0)-dt;
    let wantDrift=false;
    if(!k.grounded && (k.airY||0)>0.48 && !k._airTricked && k.spinTime<=0){
      // AI melakukan Mid-Air Trick di udara untuk mendapat Trick Boost saat mendarat!
      wantDrift = !(k._prevDriftInp);
    } else if(k.drifting){
      const targetCharge = curve > 0.25 ? (prof.driftTarget||1.55) : 0.78;
      if(k.charge >= targetCharge || nearWall){
        wantDrift=false;
        k._aiDriftCd=0.55+Math.random()*0.75;
      } else {
        wantDrift=true;
        // Counter-steer saat drift untuk mengisi boost meter 1.5x lebih cepat!
        if(k.charge > 0.3 && Math.abs(diff) < 0.32){
          steer = -k.driftDir * 0.45;
        }
      }
    } else if(curve>0.24 && Math.abs(k.speed)>16.5 && Math.abs(steer)>0.32 &&
              Math.abs(k.lateral)<world.half-2.8 && k._aiDriftCd<=0 && k.spinTime<=0){
      wantDrift=true;
    }

    // Saat sedang boost (pad/drift/trick/item), izinkan kecepatan melampaui top normal!
    const effTop = k.boostTime>0 ? top + (k.boostPower||20)*0.88 : top;
    const inp={steer, gas: !wantBrake && k.speed<effTop, brake: wantBrake, drift:wantDrift};
    BK.updateKart(k, world, inp, dt, performance.now()/1000);
    if(k.boostTime<=0 && k.speed>top) k.speed+=(top-k.speed)*Math.min(1,3.2*dt);
    return inp;
  };

  BK.seedAI = function(karts){
    karts.forEach((k,i)=>{ k.seed=Math.random(); k.aiLane=(Math.random()-0.5);
      k._startDelay=k.isPlayer?0:(0.08+Math.random()*0.18); });
  };
})();
