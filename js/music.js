/* BK.Music: MusicManager Howler + fallback synth prosedural.
   - File MP3/WAV lokal bila bisa dimuat (server/hosting): loop + crossfade.
   - Bila gagal (file:// memblokir audio lokal): synth WebAudio per state.
   SFX (BK.Audio) tidak disentuh. */
(function(){
  const cfg = window.BK_MUSIC || { volume: 0.7, fadeIn: 1200, fadeOut: 800, states: {} };
  let current = null, howls = {}, failedHowls = {}, synthOn = null, muted = false;
  try { muted = localStorage.getItem('bk_music_mute') === '1'; } catch (e) {}

  function useHowler(){ return (typeof Howl !== 'undefined'); }

  function makeHowl(st){
    const def = (cfg.states || {})[st];
    if(!def || !def.file || !useHowler() || failedHowls[st]) return null;
    if(howls[st]) return howls[st];
    const h = new Howl({
      src: [def.file], loop: true, volume: 0,
      onloaderror: function(){ fallToSynth(st); },
      onplayerror: function(){ fallToSynth(st); }
    });
    howls[st] = h;
    return h;
  }
  function fallToSynth(st){
    failedHowls[st] = true;
    if(howls[st]){
      if(howls[st]._stopT) clearTimeout(howls[st]._stopT);
      if(howls[st]._volT) clearTimeout(howls[st]._volT);
      try { howls[st].unload(); } catch (e) {}
      delete howls[st];
    }
    if(current === st) startSynth(st);
  }

  // ---- synth fallback: sequencer ringan per state ----
  let actx = null, synthTimer = null, step = 0, nextT = 0;
  function ac(){
    if(!actx){
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if(actx.state === 'suspended') { try { actx.resume(); } catch (e) {} }
    return actx;
  }
  const SCALES = {
    menu:   { bpm: 92,  wave: 'triangle', bass: [110, 87.3, 98, 130.8], lead: [220, 246.9, 261.6, 246.9], gain: 0.10 },
    hub:    { bpm: 100, wave: 'triangle', bass: [98, 123.5, 110, 146.8], lead: [196, 261.6, 220, 293.7], gain: 0.09 },
    race:   { bpm: 132, wave: 'square',   bass: [82.4, 82.4, 98, 110],  lead: [164.8, 196, 164.8, 220],  gain: 0.06 },
    final:  { bpm: 152, wave: 'square',   bass: [98, 98, 110, 123.5],   lead: [196, 220, 246.9, 261.6], gain: 0.07 },
    finish: { bpm: 120, wave: 'triangle', bass: [130.8, 98, 110, 146.8], lead: [523.3, 659.3, 784, 1046.5], gain: 0.11 }
  };
  function note(f, t, dur, type, vol){
    const c = ac(); if(!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function tickSynth(c, p, spb){
    if(muted) { nextT = Math.max(nextT, c.currentTime + 0.08); step++; return; }
    while(nextT < c.currentTime + 0.24){
      const i = step % 8;
      const v = cfg.volume * p.gain * 10;
      if(i % 2 === 0) note(p.bass[(step >> 1) % 4], nextT, spb * 1.8, p.wave, v);
      if(i % 2 === 1) note(p.lead[(step >> 1) % 4], nextT, spb * 0.9, 'sine', v * 0.7);
      nextT += spb; step++;
    }
  }
  function startSynth(st){
    stopSynth(false);
    const p = SCALES[st] || SCALES.menu;
    const c = ac(); if(!c) return;
    synthOn = st; step = 0; nextT = c.currentTime + 0.015;
    const spb = 60 / p.bpm / 2; // ketukan 1/8
    tickSynth(c, p, spb); // langsung bunyi di frame pertama tanpa jeda interval!
    synthTimer = setInterval(()=>{ tickSynth(c, p, spb); }, 80);
  }
  function stopSynth(){
    if(synthTimer){ clearInterval(synthTimer); synthTimer = null; }
    synthOn = null;
  }

  BK.Music = {
    play(st, force){
      try { if(useHowler() && typeof Howler !== 'undefined' && Howler.ctx && Howler.ctx.state === 'suspended') Howler.ctx.resume(); } catch (e) {}
      const c = ac();
      if(c && c.state === 'suspended') { try { c.resume(); } catch (e) {} }

      if(current === st && !force){
        // Pastikan musik benar-benar sedang jalan; bila mati/volume 0, hidupkan lagi!
        const curH = howls[st];
        if(curH){
          try {
            if(curH._stopT){ clearTimeout(curH._stopT); curH._stopT = null; }
            if(!curH.playing()){
              const sid = curH.play();
              curH.volume(muted ? 0 : cfg.volume, sid);
              curH.volume(muted ? 0 : cfg.volume);
            } else if(!muted && curH.volume() < 0.05){
              curH.volume(cfg.volume);
            }
            return;
          } catch (e) {}
        } else if(synthOn === st && synthTimer){
          return;
        }
      }
      const prev = current;
      current = st;
      stopSynth();
      const isFast = (st === 'finish');
      const fadeOutMs = isFast ? 120 : (cfg.fadeOut || 500);
      const fadeInMs  = isFast ? 60  : (cfg.fadeIn  || 700);
      // fade-out lagu lama (hanya jika lagu berbeda)
      if(prev && prev !== st && howls[prev]){
        const ph = howls[prev];
        try {
          if(ph._stopT){ clearTimeout(ph._stopT); ph._stopT = null; }
          if(ph._volT){ clearTimeout(ph._volT); ph._volT = null; }
          const v = ph.volume();
          ph.fade(v, 0, fadeOutMs);
          ph._stopT = setTimeout(()=>{
            ph._stopT = null;
            if(current !== prev){ try { ph.stop(); } catch (e) {} }
          }, fadeOutMs + 40);
        } catch (e) {}
      }
      const h = makeHowl(st);
      if(h){
        try {
          if(h._stopT){ clearTimeout(h._stopT); h._stopT = null; }
          if(h._volT){ clearTimeout(h._volT); h._volT = null; }
          try { h.stop(); } catch (e) {}
          const sid = h.play();
          const targetVol = muted ? 0 : cfg.volume;
          if(muted || isFast){
            h.volume(targetVol, sid);
            h.volume(targetVol);
          } else {
            h.volume(0.05, sid);
            h.fade(0.05, targetVol, fadeInMs, sid);
            h._volT = setTimeout(()=>{
              h._volT = null;
              if(current === st && !muted){
                try { h.volume(cfg.volume, sid); h.volume(cfg.volume); } catch (e) {}
              }
            }, fadeInMs + 50);
          }
          return;
        } catch (e) { /* jatuh ke synth */ }
      }
      startSynth(st);
    },
    setVolume(v){
      cfg.volume = Math.max(0, Math.min(1, v));
      Object.keys(howls).forEach(k=>{ try { if(k === current && !muted) howls[k].volume(cfg.volume); } catch (e) {} });
    },
    getVolume(){ return cfg.volume; },
    toggle(){
      muted = !muted;
      try { localStorage.setItem('bk_music_mute', muted ? '1' : '0'); } catch (e) {}
      Object.keys(howls).forEach(k=>{ try { howls[k].volume(muted ? 0 : cfg.volume); } catch (e) {} });
      return muted;
    },
    isMuted(){ return muted; },
    // jeda: musik turun, bukan mati
    duck(on){ const h=howls[current]; if(h&&!muted){ try{ h.volume(on?cfg.volume*0.35:cfg.volume); }catch(e){} } },
    // dipanggil saat interaksi pemain (autoplay policy browser)
    unlock(){
      try { if(useHowler()&&Howler.ctx&&Howler.ctx.state==='suspended')Howler.ctx.resume(); }catch(e){}
      const c=ac();
      if(c&&c.state==='suspended'){ try { c.resume(); } catch(e){} }
      if(!current) return;
      if(c) nextT=Math.max(nextT,c.currentTime+0.05); // cegah ledakan catch-up synth
      const h=howls[current];
      if(h){
        try{
          if(h._stopT){ clearTimeout(h._stopT); h._stopT=null; }
          if(!h.playing()){
            const sid=h.play();
            h.volume(muted?0:cfg.volume, sid);
            h.volume(muted?0:cfg.volume);
          } else if(!muted && h.volume()<0.05){
            h.volume(cfg.volume);
          }
        }catch(e){ startSynth(current); }
      }
      else if(!synthOn) startSynth(current);
    },
    state(){ return current; },
    // panggil lagu menu; browser menahannya sampai gesture pertama (ui.js firstGesture → unlock)
    autoplay(){
      this.play('menu');
    },
    _debug(){ const o={state:current,synth:synthOn,howls:{},playing:{}}; Object.keys(howls).forEach(k=>{ try{ o.howls[k]=howls[k].state(); o.playing[k]=howls[k].playing(); }catch(e){ o.howls[k]='?'; } }); if(synthOn)o.playing.synth=true; return o; }
  };
})();
