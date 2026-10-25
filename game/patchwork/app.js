'use strict';
const $=id=>document.getElementById(id),KEY='patchwork-classic-v1';
const colors=['#6f9c87','#cc8a61','#7799b2','#aa809e','#b4a05f','#679c9d','#b77870','#88975b','#a18b73','#808fbb','#c49883'];
const color=id=>id===34?'#b7895e':colors[(id-1)%colors.length];
let state=Game.create(),history=[],selection=null,position=null,saveOK=true;
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&saved.state.version===1&&saved.state.players.length===2&&saved.state.players.every(p=>p.board.length===81)){state=saved.state;history=Array.isArray(saved.history)?saved.history:[];}}catch(e){saveOK=false;}
function save(){try{localStorage.setItem(KEY,JSON.stringify({state,history}));saveOK=true;}catch(e){saveOK=false;}}
function svg(c,id){const w=Math.max(...c.map(p=>p[0]))+1,h=Math.max(...c.map(p=>p[1]))+1;return `<svg class="patch-svg" viewBox="-2 -2 ${w*16+4} ${h*16+4}" aria-hidden="true">${c.map(([x,y])=>`<rect x="${x*16}" y="${y*16}" width="16" height="16" rx="1" fill="${color(id)}" stroke="#fff9" stroke-width="1"/><rect x="${x*16+3}" y="${y*16+3}" width="10" height="10" fill="none" stroke="#fff5" stroke-width=".6" stroke-dasharray="2 2"/>`).join('')}</svg>`;}
function clear(){selection=null;position=null;}
function notify(msg){$('message').textContent=msg;}
function choose(id){if(state.pending||state.over)return;const t=Game.tile(id),p=state.players[state.active];if(t.cost>p.buttons){notify('纽扣不足，可以选择其他布片或前进赚取纽扣。');return;}if(!Game.fit(p.board,t.cells)){notify('棋盘没有可容纳这块布片的位置。');return;}selection={id,cells:Game.normalize(t.cells)};position=null;render();}
function act(fn){const before=JSON.stringify(state);try{fn();history.push(JSON.parse(before));history=history.slice(-100);clear();save();render();}catch(e){state=JSON.parse(before);notify(e.message);}}
function layoutTrack(){
 const track=$('track'),cells=[...track.querySelectorAll('.time-cell')];
 if(!cells.length)return;
 const columns=getComputedStyle(track).gridTemplateColumns.split(' ').length;
 cells.forEach((cell,i)=>{
  const row=Math.floor(i/columns),col=i%columns;
  cell.style.gridRow=row+1;
  cell.style.gridColumn=row%2?columns-col:col+1;
  const turning=col===columns-1&&i<cells.length-1;
  cell.style.setProperty('--direction',turning?'90deg':row%2?'180deg':'0deg');
 });
}
function render(){
 if(state.pending&&!selection)selection={id:34,cells:[[0,0]]};
 const p=state.players[state.active];
 $('turn').textContent=state.over?'对局结束':`玩家 ${state.active+1} · ${state.pending?`放置皮革补丁（剩余 ${state.pending}）`:'选择行动'}`;
 $('turn').style.color=state.active?'var(--orange)':'var(--green)';
 $('bonus').textContent=state.bonusOwner===null?'7×7 奖励：尚未领取':`7×7 奖励：玩家 ${state.bonusOwner+1} +7`;
 $('track').innerHTML=Array.from({length:54},(_,i)=>`<div class="time-cell ${Game.INCOME.includes(i)?'income':''} ${state.leather.includes(i)?'leather':''} ${!state.over&&p.pos===i?'current-position':''}" ${!state.over&&p.pos===i?'aria-current="step"':''} title="第 ${i} 格${Game.INCOME.includes(i)?' · 结算收益':''}${state.leather.includes(i)?' · 获取方格':''}"><span>${i===0?'起点':i===53?'终点':i}</span><span class="tokens">${state.players.map((p,j)=>p.pos===i?`<b class="token ${j?'two':''} ${!state.over&&j===state.active?'current-token':''}">${j+1}</b>`:'').join('')}</span></div>`).join('');
 $('track').style.setProperty('--active-color',state.active?'var(--orange)':'var(--green)');
 layoutTrack();
 state.players.forEach((player,j)=>{
  const panel=$('player'+j),active=j===state.active&&!state.over;
  panel.classList.toggle('active',active);
  panel.classList.toggle('waiting',!state.over&&!active);
  panel.setAttribute('aria-label',`玩家 ${j+1}${active?'，当前行动':''}`);
  panel.querySelector('.stats').innerHTML=[['纽扣',player.buttons],['收益',player.income],['分数',Game.score(player)]].map(([name,n])=>`<span class="stat">${name} <b>${n}</b></span>`).join('');
  const b=$('board'+j);if(!b.children.length){for(let k=0;k<81;k++){const cell=document.createElement('button');cell.className='cell';cell.dataset.index=k;cell.addEventListener('click',()=>{if(j!==state.active||state.over){notify('请在当前行动玩家的棋盘上操作。');return;}if(!selection){notify('请先选择一块布片。');return;}position=[k%9,Math.floor(k/9)];renderBoards();});b.append(cell);}}
 });
 const market=$('market'),marketOrder=state.market.join(','),scrollTop=market.dataset.order===marketOrder?market.scrollTop:0;
 market.innerHTML='';
 state.market.forEach((id,i)=>{
  const t=Game.tile(id),available=i<3&&!state.pending&&!state.over;
  const afford=t.cost<=p.buttons,canFit=available?Game.fit(p.board,t.cells):true;
  const card=document.createElement(available?'button':'div');
  card.className=`patch-card ${available?'available':''} ${selection?.id===id?'selected':''}`;
  card.setAttribute('aria-label',`布片，支付 ${t.cost}，前进 ${t.time}，收入 ${t.income}${available?'，可选':'，暂不可选'}${available&&!afford?'，纽扣不足':available&&!canFit?'，无法放入':''}`);
  card.innerHTML=svg(t.cells,id)+`<div class="patch-meta"><div class="patch-actions"><span class="value-pair">支付 <b>${t.cost}</b></span><span class="value-pair">前进 <b>${t.time}</b></span><span class="value-pair">收入 <b>${t.income}</b></span></div>${available&&!afford?'<span>纽扣不足</span>':available&&!canFit?'<span>放不下</span>':''}</div>`;
  if(available){card.setAttribute('aria-pressed',selection?.id===id?'true':'false');card.onclick=()=>choose(id);}
  market.append(card);
 });
 market.dataset.order=marketOrder;
 market.scrollTop=scrollTop;
 $('placement').hidden=!selection;
 if(selection){const t=Game.tile(selection.id);$('selected-shape').innerHTML=svg(selection.cells,t.id);$('selected-info').innerHTML=t.id===34?'<span class="value-pair"><b>1×1</b> 皮革补丁</span><br>免费 · 不消耗时间':`<span class="value-pair">布片 <b>#${t.id}</b></span><br><span class="value-pair"><b>${t.cells.length}</b> 格</span> · <span class="value-pair">收入 <b>+${t.income}</b></span>`;}
 ['rotate','flip','cancel'].forEach(id=>$(id).disabled=!!state.pending);
 const steps=Math.min(53,state.players[1-state.active].pos+1)-p.pos;
 $('advance').innerHTML=`<span class="value-pair">移动到对方前，获得 <b>${Math.max(0,steps)}</b> 纽扣</span>`;
 $('advance').disabled=!!state.pending||state.over;$('advance').hidden=state.over;
 $('remaining').innerHTML=`<b>${state.market.length}</b>`;
 $('log').innerHTML=state.log.slice().reverse().map(l=>`<li>${l}</li>`).join('');
 $('undo').disabled=!history.length;notify('');
 $('result').hidden=!state.over;
 if(state.over){const win=Game.winner(state);$('result').innerHTML=`<h2>玩家 ${win+1} 获胜</h2><table><tr><th></th><th>玩家 1</th><th>玩家 2</th></tr>${[['剩余纽扣',p=>p.buttons],['空格扣分',p=>-2*p.board.filter(v=>!v).length],['7×7 奖励',p=>p.bonus],['最终得分',Game.score]].map(([label,f])=>`<tr><th>${label}</th>${state.players.map(p=>`<td>${f(p)}</td>`).join('')}</tr>`).join('')}</table>${Game.score(state.players[0])===Game.score(state.players[1])?'<p>双方同分，先到终点者获胜。</p>':''}`;}
 $('save-status').textContent=saveOK?'对局自动保存在本机浏览器':'浏览器未允许存档；当前对局仍可继续，请勿刷新。';renderBoards();
}
function renderBoards(){
 const p=state.players[state.active],legal=selection&&position&&Game.valid(p.board,selection.cells,...position);
 state.players.forEach((p,j)=>{const ghosts=new Set(selection&&position&&j===state.active?selection.cells.filter(([x,y])=>x+position[0]>=0&&x+position[0]<9&&y+position[1]>=0&&y+position[1]<9).map(([x,y])=>(y+position[1])*9+x+position[0]):[]);
 [...$('board'+j).children].forEach((b,k)=>{b.className='cell'+(p.board[k]?' filled':'')+(ghosts.has(k)?` ghost ${legal?'':'invalid'}`:'')+(position&&selection&&j===state.active&&k===position[1]*9+position[0]?' origin':'');b.style.setProperty('--fabric',color(p.board[k]));b.setAttribute('aria-label',`第 ${Math.floor(k/9)+1} 行，第 ${k%9+1} 列，${p.board[k]?'已铺布片':'空格'}`);b.setAttribute('aria-disabled',j!==state.active||state.over?'true':'false');});});
 $('confirm').disabled=!legal;$('hint').textContent=!position?'点自己的棋盘，选择布片外框左上角的位置。':legal?'位置有效，可以确认或继续调整。':'此位置重叠或越界，请换一个位置或旋转布片。';
}
$('rotate').onclick=()=>{if(selection){selection.cells=Game.rotate(selection.cells);render();}};
$('flip').onclick=()=>{if(selection){selection.cells=Game.flip(selection.cells);render();}};
$('cancel').onclick=()=>{clear();render();};
$('confirm').onclick=()=>{if(selection&&position)act(()=>Game.place(state,selection.id,selection.cells,...position));};
$('advance').onclick=()=>act(()=>Game.advance(state));
$('undo').onclick=()=>{if(history.length){state=history.pop();clear();save();render();}};
$('rules').onclick=()=>$('rules-dialog').showModal();$('close-rules').onclick=()=>$('rules-dialog').close();
$('restart').onclick=()=>$('restart-dialog').showModal();$('cancel-restart').onclick=()=>$('restart-dialog').close();
$('confirm-restart').onclick=()=>{state=Game.create();history=[];clear();save();render();$('restart-dialog').close();};
save();render();
new ResizeObserver(layoutTrack).observe($('track'));
