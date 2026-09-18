(function(){
  'use strict';

  var root=document.documentElement;
  var active=root.classList.contains('ice-intro-pending');
  window.__iceIntroActive=active;
  if(!active){root.dataset.iceIntro='skipped';return;}
  root.dataset.iceIntro='playing';
  var content=[document.querySelector('#intro'),document.querySelector('.portfolio-rest')].filter(Boolean);
  content.forEach(function(el){el.inert=true;});
  var finished=false;

  var loader=document.getElementById('loader');
  var glassBase=document.getElementById('iceGlassBase');
  var frost=document.getElementById('iceFrost');
  var shardsRoot=document.getElementById('iceShards');
  var cracks=document.getElementById('iceCracks');
  var core=document.getElementById('iceLoaderCore');
  var word=document.getElementById('iceLoaderWord');
  var fill=document.getElementById('iceWordFill');
  var sub=document.getElementById('iceLoaderSub');
  var spark=document.getElementById('iceImpactSpark');
  var streak=document.getElementById('iceImpactStreak');
  var animations=[];
  var timers=[];
  var started=false;

  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function point(x,y){return {x:x,y:y};}
  function pct(value,total){return value/total*100;}
  function polygon(points){
    return 'polygon('+points.map(function(p){return p.x.toFixed(3)+'% '+p.y.toFixed(3)+'%';}).join(',')+')';
  }
  function centroid(points){
    var sum=points.reduce(function(acc,p){acc.x+=p.x;acc.y+=p.y;return acc;},{x:0,y:0});
    return {x:sum.x/points.length,y:sum.y/points.length};
  }
  function setStyles(element,styles){
    if(!element)return;
    Object.keys(styles).forEach(function(property){element.style[property]=styles[property];});
  }
  function motion(element,keyframes,options){
    if(!element)return null;
    var animation=element.animate(keyframes,Object.assign({fill:'both'},options,{duration:options.duration*.76,delay:(options.delay||0)*.76}));
    animations.push(animation);
    return animation;
  }
  function settle(animation,element,styles){
    if(!animation||!element)return;
    animation.finished.then(function(){
      if(styles)setStyles(element,styles);
      animation.cancel();
    }).catch(function(){});
  }
  function later(delay,callback){timers.push(setTimeout(callback,delay));}
  function markSeen(){try{sessionStorage.setItem('maksimIceIntroSeen','1');}catch(_){} }

  function buildCracks(originX,originY,width,height){
    cracks.innerHTML='';
    cracks.setAttribute('viewBox','0 0 '+width+' '+height);
    var mobile=width<=640;
    var mainCount=mobile?8:11;

    function noise(seed){
      var value=Math.sin(seed*12.9898+78.233)*43758.5453;
      return value-Math.floor(value);
    }
    function edgeDistance(angle){
      var cos=Math.cos(angle),sin=Math.sin(angle);
      var xDistance=cos>0?(width-originX)/cos:(cos<0?-originX/cos:Infinity);
      var yDistance=sin>0?(height-originY)/sin:(sin<0?-originY/sin:Infinity);
      return Math.min(xDistance,yDistance);
    }
    function jaggedPoints(startX,startY,angle,length,segments,seed){
      var points=[point(startX,startY)];
      for(var step=1;step<=segments;step++){
        var progress=step/segments;
        var forward=length*progress;
        var lateral=(noise(seed+step*3.17)-.5)*length*(.028+progress*.018);
        var kink=(noise(seed+step*7.31)-.5)*length*.012;
        points.push(point(
          startX+Math.cos(angle)*forward+Math.cos(angle+Math.PI/2)*lateral+Math.cos(angle)*kink,
          startY+Math.sin(angle)*forward+Math.sin(angle+Math.PI/2)*lateral+Math.sin(angle)*kink
        ));
      }
      return points;
    }
    function addCrack(points,className,delay,duration){
      if(points.length<2)return;
      var path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('pathLength','1');
      path.setAttribute('class',className||'main');
      path.setAttribute('d',points.map(function(p,index){return (index?'L ':'M ')+p.x.toFixed(2)+' '+p.y.toFixed(2);}).join(' '));
      path.dataset.crackDelay=String(delay||0);
      path.dataset.crackDuration=String(duration||420);
      cracks.appendChild(path);
    }

    for(var index=0;index<mainCount;index++){
      var baseAngle=-Math.PI+.16+index*(Math.PI*2/mainCount);
      var angle=baseAngle+(noise(index+2.4)-.5)*.25;
      var reach=edgeDistance(angle)*(.74+noise(index+8.7)*.34);
      var segments=mobile?6+(index%2):7+(index%3);
      var startRadius=3+noise(index+18.2)*7;
      var startX=originX+Math.cos(angle)*startRadius;
      var startY=originY+Math.sin(angle)*startRadius;
      var mainPoints=jaggedPoints(startX,startY,angle,reach,segments,index*19.7+4);
      addCrack([point(originX,originY)].concat(mainPoints),index%4===1?'main strong':'main',26+index*13,470+index%3*35);

      var branchTotal=index%3===0?2:1;
      for(var branchIndex=0;branchIndex<branchTotal;branchIndex++){
        var pointIndex=clamp(2+branchIndex*2+(index%2),1,mainPoints.length-2);
        var base=mainPoints[pointIndex];
        var side=(index+branchIndex)%2?1:-1;
        var branchAngle=angle+side*(.38+noise(index*11+branchIndex+5)*.48);
        var branchLength=clamp(reach*(.11+noise(index*7+branchIndex+2)*.12),34,mobile?92:150);
        addCrack(
          jaggedPoints(base.x,base.y,branchAngle,branchLength,3+(index+branchIndex)%3,index*31+branchIndex*9+12),
          'branch',112+index*11+branchIndex*24,300+branchIndex*45
        );
      }
    }

    [24,51].forEach(function(baseRadius,ringIndex){
      var ringPoints=[];
      var count=ringIndex?11:8;
      for(var ringPoint=0;ringPoint<count;ringPoint++){
        var ringAngle=-.28+ringPoint*(Math.PI*2/count)+(noise(ringPoint+ringIndex*17)-.5)*.16;
        var radius=baseRadius*(.76+noise(ringPoint*3+ringIndex+21)*.46);
        ringPoints.push(point(originX+Math.cos(ringAngle)*radius,originY+Math.sin(ringAngle)*radius));
      }
      for(var segment=0;segment<count;segment+=3){
        addCrack([ringPoints[segment],ringPoints[(segment+1)%count],ringPoints[(segment+2)%count]],'ring',128+ringIndex*42+segment*5,250+ringIndex*45);
      }
    });

    for(var splinterIndex=0;splinterIndex<(mobile?5:8);splinterIndex++){
      var splinterAngle=-2.7+splinterIndex*.69+(noise(splinterIndex+41)-.5)*.3;
      var splinterStart=12+noise(splinterIndex+54)*21;
      var splinterLength=22+noise(splinterIndex+67)*43;
      var splinterX=originX+Math.cos(splinterAngle)*splinterStart;
      var splinterY=originY+Math.sin(splinterAngle)*splinterStart;
      addCrack(
        jaggedPoints(splinterX,splinterY,splinterAngle+(noise(splinterIndex+72)-.5)*.6,splinterLength,2+(splinterIndex%2),splinterIndex*23+81),
        splinterIndex<2?'impact':'splinter',splinterIndex*9,190+splinterIndex%3*30
      );
    }
  }

  function buildShards(originX,originY,width,height){
    shardsRoot.innerHTML='';
    var mobile=width<=640;
    var cx=pct(originX,width),cy=pct(originY,height);
    var cols=mobile?2:3,rows=2,sites=[];
    for(var row=0;row<rows;row++){
      for(var col=0;col<cols;col++){
        var order=row*cols+col;
        sites.push(point(
          clamp((col+.5)/cols*100+Math.sin((order+1)*2.71)*(mobile?3.2:4.1),3,97),
          clamp((row+.5)/rows*100+Math.cos((order+1)*1.91)*(mobile?3.5:4.2),3,97)
        ));
      }
    }
    sites.push(point(cx,cy));
    if(mobile){
      sites.push(point(clamp(cx-11,3,97),clamp(cy+10,3,97)));
    }else{
      sites.push(point(clamp(cx-8,3,97),clamp(cy-9,3,97)));
      sites.push(point(clamp(cx+8,3,97),clamp(cy-8,3,97)));
      sites.push(point(clamp(cx+9,3,97),clamp(cy+8,3,97)));
    }

    function clipCell(cell,site,other){
      if(!cell.length)return cell;
      var dx=other.x-site.x,dy=other.y-site.y;
      var constant=other.x*other.x+other.y*other.y-site.x*site.x-site.y*site.y;
      function value(p){return 2*p.x*dx+2*p.y*dy-constant;}
      var output=[];
      for(var index=0;index<cell.length;index++){
        var current=cell[index],next=cell[(index+1)%cell.length];
        var currentValue=value(current),nextValue=value(next);
        var currentInside=currentValue<=.0001,nextInside=nextValue<=.0001;
        if(currentInside)output.push(current);
        if(currentInside!==nextInside){
          var t=currentValue/(currentValue-nextValue);
          output.push(point(current.x+(next.x-current.x)*t,current.y+(next.y-current.y)*t));
        }
      }
      return output;
    }

    sites.map(function(site,index){
      var cell=[point(0,0),point(100,0),point(100,100),point(0,100)];
      sites.forEach(function(other,otherIndex){if(index!==otherIndex)cell=clipCell(cell,site,other);});
      return {points:cell};
    }).filter(function(shape){return shape.points.length>=3;}).forEach(function(shape,order){
      var center=centroid(shape.points);
      var shard=document.createElement('span');
      var dx=center.x-cx,dy=center.y-cy;
      var length=Math.hypot(dx,dy)||1;
      var nx=dx/length,ny=dy/length;
      var seed=Math.sin((order+1)*13.73);
      var near=length<18;
      var burst=(near?38:54)+(order%4)*5;
      var fall=(near?height*.25:height*.38)+(order%3)*20;
      var side=width*(near?.09:.135);
      var rotate=(order%2?1:-1)*((near?18:12)+(order%5)*5);
      shard.className='ice-shard';
      shard.style.clipPath=polygon(shape.points);
      shard.style.webkitClipPath=polygon(shape.points);
      shard.style.transformOrigin=center.x+'% '+center.y+'%';
      shard.dataset.burstX=(nx*burst+seed*11).toFixed(2);
      shard.dataset.burstY=(ny*burst-10+Math.abs(seed)*7).toFixed(2);
      shard.dataset.finalX=(nx*side+seed*width*.035).toFixed(2);
      shard.dataset.finalY=(ny*height*.08+fall).toFixed(2);
      shard.dataset.rotate=rotate.toFixed(2);
      shardsRoot.appendChild(shard);
    });
  }

  function geometry(){
    var width=innerWidth,height=innerHeight;
    var rect=word.getBoundingClientRect();
    var startX=rect.right-5;
    var startY=rect.top+rect.height*.53;
    var travel=width<=640?clamp(width*.035,10,16):clamp(width*.016,16,24);
    var impactX=clamp(startX+travel,24,width-26);
    var impactY=clamp(startY,30,height-30);
    spark.style.left=impactX+'px';spark.style.top=impactY+'px';
    streak.style.left=startX+'px';streak.style.top=(impactY-.5)+'px';
    streak.style.width=Math.max(28,impactX-startX)+'px';
    buildCracks(impactX,impactY,width,height);
    buildShards(impactX,impactY,width,height);
    return {travel:impactX-startX};
  }

  function showSiteInstant(){
    root.classList.remove('ice-intro-pending','loading');
    content.forEach(function(el){el.inert=false;});
    window.__iceIntroActive=false;
    clearTimeout(window.__maksimIceFallback);
  }

  function finishIntro(){
    if(finished)return;
    finished=true;
    started=true;
    timers.forEach(clearTimeout);
    animations.forEach(function(animation){try{animation.cancel();}catch(_){}});
    loader.style.display='none';
    root.dataset.iceIntro='complete';
    markSeen();
    showSiteInstant();
    window.dispatchEvent(new CustomEvent('iceintro:complete'));
    window.dispatchEvent(new Event('resize'));
  }

  function playIntro(){
    function cue(delay,callback){later(delay*.76,callback);}
    setStyles(loader,{display:'block',opacity:'1',visibility:'visible'});
    setStyles(glassBase,{opacity:'1',visibility:'visible'});
    setStyles(frost,{opacity:'.72',visibility:'visible'});
    setStyles(core,{opacity:'1',visibility:'visible',transform:'translateX(0) scale(1)'});
    setStyles(word,{transform:'translateX(0) scale(1) skewX(0deg)'});
    setStyles(fill,{clipPath:'inset(0 100% 0 0)',color:'#f3f1ec'});
    setStyles(sub,{transform:'translateY(130%)',opacity:'0',visibility:'visible'});
    setStyles(spark,{transform:'rotate(18deg) scaleY(.2)',opacity:'0',visibility:'visible'});
    setStyles(streak,{transform:'scaleX(.04)',opacity:'0',visibility:'visible'});
    setStyles(cracks,{opacity:'0',visibility:'visible'});

    var hit=geometry();
    var wordTravel=Math.round(hit.travel);
    var shardEls=Array.prototype.slice.call(shardsRoot.children);
    var crackEls=Array.prototype.slice.call(cracks.querySelectorAll('path'));
    shardEls.forEach(function(shard){setStyles(shard,{transform:'translate(0,0) rotate(0deg) scale(1)',opacity:'0',visibility:'visible'});});
    crackEls.forEach(function(path){path.style.strokeDashoffset='1';});

    cue(170,function(){
      motion(fill,[
        {clipPath:'inset(0 100% 0 0)',offset:0},
        {clipPath:'inset(0 62% 0 0)',offset:.55},
        {clipPath:'inset(0 38% 0 0)',offset:.78},
        {clipPath:'inset(0 14% 0 0)',offset:.92},
        {clipPath:'inset(0 0% 0 0)',offset:1}
      ],{duration:1080,easing:'linear'});
      motion(word,[
        {transform:'translateX(0) scaleX(1) skewX(0deg)',offset:0},
        {transform:'translateX(0) scaleX(1) skewX(0deg)',offset:.68,easing:'cubic-bezier(.77,0,.175,1)'},
        {transform:'translateX(-5px) scaleX(.988) skewX(-1deg)',offset:.84,easing:'cubic-bezier(.77,0,.175,1)'},
        {transform:'translateX(-7px) scaleX(.98) skewX(-1.6deg)',offset:.88,easing:'cubic-bezier(.7,0,.84,0)'},
        {transform:'translateX('+wordTravel+'px) scaleX(1.018) skewX(0deg)',offset:1}
      ],{duration:1080,easing:'linear'});
    });
    cue(260,function(){motion(sub,[{transform:'translateY(130%)',opacity:0},{transform:'translateY(0)',opacity:1}],{duration:440,easing:'cubic-bezier(.23,1,.32,1)'});});
    cue(1100,function(){motion(streak,[{transform:'scaleX(.04)',opacity:0},{transform:'scaleX(1)',opacity:.64}],{duration:150,easing:'cubic-bezier(.7,0,.84,0)'});});
    cue(1250,function(){
      cracks.style.opacity='1';
      motion(spark,[
        {transform:'rotate(18deg) scaleY(.2)',opacity:0,offset:0},
        {transform:'rotate(18deg) scaleY(1)',opacity:1,offset:.28},
        {transform:'rotate(18deg) scaleY(1.35)',opacity:0,offset:1}
      ],{duration:220,easing:'cubic-bezier(.23,1,.32,1)'});
      motion(word,[{transform:'translateX('+wordTravel+'px) scaleX(1.018)'},{transform:'translateX(-4px) scale(.99)'}],{duration:190,easing:'cubic-bezier(.23,1,.32,1)'});
      motion(sub,[{opacity:1},{opacity:0}],{duration:180,easing:'cubic-bezier(.23,1,.32,1)'});
      crackEls.forEach(function(path){
        motion(path,[{strokeDashoffset:1},{strokeDashoffset:0}],{
          duration:Number(path.dataset.crackDuration)||420,
          delay:Number(path.dataset.crackDelay)||0,
          easing:'cubic-bezier(.23,1,.32,1)'
        });
      });
    });
    cue(1310,function(){motion(streak,[{opacity:.64},{opacity:0}],{duration:170,easing:'cubic-bezier(.23,1,.32,1)'});});
    cue(1450,function(){motion(core,[{transform:'scale(1)',opacity:1},{transform:'scale(.985)',opacity:0}],{duration:220,easing:'cubic-bezier(.23,1,.32,1)'});});
    cue(1720,function(){
      shardEls.forEach(function(shard,index){
        var burstX=Number(shard.dataset.burstX),burstY=Number(shard.dataset.burstY);
        var finalX=Number(shard.dataset.finalX),finalY=Number(shard.dataset.finalY);
        var rotate=Number(shard.dataset.rotate);
        shard.style.opacity='1';
        motion(shard,[
          {transform:'translate(0,0) rotate(0deg) scale(1)',opacity:1,offset:0,easing:'cubic-bezier(.16,1,.3,1)'},
          {transform:'translate('+burstX+'px,'+burstY+'px) rotate('+(rotate*.28)+'deg) scale(1)',opacity:1,offset:.22,easing:'cubic-bezier(.4,0,1,1)'},
          {transform:'translate('+finalX+'px,'+finalY+'px) rotate('+rotate+'deg) scale(.99)',opacity:0,offset:1}
        ],{duration:980,delay:(index%4)*6,easing:'linear'});
      });
      setStyles(glassBase,{opacity:'0',visibility:'hidden'});
      setStyles(frost,{opacity:'0',visibility:'hidden'});
    });
    cue(1900,function(){motion(cracks,[{opacity:1},{opacity:0}],{duration:340,easing:'cubic-bezier(.23,1,.32,1)'});});
    cue(2760,function(){motion(loader,[{opacity:1},{opacity:0}],{duration:180,easing:'cubic-bezier(.23,1,.32,1)'});});
    cue(3010,finishIntro);
  }

  if(!loader||!glassBase||!frost||!shardsRoot||!cracks||!core||!word||!fill||!sub||!spark||!streak){
    showSiteInstant();
    return;
  }

  var fontReady=document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve();
  Promise.race([fontReady,new Promise(function(resolve){setTimeout(resolve,720);})])
    .then(function(){later(90,function(){if(!started){started=true;playIntro();}});});
  later(920,function(){if(!started){started=true;playIntro();}});
  later(7000,finishIntro);
  window.addEventListener('pagehide',finishIntro,{once:true});
  window.addEventListener('keydown',function(event){if(event.key==='Escape')finishIntro();});
  matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',function(event){if(event.matches)finishIntro();});
})();
