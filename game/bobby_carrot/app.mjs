import {parseLevel, advance, replay} from './engine.mjs';
const $ = id => document.getElementById(id), canvas = $('game'), ctx = canvas.getContext('2d');
const images = {}, midi = {}, STORE = 'bobby-carrot-original-v1';
let saved = {games:{},done:{}}, state, motion, moves=[], mode='egg', level=1, held=null, queued=null, full=true, sound=false, synth, token=0;
try { const v=JSON.parse(localStorage.getItem(STORE)); if(v && v.games && v.done && typeof v.games==='object' && typeof v.done==='object') saved=v; } catch {}
if (['egg','normal'].includes(saved.mode)) mode=saved.mode;
level=Number.isInteger(saved.level)&&saved.level>0&&saved.level<=(mode==='egg'?20:30)?saved.level:1;
let initialState, awaitingInput=false;
let mapView={x:0,y:0,width:256,height:256};
function frameMap(tiles){
 const cells=tiles.flatMap((tile,i)=>tile>=18?[i]:[]);
 const left=Math.max(0,Math.min(...cells.map(i=>i%16))-1);
 const top=Math.max(0,Math.min(...cells.map(i=>Math.floor(i/16)))-1);
 const right=Math.min(15,Math.max(...cells.map(i=>i%16))+1);
 const bottom=Math.min(15,Math.max(...cells.map(i=>Math.floor(i/16)))+1);
 return {x:left*16,y:top*16,width:(right-left+1)*16,height:(bottom-top+1)*16};
}
const key=()=>`${mode}${String(level).padStart(2,'0')}`, count=()=>mode==='egg'?20:30;
const paused=()=>document.hidden||!!document.querySelector('dialog[open]');
function save(){ try{saved.mode=mode;saved.level=level;localStorage.setItem(STORE,JSON.stringify(saved));}catch{$('status').textContent='浏览器无法保存进度，本次仍可继续玩。';} }
function update(){
 $('undo').disabled=moves.length===0;
 $('remaining').textContent=`${mode==='egg'?'草窝':'胡萝卜'} ${state.remaining}`;
 $('keys').textContent=state.keys.map((n,i)=>n?`${['灰','黄','红'][i]}钥匙 ${n}`:'').filter(Boolean).join(' · ');
 $('turns').textContent=`转向 ${state.turns}`;
 $('levels').textContent=`第 ${level} / ${count()} 关`;
}
function resize(){
 const landscape=innerWidth>innerHeight&&innerHeight<=540;
 const width=full?mapView.width:128, height=full?mapView.height:landscape?128:144;
 if(canvas.width!==width)canvas.width=width;
 if(canvas.height!==height)canvas.height=height;
 const stage=$('stage');
 const scale=Math.max(.1,Math.min((stage.clientWidth-8)/width,(stage.clientHeight-8)/height));
 $('screen').style.setProperty('--screen-width',`${width*scale+8}px`);
}
function closeMenu(){if($('menu').open)$('menu').close();}
$('menu-button').onclick=()=>{release();$('menu').showModal();};
$('menu').addEventListener('close',()=>canvas.focus({preventScroll:true}));
new ResizeObserver(resize).observe($('stage'));
async function music(name){if(!sound)return;try{synth??=new WebAudioTinySynth({quality:1});await synth.getAudioContext().resume();synth.stopMIDI();synth.loadMIDI(midi[name].slice(0));synth.playMIDI();}catch{sound=false;$('sound').textContent='声音不可用';}}
async function load(reset=false){
 const request=++token; held=queued=null;motion=null;state=null;initialState=null;awaitingInput=false;$('result').hidden=true;$('status').textContent='正在载入…';
 $('mode').value=mode;['levels','restart','overview','undo'].forEach(id=>$(id).disabled=true);
 synth?.stopMIDI();
 try{
  const response=await fetch(`assets/${key()}.blm`);if(!response.ok)throw Error();
  const initial=parseLevel(new Uint8Array(await response.arrayBuffer()));if(request!==token)return;
  initialState=initial;mapView=frameMap(initial.tiles);
  moves=reset?[]:saved.games[key()]||[];
  try{state=replay(initial,moves);}catch{moves=[];state=initial;}
  if(state.status!=='playing'){moves=[];state=initial;}
  saved.games[key()]=moves;save();update();
  $('status').textContent=mode==='egg'?'离开草窝留下彩蛋，填满后走向终点。':'收齐胡萝卜后走向终点。';
  ['levels','restart','overview'].forEach(id=>$(id).disabled=false);resize();
 }catch{if(request===token){$('status').textContent='载入失败，请检查连接后点击重试。';$('restart').disabled=false;$('restart').textContent='重试';}}
}
function startMove(now){if(!state||motion||paused()||state.status!=='playing')return;
 if(awaitingInput){if(queued===null&&held===null)return;awaitingInput=false;}
 const next=advance(state,queued??held);queued=null;if(!next)return;
 motion={from:state,to:next,start:now};moves.push(next.facing);$('undo').disabled=false;saved.games[key()]=moves;save();
}
function finish(){
 const won=state.status==='won';if(won){saved.done[key()]=true;save();}
 held=queued=null;$('result').hidden=false;
 $('result-title').textContent=won?'本关完成':'碰到尖刺了';
 $('result-detail').textContent=won?`转向 ${state.turns} 次`:'重玩本关，再试一条路线。';
 $('result-art').hidden=!won;$('result-art').src=`assets/${level===count()?'end':'cleared'}.png`;
 $('continue').textContent=won&&level<count()?'下一关':won?'选择关卡':'重玩本关';
 music(won?(level===count()?'end':'cleared'):'death');
}
function tile(c,t,x,y){c.drawImage(images.tileset,(t%8)*16,Math.floor(t/8)*16,16,16,x,y,16,16);}
let lastFrame=0;
function draw(now){
 if(paused()&&motion)motion.start+=now-lastFrame;lastFrame=now;
 if(motion&&!paused()&&now-motion.start>=200){state=motion.to;motion=null;update();if(state.status!=='playing')finish();}
 startMove(now);
 if(state){
  const f=motion?Math.min(1,(now-motion.start)/200):1, visible=motion&&f>=.5?motion.to:state;
  const px=(motion?motion.from.x+(motion.to.x-motion.from.x)*f:state.x)*16+8;
  const py=(motion?motion.from.y+(motion.to.y-motion.from.y)*f:state.y)*16+8;
  const cameraX=full?mapView.x:Math.round(Math.max(0,Math.min(256-canvas.width,px-canvas.width/2)));
  const cameraY=full?mapView.y:Math.round(Math.max(0,Math.min(256-canvas.height,py-canvas.height/2)));
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(-cameraX,-cameraY);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
   const t=visible.tiles[y*16+x];tile(ctx,t,x*16,y*16);
   if(t===44&&visible.remaining===0)ctx.drawImage(images.tile_finish,Math.floor(now/150)%4*16,0,16,16,x*16,y*16,16,16);
  }
  const facing=motion?motion.to.facing:state.facing;
  if(state.status==='dead')ctx.drawImage(images.bobby_death,7*22,0,22,27,Math.round(px)-11,Math.round(py)-19,22,27);
  else ctx.drawImage(images[`bobby_${['left','right','up','down'][facing]}`],(motion?Math.floor(f*4)%4:0)*18,0,18,25,Math.round(px)-9,Math.round(py)-17,18,25);
  ctx.restore();
 }
 requestAnimationFrame(draw);
}
function input(d){if(paused())return;queued=d;held=d;}
const bindings={ArrowLeft:0,ArrowRight:1,ArrowUp:2,ArrowDown:3,a:0,d:1,w:2,s:3,4:0,6:1,2:2,8:3};
addEventListener('keydown',e=>{if(paused()||['SELECT','INPUT'].includes(e.target.tagName))return;const d=bindings[e.key];if(d!==undefined){e.preventDefault();if(!e.repeat)input(d);}else if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();$('overview').click();}else if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&['r','z'].includes(e.key.toLowerCase())){e.preventDefault();if(!e.repeat)$(e.key.toLowerCase()==='r'?'restart':'undo').click();}});
addEventListener('keyup',e=>{if(bindings[e.key]===held)held=null;});
function release(){held=queued=null;document.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));}
addEventListener('blur',release);document.addEventListener('visibilitychange',release);
for(const b of document.querySelectorAll('[data-dir]')){
 b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);b.classList.add('held');input(+b.dataset.dir);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{held=null;b.classList.remove('held');});
 b.addEventListener('contextmenu',e=>e.preventDefault());
 b.addEventListener('click',e=>{if(e.detail===0){queued=+b.dataset.dir;canvas.focus({preventScroll:true});}});
}
let touch;
canvas.addEventListener('pointerdown',e=>{touch=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointerup',e=>{if(!touch)return;const x=e.clientX-touch[0],y=e.clientY-touch[1];touch=null;if(Math.max(Math.abs(x),Math.abs(y))>15)queued=Math.abs(x)>Math.abs(y)?(x<0?0:1):(y<0?2:3);});
canvas.addEventListener('pointercancel',()=>touch=null);
$('mode').onchange=()=>{closeMenu();mode=$('mode').value;level=1;load();};
$('undo').onclick=()=>{
 if(!initialState||!moves.length)return;
 release();touch=null;motion=null;moves=moves.slice(0,-1);
 state=replay(initialState,moves);awaitingInput=true;
 $('result').hidden=true;synth?.stopMIDI();
 saved.games[key()]=moves;save();update();
 $('status').textContent='已撤销一步。';
 canvas.focus({preventScroll:true});
};
function restart(){closeMenu();$('restart').textContent='重玩';load(true);}
$('restart').onclick=()=>{
 release();
 if(!state||moves.length===0||state.status!=='playing'){restart();return;}
 $('restart-dialog').showModal();
};
$('confirm-restart').onclick=()=>{$('restart-dialog').close();restart();};
$('restart-dialog').addEventListener('close',()=>canvas.focus({preventScroll:true}));
$('overview').onclick=()=>{closeMenu();full=!full;$('overview').setAttribute('aria-pressed',full);$('overview').textContent=full?'跟随':'全图';resize();};
$('sound').onclick=()=>{sound=!sound;$('sound').setAttribute('aria-pressed',sound);$('sound').textContent=`声音：${sound?'开':'关'}`;if(sound)music('title');else synth?.stopMIDI();};
function picker(){closeMenu();release();$('progress').textContent=`已完成 ${Array.from({length:count()},(_,i)=>saved.done[`${mode}${String(i+1).padStart(2,'0')}`]).filter(Boolean).length} / ${count()}`;$('level-grid').replaceChildren();for(let n=1;n<=count();n++){const b=document.createElement('button');b.textContent=`${n}${saved.done[`${mode}${String(n).padStart(2,'0')}`]?' ✓':''}`;b.classList.toggle('current',n===level);b.onclick=()=>{$('picker').close();level=n;load();};$('level-grid').append(b);}$('picker').showModal();}
$('levels').onclick=picker;$('help').onclick=()=>{closeMenu();release();$('rules').showModal();};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>b.closest('dialog').close();
$('continue').onclick=()=>{if(state.status==='dead')load(true);else if(level<count()){level++;load();}else picker();};
addEventListener('resize',resize);
async function boot(){try{
 await Promise.all(['tileset','tile_finish','bobby_left','bobby_right','bobby_up','bobby_down','bobby_death'].map(async name=>{const img=new Image();img.src=`assets/${name}.png`;await img.decode();images[name]=img;}));
 await Promise.all(['title','death','cleared','end'].map(async name=>{const r=await fetch(`assets/${name}.mid`);if(!r.ok)throw Error();midi[name]=await r.arrayBuffer();}));
 for(const [t,text] of [[45,'草窝：离开时生蛋，之后不能进入。'],[30,'尖刺：离开后升起，再次踏入会失败。'],[24,'转门：只能从开口通过，离开后旋转。'],[22,'红开关：旋转所有转门；按下后失效。'],[32,'钥匙和锁：颜色对应，开锁消耗一把钥匙。'],[40,'传送带：顺箭头移动，连续传送时可向侧面跳出。'],[38,'黄开关：反转所有传送带；按下后失效。']]){const row=document.createElement('div');row.className='legend-row';const c=document.createElement('canvas');c.width=c.height=16;tile(c.getContext('2d'),t,0,0);const p=document.createElement('p');p.textContent=text;row.append(c,p);$('legend').append(row);}
 await load();requestAnimationFrame(draw);
 }catch{$('status').textContent='资源载入失败，请刷新重试。';}}
boot();
