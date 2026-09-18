// The review link is opt-in. Ordinary pages always use the approved defaults.
const params=new URLSearchParams(location.search);
export const tuningEnabled=document.documentElement.dataset.layout==='mobile'&&params.get('tune')==='1';
export const motionDefaults=Object.freeze({speed:1,inertia:35});
export const motionSettings={...motionDefaults};
const storageKey='maksim-mobile-motion-v1';
const bounds={speed:[.75,1.75,.05],inertia:[0,100,5]};
function sanitize(key,value){
 const number=Number(value),[min,max,step]=bounds[key];
 return value===null||value===''||!Number.isFinite(number)?motionDefaults[key]:
  Number((Math.round(Math.max(min,Math.min(max,number))/step)*step).toFixed(2));
}
if(tuningEnabled){
 let saved={};
 try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')||{};}catch{}
 for(const key of Object.keys(bounds))motionSettings[key]=sanitize(key,params.has(key)?params.get(key):saved[key]??motionDefaults[key]);
}

export function setMotionSettings(values){
 if(!tuningEnabled)return;
 for(const key of Object.keys(bounds))if(key in values)motionSettings[key]=sanitize(key,values[key]);
 try{localStorage.setItem(storageKey,JSON.stringify(motionSettings));}catch{}
 const url=new URL(location.href);
 for(const [key,value] of Object.entries(motionSettings))url.searchParams.set(key,String(value));
 history.replaceState(history.state,'',url);
 window.dispatchEvent(new CustomEvent('mobile-motion-change',{detail:{...motionSettings}}));
}

export function mountMotionTuner(){
 if(!tuningEnabled||document.querySelector('.motion-tuner'))return;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const panel=document.createElement('details');
 panel.className='motion-tuner';panel.open=true;
 panel.innerHTML=`
  <summary><span>Настроить движение</span><span class="motion-tuner-chevron" aria-hidden="true">⌃</span></summary>
  <div class="motion-tuner-body">
   <p class="motion-tuner-note">Меняй значения и листай. Настройки сохраняются на этом устройстве.</p>
   <label for="motion-speed"><span>Скорость пролёта</span><output for="motion-speed" id="motion-speed-value"></output></label>
   <input id="motion-speed" type="range" min="0.75" max="1.75" step="0.05">
   <p class="motion-tuner-hint">Больше — меньше свайпов до работ.</p>
   <label for="motion-inertia"><span>Инерция картинки</span><output for="motion-inertia" id="motion-inertia-value"></output></label>
   <input id="motion-inertia" type="range" min="0" max="100" step="5">
   <p class="motion-tuner-hint">Больше — дольше движение после свайпа.</p>
   <div class="motion-tuner-actions"><button type="button" data-motion="replay">С начала ↗</button><button type="button" data-motion="reset">Сбросить</button></div>
   <button type="button" class="motion-tuner-copy" data-motion="copy">Скопировать настройки</button>
   <p class="motion-tuner-status" role="status"></p>
   <textarea class="motion-tuner-export" aria-label="Настройки для копирования" readonly hidden></textarea>
  </div>`;
 document.body.append(panel);
 const status=panel.querySelector('.motion-tuner-status');
 const exported=panel.querySelector('textarea');
 const fields=Object.fromEntries(Object.keys(bounds).map(key=>[key,panel.querySelector('#motion-'+key)]));
 const speedText=()=>motionSettings.speed.toFixed(2).replace('.',',')+'×';
 function sync(){
  for(const [key,input] of Object.entries(fields))input.value=String(motionSettings[key]);
  panel.querySelector('#motion-speed-value').textContent=speedText();
  panel.querySelector('#motion-inertia-value').textContent=motionSettings.inertia+'%';
  fields.speed.setAttribute('aria-valuetext',speedText());
  fields.inertia.setAttribute('aria-valuetext',motionSettings.inertia+' процентов');
  for(const field of Object.values(fields))field.disabled=reduced.matches;
  if(reduced.matches)status.textContent='В системе включено уменьшение движения. Настройка анимации сейчас отключена.';
 }
 for(const [key,input] of Object.entries(fields))input.addEventListener('input',()=>{
  status.textContent='';exported.hidden=true;
  setMotionSettings({[key]:input.value});sync();
 });
 panel.querySelector('[data-motion="replay"]').addEventListener('click',()=>{
  panel.open=false;window.dispatchEvent(new Event('mobile-motion-replay'));
 });
 panel.querySelector('[data-motion="reset"]').addEventListener('click',()=>{
  setMotionSettings(motionDefaults);sync();exported.hidden=true;
  if(!reduced.matches)status.textContent='Вернул исходные значения.';
 });
 panel.querySelector('[data-motion="copy"]').addEventListener('click',async()=>{
  const url=new URL(location.href);
  for(const [key,value] of Object.entries(motionSettings))url.searchParams.set(key,String(value));
  const text=`MAKSIM — мобильная анимация\nСкорость: ${speedText()}\nИнерция: ${motionSettings.inertia}%\n${url.href}`;
  try{
   if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
   await navigator.clipboard.writeText(text);
   status.textContent='Скопировано. Пришли эти настройки в чат.';
  }catch{
   exported.hidden=false;exported.value=text;exported.focus({preventScroll:true});exported.select();
   let copied=false;
   try{copied=document.execCommand('copy');}catch{}
   if(copied){exported.hidden=true;panel.querySelector('[data-motion="copy"]').focus({preventScroll:true});}
   status.textContent=copied?'Скопировано. Пришли эти настройки в чат.':'Скопируй выделенный текст и пришли в чат.';
  }
 });
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'){panel.open=false;panel.querySelector('summary').focus();}});
 sync();
}
