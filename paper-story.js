// Native scroll controls a bounded cache of decoded images, including in Safari.
// No video seeking, wheel cancellation, touch handlers, or independent scroll inertia.
const section = document.querySelector('.paper-story');
const stage = section.querySelector('.service-stage');
const visual = section.querySelector('.paper-visual');
const canvas = section.querySelector('.paper-canvas');
const context = canvas.getContext('2d', {alpha:false});
const copies = [...section.querySelectorAll('.service-copy')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (x,a=0,b=1) => Math.max(a,Math.min(b,x));
const smooth = x => {x=clamp(x);return x*x*(3-2*x)};
const frames = new Map(), loading = new Map(), failures = new Map();
// Store compressed frame groups ahead of the reader. Only the small moving
// window below is decoded, so buffering the film does not retain 285 rasters.
const packs=new Map(), packRequests=new Map(), packFailures=new Map();
let buffering=false, bufferTimer=0;
let manifest=null, raf=0, desired=0, shown=-1, active=false, disposed=false;
let progress=0, width=0, height=0, currentChapter=-1, direction=1, previousDesired=0;
let queue=[], inFlight=0, decodeLimit=3, generation=0, lastPaint=-1;
const base = new URL('./assets/paper-v1/',import.meta.url);
const frameUrl = i => new URL(`${manifest.folder}/frame-${String(i).padStart(3,'0')}.webp`,base).href;
const limit = () => innerWidth<=700 ? 14 : 20;

function packAt(index){return manifest.packs?.findIndex(pack=>index>=pack.start&&index<pack.start+pack.frames.length)??-1}
async function fetchPack(index){
 if(packs.has(index))return packs.get(index);
 if(packRequests.has(index))return packRequests.get(index);
 const info=manifest.packs[index];
 const request=fetch(new URL(info.file,base),{priority:'low'}).then(response=>{
  if(!response.ok)throw new Error('Paper buffer '+response.status);
  return response.blob();
 }).then(blob=>{
  if(blob.size!==info.bytes)throw new Error('Incomplete paper buffer');
  packs.set(index,blob);packFailures.delete(index);
  section.dataset.paperBuffered=String([...packs.keys()].reduce((n,i)=>n+manifest.packs[i].frames.length,0));
  return blob;
 }).catch(error=>{packFailures.set(index,Date.now());throw error})
 .finally(()=>{packRequests.delete(index);bufferAhead()});
 packRequests.set(index,request);return request;
}
function bufferAhead(){
 if(!buffering||!manifest?.packs||disposed||document.hidden)return;
 const current=Math.max(0,packAt(desired));
 const order=manifest.packs.map((_,i)=>i).sort((a,b)=>Math.abs(a-current)-Math.abs(b-current));
 for(const index of order){
  if(packRequests.size>=2)break;
  if(!packs.has(index)&&!packRequests.has(index)&&Date.now()-(packFailures.get(index)||0)>3000){
   fetchPack(index).catch(()=>{});
  }
 }
}
async function compressedFrame(index){
 const pack=packAt(index);
 if(pack<0||Date.now()-(packFailures.get(pack)||0)<3000)return null;
 const data=await fetchPack(pack),[offset,length]=manifest.packs[pack].frames[index-manifest.packs[pack].start];
 return data.slice(offset,offset+length,'image/webp');
}

function invalidate(){if(!raf&&!disposed)raf=requestAnimationFrame(paint)}
function trim(){
 const removable=[...frames.keys()].filter(i=>i!==shown&&i!==desired&&i!==0)
   .sort((a,b)=>Math.abs(b-desired)-Math.abs(a-desired));
 while(frames.size>limit()&&removable.length)frames.delete(removable.shift());
 section.dataset.paperCache=String(frames.size);
}
function pump(){
 while(active&&queue.length&&inFlight<decodeLimit&&!disposed){
  const index=queue.shift();
  if(frames.has(index)||loading.has(index)||Date.now()-(failures.get(index)||0)<3000)continue;
  inFlight++;
  const image=new Image();image.decoding='async';
  let objectUrl;
  const request=compressedFrame(index).catch(()=>null).then(async blob=>{
   // Safari's decoded Image path is the approved renderer for these scenes.
   image.src=blob?(objectUrl=URL.createObjectURL(blob)):frameUrl(index);
   await image.decode();
  }).then(()=>{
   if(disposed)return;
   if(Math.abs(index-desired)>limit()&&index!==shown&&index!==0)return;
   frames.set(index,image);failures.delete(index);trim();invalidate();
  }).catch(()=>{failures.set(index,Date.now());section.dataset.paperLoadError=String(index)})
  .finally(()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);loading.delete(index);inFlight--;pump()});
  loading.set(index,request);
 }
}
function warm(){
 if(!manifest||!active)return;
 const offsets=[0,direction,-direction,2*direction,-2*direction,...Array.from({length:10},(_,i)=>(i+3)*direction)];
 queue=[...new Set(offsets.map(n=>clamp(desired+n,0,manifest.count-1)))];
 pump();
}
function focalPoint(t){
 // Portrait is a close shot: follow the roll, then the front page and the bird.
 // Wide screens keep the original composition apart from the small cover crop.
 if(width>=height)return .5;
 const keys=[[0,.59],[.18,.59],[.36,.39],[.49,.43],[.64,.43],[.8,.35],[1,.315]];
 for(let i=1;i<keys.length;i++){
  if(t<=keys[i][0]){
   const [a,x]=keys[i-1],[b,y]=keys[i];
   return x+(y-x)*smooth((t-a)/(b-a));
  }
 }
 return keys.at(-1)[1];
}
function paint(){
 raf=0;
 if(!active||!manifest||disposed)return;
 let index=desired;
 if(!frames.has(index)){
  // Keep the last valid frame while loading; never flash to a blank canvas.
  const nearby=[...frames.keys()].filter(i=>Math.abs(i-desired)<=8).sort((a,b)=>Math.abs(a-desired)-Math.abs(b-desired));
  index=nearby[0]??shown;
 }
 const image=frames.get(index);
 if(!image||index===lastPaint)return;
 context.fillStyle='#090a0b';context.fillRect(0,0,canvas.width,canvas.height);
 const scale=Math.max(canvas.width/image.naturalWidth,canvas.height/image.naturalHeight);
 const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
 const x=clamp(canvas.width*.5-w*focalPoint(index/(manifest.count-1)),canvas.width-w,0);
 context.drawImage(image,x,(canvas.height-h)/2,w,h);
 section.dataset.paperFit='cover';
 shown=index;lastPaint=index;
 updateCopies(index/(manifest.count-1));
 section.dataset.paperFrame=String(index);
 section.dataset.paperStatus='ready';
 trim();
}
function layout(){
 const nextWidth=visual.clientWidth,nextHeight=visual.clientHeight;
 if(nextWidth===width&&nextHeight===height)return;
 width=nextWidth;height=nextHeight;
 // The sequence is 720p. A larger backing store only increases memory and paint cost.
 const scale=Math.min(devicePixelRatio||1,1280/Math.max(1,width),720/Math.max(1,height));
 canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
 lastPaint=-1;invalidate();
}
function updateCopies(displayProgress){
 const starts=manifest.chapters.map(c=>c.progress);
 let selected=0;
 for(let i=1;i<starts.length;i++)if(displayProgress>=starts[i])selected=i;
 copies.forEach((copy,i)=>{
  const fadeIn=i===0?1:smooth((displayProgress-starts[i])/.028);
  const fadeOut=i===starts.length-1?1:1-smooth((displayProgress-(starts[i+1]-.028))/.028);
  const opacity=fadeIn*fadeOut;
  copy.style.opacity=String(opacity);
  const side=i===1?1:-1;
  copy.style.transform=`translate3d(${side*(1-opacity)*18}px,${(1-opacity)*8}px,0)`;
  copy.inert=opacity<.5;
  copy.setAttribute('aria-hidden',String(opacity<.5));
 });
 if(selected!==currentChapter){
  currentChapter=selected;
  section.dataset.step=String(selected);
 }
}
export function renderPaperStory(top,travel){
 if(!manifest||reduced.matches)return;
 const rect=section.getBoundingClientRect();
 active=rect.top<innerHeight*1.7&&rect.bottom>-innerHeight*.7;
 if(!active){queue=[];return;}
 // Measure this section directly: the intro's entry track can resize independently.
 progress=clamp(-rect.top/Math.max(1,section.offsetHeight-stage.clientHeight));
 desired=Math.round(progress*(manifest.count-1));
 direction=Math.sign(desired-previousDesired)||direction;previousDesired=desired;
 section.dataset.paperTarget=String(desired);
 section.dataset.progress=progress.toFixed(4);
 buffering=true;bufferAhead();warm();invalidate();
}
async function mount(){
 if(reduced.matches||!context)return;
 const version=++generation;
 try{
  const response=await fetch(new URL('manifest.json?v=2',base));
  if(!response.ok)throw new Error('Manifest '+response.status);
  const data=await response.json();
  if(disposed||version!==generation)return;
  if(!Number.isInteger(data.count)||data.count<2||data.chapters.length!==3)throw new Error('Invalid paper manifest');
  // Load the very first image before creating the long scroll track.
  const first=new Image();first.decoding='async';
  first.src=new URL(`${data.folder}/frame-000.webp`,base).href;await first.decode();
  if(disposed)return;
  manifest=data;frames.set(0,first);
  section.classList.add('paper-ready');
  layout();renderPaperStory();
  window.dispatchEvent(new Event('resize'));
  // Begin on the first screen as well, instead of waiting until paper is visible.
  bufferTimer=setTimeout(()=>{buffering=true;bufferAhead()},900);
 }catch(error){section.dataset.paperError=error.message;}
}
const resizeObserver=new ResizeObserver(()=>{layout();renderPaperStory()});
resizeObserver.observe(visual);
window.addEventListener('scroll',()=>renderPaperStory(),{passive:true});
window.addEventListener('pageshow',()=>{disposed=false;layout();renderPaperStory()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){bufferAhead();renderPaperStory()}});
window.addEventListener('pagehide',()=>{
 // Keep listeners for Safari's back-forward cache, but drop decoded frame memory.
 active=false;queue=[];clearTimeout(bufferTimer);cancelAnimationFrame(raf);raf=0;
 for(const index of frames.keys())if(index!==0&&index!==shown)frames.delete(index);
});
export const paperReady=mount();
