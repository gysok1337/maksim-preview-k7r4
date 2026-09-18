const section = document.querySelector('.scroll-scene');
const stage = document.querySelector('.stage');
const canvas = document.querySelector('.flight-canvas');
const ctx = canvas.getContext('2d', { alpha: true });
const laptopCanvas = document.querySelector('.laptop-canvas');
const laptopCtx = laptopCanvas.getContext('2d', { alpha: true });
const heading = document.querySelector('h1');
const photos = [...document.querySelectorAll('.photo')];
const openingPhoto = document.querySelector('.photo-background img');
openingPhoto.addEventListener('load',()=>invalidate());
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
// WebKit's ImageBitmap-to-2D-canvas path stalls more than drawing decoded
// images directly in this sequence (same assets and framing). Keep Chromium's
// approved bitmap path; Safari uses the existing Image.decode fallback.
const imageElementFrames=/AppleWebKit\//.test(navigator.userAgent)&&!/(?:Chrome|Chromium|Edg|OPR)\//.test(navigator.userAgent);
stage.dataset.frameDecoder=imageElementFrames?'image':'bitmap';
const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
const mix = (a,b,t) => a+(b-a)*t;
const smooth = t => { t=clamp(t); return t*t*(3-2*t); };
const COUNT=121, LAST=COUNT-1, FLIGHT_END=.80;
const MAX_SPEED=1.65, MAX_ACCEL=40, FOLLOW=28, BLEND_SECONDS=.16, APPEAR_END=.035;
const HANDOVER_FRAME=98;
const HANDOVER_PROGRESS=APPEAR_END+(FLIGHT_END-APPEAR_END)*HANDOVER_FRAME/LAST;
// Match the real screenshot at the exit from the glass M (frame 98),
// before the generated page can become a resting frame. Coordinates: 1280x720.
const align={sx:.932,sy:.9075,x:32,y:22.5};
const blobs=new Map(), bitmaps=new Map(), requests=new Map(), decoding=new Map();
let width=0,height=0,dpr=1,raw=0,desired=0,shown=0,tick=0,disposed=false;
let realReady=false,firstReady=false,preloadStarted=false;
let progress=0,velocity=0,lastTime=0,blendValue=0,blendTarget=0;
const atmosphere=document.querySelector('.atmosphere');
const frameAt=value=>Math.min(HANDOVER_FRAME,Math.round(clamp((value-APPEAR_END)/(FLIGHT_END-APPEAR_END))*LAST));
const real=new Image();
real.decoding='async';
real.src='./assets/intro/sks-end.png';
real.onload=()=>{realReady=true;invalidate();};
real.onerror=()=>{stage.dataset.sksError='true';};
stage.dataset.flightStatus='loading';

