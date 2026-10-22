 'use strict';
const board=document.querySelector('#board'),status=document.querySelector('#status');
let rows=3,cols=3,mode='slide',beads=[1,2,3,4,5,6,7,8,0],moves=0,moved=false;
let dark=matchMedia('(prefers-color-scheme: dark)').matches,lowBrightness=false;
function pathToBlank(index){
 const blank=beads.indexOf(0);
 if(index===blank||index<0||index>=beads.length)return [];
 const sameRow=Math.floor(index/cols)===Math.floor(blank/cols),sameCol=index%cols===blank%cols;
 if(!sameRow&&!sameCol)return [];
 const step=sameRow?Math.sign(blank-index):Math.sign(blank-index)*cols;
 const path=[];for(let i=index;i!==blank;i+=step)path.push(i);
 return path;
}
function turn(index){const path=pathToBlank(index);let blank=beads.indexOf(0);for(const i of path.reverse()){beads[blank]=beads[i];blank=i;}beads[blank]=0;}
function solved(){return beads.every((v,i)=>v===(i+1)%beads.length);}
function report(){status.textContent=timerPaused()?'已暂停 · 在菜单中继续计时':moved&&solved()?`已完成 · ${moves} 步`:`${mode==='click'?'点击或拖动经过空白相邻格子':'拖动同一行或列的数字到空白处'}${moves?' · '+moves+' 步':''}`;}
function draw(){
 board.style.setProperty('--cols',cols);
 const area=board.parentElement,style=getComputedStyle(area),gap=parseFloat(getComputedStyle(board).gap)||0;
 const bounds={left:parseFloat(style.paddingLeft),top:parseFloat(style.paddingTop),right:area.clientWidth-parseFloat(style.paddingRight),bottom:area.clientHeight-parseFloat(style.paddingBottom)};
 bounds.top=Math.max(bounds.top,document.querySelector('.toolbar').getBoundingClientRect().bottom+12);
 const inset=parseFloat(getComputedStyle(board).paddingLeft)||0;
 const spaces=[bounds];
 let best=null;
 for(const space of spaces){
  const unit=Math.max(1,Math.min((space.right-space.left-2*inset-gap*(cols-1))/cols,(space.bottom-space.top-2*inset-gap*(rows-1))/rows));
  const width=unit*cols+gap*(cols-1)+2*inset,height=unit*rows+gap*(rows-1)+2*inset;
  const left=Math.max(space.left,Math.min((area.clientWidth-width)/2,space.right-width));
  const top=Math.max(space.top,Math.min((area.clientHeight-height)/2,space.bottom-height));
  const distance=Math.hypot(left+width/2-area.clientWidth/2,top+height/2-area.clientHeight/2);
  if(!best||unit>best.unit||unit===best.unit&&distance<best.distance)best={unit,width,height,left,top,distance};
 }
 if(best){board.style.width=best.width+'px';board.style.height=best.height+'px';board.style.left=best.left+'px';board.style.top=best.top+'px';}
 board.style.setProperty('--rows',rows);
 board.style.setProperty('--unit',best.unit+'px');
 if(board.children.length!==rows*cols){board.replaceChildren(...Array.from({length:rows*cols},()=>{const b=document.createElement('button');b.className='cell';b.type='button';b.onclick=e=>{if(e.detail===0)move(Number(b.dataset.index));};return b;}));}
 [...board.children].forEach((b,value)=>{
  const i=beads.indexOf(value);b.dataset.index=i;b.textContent=value||'';b.hidden=value===0;
  b.style.left=inset+(i%cols)*(best.unit+gap)+'px';b.style.top=inset+Math.floor(i/cols)*(best.unit+gap)+'px';
  b.setAttribute('aria-label',`数字 ${value}，第 ${Math.floor(i/cols)+1} 行，第 ${i%cols+1} 列`);b.disabled=timerPaused();
 });
}

