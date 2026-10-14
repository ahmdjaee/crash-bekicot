/* Game orchestrator: loop 60Hz, countdown, posisi, lap, finish */
(function(){
  BK.touch={left:false,right:false,drift:false,brake:false,itemPressed:false};
  // auto-gas hanya untuk layar sentuh asli (HP/tablet), bukan laptop touchscreen
  const IS_COARSE = window.matchMedia ? matchMedia('(pointer:coarse)').matches : ('ontouchstart' in window);
  let renderer,scene,camera,world,racers=[],player=null;
  let state='menu', paused=false, time=0, countdownT=0, cdStep=-1;
  let keys={}, acc=0, lastT=0, lapStart=0, playerBest=null, newRecord=false;
  let cfg=BK.Config, sel={trackId:'pantai',diff:'normal',charId:'turbo'};
  const STEP=1/60;

  function setupRenderer(){
    const cv=document.getElementById('game');
    renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true});
    renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
    renderer.setSize(innerWidth,innerHeight);
    renderer.shadowMap.enabled=false;
    scene=new THREE.Scene();
    camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.5,800);
    camera.position.set(0,4,-10);
    BK.initCamera(camera);
    BK.initParticles(scene);
    addEventListener('resize',()=>{
      camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(innerWidth,innerHeight);
    });
  }

  function clearScene(){
    if(!scene) return;
    // buang semua kecuali kamera light? paling gampang: buat scene baru
    scene.traverse(o=>{ if(o.geometry)o.geometry.dispose&&o.geometry.dispose(); });
    scene=new THREE.Scene();
    BK.initParticles(scene);
  }

  function startRace(forcedTrackId){
    sel=BK.getSelection();
    const def=BK.Tracks.find(t=>t.id===(forcedTrackId||sel.trackId))||BK.Tracks[0];
    const diff=cfg.difficulties[sel.diff]||cfg.difficulties.normal;
    clearScene();
    // cahaya perlu dibuat ulang karena scene baru
    world=BK.buildWorld(scene,def);
    BK.Items.reset(scene,world);

    const names=['Kamu','Reggie','Coco','Dingo'];
    // pemain pakai karakter pilihan; AI pakai sisanya + 1 acak (Juara hanya jika terbuka)
    const keyOpen=BK.Save.hasBossKey();
    const others=BK.Characters.map(c=>c.id).filter(id=>id!==sel.charId&&(!BK.charById(id).locked||keyOpen));
    while(others.length<3) others.push(others[Math.floor(Math.random()*others.length)]);
    const picks=[sel.charId, others[0], others[1], others[2]];
    racers=[];
    for(let i=0;i<4;i++){
      const k=BK.createKart(scene,picks[i],i===0);
      BK.placeOnStart(k,world,i);
      k.name=(i===0?'Kamu':' '+names[i]).trim()+' '+k.char.icon;
      // stagger progress biar grid benar: depan = progress lebih besar
      k.progress=-i*3;
      racers.push(k);
    }
    player=racers[0]; BK.playerKart=player;
    BK.seedAI(racers);
    // ikon marah 💢 di atas kart yang tersenggol (tahap 3)
    racers.forEach(k=>{
      if(!BK._angerTex){
        const c=document.createElement('canvas'); c.width=c.height=64;
        const g=c.getContext('2d'); g.font='52px serif'; g.textAlign='center'; g.fillText('💢',32,50);
        BK._angerTex=new THREE.CanvasTexture(c);
      }
      const s=new THREE.Sprite(new THREE.SpriteMaterial({map:BK._angerTex,transparent:true,depthTest:false}));
      s.scale.set(1.6,1.6,1); s.visible=false; scene.add(s); k._anger=s;
    });
    if(BK.Save.getShop().hat)BK.attachHat(player);
    playerBest=null; newRecord=false; time=0; lapStart=0;
    BK.refreshItemHUD();

    BK.hide('menu'); BK.hide('result'); BK.hide('pause'); BK.hide('help');
    BK.show('hud'); BK.show('countdown');
    document.getElementById('minimap').style.display='block';
    if(BK.setWrongWay)BK.setWrongWay(false);
    BK._entering=false; BK.bossRace=false;
    BK._finalMusic=false; if(BK.Music)BK.Music.play('race');
    state='countdown'; paused=false; countdownT=3.6; cdStep=4;
    document.getElementById('hud-msg').style.opacity=0;
  }
  BK.bossRace=false;
  BK.restartRace=startRace;
  BK.startBossRace=function(){
    sel=BK.getSelection();
    const def=BK.Tracks.find(t=>t.id==='kawah');
    const diff=cfg.difficulties[sel.diff]||cfg.difficulties.normal;
    clearScene();
    world=BK.buildWorld(scene,def);
    BK.Items.reset(scene,world);
    racers=[];
    const p=BK.createKart(scene,sel.charId,true);
    BK.placeOnStart(p,world,0); p.name='Kamu '+p.char.icon; p.progress=0;
    const c=BK.createKart(scene,'juara',false);
    BK.placeOnStart(c,world,1); c.name='Juara 👑'; c.progress=-3; c._boss=true;
    racers=[p,c];
    player=racers[0]; BK.playerKart=player;
    if(BK.Save.getShop().hat)BK.attachHat(player);
    BK.seedAI(racers);
    playerBest=null; newRecord=false; time=0; lapStart=0;
    BK.refreshItemHUD();
    BK.hide('menu'); BK.hide('result'); BK.hide('pause'); BK.hide('help');
    BK.show('hud'); BK.show('countdown');
    document.getElementById('minimap').style.display='block';
    if(BK.setWrongWay)BK.setWrongWay(false);
    BK._entering=false; BK.bossRace=true;
    BK._finalMusic=false; if(BK.Music)BK.Music.play('race');
    state='countdown'; paused=false; countdownT=3.6; cdStep=4;
    document.getElementById('hud-msg').style.opacity=0;
  };
  function enterBossRace(){
    if(BK._entering) return; BK._entering=true;
    const bd=world.bossDoor;
    BK.hubOrigin={x:bd.x,z:bd.z+14};
    const f=document.getElementById('fade');
    if(f){ f.style.opacity=1; }
    BK.Audio.item();
    setTimeout(()=>{ BK.startBossRace(); const f2=document.getElementById('fade'); if(f2)f2.style.opacity=0; },450);
  }

  /* MODE JELAJAH: hub open-world mini */
  BK.hubOrigin=null;
  BK.startRoam=function(exitPortal){
    sel=BK.getSelection();
    clearScene();
    world=BK.buildHub(scene);
    BK.Items.reset(scene,world);
    player=BK.createKart(scene,sel.charId,true);
    player.name='Kamu '+player.char.icon;
    if(exitPortal){
      const a=Math.atan2(exitPortal.x,exitPortal.z);
      player.pos.set(exitPortal.x-Math.sin(a)*11,0,exitPortal.z-Math.cos(a)*11);
      player.heading=a+Math.PI;
    } else {
      player.pos.copy(world.startPos); player.heading=world.startHeading;
    }
    player.lastIdx=0; player.lap=1;
    player.mesh.position.copy(player.pos); player.mesh.rotation.y=player.heading;
    racers=[player]; BK.playerKart=player;
    player.gy=world.startPos.y;
    if(BK.Save.getShop().hat)BK.attachHat(player);
    time=0;
    BK.hide('menu'); BK.hide('result'); BK.hide('pause'); BK.hide('help');
    BK.show('hud'); BK.hide('countdown');
    document.getElementById('minimap').style.display='block';
    if(BK.setWrongWay)BK.setWrongWay(false);
    document.getElementById('hud-item-icon').textContent='?';
    state='roam'; paused=false;
    if(BK.Music)BK.Music.play('hub');
    BK.flashMsg('CARI PORTAL BALAPAN! 🏁');
  };
  BK.returnToHub=function(){
    const p=BK.hubOrigin;
    BK.hubOrigin=null;
    BK.startRoam(p);
  };
  function enterRaceFromHub(portal){
    if(BK._entering) return; BK._entering=true;
    BK.hubOrigin={x:portal.x,z:portal.z};
    const f=document.getElementById('fade');
    if(f){ f.style.opacity=1; }
    BK.Audio.item();
    setTimeout(()=>{ startRace(portal.trackId); const f2=document.getElementById('fade'); if(f2)f2.style.opacity=0; },450);
  }
  function roamStep(dt){
    time+=dt;
    const inp=playerInput();
    BK.updateKart(player,world,inp,dt,time);
    BK.Items.tryPickup(player,world);
    if(keys.KeyE||keys.Enter||keys.KeyF||BK.touch.itemPressed){
      BK.Items.use(player,[player]);
      keys.KeyE=keys.Enter=keys.KeyF=false; BK.touch.itemPressed=false;
    }
    // portal balapan? (cek kunci trofi progresif)
    for(const p of world.portals){
      const dx=player.pos.x-p.x, dz=player.pos.z-p.z;
      if(dx*dx+dz*dz<p.r*p.r){
        if(p.locked){
          p._lockT=(p._lockT||0)-dt;
          if(p._lockT<=0){ p._lockT=2.5; BK.flashMsg('🔒 '+p.lockMsg); BK.Audio.hit(); }
          const d=Math.sqrt(dx*dx+dz*dz)||1; // dorong balik lembut
          player.pos.x=p.x+dx/d*p.r; player.pos.z=p.z+dz/d*p.r;
        } else { enterRaceFromHub(p); break; }
      }
    }
    // kolam: cipratan + lambat (aturan objek hidup)
    for(const s of world.shallows||[]){
      const dx=player.pos.x-s.x, dz=player.pos.z-s.z;
      if(dx*dx+dz*dz<s.r*s.r){
        player.speed*=(1-0.8*dt);
        if(BK.spawnDust&&Math.random()<0.3)BK.spawnDust(player.pos,0x9fd4e8,0,0);
        player._spl=(player._spl||0)-dt;
        if(player._spl<=0){ player._spl=1.0; BK.Audio.pickup(); }
      }
    }
    if(world.bossDoor){
      const bd=world.bossDoor;
      const dx=player.pos.x-bd.x, dz=player.pos.z-bd.z;
      if(dx*dx+dz*dz<100){
        const w=BK.Save.totalWins();
        if(BK.Save.hasBossKey()){ enterBossRace(); }
        else if(w>=4){ enterBossRace(); }
        else {
          bd._t=(bd._t||0)-dt;
          if(bd._t<=0){ bd._t=3; BK.flashMsg('🔒 PINTU BOS — BUTUH 4 TROFI! ('+w+'/4)'); BK.Audio.hit(); }
          const d=Math.sqrt(dx*dx+dz*dz)||1;
          player.pos.x=bd.x+dx/d*10; player.pos.z=bd.z+dz/d*10;
        }
      }
    }
    // --- D1 sapa NPC + dorongan lembut (tidak bisa ditembus, tanpa melambat) ---
    for(const n of world.npcs||[]){
      const dx=player.pos.x-n.mesh.position.x, dz=player.pos.z-n.mesh.position.z;
      const d2=dx*dx+dz*dz;
      if(n.cd<=0&&d2<25){
        n.cd=6; BK.flashMsg('🐌 '+n.lines[n.li%n.lines.length]); n.li++;
        BK.Audio.pickup();
      }
      if(d2<6.25&&d2>0.0001){
        const d=Math.sqrt(d2);
        player.pos.x=n.mesh.position.x+dx/d*2.5;
        player.pos.z=n.mesh.position.z+dz/d*2.5;
      }
    }
    world.update(dt,time);
    BK.updateParticles(dt);
    BK.updateCamera(camera,player,dt);
    document.getElementById('hud-lap').textContent='🗺️ JELAJAH';
    document.getElementById('hud-pos').textContent='🏆 '+BK.Save.totalWins();
    document.getElementById('hud-time').textContent=BK.Save.fmt(time);
    const fill=document.getElementById('boost-fill');
    if(player.drifting){
      const D=BK.Config.drift;
      fill.style.width=Math.min(100,player.charge/D.chargeT3*100)+'%';
      fill.style.background=player.chargeLv===3?'#c26bff':player.chargeLv===2?'#ff9f1c':'#3fb6ff';
      document.getElementById('boost-label').textContent=player.chargeLv>0?'LEPAS!':'DRIFT…';
    } else if(player.boostTime>0){
      fill.style.width=(player.boostTime/1.9*100)+'%'; fill.style.background='#ffd23f';
      document.getElementById('boost-label').textContent='BOOST!';
    } else { fill.style.width='0%'; document.getElementById('boost-label').textContent='JELAJAH BEBAS'; }
    BK.Audio.engine(Math.min(1,Math.abs(player.speed)/cfg.player.topSpeed),player.drifting,player.boostTime>0);
  }

  BK.attachHat=function(kart){
    if(!kart||kart._hat) return;
    const hat=new THREE.Mesh(new THREE.ConeGeometry(0.32,0.55,8),
      new THREE.MeshLambertMaterial({color:0x2e8b47}));
    hat.position.set(0,1.78,1.15); hat.rotation.z=0.15;
    kart.mesh.add(hat); kart._hat=hat;
  };
  BK.togglePause=function(force){
    if(state!=='racing') return;
    paused = force!==undefined?force:!paused;
    paused?BK.show('pause'):BK.hide('pause');
    BK.Audio.engineOff();
  };

  function playerInput(){
    const l=keys.ArrowLeft||keys.KeyA||BK.touch.left;
    const r=keys.ArrowRight||keys.KeyD||BK.touch.right;
    const gas=keys.ArrowUp||keys.KeyW||IS_COARSE; // HP: gas otomatis
    const brake=keys.ArrowDown||keys.KeyS||BK.touch.brake;
    const drift=keys.Space||keys.ShiftLeft||keys.ShiftRight||BK.touch.drift;
    return {steer:(r?1:0)-(l?1:0), gas:!!gas, brake:!!brake, drift:!!drift};
  }

  function updatePositions(){
    const sorted=[...racers].sort((a,b)=>{
      const af=a.finishTime!=null, bf=b.finishTime!=null;
      if(af&&bf) return a.finishTime-b.finishTime;
      if(af) return -1; if(bf) return 1;
      return b.progress-a.progress;
    });
    sorted.forEach((k,i)=>k.place=i+1);
    return sorted;
  }

  function step(dt){
    time+=dt;
    const diff=cfg.difficulties[sel.diff];
    // pemain: gas/rem biasa; setelah finish: victory cruise otomatis
    const pinp=playerInput();
    if(player.finishTime==null) BK.updateKart(player,world,pinp,dt,time);
    else BK.updateAI(player,world,{aiTop:BK.Config.player.topSpeed*(player.stat?player.stat.topMul:1)*0.6,aiAccel:0,rubber:0,missileChance:0},player.progress+1,dt);
    BK.Items.tryPickup(player,world);
    if(keys.KeyE||keys.Enter||keys.KeyF||BK.touch.itemPressed){
      BK.Items.use(player,racers);
      keys.KeyE=keys.Enter=keys.KeyF=false; BK.touch.itemPressed=false;
    }
    // AI
    for(let i=1;i<racers.length;i++){
      const k=racers[i];
      if(k.finishTime!=null) continue;
      const kcfg=k._boss?Object.assign({},diff,{aiTop:36,rubber:10,errMul:0}):diff;
      BK.updateAI(k,world,kcfg,player.progress,dt);
      BK.Items.tryPickup(k,world);
    }
    // B. senggolan antar-kart (lingkaran, arcade): dorong + transfer laju
    for(let i=0;i<racers.length;i++)for(let j=i+1;j<racers.length;j++){
      const a=racers[i], b=racers[j];
      if(a.finishTime!=null||b.finishTime!=null) continue;
      a._bumpCd=(a._bumpCd||0)-dt; b._bumpCd=(b._bumpCd||0)-dt;
      const dx=b.pos.x-a.pos.x, dz=b.pos.z-a.pos.z;
      const d=Math.hypot(dx,dz), minD=3.0;
      if(d<minD&&d>0.01){
        const nx=dx/d, nz=dz/d, push=(minD-d)/2;
        a.pos.x-=nx*push; a.pos.z-=nz*push;
        b.pos.x+=nx*push; b.pos.z+=nz*push;
        // yang menabrak dari belakang (-15%), yang ditabrak kedorong (+10%)
        const avx=Math.sin(a.heading)*a.speed, avz=Math.cos(a.heading)*a.speed;
        const bvx=Math.sin(b.heading)*b.speed, bvz=Math.cos(b.heading)*b.speed;
        const rel=(bvx-avx)*nx+(bvz-avz)*nz; // <0 = mendekat
        if(rel<-2){
          a.speed*=0.92; b.speed=Math.min(b.speed*1.0+2, b.speed+2);
          a._bumpCd=0.5; b._bumpCd=0.5;
          a.spinTime=Math.max(a.spinTime,0); // tanpa spin, cuma oleng visual
          a.hitWall=Math.max(a.hitWall,0.25); b.hitWall=Math.max(b.hitWall,0.25);
          if((a.isPlayer||b.isPlayer)&&BK.Audio.thud&&(a._bumpSnd||0)<=time){
            a._bumpSnd=b._bumpSnd=time+0.8; BK.Audio.thud();
          }
          // korban marah: yang lebih pelan ditandai untuk 💢 (tahap 3)
          (Math.abs(a.speed)<Math.abs(b.speed)?a:b)._bumped=time;
        }
      }
    }
    // deteksi salah arah (tahan 0,7 dtk biar drift sesaat tidak memicu)
    if(player.finishTime==null && Math.abs(player.speed)>6){
      const md=player.heading+player.driftOffset;
      const tg=world.tangents[player.lastIdx];
      const align=Math.sin(md)*tg.x+Math.cos(md)*tg.z;
      if(align<-0.25) player._wwT=(player._wwT||0)+dt; else player._wwT=0;
      const ww=player._wwT>0.7;
      if(ww!==!!player._ww){ player._ww=ww; if(BK.setWrongWay)BK.setWrongWay(ww); }
      if(ww){ player._wwSnd=(player._wwSnd||0)-dt;
        if(player._wwSnd<=0){ player._wwSnd=1.6; if(BK.Audio.wrong)BK.Audio.wrong(); } }
    } else if(player._ww){ player._ww=false; player._wwT=0; if(BK.setWrongWay)BK.setWrongWay(false); }
    BK.Items.update(dt,racers);
    // anti-macet: diam >1.5 dtk -> respawn di tengah trek searah laju
    racers.forEach(k=>{
      if(k.finishTime!=null) return;
      if(Math.abs(k.speed)<3) k._stuckT=(k._stuckT||0)+dt; else k._stuckT=0;
      if(k._stuckT>1.5){
        k._stuckT=0; k._respawns=(k._respawns||0)+1;
        const p=world.pts[k.lastIdx], tg=world.tangents[k.lastIdx];
        k.pos.set(p.x,0,p.z); k.heading=Math.atan2(tg.x,tg.z);
        k.speed=0; k.driftOffset=0; k.drifting=false; k.spinTime=0; k.boostTime=0;
        if(k.isPlayer){ BK.flashMsg('KEMBALI KE TREK!'); BK.shake(0.3); }
        else if(BK.spawnBurst) BK.spawnBurst(k.pos,0xffffff,8);
      }
    });
    world.update(dt,time);
    BK.updateParticles(dt);
    BK.updateCamera(camera,player,dt);

    // lap pemain
    const curLap=Math.min(player.lap,cfg.laps);
    // deteksi lap baru via _lapFlag
    if(player._shownLap!==curLap){
      player._shownLap=curLap;
      if(curLap===cfg.laps&&!BK._finalMusic&&player.finishTime==null){
        BK._finalMusic=true; if(BK.Music)BK.Music.play('final');
        BK.flashMsg('LAP TERAKHIR!');
      }
      if(curLap>1||time-lapStart>5){
        const lapTime=time-lapStart; lapStart=time;
        if(playerBest==null||lapTime<playerBest){
          const isFirst=playerBest==null;
          playerBest=lapTime;
          if(!isFirst) BK.flashMsg('LAP TERCEPAT! '+BK.Save.fmt(lapTime));
        }
      }
    }
    // finish
    racers.forEach(k=>{
      if(k.finishTime==null&&k.lap>cfg.laps){
        k.finishTime=time;
        if(k.isPlayer){
          BK.flashMsg('FINISH!');
          BK.party&&BK.party(true); // confetti + fanfare
          k._partyT=2.4; k._fwT=0;  // kembang api 3D susulan
          const bestPrev=BK.Save.getBest(world.def.id);
          if(playerBest&&(bestPrev==null||playerBest<bestPrev)){
            BK.Save.setBest(world.def.id,playerBest); newRecord=true;
          }
          BK.Save.addWin(world.def.id);
        }
      }
    });
    // kembang api 3D di sekitar pemain
    if(player._partyT>0){
      player._partyT-=dt; player._fwT-=dt;
      if(player._fwT<=0){ player._fwT=0.35;
        const a=Math.random()*Math.PI*2, r=6+Math.random()*8;
        const cols=[0xffd23f,0xff5a5a,0x3fb6ff,0x7CFC00,0xc26bff,0xffffff];
        if(BK.spawnBurst)BK.spawnBurst({x:player.pos.x+Math.sin(a)*r,z:player.pos.z+Math.cos(a)*r},cols[(Math.random()*cols.length)|0],16);
        if(BK.Audio.pop)BK.Audio.pop();
      }
    }
    // slipstream: tempel belakang lawan 2 dtk = mini-boost
    let draft=null;
    if(player.finishTime==null&&player.boostTime<=0&&player.speed>15){
      racers.forEach(r=>{
        if(r===player||r.finishTime!=null)return;
        const gap=r.progress-player.progress;
        if(gap>3&&gap<22){
          const dx=r.pos.x-player.pos.x, dz=r.pos.z-player.pos.z;
          const d=Math.hypot(dx,dz);
          if(d<12&&d>0.1){
            const fx=Math.sin(player.heading), fz=Math.cos(player.heading);
            if((dx*fx+dz*fz)/d>0.7) draft=r;
          }
        }
      });
    }
    if(draft){
      player._draftT=(player._draftT||0)+dt;
      if(player._draftT>2){ player._draftT=0; player.boostTime=0.8; player.boostPower=16; BK.flashMsg('SLIPSTREAM!'); BK.Audio.boost(); }
    } else player._draftT=0;
    // ikon 💢 mengikuti kart yang baru tersenggol
    racers.forEach(k=>{
      if(!k._anger) return;
      const show=(time-(k._bumped||-9))<1.2;
      k._anger.visible=show;
      if(show)k._anger.position.set(k.pos.x,(k.gy||0)+3.4,k.pos.z);
    });
    const order=updatePositions();
    BK.updateHUD({player,time});
    // audio mesin
    BK.Audio.engine(Math.min(1,Math.abs(player.speed)/cfg.player.topSpeed),player.drifting,player.boostTime>0);

    // maksimal 2,5 dtk perayaan setelah pemain finish, lalu hasil langsung
    const allDone=racers.every(k=>k.finishTime!=null);
    const pDone=player.finishTime!=null && (time-player.finishTime>2.5);
    if(player.finishTime!=null&&!allDone&&(time-player.finishTime>2.5)){
      racers.forEach(k=>{ if(k.finishTime==null){ k.finishTime=time; k._cut=true; } });
    }
    if(allDone||pDone){
      finishRace(updatePositions());
    }
  }

  function finishRace(order){
    state='done';
    BK.Audio.engineOff();
    document.getElementById('minimap').style.display='none';
    if(BK.setWrongWay)BK.setWrongWay(false);
    const lead=order[0].progress;
    const rows=order.map(k=>({
      name:k.name+(k.isPlayer?' (kamu)':''),
      time:k._cut?null:k.finishTime,
      gap:k._cut?Math.max(1,Math.round((lead-k.progress)*world.trackLen/world.N)):null,
      isPlayer:k.isPlayer}));
    const won=order[0].isPlayer;
    if(BK.Music)BK.Music.play('finish');
    if(BK.bossRace&&won&&!BK.Save.hasBossKey()){
      BK.Save.setBossKey();
      rows.push({note:'🔑 KUNCI BOS DIDAPAT! Karakter Juara terbuka!',isPlayer:true});
    }
    BK.refreshBest();
    BK.showResult(rows,won,newRecord);
    BK.hide('countdown');
  }

  function loop(t){
    requestAnimationFrame(loop);
    if(!lastT)lastT=t;
    let dt=(t-lastT)/1000; lastT=t;
    if(dt>0.25)dt=0.25;
    if(state==='countdown'){
      countdownT-=dt;
      const n=Math.ceil(countdownT-0.6);
      const el=document.getElementById('countdown');
      if(countdownT<=0.6){
        el.textContent='GO!';
        if(cdStep!==0){cdStep=0;BK.Audio.count(0);
          if(world.setStartLights) world.setStartLights(0);
          if(world.notifyGo) world.notifyGo();
          // start boost: gas ditahan pas GO
          const inp=playerInput();
          if(inp.gas){player.boostTime=0.9;player.boostPower=18;BK.flashMsg('START BOOST!');}
          lapStart=0;
        }
        if(countdownT<=0){ BK.hide('countdown'); state='racing'; }
      } else if(n!==cdStep&&n>=1&&n<=3){ cdStep=n; el.textContent=n; BK.Audio.count(n);
        if(world.setStartLights) world.setStartLights(n); }
      // kamera tetap update biar hidup
      BK.updateCamera(camera,player,dt);
      world.update(dt,performance.now()/1000);
      renderer.render(scene,camera);
      return;
    }
    if((state==='racing'&&!paused)||state==='roam'){
      acc+=dt;
      let n=0;
      while(acc>=STEP&&n<5){
        if(state==='roam')roamStep(STEP); else step(STEP);
        acc-=STEP; n++;
        if(state!=='racing'&&state!=='roam')break;
      }
      // minimap tiap frame genap
      if(state==='roam')BK.drawMinimap(world,[player]); else BK.drawMinimap(world,racers);
      renderer.render(scene,camera);
    } else if(state==='done'||state==='menu'){
      if(BK.tickPreview)BK.tickPreview(dt);
      if(scene&&world){ BK.updateCamera(camera,player||racers[0]||{pos:new THREE.Vector3(),heading:0,driftOffset:0,boostTime:0,speed:0,hopT:0},dt); renderer.render(scene,camera); }
      else if(scene) renderer.render(scene,camera);
    } else if(paused){
      renderer.render(scene,camera);
    }
  }

  // input
  addEventListener('keydown',e=>{
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
    keys[e.code]=true;
    BK.Audio.unlock();
    if(BK.Music)BK.Music.unlock();
    if(e.code==='KeyP'||e.code==='Escape')BK.togglePause();
    if(e.code==='KeyM'&&BK.Music){ const m=BK.Music.toggle(); BK.flashMsg(m?'MUSIK MATI':'MUSIK NYALA'); }
    if(e.code==='KeyH'&&(state==='racing'||state==='roam')){
      if(BK.Save.getShop().horn&&BK.Audio.horn)BK.Audio.horn();
    }
    if(state==='menu'&&(e.code==='ArrowLeft'||e.code==='ArrowRight')){ if(BK.charStep)BK.charStep(e.code==='ArrowRight'?1:-1); }
    if(e.code==='KeyR'){
      if(state==='roam'&&world.isHub){ player.pos.copy(world.startPos); player.heading=world.startHeading; player.speed=0; }
      else if(state==='racing'||state==='done') startRace();
    }
  });
  addEventListener('keyup',e=>{keys[e.code]=false;});
  addEventListener('pointerdown',()=>{ BK.Audio.unlock(); if(BK.Music)BK.Music.unlock(); });

  BK.init=function(){
    setupRenderer();
    BK.initUI(()=>startRace());
    // demo background: trek pantai tanpa balapan
    const def=BK.Tracks[0];
    world=BK.buildWorld(scene,def);
    const k=BK.createKart(scene,'turbo',true);
    BK.placeOnStart(k,world,0); player=k; racers=[k]; BK.playerKart=k;
    camera.position.set(k.pos.x-10,6,k.pos.z-10);
    state='menu';
    if(BK.Music)BK.Music.autoplay();
    requestAnimationFrame(loop);
  };
  document.addEventListener('DOMContentLoaded',BK.init);
})();
