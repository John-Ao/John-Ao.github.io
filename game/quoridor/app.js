'use strict';
const $=id=>document.getElementById(id),Q=window.Quoridor,names=['玩家一','玩家二'];
let state=Q.initial(Math.random()<.5?0:1),history=[],mode='move',orientation='h',preview=null;
const key='quoridor.local.v1';
try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&Array.isArray(saved.history)&&saved.history.length<10000){const start=Q.initial(saved.start);let s=start,hs=[];for(const action of saved.history){const n=Q.play(s,action);if(!n)throw Error('invalid');hs.push(s);s=n;}state=s;history=hs;}}catch{}
let actions=[];
// Reconstruct persisted actions from the verified state history.
function actionBetween(a,b){const p=a.turn;return b.walls.length>a.walls.length?{type:'wall',...b.walls[b.walls.length-1]}:{type:'move',...b.pawns[p]};}
if(history.length)actions=history.map((s,i)=>actionBetween(s,history[i+1]||state));
function save(){try{localStorage.setItem(key,JSON.stringify({start:(history[0]||state).turn,history:actions}));}catch{}}
function pos(el,x,y,w,h){Object.assign(el.style,{left:x/496*100+'%',top:y/496*100+'%',width:w/496*100+'%',height:h/496*100+'%'});}
function fence(w,extra=''){const el=document.createElement('div');el.className='fence '+extra;pos(el,w.o==='h'?w.c*56:w.c*56+48,w.o==='h'?w.r*56+48:w.r*56,w.o==='h'?104:8,w.o==='h'?8:104);$('board').append(el);}
function commit(action){const next=Q.play(state,action);if(!next)return;history.push(state);actions.push(action);state=next;preview=null;mode='move';save();render();}
function render(){
 document.documentElement.style.setProperty('--accent',state.turn===0?'#22677b':'#a65a26');
 $('turn').textContent=state.winner===null?names[state.turn]+'的回合':names[state.winner]+'获胜';
 $('ply').textContent='第 '+(state.ply+1)+' 手';
 for(let p=0;p<2;p++){$('player'+p).classList.toggle('active',state.turn===p);$('player'+p).querySelector('.stock').textContent='剩余墙 '+state.remaining[p]+' / 10';}
 $('hint').textContent=state.winner!==null?'已到达对面底线。本局结束。':mode==='move'?'点击带圆点的格子移动。':preview?(Q.wallError(state,preview)||'墙位可用，确认后结束本回合。'):'点击棋盘交点预览墙位，再确认放置。';
 $('move').setAttribute('aria-pressed',mode==='move');$('wall').setAttribute('aria-pressed',mode==='wall');
 $('horizontal').setAttribute('aria-pressed',orientation==='h');$('vertical').setAttribute('aria-pressed',orientation==='v');
 $('wallControls').hidden=mode!=='wall'||state.winner!==null;
 $('move').disabled=state.winner!==null;$('wall').disabled=state.winner!==null||state.remaining[state.turn]===0;
 $('confirm').disabled=!preview||!!Q.wallError(state,preview);$('undo').disabled=!history.length;
 const board=$('board');board.replaceChildren();const legal=Q.moves(state);
 for(let r=0;r<9;r++)for(let c=0;c<9;c++){
 const el=document.createElement('button'),can=mode==='move'&&legal.some(p=>p.r===r&&p.c===c);el.className='cell'+(r===0?' goal0':r===8?' goal1':'')+(can?' legal':'');pos(el,c*56,r*56,48,48);
 let p=state.pawns.findIndex(p=>p.r===r&&p.c===c);el.setAttribute('aria-label',`${r+1} 行 ${c+1} 列${p>=0?'，'+names[p]:can?'，可移动':''}`);
 el.disabled=!can; if(p>=0){const pawn=document.createElement('span');pawn.className='pawn p'+p+(state.turn===p?' current':'');pawn.textContent=p+1;el.append(pawn);}el.onclick=()=>commit({type:'move',r,c});board.append(el);
 }
 state.walls.forEach(w=>fence(w));
 if(mode==='wall'&&state.winner===null){
 if(preview)fence(preview,'preview'+(Q.wallError(state,preview)?' invalid':''));
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){const el=document.createElement('button');el.className='anchor'+(preview&&preview.r===r&&preview.c===c?' selected':'');pos(el,c*56+24,r*56+24,56,56);el.setAttribute('aria-label',`预览第 ${r+1} 行 ${c+1} 列${orientation==='h'?'横':'竖'}墙`);el.onclick=()=>{preview={r,c,o:orientation};render();};board.append(el);}
 }
 window.fitGame();
}
$('move').onclick=()=>{mode='move';preview=null;render();};$('wall').onclick=()=>{mode='wall';render();};
for(const [id,o] of [['horizontal','h'],['vertical','v']])$(id).onclick=()=>{orientation=o;if(preview)preview.o=o;render();};
$('confirm').onclick=()=>{if(preview)commit({type:'wall',...preview});};
$('undo').onclick=()=>{if(history.length){state=history.pop();actions.pop();mode='move';preview=null;save();render();}};
$('restart').onclick=()=>$('restartDialog').showModal();$('cancelRestart').onclick=()=>$('restartDialog').close();
$('acceptRestart').onclick=()=>{state=Q.initial(Math.random()<.5?0:1);history=[];actions=[];mode='move';preview=null;save();render();$('restartDialog').close();};
$('rules').onclick=()=>$('rulesDialog').showModal();render();
