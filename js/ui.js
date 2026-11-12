/* UI: menu trek/diff, HUD, minimap, pesan */
(function(){
  const $=id=>document.getElementById(id);
  BK.Save.migrateStory();
  let selTrack=BK.Tracks[0].id, selDiff=BK.Save.getDiff(), selChar=BK.Save.getChar(), lastOpenChar='turbo';
  let selMode=BK.Config.openworld?'adventure':'arcade';

  BK.getSelection=function(){
    // kartu terkunci boleh dilihat di carousel, tapi yang berangkat tetap pembalap terbuka terakhir
    const c=BK.charById(selChar);
    const usable=(c&&c.locked&&!BK.Save.charOpen(c.id))?lastOpenChar:selChar;
    return {trackId:selTrack, diff:selDiff, charId:usable, mode:selMode};
  };

  BK.setMenuMode=function(mode){
    if(!BK.Config.openworld) mode='arcade';
    selMode=(mode==='arcade')?'arcade':'adventure';
    document.querySelectorAll('#mode-list button').forEach(b=>{
      b.classList.toggle('active', b.dataset.mode===selMode);
    });
    const advCard=$('adventure-card'), tl=$('track-list'), broam=$('btn-roam'), bstart=$('btn-start');
    if(advCard) advCard.classList.toggle('hidden', selMode!=='adventure');
    if(tl) tl.classList.toggle('hidden', selMode!=='arcade');
    if(broam) broam.classList.toggle('hidden', selMode!=='adventure');
    if(bstart) bstart.classList.toggle('hidden', selMode!=='arcade');
  };

  // HP: layar penuh + kunci lanskap. Wajib dipanggil dari gesture pengguna.
  // Android Chrome mendukung; iPhone tidak (overlay #rotate-hint yang memandu).
  BK.goLandscape=function(){
    const coarse=window.matchMedia&&matchMedia('(pointer:coarse)').matches;
    if(!coarse) return;
    const d=document.documentElement;
    const lock=()=>{ try{ const o=screen.orientation; if(o&&o.lock) o.lock('landscape').catch(()=>{}); }catch(e){} };
    try{
      if(!document.fullscreenElement&&d.requestFullscreen){
        const p=d.requestFullscreen({navigationUI:'hide'});
        if(p&&p.then) p.then(lock).catch(()=>{}); else lock();
      } else lock();
    }catch(e){}
  };

  BK.initUI=function(onStart){
    // Tanpa layar sambutan: gesture PERTAMA di mana saja membuka audio (kebijakan autoplay browser)
    // + layar penuh/lanskap di HP. pointerup/keydown = aktivasi pengguna yang sah (pointerdown sentuh tidak).
    const firstGesture=()=>{
      removeEventListener('pointerup',firstGesture,true);
      removeEventListener('keydown',firstGesture,true);
      BK._gestureT=performance.now();
      BK.goLandscape();
      BK.Audio.unlock();
      if(BK.Music) BK.Music.unlock();
    };
    addEventListener('pointerup',firstGesture,true);
    addEventListener('keydown',firstGesture,true);
    // tombol musik: tampilkan status, M untuk toggle
    const bSound=$('btn-sound');
    const paintSound=()=>{ if(!bSound||!BK.Music) return; const m=BK.Music.isMuted();
      bSound.textContent=m?'🔇':'🔊'; bSound.setAttribute('aria-label',m?'Nyalakan musik':'Matikan musik'); bSound.classList.toggle('off',m); };
    const toggleMusic=()=>{ if(!BK.Music) return; BK.Music.toggle(); BK.Music.unlock(); paintSound(); };
    if(bSound) bSound.onclick=()=>{
      // klik ini sekaligus gesture pertama yang baru saja menyalakan musik: jangan langsung dimatikan lagi
      if(BK._gestureT&&performance.now()-BK._gestureT<400&&!BK.Music.isMuted()){ paintSound(); return; }
      toggleMusic();
    };
    addEventListener('keydown',e=>{ if(e.code==='KeyM'&&!e.repeat&&!$('menu').classList.contains('hidden')) toggleMusic(); });
    paintSound();
    // mulai ulang cerita: dua langkah agar progres tak hilang karena sekali klik
    const bNew=$('btn-new-story');
    let confirmNew=false;
    if(bNew) bNew.onclick=()=>{
      if(!confirmNew){ confirmNew=true; bNew.textContent='⚠️ Progres akan dihapus. Klik lagi untuk yakin'; bNew.classList.add('danger');
        setTimeout(()=>{ confirmNew=false; bNew.textContent='↺ Mulai ulang cerita'; bNew.classList.remove('danger'); },4000); return; }
      confirmNew=false;
      BK.Save.resetStory(); if(BK.refreshCharLocks) BK.refreshCharLocks();
      bNew.textContent='↺ Mulai ulang cerita'; bNew.classList.remove('danger');
      BK.refreshMenuForStory();
      if(BK.Audio&&BK.Audio.item)BK.Audio.item();
    };
    document.querySelectorAll('#mode-list button').forEach(b=>{
      b.onclick=()=>{
        BK.Audio.unlock();
        if(BK.Audio&&BK.Audio.item)BK.Audio.item();
        BK.setMenuMode(b.dataset.mode);
      };
    });
    BK.setMenuMode(selMode);
    // aksen warna lembut per trek & per pembalap (sudah diuji kontras ≥5:1 di panel menu)
    const TRACK_UI={pantai:'#78b8ec',hutan:'#8fd09c',kawah:'#ec9a62',salju:'#a9dcef'};
    const CHAR_UI={turbo:'#9fd06e',besi:'#a9bbd0',hantu:'#b7a2f2',spora:'#ee9184',bara:'#ec9a62',balnok:'#78b8ec',krambil:'#dcae6e',juara:'#f0c95e'};
    const tl=$('track-list');
    tl.innerHTML='';
    const bestEls={};
    BK.Tracks.forEach(t=>{
      const d=document.createElement('div');
      d.className='track-card'+(t.id===selTrack?' active':'');
      d.style.setProperty('--trk',TRACK_UI[t.id]||'#f0c95e');
      d.innerHTML=`<div class="thumb">${t.icon}</div><b>${t.name}</b><span class="tdesc">${t.desc}</span><span class="tbest"></span>`;
      bestEls[t.id]=d.querySelector('.tbest');
      d.onclick=()=>{ selTrack=t.id;
        tl.querySelectorAll('.track-card').forEach(x=>x.classList.remove('active'));
        d.classList.add('active'); BK.Audio.unlock(); refreshBest(); };
      tl.appendChild(d);
    });
    // --- carousel karakter geser + preview 3D ---
    const cl=$('char-list');
    cl.innerHTML='';
    const dotsBox=$('char-dots'); dotsBox.innerHTML='';
    let charIdx=Math.max(0,BK.Characters.findIndex(c=>c.id===selChar));
    const cards=[];
    const isLocked=c=>!!(c.locked&&!BK.Save.charOpen(c.id)); // boolean murni: toggle(x,undefined) membalik kelas!
    function paintCard(k){
      const c=BK.Characters[k], d=cards[k], locked=isLocked(c);
      d.className='char-card'+(locked?' locked':'')+(k===charIdx?' active':'');
      d.innerHTML=locked
        ? `<b>🔒 ${c.name}</b><span>${c.unlockDesc}</span>`
        : `<b>${c.name}</b><span>${c.desc}</span>`;
    }
    BK.Characters.forEach((c,k)=>{
      const d=document.createElement('div');
      d.onclick=()=>{ if(isLocked(c)){ BK.Audio.hit(); } else setChar(k); };
      cl.appendChild(d); cards.push(d);
      const dot=document.createElement('i');
      dot.onclick=()=>setChar(k); dotsBox.appendChild(dot);
    });
    // kartu dulu membeku sejak menu dibuat: pembalap yang baru terbuka tetap tampak terkunci sampai reload
    BK.refreshCharLocks=function(){ BK.Characters.forEach((c,k)=>paintCard(k)); };
    function renderCharStats(){
      const st=$('char-stats');
      if(!st) return;
      const c0=BK.Characters[charIdx];
      $('menu').style.setProperty('--char',CHAR_UI[c0.id]||'#f0c95e');
      st.innerHTML=Object.entries(c0.bars).map(([kb,v])=>
        `<div class="stat"><span>${kb}</span><div class="pips">${[1,2,3,4,5].map(i=>
          `<i class="${i<=v?'on':''}"></i>`).join('')}</div></div>`).join('');
    }
    function setChar(k){
      charIdx=(k+BK.Characters.length)%BK.Characters.length;
      selChar=BK.Characters[charIdx].id;
      const lockedNow=isLocked(BK.Characters[charIdx]);
      if(!lockedNow){ lastOpenChar=selChar; BK.Save.setChar(selChar); }
      cl.style.transform=`translateX(-${charIdx*100}%)`;
      cards.forEach((d,i)=>d.classList.toggle('active',i===charIdx));
      dotsBox.querySelectorAll('i').forEach((d,i)=>d.classList.toggle('on',i===charIdx));
      renderCharStats();
      BK.previewChar(selChar);
      // langsung diterapkan ke kart yang sedang dipakai (pulau/balap), hanya bila sudah terbuka
      if(BK.applyChar&&!lockedNow)BK.applyChar(selChar);
      const startB=$('btn-roam'), startA=$('btn-start');
      [startB,startA].forEach(b=>{ if(b) b.classList.toggle('dim-lock',lockedNow); });
      if(BK.refreshPauseChar)BK.refreshPauseChar();
    }
    // dipanggil game.js setelah ganti dari jeda: samakan carousel tanpa loop
    BK.syncCharUI=function(id){
      const k=BK.Characters.findIndex(c=>c.id===id);
      if(k<0||k===charIdx) { if(BK.refreshPauseChar)BK.refreshPauseChar(); return; }
      charIdx=k; selChar=id;
      [$('btn-roam'),$('btn-start')].forEach(b=>{ if(b) b.classList.toggle('dim-lock',isLocked(BK.Characters[k])); });
      cl.style.transform=`translateX(-${charIdx*100}%)`;
      cards.forEach((d,i)=>d.classList.toggle('active',i===charIdx));
      dotsBox.querySelectorAll('i').forEach((d,i)=>d.classList.toggle('on',i===charIdx));
      renderCharStats();
      BK.previewChar(selChar);
      if(BK.refreshPauseChar)BK.refreshPauseChar();
    };
    BK.charStep=d=>{ setChar(charIdx+d); BK.Audio.unlock(); };
    $('char-prev').onclick=()=>BK.charStep(-1);
    $('char-next').onclick=()=>BK.charStep(1);
    const view=$('char-view');
    let swX=null;
    view.addEventListener('touchstart',e=>{swX=e.touches[0].clientX;},{passive:true});
    view.addEventListener('touchend',e=>{
      if(swX==null)return; const dx=e.changedTouches[0].clientX-swX; swX=null;
      if(Math.abs(dx)>40) BK.charStep(dx<0?1:-1);
    });
    view.addEventListener('mousedown',e=>{swX=e.clientX;});
    view.addEventListener('mouseup',e=>{
      if(swX==null)return; const dx=e.clientX-swX; swX=null;
      if(Math.abs(dx)>40) BK.charStep(dx<0?1:-1);
    });
    BK.initPreview();
    if(isLocked(BK.Characters[charIdx])) charIdx=0;
    BK.refreshCharLocks();
    setChar(charIdx);
    document.querySelectorAll('#diff-list button').forEach(b=>{
      b.classList.toggle('active',b.dataset.diff===selDiff);
      b.onclick=()=>{ selDiff=b.dataset.diff; BK.Save.setDiff(selDiff);
        document.querySelectorAll('#diff-list button').forEach(x=>x.classList.remove('active'));
        b.classList.add('active'); BK.Audio.unlock(); };
    });
    $('btn-start').onclick=()=>{ BK.Audio.unlock(); onStart(); };
    // dulu dipanggil saat layar sambutan ditutup: label KE PULAU / tautan mulai ulang sejak awal
    if(BK.refreshMenuForStory) BK.refreshMenuForStory();
    $('btn-help').onclick=()=>{ $('menu').classList.add('hidden'); $('help').classList.remove('hidden'); };
    $('btn-back').onclick=()=>{ $('help').classList.add('hidden'); $('menu').classList.remove('hidden'); };
    $('btn-resume').onclick=()=>BK.togglePause(false);
    const bcp=$('btn-char-prev'), bcn=$('btn-char-next');
    if(bcp)bcp.onclick=()=>{ if(BK.switchChar)BK.switchChar(-1); };
    if(bcn)bcn.onclick=()=>{ if(BK.switchChar)BK.switchChar(1); };
    BK.refreshPauseChar=function(){
      const el=$('pause-char'); if(!el) return;
      const k=BK.playerKart;
      const c=k&&k.char?k.char:BK.charById('turbo');
      el.textContent=c.icon+' '+c.name;
    };
    BK.refreshPauseChar();
    $('btn-restart2').onclick=()=>BK.restartSlot&&BK.restartSlot();
    $('btn-quit').onclick=()=>{ if(BK._pauseQuitsToHub) BK.backToHubFromRace(); else if(BK.openMenu) BK.openMenu(); };
    $('btn-journal').onclick=()=>BK.openJournal();
    $('btn-journal-close').onclick=()=>BK.closeJournal();
    $('btn-restart').onclick=()=>BK.restartSlot&&BK.restartSlot();
    $('btn-menu').onclick=()=>{ if(BK.raceMode==='arcade'){ BK.openMenu('done'); } else BK.backToHubFromRace(); };
    $('dlg-skip').onclick=(e)=>{ e.stopPropagation(); BK.Cutscene.skip(); };
    const bback2=$('btn-back2'); if(bback2)bback2.onclick=()=>{ if(BK.closeMenuBack)BK.closeMenuBack(); };
    const bhub=$('btn-hub');
    if(bhub){
      bhub.onclick=()=>BK.resultContinue();
    }
    const broam=$('btn-roam');
    if(broam){
      broam.onclick=()=>{
        BK.Audio.unlock();
        if(!BK.Config.openworld) return; // katup open-world (config.js)
        if(BK._menuOrigin==='roam'&&BK.closeMenuBack) BK.closeMenuBack();
        else if(BK.startRoam) BK.startRoam();
      };
      if(!BK.Config.openworld){ broam.classList.add('hidden'); broam.disabled=true; }
    }
    // sentuh
    const bind=(id,down,up)=>{
      const el=$(id);
      const on=e=>{e.preventDefault();el.classList.add('on');down();}, off=e=>{e.preventDefault();el.classList.remove('on');up&&up();};
      el.addEventListener('touchstart',on,{passive:false});
      el.addEventListener('touchend',off); el.addEventListener('touchcancel',off);
      el.addEventListener('mousedown',on); el.addEventListener('mouseup',off); el.addEventListener('mouseleave',off);
    };
    // Setir: satu pad untuk ◀ ▶. Jempol boleh digeser kiri-kanan tanpa diangkat;
    // sisi ditentukan dari posisi sentuhan terhadap tengah pad (multi-touch aman).
    const steer=$('t-steer'), stL=$('t-left'), stR=$('t-right');
    const steerTouches=new Map();
    const steerSync=()=>{
      let l=false, r=false;
      steerTouches.forEach(side=>{ if(side<0)l=true; else r=true; });
      BK.touch.left=l; BK.touch.right=r;
      stL.classList.toggle('on',l); stR.classList.toggle('on',r);
    };
    const steerSide=t=>{ const b=steer.getBoundingClientRect(); return t.clientX<b.left+b.width/2?-1:1; };
    const steerMove=e=>{ e.preventDefault(); for(const t of e.changedTouches) steerTouches.set(t.identifier,steerSide(t)); steerSync(); };
    const steerEnd=e=>{ e.preventDefault(); for(const t of e.changedTouches) steerTouches.delete(t.identifier); steerSync(); };
    steer.addEventListener('touchstart',steerMove,{passive:false});
    steer.addEventListener('touchmove',steerMove,{passive:false});
    steer.addEventListener('touchend',steerEnd,{passive:false});
    steer.addEventListener('touchcancel',steerEnd,{passive:false});
    // mouse (laptop layar sentuh / uji di desktop)
    const mBind=(el,key)=>{
      const on=()=>{BK.touch[key]=true; el.classList.add('on');}, off=()=>{BK.touch[key]=false; el.classList.remove('on');};
      el.addEventListener('mousedown',on); el.addEventListener('mouseup',off); el.addEventListener('mouseleave',off);
    };
    mBind(stL,'left'); mBind(stR,'right');
    bind('t-drift',()=>BK.touch.drift=true,()=>BK.touch.drift=false);
    bind('t-brake',()=>BK.touch.brake=true,()=>BK.touch.brake=false);
    bind('t-item',()=>{ BK.touch.itemPressed=true; });
    bind('t-pause',()=>BK.togglePause(),null);
    refreshBest(); BK.refreshHubStats();
  };
  function refreshBest(){
    const cards=document.querySelectorAll('#track-list .track-card');
    BK.Tracks.forEach((t,i)=>{
      const b=BK.Save.getBest(t.id);
      const won=BK.Save.hasTrophy(t.id);
      const el=cards[i]&&cards[i].querySelector('.tbest');
      if(el) el.textContent=(won?'🏆 ':'')+'⏱ '+BK.Save.fmt(b);
    });
  }
  BK.refreshBest=refreshBest;
  BK.refreshHubStats=function(){
    const el=$('hub-stats'); if(!el) return;
    const t=BK.Save.trophyCount();
    const tk=BK.Save.tokenCount?BK.Save.tokenCount():0;
    const rl=BK.Save.relicCount?BK.Save.relicCount():0;
    const pct=BK.Save.getAdventurePct?BK.Save.getAdventurePct():0;
    const rank=BK.Save.getAdventureRank?BK.Save.getAdventureRank():'';
    const coins=BK.Save.getCoins?BK.Save.getCoins():0;
    el.innerHTML=`📊 <b>${pct}%</b> • 🏆 ${t}/4 • 🔤 ${tk}/4 • ⏱️ ${rl}/4 • 🪙 ${coins}`;
  };
  // prompt konfirmasi portal di pulau (pilihan 3 mode balapan)
  BK._portalRaceMode='trophy';
  BK.showPortalPrompt=function(html){
    const el=$('portal-prompt'); if(!el) return;
    el.innerHTML=html; el.classList.remove('hidden');
    el.onclick=()=>{ if(BK.confirmPortal)BK.confirmPortal(); };
  };
  BK.showPortalModal=function(portal, forcedMode){
    const el=$('portal-prompt'); if(!el||!portal) return;
    const hasT=BK.Save.hasTrophy(portal.trackId);
    const hasTk=BK.Save.hasToken?BK.Save.hasToken(portal.trackId):false;
    const hasRl=BK.Save.hasRelic?BK.Save.hasRelic(portal.trackId):false;
    const best=BK.Save.getBest(portal.trackId);
    const targetRl=BK.Save.getRelicTarget?BK.Save.getRelicTarget(portal.trackId):82;
    if(!forcedMode){
      if(!hasT) BK._portalRaceMode='trophy';
      else if(!hasTk) BK._portalRaceMode='token';
      else if(!hasRl) BK._portalRaceMode='relic';
      else BK._portalRaceMode='trophy';
    } else {
      BK._portalRaceMode=forcedMode;
    }
    const m=BK._portalRaceMode;
    const bTxt=best!=null?' • Rekor: '+BK.Save.fmt(best):'';
    el.innerHTML=`
      <div>🏁 <b>${portal.name}</b> <small style="display:inline;opacity:.85">(Bab ${portal.stage}${bTxt})</small></div>
      <div class="portal-modes">
        <button type="button" data-pmode="trophy" class="${m==='trophy'?'active':''}">
          <span>[1] 🏆 Piala ${hasT?'✅':''}</span>
          <small>Kalahkan panglima</small>
        </button>
        <button type="button" data-pmode="token" class="${m==='token'?'active':''} ${!hasT?'locked':''}">
          <span>[2] 🔤 Token B-K-T ${hasTk?'✅':(hasT?'':'🔒')}</span>
          <small>${hasT?'Ambil B-K-T + juara 1':'Rebut Piala dulu'}</small>
        </button>
        <button type="button" data-pmode="relic" class="${m==='relic'?'active':''} ${!hasT?'locked':''}">
          <span>[3] ⏱️ Relik Waktu ${hasRl?'✅':(hasT?'':'🔒')}</span>
          <small>${hasT?'Target < '+BK.Save.fmt(targetRl):'Rebut Piala dulu'}</small>
        </button>
      </div>
      <small>${matchMedia('(pointer:coarse)').matches?'<b>Ketuk di sini</b> untuk mulai':'<b>Enter</b> mulai • <b>1 / 2 / 3</b> ganti tantangan'}</small>
    `;
    el.classList.remove('hidden');
    el.onclick=(ev)=>{
      const btn=ev.target.closest('button[data-pmode]');
      if(btn){
        ev.stopPropagation();
        const pm=btn.dataset.pmode;
        if(pm!=='trophy'&&!hasT){
          BK.flashMsg('🔒 Rebut 🏆 Piala trek ini dulu');
          if(BK.Audio&&BK.Audio.hit)BK.Audio.hit();
          return;
        }
        if(BK._portalRaceMode===pm){
          if(BK.confirmPortal)BK.confirmPortal(pm);
        } else {
          BK.showPortalModal(portal, pm);
          if(BK.Audio&&BK.Audio.item)BK.Audio.item();
        }
        return;
      }
      if(BK.confirmPortal)BK.confirmPortal(BK._portalRaceMode);
    };
  };
  BK.hidePortalPrompt=function(){
    const el=$('portal-prompt'); if(!el) return;
    el.classList.add('hidden'); el.onclick=null;
  };

  // Dialog Cutscene 3D Petualangan
  BK.showDialogStep=function(step, onNext){
    const box=$('adv-dialog'); if(!box) return;
    setAvatar($('dlg-avatar'),step.who);
    $('dlg-speaker').textContent=step.speaker||'';
    $('dlg-text').innerHTML=step.text||'';
    $('dlg-progress').textContent=(step.step+1)+' / '+step.total;
    const btn=$('dlg-next');
    if(btn){
      btn.textContent=step.btnText||'Lanjut ▶';
      btn.onclick=(e)=>{ e.stopPropagation(); if(onNext)onNext(); };
    }
    box.onclick=()=>{ if(onNext)onNext(); };
    box.classList.remove('hidden');
    box.classList.remove('dlg-in'); void box.offsetWidth; box.classList.add('dlg-in');
  };
  BK.setDialogText=function(html){ $('dlg-text').innerHTML=html; };
  BK.isDialogOpen=function(){ return !$('adv-dialog').classList.contains('hidden'); };
  BK.setLetterbox=function(on){ $('letterbox').classList.toggle('off',!on); };

  // potret 3D pemeran: dirender sekali ke gambar lewat renderer preview, tetap offline
  const portraits={};
  function portraitOf(who){
    if(portraits[who]!==undefined) return portraits[who];
    const c=BK.Story.CAST[who];
    if(!pv||!c||!BK.buildCastRig){ return portraits[who]=null; }
    try{
      const rig=BK.buildCastRig(who);
      const prev=pv.snail; if(prev) prev.visible=false;
      const camPos=pv.cam.position.clone();
      const sc=rig.scale.x;
      rig.rotation.y=0.32;
      pv.scene.add(rig);
      // bidik dari ukuran asli rig: tinggi tiap pemeran beda jauh, siput bertangkai mata tinggi
      rig.updateMatrixWorld(true);
      const bb=new THREE.Box3().setFromObject(rig), bs=bb.getSize(new THREE.Vector3());
      const span=bs.y*0.46;                            // wajah selalu di bagian atas rig
      const cy=bb.max.y-span*0.5+bs.y*0.01;
      const d=span*0.56/Math.tan(pv.cam.fov*Math.PI/360);
      pv.cam.position.set(bs.x*0.05,cy+span*0.08,bb.max.z+d); pv.cam.lookAt(0,cy,bb.max.z*0.5);
      const li0=pv.lights.map(l=>l.intensity);
      pv.lights.forEach((l,i)=>{ l.intensity=li0[i]*0.62; }); // lampu menu terlalu terang untuk warna pucat
      pv.renderer.render(pv.scene,pv.cam);
      const url=$('char-preview').toDataURL('image/png');
      pv.lights.forEach((l,i)=>{ l.intensity=li0[i]; });
      pv.scene.remove(rig);
      if(prev) prev.visible=true;
      pv.cam.position.copy(camPos); pv.cam.lookAt(0,1.4,0);
      // pemain bisa berganti karakter: potretnya jangan dicache
      if(c.player) return url;
      return portraits[who]=url;
    }catch(e){ return portraits[who]=null; }
  }
  function setAvatar(el,who){
    const c=BK.Story.CAST[who]||{};
    const url=portraitOf(who);
    if(url) el.innerHTML='<img alt="" src="'+url+'">';
    else el.textContent=c.emoji||'🐌';
  }

  // kartu layar penuh (judul bab / kredit): Enter melewati
  let card=null;
  BK.isCardOpen=()=>!!card;
  BK.skipCard=function(){ if(card) card.close(); };
  BK.titleCard=function(t,done){
    const el=$('title-card');
    $('tc-kicker').textContent=t.kicker||''; $('tc-title').textContent=t.title||''; $('tc-sub').textContent=t.sub||'';
    el.classList.remove('hidden','tc-out');
    const f=$('fade'); if(f) f.style.opacity=0;
    let closed=false;
    const close=()=>{
      if(closed) return; closed=true; card=null; clearTimeout(tm);
      el.classList.add('tc-out');
      setTimeout(()=>el.classList.add('hidden'),420);
      if(done) done();
    };
    const tm=setTimeout(close,2600);
    card={close};
  };
  BK.showCredits=function(done){
    const box=$('credits'), roll=$('credits-roll');
    roll.innerHTML=BK.Story.credits.map(c=>c.h?`<h3>${c.h}</h3>`:`<p>${c.p}</p>`).join('');
    box.classList.remove('hidden');
    roll.style.animation='none'; void roll.offsetWidth; roll.style.animation='';
    let closed=false;
    const close=()=>{ if(closed) return; closed=true; card=null; clearTimeout(tm); box.classList.add('hidden'); if(done) done(); };
    const tm=setTimeout(close,17000);
    card={close};
  };

  // obrolan singkat (warga di pulau, celetukan rival saat balapan)
  let speechT=null;
  BK.speech=function(who,text){
    const c=BK.Story.CAST[who]||{name:who};
    setAvatar($('sp-avatar'),who);
    $('sp-name').textContent=c.name;
    $('sp-text').textContent=text;
    const el=$('speech');
    el.classList.remove('hidden','sp-out');
    clearTimeout(speechT);
    speechT=setTimeout(()=>{ el.classList.add('sp-out'); speechT=setTimeout(()=>el.classList.add('hidden'),260); },1500+text.length*42);
  };
  let objT=null;
  BK.showObjective=function(){
    const el=$('objective');
    $('obj-chapter').textContent=BK.Story.chapterLabel();
    $('obj-text').textContent=BK.Story.objective();
    el.classList.remove('hidden','obj-out');
    clearTimeout(objT);
    objT=setTimeout(()=>{ el.classList.add('obj-out'); objT=setTimeout(()=>el.classList.add('hidden'),380); },3600);
  };
  let rbT=null;
  BK.raceBanner=function(kicker,title){
    const el=$('race-banner');
    $('rb-kicker').textContent=kicker||''; $('rb-title').textContent=title||'';
    el.classList.remove('hidden','obj-out');
    clearTimeout(rbT);
    rbT=setTimeout(()=>{ el.classList.add('obj-out'); rbT=setTimeout(()=>el.classList.add('hidden'),380); },2500);
  };
  let lbT=null;
  BK.lapBanner=function(l,total){
    const el=$('lap-banner');
    el.textContent=l>=total?'🔥 PUTARAN TERAKHIR':'PUTARAN '+l+' / '+total;
    el.classList.remove('hidden'); el.classList.remove('lap-in'); void el.offsetWidth; el.classList.add('lap-in');
    clearTimeout(lbT); lbT=setTimeout(()=>el.classList.add('hidden'),1500);
  };

  // sisa banner balapan tidak boleh tembus ke layar hasil / adegan
  BK.clearRaceOverlays=function(){
    ['speech','lap-banner','race-banner','objective'].forEach(id=>$(id).classList.add('hidden'));
    clearTimeout(speechT); clearTimeout(lbT); clearTimeout(rbT); clearTimeout(objT);
  };
  BK.openJournal=function(){
    $('journal-story').innerHTML=BK.Story.journal().map(j=>`<div class="j-entry${j.now?' now':''}"><b>${j.title}</b><p>${j.text}</p></div>`).join('')||'<p>Belum ada catatan.</p>';
    const lore=BK.Story.lore();
    $('journal-count').textContent='('+lore.filter(l=>l.open).length+'/'+lore.length+')';
    $('journal-lore').innerHTML=lore.map(l=>l.open?`<div class="j-lore"><b>${l.title}</b><p>${l.text}</p></div>`:`<div class="j-lore locked"><b>🔒 Halaman terkunci</b><p>Raih token atau relik untuk membukanya.</p></div>`).join('');
    BK.show('journal');
  };
  BK.closeJournal=function(){ BK.hide('journal'); };
  BK.refreshPauseMenu=function(st,mode){
    const q=$('btn-quit'), r=$('btn-restart2');
    BK._pauseQuitsToHub=st==='racing'&&mode!=='arcade'&&BK.Config.openworld;
    if(q) q.textContent=BK._pauseQuitsToHub?'🏝️ Keluar ke Pulau':'🏠 Garasi / Menu';
    if(r) r.textContent=st==='roam'?'↻ Kembali ke Lembah Permata':'↻ Ulangi Balapan';
  };
  BK.refreshMenuForStory=function(){
    const a=$('adv-chapter'), o=$('adv-objective'), b=$('btn-roam');
    const fresh=!BK.Save.hasProgress();
    if(a) a.innerHTML='🏝️ <b>'+(fresh?'KISAH PULAU BEKICOT':BK.Story.chapterLabel())+'</b>';
    if(o) o.textContent=fresh?'Pilih pembalap dan tingkat kesulitanmu, lalu mulai ceritanya.':BK.Story.objective()+'.';
    if(b) b.innerHTML=(fresh?'🗺️ MULAI CERITA':'🗺️ KE PULAU')+' <span class="no-touch">(ENTER)</span>';
    const nb=$('btn-new-story'); if(nb) nb.classList.toggle('hidden',fresh);
    if(BK.refreshCharLocks) BK.refreshCharLocks();
    BK.refreshHubStats();
  };
  BK.hideDialog=function(){
    const box=$('adv-dialog'); if(!box) return;
    box.classList.add('hidden'); box.onclick=null;
  };

  // Modal Kuil Status Petualangan & Toko Souvenir Pulau
  BK.openShrineModal=function(){
    const m=$('shrine-modal'); if(!m) return;
    const pct=BK.Save.getAdventurePct?BK.Save.getAdventurePct():0;
    const rank=BK.Save.getAdventureRank?BK.Save.getAdventureRank():'';
    const t=BK.Save.trophyCount();
    const tk=BK.Save.tokenCount?BK.Save.tokenCount():0;
    const rl=BK.Save.relicCount?BK.Save.relicCount():0;
    const bk=BK.Save.hasBossKey()?1:0;
    const coins=BK.Save.getCoins?BK.Save.getCoins():0;
    $('shrine-summary').innerHTML=`
      <span>📊 Progres Tamat: <b>${pct}%</b> (${rank})</span>
      <span>• 🏆 Piala: ${t}/4</span>
      <span>• 🔤 Token B-K-T: ${tk}/4</span>
      <span>• ⏱️ Relik: ${rl}/4</span>
      <span>• 🔑 Inti Permata: ${bk}/1</span>
      <span>• 🪙 Koin: <b>${coins}</b></span>
    `;
    const biomeMap={pantai:'beach',hutan:'ruins',salju:'glacier',kawah:'citadel'};
    const needMap={pantai:0,hutan:1,salju:2,kawah:3};
    const trBox=$('shrine-tracks'); trBox.innerHTML='';
    BK.Tracks.forEach(tr=>{
      const won=BK.Save.hasTrophy(tr.id);
      const hasTk=BK.Save.hasToken?BK.Save.hasToken(tr.id):false;
      const hasRl=BK.Save.hasRelic?BK.Save.hasRelic(tr.id):false;
      const best=BK.Save.getBest(tr.id);
      const bestRl=BK.Save.getBestRelic?BK.Save.getBestRelic(tr.id):null;
      const locked=t<(needMap[tr.id]||0) && !won;
      const card=document.createElement('div');
      card.className='shrine-tcard';
      card.innerHTML=`
        <b>${tr.icon} ${tr.name}</b>
        <div class="shrine-badges">
          <span>${won?'🏆 Piala ✅':'⚪ Piala'}</span>
          <span>${hasTk?'🔤 Token ✅':'⚪ Token'}</span>
          <span>${hasRl?'⏱️ Relik ✅':'⚪ Relik'}</span>
        </div>
        <small>Rekor Lap: ${BK.Save.fmt(best)}${bestRl!=null?' • Relik: '+BK.Save.fmt(bestRl):''}</small>
        <button type="button" class="small ${locked?'ghost':''}" data-tp="${biomeMap[tr.id]}" ${locked?'disabled':''}>
          ${locked?'🔒 Butuh '+needMap[tr.id]+' Piala':'⚡ Teleport ke Bioma'}
        </button>
      `;
      const btn=card.querySelector('button[data-tp]');
      if(btn&&!locked){
        btn.onclick=()=>{
          BK.closeShrineModal();
          if(BK.teleportToBiome) BK.teleportToBiome(btn.dataset.tp);
        };
      }
      trBox.appendChild(card);
    });
    const shop=BK.Save.getShop();
    const shBox=$('shrine-shop');
    const items=[
      {id:'horn', name:'📣 Klakson Bekicot (H)', cost:5},
      {id:'trail', name:'✨ Jejak Neon Hijau', cost:10},
      {id:'hat', name:'🎩 Topi Juara Pulau', cost:15}
    ];
    shBox.innerHTML=items.map(it=>{
      const owned=!!shop[it.id];
      return `<button type="button" class="small ${owned?'ghost':''}" data-buy="${it.id}" data-cost="${it.cost}">
        ${owned?it.name+' ✅ MILIKMU':it.name+' — 🪙 '+it.cost}
      </button>`;
    }).join('');
    shBox.querySelectorAll('button[data-buy]').forEach(b=>{
      b.onclick=()=>{
        const id=b.dataset.buy, cost=Number(b.dataset.cost);
        if(BK.Save.getShop()[id]) return;
        if(BK.Save.buyShop(id, cost)){
          if(id==='hat'&&BK.playerKart&&BK.attachHat) BK.attachHat(BK.playerKart);
          if(BK.Audio&&BK.Audio.trophy) BK.Audio.trophy();
          BK.flashMsg('🎉 Berhasil membeli item di Kuil Pulau!');
          BK.refreshHubStats();
          BK.openShrineModal();
        } else {
          if(BK.Audio&&BK.Audio.hit) BK.Audio.hit();
          BK.flashMsg('🪙 Koin belum cukup');
        }
      };
    });
    const bClose=$('btn-shrine-close');
    if(bClose) bClose.onclick=()=>BK.closeShrineModal();
    m.classList.remove('hidden');
  };
  BK.closeShrineModal=function(){
    const m=$('shrine-modal'); if(!m) return;
    m.classList.add('hidden');
  };

  BK.show=(id)=>$(id).classList.remove('hidden');
  BK.hide=(id)=>$(id).classList.add('hidden');

  // preview 3D bekicot di menu (renderer kecil sendiri, tetap offline)
  let pv=null;
  BK.initPreview=function(){
    try{
      const cv=$('char-preview');
      const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
      renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
      renderer.setSize(320,340,false);
      const scene=new THREE.Scene();
      const cam=new THREE.PerspectiveCamera(40,320/340,0.1,100);
      cam.position.set(0,3.1,8.4); cam.lookAt(0,1.15,0); // cukup mundur agar kart HD tak terpotong saat berputar
      const hemiL=new THREE.HemisphereLight(0xffffff,0x334455,1.0); scene.add(hemiL);
      const sun=new THREE.DirectionalLight(0xffffff,0.9); sun.position.set(4,6,5); scene.add(sun);
      const disc=new THREE.Mesh(new THREE.CircleGeometry(2.3,24),
        new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.35}));
      disc.rotation.x=-Math.PI/2; disc.position.y=0.02; scene.add(disc);
      pv={renderer,scene,cam,snail:null,blink:2,_b:0,lights:[hemiL,sun]};
    }catch(e){ pv=null; }
  };
  BK.previewChar=function(id){
    const c=BK.charById(id);
    const nameEl=$('char-big-name');
    if(nameEl) nameEl.textContent=c.icon+' '+c.name;
    if(!pv) return;
    if(pv.snail) pv.scene.remove(pv.snail);
    pv.snail=BK.buildRig(c);
    pv.scene.add(pv.snail);
  };
  BK.tickPreview=function(dt){
    if(!pv||!pv.snail) return;
    if($('menu').classList.contains('hidden')) return;
    pv.snail.rotation.y+=dt*0.45; // putar pelan + ayun kecil: preview hidup tanpa melelahkan mata
    pv.snail.position.y=Math.sin(performance.now()/900)*0.035;
    pv.blink-=dt;
    if(pv.blink<=0){ pv.blink=2.4+Math.random()*2; pv._b=0.13; }
    if(pv._b>0)pv._b-=dt;
    const eyes=pv.snail.userData.eyes||[];
    eyes.forEach(e=>e.scale.set(1,pv._b>0?0.12:1,1));
    pv.renderer.render(pv.scene,pv.cam);
  };

  BK.setWrongWay=function(on){
    const el=document.getElementById('wrongway'); if(!el) return;
    el.classList.toggle('hidden',!on);
  };
  let msgT=null;
  BK.flashMsg=function(txt){
    // lama tampil mengikuti panjang teks (dulu selalu 1,1 dtk: kalimat panjang tak terbaca)
    const el=$('hud-msg'); el.textContent=txt; el.style.opacity=1;
    el.classList.remove('msg-pop'); void el.offsetWidth; el.classList.add('msg-pop');
    clearTimeout(msgT); msgT=setTimeout(()=>el.style.opacity=0,Math.max(1100,String(txt).length*48));
  };
  BK.refreshItemHUD=function(){
    const k=BK.playerKart;
    const has=k&&k.item;
    $('hud-item-icon').textContent=has?BK.Items.icon(k.item):'?';
    document.getElementById('hud-item').classList.toggle('has-item',!!has);
  };
  BK.refreshRouletteHUD=function(icon){
    $('hud-item-icon').textContent=BK.Items.icon(icon);
    document.getElementById('hud-item').classList.add('has-item');
  };
  const ORD=['1st','2nd','3rd','4th'];
  BK.updateHUD=function(game){
    const p=game.player;
    $('hud-lap').textContent=`LAP ${Math.min(p.lap,BK.Config.laps)}/${BK.Config.laps}`;
    const posEl=$('hud-pos');
    const posTxt=BK.raceMode==='relic'?'⏱️':(ORD[p.place-1]||p.place+'th');
    if(posEl.textContent!==posTxt){ // posisi berubah: denyut + warna naik/turun
      const was=BK._lastPlace;
      posEl.textContent=posTxt;
      posEl.classList.remove('pos-up','pos-down'); void posEl.offsetWidth;
      if(was&&was!==p.place) posEl.classList.add(p.place<was?'pos-up':'pos-down');
    }
    BK._lastPlace=p.place;
    $('hud-time').textContent=BK.Save.fmt(game.time);
    // boost meter = drift charge / boost sisa
    const fill=$('boost-fill');
    if(p.drifting){
      const c=p.charge, D=BK.Config.drift;
      const pct=Math.min(100,c/D.chargeT3*100);
      fill.style.width=pct+'%';
      fill.style.background=p.chargeLv===3?'#c26bff':p.chargeLv===2?'#ff9f1c':p.chargeLv===1?'#3fb6ff':'#3fb6ff';
      $('boost-label').textContent=p.chargeLv===3?'UNGU! LEPAS!':p.chargeLv===2?'ORANYE!':p.chargeLv===1?'BIRU!':'DRIFT… TAHAN!';
    } else if(p.boostTime>0){
      fill.style.width=(p.boostTime/1.9*100)+'%'; fill.style.background='#ffd23f';
      $('boost-label').textContent='BOOST!';
    } else { fill.style.width='0%'; $('boost-label').textContent='DRIFT: TAHAN SPASI'; }
  };
  BK.drawMinimap=function(world, racers){
    const cv=$('minimap'), ctx=cv.getContext('2d');
    ctx.clearRect(0,0,cv.width,cv.height);
    if(world.isHub){ // minimap pulau: garis pantai + 4 portal + garasi + pintu bos + beacon misi
      const cx=cv.width/2, cy=cv.height/2, R=cv.width/2-10;
      const SC=Math.max.apply(null,world.coast)+12; // ikut ukuran pulau
      ctx.beginPath();
      for(let i=0;i<=64;i++){
        const a=i/64*Math.PI*2, r=world.coast[i%64];
        const px=cx+Math.sin(a)*r/SC*R, py=cy+Math.cos(a)*r/SC*R;
        i?ctx.lineTo(px,py):ctx.moveTo(px,py);
      }
      ctx.closePath();
      ctx.fillStyle='rgba(232,216,160,.9)'; ctx.fill();
      // jaringan jalan pulau: cincin tengah, 4 spoke, dan loop luar
      if(world.roadPaths && world.roadPaths.length){
        ctx.save();
        ctx.lineCap='round'; ctx.lineJoin='round';
        world.roadPaths.forEach(r=>{
          if(!r.points || r.points.length<2) return;
          const drawPath=()=>{
            ctx.beginPath();
            r.points.forEach((p,i)=>{
              const px=cx+p.x/SC*R, py=cy+p.z/SC*R;
              i?ctx.lineTo(px,py):ctx.moveTo(px,py);
            });
            if(r.closed) ctx.closePath();
          };
          drawPath();
          ctx.strokeStyle='rgba(61,50,40,.55)';
          ctx.lineWidth=Math.max(2.5, r.width/SC*R)+1.6;
          ctx.stroke();
          drawPath();
          ctx.strokeStyle=r.kind==='ash'?'#7b5d67':r.kind==='snow'?'#d3eaf3':r.kind==='jungle'?'#7f9460':'#c9b184';
          ctx.lineWidth=Math.max(1.4, r.width/SC*R);
          ctx.stroke();
        });
        // penanda pusat Gem Stone Valley
        ctx.beginPath();
        ctx.moveTo(cx,cy-5); ctx.lineTo(cx+5,cy); ctx.lineTo(cx,cy+5); ctx.lineTo(cx-5,cy); ctx.closePath();
        ctx.fillStyle='#5dff9c'; ctx.fill();
        ctx.strokeStyle='#0c2a1c'; ctx.lineWidth=1.2; ctx.stroke();
        ctx.restore();
      }
      const pcols={pantai:'#3fb6ff',hutan:'#7CFC00',kawah:'#ff5a2a',salju:'#b8ecff'};
      const nextP=(world.portals||[]).find(p=>!p.locked&&!p.won);
      const pulse=9+Math.sin(performance.now()/180)*2.5;
      (world.portals||[]).forEach(p=>{
        const px=cx+p.x/SC*R, py=cy+p.z/SC*R;
        if(p===nextP){
          ctx.beginPath(); ctx.arc(px,py,pulse,0,7);
          ctx.strokeStyle='#ffd23f'; ctx.lineWidth=2; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(px,py,7,0,7);
        ctx.fillStyle=p.locked?'#555555':(pcols[p.trackId]||'#fff'); ctx.fill();
        ctx.lineWidth=p.won?2.5:2; ctx.strokeStyle=p.won?'#ffd23f':'#000'; ctx.stroke();
      });
      if(world.garage){
        ctx.fillStyle='#ff9f1c';
        ctx.fillRect(cx+world.garage.x/SC*R-4,cy+world.garage.z/SC*R-4,8,8);
        ctx.strokeStyle='#000'; ctx.lineWidth=1.5;
        ctx.strokeRect(cx+world.garage.x/SC*R-4,cy+world.garage.z/SC*R-4,8,8);
      }
      if(world.shrine){
        ctx.fillStyle='#44ffaa';
        ctx.fillRect(cx+world.shrine.x/SC*R-4,cy+world.shrine.z/SC*R-4,8,8);
        ctx.strokeStyle='#000'; ctx.lineWidth=1.5;
        ctx.strokeRect(cx+world.shrine.x/SC*R-4,cy+world.shrine.z/SC*R-4,8,8);
      }
      if(world.bossDoor){
        const bOpen=BK.Save.trophyCount()>=4||BK.Save.hasBossKey();
        const bx=cx+world.bossDoor.x/SC*R, by=cy+world.bossDoor.z/SC*R;
        if(bOpen&&!BK.Save.hasBossKey()){
          ctx.beginPath(); ctx.arc(bx,by,pulse+1,0,7);
          ctx.strokeStyle='#ff5a2a'; ctx.lineWidth=2; ctx.stroke();
        }
        ctx.fillStyle=bOpen?'#ffd23f':'#888888';
        ctx.fillRect(bx-5,by-5,10,10);
        ctx.strokeStyle='#000'; ctx.lineWidth=1.5;
        ctx.strokeRect(bx-5,by-5,10,10);
      }
      (world.hubRacers||[]).forEach(hr=>{
        ctx.beginPath(); ctx.arc(cx+hr.pos.x/SC*R,cy+hr.pos.z/SC*R,4.2,0,7);
        ctx.fillStyle=hr.color||'#3fb6ff'; ctx.fill();
        ctx.lineWidth=1.4; ctx.strokeStyle='#000'; ctx.stroke();
      });
      racers.forEach(r=>{
        ctx.beginPath(); ctx.arc(cx+r.pos.x/SC*R,cy+r.pos.z/SC*R,6,0,7);
        ctx.fillStyle='#ffd23f'; ctx.fill();
        ctx.lineWidth=2; ctx.strokeStyle='#000'; ctx.stroke();
      });
      return;
    }
    // bounds
    let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9;
    world.pts.forEach(p=>{minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);});
    const pad=12, W=cv.width-pad*2, H=cv.height-pad*2;
    const sx=W/(maxX-minX||1), sz=H/(maxZ-minZ||1), s=Math.min(sx,sz);
    const ox=pad+(W-(maxX-minX)*s)/2, oz=pad+(H-(maxZ-minZ)*s)/2;
    const X=x=>ox+(x-minX)*s, Z=z=>oz+(z-minZ)*s;
    ctx.lineWidth=7; ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineJoin='round';
    ctx.beginPath();
    world.pts.forEach((p,i)=>{ i?ctx.lineTo(X(p.x),Z(p.z)):ctx.moveTo(X(p.x),Z(p.z)); });
    ctx.closePath(); ctx.stroke();
    racers.forEach((r,i)=>{
      ctx.beginPath(); ctx.arc(X(r.pos.x),Z(r.pos.z),r.isPlayer?6:4.5,0,7);
      ctx.fillStyle=r.isPlayer?'#ffd23f':['#ff5a5a','#3fb6ff','#7CFC00'][i%3];
      ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='#000'; ctx.stroke();
    });
  };
  BK.party=function(big){
    const c=document.getElementById('confetti'); if(!c) return;
    c.classList.remove('hidden'); c.innerHTML='';
    const cols=['#ffd23f','#ff5a5a','#3fb6ff','#7CFC00','#c26bff','#ffffff'];
    const n=big?150:60;
    for(let i=0;i<n;i++){
      const s=document.createElement('i');
      s.className='confetti-piece';
      s.style.left=(Math.random()*100)+'%';
      s.style.background=cols[i%cols.length];
      s.style.setProperty('--sw',((Math.random()*160-80)|0)+'px');
      s.style.animationDuration=(2.2+Math.random()*1.8)+'s';
      s.style.animationDelay=(Math.random()*(big?1.2:0.4))+'s';
      if(Math.random()<0.3)s.style.borderRadius='50%';
      if(Math.random()<0.3){s.style.width='7px';s.style.height='7px';}
      c.appendChild(s);
    }
    clearTimeout(c._t);
    c._t=setTimeout(()=>{c.classList.add('hidden');c.innerHTML='';},5200);
  };
  BK.showResult=function(rows, playerWon, isRecord){
    BK.hide('hud');
    BK.clearRaceOverlays();
    const opt=arguments[3]||{};
    $('result-title').textContent=playerWon?'🏆 MENANG!':(opt.retry?'😤 BELUM CUKUP!':'🏁 FINISH');
    const box=$('result-rows'); box.innerHTML='';
    let rank=0;
    rows.forEach(r=>{
      const d=document.createElement('div');
      d.className='rrow'+(r.isPlayer?' me':'');
      if(r.note){
        d.innerHTML=`<span>${r.note}</span><span></span>`;
      } else {
        rank++;
        const t=r.time!=null?BK.Save.fmt(r.time):'+'+r.gap+'m';
        d.innerHTML=`<span>${rank}. ${r.name}</span><span>${t}</span>`;
      }
      box.appendChild(d);
    });
    if(isRecord){ const d=document.createElement('div'); d.className='rrow me'; d.innerHTML='<span>⭐ Rekor lap tercepat baru!</span><span></span>'; box.appendChild(d); }
    // tombol utama mengikuti situasi: kalah di cerita = coba lagi; menang = lanjut cerita
    const bh=$('btn-hub'), br=$('btn-restart'), bm=$('btn-menu');
    const arcade=opt.mode==='arcade';
    bh.innerHTML=(opt.retry?'↻ Coba Lagi':(arcade?'Ke Menu':'Lanjut ▶'))+' <span class="no-touch">(Enter)</span>';
    br.classList.toggle('hidden',!!opt.retry||!!BK._pendingPost);
    bm.classList.toggle('hidden',arcade||!!BK._pendingPost||!opt.retry&&!arcade&&!BK.hubOrigin);
    BK.show('result');
  };
})();
