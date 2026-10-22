/* Geometry and rules: https://www.jaapsch.net/puzzles/rings.htm
   Twenty positions per ring; two shared intersections, five steps apart. */
'use strict';
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
const status=document.querySelector('#status'),step=Math.PI/10,d=Math.SQRT1_2;
const rings=[Array.from({length:20},(_,i)=>i),Array.from({length:20},(_,i)=>i===0?0:i===15?5:20+(i<15?i-1:i-2))];
const centers=[-d,d],starts=[-Math.PI/4,-3*Math.PI/4];
const initial=Array(38).fill(0);
rings[0].forEach((id,i)=>initial[id]=i>=6&&i<=15?3:i===5?2:0);
rings[1].forEach((id,i)=>{if(i!==0)initial[id]=i>=1&&i<=10?1:2;});
let beads=[...initial],vertical=innerHeight>innerWidth,dark=matchMedia('(prefers-color-scheme: dark)').matches;
let width=0,height=0,scale=1,drag=null,selected=0,moved=false;
const palette=['#e4bc64','#dc806c','#779fb8','#79a88c'];
function turn(r,n){n=((n%20)+20)%20;const old=rings[r].map(id=>beads[id]);rings[r].forEach((id,i)=>beads[id]=old[(i-n+20)%20]);}
function solved(){return [0,1,2,3].every(color=>rings.some(r=>{const count=beads.filter(c=>c===color).length;return r.some((_,start)=>Array.from({length:count},(_,i)=>beads[r[(start+i)%20]]).every(c=>c===color));}));}
function report(){status.textContent=moved&&solved()?'已还原 · 四种颜色均已连成一段':'沿圆环拖动珠子，使每种颜色连成一段';}
function point(r,i,offset=0){const a=starts[r]+i*step+offset;return {x:centers[r]+Math.cos(a),y:Math.sin(a)};}
function draw(){
 ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);ctx.clearRect(0,0,width,height);ctx.translate(width/2,height/2);ctx.scale(scale,scale);if(vertical)ctx.rotate(Math.PI/2);
 // Fixed target bands remain in place while the beads move.
 for(let r=0;r<2;r++)rings[r].forEach((id,i)=>{
  const a=starts[r]+i*step;
  ctx.beginPath();ctx.arc(centers[r],0,1,a-step/2,a+step/2);
  ctx.lineWidth=.34;ctx.strokeStyle=palette[initial[id]];
  ctx.globalAlpha=dark?.23:.19;ctx.stroke();
 });
 ctx.globalAlpha=1;
 for(let r=0;r<2;r++){for(const radius of [.83,1.17]){ctx.beginPath();ctx.arc(centers[r],0,radius,0,2*Math.PI);ctx.lineWidth=1.5/scale;ctx.strokeStyle=dark?'#484848':'#d2d2d2';ctx.stroke();}}
 const active=drag?.ring,offset=drag?.offset||0;
 function ball(p,color){ctx.beginPath();ctx.arc(p.x,p.y,.149,0,Math.PI*2);ctx.fillStyle=palette[color];ctx.fill();}
 const seen=new Set();for(let r=0;r<2;r++)rings[r].forEach((id,i)=>{if(seen.has(id)||active!==undefined&&rings[active].includes(id))return;seen.add(id);ball(point(r,i),beads[id]);});
 if(active!==undefined)rings[active].forEach((id,i)=>ball(point(active,i,offset),beads[id]));
}
// Fit the full tracks, including moving beads, around actual button bounds.
function fitScale(w,h,buttons){
 const outer=1.17,extent=d+outer;
 const maximum=Math.max(.1,Math.min((w-2)/(2*(vertical?outer:extent)),(h-2)/(2*(vertical?extent:outer))));
 function clear(s){return centers.every(c=>{
  const x=w/2+(vertical?0:c*s),y=h/2+(vertical?c*s:0);
  return buttons.every(b=>{
   const near=Math.hypot(Math.max(b.left-x,0,x-b.right),Math.max(b.top-y,0,y-b.bottom));
   const far=Math.hypot(Math.max(Math.abs(x-b.left),Math.abs(x-b.right)),Math.max(Math.abs(y-b.top),Math.abs(y-b.bottom)));
   return near>outer*s||far<.83*s;
  });
 });}
 // Search downward: corner obstacles need not give a monotonic fit predicate.
 for(let s=maximum;s>.5;s-=.5)if(clear(s))return s;
 return .1;
}
function resize(){
 const timer=document.querySelector('.clock'),menu=document.querySelector('#menu-toggle').getBoundingClientRect(),themeButton=document.querySelector('#theme').getBoundingClientRect();
 const room=2*Math.min(innerWidth/2-menu.right,themeButton.left-innerWidth/2)-16;
 document.querySelector('main').classList.toggle('clock-row',!timer.hidden&&timer.getBoundingClientRect().width>room);
 const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;
 canvas.width=Math.round(width*devicePixelRatio);canvas.height=Math.round(height*devicePixelRatio);
 const buttons=[...document.querySelectorAll('.corner-button, .clock:not([hidden])')].map(button=>{
  const b=button.getBoundingClientRect(),gap=8;
  return {left:b.left-rect.left-gap,right:b.right-rect.left+gap,top:b.top-rect.top-gap,bottom:b.bottom-rect.top+gap};
 });
 scale=fitScale(width,height,buttons);draw();
}
function local(e){const rect=canvas.getBoundingClientRect();let x=(e.clientX-rect.left-width/2)/scale,y=(e.clientY-rect.top-height/2)/scale;return vertical?{x:y,y:-x}:{x,y};}
function angle(p,r){return Math.atan2(p.y,p.x-centers[r]);}
function delta(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
canvas.addEventListener('pointerdown',e=>{if(drag||e.button!==0||timerPaused())return;e.preventDefault();const p=local(e),dist=centers.map(c=>Math.abs(Math.hypot(p.x-c,p.y)-1));if(Math.min(...dist)>.3)return;const ambiguous=Math.abs(dist[0]-dist[1])<.07;const r=dist[0]<=dist[1]?0:1;drag={id:e.pointerId,ring:r,offset:0,last:angle(p,r),origin:p,pending:ambiguous};selected=r;canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});draw();});
canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const p=local(e);if(drag.pending){const dx=p.x-drag.origin.x,dy=p.y-drag.origin.y;if(Math.hypot(dx,dy)<.04)return;const scores=centers.map(c=>{const a=angle(drag.origin,centers.indexOf(c));return Math.abs(-Math.sin(a)*dx+Math.cos(a)*dy);});drag.ring=scores[0]>=scores[1]?0:1;selected=drag.ring;drag.last=angle(drag.origin,drag.ring);drag.pending=false;}
 const a=angle(p,drag.ring);drag.offset+=delta(a,drag.last);drag.last=a;const n=Math.trunc(drag.offset/step);if(n){move(drag.ring,n);drag.offset-=n*step;}draw();});
