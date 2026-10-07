import {Game,names,color,coord,inCheck,encode,replay} from './game.js';
import {Analysis,scoreLabel} from './engine.js';
import {analysisArrows} from './arrows.js';
const $=id=>document.getElementById(id);
let game=new Game(),selected=null,flipped=false,textFlipped=false,enabled=false,results=[],depth=0,engineStatus='';
const engine=new Analysis(items=>{results=items;depth=items[0].depth;engineStatus='';render();},text=>{engineStatus=text;render();},message=>{enabled=false;results=[];depth=0;engineStatus='';render();notify(message);});
const cells=[];const squareAt=i=>flipped?89-i:i;
function point(i){i=flipped?89-i:i;return [50+i%9*100,50+Math.floor(i/9)*100];}
let lines='';for(let y=0;y<10;y++)lines+=`M50 ${50+y*100}H850 `;for(let x=0;x<9;x++)lines+=x===0||x===8?`M${50+x*100} 50V950 `:`M${50+x*100} 50V450 M${50+x*100} 550V950 `;
lines+='M350 50L550 250M550 50L350 250M350 750L550 950M550 750L350 950';
$('lines').innerHTML=`<path d="${lines}" fill="none" stroke="#987c55" stroke-width="2"/><g fill="#967c57" font-size="34" font-family="serif" text-anchor="middle"><text x="250" y="512" letter-spacing="18">楚河</text><text x="650" y="512" letter-spacing="18">汉界</text></g>`;
for(let i=0;i<90;i++){const cell=document.createElement('button');cell.type='button';cell.onclick=()=>choose(squareAt(i));cell.onkeydown=e=>{const off={ArrowLeft:-1,ArrowRight:1,ArrowUp:-9,ArrowDown:9}[e.key];if(off!==undefined){e.preventDefault();const n=i+off;if(n>=0&&n<90&&(Math.abs(off)===9||Math.floor(n/9)===Math.floor(i/9)))cells[n].focus();}if(e.key==='Escape'){selected=null;render();}};cells.push(cell);$('board').append(cell);}
const label=scoreLabel;
function description(r){return `${names[game.board[r.from]]} ${coord(r.from)} → ${coord(r.to)}`;}
function render(){const outcome=game.outcome(),legal=selected!==null&&!outcome?game.moves().filter(m=>m.from===selected):[],last=game.history.at(-1),check=inCheck(game.board,game.side);
 cells.forEach((cell,i)=>{const s=squareAt(i),p=game.board[s],valid=legal.some(m=>m.to===s);cell.dataset.square=coord(s);cell.className='square'+(p?' occupied':'')+(s===selected?' selected':'')+(valid?' legal':'')+(last&&(s===last.from||s===last.to)?' last':'')+(p?.toLowerCase()==='k'&&color(p)===game.side&&check?' check':'');cell.innerHTML=p?`<span class="piece ${color(p)==='r'?'red':''}"><span class="piece-text">${names[p]}</span></span>`:'';cell.setAttribute('aria-label',`${coord(s)} ${p?(color(p)==='r'?'红':'黑')+names[p]:'空位'}${valid?'，可走':''}`);cell.setAttribute('aria-pressed',String(s===selected));cell.title=results.filter(r=>r.from===s||r.to===s).map((r)=>`${description(r)} · ${label(r)} · 深度 ${depth}`).join('\n');});
 $('status').textContent=outcome||`${game.side==='r'?'红':'黑'}方走棋${check?' · 将军':''}`;$('undo').disabled=!game.history.length;$('analysis').setAttribute('aria-pressed',String(enabled));$('flip').setAttribute('aria-pressed',String(flipped));$('flip-text').setAttribute('aria-pressed',String(textFlipped));$('board').classList.toggle('flip-black-text',textFlipped);$('analysis').title=enabled?(depth?`Pikafish NNUE · 深度 ${depth} · 点击停止`:(engineStatus||'正在分析当前局面…')):'Pikafish NNUE 本地分析';
 $('candidates').innerHTML=results.map((r,i)=>`<li title="${r.pv}"><span>${i+1}. ${description(r)}</span><strong class="${r.score<0?'negative':''}">${label(r)}</strong></li>`).join('');
 $('arrows').innerHTML=analysisArrows(results,point,selected!==null);
}
function notify(t){clearTimeout(notify.timer);$('notice').textContent=t;$('notice').hidden=false;notify.timer=setTimeout(()=>$('notice').hidden=true,3500);}
function stop(){engine.stop();}
function refresh(newGame=false){results=[];depth=0;engineStatus='';render();if(enabled&&!game.outcome())engine.start(game,{newGame});else engine.stop();}
function save(replace=false){const url=new URL(location.href),text=encode(game);if(text)url.searchParams.set('moves',text);else url.searchParams.delete('moves');history[replace?'replaceState':'pushState'](null,'',url);}
function choose(s){if(game.outcome())return;if(selected!==null&&game.move({from:selected,to:s})){selected=null;save();refresh();return;}selected=color(game.board[s])===game.side&&selected!==s?s:null;render();}
function load(){try{game=replay(new URL(location.href).searchParams.get('moves')||'');}catch{game=new Game();save(true);notify('棋谱链接无效，已恢复初始局面');}selected=null;refresh(true);}
$('undo').onclick=()=>{game.undo();selected=null;save();refresh();};$('reset').onclick=()=>{game=new Game();selected=null;save();refresh(true);};$('flip').onclick=()=>{flipped=!flipped;render();};$('flip-text').onclick=()=>{textFlipped=!textFlipped;render();};$('analysis').onclick=()=>{enabled=!enabled;refresh();};$('share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);notify('棋局链接已复制');}catch{prompt('复制棋局链接：',location.href);}};
window.addEventListener('popstate',load);window.addEventListener('pagehide',stop);window.addEventListener('pageshow',e=>{if(e.persisted)refresh();});load();
