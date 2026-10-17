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
      if(s.activeTrail==='green') return 0x33ff66;
      if((this.data.letters||'').length>=7) return 0xc26bff;
      return null;
    },
    setBestMax(key,v){ const c=this.data['max_'+key]; if(c==null||v>c){ this.data['max_'+key]=v; write(this.data); return true; } return false; },
    getBestMax(key){ const c=this.data['max_'+key]; return c==null?null:c; },
    getBestGhost(){ return this.data.ghost||null; },
    setGhost(pts,dur){ try{ this.data.ghost={pts:pts.slice(-300),dur}; write(this.data); }catch(e){} },
    hasBossKey(){ return !!this.data.bossKey; },
    setBossKey(){ this.data.bossKey=true; write(this.data); },
    // piala = juara 1 per trek (pantai/hutan/salju/kawah); 4 piala membuka pintu bos
    setTrophy(trackId){ const k='trophy_'+trackId; if(!this.data[k]){ this.data[k]=1; write(this.data); return true; } return false; },
    hasTrophy(trackId){ return !!this.data['trophy_'+trackId]; },
    trophyCount(){ let n=0; ['pantai','hutan','salju','kawah'].forEach(id=>{ if(this.data['trophy_'+id])n++; }); return n; },
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
