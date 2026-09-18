// Continue the approved flight with still-image project windows and native scrolling.
import {renderPaperStory,paperReady} from './paper-story.js?v=5';
import {motionSettings,tuningEnabled} from './mobile-motion-tuning.js?v=1';
const section=document.querySelector('.scroll-scene');
const stage=document.querySelector('.stage');
const deck=document.querySelector('.project-deck');
const preview=deck.querySelector('.project-window');
const origin=deck.querySelector('.project-origin');
const backdrop=deck.querySelector('.project-backdrop');
const heading=deck.querySelector('.project-heading');
const description=deck.querySelector('.project-description');
const picker=deck.querySelector('.project-picker');
const next=deck.querySelector('.projects-next');
const mobile=document.documentElement.dataset.layout==='mobile';
const safariWheel=!mobile&&/AppleWebKit\//.test(navigator.userAgent)&&!/(?:Chrome|Chromium|Edg|OPR)\//.test(navigator.userAgent);
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const mix=(a,b,t)=>a+(b-a)*t;
const service=document.querySelector('.service-story');
const rest=document.querySelector('.portfolio-rest');
const projectButtons=[...picker.querySelectorAll('button')];
const projects={
 sks:{title:'СКС',description:'Разработка электроники. Интерактивные платы и анимация.',url:'https://skysinth.com/'},
 lider:{title:'Лидер',description:'Оборудование для виноделия. Каталог, услуги и проекты.',url:'https://lider-vino.ru/'},
 gooddog:{title:'Good Dog',description:'Хот-доги. Выразительная подача продукта и интерактивные детали.',url:'https://good-dog.site/'},
 aet:{title:'AET Trans',description:'Международная и проектная логистика. Корпоративный сайт.',url:'https://maksim-site.gitverse.site/aet-trans/'}
};
let width=0,height=0,introTravel=0,start=0,serviceTop=0,serviceTravel=0;
let layoutSpeed=motionSettings.speed;
let initialRect,targetRect,frame=0,selected='sks',lastInteractive=false;
let caseValue=0,caseTarget=0,caseFrom=0,caseStarted=0;
let windowMotion=null;
const handoverDuration=420;
const handoverEase=t=>t*t*t*(t*(t*6-15)+10);
function windowTransform(q){
 const x=mix(initialRect.x,targetRect.x,q),y=mix(initialRect.y,targetRect.y,q);
 return `translate3d(${x}px,${y}px,0) scale(${mix(initialRect.w,targetRect.w,q)/targetRect.w},${mix(initialRect.h,targetRect.h,q)/targetRect.h})`;
}
function animateWindow(now){
 windowMotion?.cancel();
 if(reduced.matches){windowMotion=null;return;}
 // Run the large image transform on the compositor. A busy video/canvas frame must
 // not turn this 420ms movement into two distant requestAnimationFrame positions.
 const keyframes=Array.from({length:31},(_,i)=>({
  offset:i/30,transform:windowTransform(mix(caseFrom,caseTarget,handoverEase(i/30)))
 }));
 windowMotion=preview.animate(keyframes,{duration:handoverDuration,fill:'both',easing:'linear'});
 windowMotion.startTime=now;
}
let caseImagesReady=false,preparation=0;
function prepareCaseImages(){
 const version=++preparation;
 caseImagesReady=false;
 // Decode the stills before they fade in, rather than stalling the transition on first paint.
 Promise.all([...deck.querySelectorAll('img')].map(image=>image.decode().catch(()=>{}))).then(()=>{
  if(version!==preparation)return;
  caseImagesReady=true;update();
 });
}
// A full-height snap area lets the browser stop touch momentum at the cases.
// No touchmove cancellation or resizing the track during input.
const caseStop=document.createElement('div');
caseStop.className='case-scroll-stop';
caseStop.setAttribute('aria-hidden','true');
section.append(caseStop);
let stopArmed=false,stopTimer=0,lastWheelEventAt=-Infinity,wheelStopped=false;
let wheelBlocking=mobile||safariWheel;
let previousWheelDelta=0,wheelPeak=0,wheelFloor=Infinity,wheelFalls=0,wheelRises=0;
const entryEdge=()=>section.offsetTop+start;
const onCaseStop=()=>Math.abs(scrollY-entryEdge())<2;
function armCaseStop(armed){
 stopArmed=armed;
 if(!armed)wheelStopped=false;
 document.documentElement.classList.toggle('case-stop-armed',armed);
 stage.dataset.entryHeld=String(armed&&onCaseStop());
 syncWheelListener();
}
function syncWheelListener(){
 // Safari latches cancellation at the first wheel in a gesture. Changing from
 // passive to blocking near works is too late to stop its native momentum.
 const blocking=mobile||safariWheel||(stopArmed&&(wheelStopped||scrollY>=entryEdge()-Math.max(height*.4,Math.abs(previousWheelDelta)*2)));
 if(blocking===wheelBlocking)return;
 window.removeEventListener('wheel',handleWheel);
 wheelBlocking=blocking;
 window.addEventListener('wheel',handleWheel,{passive:!blocking});
}
function syncViewportGap(){
 const viewport=window.visualViewport;
 const visibleHeight=viewport&&viewport.scale===1?viewport.height:innerHeight;
 rest.style.paddingTop=(mobile?Math.max(0,visibleHeight-height):0)+'px';
 serviceTop=service.getBoundingClientRect().top+scrollY;
}
function sizeEntryTrack(){
 section.style.height=(start+height)+'px';
 caseStop.style.top=start+'px';
 caseStop.style.height=height+'px';
 serviceTop=service.getBoundingClientRect().top+scrollY;
}
function finishCaseStop(){
 clearTimeout(stopTimer);
 if(stopArmed&&!wheelStopped&&onCaseStop())armCaseStop(false);
}
function trackScroll(){
 // Rearm only once well above the snap area; do not pull a small upward gesture
 // back to the cases by enabling proximity snapping underneath it.
 if(!stopArmed&&scrollY<entryEdge()-Math.max(90,height*.45))armCaseStop(true);
 // Wheel scrolling can be composited between events. Catch its first crossing
 // too, while touch momentum remains entirely under native scroll snapping.
 if(stopArmed&&(wheelStopped||performance.now()-lastWheelEventAt<180)&&scrollY>entryEdge()){
  wheelStopped=true;window.scrollTo({top:entryEdge(),behavior:'instant'});
 }
 syncWheelListener();
 stage.dataset.entryHeld=String(stopArmed&&onCaseStop());
 if(!('onscrollend' in document)){
  clearTimeout(stopTimer);
  if(onCaseStop())stopTimer=setTimeout(finishCaseStop,160);
 }
 update();
}
document.addEventListener('scrollend',finishCaseStop,{passive:true});
// A new contact at the stop always starts ordinary native scrolling, even if
// the preceding scrollend has not been delivered yet. No layout changes here.
function freshContact(){
 lastWheelEventAt=-Infinity;
 if(stopArmed&&(wheelStopped||Math.abs(scrollY-entryEdge())<8))armCaseStop(false);
 document.documentElement.classList.remove('case-wheel-input');
}
const outsideTuner=event=>{if(!event.target.closest?.('.motion-tuner'))freshContact();};
window.addEventListener('pointerdown',outsideTuner,{passive:true,capture:true});
window.addEventListener('touchstart',outsideTuner,{passive:true,capture:true});
window.addEventListener('keydown',event=>{
 if(event.target.closest?.('.motion-tuner'))return;
 if(['ArrowUp','PageUp','Home','ArrowDown','PageDown','End',' '].includes(event.key))freshContact();
});
function handleWheel(event){
 if(document.documentElement.classList.contains('ice-intro-pending'))return;
 if(event.ctrlKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)||!event.deltaY)return;
 const canBlock=wheelBlocking&&event.cancelable;
 // Repeated trackpad wheel impulses must not each start a native snap-back.
 // Keep snapping for touch, and stop only the entering wheel sequence below.
 // Desktop never enters CSS snap mode. Switching it off on the first wheel
 // impulse makes Safari reconfigure an already-running native scroll animation.
 const firstWheel=mobile&&!document.documentElement.classList.contains('case-wheel-input');
 if(mobile)document.documentElement.classList.add('case-wheel-input');
 const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?height:1);
 const separate=event.timeStamp-lastWheelEventAt>=180||previousWheelDelta<=0||event.deltaMode!==0;
 let renewed=false;
 if(separate||delta<=0){wheelPeak=Math.max(0,delta);wheelFloor=Infinity;wheelFalls=0;wheelRises=0;}
 else{
  const rising=delta>previousWheelDelta+Math.max(.5,previousWheelDelta*.1);
  if(delta<previousWheelDelta-Math.max(.5,previousWheelDelta*.03)){
   wheelFalls++;wheelFloor=Math.min(wheelFloor,delta);
  }
  const tailSeen=(wheelFalls>=2&&wheelFloor<=wheelPeak*.75)||wheelFloor<=wheelPeak*.4;
  wheelRises=tailSeen&&rising?wheelRises+1:0;
  renewed=wheelRises>0&&((delta>=wheelFloor*2.5&&delta-wheelFloor>=18)||
   (wheelRises>=2&&delta>=wheelFloor*1.5&&delta-wheelFloor>=8));
  wheelPeak=Math.max(wheelPeak,delta);
 }
 previousWheelDelta=delta;
 lastWheelEventAt=event.timeStamp;
 if(!stopArmed)return;
 // Own the approaching Safari gesture from its first impulse. Apply the OS
 // deltas unchanged (including inertia), then discard only the tail at works.
 // Otherwise native scrolling passes the sticky boundary and scrollTo pulls
 // it back on every event, visibly shaking the shrinking project window.
 if(safariWheel&&canBlock)event.preventDefault();
 const releaseWheel=()=>{
  armCaseStop(false);
  // Removing a snap target can consume the current native wheel animation.
  // Apply this accepted impulse once; subsequent events scroll normally.
  if(canBlock){event.preventDefault();window.scrollBy({top:delta,behavior:'instant'});}
 };
 if(wheelStopped){
  if(delta<0||separate||renewed){releaseWheel();return;}
  if(canBlock)event.preventDefault();
  return;
 }
 if(separate&&onCaseStop()){releaseWheel();return;}
 if(delta>0&&scrollY<entryEdge()+2&&scrollY+delta>=entryEdge()){
  wheelStopped=true;syncWheelListener();
  if(canBlock){event.preventDefault();window.scrollTo({top:entryEdge(),behavior:'instant'});update();}
  return;
 }
 syncWheelListener();
 if(safariWheel&&canBlock){window.scrollBy({top:delta,behavior:'instant'});return;}
 if(firstWheel){
  if(canBlock){event.preventDefault();window.scrollBy({top:delta,behavior:'instant'});}
 }
}
window.addEventListener('wheel',handleWheel,{passive:!wheelBlocking});
next.addEventListener('click',()=>armCaseStop(false));
document.documentElement.classList.add('journey-ready');
// Stop browser image/link dragging and text recognition from intercepting preview clicks.
document.querySelectorAll('a').forEach(link=>link.draggable=false);
document.addEventListener('dragstart',event=>{if(event.target.closest('a,img,button'))event.preventDefault();});
document.addEventListener('selectstart',event=>{
 const element=event.target instanceof Element?event.target:event.target.parentElement;
 if(element?.closest('h1,h2,h3,h4,h5,h6,button,a,nav,.service-model'))event.preventDefault();
});

