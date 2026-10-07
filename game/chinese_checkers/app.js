import {CELLS,COLORS,NAMES,HOMES,NEIGHBORS,rotate,createGame,legalMoves,allMoves,play,pass,undo,encode,replay} from './game.js';
import {Analysis} from './engine.js';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
let game=createGame(),selected=null,rotation=0,enabled=false,results=[],candidate=0,busy=false,hoverPath=null;
const buttons=[];
const engine=new Analysis(items=>{results=items;candidate=0;renderAnalysis();drawRoutes();},()=>{enabled=false;busy=false;results=[];render();notify('AI 加载失败，请通过 HTTP 服务打开后重试');},()=>{busy=false;renderAnalysis();});
function point(id){let p=[CELLS[id].q,CELLS[id].r];for(let i=0;i<rotation;i++)p=rotate(p);return [360+42*(p[0]+p[1]/2),330+42*Math.sqrt(3)/2*p[1]];}
const coord=id=>`${String.fromCharCode(65+CELLS[id].r+8)}${CELLS.filter(c=>c.r===CELLS[id].r).findIndex(c=>c.id===id)+1}`;
function notify(text){clearTimeout(notify.timer);$('notice').textContent=text;$('notice').hidden=!text;if(text)notify.timer=setTimeout(()=>{$('notice').hidden=true;},3200);}
function svg(name,attrs,parent){const el=document.createElementNS(NS,name);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);parent.append(el);return el;}
for(const c of CELLS){
 const b=document.createElement('button');b.type='button';b.className='hole';b.dataset.id=c.id;b.onclick=()=>choose(c.id);
 b.onmouseenter=()=>preview(c.id);b.onmouseleave=()=>{hoverPath=null;drawRoutes();};
 b.onfocus=()=>preview(c.id);b.onblur=()=>{hoverPath=null;drawRoutes();};
 b.onkeydown=e=>{
  if(e.key==='Escape'){selected=null;hoverPath=null;render();return;}
  const dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!dir)return;
  e.preventDefault();const origin=point(c.id);
  const next=CELLS.map(p=>{const dest=point(p.id),dx=dest[0]-origin[0],dy=dest[1]-origin[1],along=dx*dir[0]+dy*dir[1],across=Math.abs(dx*dir[1]-dy*dir[0]);return {id:p.id,score:along>1?Math.hypot(dx,dy)+across*2:Infinity};}).sort((a,b)=>a.score-b.score)[0];
  if(Number.isFinite(next.score))buttons[next.id].focus();
 };
 buttons.push(b);$('board').append(b);
}
function preview(id){hoverPath=selected!==null?legalMoves(game.board,selected).find(m=>m.to===id)?.path:null;drawRoutes();}
function drawSurface(){
 const surface=$('surface');surface.replaceChildren();
 // Camp polygons extend slightly beyond their outermost holes.
 for(let h=0;h<6;h++){
  const ids=HOMES[h],ps=ids.map(point),center=ps.reduce((a,p)=>[a[0]+p[0]/10,a[1]+p[1]/10],[0,0]);
  const corners=ps.filter(p=>Math.hypot(p[0]-center[0],p[1]-center[1])>65).map(p=>[center[0]+(p[0]-center[0])*1.26,center[1]+(p[1]-center[1])*1.26]);
  corners.sort((a,b)=>Math.atan2(a[1]-center[1],a[0]-center[0])-Math.atan2(b[1]-center[1],b[0]-center[0]));
  const target=(h+3)%6,targetActive=game.players.includes(target);
  svg('polygon',{points:corners.map(p=>p.join(',')).join(' '),fill:targetActive?COLORS[target]+'28':'#eee8dd55',stroke:targetActive?COLORS[target]+'70':'#ddd5c744','stroke-width':1.5,'stroke-linejoin':'round'},surface);
 }
 for(const c of CELLS)for(const to of NEIGHBORS[c.id])if(to>c.id){const a=point(c.id),b=point(to);svg('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#d9d0c0','stroke-width':1,opacity:.57},surface);}
}
function render(){
 drawSurface();const player=game.players[game.turn],moves=selected!==null?legalMoves(game.board,selected):[],last=game.history.at(-1);
 for(const c of CELLS){
  const b=buttons[c.id],p=game.board[c.id],[x,y]=point(c.id),legal=moves.some(m=>m.to===c.id);
  b.style.left=`${x/720*100}%`;b.style.top=`${y/660*100}%`;b.style.setProperty('--piece',p>=0?COLORS[p]:'#e9e2d6');
  b.className='hole'+(p>=0?' occupied':'')+(c.id===selected?' selected':'')+(legal?' legal':'')+(last&&(c.id===last.from||c.id===last.to)?' last':'');
  b.innerHTML=p>=0?`<span class="mark">${p+1}</span>`:'';
  b.setAttribute('aria-label',`${coord(c.id)}，${p>=0?NAMES[p]+'棋子':'空位'}${legal?'，可落子':''}`);b.setAttribute('aria-pressed',String(c.id===selected));
  b.title=`${coord(c.id)}${c.home>=0?' · '+NAMES[(c.home+3)%6]+'目标营地':''}`;
 }
 $('status').innerHTML=`<span class="dot" style="--piece:${COLORS[game.winner??player]}"></span>${game.winner!==null?NAMES[game.winner]+'获胜':NAMES[player]+'走棋'} <span style="font-weight:400;color:#999387;font-size:11px;margin-left:auto">第 ${Math.floor(game.history.length/game.count)+1} 轮</span>`;
 $('players').innerHTML=game.players.map(p=>`<div class="player${player===p?' active':''}"><span class="dot" style="--piece:${COLORS[p]}"></span>${p+1} ${NAMES[p]}<span class="progress">${HOMES[(p+3)%6].filter(id=>game.board[id]===p).length}/10</span></div>`).join('');
 for(const b of $('modes').children)b.setAttribute('aria-pressed',String(Number(b.dataset.count)===game.count));
 $('undo').disabled=!game.history.length;$('analysis').setAttribute('aria-pressed',String(enabled));
 $('pass').hidden=game.winner!==null||allMoves(game.board,player).length>0;
 renderAnalysis();drawRoutes();
}
function renderAnalysis(){
 $('insight').hidden=!enabled;
 $('engine-status').textContent=game.winner!==null?'本局已结束':results.length?`${busy?'搜索中':'完成'} · ${results[0].depth} 层`:busy?'正在计算…':'无合法走法';
 const list=$('candidates');list.replaceChildren();
 results.forEach((r,i)=>{const b=document.createElement('button');b.className='candidate';b.setAttribute('aria-pressed',String(candidate===i));b.innerHTML=`<span class="rank">${i+1}</span><span>${coord(r.from)} → ${coord(r.to)} <small>${r.kind==='jump'?(r.path.length-1)+' 跳':'平移'}</small></span><span class="gain">${r.score>90000?'可获胜':(r.gain>=0?'+':'')+(r.gain/10).toFixed(1)}</span>`;b.title='点击查看完整路线，再在棋盘上操作';b.onclick=()=>{candidate=i;selected=null;hoverPath=null;render();};list.append(b);});
}
function drawRoutes(){
 const layer=$('arrows');layer.replaceChildren();for(const b of buttons)b.classList.remove('preview');
 const last=game.history.at(-1),path=hoverPath||(selected===null&&enabled?results[candidate]?.path:null);
 if(!path){if(last?.path&&selected===null&&!enabled)drawPath(last.path,'#a99169',.45,false);return;}
 for(const id of path)buttons[id].classList.add('preview');drawPath(path,'#3e725a',.9,true);
 function drawPath(route,color,opacity,numbered){
  const defs=svg('defs',{},layer),marker=svg('marker',{id:'arrowhead',viewBox:'0 0 10 10',refX:8,refY:5,markerWidth:4,markerHeight:4,orient:'auto-start-reverse'},defs);svg('path',{d:'M0 0 L10 5 L0 10Z',fill:color},marker);
  for(let i=1;i<route.length;i++){
   const a=point(route[i-1]),b=point(route[i]),len=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/len,uy=(b[1]-a[1])/len;
   svg('path',{d:`M${a[0]+ux*13} ${a[1]+uy*13} L${b[0]-ux*16} ${b[1]-uy*16}`,fill:'none',stroke:color,'stroke-width':3,'stroke-linecap':'round','marker-end':'url(#arrowhead)',opacity},layer);
   if(numbered){svg('circle',{cx:b[0]+12,cy:b[1]-13,r:8,fill:color,stroke:'#faf7f2','stroke-width':1.5},layer);svg('text',{x:b[0]+12,y:b[1]-10,'text-anchor':'middle',fill:'white','font-size':9,'font-family':'sans-serif'},layer).textContent=i;}
  }
 }
}
function choose(id){
 if(game.winner!==null)return;
 if(selected!==null&&play(game,selected,id)){selected=null;hoverPath=null;save();refresh();return;}
 selected=game.board[id]===game.players[game.turn]&&selected!==id?id:null;hoverPath=null;render();
}
function save(replace=false){const url=new URL(location.href);url.searchParams.set('players',game.count);const moves=encode(game);if(moves)url.searchParams.set('moves',moves);else url.searchParams.delete('moves');try{history[replace?'replaceState':'pushState'](null,'',url);}catch{notify('浏览器未允许更新棋局链接');}}
function refresh(){engine.stop();results=[];candidate=0;hoverPath=null;busy=enabled&&game.winner===null;render();if(busy)engine.start(game);}
function load(){selected=null;try{const params=new URL(location.href).searchParams;game=replay(params.get('players')??2,params.get('moves')||'');}catch{game=createGame();notify('棋局链接无效，已恢复双人新局');save(true);}refresh();}
for(const b of $('modes').children)b.onclick=()=>{if(game.count===Number(b.dataset.count))return;game=createGame(Number(b.dataset.count));selected=null;save();refresh();};
$('undo').onclick=()=>{undo(game);selected=null;save();refresh();};
$('reset').onclick=()=>{game=createGame(game.count);selected=null;save();refresh();};
$('rotate').onclick=()=>{rotation=(rotation+1)%6;render();};
$('analysis').onclick=()=>{enabled=!enabled;refresh();};
$('pass').onclick=()=>{if(pass(game)){selected=null;save();refresh();}};
$('share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);notify('棋局链接已复制');}catch{window.prompt('复制此链接分享棋局',location.href);}};
window.addEventListener('popstate',load);window.addEventListener('pagehide',()=>engine.stop());window.addEventListener('pageshow',e=>{if(e.persisted)refresh();});load();
