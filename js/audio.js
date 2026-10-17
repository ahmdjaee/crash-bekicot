/* Audio synth 100% offline: engine + sfx via WebAudio, tanpa file */
(function(){
  let ctx=null, engineOsc=null, engineGain=null, engineFilter=null, noiseBuf=null;
  let started=false;

  function ensure(){
    if(ctx) return true;
    try{
      ctx = new (window.AudioContext||window.webkitAudioContext)();
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate*1, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
      // engine chain
      engineOsc = ctx.createOscillator(); engineOsc.type='sawtooth'; engineOsc.frequency.value=70;
      engineFilter = ctx.createBiquadFilter(); engineFilter.type='lowpass'; engineFilter.frequency.value=500;
      engineGain = ctx.createGain(); engineGain.gain.value=0.0;
      engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(ctx.destination);
      engineOsc.start();
      started=true; return true;
    }catch(e){ return false; }
  }
  function blip(freq,dur,type,vol,slide){
    if(!ensure()) return;
    if(ctx.state==='suspended') ctx.resume();
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type||'square'; o.frequency.value=freq;
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide), ctx.currentTime+dur);
    g.gain.value=vol||0.15; g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+dur);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime+dur);
  }
  function noise(dur,vol,filterFreq){
    if(!ensure()) return;
    const s=ctx.createBufferSource(); s.buffer=noiseBuf; s.loop=true;
    const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=filterFreq||1000;
    const g=ctx.createGain(); g.gain.value=vol||0.2;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+dur);
    s.connect(f); f.connect(g); g.connect(ctx.destination); s.start(); s.stop(ctx.currentTime+dur);
  }
  BK.Audio = {
    unlock(){ ensure(); if(ctx&&ctx.state==='suspended') ctx.resume(); },
    engine(speedRatio, drifting, boosting){
      if(!started) return;
      const f = 60 + speedRatio*140 + (boosting?40:0) + (drifting?25:0);
      engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.05);
      engineFilter.frequency.setTargetAtTime(400+speedRatio*900, ctx.currentTime, 0.1);
      engineGain.gain.setTargetAtTime(0.05+speedRatio*0.05, ctx.currentTime, 0.1);
    },
    engineOff(){ if(started) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1); },
    count(n){ blip(n===0?880:440, n===0?0.5:0.2, 'square', 0.2); },
    pickup(){ blip(660,0.12,'square',0.11,300); setTimeout(()=>blip(990,0.15,'square',0.11),90); },
    thud(){ blip(140,0.2,'sawtooth',0.12,-60); noise(0.15,0.12,500); },
    boost(){ noise(0.5,0.35,1800); blip(200,0.4,'sawtooth',0.2,500); },
    drift(){ noise(0.15,0.08,3000); },
    hit(){ blip(160,0.3,'sawtooth',0.25,-100); noise(0.25,0.25,400); },
    item(){ blip(880,0.25,'sine',0.2,400); },
    itemGet(t){
      if(t==='missile'){ blip(300,0.35,'sawtooth',0.2,900); noise(0.3,0.15,1500); }
      else if(t==='shield'){ blip(1567,0.18,'square',0.15); setTimeout(()=>blip(2093,0.25,'square',0.15),80); }
      else if(t==='oil'){ blip(220,0.25,'sine',0.2,-120); }
      else { blip(500,0.12,'square',0.18,300); setTimeout(()=>blip(1000,0.2,'square',0.18),90); }
    },
    pop(){ noise(0.18,0.3,2600); blip(700,0.12,'square',0.15,900); },
    wrong(){ blip(230,0.35,'sawtooth',0.22,-60); setTimeout(()=>blip(180,0.4,'sawtooth',0.22,-40),180); },
    screech(){ noise(0.22,0.1,4200); },
    horn(){ blip(392,0.15,'square',0.2); setTimeout(()=>blip(523,0.3,'square',0.2),130); },
    win(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>blip(f,0.3,'square',0.2),i*140)); },
    lose(){ [400,350,300,220].forEach((f,i)=>setTimeout(()=>blip(f,0.3,'sawtooth',0.15),i*160)); },
    trophy(){ [523,659,784].forEach((f,i)=>setTimeout(()=>blip(f,0.22,'square',0.2),i*110)); setTimeout(()=>blip(1567,0.4,'sine',0.12),340); },
    keyFanfare(){ [784,988,1175,1568].forEach((f,i)=>setTimeout(()=>blip(f,0.25,'triangle',0.2),i*100)); noise(0.4,0.08,5000); },
    warp(){ noise(0.45,0.25,600); blip(180,0.45,'sawtooth',0.18,900); },
    jump(){ blip(260,0.24,'triangle',0.16,420); noise(0.18,0.1,2200); }
  };
})();
