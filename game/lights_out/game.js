 'use strict';
const board=document.querySelector('#board'),status=document.querySelector('#status');
let rows=5,cols=5,colors=3,beads=Array(25).fill(0),moves=0,moved=false;
let dark=matchMedia('(prefers-color-scheme: dark)').matches,lowBrightness=false;
function turn(index){const row=Math.floor(index/cols),col=index%cols;for(const [dr,dc] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]){const r=row+dr,c=col+dc;if(r>=0&&r<rows&&c>=0&&c<cols){const i=r*cols+c;beads[i]=(beads[i]+1)%colors;}}}
function solved(){return beads.every(v=>v===0);}
function report(){status.textContent=timerPaused()?'已暂停 · 在菜单中继续计时':moved&&solved()?`已完成 · ${moves} 步`:`点击格子及其上下左右，全部变暗即完成${moves?' · '+moves+' 步':''}`;}
function draw(){
 board.style.setProperty('--cols',cols);board.dataset.colors=colors;
 const area=board.parentElement,style=getComputedStyle(area),gap=parseFloat(getComputedStyle(board).gap)||0;
 const bounds={left:parseFloat(style.paddingLeft),top:parseFloat(style.paddingTop),right:area.clientWidth-parseFloat(style.paddingRight),bottom:area.clientHeight-parseFloat(style.paddingBottom)};
 let spaces=[bounds];
 for(const control of document.querySelectorAll('#menu-toggle, #timer:not([hidden])')){
  const rect=control.getBoundingClientRect(),obstacle={left:rect.left-8,right:rect.right+8,top:rect.top-8,bottom:rect.bottom+8};
  spaces=spaces.flatMap(space=>{
   if(obstacle.right<=space.left||obstacle.left>=space.right||obstacle.bottom<=space.top||obstacle.top>=space.bottom)return [space];
   return [{...space,right:Math.min(space.right,obstacle.left)},{...space,left:Math.max(space.left,obstacle.right)},{...space,bottom:Math.min(space.bottom,obstacle.top)},{...space,top:Math.max(space.top,obstacle.bottom)}].filter(r=>r.right>r.left&&r.bottom>r.top);
  });
 }
 let best=null;
 for(const space of spaces){
  const unit=Math.max(1,Math.min((space.right-space.left-gap*(cols-1))/cols,(space.bottom-space.top-gap*(rows-1))/rows));
  const width=unit*cols+gap*(cols-1),height=unit*rows+gap*(rows-1);
  const left=Math.max(space.left,Math.min((area.clientWidth-width)/2,space.right-width));
  const top=Math.max(space.top,Math.min((area.clientHeight-height)/2,space.bottom-height));
  const distance=Math.hypot(left+width/2-area.clientWidth/2,top+height/2-area.clientHeight/2);
  if(!best||unit>best.unit||unit===best.unit&&distance<best.distance)best={unit,width,height,left,top,distance};
 }
 if(best){board.style.width=best.width+'px';board.style.height=best.height+'px';board.style.left=best.left+'px';board.style.top=best.top+'px';}
 if(board.children.length!==rows*cols){board.replaceChildren(...Array.from({length:rows*cols},(_,i)=>{const b=document.createElement('button');b.className='cell';b.type='button';b.onclick=e=>{if(e.detail===0)move(i);};return b;}));}
 [...board.children].forEach((b,i)=>{b.dataset.color=beads[i];b.setAttribute('aria-label',`第 ${Math.floor(i/cols)+1} 行，第 ${i%cols+1} 列：${(colors===2?['暗','亮']:['暗','中','亮'])[beads[i]]}`);b.disabled=timerPaused();});
}
function resize(){draw();}
board.addEventListener('keydown',e=>{board.classList.add('keyboard-input');const i=[...board.children].indexOf(document.activeElement);if(i<0)return;const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-cols,ArrowDown:cols}[e.key];if(delta!==undefined){e.preventDefault();board.children[Math.max(0,Math.min(rows*cols-1,i+delta))].focus();}});
// Intersect the complete pointer segment with cells so fast swipes do not skip cells.
let drag=null;
function segmentEntry(a,b,rect){
 let enter=0,exit=1;
 for(const [start,delta,min,max] of [[a.x,b.x-a.x,rect.left,rect.right],[a.y,b.y-a.y,rect.top,rect.bottom]]){
  if(delta===0){if(start<min||start>max)return null;continue;}
  let t0=(min-start)/delta,t1=(max-start)/delta;if(t0>t1)[t0,t1]=[t1,t0];
  enter=Math.max(enter,t0);exit=Math.min(exit,t1);if(enter>exit)return null;
 }
 return enter;
}
function tracePointer(e){
 if(!drag||drag.id!==e.pointerId)return;
 const next={x:e.clientX,y:e.clientY};
 const hits=drag.rects.map((rect,i)=>({i,t:segmentEntry(drag.last,next,rect)})).filter(hit=>hit.t!==null&&hit.i!==drag.current).sort((a,b)=>a.t-b.t);
 for(const {i} of hits)move(i);
 // Only suppress the cell still occupied at the end of this segment.
 // Entering a gap or leaving the board allows that cell to trigger again.
 drag.current=drag.rects.findIndex(rect=>next.x>=rect.left&&next.x<=rect.right&&next.y>=rect.top&&next.y<=rect.bottom);
 drag.last=next;
}
function stopDrag(){if(!drag)return;const id=drag.id;drag=null;if(board.hasPointerCapture(id))board.releasePointerCapture(id);}
board.addEventListener('pointerdown',e=>{
 if(drag||e.button!==0||!e.isPrimary||timerPaused()||!e.target.closest('.cell'))return;
 e.preventDefault();board.classList.remove('keyboard-input');e.target.focus({preventScroll:true});
 drag={id:e.pointerId,last:{x:e.clientX,y:e.clientY},current:-1,rects:[...board.children].map(b=>b.getBoundingClientRect())};
 board.setPointerCapture(e.pointerId);tracePointer(e);
});
board.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();const events=e.getCoalescedEvents?.();for(const point of events?.length?events:[e])tracePointer(point);});
board.addEventListener('pointerup',e=>{if(drag?.id===e.pointerId){tracePointer(e);stopDrag();}});
for(const name of ['pointercancel','lostpointercapture'])board.addEventListener(name,e=>{if(drag?.id===e.pointerId)stopDrag();});
window.addEventListener('blur',stopDrag);
const $=selector=>document.querySelector(selector);
const storageKey='lights-out-state-v1';
let clock={enabled:false,phase:'ready',elapsed:0},runningSince=null;
function elapsed(){return clock.elapsed+(runningSince===null?0:Date.now()-runningSince);}
function timerPaused(){return clock.enabled&&clock.phase==='paused';}
function freezeClock(){clock.elapsed=elapsed();runningSince=null;}
function renderTimer(){
 const ms=elapsed(),seconds=Math.floor(ms/1000);
 $('#timer').hidden=!clock.enabled;
 $('#timer').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}.${String(Math.floor(ms%1000)).padStart(3,'0')}`+({ready:' · 待开始',paused:' · 已暂停',finished:' · 已完成'}[clock.phase]||'');
 $('#timer-toggle').textContent=clock.enabled?'关闭计时':'开启计时';
 $('#timer-toggle').setAttribute('aria-pressed',clock.enabled);
 $('#timer-pause').hidden=!clock.enabled||!['running','paused'].includes(clock.phase);
 $('#timer-pause').textContent=clock.phase==='paused'?'继续计时':'暂停计时';
}
function save(){
 try{localStorage.setItem(storageKey,JSON.stringify({version:2,beads,rows,cols,colors,dark,lowBrightness,moved,moves,clock:{...clock,elapsed:elapsed(),savedAt:Date.now()}}));}catch{status.textContent='浏览器无法保存状态';}
}
function move(index){
 if(timerPaused())return;
 if(clock.enabled&&['ready','finished'].includes(clock.phase)){if(clock.phase==='finished')resetClock();clock.phase='running';runningSince=Date.now();}
 turn(index);moved=true;moves++;finishMove();report();draw();save();
}
function finishMove(){
 if(clock.enabled&&clock.phase==='running'&&solved()){freezeClock();clock.phase='finished';}
 renderTimer();save();
}
function resetClock(){clock.phase='ready';clock.elapsed=0;runningSince=null;renderTimer();}
function validConfig(r,c,k){return [r,c].every(n=>Number.isInteger(n)&&n>=3&&n<=10)&&[2,3].includes(k);}
function validBeads(value,r=rows,c=cols,k=colors){return validConfig(r,c,k)&&Array.isArray(value)&&value.length===r*c&&value.every(v=>Number.isInteger(v)&&v>=0&&v<k);}
function restore(){
 try{
  const data=JSON.parse(localStorage.getItem(storageKey));
  const r=data?.version===1?data.size:data?.rows,c=data?.version===1?data.size:data?.cols;
  if([1,2].includes(data?.version)&&validBeads(data.beads,r,c,data.colors)){
   beads=data.beads;rows=r;cols=c;colors=data.colors;moves=Number.isSafeInteger(data.moves)&&data.moves>=0?data.moves:0;dark=typeof data.dark==='boolean'?data.dark:dark;lowBrightness=data.lowBrightness===true;moved=!!data.moved;
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
 const raw=hash.get('state');const parts=raw.split(':');
 const legacy=parts[0]==='1'&&parts.length===4;
 const r=Number(parts[1]),c=Number(legacy?parts[1]:parts[2]),k=Number(legacy?parts[2]:parts[3]);
 const encoded=legacy?parts[3]:parts[4];
 const value=(legacy||parts[0]==='2'&&parts.length===5)&&/^[0-2]+$/.test(encoded)?encoded.split('').map(Number):null;
 if(validBeads(value,r,c,k)){stopDrag();rows=r;cols=c;colors=k;beads=value;moves=0;moved=true;resetClock();save();report();}
 else status.textContent='分享链接无效，已保留原有局面';
 // Consume the import so refresh restores subsequent moves, not the original link.
 hash.delete('state');
 try{history.replaceState(null,'',location.pathname+location.search+(hash.size?'#'+hash.toString():''));}catch{}
}
function setMenu(open){$('#menu').hidden=!open;$('#menu-toggle').setAttribute('aria-expanded',open);}
$('#menu-toggle').onclick=()=>setMenu($('#menu').hidden);
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.controls'))setMenu(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#menu').hidden){setMenu(false);$('#menu-toggle').focus();}});
let pendingAction=null;
function confirmAction(message,action){setMenu(false);pendingAction=action;$('#confirm-message').textContent=message;$('#confirm-dialog').returnValue='cancel';$('#confirm-dialog').showModal();}
$('#confirm-dialog').setAttribute('aria-labelledby','confirm-message');
$('#confirm-dialog').addEventListener('close',()=>{if($('#confirm-dialog').returnValue==='confirm')pendingAction?.();pendingAction=null;$('#menu-toggle').focus();});
function newRound(shuffle){stopDrag();beads=Array(rows*cols).fill(0);if(shuffle){do{for(let i=0;i<beads.length;i++){const count=Math.floor(Math.random()*colors);for(let j=0;j<count;j++)turn(i);}}while(solved());}moved=false;moves=0;resetClock();report();save();draw();}
$('#shuffle').onclick=()=>confirmAction('打乱当前局面并重新计时？',()=>newRound(true));
$('#reset').onclick=()=>confirmAction('重置为初始局面并清零计时？',()=>newRound(false));
function theme(){document.documentElement.dataset.theme=dark?'dark':'light';const b=$('#theme');b.textContent=dark?'日间模式':'夜间模式';b.setAttribute('aria-pressed',dark);document.documentElement.dataset.lowBrightness=String(lowBrightness);const dim=$('#low-brightness');dim.textContent=lowBrightness?'关闭低亮度':'开启低亮度';dim.setAttribute('aria-pressed',lowBrightness);draw();}
$('#theme').onclick=()=>{dark=!dark;theme();save();};
$('#low-brightness').onclick=()=>{lowBrightness=!lowBrightness;theme();save();};
$('#settings').onclick=()=>{setMenu(false);$('#rows').value=rows;$('#cols').value=cols;$('#colors').value=colors;$('#settings-dialog').showModal();};
$('#settings-cancel').onclick=()=>$('#settings-dialog').close();
$('#settings-form').onsubmit=e=>{e.preventDefault();const r=Number($('#rows').value),c=Number($('#cols').value),k=Number($('#colors').value);if(!validConfig(r,c,k))return;$('#settings-dialog').close();if(r!==rows||c!==cols||k!==colors){rows=r;cols=c;colors=k;newRound(true);}};
$('#timer-toggle').onclick=()=>{clock.enabled=!clock.enabled;resetClock();report();save();resize();};
$('#timer-pause').onclick=()=>{stopDrag();if(clock.phase==='running'){freezeClock();clock.phase='paused';}else if(clock.phase==='paused'){clock.phase='running';runningSince=Date.now();}renderTimer();draw();report();save();};
$('#fullscreen').disabled=!document.fullscreenEnabled;
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();setMenu(false);}catch{status.textContent='浏览器未能进入全屏';}};
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').textContent=document.fullscreenElement?'退出全屏':'进入全屏';resize();});
$('#share').onclick=()=>{
 const url=new URL(location.href);url.hash='state=2:'+rows+':'+cols+':'+colors+':'+beads.join('');
 $('#share-link').value=url.href;$('#share-result').textContent='';setMenu(false);$('#share-dialog').showModal();$('#share-link').select();
};
$('#share-close').onclick=()=>$('#share-dialog').close();
$('#share-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#share-link').value);$('#share-result').textContent='链接已复制';}catch{$('#share-link').select();$('#share-result').textContent='请长按或按 Ctrl/Cmd+C 复制链接';}};
for(const event of ['contextmenu','dragstart','selectstart','dblclick'])board.addEventListener(event,e=>e.preventDefault());
board.addEventListener('wheel',e=>e.preventDefault(),{passive:false});
window.addEventListener('pagehide',save);
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
window.addEventListener('hashchange',()=>{loadShare();renderTimer();draw();report();});
window.addEventListener('resize',()=>{stopDrag();resize();});
restore();theme();renderTimer();draw();report();
const layoutObserver=new ResizeObserver(()=>{stopDrag();resize();});
for(const element of [board.parentElement,$('#menu-toggle'),$('#timer')])layoutObserver.observe(element);
function tickTimer(){
 if(clock.enabled&&clock.phase==='running')renderTimer();
 requestAnimationFrame(tickTimer);
}
requestAnimationFrame(tickTimer);
