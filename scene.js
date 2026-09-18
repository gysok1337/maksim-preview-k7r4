import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const stage=document.querySelector('.stage');
const heading=document.querySelector('h1');
const host=document.querySelector('.cursor-host');
const shadow=document.querySelector('.cursor-shadow');
// Keep the same cursor in viewport coordinates throughout the portfolio.
document.body.append(host,shadow);
host.classList.add('site-cursor');shadow.classList.add('site-cursor');
const letters=[...heading.querySelectorAll('.letter')].map(el=>({el,cx:0,cy:0,x:0,y:0,z:0,vx:0,vy:0,vz:0}));
const gusts=[];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const fine=matchMedia('(pointer: fine)');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
let width=innerWidth,height=innerHeight,progress=0;
let renderer,scene,camera,arrow,environment;
let frame=0,previous=0,active=true,pressed=false,hasPointer=false,lastMove=0;
let useCustomCursor=fine.matches,inside=true;
let currentX=width*.70,currentY=height*.60,targetX=currentX,targetY=currentY;
let pointerVX=0,pointerVY=0,scale=1;
const rotation={x:.24,y:-.28,z:-.025,vx:0,vy:0,vz:0};
let letterTarget={x:currentX,y:currentY};
let lastTapCycle=-1;

function layout(){
  width=stage.clientWidth;height=stage.clientHeight;
  const letter=document.querySelector('#letter-i').getBoundingClientRect();
  const h=heading.getBoundingClientRect();
  // Read at rest in the headline coordinate system, independent of the scroll translation.
  letterTarget={x:letter.left+letter.width*.30,y:height*.08+h.height*.36};
  if(width<=700)letterTarget.y=height*.22+h.height*.36;
  letters.forEach(item=>{
    item.cx=(width-heading.offsetWidth)/2+item.el.offsetLeft+item.el.offsetWidth/2;
    item.cy=heading.offsetTop+item.el.offsetHeight*.44;
  });
  if(!hasPointer){currentX=targetX=letterTarget.x;currentY=targetY=letterTarget.y;}
  if(renderer){
    renderer.setSize(width,height,false);
    renderer.setPixelRatio(Math.min(devicePixelRatio,fine.matches?1.6:1));
    camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;
    camera.updateProjectionMatrix();
  }
  updateScroll();
}

function setup3D(){
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.02;
  host.append(renderer.domElement);
  scene=new THREE.Scene();
  camera=new THREE.OrthographicCamera(-width/2,width/2,height/2,-height/2,1,2500);
  camera.position.z=1000;

  const room=new RoomEnvironment();
  const pmrem=new THREE.PMREMGenerator(renderer);
  environment=pmrem.fromScene(room,.035);
  scene.environment=environment.texture;
  scene.environmentIntensity=1;
  room.dispose();pmrem.dispose();
  const key=new THREE.DirectionalLight(0xffffff,3.3);key.position.set(-280,420,650);scene.add(key);
  const rim=new THREE.DirectionalLight(0xe5edff,2.4);rim.position.set(330,-170,280);scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff,.45));

  // Solid chrome body, rounded bevel, then a separate inset graphite face.
  const shape=new THREE.Shape();
  const outline=[[0,0],[78,-58],[52,-64],[74,-104],[56,-114],[35,-74],[17,-93]];
  shape.moveTo(...outline[0]);outline.slice(1).forEach(p=>shape.lineTo(...p));shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:24,bevelEnabled:true,bevelThickness:3,bevelSize:3,bevelSegments:8,steps:1,curveSegments:8});
  geometry.computeBoundingBox();
  const face=new THREE.MeshPhysicalMaterial({color:0x080a0c,metalness:.45,roughness:.2,clearcoat:1,clearcoatRoughness:.09,envMapIntensity:1});
  const metal=new THREE.MeshPhysicalMaterial({color:0xd3d9df,metalness:1,roughness:.17,clearcoat:.4,envMapIntensity:1.4});
  const sideMetal=new THREE.MeshStandardMaterial({color:0x737e8b,metalness:.96,roughness:.22,envMapIntensity:1.2});
  arrow=new THREE.Group();
  const mesh=new THREE.Mesh(geometry,[metal,sideMetal]);
  mesh.position.z=-geometry.boundingBox.max.z;
  const inset=new THREE.Shape();
  const insetPoints=outline.map(([x,y])=>[37+(x-37)*.93,-57+(y+57)*.93]);
  inset.moveTo(...insetPoints[0]);insetPoints.slice(1).forEach(p=>inset.lineTo(...p));inset.closePath();
  const faceGeometry=new THREE.ExtrudeGeometry(inset,{depth:.5,bevelEnabled:true,bevelThickness:.45,bevelSize:.45,bevelSegments:3,steps:1});
  const faceMesh=new THREE.Mesh(faceGeometry,face);faceMesh.position.z=.1;
  arrow.add(mesh,faceMesh);scene.add(arrow);
  layout();renderFrame(performance.now());
  stage.classList.add('is-ready');stage.dataset.cursorReady='true';
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();stage.classList.remove('is-ready');document.documentElement.classList.remove('cursor-replaced');active=false;cancelAnimationFrame(frame);});
  renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
}

