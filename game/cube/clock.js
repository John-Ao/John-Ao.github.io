'use strict';
let clockDrag=null,clockBuilt='';
function clockDial(i){const x=100+(i%pieces.width)*100,y=100+Math.floor(i/pieces.width)*100;let ticks='';for(let n=0;n<12;n++){const a=n*Math.PI/6;ticks+=`<line class="tick" x1="${Math.sin(a)*35}" y1="${-Math.cos(a)*35}" x2="${Math.sin(a)*(n%3?38:40)}" y2="${-Math.cos(a)*(n%3?38:40)}"/>`;}return `<g transform="translate(${x} ${y})"><circle class="dial" r="44"/>${ticks}<g class="pointer" data-dial="${i}"><line class="hand" y1="7" y2="-28"/><path d="M -5 -22 L 0 -31 L 5 -22" fill="currentColor"/></g><circle r="3" fill="currentColor"/></g>`;}
function arcPoint(r,a){const t=a*Math.PI/180;return [r*Math.cos(t),r*Math.sin(t)];}
function arcBand(a,b){const p=arcPoint(56,a),q=arcPoint(56,b),r=arcPoint(32,b),t=arcPoint(32,a);return `M ${p} A 56 56 0 0 1 ${q} L ${r} A 32 32 0 0 0 ${t} Z`;}
function arcArrow(a,direction){const start=arcPoint(44,a-direction*12),end=arcPoint(44,a+direction*12),angle=(a+direction*12)*Math.PI/180,tx=-Math.sin(angle)*direction,ty=Math.cos(angle)*direction;return `<path class="arc-arrow" d="M ${start} A 44 44 0 0 ${direction>0?1:0} ${end} M ${end[0]-tx*5-ty*3} ${end[1]-ty*5+tx*3} L ${end} L ${end[0]-tx*5+ty*3} ${end[1]-ty*5-tx*3}"/>`;}
function arcControl(s,w){const x=w%2?pieces.width*100:100,y=w<2?100:pieces.height*100,start=[180,270,90,0][w],label=`${s?'反':'正'}面${['左上','右上','左下','右下'][w]}`;
 const parts=clockPrefs.mode==='drag'?[[start,start+90,0]]:[[start,start+43,-1],[start+47,start+90,1]];
 return `<g transform="translate(${x} ${y})">${parts.map(([a,b,n])=>`<g class="arc-control ${n?'arc-button':'arc-drag'}" role="button" tabindex="0" data-wheel="${w}" ${n?`data-step="${n}"`:''} aria-label="${label}${n?(n<0?'逆时针一格':'顺时针一格'):'圆弧，拖动旋转或使用左右方向键'}"><path class="arc-band" d="${arcBand(a,b)}"/>${n?arcArrow((a+b)/2,n):''}</g>`).join('')}</g>`;
}
function clockIcon(){
 let path='M3.5 .5h17a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3h-17a3 3 0 0 1-3-3v-17a3 3 0 0 1 3-3ZM3.5 1.4a2.1 2.1 0 0 0-2.1 2.1v17a2.1 2.1 0 0 0 2.1 2.1h17a2.1 2.1 0 0 0 2.1-2.1v-17a2.1 2.1 0 0 0-2.1-2.1Z';for(let y=0;y<3;y++)for(let x=0;x<3;x++){const cx=5+x*7,cy=5+y*7;path+=`M${cx-3} ${cy}a3 3 0 1 0 6 0a3 3 0 1 0-6 0ZM${cx-2.1} ${cy}a2.1 2.1 0 1 1 4.2 0a2.1 2.1 0 1 1-4.2 0ZM${cx-.4} ${cy-1.8}h.8v2.2h1.2v.8h-2Z`;}
 for(const x of [8.5,15.5])for(const y of [8.5,15.5])path+=`M${x-.65} ${y}a.65 .65 0 1 0 1.3 0a.65 .65 0 1 0-1.3 0Z`;
 return path;
}
function syncClockUI(){
 const active=puzzleType==='clock';canvas.hidden=active;$('clock-boards').hidden=!active;$('align-options').hidden=active;
 document.querySelector('.help-align').hidden=active;
 const help=document.querySelector('.help-gestures');if(!help.dataset.cube)help.dataset.cube=help.innerHTML;
 help.innerHTML=active?'<p><strong>点击销钉：切换联动区域</strong></p><p>拖动四角圆弧：转动指针</p><p>圆弧聚焦后可用方向键转动</p><small><span id="turn-help"></span><br>打乱后首次转动开始计时，首次还原停止</small>':help.dataset.cube;
 syncClockMenu();if(active)dirty=true;
}
function syncClockMenu(){
 const draft=menuDraft||settingsSnapshot(),active=draft.puzzleType==='clock';$('clock-settings').hidden=!active;$('clock-dimensions').hidden=!active;
 if(!$('clock-dimensions').children.length){
  ['length','width'].forEach((name,i)=>{const row=document.createElement('div');row.className='dimension-row menu-setting';row.innerHTML=`<span>${i?'宽':'长'}</span><div id="clock-${name}" class="switch-track size-track" role="radiogroup" aria-label="魔表${i?'宽':'长'}">${[2,3,4,5,6].map(n=>`<label><input type="radio" name="clock-${name}" value="${n}"><span>${n}</span></label>`).join('')}</div>`;$('clock-dimensions').append(row);row.addEventListener('change',e=>{row.lastElementChild.style.setProperty('--index',+e.target.value-2);if(menuDraft)menuDraft.clockSize[i]=+e.target.value;});});
  initClockEvents();
 }
 ['length','width'].forEach((name,i)=>{const track=$('clock-'+name);track.querySelector(`input[value="${draft.clockSize[i]}"]`).checked=true;track.style.setProperty('--index',draft.clockSize[i]-2);});
 $('clock-interaction').value=draft.clockPrefs.mode;$('clock-layout').value=draft.clockPrefs.layout;

}
function renderClock(){
 const root=$('clock-boards'),{width:w,height:h}=pieces,vw=w*100+16,vh=h*100+16,key=[w,h,clockPrefs.mode].join();
 if(clockBuilt!==key){
  cancelClockDrag();clockBuilt=key;
  root.innerHTML=[0,1].map(side=>`<section class="clock-face ${side?'back':''}" aria-label="${side?'反':'正'}面"><div class="board" data-side="${side}"><svg class="dials" viewBox="42 42 ${vw} ${vh}" role="img"><rect x="48" y="48" width="${vw-12}" height="${vh-12}" rx="30" fill="currentColor" opacity=".12"/>${Array.from({length:w*h},(_,i)=>clockDial(i)).join('')}</svg><svg class="arc-controls" viewBox="42 42 ${vw} ${vh}">${[0,1,2,3].map(wheel=>arcControl(side,wheel)).join('')}</svg>${pieces.pins.map((_,p)=>`<button class="pin" data-pin="${p}" style="left:${(108+p%(w-1)*100)/vw*100}%;top:${(108+Math.floor(p/(w-1))*100)/vh*100}%" aria-label="${side?'反':'正'}面第 ${Math.floor(p/(w-1))+1} 行第 ${p%(w-1)+1} 列销钉"></button>`).join('')}</div></section>`).join('');
 }
 root.querySelectorAll('.board').forEach(board=>{const side=+board.dataset.side;board.querySelectorAll('.pointer').forEach((el,i)=>el.setAttribute('transform',`rotate(${pieces.faces[side][i]*30})`));board.querySelector('.dials').setAttribute('aria-label',`${side?'反':'正'}面表盘：${pieces.faces[side].map(n=>n||12).join('、')}点`);board.querySelectorAll('.pin').forEach((el,p)=>{const up=side?!pieces.pins[ClockPuzzle.mirror(p,w-1)]:pieces.pins[p];el.setAttribute('aria-pressed',up);el.title=up?'凸起 · 点击按下':'按下 · 点击凸起';});});
 fitClock();
}
function fitClock(){
 if(puzzleType!=='clock')return;
 const root=$('clock-boards'),r=$('stage').getBoundingClientRect(),w=pieces.width*100+16,h=pieces.height*100+16,gap=8;
 const horizontal=Math.min((r.width-24-gap)/(2*w),(r.height-60)/h),vertical=Math.min((r.width-24)/w,(r.height-60-gap)/(2*h));
 const stacked=clockPrefs.layout==='vertical'||clockPrefs.layout==='auto'&&vertical>horizontal;
 root.classList.toggle('vertical',stacked);const scale=Math.max(.01,stacked?vertical:horizontal);
 root.style.setProperty('--clock-pin',Math.max(16,44*scale)+'px');
 root.style.setProperty('--clock-width',w*scale+'px');root.style.setProperty('--clock-height',h*scale+'px');
}
function clockMove(axis,layer,amount){if(puzzleType!=='clock'||$('modal').open||$('help-overlay').open)return;finishTurn({axis,layer,dir:amount,commit:true,kind:'manual'});}
function cancelClockDrag(){clockDrag=null;controls();}
function shuffleClock(){
 for(let i=0;i<40;i++){
  pieces.pins.forEach((_,p)=>{if(Math.random()<.5){ClockPuzzle.move(pieces,2,p,1);moves.push([2,p,1]);}});
  const move=[Math.random()<.5?0:1,Math.floor(Math.random()*4),1+Math.floor(Math.random()*11)];ClockPuzzle.move(pieces,...move);moves.push(move);
 }
 if(ClockPuzzle.solved(pieces)){ClockPuzzle.move(pieces,0,0,1);moves.push([0,0,1]);}
 cursor=moves.length;controls();dirty=true;save();
}
function initClockEvents(){
 const root=$('clock-boards');
 root.addEventListener('click',e=>{const b=e.target.closest('.pin');if(!b)return;const side=+b.closest('.board').dataset.side,p=+b.dataset.pin;clockMove(2,side?ClockPuzzle.mirror(p,pieces.width-1):p,1);});
 root.addEventListener('keydown',e=>{const b=e.target.closest('[data-wheel]');if(!b)return;let n;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))n=['ArrowRight','ArrowUp'].includes(e.key)?1:-1;else if(['Enter',' '].includes(e.key))n=+(b.dataset.step||1);if(n){e.preventDefault();clockMove(+b.closest('.board').dataset.side,+b.dataset.wheel,n);}});
 root.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-wheel]');if(!b||e.button!==0||clockDrag)return;e.preventDefault();b.focus({preventScroll:true});const board=b.closest('.board'),side=+board.dataset.side,wheel=+b.dataset.wheel;if(b.dataset.step){clockMove(side,wheel,+b.dataset.step);return;}const r=board.getBoundingClientRect(),x=r.left+r.width*((wheel%2?pieces.width*100:100)-42)/(pieces.width*100+16),y=r.top+r.height*((wheel<2?100:pieces.height*100)-42)/(pieces.height*100+16);clockDrag={id:e.pointerId,side,wheel,x,y,last:Math.atan2(e.clientY-y,e.clientX-x),total:0,steps:0};b.setPointerCapture(e.pointerId);controls();});
 root.addEventListener('pointermove',e=>{const d=clockDrag;if(!d||e.pointerId!==d.id||Math.hypot(e.clientX-d.x,e.clientY-d.y)<7)return;const a=Math.atan2(e.clientY-d.y,e.clientX-d.x);d.total+=Math.atan2(Math.sin(a-d.last),Math.cos(a-d.last));d.last=a;const steps=Math.round(d.total/(Math.PI/6)),n=steps-d.steps;if(n){d.steps=steps;clockMove(d.side,d.wheel,n);}});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(type,e=>{if(clockDrag?.id===e.pointerId)cancelClockDrag();});
 for(const type of ['contextmenu','dragstart','selectstart'])root.addEventListener(type,e=>e.preventDefault());
 $('clock-interaction').onchange=e=>{if(menuDraft)menuDraft.clockPrefs.mode=e.target.value;};
 $('clock-layout').onchange=e=>{if(menuDraft)menuDraft.clockPrefs.layout=e.target.value;};
 new ResizeObserver(()=>{cancelClockDrag();fitClock();}).observe($('stage'));
}
