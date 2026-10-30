import * as engine from './engine.js';
import {setupNetwork} from './network-controller.js';
const {create,name,choose,place}=engine;
let network=null;
const $=id=>document.getElementById(id),key='quarto-clover-v1';
let s=create(),past=[],actions=[];
const step=(state,a)=>{if(a.type==='choose')return choose(state,a.value);if(a.type==='place')return place(state,a.value);throw Error('无效存档');};
try{const v=JSON.parse(localStorage.getItem(key));if(v){for(const a of v.actions){const t=step(s,a);past.push(s);actions.push(a);s=t;}}}catch{s=create();past=[];actions=[];}
const systemTheme=matchMedia('(prefers-color-scheme: dark)');
let theme;try{theme=localStorage.getItem('quarto-theme');}catch{}
function setTheme(value){document.documentElement.dataset.theme=value;$('theme').textContent=value==='dark'?'日间':'夜间';$('theme').setAttribute('aria-label',value==='dark'?'切换到日间模式':'切换到夜间模式');document.querySelector('meta[name="theme-color"]').content=value==='dark'?'#171e23':'#f3f0e9';}
setTheme(theme==='dark'||theme==='light'?theme:systemTheme.matches?'dark':'light');
systemTheme.addEventListener('change',e=>{if(!theme)setTheme(e.matches?'dark':'light');});
$('theme').onclick=()=>{theme=document.documentElement.dataset.theme==='dark'?'light':'dark';setTheme(theme);try{localStorage.setItem('quarto-theme',theme);}catch{}};
function piece(p){const left=p&1?'<path d="M13 35 H43 L28 65Z"/>':'<circle cx="28" cy="50" r="15"/>',right=p&4?'<path d="M72 31 L88 50 L72 69 L56 50Z"/>':'<path d="M72 31 L77.2 43.8 L91 44.8 L80.4 53.7 L83.8 67.2 L72 60 L60.2 67.2 L63.6 53.7 L53 44.8 L66.8 43.8Z"/>';return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect class="token" x="4" y="20" width="92" height="60" rx="12"/><g fill="var(--left-${(p>>1)&1})">${left}</g><g fill="var(--right-${(p>>3)&1})">${right}</g></svg>`;}
function render(){const status=s.winner===0?'和棋':s.winner!==null?`玩家 ${s.winner} 获胜`:s.phase==='place'?`玩家 ${s.turn}，将选中的棋子放入空格`:`玩家 ${s.turn}，选择一枚棋子交给对方`;$('status').textContent=status;$('board').setAttribute('aria-label',`连四棋 四乘四棋盘。${status}`);if(s.winner!==null)$('board').dataset.result=String(s.winner);else delete $('board').dataset.result;$('board').replaceChildren();
for(let i=0;i<16;i++){const b=document.createElement('button'),p=s.board[i];b.className='cell'+(s.last===i?' last':'')+(s.wonLines.some(l=>l.includes(i))?' winning':'');b.dataset.point=i;b.setAttribute('aria-label',`${Math.floor(i/4)+1}行${i%4+1}列，${p===null?'空格':name(p)}`);b.title=s.winner!==null?status:p===null?status:name(p);if(p!==null)b.innerHTML=piece(p);b.disabled=!canAct()||s.phase!=='place'||p!==null||s.winner!==null;b.onclick=()=>act({type:'place',value:i});$('board').append(b);}
$('pool-first').replaceChildren();$('pool-second').replaceChildren();for(let p=0;p<16;p++){const b=document.createElement('button'),available=s.remaining.includes(p),held=s.held===p;b.className='piece-slot'+(held?' held':'');b.dataset.piece=p;if(available||held)b.innerHTML=piece(p);else b.style.visibility='hidden';b.title=held?`待放置：${name(p)}`:name(p);b.setAttribute('aria-label',held?`待放置：${name(p)}`:`交出 ${name(p)}`);b.setAttribute('aria-pressed',String(held));b.disabled=!canAct()||!available||s.phase!=='choose'||s.winner!==null;b.onclick=()=>act({type:'choose',value:p});$(p<8?'pool-first':'pool-second').append(b);}$('undo').disabled=!past.length;network?.render();}
function canAct(){return !network||network.canAct();}
function save(){if(network?.isOnline())return;try{localStorage.setItem(key,JSON.stringify({actions}));}catch{}}
function act(a){
  if(!canAct())return;
  if(network?.isOnline()){network.sendAction(a);return;}
  try{const t=step(s,a);past.push(s);actions.push(a);s=t;save();render();if(s.winner!==null)network.dialog('本局结束',s.winner===0?'和棋':`玩家 ${s.winner} 获胜`);}
  catch(e){network.dialog('操作未完成',e.message);}
}
$('undo').onclick=()=>{if(network?.isOnline()){network.undo();return;}if(!past.length)return;s=past.pop();actions.pop();save();render();};
$('reset').onclick=async()=>{
  if(network?.isOnline()){network.restart();return;}
  const previous=s;
  if(actions.length&&!await network.dialog('重新开始？','当前本地棋局将清空。',{confirm:'重开',valid:()=>!network.isOnline()&&s===previous}))return;
  s=create();past=[];actions=[];save();render();
};
network=setupNetwork({engine,getState:()=>s,getLocal:()=>({s,past,actions}),restoreLocal:value=>{({s,past,actions}=value);},setState:value=>{s=value;},render});
render();network.start();
