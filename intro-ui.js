// A single quiet footer row, shared by mobile and desktop.
const stage=document.querySelector('.stage');
const section=document.querySelector('.scroll-scene');
stage.insertAdjacentHTML('beforeend', `
 <div class="intro-links">
  <span class="intro-caption">Делаю сайты</span>
  <nav aria-label="Портфолио">
   <a href="#sks" class="intro-work-link">Работы</a>
   <a href="https://t.me/maksim_site" target="_blank" rel="noopener noreferrer">Написать</a>
  </nav>
 </div>`);
const row=stage.querySelector('.intro-links');
const target=document.createElement('div');
target.id='sks';target.className='intro-case-anchor';target.tabIndex=-1;
target.setAttribute('aria-label','Кейс СКС. Сайт для компании по разработке электроники.');
section.append(target);
stage.querySelector('.intro-work-link').addEventListener('click',event=>{
 event.preventDefault();
 event.currentTarget.blur();
 const casePosition=Number(section.dataset.caseScroll);
 window.scrollTo({top:section.offsetTop+(casePosition||(section.offsetHeight-stage.clientHeight)*.71),behavior:'instant'});
});
function sync(){
 const progress=Number(stage.dataset.flightMode==='reduced'?stage.dataset.scrollProgress:stage.dataset.renderProgress||stage.dataset.scrollProgress||0);
 const t=Math.max(0,Math.min(1,progress/.11));
 const opacity=1-t*t*(3-2*t);
 row.style.opacity=String(opacity);row.inert=opacity<.05;
}
const observer=new MutationObserver(sync);
observer.observe(stage,{attributes:true,attributeFilter:['data-render-progress','data-scroll-progress','data-flight-mode']});
window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
sync();
