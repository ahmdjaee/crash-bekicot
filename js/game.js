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
    try{
      renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true});
    }catch(e){
      document.body.innerHTML='<div style="color:#fff;font-family:sans-serif;text-align:center;padding:60px 20px"><h1>🐌 Crash Bekicot</h1><p>Browser ini tidak bisa WebGL.<br>Coba Chrome/Firefox terbaru dengan akselerasi grafis menyala.</p></div>';
      throw e;
    }
    renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
    renderer.setSize(innerWidth,innerHeight);
    renderer.shadowMap.enabled=false;
    scene=new THREE.Scene();
    camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.5,1500); // far 1500: kubah(760)+laut(900) tak terpotong
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
    BK.lastTrackId=def.id; BK.lastBoss=false;
    BK._portalTarget=null; BK._bossTarget=null; if(BK.hidePortalPrompt)BK.hidePortalPrompt();
    const diff=cfg.difficulties[sel.diff]||cfg.difficulties.normal;
    clearScene();
    // cahaya perlu dibuat ulang karena scene baru
    world=BK.buildWorld(scene,def);
    BK.Items.reset(scene,world);

    const names=['Kamu','Reggie','Coco','Dingo'];
    // pemain pakai karakter pilihan; AI pakai sisanya yang TIDAK TERKUNCI (Balnok/Krambil/Juara terbuka dulu)
    const others=BK.Characters.filter(c=>c.id!==sel.charId&&BK.charOpen(c)).map(c=>c.id);
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
    // Kamera awal di depan-samping grid, lalu meluncur halus ke belakang kart saat 3-2-1-GO!
    const hx=Math.sin(player.heading), hz=Math.cos(player.heading);
    camera.position.set(player.pos.x+hx*12-hz*5, (player.gy||0)+6.2, player.pos.z+hz*12+hx*5);
    camera.lookAt(player.pos.x, (player.gy||0)+1.2, player.pos.z);
    state='countdown'; paused=false; countdownT=3.8; cdStep=4;
    const hasT=BK.Save.hasTrophy(def.id);
    BK.flashMsg(def.icon+' '+def.name+' — '+(hasT?'Pecahkan Rekor Lap! ⏱':'Rebut Juara 1 = Piala! 🏆'));
  }
  BK.bossRace=false;
  BK.restartRace=startRace;
  // ulangi balapan TERAKHIR (portal/menu sama-sama benar); di pulau = kembali ke spawn
  BK.restartSlot=function(){
    if(state==='roam'&&world&&world.isHub){
      player.pos.copy(world.startPos); player.heading=world.startHeading; player.speed=0;
    }
    else if(BK.lastBoss) BK.startBossRace();
    else if(state==='racing'||state==='done') startRace(BK.lastTrackId);
  };
  BK.startBossRace=function(){
    sel=BK.getSelection();
    const def=BK.Tracks.find(t=>t.id==='kawah');
    BK.lastTrackId=def.id; BK.lastBoss=true;
    BK._portalTarget=null; BK._bossTarget=null; BK._garageTarget=null;
    if(BK.hidePortalPrompt)BK.hidePortalPrompt();
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
    const hx=Math.sin(player.heading), hz=Math.cos(player.heading);
    camera.position.set(player.pos.x+hx*12-hz*5, (player.gy||0)+6.2, player.pos.z+hz*12+hx*5);
    camera.lookAt(player.pos.x, (player.gy||0)+1.2, player.pos.z);
    state='countdown'; paused=false; countdownT=3.8; cdStep=4;
    BK.flashMsg('👑 DUEL RAJA BOS: JUARA — Rebut Kunci Pulau!');
  };
  function enterBossRace(){
    if(BK._entering) return; BK._entering=true;
    BK._portalTarget=null; BK._bossTarget=null; BK._garageTarget=null;
    if(BK.hidePortalPrompt)BK.hidePortalPrompt();
    const bd=world.bossDoor;
    BK.hubOrigin={x:bd.x,z:bd.z+14};
    const f=document.getElementById('fade');
    if(f){ f.style.opacity=1; }
    BK.Audio.warp();
    setTimeout(()=>{ BK.startBossRace(); const f2=document.getElementById('fade'); if(f2)f2.style.opacity=0; },450);
  }

  /* MODE JELAJAH: hub open-world mini */
  BK.hubOrigin=null;
  BK.startRoam=function(exitPortal){
    if(!BK.Config.openworld) return; // katup mode open-world — setel openworld:true di config.js untuk hidupkan lagi
    sel=BK.getSelection();
    BK._entering=false; BK._portalTarget=null; BK._bossTarget=null; BK._garageTarget=null;
    if(BK.hidePortalPrompt)BK.hidePortalPrompt();
    const tcNow=BK.Save.trophyCount(), keyNow=BK.Save.hasBossKey();
    // Jika pulau sudah siap di latar menu (boot awal / dari garasi) dan tidak pindah portal, langsung meluncur tanpa rebuild!
    if(!exitPortal && world && world.isHub && world._builtTrophies===tcNow && world._builtKey===keyNow && player){
      BK.applyChar(sel.charId);
    } else {
      clearScene();
      world=BK.buildHub(scene);
      world._builtTrophies=tcNow; world._builtKey=keyNow;
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
      player.gy=world.heightAt?world.heightAt(player.pos.x,player.pos.z):world.startPos.y;
      player.pos.y=player.gy;
      player.mesh.position.copy(player.pos); player.mesh.rotation.y=player.heading;
      racers=[player]; BK.playerKart=player;
      if(BK.Save.getShop().hat)BK.attachHat(player);
    }
    time=0;
    BK.hide('menu'); BK.hide('result'); BK.hide('pause'); BK.hide('help');
    BK.show('hud'); BK.hide('countdown');
    document.getElementById('minimap').style.display='block';
    if(BK.setWrongWay)BK.setWrongWay(false);
    document.getElementById('hud-item-icon').textContent='?';
    state='roam'; paused=false;
    if(BK.Music)BK.Music.play('hub');
    if(exitPortal && (BK._justWonTrophy || BK._justUnlockedBoss)){
      if(BK.spawnBurst) BK.spawnBurst({x:exitPortal.x,z:exitPortal.z},0xffd23f,24);
    }
    if(BK._justUnlockedBoss){
      BK._justUnlockedBoss=false; BK._justWonTrophy=null; BK._justUnlockedStage=null;
      if(BK.party)BK.party(true);
      if(BK.Audio&&BK.Audio.trophy)BK.Audio.trophy();
      BK.flashMsg('🔥 4 PIALA LENGKAP! Gerbang Bos di Utara Terbuka!');
    } else if(BK._justUnlockedStage){
      const stg=BK._justUnlockedStage; BK._justUnlockedStage=null; BK._justWonTrophy=null;
      if(BK.party)BK.party(false);
      if(BK.Audio&&BK.Audio.trophy)BK.Audio.trophy();
      BK.flashMsg(stg);
    } else if(BK._justWonTrophy){
      const tn=BK._justWonTrophy; BK._justWonTrophy=null;
      BK.flashMsg('🏆 Piala '+tn+' Diraih! ('+tcNow+'/4)');
    } else if(!BK.Save.introSeen()){
      BK.Save.setIntroSeen();
      BK.flashMsg('🧭 Ikuti Panah Emas menuju Portal Balapan! Rebut 4 Piala!');
    } else {
      BK.flashMsg(tcNow>=4?'🔥 Gerbang Bos di Utara Terbuka! Tantang Juara!':'🧭 Ikuti Panah Emas ke Portal Berikutnya ('+tcNow+'/4 Piala)');
    }
  };
  BK.returnToHub=function(){
    if(!BK.Config.openworld){ BK.openMenu&&BK.openMenu(); return; }
    if(BK._entering) return;
    BK._entering=true;
    const p=BK.hubOrigin;
    BK.hubOrigin=null;
    const f=document.getElementById('fade');
    if(f) f.style.opacity=1;
    if(BK.Audio&&BK.Audio.warp) BK.Audio.warp();
    setTimeout(()=>{
      BK.startRoam(p);
      const f2=document.getElementById('fade');
      if(f2) f2.style.opacity=0;
    },380);
  };
  // ketuk prompt / panggil dari UI = setuju masuk portal / bos / garasi
  BK.confirmPortal=function(){
    if(BK._entering) return;
    if(BK._portalTarget){ const p=BK._portalTarget; enterRaceFromHub(p); }
    else if(BK._bossTarget){ enterBossRace(); }
    else if(BK._garageTarget){ if(!BK.Config.openworld) return; BK.openMenu('roam'); }
  };
  // buka menu sebagai layar pengaturan/garasi (dari jeda, garasi pulau, atau hasil)
  BK.openMenu=function(originState){
    BK._menuOrigin = originState || state;
    BK.hide('pause'); BK.hide('result');
    if(BK.hidePortalPrompt)BK.hidePortalPrompt();
    BK.show('menu');
    const b=document.getElementById('btn-back2');
    if(b) b.classList.toggle('hidden', BK._menuOrigin!=='racing' && BK._menuOrigin!=='roam');
    if(BK.refreshBest)BK.refreshBest();
    if(BK.refreshHubStats)BK.refreshHubStats();
    state='menu'; paused=false;
    BK.Audio.engineOff();
  };
  BK.closeMenuBack=function(){
    const b=document.getElementById('btn-back2'); if(b)b.classList.add('hidden');
    BK.hide('menu');
    if(BK._menuOrigin==='roam' && world && world.isHub){
      BK.show('hud');
      document.getElementById('minimap').style.display='block';
      state='roam'; paused=false;
      if(BK.Music)BK.Music.play('hub');
    } else if(BK._menuOrigin==='racing' && world && !world.isHub){
      BK.show('hud'); BK.show('pause');
      document.getElementById('minimap').style.display='block';
      state='racing'; paused=true;
    } else if(BK.Config.openworld){
      BK.startRoam();
    }
  };
  function enterRaceFromHub(portal){
    if(BK._entering) return; BK._entering=true;
    BK._portalTarget=null; BK._bossTarget=null; BK._garageTarget=null;
    if(BK.hidePortalPrompt)BK.hidePortalPrompt();
    BK.hubOrigin={x:portal.x,z:portal.z,trackId:portal.trackId};
    const f=document.getElementById('fade');
    if(f){ f.style.opacity=1; }
    BK.Audio.warp();
    setTimeout(()=>{ startRace(portal.trackId); const f2=document.getElementById('fade'); if(f2)f2.style.opacity=0; },450);
  }
  function roamStep(dt){
    time+=dt;
    const inp=playerInput();
    BK.updateKart(player,world,inp,dt,time);
    BK.Items.tryPickup(player,world);
    if(keys.KeyE||keys.KeyF||BK.touch.itemPressed||(keys.Enter&&!BK._portalTarget&&!BK._bossTarget&&!BK._garageTarget)){
      BK.Items.use(player,[player]);
      keys.KeyE=keys.Enter=keys.KeyF=false; BK.touch.itemPressed=false;
    }
    // portal balapan? dekati = prompt kaya info ala CTR Adventure, Enter = masuk
    let nearPortal=null;
    for(const p of world.portals){
      const dx=player.pos.x-p.x, dz=player.pos.z-p.z;
      if(dx*dx+dz*dz<p.r*p.r){ nearPortal=p; break; }
    }
    if(nearPortal&&nearPortal!==BK._portalTarget){
      BK._portalTarget=nearPortal; BK._bossTarget=null; BK._garageTarget=null;
      if(nearPortal.locked){ BK.hidePortalPrompt(); }
      else if(BK.showPortalPrompt){
        const hasT=BK.Save.hasTrophy(nearPortal.trackId);
        const best=BK.Save.getBest(nearPortal.trackId);
        const tBadge=hasT?'<span style="color:#ffd23f">🏆 Piala Diraih</span>':'<span style="color:#7CFC00">🎯 Rebut Juara 1 = Piala!</span>';
        const bTxt=best!=null?' • ⏱ '+BK.Save.fmt(best):'';
        BK.showPortalPrompt('🏁 '+nearPortal.name+'<br><small>'+tBadge+bTxt+'<br>Tekan <b>Enter</b> / ketuk untuk Balapan</small>',true);
      }
    } else if(!nearPortal&&BK._portalTarget){ BK._portalTarget=null; if(BK.hidePortalPrompt)BK.hidePortalPrompt(); }
    for(const p of world.portals){
      if(!p.locked) continue;
      const dx=player.pos.x-p.x, dz=player.pos.z-p.z;
      if(dx*dx+dz*dz<p.r*p.r){
        p._lockT=(p._lockT||0)-dt;
        if(p._lockT<=0){ p._lockT=2.5; BK.flashMsg('🔒 '+p.lockMsg); BK.Audio.hit(); }
        const d=Math.sqrt(dx*dx+dz*dz)||1; // dorong balik lembut
        player.pos.x=p.x+dx/d*p.r; player.pos.z=p.z+dz/d*p.r;
      }
    }
    // garasi pembalap di pulau: ganti karakter & tingkat kesulitan secara natural
    if(world.garage && !nearPortal){
      const g=world.garage;
      const dx=player.pos.x-g.x, dz=player.pos.z-g.z;
      if(dx*dx+dz*dz<g.r*g.r){
        if(BK._garageTarget!==g){
          BK._garageTarget=g; BK._portalTarget=null; BK._bossTarget=null;
          if(BK.showPortalPrompt) BK.showPortalPrompt('🏠 Garasi Pembalap ('+player.char.icon+' '+player.char.name+')<br><small>Tekan <b>Enter</b> / ketuk untuk Ganti Karakter & Kesulitan</small>',true);
        }
      } else if(BK._garageTarget===g){
        BK._garageTarget=null; if(BK.hidePortalPrompt)BK.hidePortalPrompt();
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
      if(dx*dx+dz*dz<115){
        const t=BK.Save.trophyCount();
        if(BK.Save.hasBossKey()||t>=4){
          if(BK._bossTarget!==bd){
            BK._bossTarget=bd; BK._portalTarget=null; BK._garageTarget=null;
            const kStatus=BK.Save.hasBossKey()?'<span style="color:#ffd23f">🔑 Kunci Bos Diraih</span>':'<span style="color:#ff9f1c">🔥 Duel 1 vs 1 di Kawah Lava!</span>';
            if(BK.showPortalPrompt) BK.showPortalPrompt('👑 GERBANG BOS — Tantang Juara!<br><small>'+kStatus+'<br>Tekan <b>Enter</b> / ketuk untuk Masuk</small>',true);
          }
        }
        else {
          if(BK._bossTarget){ BK._bossTarget=null; if(BK.hidePortalPrompt)BK.hidePortalPrompt(); }
          bd._t=(bd._t||0)-dt;
          if(bd._t<=0){ bd._t=2.8; BK.flashMsg('🔒 GERBANG BOS — Butuh 4 Piala! ('+t+'/4)'); BK.Audio.hit(); }
          if(dx*dx+dz*dz<100){
            const d=Math.sqrt(dx*dx+dz*dz)||1;
            player.pos.x=bd.x+dx/d*10; player.pos.z=bd.z+dz/d*10;
          }
        }
      } else if(BK._bossTarget===bd){ BK._bossTarget=null; if(BK.hidePortalPrompt)BK.hidePortalPrompt(); }
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
    // --- Kompas Misi Petualangan (Panah Emas 3D + Misi HUD) ---
    const tc=BK.Save.trophyCount();
    let nextTarget=null;
    if(world.portals){
      nextTarget=world.portals.find(p=>!p.locked&&!BK.Save.hasTrophy(p.trackId));
    }
    if(!nextTarget && tc>=4 && !BK.Save.hasBossKey() && world.bossDoor){
      nextTarget={x:world.bossDoor.x, z:world.bossDoor.z, name:'Gerbang Bos (Utara)', isBoss:true};
    }
    if(world.guideArrow){
      if(nextTarget){
        const tdx=nextTarget.x-player.pos.x, tdz=nextTarget.z-player.pos.z;
        const dist2=tdx*tdx+tdz*tdz;
        world.guideArrow.visible = dist2 > 14*14;
        world.guideArrow.position.set(player.pos.x, (player.gy||0)+2.85+Math.sin(time*4)*0.12, player.pos.z);
        world.guideArrow.rotation.y = Math.atan2(tdx, tdz);
      } else {
        world.guideArrow.visible = false;
      }
    }
    world.update(dt,time);
    BK.updateParticles(dt);
    BK.updateCamera(camera,player,dt);
    document.getElementById('hud-lap').textContent=nextTarget?(nextTarget.isBoss?'🔥 MISI: GERBANG BOS':'🎯 MISI: '+nextTarget.name.toUpperCase()):'👑 RAJA PULAU';
    document.getElementById('hud-pos').textContent='🏆 '+tc+'/4';
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
    } else { fill.style.width='0%'; document.getElementById('boost-label').textContent=nextTarget?'IKUTI PANAH EMAS 🧭':'JELAJAH BEBAS 👑'; }
    BK.Audio.engine(Math.min(1,Math.abs(player.speed)/cfg.player.topSpeed),player.drifting,player.boostTime>0);
  }

  BK.attachHat=function(kart){    if(!kart||kart._hat) return;
    const hat=new THREE.Mesh(new THREE.ConeGeometry(0.32,0.55,8),
      new THREE.MeshLambertMaterial({color:0x2e8b47}));
    hat.position.set(0,1.78,1.15); hat.rotation.z=0.15;
    kart.mesh.add(hat); kart._hat=hat;
  };
  // ganti karakter langsung diterapkan ke kart pemain (posisi/laju/lap tetap)
  BK.applyChar=function(id){
    const c=BK.charById(id);
    if(!c||!player||!player.mesh) return false;
    if(player.char&&player.char.id===c.id) return true;
    scene.remove(player.mesh);
    const mesh=BK.buildRig(c);
    mesh.position.copy(player.mesh.position); mesh.rotation.copy(player.mesh.rotation);
    scene.add(mesh); player.mesh=mesh; player._hat=null;
    player.char=c; player.stat=c.stat; player.baseScale=c.scale||1; player.blinkT=2;
    player.name='Kamu '+c.icon;
    if(BK.Save.getShop().hat)BK.attachHat(player);
    return true;
  };
  // Geser pilihan karakter (lewati yang terkunci), dari jeda
  BK.switchChar=function(d){
    if(!player||!player.char) return;
    const list=BK.Characters;
    let i=list.findIndex(c=>c.id===player.char.id); if(i<0)i=0;
    for(let k=0;k<list.length;k++){
      i=(i+d+list.length)%list.length;
      const c=list[i];
      if(!BK.charOpen(c)){ continue; }
      if(BK.applyChar(c.id)){
        if(BK.syncCharUI)BK.syncCharUI(c.id);
        if(BK.refreshPauseChar)BK.refreshPauseChar();
        BK.Audio.item();
      }
      return;
    }
  };
  BK.togglePause=function(force){
    if(state!=='racing'&&state!=='roam') return;
    paused = force!==undefined?force:!paused;
    paused?BK.show('pause'):BK.hide('pause');
    if(paused&&BK.refreshPauseChar)BK.refreshPauseChar();
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
      const kcfg=k._boss?Object.assign({},diff,{aiTop:37.5,rubber:13.0,errMul:0,aggrMul:1.8}):diff;
      BK.updateAI(k,world,kcfg,player.progress,dt,racers);
      BK.Items.tryPickup(k,world);
    }
    // B. senggolan antar-kart (elastis, berbobot, oleng pegas bodi & impuls samping)
    if(BK.resolveKartCollisions) BK.resolveKartCollisions(racers, world, dt, time);
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
    // anti-macet: bila nyangkut dinding >1.8 dtk (pemain hanya saat tekan gas/rem di tepi dinding) -> respawn di tengah trek
    racers.forEach(k=>{
      if(k.finishTime!=null) return;
      const isStuck = k.isPlayer
        ? ((pinp.gas||pinp.brake) && k.spinTime<=0 && Math.abs(k.speed)<3 && Math.abs(k.lateral||0)>=world.half-1.5)
        : (k.spinTime<=0 && Math.abs(k.speed)<3);
      if(isStuck) k._stuckT=(k._stuckT||0)+dt; else k._stuckT=0;
      if(k._stuckT>1.8){
        k._stuckT=0; k._respawns=(k._respawns||0)+1;
        const p=world.pts[k.lastIdx], tg=world.tangents[k.lastIdx];
        k.pos.set(p.x,p.y,p.z); k.gy=p.y; k.worldY=p.y; k.airY=0; k.vy=0; k.grounded=true;
        k.heading=Math.atan2(tg.x,tg.z);
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
    if(won&&!BK.bossRace){
      if(BK.Save.setTrophy(world.def.id)){
        const tc=BK.Save.trophyCount();
        BK._justWonTrophy=world.def.name;
        rows.push({note:'🏆 Piala Baru: '+world.def.name+'! ('+tc+'/4)',isPlayer:true});
        if(tc===1){
          BK._justUnlockedStage='🔓 Portal Tahap 3 Terbuka: ❄️ Puncak Salju!';
          rows.push({note:BK._justUnlockedStage,isPlayer:true});
        } else if(tc===2){
          BK._justUnlockedStage='🔓 Portal Tahap 4 Terbuka: 🌋 Kawah Panas!';
          rows.push({note:BK._justUnlockedStage,isPlayer:true});
        } else if(tc===4&&!BK.Save.hasBossKey()){
          BK._justUnlockedBoss=true;
          rows.push({note:'🔥 4 PIALA LENGKAP! Gerbang Bos di Utara Pulau Terbuka!',isPlayer:true});
        }
        BK.Audio.trophy();
      }
    }
    // karakter HD terbuka saat MAP TUNTAS (boleh kalah — yang penting tuntas): pantai→balnok, salju→krambil, kawah→juara
    if(!BK.bossRace){
      const cid={pantai:'balnok',salju:'krambil',kawah:'juara'}[world.def.id];
      if(cid&&BK.Save.setCharOpen(cid)){
        const ch=BK.charById(cid);
        rows.push({note:'🔓 '+ch.icon+' '+ch.name+' TERBUKA — map '+world.def.name+' tuntas!',isPlayer:true});
        BK.Audio.keyFanfare();
      }
    }
    if(BK.bossRace&&won&&!BK.Save.hasBossKey()){
      BK.Save.setBossKey();
      if(BK.Save.setCharOpen('juara')){
        rows.push({note:'🔑 KUNCI BOS DIDAPAT! Karakter Juara terbuka!',isPlayer:true});
      } else {
        rows.push({note:'🔑 KUNCI BOS DIDAPAT!',isPlayer:true});
      }
      BK.Audio.keyFanfare();
      if(!BK.Save.finaleSeen()){
        BK.Save.setFinaleSeen();
        rows.push({note:'🏁 Tamat! Bekicot tercepat di pulau — terima kasih sudah main!',isPlayer:true});
      }
    }
    BK.refreshBest();
    if(BK.refreshHubStats)BK.refreshHubStats();
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
      // kamera tetap update biar hidup (swoop dari depan grid ke belakang kart)
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
      if(scene&&world){
        const nowS=performance.now()/1000;
        if(world.update)world.update(dt,nowS);
        if(BK.updateParticles)BK.updateParticles(dt);
        const pk=player||racers[0];
        if(pk){
          if(state==='done'){
            // Kamera Podium 3D: menyorot bagian depan-samping bekicot pemenang
            const ang=pk.heading+Math.PI+Math.sin(nowS*0.7)*0.48;
            const gy=pk.gy||0;
            camera.position.x+=(pk.pos.x+Math.sin(ang)*7.2-camera.position.x)*Math.min(1,4*dt);
            camera.position.y+=(gy+2.6-camera.position.y)*Math.min(1,4*dt);
            camera.position.z+=(pk.pos.z+Math.cos(ang)*7.2-camera.position.z)*Math.min(1,4*dt);
            camera.lookAt(pk.pos.x,gy+1.1,pk.pos.z);
          } else {
            // Kamera Orbit Pulau 3D saat di Menu / Garasi
            const ang=nowS*0.22;
            const gy=pk.gy||0;
            camera.position.set(pk.pos.x+Math.sin(ang)*16, gy+7.5, pk.pos.z+Math.cos(ang)*16);
            camera.lookAt(pk.pos.x, gy+1.6, pk.pos.z);
          }
        }
        renderer.render(scene,camera);
      }
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
    if(e.code==='KeyP'||e.code==='Escape'){
      if(state==='menu'&&(BK._menuOrigin==='roam'||BK._menuOrigin==='racing')){ BK.closeMenuBack(); return; }
      BK.togglePause();
    }
    // konfirmasi masuk portal/pintu bos/garasi di pulau (hanya saat prompt tampil)
    if(e.code==='Enter'&&state==='roam'&&!paused){
      if(BK._portalTarget){ keys.Enter=false; enterRaceFromHub(BK._portalTarget); return; }
      if(BK._bossTarget){ keys.Enter=false; enterBossRace(); return; }
      if(BK._garageTarget){ keys.Enter=false; BK.openMenu('roam'); return; }
    }
    // di layar hasil balapan: Enter langsung lanjut ke pulau petualangan
    if(e.code==='Enter'&&state==='done'){
      keys.Enter=false;
      if(BK.Config.openworld){ BK.returnToHub(); }
      else { BK.openMenu&&BK.openMenu(); }
      return;
    }
    // di layar menu utama (setelah overlay klik awal tertutup): Enter langsung terjun ke pulau
    if(e.code==='Enter'&&state==='menu'){
      const ov=document.getElementById('start-overlay');
      const hlp=document.getElementById('help');
      if((!ov||ov.classList.contains('hidden'))&&(!hlp||hlp.classList.contains('hidden'))){
        keys.Enter=false;
        if(BK.Config.openworld){
          if(BK._menuOrigin==='roam'&&BK.closeMenuBack) BK.closeMenuBack();
          else BK.startRoam();
          return;
        }
      }
    }
    if(e.code==='KeyM'&&BK.Music){ const m=BK.Music.toggle(); BK.flashMsg(m?'MUSIK MATI':'MUSIK NYALA'); }
    if(e.code==='KeyH'&&(state==='racing'||state==='roam')){
      if(BK.Save.getShop().horn&&BK.Audio.horn)BK.Audio.horn();
    }
    if(paused&&(e.code==='ArrowLeft'||e.code==='ArrowRight')){ if(BK.switchChar)BK.switchChar(e.code==='ArrowRight'?1:-1); }
    if(state==='menu'&&(e.code==='ArrowLeft'||e.code==='ArrowRight')){ if(BK.charStep)BK.charStep(e.code==='ArrowRight'?1:-1); }
    if(e.code==='KeyR'){
      if(state==='roam'&&world.isHub){ player.pos.copy(world.startPos); player.heading=world.startHeading; player.speed=0; }
      else if(state==='racing'||state==='done') BK.restartSlot();
    }
  });
  addEventListener('keyup',e=>{keys[e.code]=false;});
  addEventListener('pointerdown',()=>{ BK.Audio.unlock(); if(BK.Music)BK.Music.unlock(); });
  // tab disembunyikan = jeda otomatis (balapan/pulau)
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&(state==='racing'||state==='roam')&&!paused) BK.togglePause(true);
  });

  BK.init=function(){
    setupRenderer();
    BK.initUI(()=>{ BK.hubOrigin=null; startRace(); });
    // Bangun pulau hub 3D sebagai latar hidup sejak awal (ala CTR Adventure)
    sel=BK.getSelection();
    world=BK.buildHub(scene);
    world._builtTrophies=BK.Save.trophyCount();
    world._builtKey=BK.Save.hasBossKey();
    BK.Items.reset(scene,world);
    player=BK.createKart(scene,sel.charId,true);
    player.name='Kamu '+player.char.icon;
    player.pos.copy(world.startPos); player.heading=world.startHeading;
    player.gy=world.heightAt?world.heightAt(player.pos.x,player.pos.z):world.startPos.y;
    player.pos.y=player.gy; player.mesh.position.copy(player.pos); player.mesh.rotation.y=player.heading;
    racers=[player]; BK.playerKart=player;
    state='menu'; paused=false;
    if(BK.Music)BK.Music.autoplay();
    requestAnimationFrame(loop);
  };
  document.addEventListener('DOMContentLoaded',BK.init);
})();
