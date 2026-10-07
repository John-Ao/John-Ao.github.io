import {COLORS,INKS,createGame,current,target,options,roll,skip,move,preview,validate,cellColor} from './game.js';
import {rotate,RING,airport,point,TILE_PATHS} from './board.js';
const $=id=>document.getElementById(id);let game=createGame(),history=[],worker=null,enabled=false,selected=null,rows=[],noticeTimer;
const svg=(tag,attrs={},text='')=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);el.textContent=text;return el;};
function message(text){$('notice').textContent=text;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,3000);}
function save(){try{localStorage.setItem('aeroplane-v2',JSON.stringify({game,history}));}catch{}}
function restore(){try{const hash=location.hash.slice(1);if(hash){const data=JSON.parse(decodeURIComponent(hash));if(!validate(data))throw Error();game=data;history=[];}else{const data=JSON.parse(localStorage.getItem('aeroplane-v2'));if(data&&validate(data.game)){game=data.game;history=Array.isArray(data.history)?data.history.filter(validate).slice(-150):[];}}}catch{game=createGame();history=[];message('棋局数据无效，已开始新局');}if(!game.over&&game.die!==null&&!options(game).length){skip(game);save();}render();analyze();}
function commit(fn){history.push(structuredClone(game));history=history.slice(-150);fn();selected=null;rows=[];if(location.hash)window.history.replaceState(null,'',location.pathname+location.search);save();render();analyze();}
function drawBoard(){
 const board=$('surface');board.replaceChildren();const flights=svg('g',{'aria-label':'飞行航线'});
 board.append(svg('rect',{x:.35,y:.35,width:18.3,height:18.3,rx:.45,fill:'#fffdf8',stroke:'#d8d1c4','stroke-width':.045}));
 // Continuous colored track with 52 white landing circles, matching the reference.
 for(let p=0;p<4;p++){
  const group=svg('g',{transform:`rotate(${p*90} 9.5 9.5)`});
  TILE_PATHS.forEach((d,i)=>group.append(svg('path',{d,fill:INKS[cellColor(p*13+i)],stroke:'#fffdf8','stroke-width':.035,'stroke-linejoin':'round'})));
  board.append(group);
 }
 RING.forEach(([x,y],i)=>board.append(svg('circle',{cx:x,cy:y,r:.385,fill:'#fffdf8',stroke:'#ffffff90','stroke-width':.025,'data-ring':i})));
 for(let p=0;p<4;p++){
  const color=INKS[p],active=game.players.includes(p),group=svg('g',{transform:`rotate(${p*90} 9.5 9.5)`});
  // The home arrow starts on the shared outer entry square and points inward.
  group.append(svg('path',{d:'M16 9H11V8.55L9.5 9.5L11 10.45V10H16Z',fill:color,stroke:'#fffdf8','stroke-width':.035}));
  board.append(group);
  for(let pos=51;pos<=56;pos++){
   const [x,y]=point(p,pos);board.append(svg('circle',{cx:x,cy:y,r:.385,fill:'#fffdf8','data-home':`${p}-${pos}`}));

  }
  const [ex,ey]=point(p,50);board.append(svg('text',{x:ex,y:ey+.1,'text-anchor':'middle','font-size':.22,fill:color},'入')); 
  const hangar=svg('g',{transform:`rotate(${p*90} 9.5 9.5)`,opacity:active?1:.38});
  hangar.append(svg('rect',{x:14,y:14,width:4,height:4,rx:.06,fill:color}));
  hangar.append(svg('path',{d:'M16 14L18 12V14Z',fill:color+'18',stroke:color,'stroke-width':.045,'stroke-dasharray':'.08 .06'}));
  board.append(hangar);
  for(let i=0;i<4;i++){const [x,y]=airport(p,i);board.append(svg('circle',{cx:x,cy:y,r:.55,fill:'#fffdf8',opacity:active?1:.7}));}
  const [lx,ly]=rotate([16,16],p);board.append(svg('text',{x:lx,y:ly+1.8,'text-anchor':'middle','font-size':.22,fill:active?'#fffdf8':color},COLORS[p]+(active?'机场':' · 未参赛')));
  const [sx,sy]=point(p,0);board.append(svg('text',{x:sx,y:sy+.1,'text-anchor':'middle','font-size':.23,fill:color},'起飞'));
  const from=point(p,18),to=point(p,30),dx=to[0]-from[0],dy=to[1]-from[1],len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
  flights.append(svg('line',{x1:from[0],y1:from[1],x2:to[0],y2:to[1],stroke:color,'stroke-width':.1,'stroke-dasharray':'.22 .18','data-flight':p}));
  flights.append(svg('path',{d:`M ${to[0]-ux*.36+uy*.17} ${to[1]-uy*.36-ux*.17} L ${to[0]} ${to[1]} L ${to[0]-ux*.36-uy*.17} ${to[1]-uy*.36+ux*.17}`,fill:'none',stroke:color,'stroke-width':.1,'stroke-linejoin':'round'}));
  flights.append(svg('circle',{cx:from[0],cy:from[1],r:.12,fill:color}));
  // Clockwise launch arrow from triangular apron to the first track square.
  const first=point(p,1),d=[first[0]-sx,first[1]-sy],n=Math.hypot(...d),u=d.map(v=>v/n),tip=[sx+u[0]*.6,sy+u[1]*.6];
  board.append(svg('path',{d:`M ${sx+u[0]*.28} ${sy+u[1]*.28} L ${tip[0]} ${tip[1]} M ${tip[0]-u[0]*.16+u[1]*.1} ${tip[1]-u[1]*.16-u[0]*.1} L ${tip[0]} ${tip[1]} L ${tip[0]-u[0]*.16-u[1]*.1} ${tip[1]-u[1]*.16+u[0]*.1}`,fill:'none',stroke:color,'stroke-width':.06}));
 }
 board.append(flights);
}
function route(p,i,path){$('routes').replaceChildren();if(!path)return;const points=path.map(pos=>point(p,pos,i));$('routes').append(svg('polyline',{points:points.map(x=>x.join(',')).join(' '),fill:'none',stroke:'#354f3a','stroke-width':.13,'stroke-linejoin':'round','stroke-linecap':'round',opacity:.75}));const [x,y]=points.at(-1);$('routes').append(svg('circle',{cx:x,cy:y,r:.52,fill:'none',stroke:'#354f3a','stroke-width':.09}));}
function select(i){selected=i;const next=preview(game,i);route(current(game),i,next.last.path);renderSelection();}
function renderSelection(){document.querySelectorAll('.plane').forEach(el=>el.classList.toggle('selected',+el.dataset.player===current(game)&&+el.dataset.piece===selected));document.querySelectorAll('.candidate').forEach(el=>el.setAttribute('aria-pressed',String(+el.dataset.piece===selected)));}
function planeName(p,i){
 const piece=game.pieces[p][i],[x,y]=point(p,piece.pos,i);
 if(piece.pos<0){const [cx,cy]=rotate([16,16],p);return `机场${y<cy?'上':'下'}${x<cx?'左':'右'}飞机`;}
 if(piece.done)return '已归队飞机';
 if(piece.pos===0)return '待起飞飞机';
 return `${Math.abs(x-9.5)>Math.abs(y-9.5)?x<9.5?'左侧':'右侧':y<9.5?'上方':'下方'}${piece.pos>=51?'终点航道':'航道'}飞机`;
}
function renderDice(){
 $('dice').replaceChildren();const p=current(game),moves=options(game);
 for(let q=0;q<4;q++){
  const currentPlayer=game.players.includes(q)&&!game.over&&q===p,active=currentPlayer&&game.die===null;
  const btn=document.createElement('button'),[x,y]=rotate([17.85,17.85],q);
  btn.className='hangar-die'+(active?' active':'')+(currentPlayer?' current':'');btn.dataset.player=q;
  btn.style.cssText=`left:${x/19*100}%;top:${y/19*100}%;--ink:${INKS[q]}`;
  const result=currentPlayer&&game.die!==null?game.die:game.last?.player===q?game.last.die:null;
  btn.textContent=result?['','⚀','⚁','⚂','⚃','⚄','⚅'][result]:'⚄';
  btn.disabled=!active;
  btn.setAttribute('aria-label',`${COLORS[q]}骰子${result?`，点数 ${result}`:''}${active?'，点击掷骰':''}`);
  btn.title=!game.players.includes(q)?'未参赛':game.over?'本局已结束':active?'点击掷骰子':currentPlayer?`掷出 ${game.die}，请选择飞机`:'等待该方回合';
  btn.onclick=rollDice;$('dice').append(btn);
 }
}
function render(){drawBoard();const p=current(game),moves=options(game);$('pieces').replaceChildren();$('routes').replaceChildren();for(const q of game.players)game.pieces[q].forEach((piece,i)=>{const [x,y]=point(q,piece.pos,i),btn=document.createElement('button');btn.className='plane'+(piece.done?' done':'')+(q===p&&moves.includes(i)?' available':'');btn.style.cssText=`left:${x/19*100}%;top:${y/19*100}%;--ink:${INKS[q]}`;btn.dataset.player=q;btn.dataset.piece=i;btn.textContent='✈';btn.setAttribute('aria-label',`${COLORS[q]}${planeName(q,i)}，${piece.done?'已归队':piece.pos<0?'机场':piece.pos===0?'起飞格':piece.pos>=51?'终点航道':'公共航道'}${q===p&&moves.includes(i)?'，点击移动':''}`);btn.disabled=q!==p||!moves.includes(i);btn.onclick=()=>commit(()=>move(game,i));btn.onmouseenter=()=>{if(!btn.disabled)select(i);};btn.onfocus=btn.onmouseenter;$('pieces').append(btn);});
 document.querySelectorAll('[data-count]').forEach(el=>el.setAttribute('aria-pressed',String(+el.dataset.count===game.players.length)));
 $('status').textContent=game.over?'本局结束 · 排名已揭晓':`${COLORS[p]}${game.die===null?' · 请掷骰':' · 选择飞机'}`;
 $('players').replaceChildren();const ranking=game.over?[...game.ranks,...game.players.filter(q=>!game.ranks.includes(q))]:game.ranks;for(const q of game.players){const el=document.createElement('div');el.className='player'+(!game.over&&q===p?' active':'');const rank=ranking.indexOf(q);el.innerHTML=`<span class="dot" style="--ink:${INKS[q]}"></span>${COLORS[q]}<span class="progress">${rank<0?`${game.pieces[q].filter(x=>x.done).length}/4 归队`:`第 ${rank+1} 名`}</span>`;$('players').append(el);}
 renderDice();$('hint').textContent=game.over?'全部航程已完成':game.die===null?'点击己方停机坪角落的骰子':moves.length?`掷出 ${game.die} · 点击飞机移动`:`掷出 ${game.die} · 暂无可走飞机`;
 $('choices').replaceChildren();for(const i of moves){const el=document.createElement('button');el.textContent=`${planeName(p,i)} · ${game.pieces[p][i].pos<0?'起飞':'前进'}`;el.onclick=()=>commit(()=>move(game,i));el.onmouseenter=()=>select(i);el.onfocus=el.onmouseenter;$('choices').append(el);}
 $('last').textContent=game.last?.text?.replace(/ \d+号/g,'')||'同屏轮流游玩 · 点击骰子开始';$('undo').disabled=!history.length;$('analysis').setAttribute('aria-pressed',String(enabled));$('insight').hidden=!enabled;$('candidates').replaceChildren();if(game.last?.path)route(game.last.player,game.last.piece,game.last.path);}