function invalidate(){
  if(!tick&&!disposed)tick=requestAnimationFrame(render);
}
function frameUrl(index){
  return './assets/flight-v1/frame-'+String(index).padStart(3,'0')+'.webp';
}
async function fetchFrame(index){
  if(blobs.has(index))return blobs.get(index);
  if(requests.has(index))return requests.get(index);
  const request=fetch(frameUrl(index)).then(response=>{
    if(!response.ok)throw new Error('Frame '+index+': '+response.status);
    return response.arrayBuffer();
  }).then(buffer=>{
    const blob=new Blob([buffer],{type:'image/webp'});
    blobs.set(index,blob);
    stage.dataset.loadedFrames=String(blobs.size);
    return blob;
  }).finally(()=>requests.delete(index));
  requests.set(index,request);
  return request;
}
function trimCache(){
  const limit=width<=700?12:22;
  const remove=[...bitmaps.keys()].filter(i=>i!==0&&i!==HANDOVER_FRAME&&i!==desired&&i!==shown)
    .sort((a,b)=>Math.abs(b-desired)-Math.abs(a-desired));
  while(bitmaps.size>limit&&remove.length){
    const index=remove.shift();
    bitmaps.get(index).close?.();
    bitmaps.delete(index);
  }
  stage.dataset.decodedFrames=String(bitmaps.size);
}
async function decodeFrame(index){
  if(bitmaps.has(index))return bitmaps.get(index);
  if(decoding.has(index))return decoding.get(index);
  const request=fetchFrame(index).then(async blob=>{
    let bitmap;
    if('createImageBitmap' in window&&!imageElementFrames){
      bitmap=await createImageBitmap(blob);
    }else{
      const image=new Image(),url=URL.createObjectURL(blob);
      image.src=url;
      try{await image.decode();bitmap=image;}finally{URL.revokeObjectURL(url);}
    }
    if(disposed){bitmap.close?.();return null;}
    bitmaps.set(index,bitmap);
    if(index===0){firstReady=true;stage.dataset.flightStatus='ready';}
    trimCache();
    invalidate();
    return bitmap;
  }).catch(error=>{
    stage.dataset.flightError=String(error.message);
    return null;
  }).finally(()=>decoding.delete(index));
  decoding.set(index,request);
  return request;
}
function warmNearby(index){
  decodeFrame(index);
  const direction=Math.sign(velocity)||Math.sign(raw-progress)||1;
  for(const offset of [-1,1,3,6,10,14])decodeFrame(clamp(index+offset*direction,0,HANDOVER_FRAME));
}
async function preload(){
  if(preloadStarted||reduced.matches)return;
  preloadStarted=true;
  let next=1;
  await Promise.all(Array.from({length:4},async()=>{
    while(next<LAST&&!disposed){
      const index=next++;
      try{await fetchFrame(index);}catch(error){stage.dataset.flightError=error.message;}
    }
  }));
}
function layout(){
  width=stage.clientWidth;height=stage.clientHeight;
  dpr=Math.min(devicePixelRatio||1,width<=700?1.5:2);
  canvas.width=laptopCanvas.width=Math.round(width*dpr);
  canvas.height=laptopCanvas.height=Math.round(height*dpr);
  update();
}
function update(){
  const travel=Number(section.dataset.introTravel)||section.offsetHeight-height;
  raw=clamp((scrollY-section.offsetTop)/Math.max(1,travel));
  stage.dataset.scrollProgress=raw.toFixed(4);
  stage.dataset.targetFrame=String(frameAt(raw));
  invalidate();
}
function mediaBox(){
  const startW=width*(width<=700?1.32:.84);
  const startH=startW*941/1672;
  const endW=Math.min(width,height*16/9);
  const endH=endW*9/16;
  const zoom=smooth((progress-APPEAR_END)/(.30-APPEAR_END));
  const w=mix(startW,endW,zoom),h=mix(startH,endH,zoom);
  return {x:(width-w)/2,y:mix(height*(width<=700?.28:.25),(height-endH)/2,zoom),w,h};
}
function drawImage(image,box,transform,opacity,blur){
  if(!image||opacity<=0)return;
  ctx.save();
  ctx.globalAlpha=opacity;
  ctx.filter=blur>0?'blur('+blur*dpr+'px)':'none';
  ctx.translate(box.x,box.y);
  ctx.scale(box.w/1280,box.h/720);
  ctx.transform(transform.sx,0,0,transform.sy,transform.x,transform.y);
  ctx.drawImage(image,0,0,1280,720);
  ctx.restore();
}
// Match .photo-background at the beginning, then expand the same oval.
// The fixed-width edge fades gain opacity gradually; they never collapse to a hard edge.
function feather(box){
  const expansion=1+1.1*smooth(progress/.48);
  const edgeReveal=Math.max(smooth((progress-.44)/.34),smooth(blendValue));
  const opacity=value=>mix(value,1,edgeReveal);
  ctx.save();
  ctx.globalCompositeOperation='destination-in';
  ctx.save();
  ctx.translate(box.x+box.w*.5,box.y+box.h*.55);
  ctx.scale(box.w*Math.SQRT1_2*expansion,box.h*.55*Math.SQRT2*expansion);
  const oval=ctx.createRadialGradient(0,0,0,0,0,1);
  oval.addColorStop(0,'black');oval.addColorStop(.32,'black');
  oval.addColorStop(.46,'rgba(0,0,0,'+opacity(11/15)+')');
  oval.addColorStop(.72,'rgba(0,0,0,'+opacity(0)+')');
  oval.addColorStop(1,'rgba(0,0,0,'+opacity(0)+')');
  ctx.fillStyle=oval;ctx.fillRect(-4,-4,8,8);
  ctx.restore();
  const vertical=ctx.createLinearGradient(0,box.y,0,box.y+box.h);
  for(const [stop,alpha] of [[0,0],[.15,1],[.78,1],[1,0]]){
    vertical.addColorStop(stop,'rgba(0,0,0,'+opacity(alpha)+')');
  }
  ctx.fillStyle=vertical;ctx.fillRect(0,0,width,height);
  // Side edges only become relevant as the oval grows; retain a soft margin.
  const horizontal=ctx.createLinearGradient(box.x,0,box.x+box.w,0);
  for(const [stop,alpha] of [[0,0],[.09,1],[.91,1],[1,0]]){
    horizontal.addColorStop(stop,'rgba(0,0,0,'+opacity(alpha)+')');
  }
  ctx.fillStyle=horizontal;ctx.fillRect(0,0,width,height);
  ctx.restore();
  stage.dataset.backgroundReveal=edgeReveal.toFixed(4);
}
// Only the short opening segment overlaps the heading. These contours follow the
// outer laptop edge in the actual video, so no desk pixels can cover the letters.
const laptopContours=[
  {frame:0,points:[[166,252],[178,242],[819,42],[836,44],[1095,337],[1100,350],[1093,365],[409,614],[390,616],[375,606],[166,273]]},
  {frame:8,points:[[174,238],[186,229],[841,57],[861,62],[1097,348],[1101,365],[1091,383],[383,602],[366,606],[349,592],[174,261]]},
  {frame:16,points:[[200,210],[211,202],[909,111],[930,117],[1093,381],[1097,394],[1091,439],[310,575],[294,572],[286,558],[201,237]]},
  {frame:24,points:[[209,341],[249,256],[988,256],[1002,260],[1068,344],[1066,357],[1064,535],[232,556],[215,550],[210,534],[230,356]]}
];
function drawLaptop(bitmap,box,pose,appearance){
  laptopCanvas.style.opacity=String(appearance*(1-smooth((progress-.14)/.035)));
  if(progress>=.175||!bitmap)return;
  let a=laptopContours[0],b=laptopContours[1];
  for(let i=1;i<laptopContours.length;i++){
    b=laptopContours[i];a=laptopContours[i-1];
    if(shown<=b.frame)break;
  }
  const t=clamp((shown-a.frame)/(b.frame-a.frame));
  const points=a.points.map((point,i)=>[mix(point[0],b.points[i][0],t),mix(point[1],b.points[i][1],t)]);
  laptopCtx.save();
  laptopCtx.translate(box.x,box.y);laptopCtx.scale(box.w/1280,box.h/720);
  laptopCtx.transform(pose.sx,0,0,pose.sy,pose.x,pose.y);
  laptopCtx.beginPath();
  points.forEach(([x,y],i)=>i?laptopCtx.lineTo(x,y):laptopCtx.moveTo(x,y));
  laptopCtx.closePath();laptopCtx.clip();
  laptopCtx.drawImage(bitmap,0,0,1280,720);
  laptopCtx.restore();
}
function advance(now){
  const dt=lastTime?Math.min((now-lastTime)/1000,.04):1/60;
  lastTime=now;
  if(reduced.matches){progress=raw;velocity=0;return dt;}
  if(!firstReady)return dt;
  const gap=raw-progress;
  const wanted=clamp(gap*FOLLOW,-MAX_SPEED,MAX_SPEED);
  velocity+=clamp(wanted-velocity,-MAX_ACCEL*dt,MAX_ACCEL*dt);
  // Clamp to the target on arrival; reversing the wheel gently brakes the motion.
  const step=velocity*dt;
  if(Math.abs(gap)<.00005||Math.sign(step)===Math.sign(gap)&&Math.abs(step)>=Math.abs(gap)){
    progress=raw;velocity=0;
  }else progress=clamp(progress+step);
  desired=frameAt(progress);
  warmNearby(desired);
  // Complete the handover by time, even if the user stops on its threshold.
  // A small reverse dead band prevents flicker at the boundary.
  if(progress>=HANDOVER_PROGRESS-.001&&realReady)blendTarget=1;
  else if(progress<HANDOVER_PROGRESS-.025)blendTarget=0;
  blendValue+=clamp(blendTarget-blendValue,-dt/BLEND_SECONDS,dt/BLEND_SECONDS);
  stage.dataset.renderProgress=progress.toFixed(4);
  stage.dataset.flightVelocity=velocity.toFixed(4);
  stage.dataset.blendTarget=String(blendTarget);
  return dt;
}
function render(now){
  tick=0;
  // The paper scene must not share its frame budget with two offscreen canvases.
  // Keep the last intro image intact; native reverse scrolling resumes it.
  if(scrollY>=section.offsetTop+section.offsetHeight){lastTime=0;return;}
  advance(now);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,width,height);
  laptopCtx.setTransform(dpr,0,0,dpr,0,0);
  laptopCtx.clearRect(0,0,width,height);
  laptopCanvas.style.opacity='0';
  const titleFade=smooth(progress/.14);
  heading.style.transform='translate(-50%,'+(-titleFade*height*.55)+'px)';
  heading.style.opacity=String(1-titleFade);
  atmosphere.style.opacity=String(1-smooth(progress/.22));
  const identity={sx:1,sy:1,x:0,y:0};
  if(reduced.matches){
    const end=raw>=.5&&realReady;
    canvas.style.opacity=end?'1':'0';
    photos.forEach(photo=>photo.style.opacity=end?'0':'1');
    if(end){
      const w=Math.min(width,height*16/9),h=w*9/16;
      drawImage(real,{x:(width-w)/2,y:(height-h)/2,w,h},identity,1,0);
    }
    stage.dataset.flightMode='reduced';
    return;
  }
  stage.dataset.flightMode='full';
  const blend=realReady?smooth(blendValue):0;
  let bitmap=bitmaps.get(desired);
  if(bitmap)shown=desired;
  else{
    // Use the nearest ready frame while the exact one decodes. Do not freeze
    // on an old frame during a fast wheel gesture or jump to the cached ending.
    const ready=[...bitmaps.keys()].filter(index=>Math.abs(index-desired)<=14)
      .sort((a,b)=>Math.abs(a-desired)-Math.abs(b-desired))[0];
    if(ready!==undefined){shown=ready;bitmap=bitmaps.get(ready);}
    else bitmap=bitmaps.get(shown)||bitmaps.get(0);
  }
  if(!bitmap&&blend<1){canvas.style.opacity='0';return;}
  const appearance=firstReady?smooth(progress/APPEAR_END):0;
  const backgroundReady=openingPhoto.complete&&openingPhoto.naturalWidth>0;
  const backgroundMix=backgroundReady?smooth(progress/.09):appearance;
  // Composite both backgrounds first, then mask once. Fading two already-masked
  // layers separately produced a dark dip in the soft halo on the left.
  canvas.style.opacity=backgroundReady?'1':String(appearance);
  photos.forEach(photo=>photo.style.opacity=photo.classList.contains('photo-foreground')?(appearance<1?'1':'0'):(backgroundReady?'0':'1'));
  stage.dataset.backgroundMix=backgroundMix.toFixed(4);
  const box=mediaBox();
  const referencePose={
    sx:mix(align.sx,1,blend),sy:mix(align.sy,1,blend),
    x:mix(align.x,0,blend),y:mix(align.y,0,blend)
  };
  // The generated first frame is slightly smaller than the approved photograph.
  const startAlign=1-smooth((progress-APPEAR_END)/.15);
  const videoPose=blend>0?{
    sx:referencePose.sx/align.sx,sy:referencePose.sy/align.sy,
    x:referencePose.x-referencePose.sx*align.x/align.sx,
    y:referencePose.y-referencePose.sy*align.y/align.sy
  }:{sx:1+.019*startAlign,sy:1+.0315*startAlign,x:.5*startAlign,y:0};
  const blur=Math.sin(blend*Math.PI)*4*box.w/1280;
  if(backgroundReady&&backgroundMix<1)drawImage(openingPhoto,box,identity,1,0);
  if(blend<1)drawImage(bitmap,box,videoPose,backgroundMix,blur);
  if(blend>0)drawImage(real,box,referencePose,blend,blur);
  feather(box);
  drawLaptop(bitmap,box,videoPose,appearance);
  stage.dataset.displayedFrame=String(shown);
  stage.dataset.sksBlend=blend.toFixed(4);
  stage.dataset.mediaRect=[box.x,box.y,box.w,box.h].map(n=>n.toFixed(1)).join(',');
  if(Math.abs(raw-progress)>.00005||Math.abs(velocity)>.0001||Math.abs(blendValue-blendTarget)>.0001)invalidate();
  else lastTime=0;
}
window.addEventListener('scroll',update,{passive:true});
window.addEventListener('resize',layout);
reduced.addEventListener('change',()=>{layout();if(!reduced.matches)preload();});
window.addEventListener('pagehide',()=>{
  disposed=true;cancelAnimationFrame(tick);
  bitmaps.forEach(bitmap=>bitmap.close?.());
  bitmaps.clear();blobs.clear();
});
window.addEventListener('pageshow',event=>{
  if(event.persisted)location.reload();
});
layout();
Promise.all([decodeFrame(0),decodeFrame(HANDOVER_FRAME)]).then(()=>{
  warmNearby(desired);
  preload();
  invalidate();
});
