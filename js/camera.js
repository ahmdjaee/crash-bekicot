/* Camera: kejar + FOV kick + shake */
(function(){
  let shakeT=0, shakeAmp=0;
  BK.shake=function(a){
    const k=(BK.Config.effects==null?1:BK.Config.effects); // knob peredam
    if(k<=0) return;
    shakeAmp=Math.max(shakeAmp,(a||0.4)*k); shakeT=0.45;
  };
  BK.initCamera=function(cam){
    cam.fov=62; cam.updateProjectionMatrix();
  };
  BK.updateCamera=function(cam, kart, dt){
    const back=8.2, high=3.4;
    const hx=Math.sin(kart.heading), hz=Math.cos(kart.heading);
    // saat drift, kamera sedikit melebar ke sisi slide
    const slide=kart.driftOffset*2.2;
    const px=kart.pos.x-hx*back - Math.cos(kart.heading)*slide;
    const pz=kart.pos.z-hz*back + Math.sin(kart.heading)*slide;
    const tx=kart.pos.x+hx*6, tz=kart.pos.z+hz*6;
    const gy=kart.gy||0;
    const k=Math.min(1,5*dt);
    cam.position.x+=(px-cam.position.x)*k;
    cam.position.y+=((gy+high+(kart.hopT>0?0.5:0))-cam.position.y)*k;
    cam.position.z+=(pz-cam.position.z)*k;
    if(shakeT>0){
      shakeT-=dt;
      cam.position.x+=(Math.random()-0.5)*shakeAmp;
      cam.position.y+=(Math.random()-0.5)*shakeAmp*0.6;
      if(shakeT<=0) shakeAmp=0;
    }
    cam.lookAt(tx,gy+1.2,tz);
    // FOV kick
    const boosting=kart.boostTime>0;
    const spd=Math.abs(kart.speed)/BK.Config.player.topSpeed;
    const want=62+spd*6+(boosting?6:0)+(kart.drifting?1.5:0);
    cam.fov+=(want-cam.fov)*Math.min(1,4*dt);
    cam.updateProjectionMatrix();
  };
})();