function layout(){
 const nextWidth=stage.clientWidth,nextHeight=stage.clientHeight;
 const speedChanged=layoutSpeed!==motionSettings.speed;
 // Browser toolbar animation must not restart the handover or rebuild its images.
 if(width===nextWidth&&height===nextHeight&&!speedChanged){syncViewportGap();update();return;}
 windowMotion?.cancel();windowMotion=null;
 const firstLayout=height===0;
 const previousEdge=entryEdge(),previousHeight=height;
 const previousScroll=scrollY;
 const viewingCases=!firstLayout&&Math.abs(scrollY-previousEdge)<2;
 width=nextWidth;height=nextHeight;
 syncViewportGap();
 const portrait=mobile&&height>width;
 const stacked=height>=width;
 stage.dataset.caseLayout=stacked?'stacked':'wide';
 layoutSpeed=motionSettings.speed;
 introTravel=height*(reduced.matches?(mobile?.8:1):(mobile?(portrait?2.1:2.35)/layoutSpeed:2));
 // A whole CSS pixel is representable by both WebKit and Chromium scroll positions.
 start=Math.round(introTravel*(reduced.matches?.62:.74));
 section.dataset.introTravel=String(introTravel);
 section.dataset.caseScroll=String(start);
 sizeEntryTrack();
 if(speedChanged&&!firstLayout){
  // Changing travel must keep the same animation frame and the same section
  // in view. Account for content below the shortened/lengthened intro too.
  const y=previousScroll<=previousEdge?
   section.offsetTop+(previousScroll-section.offsetTop)/Math.max(1,previousEdge-section.offsetTop)*start:
   previousScroll+entryEdge()-previousEdge;
  window.scrollTo({top:y,behavior:'instant'});
 }
 if(firstLayout)armCaseStop(scrollY<entryEdge()-2);
 // Keep the same scene visible when rotating a phone or hiding browser bars.
 if(!firstLayout&&viewingCases&&previousHeight!==height){
  armCaseStop(false);window.scrollTo({top:entryEdge(),behavior:'instant'});
 }
 // Match the contained landscape still in both players, including portrait phones.
 const startW=Math.min(width,height*16/9);
 initialRect={x:(width-startW)/2,y:(height-startW*9/16)/2,w:startW,h:startW*9/16};
 const src='./assets/intro/sks-end.png';
 if(origin.getAttribute('src')!==src)origin.src=src;
 if(stacked){
  const endW=Math.min(width-40,Math.max(230,(height-280)*1.6));
  targetRect={x:(width-endW)/2,y:Math.max(98,Math.min(155,height*.2)),w:endW,h:endW/1.6};
  heading.style.left='20px';
  picker.style.left='20px';picker.style.right='20px';picker.style.width='auto';
  picker.style.top=(targetRect.y+targetRect.h+111)+'px';
 }else{
  const margin=Math.max(20,width*.05),gap=Math.max(20,width*.025);
  const titleSize=Math.min(76,Math.max(28,height*.085));
  const top=Math.max(12,height*.03)+titleSize+16;
  const sideW=Math.min(260,Math.max(150,width*.23));
  const compact=height<500,descriptionSpace=compact?68:88;
  const endW=Math.min(width-margin*2-gap-sideW,Math.max(100,height-top-descriptionSpace-16)*1.6);
  const groupLeft=(width-endW-gap-sideW)/2;
  targetRect={x:groupLeft,y:top,w:endW,h:endW/1.6};
  heading.style.left=groupLeft+'px';
  const rowGap=height<500?7:14;
  const thumbH=Math.max(28,Math.min((sideW-76)/1.6,(targetRect.h-rowGap*(projectButtons.length-1))/projectButtons.length));
  const pickerHeight=thumbH*projectButtons.length+rowGap*(projectButtons.length-1);
  stage.style.setProperty('--case-title-size',titleSize+'px');
  stage.style.setProperty('--case-row-gap',rowGap+'px');
  stage.style.setProperty('--case-thumb-height',thumbH+'px');
  stage.style.setProperty('--case-thumb-width',thumbH*1.6+'px');
  picker.style.left=(groupLeft+endW+gap)+'px';picker.style.right='auto';picker.style.width=sideW+'px';
  picker.style.top=(targetRect.y+(targetRect.h-pickerHeight)/2)+'px';
 }
 // Set layout once. During the handover, animate only compositor transforms and opacity.
 preview.style.width=targetRect.w+'px';
 preview.style.height=targetRect.h+'px';
 description.style.left=targetRect.x+'px';
 description.style.top=(targetRect.y+targetRect.h+(stacked?12:10))+'px';
 description.style.width=targetRect.w+'px';
 serviceTop=service.getBoundingClientRect().top+scrollY;
 serviceTravel=Math.max(1,service.offsetHeight-service.querySelector('.service-stage').clientHeight);
 prepareCaseImages();
 update();
}
function selectProject(name){
 if(!projects[name]||name===selected)return;
 selected=name;const project=projects[name];
 preview.href=project.url;preview.setAttribute('aria-label','Открыть сайт '+project.title);
 description.querySelector('h3').textContent=project.title;
 description.querySelector('p').textContent=project.description;
 description.querySelector('a').href=project.url;
 deck.querySelectorAll('.project-image').forEach(image=>image.classList.toggle('is-active',image.dataset.project===name));
 projectButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.project===name)));
 deck.dataset.project=name;
}
projectButtons.forEach(button=>button.addEventListener('click',()=>selectProject(button.dataset.project)));
// Safari may consume the compatibility click when a tap interrupts momentum.
// Select on the completed tap too; movement cancels it and keeps native panning.
let caseTap=null;
picker.addEventListener('touchstart',event=>{
 const button=event.target.closest('button[data-project]'),touch=event.touches[0];
 caseTap=button&&event.touches.length===1?{name:button.dataset.project,id:touch.identifier,x:touch.clientX,y:touch.clientY}:null;
},{passive:true});
picker.addEventListener('touchmove',event=>{
 if(!caseTap)return;
 const touch=[...event.touches].find(touch=>touch.identifier===caseTap.id);
 if(!touch||event.touches.length!==1||Math.hypot(touch.clientX-caseTap.x,touch.clientY-caseTap.y)>8)caseTap=null;
},{passive:true});
picker.addEventListener('touchend',event=>{
 const tap=caseTap;caseTap=null;
 if(tap&&[...event.changedTouches].some(touch=>touch.identifier===tap.id))selectProject(tap.name);
},{passive:true});
picker.addEventListener('touchcancel',()=>{caseTap=null;},{passive:true});

