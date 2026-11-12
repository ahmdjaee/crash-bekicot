/* Save: best lap + wins per track (localStorage, offline) */
(function(){
  const KEY = 'crash-bekicot-v1';
  function load(){
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch(e){ return {}; }
  }
  function write(d){ try{ localStorage.setItem(KEY, JSON.stringify(d)); }catch(e){} }
  BK.Save = {
    data: load(),
    // --- progres cerita ---
    sceneSeen(id){ return !!(this.data.scenes&&this.data.scenes[id]); },
    markScene(id){ this.data.scenes=this.data.scenes||{}; if(!this.data.scenes[id]){ this.data.scenes[id]=1; write(this.data); } },
    lossCount(key){ return (this.data.loss&&this.data.loss[key])||0; },
    addLoss(key){ this.data.loss=this.data.loss||{}; this.data.loss[key]=(this.data.loss[key]||0)+1; write(this.data); },
    clearLoss(key){ if(this.data.loss&&this.data.loss[key]){ delete this.data.loss[key]; write(this.data); } },
    hasProgress(){ return this.sceneSeen('prologue')||this.trophyCount()>0; },
    getDiff(){ return this.data.diff||'normal'; },
    setDiff(d){ this.data.diff=d; write(this.data); },
    // cerita baru: hapus progres, pertahankan rekor lap & pengaturan
    resetStory(){
      const keep={};
      Object.keys(this.data).forEach(k=>{ if(k.indexOf('best_')===0||k==='diff') keep[k]=this.data[k]; });
      this.data=keep; write(this.data);
    },
    // simpanan versi lama (tanpa adegan): yang sudah diraih tidak ditayangkan ulang
    migrateStory(){
      if(this.data.scenes) return;
      if(!this.data.introSeen&&!this.trophyCount()) return;
      this.data.scenes={prologue:1};
      ['pantai','hutan','salju','kawah'].forEach(t=>{ if(this.data['trophy_'+t]){ this.data.scenes[t+'_pre']=1; this.data.scenes[t+'_post']=1; this.data.scenes[t+'_hub']=1; } });
      if(this.data.bossKey){ this.data.scenes.boss_pre=1; this.data.scenes.boss_post=1; this.data.scenes.finale=1; }
      write(this.data);
    },
    getBest(trackId){ return this.data['best_'+trackId] || null; },
    setBest(trackId, sec){
      const k = 'best_'+trackId;
      if(!this.data[k] || sec < this.data[k]){ this.data[k]=sec; write(this.data); return true; }
      return false;
    },
    addWin(trackId){ const k='win_'+trackId; this.data[k]=(this.data[k]||0)+1; write(this.data); },
    totalWins(){ let n=0; for(const k in this.data){ if(k.indexOf('win_')===0)n+=this.data[k]; } return n; },
    getCoins(){ return this.data.coins||0; },
    addCoins(n){ this.data.coins=(this.data.coins||0)+n; write(this.data); },
    getLetters(){ return this.data.letters||''; },
    addLetter(ch){ const s=this.data.letters||''; if(s.indexOf(ch)<0){ this.data.letters=s+ch; write(this.data); return true; } return false; },
    hasTrail(){ return (this.data.letters||'').length>=7; },
    getShop(){ return this.data.shop||{horn:false,trail:false,hat:false,activeTrail:null}; },
    getChar(){ return this.data.charId||'turbo'; },
    setChar(id){ this.data.charId=id; write(this.data); },    buyShop(id,cost){
      const s=this.getShop();
      if(s[id]||(this.data.coins||0)<cost) return false;
      this.data.coins-=cost; s[id]=true;
      if(id==='trail')s.activeTrail='green';
      this.data.shop=s; write(this.data); return true;
    },
    setTrail(t){ const s=this.getShop(); s.activeTrail=t; this.data.shop=s; write(this.data); },
    trailColor(){
      const s=this.getShop();
      if(this.getAdventurePct()>=100) return 0xc26bff; // hadiah adegan rahasia: jejak ungu
      if(s.activeTrail==='green') return 0x33ff66;
      return null;
    },
    setBestMax(key,v){ const c=this.data['max_'+key]; if(c==null||v>c){ this.data['max_'+key]=v; write(this.data); return true; } return false; },
    getBestMax(key){ const c=this.data['max_'+key]; return c==null?null:c; },
    getBestGhost(){ return this.data.ghost||null; },
    setGhost(pts,dur){ try{ this.data.ghost={pts:pts.slice(-300),dur}; write(this.data); }catch(e){} },
    hasBossKey(){ return !!this.data.bossKey; },
    setBossKey(){ this.data.bossKey=true; write(this.data); },
    // karakter HD kunci-per-karakter: tuntas map = terbuka (balnok=pantai, krambil=salju, juara=kawah)
    setCharOpen(id){ const k='open_'+id; if(!this.data[k]){ this.data[k]=1; write(this.data); return true; } return false; },
    charOpen(id){
      if(this.data['open_'+id]) return true;
      // migrasi simpanan lama: piala = bukti map sudah tuntas (dan kunci-bos lama tetap membuka Juara)
      if(id==='balnok' && this.data.trophy_pantai) return true;
      if(id==='spora' && this.data.trophy_hutan) return true;
      if(id==='krambil' && this.data.trophy_salju) return true;
      if(id==='bara' && this.data.trophy_kawah) return true;
      if(id==='juara' && this.data.bossKey) return true;
      return false;
    },
    // piala = juara 1 per trek (pantai/hutan/salju/kawah); 4 piala membuka pintu bos
    setTrophy(trackId){ const k='trophy_'+trackId; if(!this.data[k]){ this.data[k]=1; write(this.data); return true; } return false; },
    hasTrophy(trackId){ return !!this.data['trophy_'+trackId]; },
    trophyCount(){ let n=0; ['pantai','hutan','salju','kawah'].forEach(id=>{ if(this.data['trophy_'+id])n++; }); return n; },
    // token = kumpulkan huruf B-K-T + juara 1 di trek tersebut
    setToken(trackId){ const k='token_'+trackId; if(!this.data[k]){ this.data[k]=1; write(this.data); return true; } return false; },
    hasToken(trackId){ return !!this.data['token_'+trackId]; },
    tokenCount(){ let n=0; ['pantai','hutan','salju','kawah'].forEach(id=>{ if(this.data['token_'+id])n++; }); return n; },
    // relik waktu = selesaikan Time Trial di bawah target waktu dengan bantuan kotak waktu (1/2/3 dtk)
    // dikalibrasi dengan bot: di bawah bot tanpa drift, di atas bot drift sempurna
    relicTargets: { pantai: 34.0, hutan: 63.0, salju: 39.0, kawah: 40.0 },
    getRelicTarget(trackId){ return this.relicTargets[trackId] || 82.0; },
    setRelic(trackId, sec){
      const k='relic_'+trackId, bk='best_relic_'+trackId;
      const isNew = !this.data[k];
      this.data[k]=1;
      if(sec!=null && (!this.data[bk] || sec < this.data[bk])) this.data[bk]=sec;
      write(this.data);
      return isNew;
    },
    hasRelic(trackId){ return !!this.data['relic_'+trackId]; },
    getBestRelic(trackId){ return this.data['best_relic_'+trackId] || null; },
    relicCount(){ let n=0; ['pantai','hutan','salju','kawah'].forEach(id=>{ if(this.data['relic_'+id])n++; }); return n; },
    getAdventurePct(){
      const t = this.trophyCount() * 10; // maks 40%
      const tk = this.tokenCount() * 5;  // maks 20%
      const rl = this.relicCount() * 5;  // maks 20%
      const bk = this.hasBossKey() ? 20 : 0; // 20%
      return Math.min(100, t + tk + rl + bk);
    },
    getAdventureRank(){
      const p = this.getAdventurePct();
      if(p >= 100) return '👑 Legenda Pulau 100%';
      if(p >= 80) return '🔥 Penantang Raja';
      if(p >= 50) return '⚡ Pemburu Relik';
      if(p >= 20) return '🧭 Penjelajah Sirkuit';
      return '🐣 Pembalap Baru';
    },
    introSeen(){ return !!this.data.introSeen; },
    setIntroSeen(){ this.data.introSeen=true; write(this.data); },
    finaleSeen(){ return !!this.data.finaleSeen; },
    setFinaleSeen(){ this.data.finaleSeen=true; write(this.data); },
    fmt(sec){
      if(sec==null) return '--:--.-';
      const m=Math.floor(sec/60), s=sec-m*60;
      return m+':'+(s<10?'0':'')+s.toFixed(1);
    }
  };
})();
