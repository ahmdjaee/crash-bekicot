/* AI: kepribadian + garis balap + rubber-band + kesalahan manusiawi */
(function(){
  BK.AI_PROFILES = {
    Reggie:{aggr:1,   def:0,   itemWait:0.7, err:0.05},
    Coco:  {aggr:0,   def:1,   itemWait:2.2, err:0.03},
    Dingo: {aggr:0.4, def:0.3, itemWait:1.6, err:0.07},
    Juara: {aggr:1,   def:0.5, itemWait:0.5, err:0}
  };
  BK.aiProfile=function(k){
    const n=(k.name||'').split(' ')[0];
    return BK.AI_PROFILES[n]||{aggr:0.3,def:0.3,itemWait:1.5,err:0.05};
  };

  BK.updateAI = function(k, world, cfg, playerProgress, dt){
    const N=world.N;
    const prof=BK.aiProfile(k);
    // start acak (tidak serempak robotik)
    if(k._startDelay>0){
      k._startDelay-=dt;
      BK.updateKart(k, world, {steer:0,gas:false,brake:true,drift:false}, dt, performance.now()/1000);
      return {steer:0,gas:false,brake:true,drift:false};
    }
    // tikungan tajam di depan: lihat lebih dekat agar tidak motong ke dinding dalam
    const t0=world.tangents[k.lastIdx], tH=world.tangents[(k.lastIdx+14)%N];
    const curveAhead=Math.abs(t0.x*tH.z-t0.z*tH.x);
    let look = 8 + Math.abs(k.speed)*0.55;
    if(curveAhead>0.3) look=Math.min(look, 10);
    // menempel dinding: bidik titik terdekat dulu, lepas dulu baru balap lagi
    const nearWall = Math.abs(k.lateral)>world.half-2.5;
    const ti=Math.floor((k.lastIdx+(nearWall?4:look))%N);
    // garis balap: potong tikungan (offset ke dalam)
    const ahead2=world.pts[(ti+10)%N];
    const cur=world.pts[k.lastIdx];
    // variasi garis per lap + offset kepribadian
    if(k._laneLap!==k.lap){ k._laneLap=k.lap; k._laneVar=(Math.random()-0.5)*2; }
    k.aiLane = k.aiLane||((k.seed||0.5)-0.5)*world.half*0.9;
    const target=world.pts[ti];
    const gap0=playerProgress-k.progress;
    // Coco bertahan: di depan pemain saat tikungan → ambil sisi dalam
    let inside=0;
    const tA=world.tangents[k.lastIdx], tB=world.tangents[(k.lastIdx+10)%N];
    const turnSign=(tA.x*tB.z-tA.z*tB.x);
    if(prof.def&&gap0<-8&&gap0>-45&&curveAhead>0.22){
      inside=Math.sign(turnSign||0.01)*world.half*0.4;
    }
    const tx=target.x+world.normals[ti].x*(k.aiLane*0.5+(k._laneVar||0)+inside);
    const tz=target.z+world.normals[ti].z*(k.aiLane*0.5+(k._laneVar||0)+inside);
    const dx=tx-k.pos.x, dz=tz-k.pos.z;
    const want=Math.atan2(dx,dz);
    let diff=want-k.heading;
    while(diff>Math.PI)diff-=Math.PI*2;
    while(diff<-Math.PI)diff+=Math.PI*2;
    // steer+ = kanan layar (kamera kejar: belok kanan = heading berkurang)
    let steer=Math.max(-1,Math.min(1,-diff*2.2));
    // kesalahan manusiawi: sesekali lurus di tikungan (nilai per kesulitan via err)
    k._errCd=(k._errCd||0)-dt;
    if(k._errT>0){ k._errT-=dt; steer*=0.25; }
    else if(curveAhead>0.35&&k._errCd<=0&&k.spinTime<=0){
      if(Math.random()<prof.err*cfg.errMul*dt*2){ k._errT=0.7; k._errCd=6; }
    }

    // rem jika tikungan tajam di depan
    const t1=world.tangents[k.lastIdx], t2=world.tangents[(k.lastIdx+14)%N];
    const curve=Math.abs(t1.x*t2.z-t1.z*t2.x); // 0 lurus, ~1 tajam
    const needSlow = curve>0.28 && Math.abs(k.speed)>cfg.aiTop*0.75;

    // rubber-band: kejar pemain kalau tertinggal, tahan kalau jauh di depan
    const gap=playerProgress-k.progress; // + berarti pemain di depan
    let top=cfg.aiTop;
    if(gap>60) top+=cfg.rubber*0.9;
    else if(gap>25) top+=cfg.rubber*0.45;
    else if(gap>8) top+=cfg.rubber*0.25; // duel jarak dekat
    else if(gap<-60) top-=5;
    k._aiTop=top;

    // rem hanya di kecepatan tinggi (jangan ditahan sampai mundur), gas lepas saat ngerem
    const wantBrake = needSlow && k.speed>9;
    // drift gaya pemain bagus: pulse singkat sampai boost biru, jangan ditempel
    k._aiDriftCd=(k._aiDriftCd||0)-dt;
    let wantDrift=false;
    if(k.drifting){
      if(k.charge>=0.75){ wantDrift=false; k._aiDriftCd=1.2+Math.random()*1.5; }
      else wantDrift=true;
    } else if(curve>0.3 && Math.abs(k.speed)>18 && Math.abs(steer)>0.4 &&
              Math.abs(k.lateral)<world.half-3.5 && k._aiDriftCd<=0 && k.spinTime<=0){
      wantDrift=true;
    }
    const inp={steer, gas: !wantBrake && k.speed<top, brake: wantBrake, drift:wantDrift};
    // simpan top override sementara
    const realTop=BK.Config.player.topSpeed;
    // terapkan top AI via clamp kecepatan setelah update: trik — set boost negatif? 
    // cara bersih: update dulu lalu clamp
    BK.updateKart(k, world, inp, dt, performance.now()/1000);
    if(k.speed>top) k.speed+=(top-k.speed)*Math.min(1,3*dt);
    return inp;
  };

  BK.seedAI = function(karts){
    karts.forEach((k,i)=>{ k.seed=Math.random(); k.aiLane=(Math.random()-0.5);
      k._startDelay=k.isPlayer?0:(0.2+Math.random()*0.3); });
  };
})();
