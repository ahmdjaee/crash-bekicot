/* Cutscene: sutradara adegan cerita (naskah di js/story.js).
   Kamera antar-shot + pemeran 3D yang "hidup" + teks mengetik + letterbox + lewati.
   Game memanggil BK.Cutscene.play(scene, ctx, onDone) dan .update(dt) tiap frame. */
(function(){
  let cur=null;         // adegan aktif
  const ACTORS={};      // who -> {mesh, x, z, y, heading, ...}
  let flyers=[];        // kepingan permata terbang (fx)
  const _look=new THREE.Vector3();
  const _lookCur=new THREE.Vector3();

  const ease=t=>t*t*(3-2*t);
  function wrap(a){ while(a>Math.PI)a-=Math.PI*2; while(a<-Math.PI)a+=Math.PI*2; return a; }

  function castInfo(who){ return BK.Story.CAST[who]||{name:who,emoji:'🐌',pitch:1}; }
  function charFor(who){
    const c=castInfo(who);
    if(c.player) return BK.charById(BK.getSelection().charId);
    if(c.char) return BK.charById(c.char);
    return c.npc||BK.charById('turbo');
  }
  function buildActorRig(who){
    const c=castInfo(who), def=charFor(who);
    if(c.npc) return BK.buildSnail(def);
    return BK.buildRig(def);
  }
  BK.buildCastRig=buildActorRig;

  // --- Anchor: titik dunia yang bisa dirujuk naskah ---
  function groundAt(x,z,fallback){
    const w=cur&&cur.ctx.world;
    if(w&&w.heightAt) return w.heightAt(x,z);
    return fallback||0;
  }
  function anchor(name){
    const ctx=cur.ctx, w=ctx.world;
    if(ACTORS[name]) { const a=ACTORS[name]; return {x:a.x,y:a.y,z:a.z,heading:a.heading}; }
    const kartAnchor=k=>({x:k.pos.x,y:k.gy||k.worldY||0,z:k.pos.z,heading:k.heading});
    if(name==='player') return kartAnchor(ctx.player);
    if(name==='rival') return kartAnchor(ctx.rival||ctx.player);
    if(name==='gem') return {x:0,y:w.heightAt?w.heightAt(0,0):0,z:0,heading:0};
    if(name==='door'&&w.bossDoor) return {x:w.bossDoor.x,y:w.heightAt(w.bossDoor.x,w.bossDoor.z),z:w.bossDoor.z,heading:0};
    if(name==='garage'&&w.garage) return {x:w.garage.x,y:w.heightAt(w.garage.x,w.garage.z),z:w.garage.z,heading:Math.atan2(-w.garage.x,-w.garage.z)};
    if(name==='blimp'&&w.expeditionMap&&w.expeditionMap.blimp){
      const p=w.expeditionMap.blimp.position; return {x:p.x,y:p.y,z:p.z,heading:0};
    }
    if(name.indexOf('portal:')===0&&w.portals){
      const p=w.portals.find(q=>q.trackId===name.slice(7));
      if(p) return {x:p.x,y:w.heightAt(p.x,p.z),z:p.z,heading:Math.atan2(-p.x,-p.z)};
    }
    return kartAnchor(ctx.player);
  }

  // --- Pemeran ---
  function placeCast(entry){
    if(ACTORS[entry.who]) return;
    const an=anchor(entry.at||'gem');
    const a=an.heading+(entry.a||0), r=entry.r||0;
    const x=an.x+Math.sin(a)*r, z=an.z+Math.cos(a)*r;
    const mesh=buildActorRig(entry.who);
    const y=groundAt(x,z,an.y);
    let heading=entry.face==='out'?a:(entry.face==='in'?a+Math.PI:(typeof entry.face==='number'?entry.face:a+Math.PI));
    mesh.rotation.order='YXZ';
    mesh.position.set(x,y,z); mesh.rotation.y=heading;
    mesh.visible=!entry.hidden;
    const base=mesh.scale.x;
    cur.ctx.scene.add(mesh);
    ACTORS[entry.who]={who:entry.who,mesh,x,y,z,heading,base,ph:Math.random()*6,hop:0,anchor:entry.at||'gem',owned:true,blink:1+Math.random()*2,mv:null};
  }
  // kart balapan yang sudah ada di scene ikut berakting sebagai 'rival'/'player'
  function adoptKart(tag,k){
    if(!k) return;
    ACTORS[tag]={who:tag,mesh:k.mesh,x:k.pos.x,y:k.gy||0,z:k.pos.z,heading:k.heading,base:k.mesh.scale.x,ph:Math.random()*6,hop:0,owned:false,blink:1.5,mv:null};
  }
  function clearActors(){
    Object.keys(ACTORS).forEach(k=>{
      const a=ACTORS[k];
      if(a.owned&&a.mesh.parent) a.mesh.parent.remove(a.mesh);
      else if(!a.owned){ a.mesh.scale.setScalar(a.base); a.mesh.position.y=a.y; }
      delete ACTORS[k];
    });
    flyers.forEach(f=>{ if(f.mesh.parent) f.mesh.parent.remove(f.mesh); });
    flyers=[];
  }
  function tickActors(dt,t){
    const speakerTag=cur&&cur.speakerTag;
    Object.keys(ACTORS).forEach(k=>{
      const a=ACTORS[k], u=a.mesh.userData;
      const talking=k===speakerTag&&cur.typing;
      if(a.mv){
        a.mv.t+=dt; const q=ease(Math.min(1,a.mv.t/a.mv.dur));
        a.x=a.mv.x0+(a.mv.x1-a.mv.x0)*q; a.z=a.mv.z0+(a.mv.z1-a.mv.z0)*q;
        a.y=groundAt(a.x,a.z,a.y);
        if(q>=1) a.mv=null;
      }
      // napas / bicara: squash lembut, saat bicara lebih hidup
      const br=Math.sin(t*(talking?11:2.1)+a.ph);
      const sy=1+br*(talking?0.05:0.012);
      const sx=1-br*(talking?0.025:0.006);
      if(a.hop>0) a.hop=Math.max(0,a.hop-dt*1.7);
      const hopY=a.hop>0?Math.sin(a.hop*Math.PI)*1.15:0;
      a.mesh.position.set(a.x,a.y+hopY+(talking?Math.abs(br)*0.05:0),a.z);
      a.mesh.scale.set(a.base*sx,a.base*sy,a.base*sx);
      a.mesh.rotation.z=talking?Math.sin(t*5.5+a.ph)*0.035:0;
      // kedip + tangkai mata bergoyang
      if(u.eyes&&u.eyes.length){
        a.blink-=dt;
        if(a.blink<=0){ a.blink=1.8+Math.random()*2.6; a._b=0.13; }
        if(a._b>0) a._b-=dt;
        const eo=a._b>0?0.12:1;
        u.eyes.forEach(e=>e.scale.set(1,eo,1));
        (u.stalks||[]).forEach((st,i)=>{ st.rotation.x=0.15+Math.sin(t*(talking?6:2.2)+a.ph+i)*(talking?0.14:0.05); });
      }
      if(u.tick) u.tick(t,dt,false,0,0);
    });
  }

  // --- Efek naskah ---
  function mapOf(){ const w=cur.ctx.world; return w&&w.expeditionMap; }
  function flyShard(from,to,col,dur,scale){
    const m=new THREE.Mesh(new THREE.OctahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:col||0x5dff9c}));
    m.scale.set(scale||1,(scale||1)*1.6,scale||1);
    m.position.set(from.x,from.y,from.z);
    cur.ctx.scene.add(m);
    flyers.push({mesh:m,from,to,t:0,dur:dur||1.6});
  }
  const FX={
    juaraArrive(){ const a=ACTORS.juara; if(a){ BK.spawnBurst({x:a.x,y:a.y+1,z:a.z},0xffd23f,16,0.3); a.hop=1; } if(BK.Audio.boost)BK.Audio.boost(); },
    juaraLeave(){ const a=ACTORS.juara; if(a) BK.spawnBurst({x:a.x,y:a.y+1,z:a.z},0xffd23f,12,0.28); },
    shatter(){
      const m=mapOf(); const gy=anchor('gem').y+12;
      if(m&&m.setStoryStage) m.setStoryStage(0,false);
      BK.spawnBurst({x:0,y:gy,z:0},0x5dff9c,26,0.45);
      BK.shake(0.5);
      [[-140,178],[-232,10],[-120,-172],[194,2]].forEach(p=>{
        flyShard({x:0,y:gy,z:0},{x:p[0],y:gy+6,z:p[1]},0x5dff9c,2.4,0.9);
      });
    },
    shardReturn(){
      const m=mapOf(); const gy=anchor('gem').y+12;
      const ex=cur.ctx.exitPortal;
      const from=ex?{x:ex.x,y:gy+10,z:ex.z}:{x:60,y:gy+30,z:90};
      flyShard(from,{x:0,y:gy,z:0},0x8fffc6,1.4,0.8);
      cur.pendingStage=BK.Save.trophyCount();
      setTimeout(()=>{
        if(!cur) return;
        if(m&&m.setStoryStage) m.setStoryStage(cur.pendingStage,false);
        BK.spawnBurst({x:0,y:gy,z:0},0x5dff9c,18,0.35);
      },1300);
    },
    gemWhole(){
      const m=mapOf(); const gy=anchor('gem').y+12;
      if(m&&m.setStoryStage) m.setStoryStage(5,false);
      BK.spawnBurst({x:0,y:gy,z:0},0xffffff,28,0.5);
      BK.spawnBurst({x:0,y:gy,z:0},0x5dff9c,28,0.45);
      if(BK.party) BK.party(true);
    },
    fireworks(){
      const gy=anchor('gem').y;
      const cols=[0xffd23f,0xff5a5a,0x3fb6ff,0x7CFC00,0xc26bff];
      for(let i=0;i<5;i++) setTimeout(()=>{
        if(!cur) return;
        BK.spawnBurst({x:(Math.random()-0.5)*50,y:gy+16+Math.random()*12,z:(Math.random()-0.5)*50},cols[i%5],18,0.32);
        if(BK.Audio.pop) BK.Audio.pop();
      },i*260);
      if(BK.party) BK.party(false);
    },
    gateOpen(){ const a=anchor('door'); BK.spawnBurst({x:a.x,y:a.y+4,z:a.z},0xffd23f,22,0.4); },
    portalReveal(id){ const a=anchor('portal:'+id); BK.spawnBurst({x:a.x,y:a.y+3,z:a.z},0x55eeff,22,0.35); if(BK.Audio.warp)BK.Audio.warp(); }
  };
  function runFx(spec){
    if(!spec) return;
    const parts=spec.split(':');
    const f=FX[parts[0]];
    if(f) f(parts[1]);
  }

  // --- Kamera ---
  function resolveCam(c){
    const an=anchor(c.at);
    const a=an.heading+(c.angle||0);
    return {at:c.at,cx:an.x,cy:an.y,cz:an.z,a,dist:c.dist||8,h:c.h!=null?c.h:3,look:c.look!=null?c.look:1.2,orbit:c.orbit||0};
  }
  function camPos(s,out){
    const w=cur.ctx.world;
    out.x=s.cx+Math.sin(s.a)*s.dist;
    out.z=s.cz+Math.cos(s.a)*s.dist;
    out.y=s.cy+s.h;
    if(w&&w.heightAt){ const g=w.heightAt(out.x,out.z)+1.4; if(out.y<g) out.y=g; }
    return out;
  }
  function setShot(c){
    if(!c) return;
    const next=resolveCam(c);
    const prev=cur.shot;
    cur.shot=next;
    const cam=cur.ctx.camera;
    if(prev&&prev.at===next.at&&!cur.snapNext){
      // anchor sama: geser lembut; anchor beda: potong sinema dengan kedip singkat (tak terbang tembus gunung)
      cur.blend=0;
      cur.fromPos=cam.position.clone();
      cur.fromLook=_lookCur.clone();
    } else {
      cur.blend=1;
      if(prev) cutFlash();
      const p=camPos(next,{});
      cam.position.set(p.x,p.y,p.z);
      _lookCur.set(next.cx,next.cy+next.look,next.cz);
    }
    cur.snapNext=false;
  }
  function cutFlash(){
    const f=document.getElementById('fade'); if(!f) return;
    f.style.transition='none'; f.style.opacity=0.85;
    requestAnimationFrame(()=>{ f.style.transition='opacity .22s'; f.style.opacity=0; });
  }

  // --- Langkah ---
  function applyStep(){
    const s=cur.scene.steps[cur.idx];
    (s.cast||[]).forEach(placeCast);
    (s.show||[]).forEach(w=>{ if(ACTORS[w]) ACTORS[w].mesh.visible=true; });
    (s.hide||[]).forEach(w=>{ if(ACTORS[w]) ACTORS[w].mesh.visible=false; });
    if(s.hop&&ACTORS[s.hop]) ACTORS[s.hop].hop=1;
    if(s.move&&ACTORS[s.move.who]){
      const a=ACTORS[s.move.who], an=anchor(a.anchor||'gem'), ang=an.heading+(s.move.a||0);
      a.mv={t:0,dur:s.move.t||1.2,x0:a.x,z0:a.z,x1:an.x+Math.sin(ang)*(s.move.r||0),z1:an.z+Math.cos(ang)*(s.move.r||0)};
    }
    setShot(s.cam);
    runFx(s.fx);
    if(s.sound&&BK.Audio[s.sound]) BK.Audio[s.sound]();
    // tag pembicara: bila naskah merujuk kart balapan, 'rival' atau 'player' yang berakting
    const rivalId=cur.ctx.rivalWho;
    cur.speakerTag=(s.who===rivalId&&ACTORS.rival)?'rival':(s.who==='player'&&ACTORS.player?'player':s.who);
    cur.text=s.text||''; cur.shown=0; cur.typing=true; cur.tickSnd=0;
    BK.showDialogStep({
      who:s.who, speaker:castInfo(s.who).name, text:'',
      btnText: cur.idx<cur.scene.steps.length-1?'Lanjut ▶':'Selesai ✓',
      step:cur.idx, total:cur.scene.steps.length
    }, advance);
  }
  // potongan teks yang tetap menjaga tag HTML tertutup
  function sliceHtml(html,n){
    let out='',vis=0,i=0; const open=[];
    while(i<html.length&&vis<n){
      if(html[i]==='<'){
        const e=html.indexOf('>',i); const tag=html.slice(i,e+1);
        if(tag[1]==='/') open.pop(); else open.push(tag.replace(/[<>]/g,'').split(' ')[0]);
        out+=tag; i=e+1;
      } else { out+=html[i]; i++; vis++; }
    }
    for(let k=open.length-1;k>=0;k--) out+='</'+open[k]+'>';
    return out;
  }
  function plainLen(html){ return html.replace(/<[^>]+>/g,'').length; }

  function advance(){
    if(!cur) return;
    if(cur.typing){ // tekan pertama: tuntaskan teks; tekan kedua: lanjut
      cur.shown=plainLen(cur.text); cur.typing=false;
      BK.setDialogText(cur.text);
      return;
    }
    cur.idx++;
    if(BK.Audio.item) BK.Audio.item();
    if(cur.idx>=cur.scene.steps.length){ finish(); return; }
    applyStep();
  }
  function finish(){
    const done=cur.onDone;
    // apa pun yang terjadi (termasuk dilewati): cahaya pulau kembali sesuai simpanan
    const m=mapOf(); if(m&&m.setStoryStage) m.setStoryStage(BK.Story.storyStage(),true);
    if(cur.hidKart&&cur.ctx.player) cur.ctx.player.mesh.visible=true;
    clearActors();
    BK.hideDialog();
    BK.setLetterbox(false);
    cur.ctx.camera.clearViewOffset();
    cur=null;
    if(done) done();
  }
  function begin(){
    // kartu judul bisa selesai SETELAH adegan dilewati (Esc saat kartu tampil)
    if(!cur) return;
    (cur.scene.cast||[]).forEach(placeCast);
    cur.snapNext=true;
    BK.clearRaceOverlays();
    BK.setLetterbox(true);
    // gambar digeser ke atas agar wajah pemeran tidak tertutup kotak dialog
    cur.ctx.camera.setViewOffset(innerWidth,innerHeight,0,innerHeight*0.13,innerWidth,innerHeight);
    applyStep();
  }

  BK.Cutscene={
    active(){ return !!cur; },
    /* ctx: {camera,scene,world,player,rival,rivalWho,exitPortal} */
    play(sceneDef,ctx,onDone){
      clearActors();
      cur={scene:sceneDef,ctx,onDone,idx:0,shot:null,blend:1,typing:false,text:'',shown:0,tickSnd:0,speakerTag:null};
      if(ctx.player&&!ctx.world.isHub) adoptKart('player',ctx.player);
      if(ctx.rival) adoptKart('rival',ctx.rival);
      if(ctx.world.guideArrow) ctx.world.guideArrow.visible=false;
      if(ctx.world.isHub&&ctx.player&&(sceneDef.cast||[]).some(c=>c.who==='player')){ ctx.player.mesh.visible=false; cur.hidKart=true; }
      if(sceneDef.stage!=null&&ctx.world.expeditionMap&&ctx.world.expeditionMap.setStoryStage) ctx.world.expeditionMap.setStoryStage(sceneDef.stage,true);
      if(sceneDef.music&&BK.Music) BK.Music.play(sceneDef.music);
      if(sceneDef.title){ BK.titleCard(sceneDef.title,begin); }
      else begin();
    },
    next(){ if(cur&&BK.isDialogOpen&&BK.isDialogOpen()) advance(); },
    skip(){ if(!cur) return; cur.idx=cur.scene.steps.length; cur.typing=false; finish(); if(BK.isCardOpen&&BK.isCardOpen()&&BK.skipCard) BK.skipCard(); },
    update(dt,t){
      if(!cur) return;
      const cam=cur.ctx.camera;
      tickActors(dt,t);
      // kepingan terbang
      for(let i=flyers.length-1;i>=0;i--){
        const f=flyers[i]; f.t+=dt; const q=Math.min(1,f.t/f.dur), e=ease(q);
        f.mesh.position.set(f.from.x+(f.to.x-f.from.x)*e,f.from.y+(f.to.y-f.from.y)*e+Math.sin(q*Math.PI)*14,f.from.z+(f.to.z-f.from.z)*e);
        f.mesh.rotation.y+=dt*6;
        if(q>=1){ if(f.mesh.parent) f.mesh.parent.remove(f.mesh); flyers.splice(i,1); }
      }
      // teks mengetik + bunyi bicara bernada per pemeran
      if(cur.typing){
        cur.shown+=dt*46;
        const total=plainLen(cur.text);
        if(cur.shown>=total){ cur.shown=total; cur.typing=false; }
        BK.setDialogText(sliceHtml(cur.text,Math.floor(cur.shown)));
        cur.tickSnd-=dt;
        if(cur.typing&&cur.tickSnd<=0&&BK.Audio.talk){
          cur.tickSnd=0.075;
          const st=cur.scene.steps[cur.idx];
          BK.Audio.talk(castInfo(st&&st.who).pitch||1);
        }
      }
      // kamera
      const s=cur.shot;
      if(s){
        s.a+=s.orbit*dt;
        // anchor pemeran bisa bergerak: ikuti
        const liveA=ACTORS[s.at];
        if(liveA){ s.cx=liveA.x; s.cz=liveA.z; s.cy=liveA.y; }
        const p=camPos(s,{});
        _look.set(s.cx,s.cy+s.look,s.cz);
        if(cur.blend<1){
          cur.blend=Math.min(1,cur.blend+dt/0.9);
          const q=ease(cur.blend);
          cam.position.lerpVectors(cur.fromPos,new THREE.Vector3(p.x,p.y,p.z),q);
          _lookCur.lerpVectors(cur.fromLook,_look,q);
        } else {
          // dolly sangat pelan agar gambar tidak mati
          cam.position.x+=(p.x-cam.position.x)*Math.min(1,4*dt);
          cam.position.y+=(p.y-cam.position.y)*Math.min(1,4*dt);
          cam.position.z+=(p.z-cam.position.z)*Math.min(1,4*dt);
          _lookCur.lerp(_look,Math.min(1,5*dt));
        }
        cam.lookAt(_lookCur);
      }
    }
  };
})();