function analyze(){worker?.terminate();worker=null;rows=[];$('candidates').replaceChildren();if(!enabled)return;if(game.over||game.die===null||!options(game).length){$('engine-status').textContent=game.over?'本局已结束':game.die===null?'掷骰后分析':'无合法走法';return;}$('engine-status').textContent='分析中…';try{const w=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});worker=w;w.onmessage=({data})=>{if(worker!==w)return;if(data.done){$('engine-status').textContent=`完成 · ${rows[0]?.depth||1} 层`;w.terminate();worker=null;return;}rows=data.rows;$('candidates').replaceChildren();rows.forEach((row,index)=>{const el=document.createElement('button');el.className='candidate';el.dataset.piece=row.piece;const label=document.createElement('span'),score=document.createElement('span');label.textContent=`${index+1}. ${planeName(current(game),row.piece)} · ${row.text.split(' · ').slice(1).join(' · ')}`;score.textContent=`${row.score>=0?'+':''}${row.score.toFixed(1)}`;el.append(label,score);el.onclick=()=>select(row.piece);$('candidates').append(el);});if(selected===null&&rows.length)select(rows[0].piece);renderSelection();};w.onerror=()=>{if(worker!==w)return;w.terminate();worker=null;$('engine-status').textContent='分析未能启动，请刷新重试';};w.postMessage(game);}catch{$('engine-status').textContent='分析不可用，请通过 HTTP 打开';}}
function rollDice(){if(game.over||game.die!==null)return;commit(()=>{const data=new Uint32Array(1);do{crypto.getRandomValues(data);}while(data[0]>=4294967292);roll(game,data[0]%6+1);if(!options(game).length)skip(game);});}
$('undo').onclick=()=>{if(!history.length)return;game=history.pop();selected=null;if(location.hash)window.history.replaceState(null,'',location.pathname+location.search);save();render();analyze();};
$('reset').onclick=()=>commit(()=>{game=createGame(game.players.length);});document.querySelectorAll('[data-count]').forEach(el=>el.onclick=()=>{if(+el.dataset.count!==game.players.length)commit(()=>{game=createGame(+el.dataset.count);});});
$('analysis').onclick=()=>{enabled=!enabled;selected=null;render();analyze();};$('share').onclick=async()=>{const url=new URL(location.href);url.hash=encodeURIComponent(JSON.stringify({...game,last:null}));window.history.replaceState(null,'',url);try{await navigator.clipboard.writeText(url.href);message('棋局链接已复制');}catch{message('链接已生成，可复制地址栏分享');}};
window.addEventListener('hashchange',restore);window.addEventListener('keydown',e=>{if(e.key==='Escape'){selected=null;$('routes').replaceChildren();renderSelection();}});restore();
