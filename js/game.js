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
    renderer.setPixelRatio(Math.min(IS_COARSE?1.5:2,window.devicePixelRatio||1)); // HP: 1.5 cukup tajam, jauh lebih ringan
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
    // lepas peta open-world (texture, geometry, lampu) sebelum scene dibuang
    const oldWorld = world || BK.currentWorld;
    if(oldWorld && typeof oldWorld.dispose === 'function'){
      try { oldWorld.dispose(); } catch(e) { console.warn('dispose world gagal', e); }
    }
    if(BK.currentWorld && BK.currentWorld !== oldWorld && typeof BK.currentWorld.dispose === 'function'){
      try { BK.currentWorld.dispose(); } catch(e) { console.warn('dispose currentWorld gagal', e); }
    }
    BK.currentWorld = null;
    // buang semua kecuali kamera light? paling gampang: buat scene baru
    scene.traverse(o=>{ if(o.geometry)o.geometry.dispose&&o.geometry.dispose(); });
    scene=new THREE.Scene();
    BK.initParticles(scene);
  }

  // --- Huruf B-K-T (BeKicoT) & Kotak Waktu Relik: prosedural ---
  const TOKEN_LETTERS=['B','K','T'];
  const _letterTexCache={};
  function getTokenLetterTex(ch){
    if(_letterTexCache[ch]) return _letterTexCache[ch];
    const c=document.createElement('canvas'); c.width=c.height=128;
    const g=c.getContext('2d');
    g.clearRect(0,0,128,128);
    g.beginPath(); g.arc(64,64,56,0,Math.PI*2);
    g.fillStyle='#ff9f1c'; g.fill();
    g.lineWidth=8; g.strokeStyle='#ffd23f'; g.stroke();
    g.font='900 78px "Segoe UI",Arial,sans-serif';
    g.textAlign='center'; g.textBaseline='middle';
    g.fillStyle='#4a1c00'; g.fillText(ch,67,69);
    g.fillStyle='#fff6b3'; g.fillText(ch,64,65);
    return _letterTexCache[ch]=new THREE.CanvasTexture(c);
  }
  const _timeCrateTexCache={};
  function getTimeCrateTex(sec){
    if(_timeCrateTexCache[sec]) return _timeCrateTexCache[sec];
    const c=document.createElement('canvas'); c.width=c.height=128;
    const g=c.getContext('2d');
    g.fillStyle='#ffd23f'; g.fillRect(0,0,128,128);
    g.strokeStyle='#9a6200'; g.lineWidth=12; g.strokeRect(6,6,116,116);
    g.strokeStyle='#ffea85'; g.lineWidth=4; g.strokeRect(14,14,100,100);
    g.fillStyle='#111'; g.font='900 76px "Segoe UI",Arial,sans-serif';
    g.textAlign='center'; g.textBaseline='middle';
    g.fillText(String(sec),64,68);
    return _timeCrateTexCache[sec]=new THREE.CanvasTexture(c);
  }

  function buildTokenLetters(scene, world){
    world.tokenLetters=[];
    const specs=[
      {ch:'B', t:0.22, lat:0.55},
      {ch:'K', t:0.53, lat:-0.55},
      {ch:'T', t:0.83, lat:0.48}
    ];
    specs.forEach((sp, idx)=>{
      const i=Math.floor(sp.t*world.N)%world.N;
      const p=world.pts[i], tg=world.tangents[i];
      const nx=-tg.z, nz=tg.x;
      const off=world.half*sp.lat;
      const x=p.x+nx*off, z=p.z+nz*off, y=p.y+1.85;
      const grp=new THREE.Group();
      const disc=new THREE.Mesh(
        new THREE.PlaneGeometry(2.3,2.3),
        new THREE.MeshBasicMaterial({map:getTokenLetterTex(sp.ch),transparent:true,side:THREE.DoubleSide})
      );
      grp.add(disc);
      const ring=new THREE.Mesh(
        new THREE.TorusGeometry(1.35,0.14,8,20),
        new THREE.MeshBasicMaterial({color:0xffd23f})
      );
      grp.add(ring);
      grp.position.set(x,y,z);
      scene.add(grp);
      world.tokenLetters.push({ch:sp.ch, x, y, z, mesh:grp, taken:false, phase:idx*1.2});
    });
  }

  function buildTimeCrates(scene, world){
    world.timeCrates=[];
    const boxGeo=new THREE.BoxGeometry(1.75,1.75,1.75);
    const total=18;
    for(let k=0;k<total;k++){
      const t=(k+0.6)/total;
      const i=Math.floor(t*world.N)%world.N;
      const p=world.pts[i], tg=world.tangents[i];
      const nx=-tg.z, nz=tg.x;
      const lane=((k%3)-1)*0.38*world.half;
      const sec=(k%5===4)?3:((k%2===0)?2:1);
      const x=p.x+nx*lane, z=p.z+nz*lane, y=p.y+1.0;
      const mesh=new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({map:getTimeCrateTex(sec)}));
      mesh.position.set(x,y,z);
      mesh.rotation.y=Math.atan2(tg.x,tg.z);
      scene.add(mesh);
      world.timeCrates.push({x, y, z, sec, mesh, alive:true});
    }
    BK.timeCratesTotal=total;
  }

  function updateRaceSubHUD(){
    const el=document.getElementById('hud-sub');
    if(!el) return;
    if(state==='roam' || state==='cutscene'){
      const pct=BK.Save.getAdventurePct?BK.Save.getAdventurePct():0;
      const tk=BK.Save.tokenCount?BK.Save.tokenCount():0;
      const rl=BK.Save.relicCount?BK.Save.relicCount():0;
      const coins=BK.Save.getCoins?BK.Save.getCoins():0;
      el.innerHTML=`<div class="sub-pill"><b>${BK.Story.chapterLabel()}</b></div><div class="sub-pill sub-dim">🔤 ${tk}/4 · ⏱️ ${rl}/4 · 🪙 ${coins}</div>`;
      return;
    }
    if(BK.bossRace){
      el.innerHTML=`<div class="sub-pill" style="border-color:#ff5a2a;color:#ffd23f">👑 Duel melawan Raja Juara</div>`;
      return;
    }
    if(BK.raceMode==='token'){
      const c=BK.tokenCollected||{};
      el.innerHTML=`<div class="sub-pill">🔤 TOKEN: ${TOKEN_LETTERS.map(l=>`<span class="token-let ${c[l]?'on':''}">${l}</span>`).join('')} + JUARA 1</div>`;
    } else if(BK.raceMode==='relic'){
      const target=BK.Save.getRelicTarget?BK.Save.getRelicTarget(BK.lastTrackId):82;
      const frz=BK.relicFreezeT>0?` • <b style="color:#7ff6ff">❄️ BEKU ${BK.relicFreezeT.toFixed(1)}s</b>`:'';
      el.innerHTML=`<div class="sub-pill">⏱️ TARGET RELIK: <b>&lt; ${BK.Save.fmt(target)}</b> • 📦 ${BK.timeCratesHit||0}/${BK.timeCratesTotal||18}${frz}</div>`;
    } else {
      if(BK.raceMode==='arcade'){ el.innerHTML=''; return; }
      const hasT=BK.Save.hasTrophy(BK.lastTrackId);
      const ch=BK.Story.chapter(BK.lastTrackId);
      el.innerHTML=`<div class="sub-pill">${hasT?'🏆 Piala sudah diraih · pecahkan rekor':'🎯 '+(ch?ch.goal:'Rebut juara 1')}</div>`;
    }
  }

  // --- Jembatan ke sutradara cerita (js/cutscene.js) ---
  function rivalKart(){ return racers.find(k=>k._rival||k._boss)||null; }
  function playScene(id,extra,onDone){
    const sc=BK.Story.scene(id);
    if(!sc){ if(onDone)onDone(); return; }
    BK.Save.markScene(id);
    BK.Audio.engineOff();
    if(BK.hidePortalPrompt)BK.hidePortalPrompt();
    BK.hide('hud'); BK.hide('countdown');
    document.getElementById('minimap').style.display='none';
    state='cutscene'; paused=false; acc=0;
    const rv=world&&!world.isHub?rivalKart():null;
    if(world&&world.guideArrow) world.guideArrow.visible=false;
    BK.Cutscene.play(sc,Object.assign({camera,scene,world,player,rival:rv,rivalWho:rv?rv._who:null},extra||{}),onDone);
  }
  // antrean adegan berurutan; selesai -> kembali mengemudi di pulau
  function playHubQueue(queue,exitPortal){
    if(!queue.length){ resumeRoam(); return; }
    const id=queue.shift();
    playScene(id,{exitPortal},()=>{
      if(id==='finale'){
        BK.showCredits(()=>playHubQueue(queue,exitPortal));
        return;
      }
      playHubQueue(queue,exitPortal);
    });
  }
  function resumeRoam(){
    BK.show('hud');
    document.getElementById('minimap').style.display='block';
    if(world&&world.expeditionMap&&world.expeditionMap.setStoryStage) world.expeditionMap.setStoryStage(BK.Story.storyStage(),true);
    camera._yaw=undefined; BK.cameraSwoop(camera,0.9);
    state='roam'; paused=false; acc=0;
    if(BK.Music)BK.Music.play('hub');
    BK.refreshItemHUD();
    updateRaceSubHUD();
    BK.showObjective();
  }

  // celetukan rival: hanya saat ada cerita, dibatasi agar tidak cerewet
  let _barkT=0;
  function bark(kind,force){
    const rv=rivalKart(); if(!rv||!rv._who) return;
    const t=BK.Story.BARK[rv._who]; if(!t||!t[kind]) return;
    if(!force&&time-_barkT<5) return;
    _barkT=time;
    BK.speech(rv._who,t[kind]);
  }
  BK.raceEvent=function(kind,k){
    if(state!=='racing') return;
    const rv=rivalKart();
    if(kind==='rivalHit'&&k===rv) bark('hit');
  };

  const FIGURAN={ 'Lumi':{char:'hantu',who:'lumi'}, 'Gesit':{char:'turbo',who:'gesit'}, 'Pak Oli':{char:'besi',who:'pakoli'} };
  // persiapan bersama semua balapan: UI bersih, HUD, musik, kamera di depan grid
  const DNF_GRACE=20;
  function raceCommonSetup(def){
    BK._dnfT=null;
    BK.Items.reset(scene,world);
    racers.forEach(k=>{
      if(!BK._angerTex){
        const c=document.createElement('canvas'); c.width=c.height=64;
        const g=c.getContext('2d'); g.font='52px serif'; g.textAlign='center'; g.fillText('💢',32,50);
        BK._angerTex=new THREE.CanvasTexture(c);
      }
      const s=new THREE.Sprite(new THREE.SpriteMaterial({map:BK._angerTex,transparent:true,depthTest:false}));
      s.scale.set(1.6,1.6,1); s.visible=false; scene.add(s); k._anger=s;
    });
    player=racers[0]; BK.playerKart=player;
    BK.seedAI(racers);
    if(BK.Save.getShop().hat)BK.attachHat(player);
    playerBest=null; newRecord=false; time=0; lapStart=0; _barkT=-9; acc=0;
    BK.refreshItemHUD();
    BK.hide('menu'); BK.hide('result'); BK.hide('pause'); BK.hide('help');
    if(BK.closeShrineModal)BK.closeShrineModal();
    if(BK.closeJournal)BK.closeJournal();
    const ht=document.getElementById('hud-time'); if(ht)ht.classList.remove('frozen');
    if(BK.setWrongWay)BK.setWrongWay(false);
    BK._entering=false; BK._pendingPost=null; BK._finalMusic=false;
    const hx=Math.sin(player.heading), hz=Math.cos(player.heading);
    camera._yaw=undefined; camera._back=8.2;
    camera.position.set(player.pos.x+hx*12-hz*5, (player.gy||0)+6.2, player.pos.z+hz*12+hx*5);
    camera.lookAt(player.pos.x, (player.gy||0)+1.2, player.pos.z);
    state='countdown'; paused=false;
  }
  function beginCountdown(msg,label){
    BK.show('hud'); BK.show('countdown');
    document.getElementById('countdown').textContent='';
    document.getElementById('minimap').style.display='block';
    if(BK.Music)BK.Music.play(BK.bossRace?'final':'race',true);
    updateRaceSubHUD();
    updatePositions(); // tanpa ini HUD menampilkan "0th" selama hitung mundur
    BK._lastPlace=player.place;
    BK.updateHUD({player,time:0});
    BK.cameraSwoop(camera,3.0);
    countdownT=3.8; cdStep=4; _gasEarly=false; _gasOnOne=false;
    state='countdown'; paused=false;
    if(label) BK.raceBanner(label.kicker,label.title);
    if(msg) BK.flashMsg(msg);
  }
  let _gasEarly=false,_gasOnOne=false;

  function startRace(forcedTrackId, raceMode){
    sel=BK.getSelection();
    const def=BK.Tracks.find(t=>t.id===(forcedTrackId||sel.trackId))||BK.Tracks[0];
    BK.lastTrackId=def.id; BK.lastBoss=false; BK.bossRace=false;
    BK.raceMode=raceMode||'arcade';
    BK.tokenCollected={};
    BK.relicFreezeT=0; BK.timeCratesHit=0; BK.timeCratesTotal=0;
    BK._portalTarget=null; BK._bossTarget=null; BK._shrineTarget=null; BK._garageTarget=null;
    if(BK.hidePortalPrompt)BK.hidePortalPrompt();
    clearScene();
    world=BK.buildWorld(scene,def);

    const story=BK.raceMode!=='arcade'&&BK.raceMode!=='relic';
    const ch=story?BK.Story.chapter(def.id):null;
    racers=[];
    const racerCount=(BK.raceMode==='relic')?1:4;
    const roster=[];
    if(ch){
      roster.push({char:BK.Story.CAST[ch.rival].char,name:BK.Story.CAST[ch.rival].name,who:ch.rival,rival:true});
      ch.rivals.forEach(n=>roster.push({char:FIGURAN[n].char,name:n,who:FIGURAN[n].who}));
    } else {
      const others=BK.Characters.filter(c=>c.id!==sel.charId&&BK.charOpen(c));
      for(let i=0;i<3;i++){ const c=others[i%others.length]; roster.push({char:c.id,name:c.name}); }
    }
    for(let i=0;i<racerCount;i++){
      const r=i?roster[i-1]:null;
      const k=BK.createKart(scene,i?r.char:sel.charId,i===0);
      BK.placeOnStart(k,world,i);
      k.name=i?r.name+' '+k.char.icon:'Kamu '+k.char.icon;
      if(r){ k._who=r.who; k._rival=!!r.rival; }
      k.progress=-i*3;
      racers.push(k);
    }
    raceCommonSetup(def);
    if(BK.raceMode==='token') buildTokenLetters(scene, world);
    if(BK.raceMode==='relic'){
      buildTimeCrates(scene, world);
      (world.boxes||[]).forEach(b=>{ b.active=false; if(b.mesh)b.mesh.visible=false; b.timer=1e9; });
    }
    BK.hide('hud'); BK.hide('countdown');
    const label=ch&&BK.raceMode==='trophy'?{kicker:'BAB '+ch.n+' · '+ch.title,title:def.icon+' '+def.name}:{kicker:def.icon+' '+def.name,title:{token:'🔤 Token B-K-T',relic:'⏱️ Relik Waktu',trophy:'🏆 Rebut Piala',arcade:'🏁 Balap Cepat'}[BK.raceMode]||''};
    let msg='';
    if(BK.raceMode==='token') msg='Kumpulkan B-K-T lalu juara 1!';
    else if(BK.raceMode==='relic') msg='Hantam kotak waktu! Target < '+BK.Save.fmt(BK.Save.getRelicTarget(def.id));
    const preId=ch&&BK.raceMode==='trophy'?BK.Story.preScene(def.id):null;
    if(preId&&!BK.Save.sceneSeen(preId)&&!BK.Save.hasTrophy(def.id)){
      playScene(preId,null,()=>beginCountdown(msg,label));
    } else beginCountdown(msg,label);
  }
  BK.bossRace=false;
  BK.restartRace=startRace;
  // ulangi balapan TERAKHIR (portal/menu sama-sama benar); di pulau = kembali ke spawn
  BK.restartSlot=function(){
    if(state==='roam'&&world&&world.isHub){
      player.pos.copy(world.startPos); player.heading=world.startHeading; player.speed=0;
      player.gy=world.heightAt?world.heightAt(player.pos.x,player.pos.z):world.startPos.y;
      player.pos.y=player.gy; player.worldY=player.gy; player.airY=0; player.vy=0; player.grounded=true;
      player._bumpVx=0; player._bumpVz=0; player.mesh.position.copy(player.pos);
      if(paused) BK.togglePause(false);
    }
    else if(BK._pendingPost&&state==='done') return;
    else if(BK.lastBoss) BK.startBossRace();
    else if(state==='racing'||state==='done') startRace(BK.lastTrackId, BK.raceMode);
  };
  BK.startBossRace=function(){
    sel=BK.getSelection();
    const def=BK.BossTrack;
    BK.lastTrackId=def.id; BK.lastBoss=true; BK.raceMode='boss'; BK.bossRace=true;
    BK._portalTarget=null; BK._bossTarget=null; BK._garageTarget=null; BK._shrineTarget=null;
    if(BK.hidePortalPrompt)BK.hidePortalPrompt();
    clearScene();
    world=BK.buildWorld(scene,def);
    racers=[];
    const p=BK.createKart(scene,sel.charId,true);
    BK.placeOnStart(p,world,0); p.name='Kamu '+p.char.icon; p.progress=0;
    const c=BK.createKart(scene,'juara',false);
    BK.placeOnStart(c,world,1); c.name='Raja Juara 👑'; c.progress=-3; c._boss=true; c._who='juara'; c._atkT=7;
    racers=[p,c];
    raceCommonSetup(def);
    BK.hide('hud'); BK.hide('countdown');
    const label={kicker:'BAB TERAKHIR',title:'👑 '+def.name};
    if(!BK.Save.sceneSeen('boss_pre')) playScene('boss_pre',null,()=>beginCountdown('',label));
    else beginCountdown('',label);
  };
  function enterBossRace(){
    if(BK._entering) return; BK._entering=true;
    BK._portalTarget=null; BK._bossTarget=null; BK._garageTarget=null; BK._shrineTarget=null;
    if(BK.hidePortalPrompt)BK.hidePortalPrompt();
    const bd=world.bossDoor;
    BK.hubOrigin={x:bd.x,z:bd.z+14};
    const f=document.getElementById('fade'); if(f){ f.style.opacity=1; }
    BK.Audio.warp();
    setTimeout(()=>{ BK.startBossRace(); const f2=document.getElementById('fade'); if(f2)f2.style.opacity=0; },450);
  }

  /* MODE JELAJAH: hub open-world mini */
  BK.hubOrigin=null;
  BK.startRoam=function(exitPortal){
    if(!BK.Config.openworld) return;
    sel=BK.getSelection();
    BK._entering=false; BK._portalTarget=null; BK._bossTarget=null; BK._garageTarget=null; BK._shrineTarget=null;
    if(BK.hidePortalPrompt)BK.hidePortalPrompt();
    if(BK.closeShrineModal)BK.closeShrineModal();
    const tcNow=BK.Save.trophyCount(), tkNow=BK.Save.tokenCount(), rlNow=BK.Save.relicCount(), keyNow=BK.Save.hasBossKey();
    if(!exitPortal && world && world.isHub && world._builtTrophies===tcNow && world._builtTokens===tkNow && world._builtRelics===rlNow && world._builtKey===keyNow && player){
      BK.applyChar(sel.charId);
    } else {
      clearScene();
      world=BK.buildHub(scene);
      world._builtTrophies=tcNow; world._builtTokens=tkNow; world._builtRelics=rlNow; world._builtKey=keyNow;
      BK.Items.reset(scene,world);
      player=BK.createKart(scene,sel.charId,true);
      player.name='Kamu '+player.char.icon;
      if(exitPortal){
        const exitSp = exitPortal.biome && world.getSpawnPoint ? world.getSpawnPoint(exitPortal.biome) : null;
        if(exitSp){
          player.pos.set(exitSp.position.x, 0, exitSp.position.z);
          player.heading = (exitSp.heading != null ? exitSp.heading : exitSp.rotation.y);
        } else {
          // keluar dari gerbang (bukan portal bioma): tampil di depan pintu, menghadap pusat pulau
          const a=Math.atan2(exitPortal.x,exitPortal.z);
          player.pos.set(exitPortal.x-Math.sin(a)*11,0,exitPortal.z-Math.cos(a)*11);
          player.heading=a+Math.PI;
        }
      } else {
        player.pos.copy(world.startPos); player.heading=world.startHeading;
      }
      player.lastIdx=0; player.lap=1;
      player.gy=world.heightAt?world.heightAt(player.pos.x,player.pos.z):world.startPos.y;
      player.pos.y=player.gy; player.worldY=player.gy; player.airY=0; player.vy=0; player.grounded=true;
      player.mesh.position.copy(player.pos); player.mesh.rotation.y=player.heading;
      racers=[player]; BK.playerKart=player;
      if(BK.Save.getShop().hat)BK.attachHat(player);
    }
    time=0;
    BK.hide('menu'); BK.hide('result'); BK.hide('pause'); BK.hide('help'); BK.hide('countdown');
    if(BK.closeJournal)BK.closeJournal();
    const ht=document.getElementById('hud-time'); if(ht)ht.classList.remove('frozen');
    if(BK.setWrongWay)BK.setWrongWay(false);
    BK.lastBoss=false;
    const queue=BK.Story.pendingHubScenes();
    if(BK.Cutscene.active()) return;
    if(queue.length) playHubQueue(queue,exitPortal);
    else resumeRoam();
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
  // pindah cepat antar bioma (dipakai konsol dev / tombol ekspedisi)
  BK.teleportToBiome=function(name){
    if(state!=='roam'||!world||!world.getSpawnPoint||!player) return null;
    const sp=world.getSpawnPoint(name);
    if(!sp) return null;
    player.pos.x=sp.position.x; player.pos.z=sp.position.z;
    player.gy=world.heightAt?world.heightAt(player.pos.x,player.pos.z):sp.position.y;
    player.pos.y=player.gy; player.worldY=player.gy; player.airY=0; player.vy=0; player.grounded=true;
    player.heading=sp.rotation.y;
    player.speed=0; player._bumpVx=0; player._bumpVz=0;
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y=player.heading;
    player.lastIdx=0;
    if(BK.flashMsg) BK.flashMsg('🧭 '+sp.name);
    return sp;
  };
  // ketuk prompt / panggil dari UI = setuju masuk portal / bos / garasi / kuil
  BK.confirmPortal=function(forcedMode){
    if(BK._entering) return;
    if(BK._portalTarget){
      const p=BK._portalTarget;
      const mode=forcedMode||BK._portalRaceMode||'trophy';
      enterRaceFromHub(p, mode);
    }
    else if(BK._bossTarget){ enterBossRace(); }
    else if(BK._garageTarget){ if(!BK.Config.openworld) return; BK.openMenu('roam'); }
    else if(BK._shrineTarget){ if(BK.openShrineModal) BK.openShrineModal(); }
  };
  // buka menu sebagai layar pengaturan/garasi (dari jeda, garasi pulau, atau hasil)
  BK.openMenu=function(originState){
    BK._menuOrigin = originState || state;
    BK.hide('pause'); BK.hide('result'); BK.hide('hud');
    document.getElementById('minimap').style.display='none';
    if(BK.hidePortalPrompt)BK.hidePortalPrompt();
    if(BK.closeShrineModal)BK.closeShrineModal();
    BK.show('menu');
    if(BK.refreshMenuForStory)BK.refreshMenuForStory();
    const b=document.getElementById('btn-back2');
    if(b) b.classList.toggle('hidden', BK._menuOrigin!=='racing' && BK._menuOrigin!=='roam');
    if(BK.refreshBest)BK.refreshBest();
    if(BK.refreshHubStats)BK.refreshHubStats();
    state='menu'; paused=false;
    BK.Audio.engineOff();
    if(BK.Music)BK.Music.play('menu');
  };
  BK.closeMenuBack=function(){
    const b=document.getElementById('btn-back2'); if(b)b.classList.add('hidden');
    BK.hide('menu');
    if(BK._menuOrigin==='roam' && world && world.isHub){
      resumeRoam();
    } else if(BK._menuOrigin==='racing' && world && !world.isHub){
      BK.show('hud'); BK.show('pause');
      document.getElementById('minimap').style.display='block';
      state='racing'; paused=true;
      if(BK.Music)BK.Music.play(BK._finalMusic?'final':'race');
    } else if(BK.Config.openworld){
      BK.startRoam();
    }
  };
  function enterRaceFromHub(portal, raceMode){
    if(BK._entering) return; BK._entering=true;
    BK._portalTarget=null; BK._bossTarget=null; BK._garageTarget=null; BK._shrineTarget=null;
    if(BK.hidePortalPrompt)BK.hidePortalPrompt();
    BK.hubOrigin={x:portal.x,z:portal.z,trackId:portal.trackId,biome:portal.biome};
    const f=document.getElementById('fade');
    if(f){ f.style.opacity=1; }
    BK.Audio.warp();
    setTimeout(()=>{ startRace(portal.trackId, raceMode||'trophy'); const f2=document.getElementById('fade'); if(f2)f2.style.opacity=0; },450);
  }
  function roamStep(dt){
    time+=dt;
    const inp=playerInput();
    // radius portal cuma 7 m: rem biasa bablas dari kecepatan penuh (modal hanya terbuka 0,7 dtk)
    if(BK._autoHold) player.speed*=Math.exp(-12*dt);
    BK.updateKart(player,world,inp,dt,time);
    BK.Items.tryPickup(player,world);
    BK.Items.update(dt,[player]);
    if(keys.KeyE||keys.KeyF||BK.touch.itemPressed||(keys.Enter&&!BK._portalTarget&&!BK._bossTarget&&!BK._garageTarget&&!BK._shrineTarget)){
      BK.Items.use(player,[player]);
      keys.KeyE=keys.Enter=keys.KeyF=false; BK.touch.itemPressed=false;
    }
    // portal balapan? dekati = modal pilihan 3 mode balapan
    let nearPortal=null;
    for(const p of world.portals){
      const dx=player.pos.x-p.x, dz=player.pos.z-p.z;
      if(dx*dx+dz*dz<p.r*p.r){ nearPortal=p; break; }
    }
    if(nearPortal&&nearPortal!==BK._portalTarget){
      BK._portalTarget=nearPortal; BK._bossTarget=null; BK._garageTarget=null; BK._shrineTarget=null;
      if(nearPortal.locked){ BK.hidePortalPrompt(); }
      else if(BK.showPortalModal){ BK.showPortalModal(nearPortal); }
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
          BK._garageTarget=g; BK._portalTarget=null; BK._bossTarget=null; BK._shrineTarget=null;
          if(BK.showPortalPrompt) BK.showPortalPrompt('🏠 Garasi Pembalap ('+player.char.icon+' '+player.char.name+')<br><small>Tekan <b>Enter</b> / ketuk untuk Ganti Karakter & Kesulitan</small>',true);
        }
      } else if(BK._garageTarget===g){
        BK._garageTarget=null; if(BK.hidePortalPrompt)BK.hidePortalPrompt();
      }
    }
    // kuil status petualangan & toko pulau
    if(world.shrine && !nearPortal && !BK._garageTarget){
      const sh=world.shrine;
      const dx=player.pos.x-sh.x, dz=player.pos.z-sh.z;
      if(dx*dx+dz*dz<sh.r*sh.r){
        if(BK._shrineTarget!==sh){
          BK._shrineTarget=sh; BK._portalTarget=null; BK._bossTarget=null; BK._garageTarget=null;
          const pct=BK.Save.getAdventurePct?BK.Save.getAdventurePct():0;
          if(BK.showPortalPrompt) BK.showPortalPrompt('📊 Kuil Status Petualangan ('+pct+'% Tamat)<br><small>Tekan <b>Enter</b> / ketuk untuk Lihat Rekor, Teleport Bioma & Toko Pulau</small>',true);
        }
      } else if(BK._shrineTarget===sh){
        BK._shrineTarget=null; if(BK.hidePortalPrompt)BK.hidePortalPrompt();
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
    // kolam toxic (Citadel City): melambat + cipratan hijau + bunyi hit
    for(const hz of world.hazards||[]){
      const dx=player.pos.x-hz.x, dz=player.pos.z-hz.z;
      if(dx*dx+dz*dz<hz.r*hz.r && (player.airY||0)<0.8){
        player.speed*=(1-1.8*dt);
        if(BK.spawnDust&&Math.random()<0.45)BK.spawnDust(player.pos,0x5cff67,0,0);
        player._toxT=(player._toxT||0)-dt;
        if(player._toxT<=0){
          player._toxT=1.4;
          if(BK.Audio&&BK.Audio.hit)BK.Audio.hit();
          if(BK.flashMsg)BK.flashMsg('☣️ KOLAM BERACUN! MELAMBAT!');
        }
      }
    }
    // cincin warp jalan raya: beri mini-boost & partikel saat dilewati
    for(const w of world.warpRings||[]){
      w._cd=Math.max(0,(w._cd||0)-dt);
      if(w.x==null||w._cd>0) continue;
      const dx=player.pos.x-w.x, dz=player.pos.z-w.z;
      // hitbox cincin: harus MELEWATI lubang cincin (lateral < jari-jari dalam), tebal zona ±1.5 m searah jalan
      const wtx=Math.sin(w.yaw||0), wtz=Math.cos(w.yaw||0), wAlong=dx*wtx+dz*wtz, wLat=dx*wtz-dz*wtx;
      const thru = w.hole ? (Math.abs(wLat)<w.hole && Math.abs(wAlong)<1.5) : (dx*dx+dz*dz<(w.r||4.0)*(w.r||4.0));
      if(thru && Math.abs(player.speed)>4){
        w._cd=2.2;
        player.boostTime=Math.max(player.boostTime||0,0.55);
        player.boostPower=Math.max(player.boostPower||0,10);
        if(BK.Audio&&BK.Audio.boost)BK.Audio.boost();
        if(BK.spawnBurst)BK.spawnBurst({x:w.x,y:(player.gy||0)+1.5,z:w.z},w.color||0x55c9ff,8,0.28);
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
            const kStatus=BK.Save.hasBossKey()?'<span style="color:#ffd23f">Tanding ulang melawan Juara</span>':'<span style="color:#ff9f1c">Duel terakhir di Mahkota Kawah</span>';
            if(BK.showPortalPrompt) BK.showPortalPrompt('👑 GERBANG UTARA<br><small>'+kStatus+'<br>Tekan <b>Enter</b> / ketuk untuk masuk</small>',true);
          }
        }
        else {
          if(BK._bossTarget){ BK._bossTarget=null; if(BK.hidePortalPrompt)BK.hidePortalPrompt(); }
          bd._t=(bd._t||0)-dt;
          if(bd._t<=0){ bd._t=2.8; BK.flashMsg('🔒 Gerbang Utara butuh 4 Piala ('+t+'/4)'); BK.Audio.hit(); }
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
        n.cd=9;
        const lines=BK.Story.npcLines(n.who);
        BK.speech(n.who,lines[n.li%lines.length]); n.li++;
        if(BK.Audio.talk) BK.Audio.talk((BK.Story.CAST[n.who]||{}).pitch||1);
      }
      if(d2<6.25&&d2>0.0001){
        const d=Math.sqrt(d2);
        player.pos.x=n.mesh.position.x+dx/d*2.5;
        player.pos.z=n.mesh.position.z+dz/d*2.5;
      }
    }
    // --- Kompas misi: mengikuti bab aktif ---
    const tc=BK.Save.trophyCount();
    let nextTarget=null;
    const curCh=BK.Story.current();
    if(curCh) nextTarget=world.portals.find(p=>p.trackId===curCh.trackId)||null;
    else if(!BK.Save.hasBossKey()&&world.bossDoor) nextTarget={x:world.bossDoor.x,z:world.bossDoor.z,name:'Gerbang Utara',isBoss:true};
    if(!nextTarget&&world.portals) nextTarget=world.portals.find(p=>!BK.Save.hasToken(p.trackId)||!BK.Save.hasRelic(p.trackId))||null;
    let tgtDist=0;
    if(world.guideArrow){
      if(nextTarget){
        const tdx=nextTarget.x-player.pos.x, tdz=nextTarget.z-player.pos.z;
        tgtDist=Math.sqrt(tdx*tdx+tdz*tdz);
        world.guideArrow.visible = tgtDist > 14;
        world.guideArrow.position.set(player.pos.x, (player.worldY!=null?player.worldY:(player.gy||0))+2.95+Math.sin(time*4)*0.12, player.pos.z);
        world.guideArrow.rotation.y = Math.atan2(tdx, tdz);
      } else {
        world.guideArrow.visible = false;
      }
    }
    const pctNow=BK.Save.getAdventurePct();
    document.getElementById('hud-lap').textContent=nextTarget?((nextTarget.isBoss?'🔥 ':'🎯 ')+nextTarget.name+' · '+Math.round(tgtDist)+' m'):'👑 Jelajah Bebas';
    document.getElementById('hud-pos').textContent='🏆 '+tc+'/4';
    document.getElementById('hud-time').textContent=pctNow+'%';
    updateRaceSubHUD();
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
    const ha=kart.mesh.userData.hatAt; // rig HD memberi titik kepala sendiri
    if(ha){ hat.position.copy(ha).add(new THREE.Vector3(0,0.15,0)); hat.scale.setScalar(0.6); } else hat.position.set(0,1.78,1.15);
    hat.rotation.z=0.15;
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
    if(paused&&BK.refreshPauseMenu)BK.refreshPauseMenu(state,BK.raceMode);
    if(paused&&BK.Music&&BK.Music.duck)BK.Music.duck(true);
    if(!paused&&BK.Music&&BK.Music.duck)BK.Music.duck(false);
    BK.Audio.engineOff();
  };

  let autoHoldFor=null, autoHoldT=0;
  function playerInput(){
    if(BK._devInput) return BK._devInput();
    const l=keys.ArrowLeft||keys.KeyA||BK.touch.left;
    const r=keys.ArrowRight||keys.KeyD||BK.touch.right;
    // HP: gas otomatis. Dekat portal/garasi ditahan 3 dtk supaya pilihannya sempat diketuk;
    // setelah itu jalan lagi agar pemain tak terjebak tanpa tombol gas.
    let autoGas=IS_COARSE;
    if(IS_COARSE&&state==='roam'){
      const pt=BK._portalTarget;
      const tgt=(pt&&!pt.locked?pt:null)||BK._bossTarget||BK._garageTarget||BK._shrineTarget||null;
      if(tgt!==autoHoldFor){ autoHoldFor=tgt; autoHoldT=time+4; }
      BK._autoHold=!!tgt&&time<autoHoldT;
      if(BK._autoHold) autoGas=false;
    }
    const gas=keys.ArrowUp||keys.KeyW||autoGas;
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
    if(BK.raceMode==='relic' && BK.relicFreezeT>0 && player && player.finishTime==null){
      BK.relicFreezeT=Math.max(0, BK.relicFreezeT-dt);
      const ht=document.getElementById('hud-time'); if(ht)ht.classList.add('frozen');
      updateRaceSubHUD();
    } else {
      time+=dt;
      const ht=document.getElementById('hud-time'); if(ht)ht.classList.remove('frozen');
    }
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
    // Pickup Huruf B-K-T (Mode Tantangan Token)
    if(world.tokenLetters && world.tokenLetters.length){
      world.tokenLetters.forEach(lt=>{
        if(lt.taken) return;
        lt.mesh.rotation.y+=dt*2.6;
        lt.mesh.position.y=lt.y+Math.sin(performance.now()/280+lt.phase)*0.22;
        const dx=player.pos.x-lt.x, dz=player.pos.z-lt.z;
        if(dx*dx+dz*dz<36 && BK.kartTouch(player,lt.x,lt.z,1.5)){ // huruf r≈1.5
          lt.taken=true; lt.mesh.visible=false;
          BK.tokenCollected[lt.ch]=true;
          if(BK.spawnBurst)BK.spawnBurst({x:lt.x,y:lt.y,z:lt.z},0xffd23f,18);
          if(BK.Audio&&BK.Audio.trophy)BK.Audio.trophy();
          const all3=TOKEN_LETTERS.every(l=>BK.tokenCollected[l]);
          BK.flashMsg(all3?'🔤 B-K-T lengkap! Rebut juara 1!':'🔤 Huruf '+lt.ch+' didapat!');
          updateRaceSubHUD();
        }
      });
    }
    // Pickup Kotak Waktu (Mode Balapan Relik)
    if(world.timeCrates && world.timeCrates.length){
      world.timeCrates.forEach(tc=>{
        if(!tc.alive) return;
        const dx=player.pos.x-tc.x, dz=player.pos.z-tc.z;
        if(dx*dx+dz*dz<36 && BK.kartTouch(player,tc.x,tc.z,1.05)){ // peti waktu 1.75 m
          tc.alive=false; tc.mesh.visible=false;
          BK.relicFreezeT=(BK.relicFreezeT||0)+tc.sec;
          BK.timeCratesHit=(BK.timeCratesHit||0)+1;
          if(BK.spawnBurst)BK.spawnBurst({x:tc.x,y:tc.y,z:tc.z},0xffd23f,14);
          if(BK.Audio&&BK.Audio.coin)BK.Audio.coin();
          else if(BK.Audio&&BK.Audio.pickup)BK.Audio.pickup();
          BK.flashMsg('❄️ -'+tc.sec+' DETIK! WAKTU BEKU!');
          updateRaceSubHUD();
        }
      });
    }
    // AI
    for(let i=1;i<racers.length;i++){
      const k=racers[i];
      if(k.finishTime!=null) continue;
      BK.updateAI(k,world,aiCfgFor(k,diff),player.progress,dt,racers);
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
    // lap pemain
    const curLap=Math.min(player.lap,cfg.laps);
    // deteksi lap baru via _lapFlag
    if(player._shownLap!==curLap){
      player._shownLap=curLap;
      if(curLap>1&&player.finishTime==null&&BK.lapBanner) BK.lapBanner(curLap,cfg.laps);
      if(curLap===cfg.laps&&!BK._finalMusic&&player.finishTime==null){
        BK._finalMusic=true; if(BK.Music)BK.Music.play('final');
        bark('lastlap',true);
      } else if(BK.bossRace&&curLap===2&&player.finishTime==null) bark('phase2',true);
      else if(BK.bossRace&&curLap===3&&player.finishTime==null) bark('phase3',true);
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
        if(k.isPlayer && BK.raceMode==='relic' && BK.timeCratesTotal>0 && BK.timeCratesHit>=BK.timeCratesTotal){
          time=Math.max(1, time-10.0);
          BK.flashMsg('⭐ SEMUA KOTAK WAKTU PECAH! BONUS -10 DETIK!');
        }
        k.finishTime=time;
        if(k.isPlayer){
          // putaran terakhir ikut dihitung sebagai kandidat rekor lap (dulu terlewat)
          const lastLap=time-lapStart;
          if(lastLap>5&&(playerBest==null||lastLap<playerBest)) playerBest=lastLap;
          const curOrder=updatePositions();
          const isWin = BK.raceMode==='relic'
            ? (time <= (BK.Save.getRelicTarget?BK.Save.getRelicTarget(world.def.id):82))
            : (curOrder[0]&&curOrder[0].isPlayer);
          if(! (BK.raceMode==='relic' && BK.timeCratesHit>=BK.timeCratesTotal)){
            BK.flashMsg(isWin?'🏆 JUARA 1! FINISH!':'🏁 FINISH!');
          }
          if(BK.Audio){
            if(isWin&&BK.Audio.win) BK.Audio.win();
            else if(!isWin&&BK.Audio.lose) BK.Audio.lose();
          }
          if(BK.Music) BK.Music.play('finish',true);
          BK.party&&BK.party(isWin); // confetti + fanfare
          k._partyT=2.4; k._fwT=0;  // kembang api 3D susulan
          const bestPrev=BK.Save.getBest(world.def.id);
          if(!BK.bossRace&&playerBest&&(bestPrev==null||playerBest<bestPrev)){
            BK.Save.setBest(world.def.id,playerBest); newRecord=true;
          }
          if(isWin) BK.Save.addWin(world.def.id);
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
      if(player._draftT>2){ player._draftT=0; player.boostTime=0.8; player.boostPower=10; BK.flashMsg('SLIPSTREAM!'); BK.Audio.boost(); }
    } else player._draftT=0;
    // ikon 💢 mengikuti kart yang baru tersenggol
    racers.forEach(k=>{
      if(!k._anger) return;
      const show=(time-(k._bumped||-9))<1.2;
      k._anger.visible=show;
      if(show)k._anger.position.set(k.pos.x,(k.gy||0)+3.4,k.pos.z);
    });
    const order=updatePositions();
    // celetukan saat saling salip dengan rival + animasi posisi HUD
    const rvK=rivalKart();
    if(rvK&&player.finishTime==null&&time>3){
      const rvAhead=rvK.place<player.place;
      if(player._rvAhead!==undefined&&player._rvAhead!==rvAhead) bark(rvAhead?'overtake':'passed');
      player._rvAhead=rvAhead;
    }
    bossAttack(rvK,dt);
    BK.updateHUD({player,time});
    // audio mesin
    BK.Audio.engine(Math.min(1,Math.abs(player.speed)/cfg.player.topSpeed),player.drifting,player.boostTime>0);

    // pemain yang tidak finis dulu membuat balapan berjalan selamanya: beri batas waktu
    if(player.finishTime==null){
      const rivals=racers.filter(k=>!k.isPlayer);
      let out=false;
      if(rivals.length){
        if(rivals.every(k=>k.finishTime!=null)){
          if(BK._dnfT==null){ BK._dnfT=DNF_GRACE; BK.flashMsg('⏱️ Lawan sudah finis! '+DNF_GRACE+' detik lagi'); }
          BK._dnfT-=dt; out=BK._dnfT<=0;
        }
      } else out=time>BK.Save.getRelicTarget(world.def.id)*2.2;
      if(out){ player.finishTime=time; player._cut=true; player.speed=0; }
    }
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

  // konfigurasi AI per kart: panglima sedikit di atas figuran, bos naik tiap putaran, bantuan bila kalah terus
  function aiCfgFor(k,diff){
    if(!k._boss&&!k._rival) return diff;
    const key=k._boss?'boss':BK.lastTrackId;
    const assist=Math.min(2.4,BK.Save.lossCount(key)*0.6);
    if(k._boss){
      const lap=Math.min(cfg.laps,k.lap||1);
      return Object.assign({},diff,{aiTop:diff.aiTop+0.4+lap*0.7-assist,rubber:diff.rubber*0.75,errMul:0,aggrMul:1.6});
    }
    return Object.assign({},diff,{aiTop:diff.aiTop+0.5-assist,errMul:(diff.errMul||0)*0.5});
  }
  // bos menyerang berkala: minyak bila memimpin, misil bila tertinggal
  function bossAttack(boss,dt){
    if(!BK.bossRace||!boss||boss.finishTime!=null||player.finishTime!=null) return;
    boss._atkT-=dt;
    if(boss._atkT>0) return;
    const lap=Math.min(cfg.laps,boss.lap||1);
    boss._atkT=(10-lap*1.5)+Math.random()*2.5;
    if(boss.spinTime>0) return;
    if(boss.progress>player.progress&&boss.progress-player.progress<40){
      BK.Items.dropOil(boss); bark('attackOil');
    } else if(player.progress>=boss.progress&&player.progress-boss.progress<30){
      BK.Items.fireMissile(boss,racers); bark('attackMissile');
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
    let won=order[0].isPlayer;
    if(BK.raceMode==='relic'){
      const tgt=BK.Save.getRelicTarget?BK.Save.getRelicTarget(world.def.id):82;
      won = player.finishTime <= tgt;
      if(won){
        const isNewRl = BK.Save.setRelic(world.def.id, player.finishTime);
        const rlCount = BK.Save.relicCount();
        rows.push({note:`⏱️ Relik Waktu didapat! (${BK.Save.fmt(player.finishTime)} < ${BK.Save.fmt(tgt)}) · ${rlCount}/4`, isPlayer:true});
        if(isNewRl) rows.push({note:'📖 Halaman baru di Jurnal: Catatan Tetua',isPlayer:true});
        BK.Audio.trophy();
      } else {
        rows.push({note:`⏱️ Gagal Relik: Waktu ${BK.Save.fmt(player.finishTime)} (Target < ${BK.Save.fmt(tgt)})`, isPlayer:true});
      }
    } else if(BK.raceMode==='token'){
      const all3 = TOKEN_LETTERS.every(l=>BK.tokenCollected[l]);
      if(won && all3){
        const isNewTk = BK.Save.setToken(world.def.id);
        const tkCount = BK.Save.tokenCount();
        rows.push({note:`🔤 Token B-K-T ${world.def.name} didapat! (${tkCount}/4)`, isPlayer:true});
        if(isNewTk) rows.push({note:'📖 Halaman baru di Jurnal: Catatan Tetua',isPlayer:true});
        BK.Audio.trophy();
      } else if(won && !all3){
        rows.push({note:`🔤 Juara 1, tapi huruf B-K-T belum lengkap. Coba lagi!`, isPlayer:true});
      }
    }
    if(BK.Music)BK.Music.play('finish');
    const isStoryMode=BK.raceMode==='trophy'||BK.raceMode==='boss';
    const lossKey=BK.bossRace?'boss':world.def.id;
    BK._retryPrimary=false;
    if(BK.raceMode==='trophy'&&won){
      if(BK.Save.setTrophy(world.def.id)){
        const tc=BK.Save.trophyCount();
        const ch=BK.Story.chapter(world.def.id);
        rows.push({note:'🏆 Piala '+world.def.name+' direbut! ('+tc+'/4)',isPlayer:true});
        if(ch&&ch.unlock){
          const uc=BK.charById(ch.unlock);
          BK.Save.setCharOpen(ch.unlock);
          rows.push({note:'🔓 '+uc.icon+' '+uc.name+' kini bisa dimainkan!',isPlayer:true});
          if(BK.refreshCharLocks)BK.refreshCharLocks();
        }
        BK.Audio.trophy();
        BK._pendingPost=BK.Story.postScene(world.def.id);
      }
    }
    if(won&&BK.Save.addCoins&&BK.raceMode!=='arcade'){
      const reward=BK.bossRace?5:2;
      BK.Save.addCoins(reward);
      rows.push({note:'🪙 +'+reward+' koin',isPlayer:true});
    }
    if(BK.bossRace&&won&&!BK.Save.hasBossKey()){
      BK.Save.setBossKey();
      BK.Save.setCharOpen('juara');
      rows.push({note:'🔑 Inti Permata kembali! 👑 Juara kini bisa dimainkan!',isPlayer:true});
      if(BK.refreshCharLocks)BK.refreshCharLocks();
      BK.Audio.keyFanfare();
      BK._pendingPost='boss_post';
    }
    if(isStoryMode){
      if(won) BK.Save.clearLoss(lossKey);
      else {
        const line=BK.Story.loseLine(lossKey);
        BK.Save.addLoss(lossKey);
        rows.push({note:line,isPlayer:true});
        if(BK.Save.lossCount(lossKey)>=2) rows.push({note:'🐚 Tetua: "Ambil napas. Lawanmu sedikit melambat setelah kamu kalah beberapa kali."',isPlayer:true});
        BK._retryPrimary=true;
      }
    }
    BK.refreshBest();
    if(BK.refreshHubStats)BK.refreshHubStats();
    BK.showResult(rows,won,newRecord,{retry:BK._retryPrimary,mode:BK.raceMode,order});
    BK.hide('countdown');
  }
  // layar hasil -> lanjut: adegan pasca-menang di trek, lalu pulang ke pulau
  BK.resultContinue=function(){
    if(state!=='done') return;
    if(BK.raceMode==='arcade'||!BK.Config.openworld){ BK.openMenu('done'); return; }
    if(BK._retryPrimary){ BK.restartSlot(); return; }
    const post=BK._pendingPost; BK._pendingPost=null;
    if(post){
      BK.hide('result');
      // pemenang dan yang kalah berhadapan di garis start
      const rv=rivalKart();
      if(rv){
        const s0=world.slot(0), s1=world.slot(1);
        [[player,s0],[rv,s1]].forEach(([k,sl])=>{
          k.pos.copy(sl.pos); k.heading=sl.heading; k.gy=sl.pos.y; k.worldY=sl.pos.y; k.speed=0; k.drifting=false; k.spinTime=0;
          k.mesh.position.copy(k.pos); k.mesh.rotation.set(0,k.heading,0);
        });
        racers.forEach(k=>{ if(k!==player&&k!==rv) k.mesh.visible=false; });
      }
      playScene(post,null,()=>BK.returnToHub());
      return;
    }
    BK.returnToHub();
  };
  // keluar balapan langsung ke pulau (dari jeda / hasil)
  BK.backToHubFromRace=function(){
    paused=false; BK.hide('pause'); BK.hide('result');
    if(BK.Config.openworld) BK.returnToHub();
  };

  function loop(t){
    requestAnimationFrame(loop);
    if(!lastT)lastT=t;
    let dt=(t-lastT)/1000; lastT=t;
    if(dt>0.25)dt=0.25;
    if(state==='cutscene'){
      const nowS=performance.now()/1000;
      if(world&&world.update) world.update(dt,nowS);
      if(BK.updateParticles) BK.updateParticles(dt);
      BK.Cutscene.update(dt,nowS);
      renderer.render(scene,camera);
      return;
    }
    if(state==='countdown'){
      countdownT-=dt;
      const n=Math.ceil(countdownT-0.6);
      const el=document.getElementById('countdown');
      if(countdownT<=0.6){
        el.textContent='GO!';
        if(cdStep!==0){cdStep=0;BK.Audio.count(0);
          el.classList.remove('cd-pop'); void el.offsetWidth; el.classList.add('cd-pop');
          if(world.setStartLights) world.setStartLights(0);
          if(world.notifyGo) world.notifyGo();
          // start boost: tekan gas saat angka 1. Tertahan sejak awal = mesin banjir, tanpa boost
          const inp=playerInput();
          if(inp.gas&&_gasOnOne&&!_gasEarly){player.boostTime=1.1;player.boostPower=14;BK.flashMsg('START BOOST! 🚀');BK.Audio.boost();}
          else if(inp.gas&&_gasEarly&&!IS_COARSE){BK.flashMsg('Terlalu cepat, mesin banjir!');}
          lapStart=0;
        }
        if(countdownT<=0){ BK.hide('countdown'); state='racing'; }
      } else if(n!==cdStep&&n>=1&&n<=3){ cdStep=n; el.textContent=n; BK.Audio.count(n);
        el.classList.remove('cd-pop'); void el.offsetWidth; el.classList.add('cd-pop');
        if(world.setStartLights) world.setStartLights(n); }
      if(countdownT>0.6){
        const g=playerInput().gas;
        if(g){ if(cdStep>1) _gasEarly=true; else _gasOnOne=true; }
        else if(cdStep>1) _gasEarly=false; // sempat lepas: boleh coba lagi saat angka 1
        BK.Audio.engine(g?0.45:0.08,false,false);
      }
      // kamera tetap update biar hidup (swoop dari depan grid ke belakang kart)
      BK.updateCamera(camera,player,dt);
      world.update(dt,performance.now()/1000);
      BK.updateParticles(dt);
      renderer.render(scene,camera);
      return;
    }
    if((state==='racing'||state==='roam')&&!paused){
      // langkah mengikuti waktu frame (dipecah maks 1/60): tanpa sentakan 0/2 langkah per frame,
      // tanpa sisa `acc` yang menumpuk jadi fast-forward setelah frame lambat
      acc=dt;
      let n=0;
      while(acc>1e-5&&n<16){
        const h=Math.min(acc,STEP);
        if(state==='roam')roamStep(h); else step(h);
        acc-=h; n++;
        if(state!=='racing'&&state!=='roam')break;
      }
      acc=0;
      if(state==='racing'||state==='roam'){
        world.update(dt,performance.now()/1000);
        BK.updateParticles(dt);
        BK.updateCamera(camera,player,dt);
        if(state==='roam')BK.drawMinimap(world,[player]); else BK.drawMinimap(world,racers);
      }
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
    // tombol yang ditahan tidak boleh melewati dialog/konfirmasi beruntun
    if(e.repeat&&(e.code==='Enter'||e.code==='Space'||e.code==='Escape'||e.code==='KeyP')) return;
    if(BK.isCardOpen&&BK.isCardOpen()){ if(e.code==='Enter'||e.code==='Space'||e.code==='Escape'){ keys.Enter=keys.Space=false; BK.skipCard(); } return; }
    if(state==='cutscene'){
      if(e.code==='Enter'||e.code==='Space'){ keys.Enter=keys.Space=false; BK.Cutscene.next(); }
      else if(e.code==='Escape'){ BK.Cutscene.skip(); }
      return;
    }
    const jr=document.getElementById('journal');
    if(jr&&!jr.classList.contains('hidden')&&(e.code==='Escape'||e.code==='Enter')){ keys.Enter=false; BK.closeJournal(); return; }
    const shModal=document.getElementById('shrine-modal');
    if(shModal && !shModal.classList.contains('hidden') && (e.code==='Escape'||e.code==='Enter')){
      keys.Enter=false;
      if(BK.closeShrineModal) BK.closeShrineModal();
      return;
    }
    if(e.code==='KeyP'||e.code==='Escape'){
      if(state==='menu'&&(BK._menuOrigin==='roam'||BK._menuOrigin==='racing')){ BK.closeMenuBack(); return; }
      BK.togglePause();
    }
    // pilih mode tantangan di portal pulau dengan tombol angka 1 / 2 / 3
    if(state==='roam'&&!paused&&BK._portalTarget&&(e.code==='Digit1'||e.code==='Digit2'||e.code==='Digit3')){
      const mMap={Digit1:'trophy',Digit2:'token',Digit3:'relic'};
      const want=mMap[e.code];
      if(want!=='trophy'&&!BK.Save.hasTrophy(BK._portalTarget.trackId)){
        BK.flashMsg('🔒 Rebut 🏆 Piala trek ini dulu');
        if(BK.Audio&&BK.Audio.hit)BK.Audio.hit();
      } else if(BK.showPortalModal){
        BK.showPortalModal(BK._portalTarget, want);
        if(BK.Audio&&BK.Audio.item)BK.Audio.item();
      }
      return;
    }
    // konfirmasi masuk portal/pintu bos/garasi/kuil di pulau (hanya saat prompt tampil)
    if(e.code==='Enter'&&state==='roam'&&!paused){
      if(BK._portalTarget){ keys.Enter=false; enterRaceFromHub(BK._portalTarget, BK._portalRaceMode||'trophy'); return; }
      if(BK._bossTarget){ keys.Enter=false; enterBossRace(); return; }
      if(BK._garageTarget){ keys.Enter=false; BK.openMenu('roam'); return; }
      if(BK._shrineTarget){ keys.Enter=false; if(BK.openShrineModal)BK.openShrineModal(); return; }
    }
    // di layar hasil balapan: Enter langsung lanjut ke pulau (mode Adventure) atau kembali ke menu trek (mode Arcade)
    if(e.code==='Enter'&&state==='done'){
      keys.Enter=false;
      BK.resultContinue();
      return;
    }
    // di layar menu utama: Enter jalankan mode yang dipilih (Adventure / Arcade)
    if(e.code==='Enter'&&state==='menu'){
      const hlp=document.getElementById('help');
      if((!hlp||hlp.classList.contains('hidden'))&&!BK._entering){
        keys.Enter=false;
        const curSel=BK.getSelection();
        if(curSel.mode==='arcade'||!BK.Config.openworld){
          BK.hubOrigin=null; startRace(undefined,'arcade');
          return;
        } else if(BK.Config.openworld){
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
    if(paused&&e.code==='KeyJ'&&BK.openJournal){ BK.openJournal(); }
    if(state==='menu'&&(e.code==='ArrowLeft'||e.code==='ArrowRight')){ if(BK.charStep)BK.charStep(e.code==='ArrowRight'?1:-1); }
    if(e.code==='KeyR'){
      if(state==='roam'&&world.isHub){
        player.pos.copy(world.startPos); player.heading=world.startHeading; player.speed=0;
        player.gy=world.heightAt?world.heightAt(player.pos.x,player.pos.z):world.startPos.y;
        player.pos.y=player.gy; player.worldY=player.gy; player.airY=0; player.vy=0; player.grounded=true;
        player._bumpVx=0; player._bumpVz=0;
      }
      else if((state==='racing'&&!paused)||state==='done') BK.restartSlot();
    }
  });
  addEventListener('keyup',e=>{keys[e.code]=false;});
  // pindah jendela: lepas semua tombol (dulu gas bisa macet tertekan)
  addEventListener('blur',()=>{ keys={}; BK.touch.left=BK.touch.right=BK.touch.drift=BK.touch.brake=false; });
  addEventListener('pointerdown',()=>{ BK.Audio.unlock(); if(BK.Music)BK.Music.unlock(); });
  // tab disembunyikan = jeda otomatis (balapan/pulau)
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&(state==='racing'||state==='roam')&&!paused) BK.togglePause(true);
  });

  BK.init=function(){
    setupRenderer();
    BK.initUI(()=>{ BK.hubOrigin=null; startRace(undefined,'arcade'); });
    // Bangun pulau hub 3D sebagai latar hidup sejak awal
    sel=BK.getSelection();
    world=BK.buildHub(scene);
    world._builtTrophies=BK.Save.trophyCount();
    world._builtTokens=BK.Save.tokenCount();
    world._builtRelics=BK.Save.relicCount();
    world._builtKey=BK.Save.hasBossKey();
    BK.Items.reset(scene,world);
    player=BK.createKart(scene,sel.charId,true);
    player.name='Kamu '+player.char.icon;
    player.pos.copy(world.startPos); player.heading=world.startHeading;
    player.gy=world.heightAt?world.heightAt(player.pos.x,player.pos.z):world.startPos.y;
    player.pos.y=player.gy; player.worldY=player.gy; player.airY=0; player.vy=0; player.grounded=true;
    player.mesh.position.copy(player.pos); player.mesh.rotation.y=player.heading;
    racers=[player]; BK.playerKart=player;
    state='menu'; paused=false;
    if(BK.Music)BK.Music.autoplay();
    requestAnimationFrame(loop);
    // pengait uji headless: sim deterministik tanpa bergantung FPS (tidak dipakai saat bermain)
    BK._dev={
      get state(){return state;}, get paused(){return paused;}, get world(){return world;}, get racers(){return racers;},
      get player(){return player;}, get time(){return time;}, get camera(){return camera;}, get renderer(){return renderer;}, get scene(){return scene;},
      step(h){ if(state==='roam')roamStep(h); else if(state==='racing')step(h); },
      skipCountdown(){ countdownT=0; if(state==='countdown'){ BK.hide('countdown'); state='racing'; } },
      setInput(fn){ BK._devInput=fn; }, startRace, playScene
    };
  };
  document.addEventListener('DOMContentLoaded',BK.init);
})();
