import {coord,index,other} from './game.js';

export function fen(board,side){
 const rows=[];
 for(let y=0;y<10;y++){
  let row='',empty=0;
  for(let x=0;x<9;x++){const p=board[y*9+x];if(!p){empty++;continue;}if(empty){row+=empty;empty=0;}row+=p;}
  if(empty)row+=empty;rows.push(row);
 }
 return rows.join('/')+` ${side==='r'?'w':'b'} - - 0 1`;
}
export function positionCommand(game){
 // Reconstruct the starting position and pass every move, preserving repetition history.
 const board=game.board.slice();let side=game.side;
 for(const m of [...game.history].reverse()){board[m.from]=board[m.to];board[m.to]=m.captured;side=other(side);}
 const moves=game.history.map(m=>coord(m.from)+coord(m.to)).join(' ');
 return `position fen ${fen(board,side)}${moves?' moves '+moves:''}`;
}
export function parseInfo(line){
 if(!line.startsWith('info ')||/\b(?:upperbound|lowerbound)\b/.test(line))return null;
 const d=line.match(/\bdepth (\d+)/),s=line.match(/\bscore (cp|mate) (-?\d+)/),pv=line.match(/\bpv ((?:[a-i][0-9][a-i][0-9])(?:\s+[a-i][0-9][a-i][0-9])*)\s*$/);
 if(!d||!s||!pv)return null;
 const move=pv[1].split(/\s+/)[0];
 return {depth:+d[1],rank:+(line.match(/\bmultipv (\d+)/)?.[1]||1),type:s[1],score:+s[2],move,from:index(move.slice(0,2)),to:index(move.slice(2)),pv:pv[1],nodes:+(line.match(/\bnodes (\d+)/)?.[1]||0),nps:+(line.match(/\bnps (\d+)/)?.[1]||0)};
}
export function scoreLabel(r){
 if(r.type==='mate')return r.score>0?`${r.score} 步内胜`:r.score<0?`${-r.score} 步内负`:'终局';
 return (r.score>0?'+':'')+(r.score/100).toFixed(2);
}
export class CandidateBatch{
 constructor(count,legal){this.count=count;this.legal=legal;this.depth=-1;this.published=-1;this.items=new Map();}
 add(item){
  if(!item||item.rank<1||item.rank>this.count||!this.legal.has(item.move)||item.depth<this.depth||item.depth<=this.published)return null;
  if(item.depth>this.depth){this.depth=item.depth;this.items.clear();}
  this.items.set(item.rank,item);
  if(this.items.size!==this.count)return null;
  const items=Array.from({length:this.count},(_,i)=>this.items.get(i+1));
  if(items.some(i=>!i)||new Set(items.map(i=>i.move)).size!==this.count)return null;
  this.published=this.depth;return items;
 }
}
export class Analysis{
 constructor(onResults,onStatus,onError){this.onResults=onResults;this.onStatus=onStatus;this.onError=onError;this.state='off';this.worker=null;this.pending=null;this.needsNewGame=true;}
 command(command){this.worker.postMessage({type:'command',command});}
 armTimeout(ms=30000){clearTimeout(this.timer);this.timer=setTimeout(()=>this.fail('引擎响应超时，请重试'),ms);}
 fail(message){this.stop();this.onError(message);}
 stop(){clearTimeout(this.timer);this.worker?.terminate();this.worker=null;this.pending=null;this.batch=null;this.state='off';this.needsNewGame=true;}
 start(game,{newGame=false}={}){
  this.needsNewGame ||= newGame;
  const moves=game.moves();
  if(game.outcome()||!moves.length){this.stop();return;}
  this.pending={position:positionCommand(game),legal:new Set(moves.map(m=>coord(m.from)+coord(m.to))),count:1};
  this.batch=null;
  if(this.worker){
   if(this.state==='searching'){this.state='stopping';this.command('stop');this.armTimeout();}
   else if(this.state==='idle')this.synchronize();
   this.onStatus(this.state==='loading'?'正在加载 Pikafish NNUE…':'Pikafish · 正在分析…');return;
  }
  if(!globalThis.crossOriginIsolated||typeof SharedArrayBuffer==='undefined'){this.fail('AI 需要浏览器允许 Service Worker，请通过 127.0.0.1、localhost 或 HTTPS 访问后刷新');return;}
  this.state='loading';this.onStatus('正在加载 Pikafish NNUE…');this.armTimeout(120000);
  try{
   const worker=new Worker(new URL('./vendor/pikafish/worker.js',import.meta.url));this.worker=worker;
   worker.onerror=()=>{if(this.worker===worker)this.fail('Pikafish 加载失败，请检查浏览器 WebAssembly 支持后重试');};
   worker.onmessageerror=worker.onerror;
   worker.onmessage=({data})=>{
    if(this.worker!==worker)return;
    if(data.type==='error'){this.fail('Pikafish 初始化失败：'+data.error);return;}
    if(data.type==='net-progress'){const percent=data.total?Math.floor(data.loaded/data.total*100):null;this.onStatus(`加载 Pikafish 模型 · ${percent===null?(data.loaded/1e6).toFixed(1)+' MB':percent+'%'}`);return;}
    if(data.type==='ready'){this.state='uci';this.command('uci');return;}
    if(data.type!=='line')return;
    for(const line of data.line.split('\n'))this.line(line.trim());
   };
   const asset=name=>new URL('./vendor/pikafish/'+name,import.meta.url).href;
   worker.postMessage({type:'init',jsUrl:asset('pikafish.js'),wasmUrl:asset('pikafish.wasm'),netUrl:asset('pikafish.nnue')});
  }catch{this.fail('无法创建 Pikafish 分析线程');}
 }
 synchronize(){
  this.state='sync';
  if(this.needsNewGame){this.command('ucinewgame');this.needsNewGame=false;}
  this.command('isready');this.armTimeout();
 }
 line(line){
  if(line==='uciok'&&this.state==='uci'){
   this.command(`setoption name Threads value ${Math.min(4,Math.max(1,(globalThis.navigator?.hardwareConcurrency||2)-1))}`);
   this.command('setoption name Hash value 256');
   this.synchronize();return;
  }
  if(line.startsWith('bestmove')){
   if(this.state==='stopping'){this.synchronize();return;}
   if(this.state==='searching'){this.state='idle';this.onStatus('Pikafish · 本次搜索已完成');}return;
  }
  if(line==='readyok'&&this.state==='sync'){
   if(this.needsNewGame){this.synchronize();return;}
   clearTimeout(this.timer);
   const request=this.pending;this.pending=null;
   if(!request){this.state='idle';return;}
   this.batch=new CandidateBatch(request.count,request.legal);
   this.command(`setoption name MultiPV value ${request.count}`);
   this.command(request.position);this.state='searching';
   // Restrict root moves to the UI's legal move set; terminal adjudication stays in game.js.
   this.command('go infinite searchmoves '+[...request.legal].join(' '));
   this.armTimeout(30000);
   this.onStatus('Pikafish NNUE · 正在分析…');return;
  }
  if(this.state!=='searching')return;
  const items=this.batch?.add(parseInfo(line));
  if(items){clearTimeout(this.timer);this.onResults(items);}
 }
}
