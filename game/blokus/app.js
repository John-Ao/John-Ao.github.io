'use strict';
const E=Blokus, $=id=>document.getElementById(id);
const colors=['#2687cf','#e4b72d','#dc6256','#43a079'], names=['蓝','黄','红','绿'];
const storageKey='blokus-classic-v1';
let game=E.create(), players=2, selection=null, shape=null, position=null, pointer=null, storageOK=true;
const playerName=p=>'玩家'+['一','二','三','四'][p];
const owner=c=>players===4?c:c%2;
try {
  const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
  if(saved) {
    const history=Array.isArray(saved)?saved:saved.history;
    players=Array.isArray(saved)?2:saved.players;
    if(![2,4].includes(players)||!Array.isArray(history)||history.length>84) throw Error();
    for(const m of history) if(!Number.isInteger(m.x)||!Number.isInteger(m.y)||!E.play(game,m.id,m.s,m.x,m.y)) throw Error();
  }
} catch { game=E.create(); players=2; }
function save(){try{localStorage.setItem(storageKey,JSON.stringify({players,history:game.history}));}catch{storageOK=false;}}
function svg(s,color){
  const w=Math.max(...s.map(p=>p[0]))+1,h=Math.max(...s.map(p=>p[1]))+1,z=Math.min(100/w,100/h);
  const blocks=s.map(([x,y])=>`<rect x="${(110-w*z)/2+x*z+1}" y="${(110-h*z)/2+y*z+1}" width="${z-2}" height="${z-2}" rx="2" fill="${color}"/>`).join('');
  const [ax,ay]=s[0];
  return blocks+`<circle cx="${(110-w*z)/2+(ax+.5)*z}" cy="${(110-h*z)/2+(ay+.5)*z}" r="${z*.17}" fill="#242424" stroke="white" stroke-width="${z*.06}"/>`;
}
let candidateCache={};
function candidatePoints(){
  if(!shape||game.ended)return [];
  const key=game.history.length+':'+game.turn+':'+JSON.stringify(shape);
  if(candidateCache.game!==game||candidateCache.key!==key)
    candidateCache={game,key,points:E.candidates(game,game.turn,shape)};
  return candidateCache.points;
}
function status(text){$('message').textContent=text+(storageOK?'':'（浏览器未允许保存，请勿刷新。）');}
function draw(){const canvas=$('board'),ctx=canvas.getContext('2d'),cell=50;ctx.clearRect(0,0,1000,1000);ctx.fillStyle='#eeeeee';ctx.fillRect(0,0,1000,1000);
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){ctx.strokeStyle='#d2d2d2';ctx.lineWidth=1;ctx.strokeRect(x*cell+.5,y*cell+.5,cell,cell);const c=game.board[y*20+x];if(c>=0){ctx.fillStyle=colors[c];ctx.fillRect(x*cell+2,y*cell+2,46,46);ctx.fillStyle='#ffffff24';ctx.fillRect(x*cell+5,y*cell+5,40,5);}}
  E.corners.forEach(([x,y],c)=>{if(!game.used[c].length){ctx.fillStyle=colors[c];ctx.font='bold 28px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(c+1),x*50+25,y*50+26);}});
  for(const {anchorX,anchorY} of candidatePoints()){
    ctx.beginPath();ctx.arc(anchorX*cell+25,anchorY*cell+25,9,0,Math.PI*2);
    ctx.fillStyle=colors[game.turn];ctx.fill();ctx.strokeStyle='#242424';ctx.lineWidth=2;ctx.stroke();
  }
  if(shape&&position){const valid=!E.reason(game,game.turn,shape,position.x,position.y);for(const [dx,dy]of shape){const x=(position.x+dx)*50,y=(position.y+dy)*50;ctx.globalAlpha=.55;ctx.fillStyle=valid?colors[game.turn]:'#713f4e';ctx.fillRect(x+2,y+2,46,46);ctx.globalAlpha=1;ctx.strokeStyle=valid?'#343434':'#a21d38';ctx.lineWidth=3;ctx.setLineDash(valid?[]:[7,4]);ctx.strokeRect(x+3,y+3,44,44);ctx.setLineDash([]);}const [ax,ay]=shape[0];ctx.fillStyle='#242424';ctx.beginPath();ctx.arc((position.x+ax)*50+25,(position.y+ay)*50+25,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=2;ctx.stroke();}
}
function preview(){draw();$('selected').innerHTML=shape?svg(shape,colors[game.turn]):'';const problem=shape&&position?E.reason(game,game.turn,shape,position.x,position.y):shape?(candidatePoints().length?'点棋盘上的圆点预览落子':'当前朝向无落点，请旋转、翻转或换块'):'先选择棋块，再点按棋盘';$('confirm').disabled=game.ended||!!problem; if(!game.ended)status(problem||'可以落子，点「确认落子」提交');}
function render(){
  document.documentElement.style.setProperty('--accent',colors[game.turn]);
  document.title=`Blokus · ${players===4?'四人':'双人'}对战`;
  $('restart').textContent=players===4?'四人 ▾':'双人 ▾';
  const scores=E.playerScores(game,players), scoreboard=document.querySelector('.scores');
  scoreboard.dataset.players=players;
  scoreboard.innerHTML=scores.map((score,p)=>{
    const cs=players===4?[p]:[p,p+2];
    return `<button type="button" id="player${p}" data-player="${p}" aria-haspopup="dialog" aria-controls="remaining-dialog" aria-label="查看${playerName(p)}的剩余棋块" title="查看剩余棋块" class="${!game.ended&&owner(game.turn)===p?'active':''}"><span><strong>${playerName(p)}</strong><small>${cs.map(c=>`<span class="dot" style="background:${colors[c]}"></span>${names[c]}${players===2?' '+E.score(game,c)+' 分':''}`).join('　')}</small></span><span class="score-number">${score}</span></button>`;
  }).join('');
  $('turn').textContent=game.ended?'对局结束':`${playerName(owner(game.turn))} · ${names[game.turn]}色回合`;
  $('tray-title').textContent=`${names[game.turn]}色棋块`;$('remaining').textContent=`剩余 ${21-game.used[game.turn].length} / 21 块`;
  $('tray').innerHTML=E.pieces.map((s,id)=>`<button class="piece${selection===id?' chosen':''}" data-id="${id}" aria-label="${s.length} 格棋块 ${id+1}" aria-pressed="${selection===id}" ${game.ended||game.used[game.turn].includes(id)?'disabled':''}><svg viewBox="0 0 110 110" aria-hidden="true">${svg(s,colors[game.turn])}</svg></button>`).join('');
  $('piece-title').textContent=shape?`${shape.length} 格棋块 · ${selection+1}`:'选择一块棋块';
  ['rotate','flip'].forEach(id=>$(id).disabled=!shape||game.ended);$('hint').disabled=game.ended;document.querySelectorAll('[data-dx]').forEach(b=>b.disabled=!shape||game.ended);preview();
  if(game.ended){
    const best=Math.max(...scores), winners=scores.map((s,p)=>s===best?playerName(p):null).filter(Boolean);
    status(`${winners.join('、')}${winners.length>1?'并列第一':'获胜'}！${scores.join(' : ')}`);
  }
}
$('tray').addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(!b||b.disabled)return;selection=Number(b.dataset.id);shape=E.normalize(E.pieces[selection]);position=null;render();});
function transform(fn){if(!shape||game.ended)return;shape=fn(shape);preview();}
$('rotate').onclick=()=>transform(E.rotate);$('flip').onclick=()=>transform(E.flip);
function move(dx,dy){if(!shape||game.ended)return;if(!position){const [x,y]=E.corners[game.turn];position={x:Math.min(x,20-Math.max(...shape.map(p=>p[0]))-1),y:Math.min(y,20-Math.max(...shape.map(p=>p[1]))-1)};}position.x=Math.max(-4,Math.min(19,position.x+dx));position.y=Math.max(-4,Math.min(19,position.y+dy));preview();}
document.querySelectorAll('[data-dx]').forEach(b=>b.onclick=()=>move(+b.dataset.dx,+b.dataset.dy));
function locate(e){const r=$('board').getBoundingClientRect();const [ax,ay]=shape[0];position={x:Math.max(0,Math.min(19,Math.floor((e.clientX-r.left)/r.width*20)))-ax,y:Math.max(0,Math.min(19,Math.floor((e.clientY-r.top)/r.height*20)))-ay};preview();}
$('board').addEventListener('pointerdown',e=>{if(pointer!==null||game.ended)return;if(!shape){status('请先在下方选择一块棋块');return;}pointer=e.pointerId;$('board').setPointerCapture(pointer);locate(e);});
$('board').addEventListener('pointermove',e=>{if(e.pointerId===pointer)locate(e);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('board').addEventListener(type,e=>{if(e.pointerId===pointer)pointer=null;});
$('confirm').onclick=()=>{if(!shape||!position||$('confirm').disabled)return;const result=E.play(game,selection,shape,position.x,position.y);if(!result)return;selection=shape=position=null;save();render();if(!game.ended&&result.skipped.length)status(`${result.skipped.map(c=>names[c]).join('、')}色无棋可下，已自动跳过。轮到${names[game.turn]}色。`);};
$('hint').onclick=()=>{const m=E.find(game,game.turn,selection===null?undefined:selection);if(!m){status('这块棋已无合法位置，请选择其他棋块');return;}selection=m.id;shape=m.s;position={x:m.x,y:m.y};render();};
function showRemaining(player){
  if(!Number.isInteger(player)||player<0||player>=players)return;
  $('remaining-title').textContent=`${playerName(player)} · 剩余棋块`;
  const cs=players===4?[player]:[player,player+2];
  $('remaining-colors').innerHTML=cs.map(c=>{
    const pieces=E.pieces.map((s,id)=>({s,id})).filter(({id})=>!game.used[c].includes(id));
    const squares=pieces.reduce((n,{s})=>n+s.length,0);
    return `<section class="remaining-color" aria-label="${names[c]}色剩余棋块"><h3><span class="dot" style="background:${colors[c]}"></span>${names[c]}色 <small>${pieces.length} 块 · ${squares} 格</small></h3>${pieces.length?`<div class="remaining-grid">${pieces.map(({s,id})=>`<div class="remaining-piece" role="img" aria-label="${names[c]}色 ${s.length} 格棋块 ${id+1}"><svg viewBox="0 0 110 110" aria-hidden="true">${svg(s,colors[c])}</svg></div>`).join('')}</div>`:'<p class="remaining-empty">已全部放完</p>'}</section>`;
  }).join('');
  $('remaining-dialog').showModal();
}
document.querySelector('.scores').addEventListener('click',e=>{
  const card=e.target.closest('[data-player]');
  if(card)showRemaining(Number(card.dataset.player));
});
$('rules').onclick=()=>$('rules-dialog').showModal();
$('restart').onclick=()=>{$('player-count').value=String(players);$('restart-dialog').showModal();};
$('restart-confirm').onclick=()=>{players=Number($('player-count').value);game=E.create();selection=shape=position=null;pointer=null;save();render();};
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||['BUTTON','SELECT','INPUT'].includes(e.target.tagName))return;const moves={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};if(moves[e.key]){e.preventDefault();move(...moves[e.key]);}else if(e.key.toLowerCase()==='r')transform(E.rotate);else if(e.key.toLowerCase()==='f')transform(E.flip);else if(e.key==='Enter')$('confirm').click();});
render();

// Choose the arrangement that leaves the largest square board in the viewport.
function fitLayout() {
  const main=document.querySelector('main'), scores=document.querySelector('.scores');
  const w=main.clientWidth-12, h=main.clientHeight-12-scores.offsetHeight-6;
  const panel=Math.max(208,Math.min(300,w*.28)), gap=8, boardChrome=52;
  const beside=Math.min(w-panel-gap,h-boardChrome);
  const below=Math.min(w,h-boardChrome-208-gap);
  const side=beside>=below;
  main.dataset.layout=side?'side':'stack';
  main.style.setProperty('--board-size',Math.max(40,Math.floor(side?beside:below))+'px');
  main.style.setProperty('--panel-size',panel+'px');
}
new ResizeObserver(fitLayout).observe(document.querySelector('main'));
fitLayout();
