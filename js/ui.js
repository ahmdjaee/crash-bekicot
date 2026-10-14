/* UI: menu trek/diff, HUD, minimap, pesan */
(function(){
  const $=id=>document.getElementById(id);
  let selTrack=BK.Tracks[0].id, selDiff='normal', selChar='turbo';

  BK.getSelection=function(){
    const c=BK.charById(selChar);
    if(c&&c.locked&&!BK.Save.hasBossKey()) selChar='turbo';
    return {trackId:selTrack, diff:selDiff, charId:selChar};
  };

  BK.initUI=function(onStart){
    // overlay mulai: gesture pertama unlock audio (kebijakan autoplay browser)
    const ov=$('start-overlay');
    const enter=()=>{
      if(!ov||ov.classList.contains('hidden')) return;
      ov.classList.add('hidden');
      BK.Audio.unlock();
      if(BK.Music){ BK.Music.unlock(); BK.Music.play('menu'); }
    };
    if(ov){
      ov.onclick=enter;
      $('btn-enter').onclick=enter;
    }
    addEventListener('keydown',function k(e){
      if(e.code==='Enter'&&ov&&!ov.classList.contains('hidden')) enter();
    });
    const tl=$('track-list');
    tl.innerHTML='';
    const bestEls={};
    BK.Tracks.forEach(t=>{
      const d=document.createElement('div');
      d.className='track-card'+(t.id===selTrack?' active':'');
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
    BK.Characters.forEach((c,k)=>{
      const locked=c.locked&&!BK.Save.hasBossKey();
      const d=document.createElement('div');
      d.className='char-card'+(locked?' locked':'');
      d.innerHTML=locked
        ? `<b>🔒 ???</b><span>Kalahkan Juara di Pintu Bos!</span>`
        : `<b>${c.name}</b><span>${c.desc}</span>`;
      d.onclick=()=>{ if(locked){ BK.flashMsg('🔒 Kalahkan Juara dulu!'); BK.Audio.hit(); } else setChar(k); };
      cl.appendChild(d); cards.push(d);
      const dot=document.createElement('i');
      dot.onclick=()=>{ if(!locked) setChar(k); }; dotsBox.appendChild(dot);
    });
    function renderCharStats(){
      const st=$('char-stats');
      if(!st) return;
      const c0=BK.Characters[charIdx];
      st.innerHTML=Object.entries(c0.bars).map(([kb,v])=>
        `<div class="stat"><span>${kb}</span><div class="pips">${[1,2,3,4,5].map(i=>
          `<i class="${i<=v?'on':''}"></i>`).join('')}</div></div>`).join('');
    }
    function setChar(k){
      charIdx=(k+BK.Characters.length)%BK.Characters.length;
      selChar=BK.Characters[charIdx].id;
      cl.style.transform=`translateX(-${charIdx*100}%)`;
      cards.forEach((d,i)=>d.classList.toggle('active',i===charIdx));
      dotsBox.querySelectorAll('i').forEach((d,i)=>d.classList.toggle('on',i===charIdx));
      renderCharStats();
      BK.previewChar(selChar);
    }
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
    setChar(charIdx);
    document.querySelectorAll('#diff-list button').forEach(b=>{
      b.onclick=()=>{ selDiff=b.dataset.diff;
        document.querySelectorAll('#diff-list button').forEach(x=>x.classList.remove('active'));
        b.classList.add('active'); BK.Audio.unlock(); };
    });
    $('btn-start').onclick=()=>{ BK.Audio.unlock(); onStart(); };
    $('btn-help').onclick=()=>{ $('menu').classList.add('hidden'); $('help').classList.remove('hidden'); };
    $('btn-back').onclick=()=>{ $('help').classList.add('hidden'); $('menu').classList.remove('hidden'); };
    $('btn-resume').onclick=()=>BK.togglePause(false);
    $('btn-restart2').onclick=()=>BK.restartRace&&BK.restartRace();
    $('btn-quit').onclick=()=>location.reload();
    $('btn-restart').onclick=()=>BK.restartRace&&BK.restartRace();
    $('btn-menu').onclick=()=>location.reload();
    const bhub=$('btn-hub'); if(bhub)bhub.onclick=()=>BK.returnToHub&&BK.returnToHub();
    const broam=$('btn-roam'); if(broam)broam.onclick=()=>{ BK.Audio.unlock(); BK.startRoam&&BK.startRoam(); };
    // sentuh
    const bind=(id,down,up)=>{
      const el=$(id);
      const on=e=>{e.preventDefault();down();}, off=e=>{e.preventDefault();up&&up();};
      el.addEventListener('touchstart',on,{passive:false});
      el.addEventListener('touchend',off); el.addEventListener('mousedown',on); el.addEventListener('mouseup',off);
    };
    bind('t-left',()=>BK.touch.left=true,()=>BK.touch.left=false);
    bind('t-right',()=>BK.touch.right=true,()=>BK.touch.right=false);
    bind('t-drift',()=>BK.touch.drift=true,()=>BK.touch.drift=false);
    bind('t-brake',()=>BK.touch.brake=true,()=>BK.touch.brake=false);
    bind('t-item',()=>{ BK.touch.itemPressed=true; });
    refreshBest(); BK.refreshHubStats();
  };
  function refreshBest(){
    const cards=document.querySelectorAll('#track-list .track-card');
    BK.Tracks.forEach((t,i)=>{
      const b=BK.Save.getBest(t.id);
      const el=cards[i]&&cards[i].querySelector('.tbest');
      if(el) el.textContent='⏱ '+BK.Save.fmt(b);
    });
  }
  BK.refreshBest=refreshBest;
  BK.refreshHubStats=function(){
    const el=$('hub-stats'); if(!el) return;
    const open=['pantai','hutan','kawah'].filter(id=>{
      if(id==='pantai')return true;
      if(id==='hutan')return BK.Save.totalWins()>=1;
      return BK.Save.totalWins()>=3&&!!BK.Save.getBest('pantai');
    }).length;
    el.innerHTML=`🏆 ${BK.Save.totalWins()} trofi • 🌀 ${open}/3 portal`;
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
      cam.position.set(0,3.0,7.0); cam.lookAt(0,1.4,0);
      scene.add(new THREE.HemisphereLight(0xffffff,0x334455,1.0));
      const sun=new THREE.DirectionalLight(0xffffff,0.9); sun.position.set(4,6,5); scene.add(sun);
      const disc=new THREE.Mesh(new THREE.CircleGeometry(2.3,24),
        new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.35}));
      disc.rotation.x=-Math.PI/2; disc.position.y=0.02; scene.add(disc);
      pv={renderer,scene,cam,snail:null,blink:2,_b:0};
    }catch(e){ pv=null; }
  };
  BK.previewChar=function(id){
    const c=BK.charById(id);
    const nameEl=$('char-big-name');
    if(nameEl) nameEl.textContent=c.icon+' '+c.name;
    if(!pv) return;
    if(pv.snail) pv.scene.remove(pv.snail);
    pv.snail=BK.buildSnail(c);
    pv.scene.add(pv.snail);
  };
  BK.tickPreview=function(dt){
    if(!pv||!pv.snail) return;
    if($('menu').classList.contains('hidden')) return;
    pv.snail.rotation.y+=dt*0.9;
    pv.snail.position.y=Math.sin(performance.now()/600)*0.08;
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
    const el=$('hud-msg'); el.textContent=txt; el.style.opacity=1;
    clearTimeout(msgT); msgT=setTimeout(()=>el.style.opacity=0,1100);
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
    $('hud-pos').textContent=ORD[p.place-1]||p.place+'th';
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
    if(world.isHub){ // minimap pulau: garis pantai + portal + pintu bos
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
      const pcols={pantai:'#3fb6ff',hutan:'#7CFC00',kawah:'#ff5a2a'};
      (world.portals||[]).forEach(p=>{
        ctx.beginPath(); ctx.arc(cx+p.x/SC*R,cy+p.z/SC*R,7,0,7);
        ctx.fillStyle=p.locked?'#555555':(pcols[p.trackId]||'#fff'); ctx.fill();
        ctx.lineWidth=2; ctx.strokeStyle='#000'; ctx.stroke();
      });
      if(world.bossDoor){
        ctx.fillStyle='#ffd23f';
        ctx.fillRect(cx+world.bossDoor.x/SC*R-4,cy+world.bossDoor.z/SC*R-4,8,8);
      }
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
    BK.hide('hud'); $('result-title').textContent=playerWon?'🏆 MENANG!':'😭 KALAH — COBA LAGI!';
    const box=$('result-rows'); box.innerHTML='';
    rows.forEach((r,i)=>{
      const d=document.createElement('div');
      d.className='rrow'+(r.isPlayer?' me':'');
      const t=r.note?r.note:(r.time!=null?BK.Save.fmt(r.time):'+'+r.gap+'m');
      d.innerHTML=`<span>${i+1}. ${r.name}</span><span>${t}</span>`;
      box.appendChild(d);
    });
    if(isRecord){ const d=document.createElement('div'); d.className='rrow me'; d.innerHTML='<span>⭐ Rekor lap tercepat baru!</span><span></span>'; box.appendChild(d); }
    // balapan dari portal hub: tawarkan kembali ke pulau
    const bh=$('btn-hub'); if(bh) bh.classList.toggle('hidden',!BK.hubOrigin);
    BK.show('result');
    playerWon?BK.Audio.win():BK.Audio.lose();
  };
})();
