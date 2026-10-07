import {Chess,replay,encode,status} from './game.js';
import {pieceSVG,names} from './pieces.js';
import {Analysis,scoreLabel,whiteWdl} from './engine.js';
const $=id=>document.getElementById(id);
let game=new Chess(),selected=null,flipped=false,enabled=false,results=[],promotionMoves=[];
const cells=[];
const engine=new Analysis(items=>{results=items;render();},message=>{if(!enabled)return;enabled=false;results=[];render();notify(message);});
function notify(text){clearTimeout(notify.timer);$('notice').textContent=text;$('notice').hidden=!text;if(text)notify.timer=setTimeout(()=>{$('notice').hidden=true;},3500);}
function squareAt(i){const col=i%8,row=Math.floor(i/8);return String.fromCharCode(97+(flipped?7-col:col))+(flipped?row+1:8-row);}
function point(square){let x=square.charCodeAt(0)-97,y=8-Number(square[1]);if(flipped){x=7-x;y=7-y;}return [x*100+50,y*100+50];}
for(let i=0;i<64;i++){
 const cell=document.createElement('button');cell.className='square';cell.type='button';
 cell.onclick=()=>choose(squareAt(i));
 cell.onkeydown=event=>{
  const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[event.key];
  if(offset!==undefined){event.preventDefault();const next=i+offset;if(next>=0&&next<64&&(Math.abs(offset)===8||Math.floor(next/8)===Math.floor(i/8)))cells[next].focus();}
  if(event.key==='Escape'){selected=null;render();}
 };
 cells.push(cell);$('board').append(cell);
}
function render(){
 const legal=selected&&!game.isGameOver()?game.moves({square:selected,verbose:true}):[];
 const last=game.history({verbose:true}).at(-1);
 for(let i=0;i<64;i++){
  const square=squareAt(i),piece=game.get(square),cell=cells[i];
  cell.dataset.square=square;
  cell.className='square'+((Math.floor(i/8)+i%8)%2?' dark':'')+(piece?' occupied':'')+(last&&(square===last.from||square===last.to)?' last':'')+(selected===square?' selected':'')+(legal.some(m=>m.to===square)?' legal':'')+(piece?.type==='k'&&piece.color===game.turn()&&game.isCheck()?' check':'');
  cell.innerHTML=(piece?pieceSVG(piece.type,piece.color):'')+(i%8===0?`<span class="coord rank">${square[1]}</span>`:'')+(i>=56?`<span class="coord file">${square[0]}</span>`:'');
  cell.setAttribute('aria-label',`${square} ${piece?(piece.color==='w'?'白':'黑')+names[piece.type]:'空格'}${legal.some(m=>m.to===square)?'，可走':''}`);
  cell.setAttribute('aria-pressed',String(selected===square));
  cell.title=results.filter(r=>r.move.slice(0,2)===square||r.move.slice(2,4)===square).map(r=>`候选 ${r.rank}：${r.move.slice(0,2)} → ${r.move.slice(2,4)}${r.move[4]?' 升变'+names[r.move[4]]:''} · ${scoreLabel(r)}（当前走棋方视角，深度 ${r.depth}）`).join('\n');
 }
 $('status').textContent=status(game);$('undo').disabled=!game.history().length;
 $('analysis').setAttribute('aria-pressed',String(enabled));$('flip').setAttribute('aria-pressed',String(flipped));
 $('analysis').title=enabled?(results.length?`Stockfish · 深度 ${results[0].depth} · 点击停止`:'Stockfish 正在启动分析 · 点击停止'):'Stockfish 本地持续分析';
 $('hint').textContent=enabled&&!game.isGameOver()?(results.length?'箭头为当前最佳走法':'正在准备分析引擎…'):'点击棋子，再选择落点';
 renderArrows();renderWdl();
}
function renderWdl(){
 $('wdl').hidden=!enabled;
 let values=whiteWdl(results[0]?.wdl,game.turn());
 if(game.isCheckmate()) values=game.turn()==='w'?[0,0,1000]:[1000,0,0];
 else if(game.isDraw()) values=[0,1000,0];
 const labels=['white','draw','black'];
 labels.forEach((name,i)=>{
  $('wdl-'+name).style.width=values?`${values[i]/10}%`:'0%';
  $(name+'-prob').textContent=values?`${(values[i]/10).toFixed(1)}%`:'—';
 });
 $('wdl-track').setAttribute('aria-label',values?`白胜 ${(values[0]/10).toFixed(1)}%，和棋 ${(values[1]/10).toFixed(1)}%，黑胜 ${(values[2]/10).toFixed(1)}%`:'等待胜率分析');
}
function renderArrows(){
 const counts=new Map();
 $('arrows').innerHTML=results.map(r=>{
  const [x1,y1]=point(r.move.slice(0,2)),[x2,y2]=point(r.move.slice(2,4));
  const color=r.score>0?'#237552':r.score<0?'#ba5144':'#77766f';
  const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
  const endX=x2-ux*20,endY=y2-uy*20;
  const numberAt=counts.get(r.move.slice(2,4))||0;counts.set(r.move.slice(2,4),numberAt+1);
  const bx=x2-30+(numberAt%3)*29,by=y2-30+Math.floor(numberAt/3)*29;
  return `<g opacity="${selected?'.35':'.78'}"><path d="M${x1+ux*22} ${y1+uy*22} L${endX-ux*15} ${endY-uy*15}" stroke="${color}" stroke-width="${r.rank===1?10:7}" fill="none" stroke-linecap="round"/><path d="M${endX} ${endY} L${endX-ux*23-uy*12} ${endY-uy*23+ux*12} L${endX-ux*23+uy*12} ${endY-uy*23-ux*12}Z" fill="${color}"/></g>${results.length>1?`<g><circle cx="${bx}" cy="${by}" r="13" fill="${color}" stroke="#fffaf0" stroke-width="2"/><text x="${bx}" y="${by+5}" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-weight="bold" font-size="15">${r.rank}</text></g>`:''}`;
 }).join('');
}
function choose(square){
 if(game.isGameOver()||$('promotion').open)return;
 const possible=selected?game.moves({square:selected,verbose:true}).filter(m=>m.to===square):[];
 if(possible.length){
  if(possible[0].promotion){
   promotionMoves=possible;$('promotion-options').innerHTML='';
   for(const type of ['q','r','b','n']){
    const button=document.createElement('button');button.type='button';button.dataset.piece=type;
    button.setAttribute('aria-label','升变为'+names[type]);button.innerHTML=pieceSVG(type,game.turn())+`<span>${names[type]}</span>`;
    button.onclick=()=>{const move=promotionMoves.find(m=>m.promotion===type);$('promotion').close();play(move);};$('promotion-options').append(button);
   }
   $('promotion').showModal();return;
  }
  play(possible[0]);return;
 }
 const piece=game.get(square);
 selected=piece?.color===game.turn()&&square!==selected?square:null;render();
}
function play(move){game.move({from:move.from,to:move.to,promotion:move.promotion});selected=null;notify('');save();refresh();}
function save(replace=false){
 const url=new URL(location.href),moves=encode(game);
 if(moves)url.searchParams.set('moves',moves);else url.searchParams.delete('moves');
 try{history[replace?'replaceState':'pushState'](null,'',url);}catch{notify('浏览器未允许保存棋局网址');}
}
function refresh(){engine.stop();results=[];render();if(enabled)engine.start(game);}
function load(){
 $('promotion').close();selected=null;
 try{game=replay(new URL(location.href).searchParams.get('moves')||'');}
 catch{game=new Chess();notify('网址中的棋谱无效，已重置棋盘');save(true);}
 refresh();
}
$('undo').onclick=()=>{game.undo();selected=null;save();refresh();};
$('reset').onclick=()=>{game=new Chess();selected=null;save();refresh();};
$('analysis').onclick=()=>{enabled=!enabled;refresh();};
$('flip').onclick=()=>{flipped=!flipped;render();};
$('cancel-promotion').onclick=()=>{$('promotion').close();};
$('promotion').addEventListener('close',()=>{promotionMoves=[];});
$('share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);notify('棋局链接已复制');}catch{prompt('复制此链接分享棋局：',location.href);}};
window.addEventListener('popstate',load);
window.addEventListener('pagehide',()=>{clearTimeout(warmupTimer);engine.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted)refresh();});
load();
// Prepare in the background without starting a search; reuse on every move.
let warmupTimer=setTimeout(()=>{if(!document.hidden)engine.prepare();},300);
