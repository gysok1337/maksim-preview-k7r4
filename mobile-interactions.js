// Touch keeps native scrolling; a small tap gust bends letters from their base.
const stage=document.querySelector('.stage');
const letters=[...document.querySelectorAll('.letter')];
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
let animations=[];
stage.addEventListener('pointerdown',event=>{
  if(event.target.closest('a')||reduced.matches||Number(stage.dataset.scrollProgress||0)>.04)return;
  animations.forEach(animation=>animation.cancel());
  animations=letters.map((letter,index)=>{
    const box=letter.getBoundingClientRect();
    const direction=event.clientX<box.x+box.width/2?1:-1;
    return letter.animate([
      {transform:'skewX(0deg)'},
      {transform:`skewX(${direction*4}deg)`,offset:.24},
      {transform:`skewX(${-direction*1.5}deg)`,offset:.58},
      {transform:'skewX(0deg)'}
    ],{duration:720,delay:index*24,easing:'ease-out'});
  });
},{passive:true});
