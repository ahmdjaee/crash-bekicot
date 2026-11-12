/* BK.Terrain: heightfield pulau radial milik sendiri (terinspirasi teknik
   THREE.Terrain: radial falloff + multipass noise + biome by height/slope).
   Deterministik (seed tetap): visual = fisika = minimap. Offline, tanpa dep. */
(function(){
  function mulberry(seed){
    let a=seed>>>0;
    return function(){
      a|=0; a=a+0x6D2B79F5|0;
      let t=Math.imul(a^a>>>15,1|a);
      t=t+Math.imul(t^t>>>7,61|t)^t;
      return ((t^t>>>14)>>>0)/4294967296;
    };
  }
  function makeVNoise(seed){
    const rand=mulberry(seed);
    const perm=[...Array(256).keys()];
    for(let i=255;i>0;i--){ const j=(rand()*(i+1))|0; const t=perm[i]; perm[i]=perm[j]; perm[j]=t; }
    const p=new Uint8Array(512);
    for(let i=0;i<512;i++)p[i]=perm[i&255];
    const fade=t=>t*t*(3-2*t);
    function n2(x,y){
      const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
      const h=(X,Y)=>p[(p[X&255]+(Y&255))&511]/255;
      const u=fade(xf), v=fade(yf);
      return (h(xi,yi)*(1-u)+h(xi+1,yi)*u)*(1-v)+(h(xi,yi+1)*(1-u)+h(xi+1,yi+1)*u)*v;
    }
    return function(x,y,oct){
      let v=0,amp=0.5,f=1,sum=0;
      const n=oct||3;
      for(let i=0;i<n;i++){ v+=n2(x*f,y*f)*amp; sum+=amp; amp*=0.5; f*=2.03; }
      return v/sum; // 0..1
    };
  }
  const vn=makeVNoise(20240613);
  function smooth(a,b,x){
    const t=Math.max(0,Math.min(1,(x-a)/(b-a)));
    return t*t*(3-2*t);
  }
  function coastR(coast,x,z){
    let f=Math.atan2(x,z)/(Math.PI*2)*coast.length;
    f=((f%coast.length)+coast.length)%coast.length;
    const i0=Math.floor(f)%coast.length, i1=(i0+1)%coast.length, fr=f-Math.floor(f);
    return coast[i0]+(coast[i1]-coast[i0])*fr;
  }
  BK.Terrain={
    // tinggi mentah: dome + detail FBM; flats: [{x,z,ri,ro,mode:'set'|'dip',h}]
    heightAt(x,z,coast,flats){
      const R=coastR(coast,x,z);
      const rn=Math.hypot(x,z)/R;
      let h;
      if(rn>=1) h=-0.2-(rn-1)*25;
      else {
        h=7*Math.pow(Math.max(0,1-rn*rn),1.35);
        h+=(vn(x*0.014,z*0.014,4)-0.5)*2*3.2*(1-smooth(0.75,1.0,rn));
      }
      for(const f of flats||[]){
        const fd=Math.hypot(x-f.x,z-f.z);
        if(fd<f.ro){
          const t=1-smooth(f.ri,f.ro,fd);
          const target=(f.mode==='set')?f.h:h-f.h;
          h=h*(1-t)+target*t;
        }
      }
      return h;
    },
    slopeAt(x,z,coast,flats){
      const e=1.5;
      return {
        x:(this.heightAt(x+e,z,coast,flats)-this.heightAt(x-e,z,coast,flats))/(2*e),
        z:(this.heightAt(x,z+e,coast,flats)-this.heightAt(x,z-e,coast,flats))/(2*e)
      };
    },
    // warna biome: pasir rendah, rumput tengah, batu curam/tinggi, dasar laut gelap
    biome(h,slope){
      const s=Math.hypot(slope.x,slope.z);
      if(h<0.3) return [0.62,0.55,0.36];
      if(h<1.1||s>0.9) {
        if(s>0.9||h>7.5) return [0.54,0.54,0.57];
        return [0.91,0.85,0.63];
      }
      if(h>7.5) return [0.54,0.54,0.57];
      const t=(h-1.1)/6.4;
      return [0.91-(0.91-0.49)*t*0.6, 0.85-(0.85-0.78)*t*0.4, 0.63-(0.63-0.29)*t*0.7];
    }
  };
})();