function spring(axis,velocity,target,dt){
  const stiffness=90,damping=14;
  rotation[velocity]+=(stiffness*(target-rotation[axis])-damping*rotation[velocity])*dt;
  rotation[axis]+=rotation[velocity]*dt;
}

function emitGust(x,direction=1,power=1,source='pointer'){
  if(reduced.matches||progress>.6)return;
  gusts.push({x,direction,power,start:performance.now()});
  if(gusts.length>4)gusts.shift();
  heading.dataset.lastGust=source;
  if(source==='pointer')heading.dataset.clickGusts=String((Number(heading.dataset.clickGusts)||0)+1);
}

function updateLetters(now,dt){
  while(gusts.length&&now-gusts[0].start>1600)gusts.shift();
  const visible=1-clamp(progress/.14,0,1);
  let maximum=0;
  letters.forEach((item,i)=>{
    const cy=item.cy-progress*height*.7;
    const dx=(targetX-item.cx)/Math.max(width*.15,100);
    const dy=(targetY-cy)/Math.max(height*.16,110);
    const near=hasPointer&&inside?Math.exp(-dx*dx-dy*dy):0;
    let wind=clamp(pointerVX*.00020,-.28,.28)*near;
    let lift=clamp(-pointerVY*.00007,-.10,.10)*near;
    gusts.forEach(gust=>{
      const age=(now-gust.start)/1000-Math.abs(item.cx-gust.x)/width*.28;
      if(age<=0||age>=.75)return;
      const breath=Math.sin(age/.75*Math.PI)*Math.exp(-age*2.3)*gust.power;
      wind+=gust.direction*.52*breath;
      lift-=.16*breath;
    });
    // Rooted lettering: wind shears the top while the entire baseline stays fixed.
    const targets={x:clamp(lift,-.08,.08)*visible,y:0,z:-clamp(wind,-.42,.42)*.32*visible};
    for(const axis of ['x','y','z']){
      const velocity='v'+axis;
      if(reduced.matches||visible===0){item[axis]=0;item[velocity]=0;continue;}
      item[velocity]+=((48+i*2)*(targets[axis]-item[axis])-6.8*item[velocity])*dt;
      item[axis]+=item[velocity]*dt;
    }
    item.el.style.transform=`rotateX(${item.x}rad) skewX(${item.z}rad)`;
    maximum=Math.max(maximum,Math.abs(item.z));
  });
  heading.dataset.maxFlutter=Math.max(Number(heading.dataset.maxFlutter)||0,maximum).toFixed(3);
  heading.dataset.letterAngles=letters.map(item=>item.z.toFixed(3)).join(',');
}

function updateScroll(){
  const section=document.querySelector('.scroll-scene');
  const travel=Number(section.dataset.introTravel)||section.offsetHeight-height;
  progress=clamp(scrollY/Math.max(1,travel),0,1);
  // Media and headline transforms are managed by scroll-player.js.
  if(reduced.matches&&renderer)renderFrame(performance.now());
}

