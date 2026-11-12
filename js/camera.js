/* Camera: kejar + FOV kick + shake */
(function(){
  let shakeT=0, shakeAmp=0;
  BK.shake=function(a){
    const k=(BK.Config.effects==null?1:BK.Config.effects); // knob peredam
    if(k<=0) return;
    shakeAmp=Math.max(shakeAmp,(a||0.4)*k); shakeT=0.45;
  };
  BK.initCamera=function(cam){
    cam.fov=62; cam._yaw=undefined; cam._shift=0; cam._back=8.2; cam._swoop=0; cam.updateProjectionMatrix();
  };
  // sapuan dari posisi kamera sekarang ke belakang kart (awal balapan); dulu XZ langsung melompat
  BK.cameraSwoop=function(cam,dur){ cam._swoop=dur; cam._swoopDur=dur; cam._yaw=undefined; };
  BK.updateCamera=function(cam, kart, dt){
    dt=Math.min(dt||0.016,0.1);
    // kamera sedikit tertinggal saat ngebut/boost lalu mengejar: sensasi laju tanpa getar
    const spdBack=Math.min(1,Math.abs(kart.speed)/BK.Config.player.topSpeed);
    const wantBack=7.6+spdBack*0.8+(kart.boostTime>0?1.0:0);
    cam._back=(cam._back==null?wantBack:cam._back)+(wantBack-(cam._back==null?wantBack:cam._back))*Math.min(1,3.5*dt);
    const back=cam._back, high=3.4;
    const dOff=kart.driftOffset||0;
    // Kamera mengikuti arah luncuran aktual (moveDir = heading + driftOffset), sehingga sudut bodi (heading + _driftYaw) terlihat jelas ngesot menyamping di layar!
    const targetYaw = kart.heading + dOff*0.65;
    if(cam._yaw===undefined) cam._yaw = targetYaw;
    let dy = targetYaw - cam._yaw;
    while(dy > Math.PI) dy -= Math.PI*2;
    while(dy < -Math.PI) dy += Math.PI*2;
    cam._yaw += dy * Math.min(1, 7.5*dt); // spring-arm: sedikit tertinggal saat belok, moncong terlihat menoleh

    const hx=Math.sin(cam._yaw), hz=Math.cos(cam._yaw);
    // Geser kamera sedikit ke sisi luar kurva saat drift agar profil samping kart & ban belakang yang ngesot terlihat jelas
    const outShift = ((kart._driftYaw||0) - dOff) * 0.85;
    cam._shift = (cam._shift||0) + (outShift - (cam._shift||0)) * Math.min(1, 8*dt);
    const px = kart.pos.x - hx*back - Math.cos(cam._yaw)*cam._shift;
    const pz = kart.pos.z - hz*back + Math.sin(cam._yaw)*cam._shift;
    const tx = kart.pos.x + hx*6, tz = kart.pos.z + hz*6;
    const baseY=(kart.worldY!=null)?kart.worldY:(kart.gy||0);
    const ky=Math.min(1, 8*dt);
    if(cam._swoop>0){
      cam._swoop-=dt;
      const q=Math.min(1,(1-Math.max(0,cam._swoop)/(cam._swoopDur||1))*0.16+dt*3);
      cam.position.x += (px-cam.position.x)*q;
      cam.position.z += (pz-cam.position.z)*q;
    } else {
      cam.position.x = px;
      cam.position.z = pz;
    }
    cam.position.y += ((baseY+high+(kart.hopT>0?0.45:0)) - cam.position.y)*ky;
    if(BK.currentWorld&&BK.currentWorld.heightAt){
      const ch=BK.currentWorld.heightAt(cam.position.x,cam.position.z)+1.6;
      if(cam.position.y<ch) cam.position.y=ch;
    }
    if(shakeT>0){
      shakeT-=dt;
      cam.position.x+=(Math.random()-0.5)*shakeAmp;
      cam.position.y+=(Math.random()-0.5)*shakeAmp*0.6;
      if(shakeT<=0) shakeAmp=0;
    }
    cam.lookAt(tx,baseY+1.2,tz);
    BK.camPos=cam.position;
    // FOV kick
    const boosting=kart.boostTime>0;
    const spd=Math.abs(kart.speed)/BK.Config.player.topSpeed;
    const want=62+spd*6+(boosting?6:0)+(kart.drifting?1.5:0);
    cam.fov+=(want-cam.fov)*Math.min(1,4*dt);
    cam.updateProjectionMatrix();
  };
})();
