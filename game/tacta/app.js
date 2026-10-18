'use strict';
const $ = id => document.getElementById(id), E = window.Tacta;
const colors=['#a17be7','#ed9c43'], names=['紫方','橙方'], symbols=['◆','✳'];
const storageKey='tacta-standard-v2';
const layoutKey='tacta-layout-v1';
let layout={dual:false,mirror:false};
try {const saved=JSON.parse(localStorage.getItem(layoutKey));if(saved)layout={dual:!!saved.dual,mirror:!!saved.mirror};}catch {}
let state, selected=0, rotation=0, flip=false, pending=null, legal=[], isolated=false;
let view=null, manualCamera=false, showTable=false, notice='';
try { const raw=localStorage.getItem(storageKey); if(raw)state=E.restore(JSON.parse(raw)); }
catch { notice='旧存档无法读取，已开始新局。'; }
if(!state)state=E.create();
function save() {
  try {localStorage.setItem(storageKey,JSON.stringify(state));}
  catch {$('saveNote').textContent='浏览器无法存档，请保持页面打开';}
}
function current() {return E.ends(state)[selected] || E.ends(state)[0];}
const points=poly=>poly.map(p=>p.map(n=>n.toFixed(3)).join(',')).join(' ');
function cardSvg(card,x=0,y=0,r=0,f=false) {
  const c=E.orient(card,r,f,x,y), color=card.owner<0?'#e5e5e5':colors[card.owner];
  let html=`<polygon points="${points(c.polygon)}" fill="#1f2426" stroke="${color}" stroke-width="2.8" stroke-linejoin="round"/>`;
  for(const region of c.regions)html+=`<polygon points="${points(region.polygon)}" fill="${region.dots.length?color:'none'}" stroke="#f8f5e9" stroke-width="1.2" stroke-linejoin="round"/>${region.dots.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="2.7" fill="#fffdf6"/>`).join('')}`;
  // The centre suit and value are printed information, never scoring dots.
  html+=`<g transform="translate(${x} ${y})"><circle r="13" fill="#1f2426"/>`;
  html+=card.suit==='square'?`<rect x="-10" y="-10" width="20" height="20" rx="2" stroke="${color}" fill="none" stroke-width="2"/>`:card.suit==='triangle'?`<path d="M 0 -12 L 12 10 L -12 10 Z" stroke="${color}" fill="none" stroke-width="2"/>`:`<circle r="10" stroke="${color}" fill="none" stroke-width="2"/>`;
  html+=`<text text-anchor="middle" y="4" fill="#fffdf6" font-size="12" font-weight="700">${card.owner<0?'×':card.value}</text><text text-anchor="middle" y="24" fill="${color}" font-size="7">${card.owner<0?'':symbols[card.owner]}</text></g>`;
  return `<g>${html}</g>`;
}
function handSvg(c,chosen) {
  const r=chosen?rotation:0,f=chosen?flip:false,b=E.orient(c,r,f).bounds;
  return `<svg viewBox="${b.minX-5} ${b.minY-5} ${b.maxX-b.minX+10} ${b.maxY-b.minY+10}" aria-hidden="true">${cardSvg(c,0,0,r,f)}</svg>`;
}
function render() {
  document.documentElement.style.setProperty('--accent',colors[state.turn]);
  const scores=E.score(state);
  $('players').innerHTML=names.map((name,i)=>`<div class="player ${state.turn===i&&!state.finished?'active':''}" style="--player:${colors[i]}"><div class="player-top"><span class="player-symbol">${symbols[i]}</span>${name}<span class="turn-badge">${state.finished?'已完成':state.turn===i?'出牌':''}</span></div><div class="score-line"><span class="score">${scores[i]}</span><small>点</small><span class="remaining">余 ${state.decks[i].length} 张</span></div></div>`).join('');
  $('progress').textContent=state.finished?'36 / 36 · 已结束':`第 ${state.board.length} / 36 手`;
  $('resultBtn').disabled=!state.finished;
  legal=state.finished?[]:E.moves(state,current(),rotation,flip);
  isolated=!state.finished&&!E.hasMove(state);
  const status=state.finished?`${scores[0]===scores[1]?'平分秋色':names[scores[0]>scores[1]?0:1]+'获胜'} · 紫 ${scores[0]} : ${scores[1]} 橙`:pending?pending.isolated?'独立放置预览 · 确认后交接':`覆盖${pending.targetCard==='start'?'起始牌':pending.targetCard.startsWith('0-')?'紫方':'橙方'} ${pending.covered} 点 · 确认后交接`:isolated?'两端牌全部方向均无法连接 · 点击桌内空白处独立放置':legal.length?`${legal.length} 个合法落点 · 点击 ＋ 或用箭头预览`:'当前方向无落点 · 试试旋转、翻面或另一张牌';
  $('status').textContent=notice||status;
  renderHands(scores,notice||status);
  renderBoard();
}
function renderHands(scores,status) {
  document.body.classList.toggle('dual-layout',layout.dual);
  document.body.classList.toggle('mirror-player2',layout.mirror);
  $('player2Panel').hidden=!layout.dual;
  $('dualLayout').checked=layout.dual;$('mirrorPlayer2').checked=layout.mirror;
  for(const [prefix,owner,panel] of [['',layout.dual?0:state.turn,$('primaryPanel')],['p2',1,$('player2Panel')]]) {
    const active=owner===state.turn&&!state.finished;
    panel.classList.toggle('opposite',layout.mirror&&owner===1);
    panel.style.setProperty('--accent',colors[owner]);
    panel.dataset.owner=owner;
    const el=id=>$(prefix+id);
    el('handTitle').textContent=`玩家 ${owner+1} · ${names[owner]}${active?'出牌':state.finished?'结束':'等待'}`;
    el('orientation').textContent=active?`方向 ${rotation}° · ${flip?'镜像背面':'正面'}`:`余 ${state.decks[owner].length} 张`;
    el('hand').innerHTML=E.ends({...state,turn:owner}).map((c,i)=>{const chosen=active&&selected===i;return `<div class="card-slot ${chosen?'selected':''}"><button class="hand-card" data-card="${i}" ${active?'':'disabled'} aria-pressed="${chosen}" aria-label="${i?'牌堆底':'牌堆顶'}，${c.value}点">${handSvg(c,chosen)}<span>${i?'牌堆底':'牌堆顶'} · ${c.value} 点</span></button>${chosen?`<button class="card-tool rotate-left" data-action="left" aria-label="逆时针旋转45度">↶</button><button class="card-tool rotate-right" data-action="right" aria-label="顺时针旋转45度">↷</button><button class="card-tool flip-card" data-action="flip" aria-label="翻面">⇆</button>`:''}</div>`;}).join('');
    el('playBtn').disabled=!active||!pending;
    el('playBtn').textContent=state.finished?'本局已结束':!active?'等待对方':pending?'确认落牌':'选择落点';
    el('prevMove').disabled=el('nextMove').disabled=!active||!legal.length;
    el('moveCount').textContent=!active?'—':legal.length?`${pending?legal.findIndex(m=>near(m,pending))+1:'—'} / ${legal.length}`:isolated?'自由放置':'无落点';
  }
  $('primarySummary').textContent=`紫方 ${scores[0]} : ${scores[1]} 橙方`;
  $('primaryStatus').textContent=status;
  $('p2Summary').textContent=`紫方 ${scores[0]} : ${scores[1]} 橙方`;
  $('p2Status').textContent=state.turn===1?status:'等待玩家 1 出牌';
  for(const id of ['handoff','result'])$(id).classList.toggle('opposite',layout.mirror&&state.turn===1);
}
function near(a,b){return Math.hypot(a.x-b.x,a.y-b.y)<.01;}
function renderBoard() {
  const all=[...E.context(state).board];
  if(!state.finished)for(const m of legal)all.push(E.orient(current(),rotation,flip,m.x,m.y));
  if(pending&&!state.finished)all.push(E.orient(current(),rotation,flip,pending.x,pending.y));
  const boxes=all.map(c=>c.bounds);
  let minX=Math.min(...boxes.map(b=>b.minX))-70,minY=Math.min(...boxes.map(b=>b.minY))-70;
  let maxX=Math.max(...boxes.map(b=>b.maxX))+70,maxY=Math.max(...boxes.map(b=>b.maxY))+70;
  if(showTable||isolated){minX=-state.table.width/2-35;maxX=state.table.width/2+35;minY=-state.table.height/2-35;maxY=state.table.height/2+35;}
  const rect=$('boardWrap').getBoundingClientRect(),ratio=rect.width/rect.height;
  let w=Math.max(430,maxX-minX),h=Math.max(340,maxY-minY);if(w/h<ratio)w=h*ratio;else h=w/ratio;
  if(!manualCamera||!view) view={x:(minX+maxX-w)/2,y:(minY+maxY-h)/2,w,h};
  else {const width=view.h*ratio;view={...view,x:view.x+(view.w-width)/2,w:width};}
  applyCamera(view,false);
  let html=`<rect x="${-state.table.width/2}" y="${-state.table.height/2}" width="${state.table.width}" height="${state.table.height}" fill="var(--table)" stroke="var(--table-edge)" stroke-width="3"/><text x="${-state.table.width/2+15}" y="${-state.table.height/2+25}" fill="var(--muted)" font-size="16">固定桌界 · ${state.table.width} × ${state.table.height}</text>`;
  html+=state.board.map(c=>cardSvg(c,c.x,c.y,c.rotation,c.flip)).join('');
  if(pending&&!state.finished) {
    html+=`<g opacity=".86" pointer-events="none">${cardSvg(current(),pending.x,pending.y,rotation,flip)}<polygon points="${points(E.orient(current(),rotation,flip,pending.x,pending.y).polygon)}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="5 3"/></g>`;
  }
  const radius=view.w/rect.width*20;
  html+=legal.map((m,i)=>{const active=pending&&near(m,pending);return `<g class="move-target" data-move="${i}" role="button" tabindex="0" aria-label="落点 ${i+1}，覆盖 ${m.covered} 点"><circle cx="${m.x}" cy="${m.y}" r="${radius}" fill="${active?'var(--target-active)':'var(--target)'}" stroke="var(--target-edge)" stroke-width="1.5" stroke-dasharray="${active?'0':'3 3'}"/><text x="${m.x}" y="${m.y+radius*.33}" font-size="${radius*1.1}" fill="var(--ink)" text-anchor="middle" pointer-events="none">${active?'✓':'+'}</text></g>`;}).join('');
  $('board').innerHTML=html;
}
function resetSelection() {selected=0;rotation=0;flip=false;pending=null;notice='';manualCamera=false;view=null;showTable=false;}
function newGame() {state=E.create();resetSelection();document.querySelectorAll('dialog[open]').forEach(d=>d.close());save();render();}
for(const prefix of ['', 'p2'])$(prefix+'hand').addEventListener('click',e=>{
  if(Number(e.currentTarget.closest('.hand-panel').dataset.owner)!==state.turn||state.finished)return;
  const action=e.target.closest('[data-action]');
  if(action){
    const type=action.dataset.action;
    if(type==='flip')flip=!flip;else rotation=(rotation+(type==='left'?-45:45)+360)%360;
    pending=null;notice='';render();
    $(prefix+'hand').querySelector(`[data-action="${type}"]`)?.focus({preventScroll:true});
    return;
  }
  const b=e.target.closest('[data-card]');if(!b||selected===Number(b.dataset.card))return;
  selected=Number(b.dataset.card);rotation=0;flip=false;pending=null;notice='';render();
});
function selectMove(e) {
  const target=e.target.closest('[data-move]');
  if(target){pending=legal[Number(target.dataset.move)];notice='';render();return;}
  if(!isolated||state.finished||!Number.isFinite(e.clientX))return;
  const p=$('board').createSVGPoint();p.x=e.clientX;p.y=e.clientY;
  const world=p.matrixTransform($('board').getScreenCTM().inverse());
  const result=E.validate(state,current(),rotation,flip,world.x,world.y,true);
  if(result.ok){pending={x:world.x,y:world.y,...result};notice='';}else {pending=null;notice=result.reason;}
  render();
}
// Pointer taps are handled on release. Native click after a drag/pinch is ignored.
$('board').addEventListener('click',e=>{if(e.detail===0)selectMove(e);});
$('board').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectMove(e);}});
function cycleMove(delta) {if(!legal.length)return;const i=pending?legal.findIndex(m=>near(m,pending)):-1;pending=legal[(i+delta+legal.length)%legal.length];notice='';render();}
for(const prefix of ['', 'p2']) {$(prefix+'prevMove').onclick=()=>cycleMove(-1);$(prefix+'nextMove').onclick=()=>cycleMove(1);}
$('playBtn').onclick=$('p2playBtn').onclick=()=>{
  if(!pending||state.finished)return;
  try {E.play(state,current().id,rotation,flip,pending.x,pending.y);}catch(e){notice=e.message;pending=null;render();return;}
  resetSelection();save();render();if(state.finished)showResult();else if($('autoHandoff').checked)handoff();
};
function showResult() {const s=E.score(state);$('winner').textContent=s[0]===s[1]?'平分秋色，共享胜利。':`${names[s[0]>s[1]?0:1]}获胜！`;$('finalScore').textContent=`紫方 ${s[0]} 点 · 橙方 ${s[1]} 点。双方全部出完，按可见圆点结算。`;$('result').showModal();}
function handoff() {$('handoffTitle').textContent=state.finished?'这场对局已结束':`请交给${names[state.turn]}玩家`;$('handoff').showModal();}
$('rulesBtn').onclick=()=>$('rules').showModal();$('newBtn').onclick=()=>$('restart').showModal();
$('confirmNew').onclick=$('againBtn').onclick=newGame;$('privacyBtn').onclick=handoff;
$('deckBtn').onclick=()=>{
  // A reference catalogue is separate from shuffled deck order; never exposes a player's remaining stack.
  $('catalogue').innerHTML=window.TactaCards.cards.map(c=>`<article>${handSvg({...c,owner:0},false)}<span>${{square:'方形',circle:'圆形',triangle:'三角'}[c.suit]} ${c.value}${c.evidence==='partial'?' · 待完整核实':''}</span></article>`).join('');$('deckInfo').showModal();
};
$('resultBtn').onclick=()=>{if(state.finished)showResult();};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();
function applyCamera(next,manual=true) {
  view=next;if(manual)manualCamera=true;
  $('board').setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
  // Keep touch targets at 40 CSS pixels while zooming without replacing captured nodes.
  const radius=view.w/$('board').getBoundingClientRect().width*20;
  for(const target of $('board').querySelectorAll('.move-target')) {
    const circle=target.querySelector('circle'),text=target.querySelector('text');
    circle.setAttribute('r',radius);
    text.setAttribute('font-size',radius*1.1);
    text.setAttribute('y',Number(circle.getAttribute('cy'))+radius*.33);
  }
}
function zoomBy(factor) {
  const rect=$('board').getBoundingClientRect(),p={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  const limited=view.h/Math.max(75,Math.min(6000,view.h/factor));
  applyCamera(TactaGestures.anchored(view,rect,p,p,limited));
}
$('zoomIn').onclick=()=>zoomBy(1.3);$('zoomOut').onclick=()=>zoomBy(1/1.3);
$('fitBtn').onclick=()=>{manualCamera=false;showTable=false;renderBoard();};
$('tableBtn').onclick=()=>{showTable=!showTable;manualCamera=false;renderBoard();};
const gestures=TactaGestures.attach($('board'),{getView:()=>view,setView:applyCamera,onTap:selectMove});
window.addEventListener('blur',()=>gestures.cancel());
window.addEventListener('resize',renderBoard);render();save();

// Menus never occupy board space or stay open over an activated dialog.
const menu=document.querySelector('.menu');
menu.addEventListener('click',event=>{if(event.target.closest('button'))menu.open=false;});
document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target))menu.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape')menu.open=false;});
// Observe actual board size, including browser chrome and dynamic viewport changes.
new ResizeObserver(()=>renderBoard()).observe($('boardWrap'));

for(const [id,key] of [['dualLayout','dual'],['mirrorPlayer2','mirror']])$(id).addEventListener('change',event=>{
  layout[key]=event.target.checked;
  try {localStorage.setItem(layoutKey,JSON.stringify(layout));}catch {}
  render();
});

$('nightMode').checked=document.documentElement.dataset.theme==='dark';
$('nightMode').addEventListener('change',event=>{
  const theme=event.target.checked?'dark':'light';
  window.TactaTheme.apply(theme);
  try {localStorage.setItem('tacta-theme-v1',theme);}catch {}
});