function update(){if(!frame)frame=requestAnimationFrame(render)}
function render(now){
 frame=0;
 const scroll=scrollY-section.offsetTop;
 const flight=Number(stage.dataset.flightMode==='reduced'?stage.dataset.scrollProgress:stage.dataset.renderProgress||0);
 const blend=reduced.matches?Number(flight>=.5):Number(stage.dataset.sksBlend||0);
 // Once the still is sharp, finish this short handover even if scrolling stops.
 const canEnter=caseImagesReady&&origin.complete&&origin.naturalWidth>0&&blend>.99&&flight>(reduced.matches?.5:.69);
 let target=caseTarget;
 if(scroll>=start-.5&&canEnter)target=1;
 else if(scroll<start-Math.min(90,height*.1))target=0;
 if(target!==caseTarget){
  const previousElapsed=reduced.matches?1:clamp((now-caseStarted)/handoverDuration);
  caseValue=mix(caseFrom,caseTarget,handoverEase(previousElapsed));
  caseFrom=caseValue;caseStarted=now;caseTarget=target;
  animateWindow(now);
 }
 const elapsed=reduced.matches?1:clamp((now-caseStarted)/handoverDuration);
 const eased=handoverEase(elapsed);
 caseValue=mix(caseFrom,caseTarget,eased);
 if(elapsed>=1)caseValue=caseTarget;
 const q=caseValue;
 // The first overlay is pixel-aligned with the original still. Wait until its blend is done.
 const visible=origin.complete&&origin.naturalWidth?smooth((blend-.97)/.03):0;
 deck.style.opacity=String(visible);
 backdrop.style.opacity=String(smooth(q/.2));
 if(!windowMotion||elapsed>=1){
  preview.style.transform=windowTransform(q);
  windowMotion?.cancel();windowMotion=null;
 }
 preview.style.borderRadius=(q*10)+'px';
 preview.style.borderColor=`rgba(224,230,232,${q*.24})`;
 origin.style.opacity=String(1-smooth((q-.1)/.6));
 const appear=smooth((q-.38)/.58);
 [heading,description,picker,next].forEach(el=>el.style.opacity=String(appear));
 heading.style.transform=`translateY(${(1-appear)*14}px)`;
 // Keep actionable targets still from their first visible frame. Moving them
 // between touchstart and touchend sends the native click to the background.
 description.style.transform='none';
 picker.style.transform='none';
 // Interaction follows visibility, not completion of the still/entrance blend.
 const interactive=appear>0&&visible>0;
 if(interactive!==lastInteractive){deck.inert=!interactive;deck.classList.toggle('is-interactive',interactive);lastInteractive=interactive;}
 deck.setAttribute('aria-hidden',String(!interactive));
 if(q<.05&&selected!=='sks')selectProject('sks');
 stage.dataset.caseProgress=q.toFixed(4);
 if(!reduced.matches)renderServices();
 if(caseValue!==caseTarget)update();
}
function renderServices(){
 renderPaperStory(serviceTop, serviceTravel);
}
const observer=new MutationObserver(update);
observer.observe(stage,{attributes:true,attributeFilter:['data-render-progress','data-scroll-progress','data-sks-blend','data-flight-mode']});
const revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
 if(entry.isIntersecting){entry.target.classList.add('is-revealed');revealObserver.unobserve(entry.target);}
}),{threshold:.15});
document.querySelectorAll('[data-reveal]').forEach(el=>revealObserver.observe(el));
origin.addEventListener('load',update);
window.addEventListener('scroll',trackScroll,{passive:true});
window.addEventListener('resize',layout,{passive:true});
window.visualViewport?.addEventListener('resize',()=>{
 if(stage.clientHeight!==height)layout();
 else{syncViewportGap();update();}
},{passive:true});
reduced.addEventListener('change',()=>location.reload());
if(tuningEnabled){
 window.addEventListener('mobile-motion-change',layout);
 window.addEventListener('mobile-motion-replay',()=>{
  windowMotion?.cancel();windowMotion=null;
  caseValue=caseTarget=caseFrom=caseStarted=0;
  selectProject('sks');
  window.scrollTo({top:section.offsetTop,behavior:'instant'});
  lastWheelEventAt=-Infinity;previousWheelDelta=0;
  armCaseStop(true);update();
 });
}
window.addEventListener('pagehide',()=>{observer.disconnect();revealObserver.disconnect();cancelAnimationFrame(frame);clearTimeout(stopTimer);windowMotion?.cancel()},{once:true});
layout();
// Deep links must settle after the paper track grows on its first load.
// A real gesture cancels this correction; never move a reader who has started scrolling.
const initialAnchor=['#services','#approach','#contact'].includes(location.hash)?location.hash:null;
if(initialAnchor){
 const input=new AbortController();
 const cancel=()=>input.abort();
 for(const type of ['wheel','touchstart','pointerdown','keydown'])window.addEventListener(type,cancel,{passive:true,signal:input.signal});
 paperReady.then(()=>requestAnimationFrame(()=>{
  if(!input.signal.aborted&&location.hash===initialAnchor){
   armCaseStop(false);
   document.querySelector(initialAnchor)?.scrollIntoView({block:'start',behavior:'instant'});
  }
  input.abort();
 }));
}
