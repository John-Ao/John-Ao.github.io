'use strict';
const $=id=>document.getElementById(id), names=['宇航员','机器人 A','机器人 B','机器人 C','机器人 D'], arrows=['↑','→','↓','←'], directionNames=['上','右','下','左'];
let state={level:0,pieces:LEVELS[0].pieces.slice(),history:[],robot:1,active:0,opposite:false,best:{}}, epoch=0;
try{
 const saved=JSON.parse(localStorage.getItem('space-rescue-v1'));
 const valid=p=>Array.isArray(p)&&p.length===5&&new Set(p).size===5&&p.every(n=>Number.isInteger(n)&&n>=0&&n<49);
 if(saved&&Number.isInteger(saved.level)&&LEVELS[saved.level]&&valid(saved.pieces)&&Array.isArray(saved.history)&&saved.history.every(valid))state={...state,...saved,robot:Math.max(1,Math.min(4,saved.robot||1)),active:0,best:saved.best||{}};
}catch{}
function save(){try{localStorage.setItem('space-rescue-v1',JSON.stringify(state));}catch{}}
function won(){return state.pieces[0]===24;}
function status(message){$('status').textContent=message;}
const levelGroups = new Map();
LEVELS.forEach((level, index) => {
 const label = index < 12 ? '原有关卡 01–12' : `进阶题库 · 最短 ${level.par} 步`;
 if (!levelGroups.has(label)) {
  const group = document.createElement('optgroup');
  group.label = label;
  levelGroups.set(label, group);
  $('level').append(group);
 }
 const option = document.createElement('option');
 option.value = index;
 option.textContent = `${String(index + 1).padStart(2, '0')} · ${level.par} 步`;
 levelGroups.get(label).append(option);
});
const cells=[],pieces=[];
for(let n=0;n<49;n++){
 const c=document.createElement('div');c.className='cell'+(n===24?' target':'');c.setAttribute('aria-hidden','true');$('board').append(c);cells.push(c);
}
for(let i=0;i<5;i++){
 const p=document.createElement('button');p.className='piece p'+i;p.innerHTML=i?`<span class="robot">${'ABCD'[i-1]}</span>`:'<span class="astronaut"><i></i></span>';
 p.setAttribute('aria-label',names[i]);$('board').append(p);pieces.push(p);
 p.addEventListener('click',()=>select(i));
 p.addEventListener('pointerdown',e=>{
  if(won()||e.button>0)return;
  e.preventDefault();select(i);p.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,{i,x:e.clientX,y:e.clientY,epoch});
 });
 p.addEventListener('pointerup',e=>{
  const start=pointers.get(e.pointerId);pointers.delete(e.pointerId);if(!start||start.epoch!==epoch)return;
  const x=e.clientX-start.x,y=e.clientY-start.y;
  if(Math.hypot(x,y)<16)return;
  act(start.i,Math.abs(x)>Math.abs(y)?(x>0?1:3):(y>0?2:0));
 });
 p.addEventListener('pointercancel',e=>pointers.delete(e.pointerId));
}
const pointers=new Map();
for(let i=1;i<5;i++){
 const b=document.createElement('button');b.textContent='ABCD'[i-1];b.setAttribute('aria-label','选择'+names[i]);b.onclick=()=>select(i);$('robotchoices').append(b);
}
document.querySelectorAll('.pad').forEach(pad=>{
 const player=Number(pad.dataset.player);
 arrows.forEach((arrow,d)=>{const b=document.createElement('button');b.textContent=arrow;b.dataset.d=d;b.setAttribute('aria-label',`玩家${player+1}向${directionNames[d]}移动`);b.onclick=()=>act(player?state.robot:0,player&&state.opposite?(d+2)%4:d);pad.append(b);});
});
function select(i){state.active=i;if(i)state.robot=i;render();save();}
function render(){
 $('level').value=state.level;$('moves').textContent=state.history.length;$('par').textContent=`最短 ${LEVELS[state.level].par} 步`;
 document.body.classList.toggle('opposite',state.opposite);$('face').setAttribute('aria-pressed',state.opposite);
 cells.forEach(c=>c.classList.remove('possible'));
 if(!won())for(let d=0;d<4;d++){const to=Rescue.destination(state.pieces,state.active,d);if(to!==null)cells[to].classList.add('possible');}
 pieces.forEach((p,i)=>{p.style.left=(state.pieces[i]%7)*100/7+'%';p.style.top=Math.floor(state.pieces[i]/7)*100/7+'%';p.classList.toggle('selected',i===state.active);p.setAttribute('aria-label',`${names[i]}，第${Math.floor(state.pieces[i]/7)+1}行第${state.pieces[i]%7+1}列`);p.setAttribute('aria-pressed',i===state.active);});
 [...$('robotchoices').children].forEach((b,i)=>b.setAttribute('aria-pressed',state.robot===i+1));
 document.querySelectorAll('.pad').forEach(pad=>{const player=Number(pad.dataset.player);[...pad.children].forEach((b,d)=>{b.disabled=won()||Rescue.destination(state.pieces,player?state.robot:0,player&&state.opposite?(d+2)%4:d)===null;});});
 $('undo').disabled=!state.history.length;$('hint').disabled=won();$('success').hidden=!won();
 $('feedback1').textContent='已选择'+names[state.robot];
 $('feedback0').textContent=won()?'已抵达飞船':'由机器人接应，停在飞船上';
 if(won()){$('result').textContent=`共 ${state.history.length} 步 · 本关最短 ${LEVELS[state.level].par} 步`;$('next').textContent=state.level===LEVELS.length-1?'返回第一关':'下一关 →';}
}
function act(i,d){
 if(won())return;
 const next=Rescue.move(state.pieces,i,d);
 if(!next){status('这个方向无法移动：需要前方有棋子接应，并留出至少一格距离。');return;}
 state.history.push(state.pieces.slice());state.pieces=next;state.active=i;if(i)state.robot=i;
 status(`${names[i]}向${directionNames[d]}移动。${won()?'救援成功！':'双方可以继续配合。'}`);
 if(won())state.best[state.level]=Math.min(state.best[state.level]??Infinity,state.history.length);
 render();save();
}
function loadLevel(n){epoch++;pointers.clear();state.level=n;state.pieces=LEVELS[n].pieces.slice();state.history=[];state.active=0;state.robot=1;render();save();status('点击棋子后滑动，或使用两侧方向键');}
$('level').onchange=e=>loadLevel(Number(e.target.value));
$('undo').onclick=()=>{if(!state.history.length)return;epoch++;pointers.clear();state.pieces=state.history.pop();render();save();status('已撤销一步，双方可重新安排接应。');};
$('hint').onclick=()=>{
 const path=Rescue.solve(state.pieces);
 if(!path){status(path===null?'当前局面无解，请撤销或重置关卡。':'搜索范围较大，请尝试撤销后再获取提示。');return;}
 if(!path.length)return;
 const [i,d]=path[0];select(i);status(`提示：${names[i]}向${directionNames[d]}移动；当前局面至少还需 ${path.length} 步。`);
};
$('restart').onclick=()=>$('resetDialog').showModal();$('cancelReset').onclick=()=>$('resetDialog').close();$('confirmReset').onclick=()=>{$('resetDialog').close();loadLevel(state.level);};
$('next').onclick=()=>loadLevel((state.level+1)%LEVELS.length);
$('face').onclick=()=>{state.opposite=!state.opposite;render();save();};
$('rules').onclick=()=>$('ruleDialog').showModal();$('closeRules').onclick=()=>$('ruleDialog').close();
document.addEventListener('keydown',e=>{
 if(document.querySelector('dialog[open]')||['SELECT','INPUT','TEXTAREA'].includes(document.activeElement.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;
 const k=e.key.toLowerCase(),a=['w','d','s','a'].indexOf(k),b=['arrowup','arrowright','arrowdown','arrowleft'].indexOf(k);
 if(a!==-1){e.preventDefault();act(0,a);}else if(b!==-1){e.preventDefault();act(state.robot,state.opposite?(b+2)%4:b);}else if(/^[1-4]$/.test(k))select(Number(k));
});
render();if(won())status('本关已完成，可选择下一关或撤销。');