function renderFrame(now){
  const dt=Math.min((now-previous)/1000||1/60,1/30);previous=now;
  const seconds=now/1000;
  let autoPress=false;
  if(!hasPointer&&progress<.25&&!reduced.matches){
    const cycle=seconds%6.4;
    let approach=0;
    if(cycle>1.3&&cycle<2.2)approach=smooth((cycle-1.3)/.9);
    else if(cycle>=2.2&&cycle<2.7)approach=1;
    else if(cycle>=2.7&&cycle<3.8)approach=1-smooth((cycle-2.7)/1.1);
    targetX=letterTarget.x+(1-approach)*(36+Math.sin(seconds*1.1)*6);
    targetY=letterTarget.y+(1-approach)*(27+Math.cos(seconds*.95)*5);
    autoPress=cycle>2.2&&cycle<2.38;
    const id=Math.floor(seconds/6.4);
    if(autoPress&&lastTapCycle!==id){emitGust(letterTarget.x,1,.7,'auto');lastTapCycle=id;}
  }
  updateLetters(now,dt);
  // The tip stays at the real pointer; inertia belongs to the body, not the click position.
  const follow=hasPointer||reduced.matches?1:1-Math.exp(-18*dt);
  currentX=mix(currentX,targetX,follow);currentY=mix(currentY,targetY,follow);
  if(now-lastMove>40){pointerVX*=Math.exp(-6*dt);pointerVY*=Math.exp(-6*dt);}
  const idleGain=reduced.matches?0:(!hasPointer?1:clamp((now-lastMove-120)/650,0,1));
  // Preserve the depth angle. Only the screen-plane pendulum responds to movement.
  const swayZ=Math.sin(seconds*1.6)*.012*idleGain;
  const rx=.24;
  const ry=-.28;
  const speed=Math.abs(pointerVX);
  // Responsive at ordinary speed, with the same bounded sway in either direction.
  const strength=Math.pow(clamp((speed-70)/800,0,1),1.15);
  const turn=Math.sign(pointerVX)*strength*.36;
  const rz=reduced.matches?-.025:-.025-turn+swayZ;
  if(reduced.matches){rotation.x=rx;rotation.y=ry;rotation.z=rz;}else{
    spring('x','vx',rx,dt);spring('y','vy',ry,dt);spring('z','vz',rz,dt);
  }
  scale=mix(scale,(pressed||autoPress)?.94:1,1-Math.exp(-22*dt));
  const baseSize=clamp(width/1000,.86,1.65);
  arrow.scale.setScalar(baseSize*scale);
  // World Z is the outer rotation, so the face does not tip up on one side.
  arrow.rotation.set(rotation.x,rotation.y,rotation.z,'ZXY');
  arrow.position.set(currentX-width/2,height/2-currentY,(pressed||autoPress)?-6:0);
  const opacity=inside?1:0;
  document.documentElement.classList.toggle('cursor-replaced',useCustomCursor&&inside&&active);
  host.style.opacity=String(opacity);
  shadow.style.opacity=String(opacity*.34);
  shadow.style.transform=`translate(${currentX+12}px,${currentY+20}px) rotate(-24deg) scale(${baseSize})`;
  stage.dataset.motion=reduced.matches?'reduced':'full';
  // Compact observable state for browser QA; no data leaves the page.
  stage.dataset.cursorPose=[currentX,currentY,rotation.x,rotation.y,rotation.z].map(n=>n.toFixed(3)).join(',');
  stage.dataset.maxBank=String(Math.max(Number(stage.dataset.maxBank)||0,Math.abs(rotation.y+.28)).toFixed(3));
  stage.dataset.maxWag=String(Math.max(Number(stage.dataset.maxWag)||0,Math.abs(rotation.z+.025)).toFixed(3));
  stage.dataset.cursorTurn=turn.toFixed(3);
  stage.dataset.cursorReplaced=String(document.documentElement.classList.contains('cursor-replaced'));
  renderer.render(scene,camera);
}

function loop(now){if(!active||document.hidden)return;renderFrame(now);if(!reduced.matches)frame=requestAnimationFrame(loop);}
function resume(){cancelAnimationFrame(frame);previous=0;if(renderer&&active)frame=requestAnimationFrame(loop);}
window.addEventListener('pointermove',e=>{
  const now=performance.now(),dt=Math.max((now-lastMove)/1000,.012);
  if(hasPointer){pointerVX=mix(pointerVX,clamp((e.clientX-targetX)/dt,-2400,2400),.55);pointerVY=mix(pointerVY,clamp((e.clientY-targetY)/dt,-2400,2400),.55);}
  targetX=e.clientX;targetY=e.clientY;hasPointer=true;lastMove=now;
  inside=true;useCustomCursor=e.pointerType!=='touch';
  if(reduced.matches&&renderer)renderFrame(now);
},{passive:true});
document.addEventListener('pointerleave',()=>{inside=false;hasPointer=false;pressed=false;pointerVX=pointerVY=0;document.documentElement.classList.remove('cursor-replaced');});
window.addEventListener('pointerdown',e=>{
  targetX=e.clientX;targetY=e.clientY;hasPointer=true;pressed=true;
  inside=true;useCustomCursor=e.pointerType!=='touch';
  emitGust(e.clientX,pointerVX< -20?-1:1);
  if(reduced.matches&&renderer)renderFrame(performance.now());
},{passive:true});
window.addEventListener('pointerup',()=>{pressed=false;if(reduced.matches&&renderer)renderFrame(performance.now());},{passive:true});
window.addEventListener('pointercancel',()=>{pressed=false;hasPointer=false;},{passive:true});
heading.addEventListener('selectstart',e=>e.preventDefault());
heading.addEventListener('dragstart',e=>e.preventDefault());
heading.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')e.preventDefault();});
window.addEventListener('scroll',updateScroll,{passive:true});
window.addEventListener('resize',layout);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(frame);else resume();});
reduced.addEventListener('change',resume);
window.addEventListener('pagehide',()=>cancelAnimationFrame(frame));
layout();
try{setup3D();resume();}catch(error){stage.dataset.cursorReady='false';document.documentElement.classList.remove('cursor-replaced');console.warn('3D cursor unavailable; static cursor retained.',error);}