function resize(){draw();}
board.addEventListener('keydown',e=>{board.classList.add('keyboard-input');if(e.key.startsWith('Arrow')){const blank=beads.indexOf(0),delta={ArrowLeft:1,ArrowRight:-1,ArrowUp:cols,ArrowDown:-cols}[e.key],i=blank+delta;if(pathToBlank(i).length===1){e.preventDefault();move(i);}}});
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
function stopDrag(){if(!drag)return;const id=drag.id;drag=null;for(const b of board.children)b.style.transform='';board.classList.remove('dragging');if(board.hasPointerCapture(id))board.releasePointerCapture(id);}
function updateSlide(e){
 const distance=(drag.axis==='x'?e.clientX-drag.start.x:e.clientY-drag.start.y)*drag.sign;
 drag.progress=Math.max(0,Math.min(drag.pitch,distance*1.6));
 for(const b of drag.tiles)b.style.transform=`translate${drag.axis.toUpperCase()}(${drag.progress*drag.sign}px)`;
}
board.addEventListener('pointerdown',e=>{
 const cell=e.target.closest('.cell');
 if(drag||e.button!==0||!e.isPrimary||timerPaused()||!cell)return;
 e.preventDefault();board.classList.remove('keyboard-input');cell.focus({preventScroll:true});
 const index=Number(cell.dataset.index),rect=board.getBoundingClientRect(),gap=parseFloat(getComputedStyle(board).gap)||0,unit=cell.getBoundingClientRect().width;
 const inset=parseFloat(getComputedStyle(board).paddingLeft)||0;
 if(mode==='click'){
  drag={id:e.pointerId,last:{x:e.clientX,y:e.clientY},current:-1,rects:beads.map((_,i)=>({left:rect.left+inset+i%cols*(unit+gap),right:rect.left+inset+i%cols*(unit+gap)+unit,top:rect.top+inset+Math.floor(i/cols)*(unit+gap),bottom:rect.top+inset+Math.floor(i/cols)*(unit+gap)+unit}))};
  board.setPointerCapture(e.pointerId);tracePointer(e);
 }else{
  const path=pathToBlank(index);if(!path.length)return;
  const blank=beads.indexOf(0),axis=Math.floor(index/cols)===Math.floor(blank/cols)?'x':'y';
  drag={id:e.pointerId,index,start:{x:e.clientX,y:e.clientY},axis,sign:Math.sign(blank-index),pitch:unit+gap,progress:0,tiles:path.map(i=>board.children[beads[i]])};
  board.classList.add('dragging');board.setPointerCapture(e.pointerId);
 }
});
board.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();if(mode==='slide')updateSlide(e);else{const events=e.getCoalescedEvents?.();for(const point of events?.length?events:[e])tracePointer(point);}});
board.addEventListener('pointerup',e=>{if(drag?.id!==e.pointerId)return;if(mode==='slide'){updateSlide(e);const index=drag.index,commit=drag.progress>=drag.pitch*.35;stopDrag();if(commit)move(index);}else{tracePointer(e);stopDrag();}});
for(const name of ['pointercancel','lostpointercapture'])board.addEventListener(name,e=>{if(drag?.id===e.pointerId)stopDrag();});
window.addEventListener('blur',stopDrag);
const $=selector=>document.querySelector(selector);
const storageKey='slide-state-v1';
let clock={enabled:true,phase:'ready',elapsed:0},runningSince=null;
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
 try{localStorage.setItem(storageKey,JSON.stringify({version:1,beads,rows,cols,mode,dark,lowBrightness,moved,moves,clock:{...clock,elapsed:elapsed(),savedAt:Date.now()}}));}catch{status.textContent='浏览器无法保存状态';}
}
function move(index){
 if(timerPaused()||!pathToBlank(index).length||(mode==='click'&&pathToBlank(index).length!==1))return;
 if(clock.enabled&&clock.phase==='ready'){clock.phase='running';runningSince=Date.now();}
 turn(index);moved=true;moves++;finishMove();report();draw();save();
}
function finishMove(){
 if(clock.enabled&&clock.phase==='running'&&solved()){freezeClock();clock.phase='finished';}
 renderTimer();save();
}
function resetClock(){clock.phase='ready';clock.elapsed=0;runningSince=null;renderTimer();}
function validConfig(r,c){return [[2,2],[2,3],[3,3],[4,4]].some(([a,b])=>r===a&&c===b);}
function validBeads(value,r=rows,c=cols){return validConfig(r,c)&&Array.isArray(value)&&value.length===r*c&&new Set(value).size===r*c&&value.every(v=>Number.isInteger(v)&&v>=0&&v<r*c);}
function restore(){
 try{
  const data=JSON.parse(localStorage.getItem(storageKey));
  const r=data?.rows,c=data?.cols;
  if(data?.version===1&&validBeads(data.beads,r,c)){
   beads=data.beads;rows=r;cols=c;mode=data.mode==='click'?'click':'slide';moves=Number.isSafeInteger(data.moves)&&data.moves>=0?data.moves:0;dark=typeof data.dark==='boolean'?data.dark:dark;lowBrightness=data.lowBrightness===true;moved=!!data.moved;
   const savedClock=data.clock;
   if(savedClock&&typeof savedClock.enabled==='boolean'&&['ready','running','paused','finished'].includes(savedClock.phase)&&Number.isFinite(savedClock.elapsed)&&savedClock.elapsed>=0){
    clock={enabled:savedClock.enabled,phase:savedClock.phase,elapsed:savedClock.elapsed};
    if(clock.enabled&&clock.phase==='running'){if(Number.isFinite(savedClock.savedAt))clock.elapsed+=Math.max(0,Date.now()-savedClock.savedAt);runningSince=Date.now();}
   }
  }
 }catch{}
 loadShare();
}
function loadShare(){
 const hash=new URLSearchParams(location.hash.slice(1));
 if(!hash.has('state'))return;
 let data;try{data=JSON.parse(hash.get('state'));}catch{}
 if(data&&validBeads(data.beads,data.rows,data.cols)){stopDrag();rows=data.rows;cols=data.cols;beads=data.beads;moves=0;moved=true;save();report();}
 else status.textContent='分享链接无效，已保留原有局面';
 // Consume the import so refresh restores subsequent moves, not the original link.
 hash.delete('state');
 try{history.replaceState(null,'',location.pathname+location.search+(hash.size?'#'+hash.toString():''));}catch{}
}
function setMenu(open){if(open){stopDrag();renderSettings();if(!$('#menu').open)$('#menu').showModal();}else $('#menu').close();$('#menu-toggle').setAttribute('aria-expanded',open);}
$('#menu-toggle').onclick=()=>setMenu(true);
$('#menu-close').onclick=()=>setMenu(false);
$('#menu').addEventListener('close',()=>$('#menu-toggle').setAttribute('aria-expanded','false'));
$('#menu').addEventListener('click',e=>{const r=$('#menu').getBoundingClientRect();if(e.target===$('#menu')&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))setMenu(false);});
let pendingAction=null;
function confirmAction(message,action){setMenu(false);pendingAction=action;$('#confirm-message').textContent=message;$('#confirm-dialog').returnValue='cancel';$('#confirm-dialog').showModal();}
$('#confirm-dialog').setAttribute('aria-labelledby','confirm-message');
$('#confirm-dialog').addEventListener('close',()=>{if($('#confirm-dialog').returnValue==='confirm')pendingAction?.();pendingAction=null;$('#menu-toggle').focus();});
function newRound(shuffle,restartTimer=false){stopDrag();beads=Array.from({length:rows*cols},(_,i)=>(i+1)%(rows*cols));if(shuffle){let previous=-1;do{for(let n=0;n<rows*cols*40;n++){const blank=beads.indexOf(0),options=beads.map((_,i)=>i).filter(i=>i!==previous&&pathToBlank(i).length===1);turn(options[Math.floor(Math.random()*options.length)]);previous=blank;}}while(solved());}moved=false;moves=0;if(restartTimer)resetClock();else if(!shuffle){freezeClock();clock.phase='finished';renderTimer();}report();save();draw();}
$('#shuffle').onclick=()=>confirmAction('打乱当前局面并重新计时？',()=>newRound(true,true));
$('#reset').onclick=()=>confirmAction('重置为初始局面并保留用时？',()=>newRound(false));
function theme(){document.documentElement.dataset.theme=dark?'dark':'light';const b=$('#theme');b.setAttribute('aria-label',dark?'切换至日间模式':'切换至夜间模式');b.title=b.getAttribute('aria-label');b.setAttribute('aria-pressed',dark);document.documentElement.dataset.lowBrightness=String(lowBrightness);const dim=$('#low-brightness');dim.textContent=lowBrightness?'关闭低亮度':'开启低亮度';dim.setAttribute('aria-pressed',lowBrightness);draw();}
$('#theme').onclick=()=>{dark=!dark;theme();save();};
$('#low-brightness').onclick=()=>{lowBrightness=!lowBrightness;theme();save();};
function renderSettings(){
 for(const [id,value] of [['size',rows+'x'+cols],['mode',mode]]){
  const group=$('#'+id),buttons=[...group.querySelectorAll('button')];
  group.style.setProperty('--selected',buttons.findIndex(b=>b.dataset.value===value));
  for(const b of buttons){const selected=b.dataset.value===value;b.setAttribute('aria-checked',String(selected));b.tabIndex=selected?0:-1;}
 }
}
for(const id of ['size','mode']){
 const group=$('#'+id);
 group.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button)return;
  const value=button.dataset.value;
  if(id==='size'){
   const [r,c]=value.split('x').map(Number);if(!validConfig(r,c)||r===rows&&c===cols)return;
   confirmAction('更改尺寸并生成新局面？',()=>{rows=r;cols=c;newRound(true);renderSettings();});
  }else{stopDrag();mode=value;renderSettings();report();save();}
 });
 group.addEventListener('keydown',e=>{
  const buttons=[...group.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);
  if(index<0||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
  e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(['ArrowRight','ArrowDown'].includes(e.key)?1:buttons.length-1))%buttons.length;
  buttons[next].focus();buttons[next].click();
 });
}
$('#timer-toggle').onclick=()=>{if(clock.enabled)freezeClock();clock.enabled=!clock.enabled;if(clock.enabled&&clock.phase==='running')runningSince=Date.now();renderTimer();report();save();resize();};
$('#timer-pause').onclick=()=>{stopDrag();if(clock.phase==='running'){freezeClock();clock.phase='paused';}else if(clock.phase==='paused'){clock.phase='running';runningSince=Date.now();}renderTimer();draw();report();save();};
$('#fullscreen').disabled=!document.fullscreenEnabled;
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();setMenu(false);}catch{status.textContent='浏览器未能进入全屏';}};
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').textContent=document.fullscreenElement?'退出全屏':'进入全屏';resize();});
$('#share').onclick=()=>{
 const url=new URL(location.href);url.hash=new URLSearchParams({state:JSON.stringify({rows,cols,beads})}).toString();
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
restore();theme();renderSettings();renderTimer();draw();report();
const layoutObserver=new ResizeObserver(()=>{stopDrag();resize();});
for(const element of [board.parentElement,$('.toolbar')])layoutObserver.observe(element);
function tickTimer(){
 if(clock.enabled&&clock.phase==='running')renderTimer();
 requestAnimationFrame(tickTimer);
}
requestAnimationFrame(tickTimer);
