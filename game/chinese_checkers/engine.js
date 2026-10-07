import {CELLS,HOMES,distance,allMoves,hasWon} from './game.js';
const distances=CELLS.map(a=>CELLS.map(b=>distance(a,b)));
// Greedily match the most constrained marbles to unfilled target holes. This rewards
// finishing the camp rather than piling all pieces up around the same target square.
export function evaluate(board,player){
 const target=HOMES[(player+3)%6],remaining=target.filter(id=>board[id]!==player);
 if(!remaining.length)return 100000;
 const pieces=CELLS.filter(c=>board[c.id]===player&&!target.includes(c.id)).map(c=>c.id);
 pieces.sort((a,b)=>Math.min(...remaining.map(t=>distances[b][t]))-Math.min(...remaining.map(t=>distances[a][t])));
 let cost=0,lag=0;
 for(const id of pieces){
  let best=0;for(let i=1;i<remaining.length;i++)if(distances[id][remaining[i]]<distances[id][remaining[best]])best=i;
  const d=distances[id][remaining[best]];cost+=d;lag=Math.max(lag,d);remaining.splice(best,1);
 }
 return -cost*10-lag*2+(10-pieces.length)*7;
}
const apply=(board,m,p)=>{const next=board.slice();next[m.from]=-1;next[m.to]=p;return next;};
export function analyze(board,players,turn,{maxDepth=4,budget=1800,onProgress=()=>{}}={}){
 const start=performance.now(),deadline=start+budget,root=players[turn];let nodes=0;
 const timeout=Symbol('timeout');
 const check=()=>{if(performance.now()>deadline)throw timeout;};
 const values=b=>players.map(p=>evaluate(b,p));
 function search(b,t,depth){
  check();nodes++;
  if(!depth)return values(b);
  const p=players[t];
  const candidates=allMoves(b,p).map(move=>{check();const next=apply(b,move,p);return {next,score:evaluate(next,p)};}).sort((a,b)=>b.score-a.score).slice(0,6);
  if(!candidates.length)return values(b);
  let best=null;
  for(const c of candidates){
   const v=c.score===100000?values(c.next):search(c.next,(t+1)%players.length,depth-1);
   // Max-n: each player chooses the continuation best for their own position.
   if(!best||v[t]>best[t])best=v;
  }
  return best;
 }
 const baseline=evaluate(board,root);
 let ranked=allMoves(board,root).map(move=>{const next=apply(board,move,root);return {move,next,score:evaluate(next,root)};}).sort((a,b)=>b.score-a.score);
 const finish=(items,depth)=>items.slice(0,5).map((c,i)=>({...c.move,rank:i+1,score:c.score,gain:c.score-baseline,depth,nodes,ms:Math.round(performance.now()-start)}));
 let result=finish(ranked,1);onProgress(result);
 // Beam search bounds work on crowded six-player positions. Never claim exhaustive search.
 const roots=ranked.slice(0,18);
 for(let depth=2;depth<=maxDepth;depth++){
  try{
   const candidates=roots.map(c=>{check();const v=hasWon(c.next,root)?values(c.next):search(c.next,(turn+1)%players.length,depth-1);return {...c,score:v[turn]-.12*Math.max(...v.filter((_,i)=>i!==turn))};}).sort((a,b)=>b.score-a.score);
   // Re-evaluate the baseline using the same relative score as searched candidates.
   const relativeBaseline=baseline-.12*Math.max(...players.filter(p=>p!==root).map(p=>evaluate(board,p)));
   result=finish(candidates,depth).map(c=>({...c,gain:c.score-relativeBaseline}));onProgress(result);
  }catch(e){if(e!==timeout)throw e;break;}
 }
 return result;
}
export class Analysis{
 constructor(onResults,onError,onDone){this.onResults=onResults;this.onError=onError;this.onDone=onDone;}
 stop(){this.worker?.terminate();this.worker=null;}
 start(game){
  this.stop();if(game.winner!==null)return;
  try{
   const worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});this.worker=worker;
   worker.onmessage=({data})=>{if(this.worker!==worker)return;if(data.done){this.stop();this.onDone?.();}else this.onResults(data);};
   worker.onerror=()=>{if(this.worker!==worker)return;this.stop();this.onError();};
   worker.postMessage({board:game.board,players:game.players,turn:game.turn});
  }catch{this.onError();}
 }
}