function release(e){if(!drag||e.pointerId!==drag.id)return;const n=Math.round(drag.offset/step);if(n){move(drag.ring,n);}drag=null;finishMove();report();draw();}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();if(drag||timerPaused())return;if(e.key==='ArrowLeft')selected=0;else if(e.key==='ArrowRight')selected=1;else{move(selected,e.key==='ArrowUp'?-1:1);finishMove();report();draw();}});

const $=selector=>document.querySelector(selector);
const storageKey='beads2-state-v1';
let clock={enabled:false,phase:'ready',elapsed:0},runningSince=null;
function elapsed(){return clock.elapsed+(runningSince===null?0:Date.now()-runningSince);}
function timerPaused(){return clock.enabled&&clock.phase==='paused';}
function freezeClock(){clock.elapsed=elapsed();runningSince=null;}
function renderTimer(){
 const ms=elapsed(),seconds=Math.floor(ms/1000);
 $('.clock').hidden=!clock.enabled;
 $('#timer').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 $('#ms').textContent=`.${String(Math.floor(ms%1000)).padStart(3,'0')}`;
 $('.clock').setAttribute('aria-label','用时 '+$('#timer').textContent+$('#ms').textContent+({ready:'，待开始',paused:'，已暂停',finished:'，已完成'}[clock.phase]||''));
 $('#timer-toggle').textContent=clock.enabled?'关闭计时':'开启计时';
 $('#timer-toggle').setAttribute('aria-pressed',clock.enabled);
 $('#timer-pause').hidden=!clock.enabled||!['running','paused'].includes(clock.phase);
 $('#timer-pause').textContent=clock.phase==='paused'?'继续计时':'暂停计时';
}
function save(){
 try{localStorage.setItem(storageKey,JSON.stringify({version:1,beads,vertical,dark,moved,clock:{...clock,elapsed:elapsed(),savedAt:Date.now()}}));}catch{status.textContent='浏览器无法保存状态';}
}
function move(r,n){
 if(clock.enabled&&clock.phase==='ready'){clock.phase='running';runningSince=Date.now();}
 turn(r,n);moved=true;save();
}
function finishMove(){
 if(clock.enabled&&clock.phase==='running'&&solved()){freezeClock();clock.phase='finished';}
 renderTimer();save();
}
function resetClock(){clock.phase='ready';clock.elapsed=0;runningSince=null;renderTimer();}
function validBeads(value){return Array.isArray(value)&&value.length===38&&value.every(c=>Number.isInteger(c)&&c>=0&&c<4)&&[0,1,2,3].every(c=>value.filter(v=>v===c).length===initial.filter(v=>v===c).length);}
function restore(){
 try{
  const data=JSON.parse(localStorage.getItem(storageKey));
  if(data?.version===1&&validBeads(data.beads)){
   beads=data.beads;vertical=typeof data.vertical==='boolean'?data.vertical:vertical;dark=typeof data.dark==='boolean'?data.dark:dark;moved=!!data.moved;
   const c=data.clock;
   if(c&&typeof c.enabled==='boolean'&&['ready','running','paused','finished'].includes(c.phase)&&Number.isFinite(c.elapsed)&&c.elapsed>=0){
    clock={enabled:c.enabled,phase:c.phase,elapsed:c.elapsed};
    if(clock.enabled&&clock.phase==='running'){if(Number.isFinite(c.savedAt))clock.elapsed+=Math.max(0,Date.now()-c.savedAt);runningSince=Date.now();}
   }
  }
 }catch{}
 loadShare();
}
function loadShare(){
 const hash=new URLSearchParams(location.hash.slice(1));
 if(!hash.has('state'))return;
 const raw=hash.get('state');const value=/^1:[0-3]{38}$/.test(raw)?raw.slice(2).split('').map(Number):null;
 if(validBeads(value)){beads=value;moved=true;resetClock();save();report();}
 else status.textContent='分享链接无效，已保留原有局面';
 // Consume the import so refresh restores subsequent moves, not the original link.
 hash.delete('state');
 try{history.replaceState(null,'',location.pathname+location.search+(hash.size?'#'+hash.toString():''));}catch{}
}
function setMenu(open){if(open){drag=null;draw();if(!$('#menu').open)$('#menu').showModal();}else $('#menu').close();$('#menu-toggle').setAttribute('aria-expanded',open);}
$('#menu-toggle').onclick=()=>setMenu(true);
$('#menu-close').onclick=()=>setMenu(false);
$('#menu').addEventListener('close',()=>$('#menu-toggle').setAttribute('aria-expanded','false'));
$('#menu').addEventListener('click',e=>{const r=$('#menu').getBoundingClientRect();if(e.target===$('#menu')&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))setMenu(false);});
let pendingAction=null;
function confirmAction(message,action){setMenu(false);pendingAction=action;$('#confirm-message').textContent=message;$('#confirm-dialog').returnValue='cancel';$('#confirm-dialog').showModal();}
$('#confirm-dialog').setAttribute('aria-labelledby','confirm-message');
$('#confirm-dialog').addEventListener('close',()=>{if($('#confirm-dialog').returnValue==='confirm')pendingAction?.();pendingAction=null;$('#menu-toggle').focus();});
function newRound(shuffle){drag=null;beads=[...initial];if(shuffle)for(let i=0;i<100;i++)turn(i%2,1+Math.floor(Math.random()*19));moved=shuffle;resetClock();report();save();resize();}
$('#shuffle').onclick=()=>confirmAction('打乱当前局面并重新计时？',()=>newRound(true));
$('#reset').onclick=()=>confirmAction('重置为初始局面并清零计时？',()=>newRound(false));
function theme(){document.documentElement.dataset.theme=dark?'dark':'light';const b=$('#theme');b.setAttribute('aria-label',dark?'切换至日间模式':'切换至夜间模式');b.title=b.getAttribute('aria-label');b.setAttribute('aria-pressed',dark);draw();}
$('#theme').onclick=()=>{dark=!dark;theme();save();};
function orientation(){const b=$('#orientation');b.textContent=vertical?'切换横屏':'切换竖屏';b.setAttribute('aria-pressed',vertical);resize();}
$('#orientation').onclick=()=>{drag=null;vertical=!vertical;orientation();save();};
$('#timer-toggle').onclick=()=>{clock.enabled=!clock.enabled;resetClock();save();resize();};
$('#timer-pause').onclick=()=>{if(clock.phase==='running'){freezeClock();clock.phase='paused';}else if(clock.phase==='paused'){clock.phase='running';runningSince=Date.now();}renderTimer();save();};
$('#fullscreen').disabled=!document.fullscreenEnabled;
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();setMenu(false);}catch{status.textContent='浏览器未能进入全屏';}};
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').textContent=document.fullscreenElement?'退出全屏':'进入全屏';resize();});
$('#share').onclick=()=>{
 const url=new URL(location.href);url.hash='state=1:'+beads.join('');
 $('#share-link').value=url.href;$('#share-result').textContent='';setMenu(false);$('#share-dialog').showModal();$('#share-link').select();
};
$('#share-close').onclick=()=>$('#share-dialog').close();
$('#share-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#share-link').value);$('#share-result').textContent='链接已复制';}catch{$('#share-link').select();$('#share-result').textContent='请长按或按 Ctrl/Cmd+C 复制链接';}};
for(const event of ['contextmenu','dragstart','selectstart','dblclick'])canvas.addEventListener(event,e=>e.preventDefault());
canvas.addEventListener('wheel',e=>e.preventDefault(),{passive:false});
window.addEventListener('pagehide',save);
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
window.addEventListener('hashchange',()=>{drag=null;loadShare();renderTimer();draw();});
const layoutObserver=new ResizeObserver(resize);
layoutObserver.observe(canvas);for(const element of document.querySelectorAll('.corner-button,.clock'))layoutObserver.observe(element);
window.addEventListener('resize',()=>{drag=null;resize();});
restore();theme();orientation();renderTimer();report();
setInterval(renderTimer,16);
